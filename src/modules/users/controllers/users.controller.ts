import {
  Body,
  Controller,
  ForbiddenException,
  Get,
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
}
