import type { IUser } from '@noteapp/shared';
import prisma from '../lib/prisma.js';

type UserWithHash = IUser & { passwordHash: string };

function toUser(raw: { id: string; email: string; createdAt: Date; updatedAt: Date }): IUser {
  return { id: raw.id, email: raw.email, createdAt: raw.createdAt, updatedAt: raw.updatedAt };
}

export async function findByEmail(email: string): Promise<IUser | null> {
  const raw = await prisma.user.findUnique({ where: { email } });
  return raw ? toUser(raw) : null;
}

export async function findByEmailForAuth(email: string): Promise<UserWithHash | null> {
  const raw = await prisma.user.findUnique({ where: { email } });
  if (!raw) return null;
  return { ...toUser(raw), passwordHash: raw.passwordHash };
}

export async function findById(id: string): Promise<IUser | null> {
  const raw = await prisma.user.findUnique({ where: { id } });
  return raw ? toUser(raw) : null;
}

export async function create(email: string, passwordHash: string): Promise<IUser> {
  const raw = await prisma.user.create({ data: { email, passwordHash } });
  return toUser(raw);
}
