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
  source: 'development_estimate' | 'configured_routing_provider';
}

export abstract class RoutingProvider {
  abstract route(
    pickup: Coordinates,
    destination: Coordinates,
  ): Promise<RouteEstimate>;
}

@Injectable()
export class RoutingService {
  private readonly provider: 'development' | 'osrm';
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.provider = config.get<'development' | 'osrm'>(
      'ROUTING_PROVIDER',
      'development',
    );
    this.baseUrl = config
      .get<string>('ROUTING_BASE_URL', '')
      .replace(/\/$/, '');
  }

  async estimate(
    pickup: Coordinates,
    destination: Coordinates,
  ): Promise<RouteEstimate> {
    if (this.provider === 'development') {
      return this.developmentEstimate(pickup, destination);
    }
    if (!this.baseUrl) {
      throw new ServiceUnavailableException(
        'Routing provider is not configured',
      );
    }

    const url = new URL(
      `/route/v1/driving/${pickup.longitude},${pickup.latitude};${destination.longitude},${destination.latitude}`,
      this.baseUrl,
    );
    url.searchParams.set('overview', 'false');
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
    };
  }
}
