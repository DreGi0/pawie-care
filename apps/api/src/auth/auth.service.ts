import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ageOn, dateInElSalvador } from '../common/time/calendar.js';
import type { Environment } from '../config/environment.js';
import { Prisma, type User } from '../generated/prisma/client.js';
import { toUserProfile, UsersService } from '../users/users.service.js';
import type { AuthSession, LoginRequest, RegisterRequest } from './auth.dto.js';
import type { AccessTokenPayload } from './authenticated-user.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './passwords.js';
import { type IssuedRefreshToken, RefreshTokensService } from './refresh-tokens.service.js';

/** RN-CTA-02: only adults can sign up. */
const MINIMUM_AGE = 18;

@Injectable()
export class AuthService {
  private readonly accessTokenTtlSeconds: number;

  constructor(
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly jwt: JwtService,
    config: ConfigService<Environment, true>,
  ) {
    this.accessTokenTtlSeconds = config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
  }

  /** Creates an owner account and signs it in. */
  async register({ password, birthDate, ...account }: RegisterRequest): Promise<AuthSession> {
    const birth = new Date(birthDate);
    if (ageOn(birth, dateInElSalvador(new Date())) < MINIMUM_AGE) {
      throw new UnprocessableEntityException({
        errorCode: 'UNDERAGE',
        message: `Para registrarte tienes que tener al menos ${MINIMUM_AGE} años.`,
      });
    }

    let user: User;
    try {
      user = await this.users.createOwner({
        ...account,
        birthDate: birth,
        passwordHash: await hashPassword(password),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          errorCode: 'EMAIL_TAKEN',
          message: 'Ya hay una cuenta con ese correo. Inicia sesión.',
        });
      }
      throw error;
    }
    return this.session(user, await this.refreshTokens.issue(user.id));
  }

  async login({ email, password }: LoginRequest): Promise<AuthSession> {
    const user = await this.users.findByEmail(email);
    // Accounts without a password, like the seeded caregivers, can't sign in. Checking
    // a dummy hash keeps the response time from telling which emails exist.
    const valid = user?.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : await verifyAgainstDummy(password);
    if (!user || !valid) {
      throw new UnauthorizedException({
        errorCode: 'INVALID_CREDENTIALS',
        message: 'El correo o la contraseña no son correctos.',
      });
    }
    return this.session(user, await this.refreshTokens.issue(user.id));
  }

  /** Exchanges a refresh token for a new pair of tokens. */
  async refresh(refreshToken: string): Promise<AuthSession> {
    const next = await this.refreshTokens.rotate(refreshToken);
    const user = await this.users.findById(next.userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.session(user, next);
  }

  logout(refreshToken: string): Promise<void> {
    return this.refreshTokens.revoke(refreshToken);
  }

  private async session(user: User, refresh: IssuedRefreshToken): Promise<AuthSession> {
    const payload: AccessTokenPayload = { sub: user.id, roles: user.roles };
    return {
      tokenType: 'Bearer',
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: this.accessTokenTtlSeconds,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
      user: toUserProfile(user),
    };
  }
}
