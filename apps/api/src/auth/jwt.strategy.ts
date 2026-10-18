import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Environment } from '../config/environment.js';
import type { AccessTokenPayload, AuthenticatedUser } from './authenticated-user.js';

/**
 * Reads the access token from `Authorization: Bearer`, which is how the mobile app
 * sends it (docs/arquitectura.md §4.4). Cookies for the web arrive with the web.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Environment, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return { id: payload.sub, roles: payload.roles };
  }
}
