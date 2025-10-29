import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { User } from '../../users/entities/user.entity';
import { RegisterDto } from '../dtos/request/register.dto';
import { AuthResponseDto } from '../dtos/response/auth-response.dto';
import { RolesService } from '../../roles/services/roles.service';
import { RoleName } from '../../roles/constants/role-name.constant';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { AUTH_MESSAGES } from '../messages/auth.messages';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException(AUTH_MESSAGES.EMAIL_EXISTS);

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const defaultRole = await this.rolesService.findByName(RoleName.User);

    const user = this.userRepo.create({
      ...dto,
      password: hashedPassword,
      role: defaultRole,
    });

    await this.userRepo.save(user);
    this.logger.event(`User registered: ${user.email}`);

    return { message: AUTH_MESSAGES.REGISTRATION_SUCCESS };
  }

  async validateUser(email: string, password: string): Promise<AuthenticatedUser> {
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

    const tokens = await this.generateTokens(user);
    this.logger.event(`Refresh token rotated for: ${user.email}`);
    return this.buildAuthResponse(
      user,
      tokens.accessToken,
      tokens.refreshToken,
      AUTH_MESSAGES.REFRESH_SUCCESS,
    );
  }

  async findActiveUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .where('user.id = :id', { id })
      .andWhere('user.isActive = :isActive', { isActive: true })
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
      tokenVersion,
      lastLogin,
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions?.map((permission) => ({
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
}
