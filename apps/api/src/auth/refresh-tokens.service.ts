import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Refresh tokens are random and opaque, and only their SHA-256 is stored. Each one
 * works once: using it returns the next token of its family (one family per sign-in).
 * Using a rotated token again means it leaked, so the whole family is revoked and
 * whoever holds any of its tokens has to sign in again.
 */
@Injectable()
export class RefreshTokensService {
  private readonly logger = new Logger(RefreshTokensService.name);
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Environment, true>,
  ) {
    this.ttlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * DAY_MS;
  }

  /** The first token of a new sign-in, or the next one of a family. */
  async issue(userId: string, familyId: string = randomUUID()): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.refreshToken.create({
      data: { userId, familyId, tokenHash: hashToken(token), expiresAt },
    });
    return { token, expiresAt };
  }

  /** Exchanges a token for the next one of its family. Returns whose token it was. */
  async rotate(token: string): Promise<IssuedRefreshToken & { userId: string }> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw invalidRefreshToken();
    }

    // Only one request can mark it as rotated, even if two arrive at the same time.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: new Date() },
    });
    if (count === 0) {
      this.logger.warn(
        { userId: stored.userId, familyId: stored.familyId },
        'Refresh token used twice; revoking its family',
      );
      await this.revokeFamily(stored.familyId);
      throw invalidRefreshToken();
    }

    return { userId: stored.userId, ...(await this.issue(stored.userId, stored.familyId)) };
  }

  /** Signs out the session the token belongs to. Unknown tokens are ignored. */
  async revoke(token: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function invalidRefreshToken(): UnauthorizedException {
  return new UnauthorizedException({
    errorCode: 'INVALID_REFRESH_TOKEN',
    message: 'Tu sesión terminó. Inicia sesión de nuevo.',
  });
}
