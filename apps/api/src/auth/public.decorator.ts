import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Lets a route or controller skip the global JwtAuthGuard: every other route needs a token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
