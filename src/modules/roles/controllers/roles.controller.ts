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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from '../services/roles.service';
import { CreateRoleDto } from '../dtos/request/create-role.dto';
import { UpdateRoleDto } from '../dtos/request/update-role.dto';
import { CreatePermissionDto } from '../dtos/request/create-permission.dto';
import { RoleName } from '../constants/role-name.constant';

@ApiTags('Roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ====== ROLES ======

  @Post()
  @ApiOperation({
    summary: 'Create a role',
    description: 'Creates a new role with the provided name and description.',
  })
  async create(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List roles',
    description: 'Retrieves every role defined in the system.',
  })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get(':name')
  @ApiOperation({
    summary: 'Get role by name',
    description: 'Looks up a single role using the predefined role enum.',
  })
  async findOne(@Param('name', new ParseEnumPipe(RoleName)) name: RoleName) {
    return this.rolesService.findByName(name);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update role details',
    description: 'Updates the label or permissions metadata for a role.',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.updateRole(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete role',
    description: 'Removes a role and detaches it from any users.',
  })
  async delete(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }

  @Post(':roleId/permissions/:permId')
  @ApiOperation({
    summary: 'Attach permission to role',
    description: 'Adds the specified permission to the target role.',
  })
  async addPermissionToRole(
    @Param('roleId') roleId: string,
    @Param('permId') permId: string,
  ) {
    return this.rolesService.addPermissionToRole(roleId, permId);
  }

  // ====== PERMISSIONS ======

  @Post('permissions')
  @ApiOperation({
    summary: 'Create a permission',
    description: 'Registers a new permission that can be assigned to roles.',
  })
  async createPermission(@Body() dto: CreatePermissionDto) {
    return this.rolesService.createPermission(dto);
  }

  @Get('permissions/all')
  @ApiOperation({
    summary: 'List all permissions',
    description: 'Returns every permission available in the system.',
  })
  async findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Delete('permissions/:id')
  @ApiOperation({
    summary: 'Delete permission',
    description: 'Removes a permission; ensure roles no longer rely on it.',
  })
  async deletePermission(@Param('id') id: string) {
    return this.rolesService.deletePermission(id);
  }
}
