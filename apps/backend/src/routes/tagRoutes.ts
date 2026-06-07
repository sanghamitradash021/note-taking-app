import { Router, type Request, type Response } from 'express';
import type { ZodType } from 'zod';
import { ERROR_CODES, createTagSchema } from '@noteapp/shared';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import * as TagService from '../services/TagService.js';

const router: ReturnType<typeof Router> = Router();

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields = result.error.issues
      .map((i) => String(i.path[0]))
      .filter((f) => f !== 'undefined' && f !== '');
    if (fields.length > 0) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Validation failed.', 400, fields);
    }
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      result.error.issues[0]?.message ?? 'Validation failed.',
      400,
    );
  }
  return result.data;
}

router.use(authMiddleware);

// GET /api/tags
router.get('/', async (_req: Request, res: Response) => {
  const userId = res.locals['userId'] as string;
  const tags = await TagService.listTags(userId);
  res.status(200).json({ data: tags });
});

// POST /api/tags
router.post('/', async (req: Request, res: Response) => {
  const { name } = parseBody(createTagSchema, req.body);
  const userId = res.locals['userId'] as string;
  const tag = await TagService.createTag(userId, name);
  res.status(201).json({ data: tag });
});

// DELETE /api/tags/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = res.locals['userId'] as string;
  await TagService.deleteTag(req.params['id'] as string, userId);
  res.status(204).send();
});

// POST /api/notes/:id/tags/:tagId
router.post('/:id/tags/:tagId', async (req: Request, res: Response) => {
  const userId = res.locals['userId'] as string;
  const note = await TagService.attachTag(
    req.params['id'] as string,
    req.params['tagId'] as string,
    userId,
  );
  res.status(200).json({ data: note });
});

// DELETE /api/notes/:id/tags/:tagId
router.delete('/:id/tags/:tagId', async (req: Request, res: Response) => {
  const userId = res.locals['userId'] as string;
  const note = await TagService.detachTag(
    req.params['id'] as string,
    req.params['tagId'] as string,
    userId,
  );
  res.status(200).json({ data: note });
});

export default router;
