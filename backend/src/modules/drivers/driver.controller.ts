import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { AvailabilityDto } from './dto/availability.dto';
import { DriverLocationDto } from './dto/location.dto';
import { DriverProfileDto } from './dto/driver-profile.dto';
import {
  DriverVerificationDto,
  VehicleVerificationDto,
} from './dto/verification.dto';
import { CreateVehicleDto } from './dto/vehicle.dto';
import { VehicleActiveDto } from './dto/vehicle-active.dto';
import { DriverService } from './driver.service';

@ApiTags('drivers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('drivers')
export class DriverController {
  constructor(private readonly drivers: DriverService) {}

  @Post('profile')
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary: 'Submit or update driver license details for review',
  })
  submitProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: DriverProfileDto,
  ) {
    return this.drivers.submitProfile(user, input);
  }

  @Get('profile')
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary: 'Get your driver verification profile and vehicles',
  })
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.drivers.profile(user);
  }

  @Post('vehicles')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Register a vehicle for verification' })
  addVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateVehicleDto,
  ) {
    return this.drivers.addVehicle(user, input);
  }

  @Get('vehicles')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'List your registered vehicles' })
  vehicles(@CurrentUser() user: AuthenticatedUser) {
    return this.drivers.vehicles(user);
  }

  @Patch('vehicles/:vehicleId/active')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Activate or deactivate one of your vehicles' })
  setVehicleActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() input: VehicleActiveDto,
  ) {
    return this.drivers.setVehicleActive(user, vehicleId, input.isActive);
  }

  @Post('location')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Update your private driver location' })
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: DriverLocationDto,
  ) {
    return this.drivers.updateLocation(user, input);
  }

  @Patch('availability')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Go online/offline and toggle offer availability' })
  availability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: AvailabilityDto,
  ) {
    return this.drivers.setAvailability(user, input);
  }

  @Patch('admin/:driverId/verification')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve or reject a driver after document review' })
  verifyDriver(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Body() input: DriverVerificationDto,
  ) {
    return this.drivers.verifyDriver(actor, driverId, input);
  }

  @Patch('admin/vehicles/:vehicleId/verification')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Approve or reject a vehicle after document review',
  })
  verifyVehicle(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() input: VehicleVerificationDto,
  ) {
    return this.drivers.verifyVehicle(actor, vehicleId, input);
  }
}
