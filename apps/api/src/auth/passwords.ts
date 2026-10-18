import {
  argon2,
  type Argon2Parameters,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

// Passwords are hashed with argon2id from node:crypto (Node 24.7+), so the API needs no
// native dependency. The hash is stored as a PHC string, which carries its own
// parameters, so they can be raised later and old hashes still verify:
//   $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>   (salt and hash in unpadded base64)

/** OWASP's minimum for argon2id: 19 MiB of memory, 2 passes and 1 lane. */
const COST = { memory: 19_456, passes: 2, parallelism: 1 };
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const PHC_PATTERN =
  /^\$argon2id\$v=19\$m=(\d{1,7}),t=(\d{1,3}),p=(\d{1,2})\$([A-Za-z0-9+/]{16,})\$([A-Za-z0-9+/]{16,})$/;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, COST, HASH_BYTES);
  return `$argon2id$v=19$m=${COST.memory},t=${COST.passes},p=${COST.parallelism}$${base64(salt)}$${base64(hash)}`;
}

/** False for a wrong password and also for a hash this module can't read. */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const match = PHC_PATTERN.exec(encoded);
  if (!match) {
    return false;
  }
  const [, memory, passes, parallelism, salt, hash] = match;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(
    password,
    Buffer.from(salt, 'base64'),
    { memory: Number(memory), passes: Number(passes), parallelism: Number(parallelism) },
    expected.length,
  );
  return timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | undefined;

/**
 * Takes as long as checking a real password. Login calls it when the email doesn't
 * exist or has no password, so response times don't reveal which accounts exist.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword(randomUUID());
  await verifyPassword(password, await dummyHash);
  return false;
}

function derive(
  password: string,
  nonce: Buffer,
  cost: Pick<Argon2Parameters, 'memory' | 'passes' | 'parallelism'>,
  tagLength: number,
): Promise<Buffer> {
  // NFKC, so the same password typed on different keyboards gives the same hash.
  const message = password.normalize('NFKC');
  return new Promise((resolve, reject) => {
    argon2('argon2id', { message, nonce, tagLength, ...cost }, (error, derivedKey) =>
      error ? reject(error) : resolve(derivedKey),
    );
  });
}

function base64(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=+$/, '');
}
