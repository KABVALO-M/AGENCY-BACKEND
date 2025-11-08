import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dtos/request/register.dto';
import { LoginDto } from '../dtos/request/login.dto';
import { RefreshTokenDto } from '../dtos/request/refresh-token.dto';
import { VerifyEmailDto } from '../dtos/request/verify-email.dto';
import { ResendVerificationDto } from '../dtos/request/resend-verification.dto';
import { ChangePasswordDto } from '../dtos/request/change-password.dto';
import { ForgotPasswordDto } from '../dtos/request/forgot-password.dto';
import { ResetPasswordDto } from '../dtos/request/reset-password.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../types/authenticated-user.type';
import { AuthResponseDto } from '../dtos/response/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user account',
    description: 'Creates an account and sends a verification email to the user.',
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(AuthGuard('local'))
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiOperation({
    summary: 'Authenticate with email and password',
    description:
      'Validates credentials and returns access/refresh tokens plus the user profile.',
  })
  async login(
    @Body() _dto: LoginDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthResponseDto> {
    return this.authService.login(user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Exchanges a valid refresh token for a new access token pair.',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the authenticated user details using the access token.',
  })
  async me(@CurrentUser('id') userId: string) {
    return this.authService.getCurrentUser(userId);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password for logged-in user',
    description:
      'Requires current password and a new password; invalidates existing sessions.',
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout current session',
    description: 'Revokes the refresh token for the authenticated user.',
  })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: VerifyEmailDto })
  @ApiOperation({
    summary: 'Verify email address',
    description: 'Accepts a verification token sent via email to activate the account.',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset token',
    description:
      'Sends a password reset email if the address is registered. Response is always generic.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with token',
    description:
      'Consumes a valid password reset token and sets a new password for the account.',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: ResendVerificationDto })
  @ApiOperation({
    summary: 'Resend verification email',
    description: 'Issues a new verification token to the provided email address.',
  })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }
}
