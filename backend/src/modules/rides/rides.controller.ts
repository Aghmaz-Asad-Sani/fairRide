import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { FareEstimateDto } from '../pricing/dto/fare-estimate.dto';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { CreateRideDto } from './dto/create-ride.dto';
import { ListRidesDto } from './dto/list-rides.dto';
import { TripPinDto } from './dto/trip-pin.dto';
import { RidesService } from './rides.service';

@ApiTags('rides')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class RidesController {
  constructor(private readonly rides: RidesService) {}

  @Post('pricing/estimate')
  @Roles(UserRole.PASSENGER, UserRole.DRIVER)
  @ApiOperation({
    summary: 'Get an itemized server-side fare estimate (PKR paisa)',
  })
  estimateFare(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: FareEstimateDto,
  ) {
    return this.rides.estimateFare(user, input);
  }

  @Post('rides')
  @Roles(UserRole.PASSENGER)
  @ApiOperation({
    summary:
      'Create a server-priced cash ride and notify nearby eligible drivers',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateRideDto,
  ) {
    return this.rides.create(user, input, idempotencyKey);
  }

  @Get('rides')
  @Roles(UserRole.PASSENGER, UserRole.DRIVER)
  @ApiOperation({ summary: 'List your own paginated ride history' })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRidesDto,
  ) {
    return this.rides.history(user, query);
  }

  @Get('rides/:rideId')
  @Roles(UserRole.PASSENGER, UserRole.DRIVER)
  @ApiOperation({
    summary: 'Get a ride visible to its passenger or assigned driver',
  })
  getRide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    return this.rides.getRide(user, rideId);
  }

  @Get('drivers/offers')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'List active nearby ride offers for this driver' })
  offers(@CurrentUser() user: AuthenticatedUser) {
    return this.rides.driverOffers(user);
  }

  @Post('drivers/offers/:rideId/accept')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Atomically accept one active eligible offer' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    return this.rides.acceptOffer(user, rideId);
  }

  @Post('drivers/offers/:rideId/reject')
  @Roles(UserRole.DRIVER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject one of your pending offers' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    return this.rides.rejectOffer(user, rideId);
  }

  @Post('rides/:rideId/arrived')
  @Roles(UserRole.DRIVER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark arrival at the passenger pickup point' })
  arrived(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    return this.rides.markArrived(user, rideId);
  }

  @Post('rides/:rideId/start')
  @Roles(UserRole.DRIVER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify passenger pickup PIN and start the ride' })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rideId', ParseUUIDPipe) rideId: string,
    @Body() input: TripPinDto,
  ) {
    return this.rides.start(user, rideId, input.pin);
  }

  @Post('rides/:rideId/complete')
  @Roles(UserRole.DRIVER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete an in-progress ride and finalize its fare',
  })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    return this.rides.complete(user, rideId);
  }

  @Post('rides/:rideId/cancel')
  @Roles(UserRole.PASSENGER, UserRole.DRIVER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a ride before the trip begins' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rideId', ParseUUIDPipe) rideId: string,
    @Body() input: CancelRideDto,
  ) {
    return this.rides.cancel(user, rideId, input);
  }
}
