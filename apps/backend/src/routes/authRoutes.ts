import { Router, type Request, type Response } from 'express';
import type { ZodType } from 'zod';
import {
  ERROR_CODES,
  registerSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
} from '@noteapp/shared';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import * as AuthService from '../services/AuthService.js';

const router: ReturnType<typeof Router> = Router();

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Validation failed.', 400, fields);
  }
  return result.data;
}

router.post('/register', async (req: Request, res: Response) => {
  const body = parseBody(registerSchema, req.body);
  const result = await AuthService.register(body.email, body.password);
  res.status(201).json({ data: result });
});

router.post('/login', async (req: Request, res: Response) => {
  const body = parseBody(loginSchema, req.body);
  const result = await AuthService.login(body.email, body.password);
  res.status(200).json({ data: result });
});

router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  const { refreshToken } = parseBody(logoutSchema, req.body);
  await AuthService.logout(refreshToken);
  res.status(204).send();
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = parseBody(refreshTokenSchema, req.body);
  const result = await AuthService.refresh(refreshToken);
  res.status(200).json({ data: result });
});

export default router;
