import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import Joi from 'joi';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './modules/health/health.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { RidesModule } from './modules/rides/rides.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(5).default(0),
        LOG_LEVEL: Joi.string().default('info'),
        CORS_ORIGINS: Joi.string().allow('').default(''),
        DATABASE_HOST: Joi.string().default('localhost'),
        DATABASE_PORT: Joi.number().port().default(5432),
        DATABASE_USER: Joi.string().default('fairride'),
        DATABASE_PASSWORD: Joi.string().min(1).required(),
        DATABASE_NAME: Joi.string().default('fairride'),
        REDIS_URL: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string()
          .min(32)
          .invalid('replace_with_a_random_secret_at_least_32_characters')
          .required(),
        JWT_REFRESH_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
        JWT_ACCESS_TTL_SECONDS: Joi.number()
          .integer()
          .min(60)
          .max(3600)
          .default(900),
        AUTH_LOGIN_LIMIT: Joi.number().integer().min(1).max(100).default(5),
        AUTH_LOGIN_WINDOW_SECONDS: Joi.number()
          .integer()
          .min(10)
          .max(3600)
          .default(60),
        AUTH_REGISTER_LIMIT: Joi.number().integer().min(1).max(100).default(5),
        DRIVER_LOCATION_MAX_AGE_SECONDS: Joi.number()
          .integer()
          .min(30)
          .max(600)
          .default(120),
        DRIVER_MATCH_RADIUS_METERS: Joi.number()
          .integer()
          .min(500)
          .max(30000)
          .default(8000),
        DRIVER_MATCH_LIMIT: Joi.number().integer().min(1).max(20).default(5),
        RIDE_OFFER_TTL_SECONDS: Joi.number()
          .integer()
          .min(15)
          .max(300)
          .default(45),
        FARE_BASE_PAISA: Joi.number().integer().min(0).default(15000),
        FARE_PER_KM_PAISA: Joi.number().integer().min(0).default(3500),
        FARE_PER_MINUTE_PAISA: Joi.number().integer().min(0).default(500),
        FARE_MINIMUM_PAISA: Joi.number().integer().min(0).default(20000),
        ROUTING_PROVIDER: Joi.string()
          .valid('development', 'osrm')
          .default('development'),
        ROUTING_BASE_URL: Joi.string().uri().allow(''),
        OTP_DEV_RETURN_CODE: Joi.boolean().default(false),
        OTP_CODE_TTL_SECONDS: Joi.number()
          .integer()
          .min(60)
          .max(600)
          .default(300),
      }).custom((value: unknown, helpers) => {
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          return helpers.error('any.invalid');
        }
        const settings = value as Record<string, unknown>;
        if (
          settings.NODE_ENV === 'production' &&
          (settings.ROUTING_PROVIDER !== 'osrm' || !settings.ROUTING_BASE_URL)
        ) {
          return helpers.error('any.invalid');
        }
        if (
          settings.NODE_ENV === 'production' &&
          settings.OTP_DEV_RETURN_CODE
        ) {
          return helpers.error('any.invalid');
        }
        return settings;
      }),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.otp',
          'req.body.code',
          'req.body.pin',
          'req.body.refreshToken',
          'req.body.identifier',
          'req.body.phone',
          'req.body.email',
        ],
        level: process.env.LOG_LEVEL ?? 'info',
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DATABASE_HOST'),
        port: config.getOrThrow<number>('DATABASE_PORT'),
        username: config.getOrThrow<string>('DATABASE_USER'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.getOrThrow<string>('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        retryAttempts: 2,
        retryDelay: 1000,
      }),
    }),
    HealthModule,
    AuthModule,
    DriversModule,
    RidesModule,
    KnowledgeBaseModule,
  ],
})
export class AppModule {}
