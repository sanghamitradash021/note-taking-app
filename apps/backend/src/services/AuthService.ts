import { ERROR_CODES } from '@noteapp/shared';
import type { ILoginResponse, IRefreshResponse, IRegisterResponse } from '@noteapp/shared';
import { AppError } from '../middleware/errorHandler.js';
import { signAccessToken, signRefreshToken } from '../utils/tokenHelpers.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import * as UserRepository from '../repositories/UserRepository.js';
import * as RefreshTokenRepository from '../repositories/RefreshTokenRepository.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Pre-computed hash used for constant-time comparison when the requested user is not found,
// preventing timing-based user enumeration.
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export async function register(email: string, password: string): Promise<IRegisterResponse> {
  const normalizedEmail = email.toLowerCase();
  const existing = await UserRepository.findByEmail(normalizedEmail);
  if (existing) {
    throw new AppError(ERROR_CODES.EMAIL_TAKEN, 'An account with this email already exists.', 422);
  }
  const passwordHash = await hashPassword(password);
  const user = await UserRepository.create(normalizedEmail, passwordHash);
  return { userId: user.id };
}

export async function login(email: string, password: string): Promise<ILoginResponse> {
  const normalizedEmail = email.toLowerCase();
  const user = await UserRepository.findByEmailForAuth(normalizedEmail);
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const valid = await comparePassword(password, hashToCompare);

  if (!user || !valid) {
    throw new AppError(ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password.', 401);
  }

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await RefreshTokenRepository.create(user.id, refreshToken, expiresAt);

  return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
}

export async function logout(refreshToken: string): Promise<void> {
  await RefreshTokenRepository.deleteByToken(refreshToken);
}

export async function refresh(incomingToken: string): Promise<IRefreshResponse> {
  const record = await RefreshTokenRepository.findByToken(incomingToken);

  if (!record) {
    throw new AppError(ERROR_CODES.REFRESH_INVALID, 'Refresh token is invalid or expired.', 401);
  }

  if (record.expiresAt < new Date()) {
    await RefreshTokenRepository.deleteByToken(incomingToken);
    throw new AppError(ERROR_CODES.REFRESH_INVALID, 'Refresh token is invalid or expired.', 401);
  }

  const user = await UserRepository.findById(record.userId);
  if (!user) {
    throw new AppError(ERROR_CODES.REFRESH_INVALID, 'Refresh token is invalid or expired.', 401);
  }

  const newRefreshToken = signRefreshToken(user.id);
  const newAccessToken = signAccessToken(user.id, user.email);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await RefreshTokenRepository.rotate(incomingToken, user.id, newRefreshToken, expiresAt);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}
