import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { ERROR_CODES, type IAccessTokenPayload } from '@noteapp/shared';
import { AppError } from '../middleware/errorHandler.js';

function getSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

export function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, getSecret(), { expiresIn: '15m' });
}

export function signRefreshToken(userId: string): string {
  // jti ensures each token is unique even when issued in the same second
  return jwt.sign({ sub: userId, jti: randomUUID() }, getSecret(), { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): IAccessTokenPayload {
  try {
    const payload = jwt.verify(token, getSecret());
    /* c8 ignore next 3 — jwt.verify with HS256 never returns a plain string */
    if (typeof payload === 'string') {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required.', 401);
    }
    return payload as IAccessTokenPayload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(ERROR_CODES.TOKEN_EXPIRED, 'Access token has expired.', 401);
    }
    throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required.', 401);
  }
}
