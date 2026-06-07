# Tasks: AB-1003 — Notes CRUD + Soft-Delete

---

## Phase 1 — Foundation

- [ ] Add `INoteResponse` interface to `packages/shared/src/types/index.ts`
- [ ] Add `createNoteSchema` to `packages/shared/src/schemas/index.ts`
- [ ] Add `updateNoteSchema` (with `.refine()` for empty-body check) to `packages/shared/src/schemas/index.ts`
- [ ] Run `pnpm --filter backend prisma migrate dev --name add-notes-tags`

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`

---

## Phase 2 — Implementation

- [ ] Create `apps/backend/src/repositories/NoteRepository.ts` — `create`, `findAll`, `findById`, `update`, `softDelete`
- [ ] Create `apps/backend/src/services/NoteService.ts` — `createNote`, `listNotes`, `getNote`, `updateNote`, `deleteNote`
- [ ] Create `apps/backend/src/routes/noteRoutes.ts` — 5 route handlers + local `parseBody` helper, all behind `authMiddleware`
- [ ] Register `noteRouter` at `/api/notes` in `apps/backend/src/app.ts`

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`

---

## Phase 3 — Tests

### Unit tests — `apps/backend/src/__tests__/unit/services/NoteService.test.ts`

- [ ] AC-NOTES-01: Create note — happy path
- [ ] AC-NOTES-01b: Create note — optional content absent
- [ ] AC-NOTES-02: Create without title
- [ ] AC-NOTES-02b: Create — title too long (256 chars)
- [ ] AC-NOTES-02c: Create — title at max boundary (255 chars)
- [ ] AC-NOTES-03: List own notes
- [ ] AC-NOTES-04: Read own note
- [ ] AC-NOTES-05: Read another user's note → 404
- [ ] AC-NOTES-05b: Read own soft-deleted note → 404
- [ ] AC-NOTES-06: Update note — happy path (new title)
- [ ] AC-NOTES-06b: Update note — content only
- [ ] AC-NOTES-06c: Update note — empty string content
- [ ] AC-NOTES-06d: Update note — null content
- [ ] AC-NOTES-06e: Update note — empty body `{}` → VALIDATION_ERROR, no fields array
- [ ] AC-NOTES-06f: Update another user's note → NOTE_NOT_FOUND
- [ ] AC-NOTES-07: Soft-delete own note → deletedAt set
- [ ] AC-NOTES-07b: Delete another user's note → NOTE_NOT_FOUND
- [ ] AC-NOTES-08: Deleted note excluded from list

### Integration tests — `apps/backend/src/__tests__/integration/routes/notes.test.ts`

- [ ] AC-NOTES-01: Create note — happy path (201 + full note object + `tags: []`)
- [ ] AC-NOTES-01b: Create note — optional content absent (201 + `content: null`)
- [ ] AC-NOTES-02: Create without title (400 + `fields: ["title"]`)
- [ ] AC-NOTES-02b: Create — title 256 chars (400 + `fields: ["title"]`)
- [ ] AC-NOTES-02c: Create — title 255 chars (201)
- [ ] AC-NOTES-03: List own notes (200 + array of 3)
- [ ] AC-NOTES-04: Read own note (200 + note object)
- [ ] AC-NOTES-05: Read another user's note (404 + `NOTE_NOT_FOUND`)
- [ ] AC-NOTES-05b: Read own soft-deleted note (404 + `NOTE_NOT_FOUND`)
- [ ] AC-NOTES-06: Update note — happy path (200 + `updatedAt` refreshed)
- [ ] AC-NOTES-06b: Update note — content only (200)
- [ ] AC-NOTES-06c: Update note — `content: ""` (200 + empty string stored)
- [ ] AC-NOTES-06d: Update note — `content: null` (200 + null stored)
- [ ] AC-NOTES-06e: Update note — empty body `{}` (400 + `VALIDATION_ERROR` + no `fields`)
- [ ] AC-NOTES-06f: Update another user's note (404 + `NOTE_NOT_FOUND`)
- [ ] AC-NOTES-07: Soft-delete own note (204 + row still in DB with `deletedAt` set)
- [ ] AC-NOTES-07b: Delete another user's note (404 + `NOTE_NOT_FOUND`)
- [ ] AC-NOTES-08: Deleted note excluded from list (200 + array excludes deleted note)
- [ ] AC-NOTES-09: Unauthenticated — POST /api/notes (401 + `UNAUTHORIZED`)
- [ ] AC-NOTES-09b: Unauthenticated — GET /api/notes (401 + `UNAUTHORIZED`)
- [ ] AC-NOTES-09c: Unauthenticated — GET /api/notes/:id (401 + `UNAUTHORIZED`)
- [ ] AC-NOTES-09d: Unauthenticated — PATCH /api/notes/:id (401 + `UNAUTHORIZED`)
- [ ] AC-NOTES-09e: Unauthenticated — DELETE /api/notes/:id (401 + `UNAUTHORIZED`)

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test` → `pnpm test --coverage`
