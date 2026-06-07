import { ERROR_CODES } from '@noteapp/shared';
import type { INoteResponse } from '@noteapp/shared';
import { AppError } from '../middleware/errorHandler.js';
import * as NoteRepository from '../repositories/NoteRepository.js';

export async function createNote(
  userId: string,
  title: string,
  content?: string | null,
): Promise<INoteResponse> {
  return NoteRepository.create(userId, title, content);
}

export async function listNotes(userId: string): Promise<INoteResponse[]> {
  return NoteRepository.findAll(userId);
}

export async function getNote(id: string, userId: string): Promise<INoteResponse> {
  const note = await NoteRepository.findById(id, userId);
  if (!note) {
    throw new AppError(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found.', 404);
  }
  return note;
}

export async function updateNote(
  id: string,
  userId: string,
  data: { title?: string; content?: string | null },
): Promise<INoteResponse> {
  const note = await NoteRepository.update(id, userId, data);
  if (!note) {
    throw new AppError(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found.', 404);
  }
  return note;
}

export async function deleteNote(id: string, userId: string): Promise<void> {
  const deleted = await NoteRepository.softDelete(id, userId);
  if (!deleted) {
    throw new AppError(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found.', 404);
  }
}
