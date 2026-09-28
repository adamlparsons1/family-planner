/**
 * Password hashing for the household passcode and the parent PIN.
 *
 * bcryptjs is a pure-JS implementation: no native binding, so nothing to break
 * on a Vercel build. Cost 10 is ample here - the threat model is a curious
 * six-year-old and opportunistic internet noise, and rate limiting is doing
 * most of the real work.
 */
import bcrypt from 'bcryptjs';

const COST = 10;

export async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifySecret(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
