import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app.js';
import prisma from '../../../lib/prisma.js';
import { ERROR_CODES } from '@noteapp/shared';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-secret';
const TEST_EMAIL_A = 'notes-user-a@example.com';
const TEST_EMAIL_B = 'notes-user-b@example.com';
const TEST_PASSWORD = 'TestPass1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function registerAndLogin(email: string): Promise<{ accessToken: string; userId: string }> {
  await request(app).post('/api/auth/register').send({ email, password: TEST_PASSWORD });
  const res = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
  const data = res.body.data as { accessToken: string; user: { id: string } };
  return { accessToken: data.accessToken, userId: data.user.id };
}

async function createNote(
  accessToken: string,
  title: string,
  content?: string,
): Promise<{
  id: string;
  title: string;
  content: string | null;
  tags: unknown[];
  createdAt: string;
  updatedAt: string;
}> {
  const res = await request(app)
    .post('/api/notes')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(content !== undefined ? { title, content } : { title });
  return res.body.data as {
    id: string;
    title: string;
    content: string | null;
    tags: unknown[];
    createdAt: string;
    updatedAt: string;
  };
}

// ─── DB reset ─────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.noteTag.deleteMany();
  await prisma.note.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── Auth guard — all five notes endpoints ────────────────────────────────────

describe('Notes endpoints — auth guard', () => {
  it('AC-NOTES-09: Unauthenticated — create note → 401 UNAUTHORIZED', async () => {
    const res = await request(app).post('/api/notes').send({ title: 'A note' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('AC-NOTES-09b: Unauthenticated — list notes → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('AC-NOTES-09c: Unauthenticated — read note → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/notes/some-id');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('AC-NOTES-09d: Unauthenticated — update note → 401 UNAUTHORIZED', async () => {
    const res = await request(app).patch('/api/notes/some-id').send({ title: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('AC-NOTES-09e: Unauthenticated — delete note → 401 UNAUTHORIZED', async () => {
    const res = await request(app).delete('/api/notes/some-id');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('Malformed Bearer token — create → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', 'Bearer not.a.valid.jwt')
      .send({ title: 'A note' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('Expired access token — create → 401 TOKEN_EXPIRED', async () => {
    const expiredToken = jwt.sign(
      { sub: 'some-id', email: TEST_EMAIL_A, exp: Math.floor(Date.now() / 1000) - 60 },
      JWT_SECRET,
    );
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ title: 'A note' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.TOKEN_EXPIRED);
  });

  it('Token signed with wrong secret — create → 401 UNAUTHORIZED', async () => {
    const wrongToken = jwt.sign({ sub: 'some-id', email: TEST_EMAIL_A }, 'wrong-secret-value');
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${wrongToken}`)
      .send({ title: 'A note' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });
});

// ─── POST /api/notes ──────────────────────────────────────────────────────────

describe('POST /api/notes', () => {
  it('AC-NOTES-01: Create note — happy path', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'My First Note', content: 'Hello world.' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'My First Note',
      content: 'Hello world.',
      tags: [],
    });
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('AC-NOTES-01b: Create note — optional content absent → content is null', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Title Only' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBeNull();
    expect(res.body.data.tags).toEqual([]);
  });

  it('AC-NOTES-02: Create without title → 400 VALIDATION_ERROR fields: ["title"]', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'body without title' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('title');
  });

  it('AC-NOTES-02b: Create — title too long (256 chars) → 400 VALIDATION_ERROR', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'a'.repeat(256) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('title');
  });

  it('AC-NOTES-02c: Create — title at max boundary (255 chars) → 201', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'a'.repeat(255) });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toHaveLength(255);
  });

  it('Create — empty string title → 400 VALIDATION_ERROR', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('title');
  });
});

// ─── GET /api/notes ───────────────────────────────────────────────────────────

describe('GET /api/notes', () => {
  it('AC-NOTES-03: List own notes — returns array of 3 notes', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    await createNote(accessToken, 'Note 1');
    await createNote(accessToken, 'Note 2');
    await createNote(accessToken, 'Note 3');

    const res = await request(app).get('/api/notes').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(3);
  });

  it('AC-NOTES-08: Deleted note excluded from list — 3 notes, 1 deleted → 2 returned', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note1 = await createNote(accessToken, 'Keep 1');
    const note2 = await createNote(accessToken, 'Keep 2');
    const note3 = await createNote(accessToken, 'To Delete');

    // Soft-delete note3
    await request(app)
      .delete(`/api/notes/${note3.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app).get('/api/notes').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const ids = (res.body.data as Array<{ id: string }>).map((n) => n.id);
    expect(ids).toContain(note1.id);
    expect(ids).toContain(note2.id);
    expect(ids).not.toContain(note3.id);
  });

  it('List — user only sees their own notes', async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);

    await createNote(tokenA, 'User A Note');
    await createNote(tokenB, 'User B Note');

    const res = await request(app).get('/api/notes').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect((res.body.data as Array<{ title: string }>)[0].title).toBe('User A Note');
  });
});

// ─── GET /api/notes/:id ───────────────────────────────────────────────────────

describe('GET /api/notes/:id', () => {
  it('AC-NOTES-04: Read own note → 200 with full note object', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const created = await createNote(accessToken, 'My Note', 'My content');

    const res = await request(app)
      .get(`/api/notes/${created.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: created.id,
      title: 'My Note',
      content: 'My content',
      tags: [],
    });
  });

  it("AC-NOTES-05: Read another user's note → 404 NOTE_NOT_FOUND", async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);
    const noteA = await createNote(tokenA, 'User A private note');

    const res = await request(app)
      .get(`/api/notes/${noteA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });

  it('AC-NOTES-05b: Read own soft-deleted note → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Will be deleted');

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app)
      .get(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });

  it('Read non-existent note → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .get('/api/notes/cldoesnotexist0000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });
});

// ─── PATCH /api/notes/:id ─────────────────────────────────────────────────────

describe('PATCH /api/notes/:id', () => {
  it('AC-NOTES-06: Update note — happy path title', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Original Title', 'Original content');

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('AC-NOTES-06b: Update note — content only', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Keep This Title', 'Old content');

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'New content' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('New content');
    expect(res.body.data.title).toBe('Keep This Title');
  });

  it('AC-NOTES-06c: Update note — empty string content stored', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Note', 'Some content');

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('');
  });

  it('AC-NOTES-06d: Update note — null content stored', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Note', 'Some content');

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: null });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBeNull();
  });

  it('AC-NOTES-06e: Update note — empty body → 400 VALIDATION_ERROR, no fields array', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Note');

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toBeUndefined();
  });

  it("AC-NOTES-06f: Update another user's note → 404 NOTE_NOT_FOUND", async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);
    const noteA = await createNote(tokenA, 'User A Note');

    const res = await request(app)
      .patch(`/api/notes/${noteA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });

  it('Update — title exceeding 255 chars → 400 VALIDATION_ERROR', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Note');

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'a'.repeat(256) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('title');
  });

  it('Update — title at 255 chars boundary → 200', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Note');

    const res = await request(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'a'.repeat(255) });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toHaveLength(255);
  });

  it('Update non-existent note → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .patch('/api/notes/cldoesnotexist0000000000000')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });
});

// ─── DELETE /api/notes/:id ────────────────────────────────────────────────────

describe('DELETE /api/notes/:id', () => {
  it('AC-NOTES-07: Soft-delete own note → 204; deletedAt set; row still in DB', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'To be deleted');

    const res = await request(app)
      .delete(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    // Row still in DB with deletedAt set
    const row = await prisma.note.findUnique({ where: { id: note.id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
  });

  it("AC-NOTES-07b: Delete another user's note → 404 NOTE_NOT_FOUND", async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);
    const noteA = await createNote(tokenA, 'User A Note');

    const res = await request(app)
      .delete(`/api/notes/${noteA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);

    // Note still exists and is NOT deleted
    const row = await prisma.note.findUnique({ where: { id: noteA.id } });
    expect(row?.deletedAt).toBeNull();
  });

  it('Delete non-existent note → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .delete('/api/notes/cldoesnotexist0000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });

  it('Delete already-deleted note → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Delete twice');

    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app)
      .delete(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });
});
