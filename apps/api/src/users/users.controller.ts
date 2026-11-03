import { Body, Controller, Get, Patch, UnauthorizedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorResponse } from '../common/errors/error-response.dto.js';
import { MeResponse, UpdateMeRequest } from './user-profile.dto.js';
import type { User } from '../generated/prisma/client.js';
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
    return this.response(user);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Cambiar mi cuenta',
    description: 'RN-CTA-06: el modo en que abre la app, que la cuenta recuerda.',
  })
  @ApiOkResponse({ type: MeResponse })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: '`CAREGIVER_PROFILE_NOT_FOUND`: el modo cuidador no está activado.',
  })
  async update(
    @CurrentUser() current: AuthenticatedUser,
    @Body() body: UpdateMeRequest,
  ): Promise<MeResponse> {
    const user =
      body.mode === undefined
        ? await this.users.findById(current.id)
        : await this.users.setMode(current.id, body.mode);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.response(user);
  }

  private async response(user: User): Promise<MeResponse> {
    return Object.assign(toUserProfile(user), {
      firstServiceFeeWaiverEndsAt: await this.users.firstServiceFeeWaiverEndsAt(user.id),
    });
  }
}
