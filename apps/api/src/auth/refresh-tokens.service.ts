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
 * How long a rotated token still works. On mobile networks a refresh response can get
 * lost, and the app then retries with the token it still has; it can also send two
 * refreshes at once. Without this window, both cases would sign the user out.
 */
export const REUSE_GRACE_MS = 30_000;

/**
 * Refresh tokens are random and opaque, and only their SHA-256 is stored. Using one
 * returns the next token of its family (one family per sign-in). A rotated token
 * still works for REUSE_GRACE_MS; after that, using it again means it leaked, so the
 * whole family is revoked and whoever holds any of its tokens has to sign in again.
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
    const now = new Date();
    if (!stored || stored.revokedAt || stored.expiresAt <= now) {
      throw invalidRefreshToken();
    }

    // Only one request can mark it as rotated, even if two arrive at the same time.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: now },
    });
    if (count === 0 && !(await this.isRetry(stored.id, now))) {
      this.logger.warn(
        { userId: stored.userId, familyId: stored.familyId },
        'Rotated refresh token used again; revoking its family',
      );
      await this.revokeFamily(stored.familyId);
      throw invalidRefreshToken();
    }

    return { userId: stored.userId, ...(await this.issue(stored.userId, stored.familyId)) };
  }

  /** Whether an already rotated token comes back within the grace period, still valid. */
  private async isRetry(id: string, now: Date): Promise<boolean> {
    // Read it again: another request may have rotated or revoked it a moment ago.
    const current = await this.prisma.refreshToken.findUnique({ where: { id } });
    return Boolean(
      current?.rotatedAt &&
      !current.revokedAt &&
      now.getTime() - current.rotatedAt.getTime() <= REUSE_GRACE_MS,
    );
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
