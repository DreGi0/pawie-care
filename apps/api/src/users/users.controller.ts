import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorResponse } from '../common/errors/error-response.dto.js';
import { UserProfile } from './user-profile.dto.js';
import { toUserProfile, UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse, description: 'Falta el token o ya venció.' })
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mi cuenta', description: 'Los datos de la cuenta que inició sesión.' })
  @ApiOkResponse({ type: UserProfile })
  async me(@CurrentUser() current: AuthenticatedUser): Promise<UserProfile> {
    const user = await this.users.findById(current.id);
    if (!user) {
      // The token is still valid, but the account was deleted.
      throw new UnauthorizedException();
    }
    return toUserProfile(user);
  }
}
