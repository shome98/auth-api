import bcrypt from 'bcryptjs';

/* Number of salt rounds for bcrypt (12 is a good balance). */
const SALT_ROUNDS = 12;

/* Hash a plain-text password using bcrypt.*/
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/* Verify a plain-text password against a bcrypt hash.*/
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
