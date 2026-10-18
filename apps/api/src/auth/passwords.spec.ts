import { argon2Sync } from 'node:crypto';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './passwords.js';

describe('passwords', () => {
  it("relies on an argon2id that matches RFC 9106's test vector", () => {
    const tag = argon2Sync('argon2id', {
      message: Buffer.alloc(32, 0x01),
      nonce: Buffer.alloc(16, 0x02),
      secret: Buffer.alloc(8, 0x03),
      associatedData: Buffer.alloc(12, 0x04),
      memory: 32,
      passes: 3,
      parallelism: 4,
      tagLength: 32,
    });

    expect(tag.toString('hex')).toBe(
      '0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659',
    );
  });

  it('stores argon2id hashes in the PHC format', async () => {
    const hash = await hashPassword('perro-salchicha-42');

    expect(hash).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
    );
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('perro-salchicha-42');

    await expect(verifyPassword('perro-salchicha-42', hash)).resolves.toBe(true);
    await expect(verifyPassword('perro-salchicha-43', hash)).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    const [first, second] = await Promise.all([hashPassword('gato'), hashPassword('gato')]);

    expect(first).not.toBe(second);
  });

  it('treats the same characters typed differently as the same password', async () => {
    // "ñ" as one code point and as "n" plus a combining tilde.
    const hash = await hashPassword('Piñata2026');

    await expect(verifyPassword('Piñata2026', hash)).resolves.toBe(true);
  });

  it('verifies hashes made with other parameters, read from the hash itself', async () => {
    // Same password and salt with m=8192, t=1, p=1, from an earlier version of the cost.
    const cheaper =
      '$argon2id$v=19$m=8192,t=1,p=1$c29tZXNhbHRzb21lc2FsdA$' +
      argon2Sync('argon2id', {
        message: 'gato',
        nonce: Buffer.from('somesaltsomesalt'),
        memory: 8192,
        passes: 1,
        parallelism: 1,
        tagLength: 32,
      })
        .toString('base64')
        .replace(/=+$/, '');

    await expect(verifyPassword('gato', cheaper)).resolves.toBe(true);
  });

  it.each([
    '',
    'plain-text',
    '$2b$10$bcrypt.hash.from.somewhere.else',
    '$argon2i$v=19$m=1,t=1,p=1$a$b',
  ])('rejects a hash it cannot read: %j', async (encoded) => {
    await expect(verifyPassword('gato', encoded)).resolves.toBe(false);
  });

  it('always fails against the dummy hash', async () => {
    await expect(verifyAgainstDummy('cualquier-cosa')).resolves.toBe(false);
  });
});
