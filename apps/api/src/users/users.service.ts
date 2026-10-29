import { Injectable } from '@nestjs/common';
import { Clock } from '../common/time/clock.js';
import { Role, type User } from '../generated/prisma/client.js';
import { firstServiceFeeWaiverEndsAt } from '../pricing/first-service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { UserProfile } from './user-profile.dto.js';

/** Emails are stored trimmed and lowercased, and a CHECK constraint enforces it. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    birthDate: user.birthDate.toISOString().slice(0, 10),
    phone: user.phone,
    roles: user.roles,
  };
}

export interface NewOwner {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  phone?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  /** Signing up makes an owner account (RN-CTA-01). Fails with P2002 if the email is taken. */
  createOwner({ email, ...owner }: NewOwner): Promise<User> {
    return this.prisma.user.create({
      data: { ...owner, email: normalizeEmail(email), roles: [Role.OWNER] },
    });
  }

  /** RN-PRE-09: the end of the owner's first-service window, as an ISO instant, or null. */
  async firstServiceFeeWaiverEndsAt(ownerId: string): Promise<string | null> {
    const windowDays = await this.settings.get('pricing.firstServiceWindowDays');
    const endsAt = await firstServiceFeeWaiverEndsAt(
      this.prisma,
      ownerId,
      windowDays,
      this.clock.now(),
    );
    return endsAt?.toISOString() ?? null;
  }
}
