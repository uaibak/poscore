import crypto from 'node:crypto';

const iterations = 120_000;
const keyLength = 32;
const digest = 'sha256';

export function hashSecret(secret: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(secret, salt, iterations, keyLength, digest).toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

export function verifySecret(secret: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [scheme, iterationText, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterationText || !salt || !hash) return false;
  const test = crypto.pbkdf2Sync(secret, salt, Number(iterationText), keyLength, digest).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}
