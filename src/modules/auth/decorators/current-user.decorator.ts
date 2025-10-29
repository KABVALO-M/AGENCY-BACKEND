import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import type { AuthenticatedUser } from '../types/authenticated-user.type';
import { AUTH_MESSAGES } from '../messages/auth.messages';

export const CurrentUser = createParamDecorator<
  keyof AuthenticatedUser | undefined,
  AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser]
>((data, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request>();
  const user = request.user as AuthenticatedUser | undefined;

  if (!user) {
    throw new UnauthorizedException(AUTH_MESSAGES.INVALID_TOKEN);
  }

  if (data) {
    return user[data];
  }

  return user;
});
