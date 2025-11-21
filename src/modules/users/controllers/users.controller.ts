import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
}
