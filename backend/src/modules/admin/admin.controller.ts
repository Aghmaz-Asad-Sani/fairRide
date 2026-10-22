import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  DriverVerificationDto,
  VehicleVerificationDto,
} from '../drivers/dto/verification.dto';
import { UserRole } from '../users/user.entity';
import { AdminListDto } from './dto/admin-list.dto';
import { AdminStatusDto } from './dto/admin-status.dto';
import { PricingSettingsDto } from './dto/pricing-settings.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Read admin overview metrics' })
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  @ApiOperation({ summary: 'Search and paginate user accounts' })
  users(@Query() query: AdminListDto) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:userId/status')
  @ApiOperation({ summary: 'Activate or suspend a non-admin account' })
  setUserStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() input: AdminStatusDto,
  ) {
    return this.admin.setUserStatus(actor, userId, input.status);
  }

  @Get('drivers')
  @ApiOperation({ summary: 'Review driver and vehicle verification details' })
  drivers(@Query() query: AdminListDto) {
    return this.admin.listDrivers(query);
  }

  @Patch('drivers/:driverId/verification')
  @ApiOperation({ summary: 'Approve or reject driver verification' })
  verifyDriver(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Body() input: DriverVerificationDto,
  ) {
    return this.admin.verifyDriver(actor, driverId, input);
  }

  @Patch('vehicles/:vehicleId/verification')
  @ApiOperation({ summary: 'Approve or reject vehicle verification' })
  verifyVehicle(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() input: VehicleVerificationDto,
  ) {
    return this.admin.verifyVehicle(actor, vehicleId, input);
  }

  @Get('rides')
  @ApiOperation({ summary: 'Search and paginate ride records' })
  rides(@Query() query: AdminListDto) {
    return this.admin.listRides(query);
  }

  @Patch('rides/:rideId/cancel')
  @ApiOperation({ summary: 'Cancel an active ride and expire its offers' })
  cancelRide(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('rideId', ParseUUIDPipe) rideId: string,
  ) {
    return this.admin.cancelRide(actor, rideId);
  }

  @Get('pricing')
  @ApiOperation({ summary: 'Read the current fare configuration' })
  pricing() {
    return this.admin.getPricingSettings();
  }

  @Patch('pricing')
  @ApiOperation({ summary: 'Update fare settings for new ride estimates' })
  updatePricing(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: PricingSettingsDto,
  ) {
    return this.admin.updatePricingSettings(actor, input);
  }
}
