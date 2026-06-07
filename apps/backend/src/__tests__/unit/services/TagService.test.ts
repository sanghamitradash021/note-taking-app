import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('../../../repositories/TagRepository.js', () => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  deleteById: vi.fn(),
  attachTag: vi.fn(),
  detachTag: vi.fn(),
}));

vi.mock('../../../repositories/NoteRepository.js', () => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  findByIdUnchecked: vi.fn(),
}));

import * as TagRepository from '../../../repositories/TagRepository.js';
import * as NoteRepository from '../../../repositories/NoteRepository.js';
import * as TagService from '../../../services/TagService.js';
import { ERROR_CODES, createTagSchema } from '@noteapp/shared';
import { AppError } from '../../../middleware/errorHandler.js';

const MOCK_USER_ID = 'user-id-abc';
const MOCK_TAG_ID = 'tag-id-xyz';
const MOCK_NOTE_ID = 'note-id-abc';

const mockTag = { id: MOCK_TAG_ID, name: 'Work' };

const mockNote = {
  id: MOCK_NOTE_ID,
  title: 'Test Note',
  content: 'Some content',
  createdAt: new Date('2025-06-01T10:00:00Z'),
  updatedAt: new Date('2025-06-01T10:00:00Z'),
  tags: [],
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── createTagSchema validation ───────────────────────────────────────────────

describe('createTagSchema', () => {
  it('AC-TAG-01b: Create tag — max length boundary (50 chars) → valid', () => {
    const result = createTagSchema.safeParse({ name: 'a'.repeat(50) });
    expect(result.success).toBe(true);
  });

  it('AC-TAG-01c: Create tag — name too long (51 chars) → invalid with fields: ["name"]', () => {
    const result = createTagSchema.safeParse({ name: 'a'.repeat(51) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'name')).toBe(true);
    }
  });

  it('AC-TAG-01d: Create tag — missing name → invalid with fields: ["name"]', () => {
    const result = createTagSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'name')).toBe(true);
    }
  });

  it('Create tag — empty string name → invalid', () => {
    const result = createTagSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'name')).toBe(true);
    }
  });

  it('Create tag — minimum valid name (1 char) → valid', () => {
    const result = createTagSchema.safeParse({ name: 'x' });
    expect(result.success).toBe(true);
  });
});

// ─── TagService.createTag ─────────────────────────────────────────────────────

describe('TagService.createTag', () => {
  it('AC-TAG-01: Create tag — happy path returns ITag with original casing', async () => {
    vi.mocked(TagRepository.create).mockResolvedValue(mockTag);

    const result = await TagService.createTag(MOCK_USER_ID, 'Work');

    expect(result).toEqual(mockTag);
    expect(TagRepository.create).toHaveBeenCalledWith(MOCK_USER_ID, 'Work');
  });

  it('AC-TAG-02: Duplicate tag — P2002 Prisma error → throws TAG_NAME_TAKEN (422)', async () => {
    vi.mocked(TagRepository.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );

    const error = await TagService.createTag(MOCK_USER_ID, 'work').catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.TAG_NAME_TAKEN);
    expect((error as AppError).httpStatus).toBe(422);
  });

  it('AC-TAG-02b: Duplicate tag — different casing P2002 → throws TAG_NAME_TAKEN (422)', async () => {
    vi.mocked(TagRepository.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed on normalizedName', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );

    const error = await TagService.createTag(MOCK_USER_ID, 'Work').catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.TAG_NAME_TAKEN);
    expect((error as AppError).httpStatus).toBe(422);
  });

  it('Non-P2002 Prisma error is re-thrown as-is', async () => {
    const dbError = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });
    vi.mocked(TagRepository.create).mockRejectedValue(dbError);

    const error = await TagService.createTag(MOCK_USER_ID, 'Work').catch((e) => e);

    expect(error).toBe(dbError);
    expect(error).not.toBeInstanceOf(AppError);
  });
});

// ─── TagService.listTags ──────────────────────────────────────────────────────

describe('TagService.listTags', () => {
  it('AC-TAG-03: List own tags — returns array from repo', async () => {
    const twoTags = [
      { id: 'tag-1', name: 'Work' },
      { id: 'tag-2', name: 'personal' },
    ];
    vi.mocked(TagRepository.findAll).mockResolvedValue(twoTags);

    const result = await TagService.listTags(MOCK_USER_ID);

    expect(result).toHaveLength(2);
    expect(result).toEqual(twoTags);
    expect(TagRepository.findAll).toHaveBeenCalledWith(MOCK_USER_ID);
  });

  it('AC-TAG-03b: List tags — none exist → returns empty array', async () => {
    vi.mocked(TagRepository.findAll).mockResolvedValue([]);

    const result = await TagService.listTags(MOCK_USER_ID);

    expect(result).toEqual([]);
    expect(TagRepository.findAll).toHaveBeenCalledWith(MOCK_USER_ID);
  });
});

// ─── TagService.deleteTag ─────────────────────────────────────────────────────

describe('TagService.deleteTag', () => {
  it('AC-TAG-04: Delete own tag — happy path resolves without error', async () => {
    vi.mocked(TagRepository.findById).mockResolvedValue(mockTag);
    vi.mocked(TagRepository.deleteById).mockResolvedValue(undefined);

    await expect(TagService.deleteTag(MOCK_TAG_ID, MOCK_USER_ID)).resolves.toBeUndefined();
    expect(TagRepository.findById).toHaveBeenCalledWith(MOCK_TAG_ID, MOCK_USER_ID);
    expect(TagRepository.deleteById).toHaveBeenCalledWith(MOCK_TAG_ID);
  });

  it("AC-TAG-04b: Delete another user's tag — throws TAG_NOT_FOUND (404)", async () => {
    vi.mocked(TagRepository.findById).mockResolvedValue(null);

    const error = await TagService.deleteTag(MOCK_TAG_ID, 'other-user-id').catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.TAG_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
    expect(TagRepository.deleteById).not.toHaveBeenCalled();
  });

  it('Delete non-existent tag — throws TAG_NOT_FOUND (404)', async () => {
    vi.mocked(TagRepository.findById).mockResolvedValue(null);

    const error = await TagService.deleteTag('non-existent-id', MOCK_USER_ID).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.TAG_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
  });
});

// ─── TagService.attachTag ─────────────────────────────────────────────────────

describe('TagService.attachTag', () => {
  it('AC-TAG-05: Attach tag — happy path calls TagRepository.attachTag and returns note', async () => {
    const noteWithTag = { ...mockNote, tags: [mockTag] };
    vi.mocked(NoteRepository.findById).mockResolvedValue(mockNote);
    vi.mocked(TagRepository.findById).mockResolvedValue(mockTag);
    vi.mocked(TagRepository.attachTag).mockResolvedValue(noteWithTag);

    const result = await TagService.attachTag(MOCK_NOTE_ID, MOCK_TAG_ID, MOCK_USER_ID);

    expect(result).toEqual(noteWithTag);
    expect(NoteRepository.findById).toHaveBeenCalledWith(MOCK_NOTE_ID, MOCK_USER_ID);
    expect(TagRepository.findById).toHaveBeenCalledWith(MOCK_TAG_ID, MOCK_USER_ID);
    expect(TagRepository.attachTag).toHaveBeenCalledWith(MOCK_NOTE_ID, MOCK_TAG_ID);
  });

  it('AC-TAG-05b: Attach tag — already attached (idempotent) → returns current note state', async () => {
    const noteWithTag = { ...mockNote, tags: [mockTag] };
    vi.mocked(NoteRepository.findById).mockResolvedValue(noteWithTag);
    vi.mocked(TagRepository.findById).mockResolvedValue(mockTag);
    vi.mocked(TagRepository.attachTag).mockResolvedValue(noteWithTag);

    const result = await TagService.attachTag(MOCK_NOTE_ID, MOCK_TAG_ID, MOCK_USER_ID);

    expect(result.tags).toHaveLength(1);
    expect(result.tags[0]).toEqual(mockTag);
  });

  it('AC-TAG-05c: Attach tag — note is soft-deleted → throws NOTE_NOT_FOUND (404)', async () => {
    vi.mocked(NoteRepository.findById).mockResolvedValue(null);

    const error = await TagService.attachTag(MOCK_NOTE_ID, MOCK_TAG_ID, MOCK_USER_ID).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
    expect(TagRepository.findById).not.toHaveBeenCalled();
    expect(TagRepository.attachTag).not.toHaveBeenCalled();
  });

  it('AC-TAG-05d: Attach tag — note belongs to other user → throws NOTE_NOT_FOUND (404)', async () => {
    vi.mocked(NoteRepository.findById).mockResolvedValue(null);

    const error = await TagService.attachTag(MOCK_NOTE_ID, MOCK_TAG_ID, 'other-user-id').catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
  });

  it('AC-TAG-07: Attach — tag belongs to other user → throws TAG_NOT_FOUND (404)', async () => {
    vi.mocked(NoteRepository.findById).mockResolvedValue(mockNote);
    vi.mocked(TagRepository.findById).mockResolvedValue(null);

    const error = await TagService.attachTag(MOCK_NOTE_ID, MOCK_TAG_ID, MOCK_USER_ID).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.TAG_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
    expect(TagRepository.attachTag).not.toHaveBeenCalled();
  });
});

// ─── TagService.detachTag ─────────────────────────────────────────────────────

describe('TagService.detachTag', () => {
  it('AC-TAG-06: Detach tag — happy path returns note without the tag', async () => {
    const noteWithTag = { ...mockNote, tags: [mockTag] };
    vi.mocked(NoteRepository.findById).mockResolvedValue(noteWithTag);
    vi.mocked(TagRepository.findById).mockResolvedValue(mockTag);
    vi.mocked(TagRepository.detachTag).mockResolvedValue({ ...mockNote, tags: [] });

    const result = await TagService.detachTag(MOCK_NOTE_ID, MOCK_TAG_ID, MOCK_USER_ID);

    expect(result.tags).toEqual([]);
    expect(NoteRepository.findById).toHaveBeenCalledWith(MOCK_NOTE_ID, MOCK_USER_ID);
    expect(TagRepository.findById).toHaveBeenCalledWith(MOCK_TAG_ID, MOCK_USER_ID);
    expect(TagRepository.detachTag).toHaveBeenCalledWith(MOCK_NOTE_ID, MOCK_TAG_ID);
  });

  it('AC-TAG-06b: Detach tag — not attached (idempotent) → returns current note state unchanged', async () => {
    // Note has no tags; detach is still a no-op success
    vi.mocked(NoteRepository.findById).mockResolvedValue(mockNote);
    vi.mocked(TagRepository.findById).mockResolvedValue(mockTag);
    vi.mocked(TagRepository.detachTag).mockResolvedValue({ ...mockNote, tags: [] });

    const result = await TagService.detachTag(MOCK_NOTE_ID, MOCK_TAG_ID, MOCK_USER_ID);

    expect(result.tags).toEqual([]);
    expect(TagRepository.detachTag).toHaveBeenCalledWith(MOCK_NOTE_ID, MOCK_TAG_ID);
  });

  it('Detach — note is soft-deleted → throws NOTE_NOT_FOUND (404)', async () => {
    vi.mocked(NoteRepository.findById).mockResolvedValue(null);

    const error = await TagService.detachTag(MOCK_NOTE_ID, MOCK_TAG_ID, MOCK_USER_ID).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
    expect(TagRepository.findById).not.toHaveBeenCalled();
    expect(TagRepository.detachTag).not.toHaveBeenCalled();
  });

  it('Detach — note belongs to other user → throws NOTE_NOT_FOUND (404)', async () => {
    vi.mocked(NoteRepository.findById).mockResolvedValue(null);

    const error = await TagService.detachTag(MOCK_NOTE_ID, MOCK_TAG_ID, 'other-user-id').catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
  });

  it('AC-TAG-07b: Detach — tag belongs to other user → throws TAG_NOT_FOUND (404)', async () => {
    vi.mocked(NoteRepository.findById).mockResolvedValue(mockNote);
    vi.mocked(TagRepository.findById).mockResolvedValue(null);

    const error = await TagService.detachTag(MOCK_NOTE_ID, MOCK_TAG_ID, MOCK_USER_ID).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.TAG_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
    expect(TagRepository.detachTag).not.toHaveBeenCalled();
  });
});
