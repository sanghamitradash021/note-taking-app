import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../repositories/UserRepository.js', () => ({
  findByEmail: vi.fn(),
  findByEmailForAuth: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../../repositories/RefreshTokenRepository.js', () => ({
  create: vi.fn(),
  findByToken: vi.fn(),
  deleteByToken: vi.fn(),
  rotate: vi.fn(),
}));

vi.mock('../../../utils/hash.js', () => ({
  hashPassword: vi.fn<(p: string) => Promise<string>>(),
  comparePassword: vi.fn<(p: string, h: string) => Promise<boolean>>(),
}));

vi.mock('../../../utils/tokenHelpers.js', () => ({
  signAccessToken: vi.fn<(userId: string, email: string) => string>(),
  signRefreshToken: vi.fn<(userId: string) => string>(),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
}));

import * as UserRepo from '../../../repositories/UserRepository.js';
import * as RefreshRepo from '../../../repositories/RefreshTokenRepository.js';
import * as hash from '../../../utils/hash.js';
import * as tokenHelpers from '../../../utils/tokenHelpers.js';
import * as AuthService from '../../../services/AuthService.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '@noteapp/shared';
import { ERROR_CODES } from '@noteapp/shared';
import { AppError } from '../../../middleware/errorHandler.js';

const mockUser = {
  id: 'user-id',
  email: 'user@test.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserWithHash = { ...mockUser, passwordHash: 'hashed-password' };

const mockRefreshRecord = {
  id: 'rt-id',
  userId: 'user-id',
  token: 'refresh-token',
  expiresAt: new Date(Date.now() + 1_000_000),
  createdAt: new Date(),
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── registerSchema validation ────────────────────────────────────────────────

describe('registerSchema', () => {
  it('AC-REG-03: Weak password — too short', () => {
    const result = registerSchema.safeParse({ email: 'a@test.com', password: 'Pass1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'password')).toBe(true);
    }
  });

  it('AC-REG-03b: Weak password — no uppercase', () => {
    const result = registerSchema.safeParse({ email: 'a@test.com', password: 'password1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'password')).toBe(true);
    }
  });

  it('AC-REG-03c: Weak password — no digit', () => {
    const result = registerSchema.safeParse({ email: 'a@test.com', password: 'Password' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'password')).toBe(true);
    }
  });

  it('AC-REG-04: Missing email', () => {
    const result = registerSchema.safeParse({ password: 'Password1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'email')).toBe(true);
    }
  });

  it('AC-REG-04b: Invalid email format', () => {
    const result = registerSchema.safeParse({ email: 'not-an-email', password: 'Password1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'email')).toBe(true);
    }
  });
});

describe('loginSchema', () => {
  it('AC-LOGIN-04: Missing credentials', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('email');
      expect(fields).toContain('password');
    }
  });
});

describe('refreshTokenSchema', () => {
  it('AC-REFRESH-04: Missing refreshToken field', () => {
    const result = refreshTokenSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'refreshToken')).toBe(true);
    }
  });
});

// ─── AuthService.register ─────────────────────────────────────────────────────

describe('AuthService.register', () => {
  it('AC-REG-01: Successful registration', async () => {
    vi.mocked(UserRepo.findByEmail).mockResolvedValue(null);
    vi.mocked(hash.hashPassword).mockResolvedValue('hashed-password');
    vi.mocked(UserRepo.create).mockResolvedValue(mockUser);

    const result = await AuthService.register('user@test.com', 'Password1');

    expect(result).toEqual({ userId: 'user-id' });
    expect(UserRepo.create).toHaveBeenCalledWith('user@test.com', 'hashed-password');
  });

  it('AC-REG-02: Duplicate email', async () => {
    vi.mocked(UserRepo.findByEmail).mockResolvedValue(mockUser);

    const error = await AuthService.register('user@test.com', 'Password1').catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.EMAIL_TAKEN);
    expect((error as AppError).httpStatus).toBe(422);
  });

  it('AC-REG-05: Email case normalisation', async () => {
    vi.mocked(UserRepo.findByEmail).mockResolvedValue(null);
    vi.mocked(hash.hashPassword).mockResolvedValue('hashed');
    vi.mocked(UserRepo.create).mockResolvedValue({ ...mockUser, email: 'user@test.com' });

    await AuthService.register('USER@TEST.COM', 'Password1');

    expect(UserRepo.findByEmail).toHaveBeenCalledWith('user@test.com');
    expect(UserRepo.create).toHaveBeenCalledWith('user@test.com', expect.any(String));
  });
});

// ─── AuthService.login ────────────────────────────────────────────────────────

describe('AuthService.login', () => {
  it('AC-LOGIN-01: Successful login', async () => {
    vi.mocked(UserRepo.findByEmailForAuth).mockResolvedValue(mockUserWithHash);
    vi.mocked(hash.comparePassword).mockResolvedValue(true);
    vi.mocked(tokenHelpers.signAccessToken).mockReturnValue('access-token');
    vi.mocked(tokenHelpers.signRefreshToken).mockReturnValue('refresh-token');
    vi.mocked(RefreshRepo.create).mockResolvedValue(mockRefreshRecord);

    const result = await AuthService.login('user@test.com', 'Password1');

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user).toEqual({ id: 'user-id', email: 'user@test.com' });
    expect(RefreshRepo.create).toHaveBeenCalledWith('user-id', 'refresh-token', expect.any(Date));
  });

  it('AC-LOGIN-02: Wrong password', async () => {
    vi.mocked(UserRepo.findByEmailForAuth).mockResolvedValue(mockUserWithHash);
    vi.mocked(hash.comparePassword).mockResolvedValue(false);

    const error = await AuthService.login('user@test.com', 'wrongpassword').catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
    expect((error as AppError).httpStatus).toBe(401);
  });

  it('AC-LOGIN-03: Unknown email — same error as wrong password', async () => {
    vi.mocked(UserRepo.findByEmailForAuth).mockResolvedValue(null);
    vi.mocked(hash.comparePassword).mockResolvedValue(false);

    const error = await AuthService.login('unknown@test.com', 'Password1').catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
    expect((error as AppError).httpStatus).toBe(401);
    // comparePassword is still called (timing safety)
    expect(hash.comparePassword).toHaveBeenCalled();
  });
});

// ─── AuthService.logout ───────────────────────────────────────────────────────

describe('AuthService.logout', () => {
  it('AC-LOGOUT-01: Successful logout — deletes matching refresh token', async () => {
    vi.mocked(RefreshRepo.deleteByToken).mockResolvedValue(undefined);

    await expect(AuthService.logout('some-refresh-token')).resolves.toBeUndefined();
    expect(RefreshRepo.deleteByToken).toHaveBeenCalledWith('some-refresh-token');
  });
});

// ─── AuthService.refresh ──────────────────────────────────────────────────────

describe('AuthService.refresh', () => {
  it('AC-REFRESH-01: Successful token refresh — old deleted, new issued', async () => {
    vi.mocked(RefreshRepo.findByToken).mockResolvedValue(mockRefreshRecord);
    vi.mocked(UserRepo.findById).mockResolvedValue(mockUser);
    vi.mocked(tokenHelpers.signRefreshToken).mockReturnValue('new-refresh-token');
    vi.mocked(tokenHelpers.signAccessToken).mockReturnValue('new-access-token');
    vi.mocked(RefreshRepo.rotate).mockResolvedValue(undefined);

    const result = await AuthService.refresh('refresh-token');

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(RefreshRepo.rotate).toHaveBeenCalledWith(
      'refresh-token',
      'user-id',
      'new-refresh-token',
      expect.any(Date),
    );
  });

  it('AC-REFRESH-02: Invalid refresh token (not in DB)', async () => {
    vi.mocked(RefreshRepo.findByToken).mockResolvedValue(null);

    const error = await AuthService.refresh('invalid-token').catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.REFRESH_INVALID);
    expect((error as AppError).httpStatus).toBe(401);
  });

  it('AC-REFRESH-03: Expired refresh token — deleted from DB, returns REFRESH_INVALID', async () => {
    const expiredRecord = { ...mockRefreshRecord, expiresAt: new Date(Date.now() - 1000) };
    vi.mocked(RefreshRepo.findByToken).mockResolvedValue(expiredRecord);
    vi.mocked(RefreshRepo.deleteByToken).mockResolvedValue(undefined);

    const error = await AuthService.refresh('refresh-token').catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.REFRESH_INVALID);
    expect(RefreshRepo.deleteByToken).toHaveBeenCalledWith('refresh-token');
  });
});
