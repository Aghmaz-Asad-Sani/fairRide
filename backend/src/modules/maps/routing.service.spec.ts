import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoutingService } from './routing.service';

describe('RoutingService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests an OSRM driving route and returns meters and seconds', async () => {
    const config = {
      get: jest.fn((key: string, fallback: string) => {
        if (key === 'ROUTING_PROVIDER') return 'osrm';
        if (key === 'ROUTING_BASE_URL') return 'http://localhost:5000/';
        return fallback;
      }),
    } as unknown as ConfigService;
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 1234.2,
              duration: 321.1,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [67.001, 24.86],
                  [67.015, 24.87],
                  [67.03, 24.88],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const service = new RoutingService(config);

    await expect(
      service.estimate(
        { latitude: 24.86, longitude: 67.001 },
        { latitude: 24.88, longitude: 67.03 },
      ),
    ).resolves.toEqual({
      distanceMeters: 1235,
      durationSeconds: 322,
      source: 'configured_routing_provider',
      geometry: [
        { latitude: 24.86, longitude: 67.001 },
        { latitude: 24.87, longitude: 67.015 },
        { latitude: 24.88, longitude: 67.03 },
      ],
    });
    const requestedUrl = fetch.mock.calls[0][0];
    if (!(requestedUrl instanceof URL)) {
      throw new Error('Expected an OSRM URL request');
    }
    expect(requestedUrl.href).toBe(
      'http://localhost:5000/route/v1/driving/67.001,24.86;67.03,24.88?overview=full&geometries=geojson',
    );
    expect(fetch.mock.calls[0][1]?.signal).toHaveProperty('aborted', false);
  });

  it('rejects trips without an available drivable route', async () => {
    const config = {
      get: jest.fn((key: string, fallback: string) =>
        key === 'ROUTING_PROVIDER'
          ? 'osrm'
          : key === 'ROUTING_BASE_URL'
            ? 'http://localhost:5000'
            : fallback,
      ),
    } as unknown as ConfigService;
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'NoRoute', routes: [] }), {
        status: 200,
      }),
    );
    const service = new RoutingService(config);

    await expect(
      service.estimate(
        { latitude: 24.86, longitude: 67.001 },
        { latitude: 24.88, longitude: 67.03 },
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('reports an unavailable OSRM server explicitly', async () => {
    const config = {
      get: jest.fn((key: string, fallback: string) =>
        key === 'ROUTING_PROVIDER'
          ? 'osrm'
          : key === 'ROUTING_BASE_URL'
            ? 'http://localhost:5000'
            : fallback,
      ),
    } as unknown as ConfigService;
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const service = new RoutingService(config);

    await expect(
      service.estimate(
        { latitude: 24.86, longitude: 67.001 },
        { latitude: 24.88, longitude: 67.03 },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns Google traffic-aware duration and decoded road geometry', async () => {
    const config = {
      get: jest.fn((key: string, fallback: string) => {
        if (key === 'ROUTING_PROVIDER') return 'google_maps';
        if (key === 'GOOGLE_ROUTES_API_KEY') return 'test-server-key';
        return fallback;
      }),
    } as unknown as ConfigService;
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [
            {
              distanceMeters: 10000,
              duration: '123s',
              staticDuration: '100s',
              polyline: {
                encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const service = new RoutingService(config);

    await expect(
      service.estimate(
        { latitude: 38.5, longitude: -120.2 },
        { latitude: 43.252, longitude: -126.453 },
      ),
    ).resolves.toEqual({
      distanceMeters: 10000,
      durationSeconds: 123,
      staticDurationSeconds: 100,
      source: 'google_maps',
      geometry: [
        { latitude: 38.5, longitude: -120.2 },
        { latitude: 40.7, longitude: -120.95 },
        { latitude: 43.252, longitude: -126.453 },
      ],
    });
    const request = fetch.mock.calls[0][1];
    expect(request?.headers).toMatchObject({
      'X-Goog-Api-Key': 'test-server-key',
      'X-Goog-FieldMask':
        'routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline',
    });
    expect(request?.body).toEqual(
      expect.stringContaining('"routingPreference":"TRAFFIC_AWARE"'),
    );
    expect(request?.body).toEqual(
      expect.stringContaining('"travelMode":"DRIVE"'),
    );
  });

  it('rejects a Google route with invalid encoded geometry', async () => {
    const config = {
      get: jest.fn((key: string, fallback: string) =>
        key === 'ROUTING_PROVIDER'
          ? 'google_maps'
          : key === 'GOOGLE_ROUTES_API_KEY'
            ? 'test-server-key'
            : fallback,
      ),
    } as unknown as ConfigService;
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [
            {
              distanceMeters: 1000,
              duration: '60s',
              staticDuration: '60s',
              polyline: { encodedPolyline: 'invalid' },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const service = new RoutingService(config);

    await expect(
      service.estimate(
        { latitude: 24.86, longitude: 67.001 },
        { latitude: 24.88, longitude: 67.03 },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
