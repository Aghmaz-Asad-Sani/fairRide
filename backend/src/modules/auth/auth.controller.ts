import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser, AuthTokens, SafeUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a passenger or driver account' })
  register(
    @Body() input: RegisterDto,
    @Req() request: Request,
  ): Promise<AuthTokens> {
    return this.auth.register(input, request.ip ?? 'unknown');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with a Pakistan mobile number or email' })
  login(@Body() input: LoginDto, @Req() request: Request): Promise<AuthTokens> {
    return this.auth.login(input, request.ip ?? 'unknown');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token and issue new tokens' })
  refresh(
    @Body() input: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<AuthTokens> {
    return this.auth.refresh(input, request.ip ?? 'unknown');
  }

  @Post('phone/otp/request')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request phone verification code (development adapter only)',
  })
  requestPhoneOtp(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.requestPhoneOtp(user.id);
  }

  @Post('phone/otp/verify')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify account phone number using a one-time code',
  })
  verifyPhoneOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: VerifyPhoneOtpDto,
  ) {
    return this.auth.verifyPhoneOtp(user.id, input);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current authenticated account profile' })
  @ApiOperation({ summary: 'Get the current account profile' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<SafeUser> {
    return this.auth.currentUser(user.id);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Current session revoked' })
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logout(user);
  }

  @Post('logout-all')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'All account sessions revoked' })
  @ApiOperation({ summary: 'Revoke all sessions for the current account' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logoutAll(user);
  }
}
