import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app.js';
import prisma from '../../../lib/prisma.js';
import { ERROR_CODES } from '@noteapp/shared';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-secret';
const TEST_EMAIL = 'auth-test@example.com';
const TEST_PASSWORD = 'TestPass1';

async function registerAndLogin() {
  await request(app)
    .post('/api/auth/register')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  return res.body.data as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string };
  };
}

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

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('AC-REG-01: Successful registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('userId');
    expect(typeof res.body.data.userId).toBe('string');
  });

  it('AC-REG-02: Duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODES.EMAIL_TAKEN);
  });

  it('AC-REG-03: Weak password — too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: 'Pass1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('password');
  });

  it('AC-REG-03b: Weak password — no uppercase', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: 'password1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('password');
  });

  it('AC-REG-03c: Weak password — no digit', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: 'Password' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('password');
  });

  it('AC-REG-04: Missing email', async () => {
    const res = await request(app).post('/api/auth/register').send({ password: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('email');
  });

  it('AC-REG-04b: Invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('email');
  });

  it('AC-REG-05: Email case normalisation', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL.toUpperCase(), password: TEST_PASSWORD });

    expect(res.status).toBe(201);

    // Login with lowercase — should work
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(loginRes.status).toBe(200);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('AC-LOGIN-01: Successful login', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user).toMatchObject({ email: TEST_EMAIL });

    // refresh token persisted in DB
    const record = await prisma.refreshToken.findUnique({
      where: { token: res.body.data.refreshToken },
    });
    expect(record).not.toBeNull();
  });

  it('AC-LOGIN-02: Wrong password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
    expect(res.body.error.fields).toBeUndefined();
  });

  it('AC-LOGIN-03: Unknown email — same message as wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  it('AC-LOGIN-04: Missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('email');
    expect(res.body.error.fields).toContain('password');
  });

  it('Malformed Bearer token — UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer not.a.valid.jwt')
      .send({ refreshToken: 'any' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  it('AC-LOGIN-05: Expired access token on protected endpoint', async () => {
    // Sign an already-expired token
    const expiredToken = jwt.sign(
      { sub: 'some-id', email: TEST_EMAIL, exp: Math.floor(Date.now() / 1000) - 60 },
      JWT_SECRET,
    );

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ refreshToken: 'any' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.TOKEN_EXPIRED);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('AC-LOGOUT-01: Successful logout — refresh token deleted from DB', async () => {
    const { accessToken, refreshToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(204);

    const record = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    expect(record).toBeNull();
  });

  it('AC-LOGOUT-02: Unauthenticated logout — no auth header', async () => {
    const res = await request(app).post('/api/auth/logout').send({ refreshToken: 'any-token' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('AC-REFRESH-01: Successful token refresh — old token deleted, new issued', async () => {
    const { refreshToken } = await registerAndLogin();

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.refreshToken).not.toBe(refreshToken);

    // Old token deleted
    const oldRecord = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    expect(oldRecord).toBeNull();

    // New token persisted
    const newRecord = await prisma.refreshToken.findUnique({
      where: { token: res.body.data.refreshToken },
    });
    expect(newRecord).not.toBeNull();
  });

  it('AC-REFRESH-02: Token not in DB', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'token-not-in-db' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.REFRESH_INVALID);
  });

  it('AC-REFRESH-03: Expired refresh token — deleted from DB, returns REFRESH_INVALID', async () => {
    const { accessToken } = await registerAndLogin();

    // Get userId from access token to create a DB record
    const decoded = jwt.verify(accessToken, JWT_SECRET) as { sub: string };

    // Insert an already-expired refresh token directly
    const expiredToken = 'expired-token-string';
    await prisma.refreshToken.create({
      data: {
        userId: decoded.sub,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: expiredToken });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.REFRESH_INVALID);

    // Expired row should be deleted
    const record = await prisma.refreshToken.findUnique({ where: { token: expiredToken } });
    expect(record).toBeNull();
  });

  it('AC-REFRESH-04: Missing refreshToken field', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.fields).toContain('refreshToken');
  });
});
