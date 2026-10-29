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
import { MeResponse } from './user-profile.dto.js';
import { toUserProfile, UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponse, description: 'Falta el token o ya venció.' })
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mi cuenta', description: 'Los datos de la cuenta que inició sesión.' })
  @ApiOkResponse({ type: MeResponse })
  async me(@CurrentUser() current: AuthenticatedUser): Promise<MeResponse> {
    const user = await this.users.findById(current.id);
    if (!user) {
      // The token is still valid, but the account was deleted.
      throw new UnauthorizedException();
    }
    return Object.assign(toUserProfile(user), {
      firstServiceFeeWaiverEndsAt: await this.users.firstServiceFeeWaiverEndsAt(user.id),
    });
  }
}
