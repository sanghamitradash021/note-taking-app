import { type Request, type Response, type NextFunction } from 'express';
import { ERROR_CODES } from '@noteapp/shared';
import { verifyAccessToken } from '../utils/tokenHelpers.js';
import { AppError } from './errorHandler.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      userId: string;
      email: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required.', 401));
    return;
  }
  try {
    const payload = verifyAccessToken(authHeader.slice(7));
    res.locals['userId'] = payload.sub;
    res.locals['email'] = payload.email;
    next();
  } catch (err) {
    next(
      err instanceof AppError
        ? err
        : new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required.', 401),
    );
  }
}
