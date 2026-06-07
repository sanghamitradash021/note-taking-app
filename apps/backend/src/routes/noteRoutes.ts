import { Router, type Request, type Response } from 'express';
import type { ZodType } from 'zod';
import { ERROR_CODES, createNoteSchema, updateNoteSchema } from '@noteapp/shared';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import * as NoteService from '../services/NoteService.js';

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

router.post('/', async (req: Request, res: Response) => {
  const { title, content } = parseBody(createNoteSchema, req.body);
  const userId = res.locals['userId'] as string;
  const note = await NoteService.createNote(userId, title, content);
  res.status(201).json({ data: note });
});

router.get('/', async (_req: Request, res: Response) => {
  const userId = res.locals['userId'] as string;
  const notes = await NoteService.listNotes(userId);
  res.status(200).json({ data: notes });
});

router.get('/:id', async (req: Request, res: Response) => {
  const userId = res.locals['userId'] as string;
  const note = await NoteService.getNote(req.params['id'] as string, userId);
  res.status(200).json({ data: note });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const data = parseBody(updateNoteSchema, req.body);
  const userId = res.locals['userId'] as string;
  const note = await NoteService.updateNote(req.params['id'] as string, userId, data);
  res.status(200).json({ data: note });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = res.locals['userId'] as string;
  await NoteService.deleteNote(req.params['id'] as string, userId);
  res.status(204).send();
});

export default router;
