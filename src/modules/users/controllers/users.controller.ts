import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dtos/request/create-user.dto';
import { UpdateUserDto } from '../dtos/request/update-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { RoleName } from '../../roles/constants/role-name.constant';
import { UserResponseDto } from '../dtos/response/user-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Admin: create a user account',
    description:
      'Creates a user with the provided role. Only administrators may call this endpoint.',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    if (currentUser.role.name !== RoleName.Admin) {
      throw new ForbiddenException('Only administrators can add users');
    }

    const user = await this.usersService.createUserAsAdmin(dto, currentUser);
    return UserResponseDto.fromEntity(user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Admin: list all users (excluding requester)',
    description: 'Returns every user profile except the authenticated admin.',
  })
  @ApiOkResponse({ type: [UserResponseDto] })
  async findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto[]> {
    if (currentUser.role.name !== RoleName.Admin) {
      throw new ForbiddenException('Only administrators can view all users');
    }

    const users = await this.usersService.findAllExcept(currentUser.id);
    return users.map((user) => UserResponseDto.fromEntity(user));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Admin: get user by id',
    description: 'Returns the user profile for the specified identifier.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    if (currentUser.role.name !== RoleName.Admin) {
      throw new ForbiddenException('Only administrators can view users');
    }

    const user = await this.usersService.findById(id);
    return UserResponseDto.fromEntity(user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Admin: update a user',
    description: 'Updates user profile and role information.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    if (currentUser.role.name !== RoleName.Admin) {
      throw new ForbiddenException('Only administrators can edit users');
    }

    const user = await this.usersService.updateUser(id, dto, currentUser);
    return UserResponseDto.fromEntity(user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Admin: delete a user',
    description: 'Deletes the specified user account.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User john@example.com deleted successfully' },
      },
    },
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<{ message: string }> {
    if (currentUser.role.name !== RoleName.Admin) {
      throw new ForbiddenException('Only administrators can delete users');
    }

    return this.usersService.deleteUser(id, currentUser);
  }
}
