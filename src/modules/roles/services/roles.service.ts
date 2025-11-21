import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { CreatePermissionDto } from '../dtos/request/create-permission.dto';
import { CreateRoleDto } from '../dtos/request/create-role.dto';
import { UpdateRoleDto } from '../dtos/request/update-role.dto';
import { DEFAULT_ROLES, RoleName } from '../constants/role-name.constant';
import { AppLoggerService } from '../../../common/logger/app-logger.service';

const ALLOWED_ROLE_NAMES = DEFAULT_ROLES.map((role) => role.name);

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permRepo: Repository<Permission>,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(RolesService.name);
  }

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultRoles();
  }

  private async ensureDefaultRoles(): Promise<void> {
    for (const defRole of DEFAULT_ROLES) {
      const exists = await this.roleRepo.findOne({
        where: { name: defRole.name },
      });
      if (!exists) {
        const role = this.roleRepo.create(defRole);
        await this.roleRepo.save(role);
        this.logger.event(`Seeded default role "${defRole.name}"`);
      }
    }
  }

  // ========== ROLE METHODS ==========

  async createRole(dto: CreateRoleDto): Promise<Role> {
    if (!ALLOWED_ROLE_NAMES.includes(dto.name)) {
      throw new BadRequestException(`Role "${dto.name}" is not supported`);
    }

    const exists = await this.roleRepo.findOne({ where: { name: dto.name } });
    if (exists)
      throw new ConflictException(`Role "${dto.name}" already exists`);

    const role = this.roleRepo.create(dto);
    const created = await this.roleRepo.save(role);
    this.logger.event(`Created role "${created.name}"`, RolesService.name);
    return created;
  }

  async findAll(): Promise<Role[]> {
    const roles = await this.roleRepo.find();
    this.logger.debug(`Fetched ${roles.length} roles`);
    return roles;
  }

  async findById(id: string): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    this.logger.debug(`Fetched role by id "${id}"`);
    return role;
  }

  async findByName(name: RoleName): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { name } });
    if (!role) throw new NotFoundException(`Role "${name}" not found`);
    this.logger.debug(`Fetched role "${name}"`);
    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    Object.assign(role, dto);
    const updated = await this.roleRepo.save(role);
    this.logger.event(`Updated role "${updated.name}"`);
    return updated;
  }

  async deleteRole(id: string): Promise<{ message: string }> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (ALLOWED_ROLE_NAMES.includes(role.name)) {
      throw new ConflictException(
        `Default role "${role.name}" cannot be deleted`,
      );
    }

    await this.roleRepo.remove(role);
    this.logger.warn(`Deleted role "${role.name}"`);
    return { message: `Role "${role.name}" deleted successfully` };
  }

  async addPermissionToRole(
    roleId: string,
    permissionId: string,
  ): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });
    const perm = await this.permRepo.findOne({ where: { id: permissionId } });

    if (!role || !perm)
      throw new NotFoundException('Role or permission not found');

    const alreadyExists = role.permissions.some((p) => p.id === permissionId);
    if (alreadyExists)
      throw new ConflictException('Permission already assigned to this role');

    role.permissions.push(perm);
    const updated = await this.roleRepo.save(role);
    this.logger.event(
      `Assigned permission "${perm.name}" to role "${updated.name}"`,
    );
    return updated;
  }

  // ========== PERMISSION METHODS ==========

  async createPermission(dto: CreatePermissionDto): Promise<Permission> {
    const exists = await this.permRepo.findOne({ where: { name: dto.name } });
    if (exists)
      throw new ConflictException(`Permission "${dto.name}" already exists`);

    const perm = this.permRepo.create(dto);
    const created = await this.permRepo.save(perm);
    this.logger.event(`Created permission "${created.name}"`);
    return created;
  }

  async findAllPermissions(): Promise<Permission[]> {
    const permissions = await this.permRepo.find();
    this.logger.debug(`Fetched ${permissions.length} permissions`);
    return permissions;
  }

  async deletePermission(id: string): Promise<{ message: string }> {
    const perm = await this.permRepo.findOne({ where: { id } });
    if (!perm) throw new NotFoundException('Permission not found');

    await this.permRepo.remove(perm);
    this.logger.warn(`Deleted permission "${perm.name}"`);
    return { message: `Permission "${perm.name}" deleted successfully` };
  }
}
