import type { INoteResponse } from '@noteapp/shared';
import { type Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';

type NoteWithTags = Prisma.NoteGetPayload<{
  include: { tags: { include: { tag: true } } };
}>;

const noteInclude = {
  tags: { include: { tag: true } },
} satisfies Prisma.NoteInclude;

function toNoteResponse(raw: NoteWithTags): INoteResponse {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    tags: raw.tags.map((nt) => ({ id: nt.tag.id, name: nt.tag.name })),
  };
}

export async function create(
  userId: string,
  title: string,
  content?: string | null,
): Promise<INoteResponse> {
  const raw = await prisma.note.create({
    data: { userId, title, content: content ?? null },
    include: noteInclude,
  });
  return toNoteResponse(raw);
}

export async function findAll(userId: string): Promise<INoteResponse[]> {
  const rows = await prisma.note.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: noteInclude,
  });
  return rows.map(toNoteResponse);
}

export async function findById(id: string, userId: string): Promise<INoteResponse | null> {
  const raw = await prisma.note.findFirst({
    where: { id, userId, deletedAt: null },
    include: noteInclude,
  });
  return raw ? toNoteResponse(raw) : null;
}

export async function update(
  id: string,
  userId: string,
  data: { title?: string; content?: string | null },
): Promise<INoteResponse | null> {
  const existing = await prisma.note.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) return null;
  const raw = await prisma.note.update({ where: { id }, data, include: noteInclude });
  return toNoteResponse(raw);
}

export async function findByIdUnchecked(id: string): Promise<INoteResponse | null> {
  const raw = await prisma.note.findFirst({
    where: { id },
    include: noteInclude,
  });
  return raw ? toNoteResponse(raw) : null;
}

export async function softDelete(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.note.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) return false;
  await prisma.note.update({ where: { id }, data: { deletedAt: new Date() } });
  return true;
}
