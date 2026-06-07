import type { ITag, INoteResponse } from '@noteapp/shared';
import prisma from '../lib/prisma.js';
import * as NoteRepository from './NoteRepository.js';

function toTag(raw: { id: string; name: string }): ITag {
  return { id: raw.id, name: raw.name };
}

export async function create(userId: string, name: string): Promise<ITag> {
  const raw = await prisma.tag.create({
    data: { userId, name, normalizedName: name.toLowerCase() },
  });
  return toTag(raw);
}

export async function findAll(userId: string): Promise<ITag[]> {
  const rows = await prisma.tag.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toTag);
}

export async function findById(id: string, userId: string): Promise<ITag | null> {
  const raw = await prisma.tag.findFirst({ where: { id, userId } });
  return raw ? toTag(raw) : null;
}

export async function deleteById(id: string): Promise<void> {
  await prisma.tag.delete({ where: { id } });
}

export async function attachTag(noteId: string, tagId: string): Promise<INoteResponse> {
  await prisma.noteTag.upsert({
    where: { noteId_tagId: { noteId, tagId } },
    create: { noteId, tagId },
    update: {},
  });
  return (await NoteRepository.findByIdUnchecked(noteId)) as INoteResponse;
}

export async function detachTag(noteId: string, tagId: string): Promise<INoteResponse> {
  await prisma.noteTag.deleteMany({ where: { noteId, tagId } });
  return (await NoteRepository.findByIdUnchecked(noteId)) as INoteResponse;
}
