import bcrypt from 'bcryptjs';

const COST_ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, COST_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}
