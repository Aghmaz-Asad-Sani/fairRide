import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
  staticDurationSeconds?: number;
  source:
    'development_estimate' | 'configured_routing_provider' | 'google_maps';
  geometry?: Coordinates[];
}

function decodeGooglePolyline(encoded: string): Coordinates[] {
  if (encoded.length > 200_000) {
    throw new ServiceUnavailableException(
      'Routing provider returned invalid route geometry',
    );
  }
  const coordinates: Coordinates[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  try {
    while (index < encoded.length) {
      const decodeValue = (): number => {
        let result = 0;
        let shift = 0;
        let byte: number;
        do {
          if (index >= encoded.length || shift > 30) {
            throw new Error('Invalid encoded polyline');
          }
          byte = encoded.charCodeAt(index++) - 63;
          if (byte < 0 || byte > 63) {
            throw new Error('Invalid encoded polyline');
          }
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);
        return result & 1 ? ~(result >> 1) : result >> 1;
      };

      latitude += decodeValue();
      longitude += decodeValue();
      const point = {
        latitude: latitude / 1e5,
        longitude: longitude / 1e5,
      };
      if (
        point.latitude < -90 ||
        point.latitude > 90 ||
        point.longitude < -180 ||
        point.longitude > 180
      ) {
        throw new Error('Invalid encoded polyline');
      }
      coordinates.push(point);
    }
  } catch {
    throw new ServiceUnavailableException(
      'Routing provider returned invalid route geometry',
    );
  }

  if (coordinates.length < 2) {
    throw new ServiceUnavailableException(
      'Routing provider returned invalid route geometry',
    );
  }
  const maximumPoints = 1000;
  if (coordinates.length <= maximumPoints) return coordinates;
  const step = (coordinates.length - 1) / (maximumPoints - 1);
  return Array.from(
    { length: maximumPoints },
    (_, pointIndex) => coordinates[Math.round(pointIndex * step)],
  );
}

function readGoogleDuration(value: unknown, field: string): number {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?s$/.test(value)) {
    throw new ServiceUnavailableException(
      `Routing provider returned an invalid ${field}`,
    );
  }
  const duration = Number(value.slice(0, -1));
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new ServiceUnavailableException(
      `Routing provider returned an invalid ${field}`,
    );
  }
  return Math.ceil(duration);
}

function routeGeometry(value: unknown): Coordinates[] {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    value.type !== 'LineString' ||
    !('coordinates' in value) ||
    !Array.isArray(value.coordinates) ||
    value.coordinates.length < 2
  ) {
    throw new ServiceUnavailableException(
      'Routing provider returned invalid route geometry',
    );
  }

  const coordinates = value.coordinates.map((point: unknown) => {
    if (
      !Array.isArray(point) ||
      typeof point[0] !== 'number' ||
      typeof point[1] !== 'number' ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1]) ||
      point[0] < -180 ||
      point[0] > 180 ||
      point[1] < -90 ||
      point[1] > 90
    ) {
      throw new ServiceUnavailableException(
        'Routing provider returned invalid route geometry',
      );
    }
    return { latitude: point[1], longitude: point[0] };
  });

  const maximumPoints = 1000;
  if (coordinates.length <= maximumPoints) return coordinates;
  const step = (coordinates.length - 1) / (maximumPoints - 1);
  return Array.from(
    { length: maximumPoints },
    (_, index) => coordinates[Math.round(index * step)],
  );
}

export abstract class RoutingProvider {
  abstract route(
    pickup: Coordinates,
    destination: Coordinates,
  ): Promise<RouteEstimate>;
}

@Injectable()
export class RoutingService {
  private readonly provider: 'development' | 'osrm' | 'google_maps';
  private readonly baseUrl: string;
  private readonly googleRoutesApiKey: string;

  constructor(config: ConfigService) {
    this.provider = config.get<'development' | 'osrm' | 'google_maps'>(
      'ROUTING_PROVIDER',
      'development',
    );
    this.baseUrl = config
      .get<string>('ROUTING_BASE_URL', '')
      .replace(/\/$/, '');
    this.googleRoutesApiKey = config.get<string>('GOOGLE_ROUTES_API_KEY', '');
  }

  async estimate(
    pickup: Coordinates,
    destination: Coordinates,
  ): Promise<RouteEstimate> {
    if (this.provider === 'development') {
      return this.developmentEstimate(pickup, destination);
    }
    if (this.provider === 'google_maps') {
      return this.googleMapsEstimate(pickup, destination);
    }
    return this.osrmEstimate(pickup, destination);
  }

  private async osrmEstimate(
    pickup: Coordinates,
    destination: Coordinates,
  ): Promise<RouteEstimate> {
    if (!this.baseUrl) {
      throw new ServiceUnavailableException(
        'Routing provider is not configured',
      );
    }
    const url = new URL(
      `/route/v1/driving/${pickup.longitude},${pickup.latitude};${destination.longitude},${destination.latitude}`,
      this.baseUrl,
    );
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new ServiceUnavailableException(
          'Routing provider is unavailable',
        );
      }
      const result: unknown = await response.json();
      if (
        typeof result !== 'object' ||
        result === null ||
        !('code' in result) ||
        result.code !== 'Ok' ||
        !('routes' in result) ||
        !Array.isArray(result.routes) ||
        result.routes.length === 0
      ) {
        throw new UnprocessableEntityException(
          'No drivable route is available for this trip',
        );
      }
      const route: unknown = result.routes[0];
      if (
        typeof route !== 'object' ||
        route === null ||
        !('distance' in route) ||
        !('duration' in route) ||
        !('geometry' in route) ||
        typeof route.distance !== 'number' ||
        typeof route.duration !== 'number' ||
        !Number.isFinite(route.distance) ||
        !Number.isFinite(route.duration) ||
        route.distance <= 0 ||
        route.duration <= 0
      ) {
        throw new ServiceUnavailableException(
          'Routing provider returned an invalid route',
        );
      }
      return {
        distanceMeters: Math.ceil(route.distance),
        durationSeconds: Math.ceil(route.duration),
        source: 'configured_routing_provider',
        geometry: routeGeometry(route.geometry),
      };
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException('Routing provider request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async googleMapsEstimate(
    pickup: Coordinates,
    destination: Coordinates,
  ): Promise<RouteEstimate> {
    if (!this.googleRoutesApiKey) {
      throw new ServiceUnavailableException(
        'Google Routes API is not configured',
      );
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.googleRoutesApiKey,
            'X-Goog-FieldMask':
              'routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline',
          },
          body: JSON.stringify({
            origin: { location: { latLng: pickup } },
            destination: { location: { latLng: destination } },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
            departureTime: new Date().toISOString(),
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new ServiceUnavailableException(
          'Google Routes API is unavailable; check the API key, billing, and Routes API access',
        );
      }
      const result: unknown = await response.json();
      if (
        typeof result !== 'object' ||
        result === null ||
        !('routes' in result) ||
        !Array.isArray(result.routes) ||
        result.routes.length === 0
      ) {
        throw new UnprocessableEntityException(
          'No drivable route is available for this trip',
        );
      }
      const route: unknown = result.routes[0];
      if (
        typeof route !== 'object' ||
        route === null ||
        !('distanceMeters' in route) ||
        !('duration' in route) ||
        !('staticDuration' in route) ||
        !('polyline' in route) ||
        typeof route.distanceMeters !== 'number' ||
        !Number.isSafeInteger(route.distanceMeters) ||
        route.distanceMeters <= 0 ||
        typeof route.polyline !== 'object' ||
        route.polyline === null ||
        !('encodedPolyline' in route.polyline) ||
        typeof route.polyline.encodedPolyline !== 'string'
      ) {
        throw new ServiceUnavailableException(
          'Google Routes API returned an invalid route',
        );
      }
      return {
        distanceMeters: route.distanceMeters,
        durationSeconds: readGoogleDuration(route.duration, 'traffic duration'),
        staticDurationSeconds: readGoogleDuration(
          route.staticDuration,
          'static duration',
        ),
        source: 'google_maps',
        geometry: decodeGooglePolyline(route.polyline.encodedPolyline),
      };
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException('Google Routes API request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private developmentEstimate(
    pickup: Coordinates,
    destination: Coordinates,
  ): RouteEstimate {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const deltaLatitude = toRadians(destination.latitude - pickup.latitude);
    const deltaLongitude = toRadians(destination.longitude - pickup.longitude);
    const latitude1 = toRadians(pickup.latitude);
    const latitude2 = toRadians(destination.latitude);
    const a =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(latitude1) *
        Math.cos(latitude2) *
        Math.sin(deltaLongitude / 2) ** 2;
    const straightLineMeters =
      6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (straightLineMeters < 50) {
      throw new UnprocessableEntityException(
        'Pickup and destination are too close for a ride',
      );
    }
    const distanceMeters = Math.ceil(straightLineMeters * 1.3);
    return {
      distanceMeters,
      durationSeconds: Math.ceil((distanceMeters / 1000 / 25) * 3600),
      source: 'development_estimate',
      geometry: [pickup, destination],
    };
  }
}
