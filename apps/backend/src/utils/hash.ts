import bcrypt from 'bcrypt';

const ROUNDS = parseInt(process.env['BCRYPT_ROUNDS'] ?? '10', 10);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
