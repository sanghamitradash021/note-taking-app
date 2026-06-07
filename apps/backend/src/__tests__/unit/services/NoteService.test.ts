import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../repositories/NoteRepository.js', () => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

import * as NoteRepository from '../../../repositories/NoteRepository.js';
import * as NoteService from '../../../services/NoteService.js';
import { ERROR_CODES, createNoteSchema, updateNoteSchema } from '@noteapp/shared';
import { AppError } from '../../../middleware/errorHandler.js';

const MOCK_USER_ID = 'user-id-abc';
const MOCK_NOTE_ID = 'note-id-xyz';

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

// ─── createNoteSchema validation ──────────────────────────────────────────────

describe('createNoteSchema', () => {
  it('AC-NOTES-02: Create without title — VALIDATION_ERROR on title', () => {
    const result = createNoteSchema.safeParse({ content: 'body text' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
    }
  });

  it('AC-NOTES-02b: Create — title too long (256 chars)', () => {
    const result = createNoteSchema.safeParse({ title: 'a'.repeat(256) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
    }
  });

  it('AC-NOTES-02c: Create — title at max boundary (255 chars)', () => {
    const result = createNoteSchema.safeParse({ title: 'a'.repeat(255) });
    expect(result.success).toBe(true);
  });

  it('AC-NOTES-01b: Create — optional content absent', () => {
    const result = createNoteSchema.safeParse({ title: 'Valid Title' });
    expect(result.success).toBe(true);
  });

  it('Create — content null is valid', () => {
    const result = createNoteSchema.safeParse({ title: 'Valid Title', content: null });
    expect(result.success).toBe(true);
  });

  it('Create — empty string title rejected', () => {
    const result = createNoteSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
    }
  });
});

// ─── updateNoteSchema validation ──────────────────────────────────────────────

describe('updateNoteSchema', () => {
  it('AC-NOTES-06e: Update note — empty body rejected with refine message', () => {
    const result = updateNoteSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === 'At least one field must be provided'),
      ).toBe(true);
    }
  });

  it('Update — title only is valid', () => {
    const result = updateNoteSchema.safeParse({ title: 'New title' });
    expect(result.success).toBe(true);
  });

  it('Update — content only is valid', () => {
    const result = updateNoteSchema.safeParse({ content: 'New content' });
    expect(result.success).toBe(true);
  });

  it('Update — null content is valid', () => {
    const result = updateNoteSchema.safeParse({ content: null });
    expect(result.success).toBe(true);
  });

  it('Update — empty string content is valid', () => {
    const result = updateNoteSchema.safeParse({ content: '' });
    expect(result.success).toBe(true);
  });

  it('Update — title exceeding 255 chars is rejected', () => {
    const result = updateNoteSchema.safeParse({ title: 'a'.repeat(256) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
    }
  });
});

// ─── NoteService.createNote ───────────────────────────────────────────────────

describe('NoteService.createNote', () => {
  it('AC-NOTES-01: Create note — happy path', async () => {
    vi.mocked(NoteRepository.create).mockResolvedValue(mockNote);

    const result = await NoteService.createNote(MOCK_USER_ID, 'Test Note', 'Some content');

    expect(result).toEqual(mockNote);
    expect(NoteRepository.create).toHaveBeenCalledWith(MOCK_USER_ID, 'Test Note', 'Some content');
  });

  it('AC-NOTES-01b: Create note — optional content absent passes null', async () => {
    vi.mocked(NoteRepository.create).mockResolvedValue({ ...mockNote, content: null });

    const result = await NoteService.createNote(MOCK_USER_ID, 'Test Note');

    expect(result.content).toBeNull();
    expect(NoteRepository.create).toHaveBeenCalledWith(MOCK_USER_ID, 'Test Note', undefined);
  });
});

// ─── NoteService.listNotes ────────────────────────────────────────────────────

describe('NoteService.listNotes', () => {
  it('AC-NOTES-03: List own notes — returns array', async () => {
    const threeNotes = [
      { ...mockNote, id: 'note-1', title: 'Note 1' },
      { ...mockNote, id: 'note-2', title: 'Note 2' },
      { ...mockNote, id: 'note-3', title: 'Note 3' },
    ];
    vi.mocked(NoteRepository.findAll).mockResolvedValue(threeNotes);

    const result = await NoteService.listNotes(MOCK_USER_ID);

    expect(result).toHaveLength(3);
    expect(NoteRepository.findAll).toHaveBeenCalledWith(MOCK_USER_ID);
  });

  it('AC-NOTES-08: Deleted note excluded from list — repo returns only non-deleted', async () => {
    const twoNotes = [
      { ...mockNote, id: 'note-1', title: 'Note 1' },
      { ...mockNote, id: 'note-2', title: 'Note 2' },
    ];
    vi.mocked(NoteRepository.findAll).mockResolvedValue(twoNotes);

    const result = await NoteService.listNotes(MOCK_USER_ID);

    expect(result).toHaveLength(2);
  });
});

// ─── NoteService.getNote ──────────────────────────────────────────────────────

describe('NoteService.getNote', () => {
  it('AC-NOTES-04: Read own note — returns note', async () => {
    vi.mocked(NoteRepository.findById).mockResolvedValue(mockNote);

    const result = await NoteService.getNote(MOCK_NOTE_ID, MOCK_USER_ID);

    expect(result).toEqual(mockNote);
    expect(NoteRepository.findById).toHaveBeenCalledWith(MOCK_NOTE_ID, MOCK_USER_ID);
  });

  it("AC-NOTES-05: Read another user's note — throws NOTE_NOT_FOUND", async () => {
    vi.mocked(NoteRepository.findById).mockResolvedValue(null);

    const error = await NoteService.getNote(MOCK_NOTE_ID, 'other-user-id').catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
  });

  it('AC-NOTES-05b: Read own soft-deleted note — throws NOTE_NOT_FOUND', async () => {
    vi.mocked(NoteRepository.findById).mockResolvedValue(null);

    const error = await NoteService.getNote(MOCK_NOTE_ID, MOCK_USER_ID).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
  });
});

// ─── NoteService.updateNote ───────────────────────────────────────────────────

describe('NoteService.updateNote', () => {
  it('AC-NOTES-06: Update note — happy path', async () => {
    const updated = { ...mockNote, title: 'Updated Title' };
    vi.mocked(NoteRepository.update).mockResolvedValue(updated);

    const result = await NoteService.updateNote(MOCK_NOTE_ID, MOCK_USER_ID, {
      title: 'Updated Title',
    });

    expect(result.title).toBe('Updated Title');
    expect(NoteRepository.update).toHaveBeenCalledWith(MOCK_NOTE_ID, MOCK_USER_ID, {
      title: 'Updated Title',
    });
  });

  it('AC-NOTES-06b: Update note — content only', async () => {
    const updated = { ...mockNote, content: 'New content' };
    vi.mocked(NoteRepository.update).mockResolvedValue(updated);

    const result = await NoteService.updateNote(MOCK_NOTE_ID, MOCK_USER_ID, {
      content: 'New content',
    });

    expect(result.content).toBe('New content');
  });

  it('AC-NOTES-06c: Update note — empty string content stored', async () => {
    const updated = { ...mockNote, content: '' };
    vi.mocked(NoteRepository.update).mockResolvedValue(updated);

    const result = await NoteService.updateNote(MOCK_NOTE_ID, MOCK_USER_ID, { content: '' });

    expect(result.content).toBe('');
  });

  it('AC-NOTES-06d: Update note — null content stored', async () => {
    const updated = { ...mockNote, content: null };
    vi.mocked(NoteRepository.update).mockResolvedValue(updated);

    const result = await NoteService.updateNote(MOCK_NOTE_ID, MOCK_USER_ID, { content: null });

    expect(result.content).toBeNull();
  });

  it("AC-NOTES-06f: Update another user's note — throws NOTE_NOT_FOUND", async () => {
    vi.mocked(NoteRepository.update).mockResolvedValue(null);

    const error = await NoteService.updateNote(MOCK_NOTE_ID, 'other-user-id', {
      title: 'New',
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
  });
});

// ─── NoteService.deleteNote ───────────────────────────────────────────────────

describe('NoteService.deleteNote', () => {
  it('AC-NOTES-07: Soft-delete own note — resolves without error', async () => {
    vi.mocked(NoteRepository.softDelete).mockResolvedValue(true);

    await expect(NoteService.deleteNote(MOCK_NOTE_ID, MOCK_USER_ID)).resolves.toBeUndefined();
    expect(NoteRepository.softDelete).toHaveBeenCalledWith(MOCK_NOTE_ID, MOCK_USER_ID);
  });

  it("AC-NOTES-07b: Delete another user's note — throws NOTE_NOT_FOUND", async () => {
    vi.mocked(NoteRepository.softDelete).mockResolvedValue(false);

    const error = await NoteService.deleteNote(MOCK_NOTE_ID, 'other-user-id').catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
    expect((error as AppError).httpStatus).toBe(404);
  });
});
