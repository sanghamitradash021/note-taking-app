import prisma from '../lib/prisma.js';

interface IRefreshTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export async function create(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<IRefreshTokenRecord> {
  return prisma.refreshToken.create({ data: { userId, token, expiresAt } });
}

export async function findByToken(token: string): Promise<IRefreshTokenRecord | null> {
  return prisma.refreshToken.findUnique({ where: { token } });
}

export async function deleteByToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function rotate(
  oldToken: string,
  userId: string,
  newToken: string,
  expiresAt: Date,
): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { token: oldToken } }),
    prisma.refreshToken.create({ data: { userId, token: newToken, expiresAt } }),
  ]);
}
