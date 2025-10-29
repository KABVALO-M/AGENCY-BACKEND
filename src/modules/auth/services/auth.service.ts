import {
  Injectable,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../../users/entities/user.entity';
import { RegisterDto } from '../dtos/request/register.dto';
import { RolesService } from '../../roles/services/roles.service';
import { RoleName } from '../../roles/constants/role-name.constant';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { AUTH_MESSAGES } from '../messages/auth.messages';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly rolesService: RolesService,
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
}
