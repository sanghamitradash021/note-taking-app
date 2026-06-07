import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app.js';
import prisma from '../../../lib/prisma.js';
import { ERROR_CODES } from '@noteapp/shared';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-secret';
const TEST_EMAIL_A = 'tags-user-a@example.com';
const TEST_EMAIL_B = 'tags-user-b@example.com';
const TEST_PASSWORD = 'TestPass1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function registerAndLogin(email: string): Promise<{ accessToken: string; userId: string }> {
  await request(app).post('/api/auth/register').send({ email, password: TEST_PASSWORD });
  const res = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
  const data = res.body.data as { accessToken: string; user: { id: string } };
  return { accessToken: data.accessToken, userId: data.user.id };
}

async function createTag(accessToken: string, name: string): Promise<{ id: string; name: string }> {
  const res = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name });
  return res.body.data as { id: string; name: string };
}

async function createNote(
  accessToken: string,
  title: string,
): Promise<{ id: string; title: string; content: string | null; tags: unknown[] }> {
  const res = await request(app)
    .post('/api/notes')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ title });
  return res.body.data as { id: string; title: string; content: string | null; tags: unknown[] };
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

// ─── Auth guard — all five tag endpoints ──────────────────────────────────────

describe('Tags endpoints — auth guard', () => {
  it('AC-TAG-08: Unauthenticated — list tags → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('AC-TAG-08b: Unauthenticated — create tag → 401 UNAUTHORIZED', async () => {
    const res = await request(app).post('/api/tags').send({ name: 'work' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('AC-TAG-08c: Unauthenticated — delete tag → 401 UNAUTHORIZED', async () => {
    const res = await request(app).delete('/api/tags/some-id');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('AC-TAG-08d: Unauthenticated — attach tag → 401 UNAUTHORIZED', async () => {
    const res = await request(app).post('/api/notes/some-note/tags/some-tag');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('AC-TAG-08e: Unauthenticated — detach tag → 401 UNAUTHORIZED', async () => {
    const res = await request(app).delete('/api/notes/some-note/tags/some-tag');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('Malformed Bearer token — list tags → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/tags').set('Authorization', 'Bearer not.a.valid.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('Expired access token — list tags → 401 TOKEN_EXPIRED', async () => {
    const expiredToken = jwt.sign(
      { sub: 'some-id', email: TEST_EMAIL_A, exp: Math.floor(Date.now() / 1000) - 60 },
      JWT_SECRET,
    );
    const res = await request(app).get('/api/tags').set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.TOKEN_EXPIRED);
  });

  it('Token signed with wrong secret — list tags → 401 UNAUTHORIZED', async () => {
    const wrongToken = jwt.sign({ sub: 'some-id', email: TEST_EMAIL_A }, 'wrong-secret-value');
    const res = await request(app).get('/api/tags').set('Authorization', `Bearer ${wrongToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });
});

// ─── POST /api/tags ───────────────────────────────────────────────────────────

describe('POST /api/tags', () => {
  it('AC-TAG-01: Create tag — happy path → 201 with { id, name } in original casing', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Work' });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('Work');
    // normalizedName must NOT be present in the response
    expect(res.body.data.normalizedName).toBeUndefined();
  });

  it('AC-TAG-01b: Create tag — max length boundary (50 chars) → 201', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const name = 'a'.repeat(50);

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toHaveLength(50);
  });

  it('AC-TAG-01c: Create tag — name too long (51 chars) → 400 VALIDATION_ERROR fields: ["name"]', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'a'.repeat(51) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('name');
  });

  it('AC-TAG-01d: Create tag — missing name → 400 VALIDATION_ERROR fields: ["name"]', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('name');
  });

  it('AC-TAG-02: Duplicate tag — exact match → 422 TAG_NAME_TAKEN', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    await createTag(accessToken, 'work');

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'work' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODES.TAG_NAME_TAKEN);
  });

  it('AC-TAG-02b: Duplicate tag — different casing ("work" exists, send "Work") → 422 TAG_NAME_TAKEN', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    await createTag(accessToken, 'work');

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Work' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODES.TAG_NAME_TAKEN);
  });

  it('AC-TAG-02c: Same name, different user → 201 (uniqueness is per-user)', async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);

    await createTag(tokenA, 'work');

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'work' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('work');
  });

  it('Create tag — empty string name → 400 VALIDATION_ERROR fields: ["name"]', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('name');
  });
});

// ─── GET /api/tags ────────────────────────────────────────────────────────────

describe('GET /api/tags', () => {
  it('AC-TAG-03: List own tags — user has 2 tags → 200 with data array of 2 tag objects', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    await createTag(accessToken, 'Work');
    await createTag(accessToken, 'personal');

    const res = await request(app).get('/api/tags').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    // Each tag must have id and name
    for (const tag of res.body.data as Array<{ id: string; name: string }>) {
      expect(tag.id).toBeDefined();
      expect(tag.name).toBeDefined();
    }
  });

  it('AC-TAG-03b: List tags — none exist → 200 with data: []', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app).get('/api/tags').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('List tags — user only sees their own tags', async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);

    await createTag(tokenA, 'User A tag');
    await createTag(tokenB, 'User B tag');

    const res = await request(app).get('/api/tags').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect((res.body.data as Array<{ name: string }>)[0].name).toBe('User A tag');
  });
});

// ─── DELETE /api/tags/:id ─────────────────────────────────────────────────────

describe('DELETE /api/tags/:id', () => {
  it('AC-TAG-04: Delete own tag — cascade detach → 204; NoteTag rows removed; notes still exist with tags: []', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const tag = await createTag(accessToken, 'cascade-tag');
    const note1 = await createNote(accessToken, 'Note One');
    const note2 = await createNote(accessToken, 'Note Two');

    // Attach tag to both notes
    await request(app)
      .post(`/api/notes/${note1.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    await request(app)
      .post(`/api/notes/${note2.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    // Delete the tag
    const deleteRes = await request(app)
      .delete(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteRes.status).toBe(204);
    expect(deleteRes.body).toEqual({});

    // Verify NoteTag rows removed (cascade)
    const noteTagRows = await prisma.noteTag.findMany({ where: { tagId: tag.id } });
    expect(noteTagRows).toHaveLength(0);

    // Notes still exist; tags array is empty
    const note1Res = await request(app)
      .get(`/api/notes/${note1.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(note1Res.status).toBe(200);
    expect(note1Res.body.data.tags).toEqual([]);

    const note2Res = await request(app)
      .get(`/api/notes/${note2.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(note2Res.status).toBe(200);
    expect(note2Res.body.data.tags).toEqual([]);
  });

  it("AC-TAG-04b: Delete another user's tag → 404 TAG_NOT_FOUND", async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);

    const tagA = await createTag(tokenA, 'User A tag');

    const res = await request(app)
      .delete(`/api/tags/${tagA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.TAG_NOT_FOUND);

    // Tag still exists in DB
    const row = await prisma.tag.findUnique({ where: { id: tagA.id } });
    expect(row).not.toBeNull();
  });

  it('Delete non-existent tag → 404 TAG_NOT_FOUND', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);

    const res = await request(app)
      .delete('/api/tags/cldoesnotexist0000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.TAG_NOT_FOUND);
  });
});

// ─── POST /api/notes/:id/tags/:tagId ─────────────────────────────────────────

describe('POST /api/notes/:id/tags/:tagId', () => {
  it('AC-TAG-05: Attach tag — happy path → 200; full note object; tags array includes the tag', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'My Note');
    const tag = await createTag(accessToken, 'Work');

    const res = await request(app)
      .post(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(note.id);
    expect(res.body.data.title).toBe('My Note');
    expect(res.body.data.tags).toBeDefined();
    expect(Array.isArray(res.body.data.tags)).toBe(true);
    const tagIds = (res.body.data.tags as Array<{ id: string }>).map((t) => t.id);
    expect(tagIds).toContain(tag.id);
  });

  it('AC-TAG-05b: Attach tag — already attached (idempotent) → 200; no duplicate in tags array', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'My Note');
    const tag = await createTag(accessToken, 'Work');

    // First attach
    await request(app)
      .post(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    // Second attach (idempotent)
    const res = await request(app)
      .post(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tags).toHaveLength(1);
    expect((res.body.data.tags as Array<{ id: string }>)[0].id).toBe(tag.id);
  });

  it('AC-TAG-05c: Attach tag — note is soft-deleted → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Will be deleted');
    const tag = await createTag(accessToken, 'Work');

    // Soft-delete the note
    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app)
      .post(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });

  it('AC-TAG-05d: Attach tag — note belongs to other user → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);

    const noteA = await createNote(tokenA, 'User A note');
    const tagB = await createTag(tokenB, 'User B tag');

    const res = await request(app)
      .post(`/api/notes/${noteA.id}/tags/${tagB.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });

  it('AC-TAG-07: Attach — tag belongs to other user → 404 TAG_NOT_FOUND', async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);

    const noteA = await createNote(tokenA, 'User A note');
    const tagB = await createTag(tokenB, 'User B tag');

    const res = await request(app)
      .post(`/api/notes/${noteA.id}/tags/${tagB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.TAG_NOT_FOUND);
  });

  it('Attach — note does not exist → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const tag = await createTag(accessToken, 'Work');

    const res = await request(app)
      .post(`/api/notes/cldoesnotexist0000000000000/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });

  it('Attach — response includes full note shape (id, title, content, createdAt, updatedAt, tags)', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Full Shape Note');
    const tag = await createTag(accessToken, 'Shape');

    const res = await request(app)
      .post(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.title).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data.updatedAt).toBeDefined();
    expect(Array.isArray(res.body.data.tags)).toBe(true);
  });
});

// ─── DELETE /api/notes/:id/tags/:tagId ───────────────────────────────────────

describe('DELETE /api/notes/:id/tags/:tagId', () => {
  it('AC-TAG-06: Detach tag — happy path → 200; full note object; tags array no longer includes the tag', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'My Note');
    const tag = await createTag(accessToken, 'Work');

    // Attach first
    await request(app)
      .post(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    // Detach
    const res = await request(app)
      .delete(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(note.id);
    const tagIds = (res.body.data.tags as Array<{ id: string }>).map((t) => t.id);
    expect(tagIds).not.toContain(tag.id);
  });

  it('AC-TAG-06b: Detach tag — not attached (idempotent) → 200; tags array unchanged', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'My Note');
    const tag = await createTag(accessToken, 'Work');

    // Detach without ever having attached
    const res = await request(app)
      .delete(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(note.id);
    expect(res.body.data.tags).toEqual([]);
  });

  it('AC-TAG-07b: Detach — tag belongs to other user → 404 TAG_NOT_FOUND', async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);

    const noteA = await createNote(tokenA, 'User A note');
    const tagB = await createTag(tokenB, 'User B tag');

    const res = await request(app)
      .delete(`/api/notes/${noteA.id}/tags/${tagB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.TAG_NOT_FOUND);
  });

  it('Detach — note belongs to other user → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken: tokenA } = await registerAndLogin(TEST_EMAIL_A);
    const { accessToken: tokenB } = await registerAndLogin(TEST_EMAIL_B);

    const noteA = await createNote(tokenA, 'User A note');
    const tagB = await createTag(tokenB, 'User B tag');

    const res = await request(app)
      .delete(`/api/notes/${noteA.id}/tags/${tagB.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });

  it('Detach — soft-deleted note → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Will be deleted');
    const tag = await createTag(accessToken, 'Work');

    // Attach tag, then soft-delete the note
    await request(app)
      .post(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    await request(app)
      .delete(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app)
      .delete(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });

  it('Detach — note does not exist → 404 NOTE_NOT_FOUND', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const tag = await createTag(accessToken, 'Work');

    const res = await request(app)
      .delete(`/api/notes/cldoesnotexist0000000000000/tags/${tag.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
  });

  it('Detach — response includes full note shape after detach', async () => {
    const { accessToken } = await registerAndLogin(TEST_EMAIL_A);
    const note = await createNote(accessToken, 'Shape Check');
    const tag1 = await createTag(accessToken, 'Keep');
    const tag2 = await createTag(accessToken, 'Remove');

    // Attach both tags
    await request(app)
      .post(`/api/notes/${note.id}/tags/${tag1.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    await request(app)
      .post(`/api/notes/${note.id}/tags/${tag2.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    // Detach tag2
    const res = await request(app)
      .delete(`/api/notes/${note.id}/tags/${tag2.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(note.id);
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data.updatedAt).toBeDefined();
    // tag1 still present, tag2 removed
    const tagIds = (res.body.data.tags as Array<{ id: string }>).map((t) => t.id);
    expect(tagIds).toContain(tag1.id);
    expect(tagIds).not.toContain(tag2.id);
  });
});
