import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';

import { User } from '../../users/entities/user.entity';
import { RegisterDto } from '../dtos/request/register.dto';
import { AuthResponseDto } from '../dtos/response/auth-response.dto';
import { RolesService } from '../../roles/services/roles.service';
import { RoleName } from '../../roles/constants/role-name.constant';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { AUTH_MESSAGES } from '../messages/auth.messages';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { JwtPayload } from '../types/jwt-payload.interface';
import { EmailVerificationToken } from '../entities/email-verification-token.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { EmailService } from '../../../common/services/email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly emailVerificationRepo: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetRepo: Repository<PasswordResetToken>,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException(AUTH_MESSAGES.EMAIL_EXISTS);

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const defaultRole = await this.rolesService.findByName(RoleName.User);

    const user = this.userRepo.create({
      ...dto,
      password: hashedPassword,
      role: defaultRole,
      isActive: false,
      emailVerified: false,
    });

    await this.userRepo.save(user);

    // Send email asynchronously - don't block registration
    this.sendVerificationEmailAsync(user).catch((error) => {
      this.logger.error(
        `Failed to send verification email for ${user.email}`,
        error.stack,
      );
    });

    this.logger.event(`User registered: ${user.email}`);

    return { message: AUTH_MESSAGES.VERIFICATION_EMAIL_SENT };
  }

  private async queueVerificationEmail(user: User): Promise<void> {
    const verification = await this.createEmailVerificationToken(user);
    await this.emailService.sendEmailVerification(user.email, {
      firstName: user.firstName,
      verificationToken: verification.token,
      expiresAt: verification.expiresAt.toISOString(),
    });
    this.logger.event(`Queued verification email for: ${user.email}`);
  }

  private async sendVerificationEmailAsync(user: User): Promise<void> {
    try {
      await this.queueVerificationEmail(user);
    } catch (error) {
      // Log but don't throw - registration should still succeed
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to queue verification email: ${reason}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async queuePasswordResetEmail(user: User): Promise<void> {
    const reset = await this.createPasswordResetToken(user);
    await this.emailService.sendPasswordResetEmail(user.email, {
      firstName: user.firstName,
      resetToken: reset.token,
      expiresAt: reset.expiresAt.toISOString(),
    });
    this.logger.event(`Queued password reset email for: ${user.email}`);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .addSelect('user.password')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();

    if (!user) {
      this.logger.warn(`Login attempt failed for "${email}": user not found`);
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    if (!user.emailVerified) {
      this.logger.warn(
        `Login attempt failed for "${email}": email not verified`,
      );
      throw new UnauthorizedException(AUTH_MESSAGES.EMAIL_NOT_VERIFIED);
    }

    if (!user.isActive) {
      this.logger.warn(`Login attempt failed for "${email}": account inactive`);
      throw new UnauthorizedException(AUTH_MESSAGES.ACCOUNT_INACTIVE);
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      this.logger.warn(`Login attempt failed for "${email}": invalid password`);
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    return this.mapToAuthenticatedUser(user);
  }

  async login(user: AuthenticatedUser): Promise<AuthResponseDto> {
    const [{ accessToken, refreshToken }, lastLogin] = await Promise.all([
      this.generateTokens(user),
      this.touchLastLogin(user.id),
    ]);

    this.logger.event(`User logged in: ${user.email}`);

    return this.buildAuthResponse(
      { ...user, lastLogin },
      accessToken,
      refreshToken,
      AUTH_MESSAGES.LOGIN_SUCCESS,
    );
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.findActiveUserById(userId);
    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_TOKEN);
    }
    return user;
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Unknown verification error';
      this.logger.warn(`Refresh token verification failed: ${reason}`);
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const user = await this.findActiveUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_TOKEN);
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const nextTokenVersion = user.tokenVersion + 1;
    await this.userRepo.increment({ id: user.id }, 'tokenVersion', 1);
    const updatedUser: AuthenticatedUser = {
      ...user,
      tokenVersion: nextTokenVersion,
    };

    const tokens = await this.generateTokens(updatedUser);
    this.logger.event(`Refresh token rotated for: ${user.email}`);
    return this.buildAuthResponse(
      updatedUser,
      tokens.accessToken,
      tokens.refreshToken,
      AUTH_MESSAGES.REFRESH_SUCCESS,
    );
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const verification = await this.emailVerificationRepo.findOne({
      where: { token },
      relations: ['user', 'user.role', 'user.role.permissions'],
    });

    if (!verification || verification.used) {
      throw new BadRequestException(AUTH_MESSAGES.VERIFICATION_INVALID);
    }

    if (verification.expiresAt.getTime() < Date.now()) {
      verification.used = true;
      await this.emailVerificationRepo.save(verification);
      throw new BadRequestException(AUTH_MESSAGES.VERIFICATION_EXPIRED);
    }

    const user = verification.user;

    if (user.emailVerified) {
      verification.used = true;
      await this.emailVerificationRepo.save(verification);
      throw new BadRequestException(AUTH_MESSAGES.ACCOUNT_ALREADY_VERIFIED);
    }

    const verifiedAt = new Date();

    user.isActive = true;
    user.emailVerified = true;
    user.emailVerifiedAt = verifiedAt;
    verification.used = true;

    await Promise.all([
      this.userRepo.save(user),
      this.emailVerificationRepo.save(verification),
    ]);

    this.logger.event(`User verified email: ${user.email}`);

    await this.emailService.sendWelcomeEmail(user.email, {
      firstName: user.firstName,
      verifiedAt: verifiedAt.toISOString(),
    });

    return { message: AUTH_MESSAGES.VERIFICATION_SUCCESS };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: normalizedEmail })
      .getOne();

    if (!user) {
      throw new BadRequestException(AUTH_MESSAGES.ACCOUNT_NOT_FOUND);
    }

    if (user.emailVerified) {
      throw new BadRequestException(AUTH_MESSAGES.ACCOUNT_ALREADY_VERIFIED);
    }

    await this.queueVerificationEmail(user);
    this.logger.event(`Resent verification email for: ${user.email}`);

    return { message: AUTH_MESSAGES.VERIFICATION_EMAIL_RESENT };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_TOKEN);
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException(AUTH_MESSAGES.PASSWORD_CURRENT_INVALID);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    user.tokenVersion += 1;

    await this.userRepo.save(user);
    this.logger.event(`User changed password: ${user.email}`);

    return { message: AUTH_MESSAGES.PASSWORD_CHANGE_SUCCESS };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: normalizedEmail })
      .getOne();

    if (!user || !user.emailVerified || !user.isActive) {
      return { message: AUTH_MESSAGES.PASSWORD_RESET_EMAIL_SENT };
    }

    try {
      await this.queuePasswordResetEmail(user);
      this.logger.event(`Password reset requested for: ${user.email}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to queue password reset email: ${reason}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return { message: AUTH_MESSAGES.PASSWORD_RESET_EMAIL_SENT };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const resetToken = await this.passwordResetRepo.findOne({
      where: { token: tokenHash },
      relations: ['user'],
    });

    if (!resetToken || resetToken.used) {
      throw new BadRequestException(AUTH_MESSAGES.PASSWORD_RESET_INVALID);
    }

    if (resetToken.expiresAt.getTime() < Date.now()) {
      resetToken.used = true;
      await this.passwordResetRepo.save(resetToken);
      throw new BadRequestException(AUTH_MESSAGES.PASSWORD_RESET_EXPIRED);
    }

    const user = resetToken.user;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    user.tokenVersion += 1;
    resetToken.used = true;

    await Promise.all([
      this.userRepo.save(user),
      this.passwordResetRepo.save(resetToken),
    ]);

    this.logger.event(`User reset password: ${user.email}`);

    return { message: AUTH_MESSAGES.PASSWORD_RESET_SUCCESS };
  }

  async logout(user: AuthenticatedUser): Promise<{ message: string }> {
    await this.userRepo.increment({ id: user.id }, 'tokenVersion', 1);
    this.logger.event(`User logged out: ${user.email}`);
    return { message: AUTH_MESSAGES.LOGOUT_SUCCESS };
  }

  async findActiveUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('user.id = :id', { id })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .andWhere('user.emailVerified = :emailVerified', {
        emailVerified: true,
      })
      .getOne();

    if (!user) return null;

    return this.mapToAuthenticatedUser(user);
  }

  private mapToAuthenticatedUser(user: User): AuthenticatedUser {
    const {
      password: _password,
      role,
      id,
      email,
      firstName,
      lastName,
      phone,
      isActive,
      emailVerified,
      emailVerifiedAt,
      tokenVersion,
      lastLogin,
    } = user;

    return {
      id,
      email,
      firstName,
      lastName,
      phone,
      isActive,
      emailVerified,
      emailVerifiedAt,
      tokenVersion,
      lastLogin,
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions:
          role.permissions?.map((permission) => ({
            id: permission.id,
            name: permission.name,
            description: permission.description,
          })) ?? [],
      },
    };
  }

  private async touchLastLogin(id: string): Promise<Date> {
    const lastLogin = new Date();
    await this.userRepo.update({ id }, { lastLogin });
    return lastLogin;
  }

  private async generateTokens(user: AuthenticatedUser): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
      tokenVersion: user.tokenVersion,
    };

    const accessTokenPromise = this.jwtService.signAsync(payload, {
      expiresIn: this.getAccessTokenExpiry(),
    });

    const refreshTokenPromise = this.jwtService.signAsync(payload, {
      secret: this.getRefreshTokenSecret(),
      expiresIn: this.getRefreshTokenExpiry(),
    });

    const [accessToken, refreshToken] = await Promise.all([
      accessTokenPromise,
      refreshTokenPromise,
    ]);

    return { accessToken, refreshToken };
  }

  private buildAuthResponse(
    user: AuthenticatedUser,
    accessToken: string,
    refreshToken: string,
    message: string,
  ): AuthResponseDto {
    return {
      message,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        lastLogin: user.lastLogin,
        role: {
          id: user.role.id,
          name: user.role.name,
          description: user.role.description,
          permissions: user.role.permissions,
        },
      },
    };
  }

  private async createEmailVerificationToken(
    user: User,
  ): Promise<EmailVerificationToken> {
    await this.emailVerificationRepo.update(
      { user: { id: user.id }, used: false },
      { used: true },
    );

    const expiresAt = new Date(
      Date.now() + this.getEmailVerificationExpiry() * 1000,
    );

    const token = this.emailVerificationRepo.create({
      user,
      token: randomBytes(32).toString('hex'),
      expiresAt,
      used: false,
    });

    return this.emailVerificationRepo.save(token);
  }

  private async createPasswordResetToken(
    user: User,
  ): Promise<{ token: string; expiresAt: Date }> {
    await this.passwordResetRepo.update(
      { user: { id: user.id }, used: false },
      { used: true },
    );

    const expiresAt = new Date(
      Date.now() + this.getPasswordResetExpiry() * 1000,
    );
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const passwordResetToken = this.passwordResetRepo.create({
      user,
      token: tokenHash,
      expiresAt,
      used: false,
    });

    await this.passwordResetRepo.save(passwordResetToken);

    return { token: rawToken, expiresAt };
  }

  private getAccessTokenExpiry(): number {
    const raw = this.configService.get<string>('JWT_EXPIRES_IN');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 3600;
  }

  private getRefreshTokenExpiry(): number {
    const raw = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 7 * 24 * 60 * 60;
  }

  private getRefreshTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.get<string>('JWT_SECRET', 'change-me')
    );
  }

  private getEmailVerificationExpiry(): number {
    const raw = this.configService.get<string>('EMAIL_VERIFICATION_EXPIRES_IN');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 24 * 60 * 60;
  }

  private getPasswordResetExpiry(): number {
    const raw = this.configService.get<string>('PASSWORD_RESET_EXPIRES_IN');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 60 * 60;
  }
}
