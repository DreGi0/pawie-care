import type { Role } from '../generated/prisma/enums.js';

/** Claims of an access token. */
export interface AccessTokenPayload {
  /** The user's ID. */
  sub: string;
  roles: Role[];
}

/** What a request knows about whoever sent it, read from the access token. */
export interface AuthenticatedUser {
  id: string;
  roles: Role[];
}
