import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WsResponse,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthSession } from '../auth/auth-session.entity';
import { AccessTokenPayload, AuthenticatedUser } from '../auth/auth.types';
import { UserRole, UserStatus } from '../users/user.entity';
import { DriverService } from '../drivers/driver.service';
import { Ride, RideStatus } from './ride.entity';
import { isUUID } from 'class-validator';

interface RealtimeSocketData {
  user?: AuthenticatedUser;
}

type AuthenticatedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  RealtimeSocketData
>;

interface DriverLocationMessage {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

const rideRoom = (rideId: string) => `ride:${rideId}`;
const userRoom = (userId: string) => `user:${userId}`;

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
  },
})
export class RideRealtimeGateway
  implements OnGatewayConnection<AuthenticatedSocket>, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    private readonly drivers: DriverService,
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = this.readAccessToken(client);
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sessionId !== 'string'
      ) {
        throw new WsException('Invalid access token');
      }
      const session = await this.sessions.findOne({
        where: {
          id: payload.sessionId,
          userId: payload.sub,
          revokedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        relations: { user: true },
      });
      if (!session || session.user.status !== UserStatus.ACTIVE) {
        throw new WsException('Session is no longer active');
      }
      client.data.user = {
        id: session.user.id,
        role: session.user.role,
        status: session.user.status,
        sessionId: session.id,
      };
      await client.join(userRoom(session.user.id));
      client.emit('connection:ready', { userId: session.user.id });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    delete client.data.user;
  }

  @SubscribeMessage('ride:join')
  async joinRide(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() message: unknown,
  ): Promise<WsResponse<{ rideId: string }>> {
    const user = await this.authenticatedUser(client);
    const rideId = this.readRideId(message);
    const ride = await this.dataSource.getRepository(Ride).findOne({
      where: { id: rideId },
      select: { id: true, passengerId: true, driverId: true },
    });
    if (!ride || (ride.passengerId !== user.id && ride.driverId !== user.id)) {
      throw new WsException('Ride not found or access denied');
    }
    await client.join(rideRoom(rideId));
    return { event: 'ride:joined', data: { rideId } };
  }

  @SubscribeMessage('ride:leave')
  async leaveRide(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() message: unknown,
  ): Promise<WsResponse<{ rideId: string }>> {
    await this.authenticatedUser(client);
    const rideId = this.readRideId(message);
    await client.leave(rideRoom(rideId));
    return { event: 'ride:left', data: { rideId } };
  }

  @SubscribeMessage('driver:location')
  async updateDriverLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() message: unknown,
  ): Promise<WsResponse<{ receivedAt: Date }>> {
    const user = await this.authenticatedUser(client);
    if (user.role !== UserRole.DRIVER) {
      throw new WsException('Driver account required');
    }
    const location = this.readLocation(message);
    const result = await this.drivers.updateLocation(user, location);
    const activeRide = await this.dataSource.getRepository(Ride).findOne({
      where: {
        driverId: user.id,
        status: In([
          RideStatus.ACCEPTED,
          RideStatus.DRIVER_ARRIVING,
          RideStatus.IN_PROGRESS,
        ]),
      },
      select: { id: true },
    });
    if (activeRide) {
      this.server.to(rideRoom(activeRide.id)).emit('ride:driver-location', {
        rideId: activeRide.id,
        ...location,
        receivedAt: result.receivedAt,
      });
    }
    return {
      event: 'driver:location:accepted',
      data: { receivedAt: result.receivedAt },
    };
  }

  emitOfferCreated(driverId: string, rideId: string): void {
    this.server
      ?.to(userRoom(driverId))
      .emit('driver:offer-created', { rideId });
  }

  emitRideStatus(rideId: string, status: RideStatus): void {
    this.server?.to(rideRoom(rideId)).emit('ride:status', {
      rideId,
      status,
      emittedAt: new Date(),
    });
  }

  private readAccessToken(client: AuthenticatedSocket): string {
    const authToken: unknown = client.handshake.auth?.accessToken;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }
    const authorization = client.handshake.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length);
    }
    throw new WsException('Bearer access token required');
  }

  private async authenticatedUser(
    client: AuthenticatedSocket,
  ): Promise<AuthenticatedUser> {
    const user = client.data.user;
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new WsException('Authentication required');
    }
    const session = await this.sessions.findOne({
      where: {
        id: user.sessionId,
        userId: user.id,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      select: { id: true },
    });
    if (!session) {
      client.disconnect(true);
      throw new WsException('Session is no longer active');
    }
    return user;
  }

  private readRideId(message: unknown): string {
    if (
      typeof message !== 'object' ||
      message === null ||
      !('rideId' in message) ||
      typeof message.rideId !== 'string' ||
      !isUUID(message.rideId)
    ) {
      throw new WsException('A valid rideId is required');
    }
    return message.rideId;
  }

  private readLocation(message: unknown): DriverLocationMessage {
    if (typeof message !== 'object' || message === null) {
      throw new WsException('A location object is required');
    }
    const value = message as Record<string, unknown>;
    if (
      typeof value.latitude !== 'number' ||
      !Number.isFinite(value.latitude) ||
      value.latitude < -90 ||
      value.latitude > 90 ||
      typeof value.longitude !== 'number' ||
      !Number.isFinite(value.longitude) ||
      value.longitude < -180 ||
      value.longitude > 180 ||
      (value.accuracyMeters !== undefined &&
        (typeof value.accuracyMeters !== 'number' ||
          !Number.isFinite(value.accuracyMeters) ||
          value.accuracyMeters < 0 ||
          value.accuracyMeters > 1000))
    ) {
      throw new WsException('Location coordinates or accuracy are invalid');
    }
    return {
      latitude: value.latitude,
      longitude: value.longitude,
      ...(typeof value.accuracyMeters === 'number'
        ? { accuracyMeters: value.accuracyMeters }
        : {}),
    };
  }
}
