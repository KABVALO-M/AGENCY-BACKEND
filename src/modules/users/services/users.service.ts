import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dtos/request/create-user.dto';
import { UpdateUserDto } from '../dtos/request/update-user.dto';
import { RolesService } from '../../roles/services/roles.service';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { EmailService } from '../../../common/services/email.service';

const DEFAULT_TEMP_PASSWORD = 'ChangeMe123!';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly rolesService: RolesService,
    private readonly logger: AppLoggerService,
    private readonly emailService: EmailService,
  ) {
    this.logger.setContext(UsersService.name);
  }

  async createUserAsAdmin(
    dto: CreateUserDto,
    createdBy: AuthenticatedUser,
  ): Promise<User> {
    const normalizedEmail = dto.email.trim();

    const existing = await this.userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
      .getOne();

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const role = await this.rolesService.findById(dto.roleId);
    const plainPassword = dto.password?.trim() || DEFAULT_TEMP_PASSWORD;
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const isActive = dto.isActive ?? true;
    const emailVerified = dto.emailVerified ?? false;
    const emailVerifiedAt = emailVerified ? new Date() : null;
    const trimmedPhone = dto.phone?.trim();
    const sanitizedPhone =
      trimmedPhone && trimmedPhone.length > 0 ? trimmedPhone : undefined;

    const user = this.userRepo.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: normalizedEmail,
      phone: sanitizedPhone,
      password: hashedPassword,
      role,
      isActive,
      emailVerified,
      emailVerifiedAt: emailVerifiedAt ?? undefined,
    });

    const saved = await this.userRepo.save(user);

    this.logger.event(
      `User ${saved.email} created by admin ${createdBy.email}`,
      UsersService.name,
    );

    await this.emailService.sendAdminInvitationEmail(saved.email, {
      firstName: saved.firstName,
      email: saved.email,
      password: plainPassword,
      invitedBy: createdBy.email,
    });

    return saved;
  }

  async findAllExcept(userId: string): Promise<User[]> {
    return this.userRepo.find({
      where: { id: Not(userId) },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    updatedBy: AuthenticatedUser,
  ): Promise<User> {
    const user = await this.findById(id);
    const normalizedEmail = dto.email.trim();

    const emailInUse = await this.userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
      .andWhere('user.id != :id', { id })
      .getCount();

    if (emailInUse > 0) {
      throw new ConflictException('A user with this email already exists');
    }

    const role = await this.rolesService.findById(dto.roleId);
    const trimmedPhone = dto.phone?.trim();
    const sanitizedPhone =
      trimmedPhone && trimmedPhone.length > 0 ? trimmedPhone : undefined;

    let emailVerifiedAt = user.emailVerifiedAt ?? null;
    if (dto.emailVerified && !user.emailVerified) {
      emailVerifiedAt = new Date();
    } else if (!dto.emailVerified) {
      emailVerifiedAt = null;
    }

    user.firstName = dto.firstName.trim();
    user.lastName = dto.lastName.trim();
    user.email = normalizedEmail;
    user.phone = sanitizedPhone;
    user.role = role;
    user.isActive = dto.isActive;
    user.emailVerified = dto.emailVerified;
    user.emailVerifiedAt = emailVerifiedAt ?? undefined;

    const saved = await this.userRepo.save(user);
    this.logger.event(
      `User ${saved.email} updated by admin ${updatedBy.email}`,
      UsersService.name,
    );
    return saved;
  }

  async deleteUser(
    id: string,
    deletedBy: AuthenticatedUser,
  ): Promise<{ message: string }> {
    if (id === deletedBy.id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.findById(id);
    await this.userRepo.remove(user);
    this.logger.warn(`User ${user.email} deleted by ${deletedBy.email}`);
    return { message: `User ${user.email} deleted successfully` };
  }
}
