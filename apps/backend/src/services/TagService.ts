import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '@noteapp/shared';
import type { ITag, INoteResponse } from '@noteapp/shared';
import { AppError } from '../middleware/errorHandler.js';
import * as TagRepository from '../repositories/TagRepository.js';
import * as NoteRepository from '../repositories/NoteRepository.js';

export async function createTag(userId: string, name: string): Promise<ITag> {
  try {
    return await TagRepository.create(userId, name);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(ERROR_CODES.TAG_NAME_TAKEN, 'A tag with this name already exists.', 422);
    }
    throw e;
  }
}

export async function listTags(userId: string): Promise<ITag[]> {
  return TagRepository.findAll(userId);
}

export async function deleteTag(id: string, userId: string): Promise<void> {
  const tag = await TagRepository.findById(id, userId);
  if (!tag) {
    throw new AppError(ERROR_CODES.TAG_NOT_FOUND, 'Tag not found.', 404);
  }
  await TagRepository.deleteById(id);
}

export async function attachTag(
  noteId: string,
  tagId: string,
  userId: string,
): Promise<INoteResponse> {
  const note = await NoteRepository.findById(noteId, userId);
  if (!note) {
    throw new AppError(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found.', 404);
  }
  const tag = await TagRepository.findById(tagId, userId);
  if (!tag) {
    throw new AppError(ERROR_CODES.TAG_NOT_FOUND, 'Tag not found.', 404);
  }
  return TagRepository.attachTag(noteId, tagId);
}

export async function detachTag(
  noteId: string,
  tagId: string,
  userId: string,
): Promise<INoteResponse> {
  const note = await NoteRepository.findById(noteId, userId);
  if (!note) {
    throw new AppError(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found.', 404);
  }
  const tag = await TagRepository.findById(tagId, userId);
  if (!tag) {
    throw new AppError(ERROR_CODES.TAG_NOT_FOUND, 'Tag not found.', 404);
  }
  return TagRepository.detachTag(noteId, tagId);
}
