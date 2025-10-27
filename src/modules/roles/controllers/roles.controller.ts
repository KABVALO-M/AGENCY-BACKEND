import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
  ParseEnumPipe,
} from '@nestjs/common';
import { RolesService } from '../services/roles.service';
import { CreateRoleDto } from '../dtos/request/create-role.dto';
import { UpdateRoleDto } from '../dtos/request/update-role.dto';
import { CreatePermissionDto } from '../dtos/request/create-permission.dto';
import { RoleName } from '../constants/role-name.constant';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ====== ROLES ======

  @Post()
  async create(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Get()
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get(':name')
  async findOne(
    @Param('name', new ParseEnumPipe(RoleName)) name: RoleName,
  ) {
    return this.rolesService.findByName(name);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.updateRole(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }

  @Post(':roleId/permissions/:permId')
  async addPermissionToRole(
    @Param('roleId') roleId: string,
    @Param('permId') permId: string,
  ) {
    return this.rolesService.addPermissionToRole(roleId, permId);
  }

  // ====== PERMISSIONS ======

  @Post('permissions')
  async createPermission(@Body() dto: CreatePermissionDto) {
    return this.rolesService.createPermission(dto);
  }

  @Get('permissions/all')
  async findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Delete('permissions/:id')
  async deletePermission(@Param('id') id: string) {
    return this.rolesService.deletePermission(id);
  }
}
