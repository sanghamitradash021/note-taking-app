# Tasks: AB-1004 — Tags (Create, Delete, Attach, Detach)

---

## Phase 1 — Foundation

- [ ] **DB migration** — add `normalizedName String @db.VarChar(50)` to `Tag` model; replace `@@unique([userId, name])` with `@@unique([userId, normalizedName])`; add `onDelete: Cascade` to both FK relations in `NoteTag`; run `pnpm --filter backend prisma migrate dev --name add-tag-normalized-name-and-cascade`
- [ ] **Shared schema** — add `createTagSchema` (`name: z.string().min(1).max(50)`) to `packages/shared/src/schemas/index.ts`

> `ITag { id, name }` already exists in `packages/shared/src/types/index.ts` — no new type needed.

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`

---

## Phase 2 — NoteRepository: populate tags

- [ ] **NoteRepository.ts** — add `include: { tags: { include: { tag: true } } }` to `create`, `findAll`, `findById`, `update`, and `softDelete` queries; update `toNoteResponse` mapper to map real tags instead of `[]`

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test` (existing note tests must still pass)

---

## Phase 3 — Tag layer implementation

- [ ] **TagRepository.ts** — implement `create(userId, name)` (sets `normalizedName: name.toLowerCase()`), `findAll(userId)`, `findById(id, userId)`, `deleteById(id)`, `attachTag(noteId, tagId)` (upsert NoteTag), `detachTag(noteId, tagId)` (deleteMany NoteTag); all return `ITag` or `INoteResponse` domain types
- [ ] **TagService.ts** — implement `createTag`, `listTags`, `deleteTag`, `attachTag`, `detachTag`; catch Prisma P2002 → `TAG_NAME_TAKEN`; throw `TAG_NOT_FOUND` (404) and `NOTE_NOT_FOUND` (404) via `AppError`; enforce ownership check order: note first, then tag
- [ ] **tagRoutes.ts** — implement five route handlers (`GET /`, `POST /`, `DELETE /:id`, `POST /:noteId/tags/:tagId`, `DELETE /:noteId/tags/:tagId`); apply `authMiddleware`; use `parseBody` pattern from `noteRoutes.ts` for `POST /`
- [ ] **app.ts** — mount `tagRouter` at `/api/tags` and `/api/notes`

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test`

---

## Phase 4 — Unit tests (`TagService.test.ts`)

- [ ] **AC-TAG-01:** Create tag — happy path (returns `{ id, name }` with original casing)
- [ ] **AC-TAG-01b:** Create tag — max length boundary (50 chars accepted)
- [ ] **AC-TAG-01c:** Create tag — name too long (51 chars → `VALIDATION_ERROR`, `fields: ["name"]`)
- [ ] **AC-TAG-01d:** Create tag — missing name (`VALIDATION_ERROR`, `fields: ["name"]`)
- [ ] **AC-TAG-02:** Duplicate tag — exact match (P2002 → `TAG_NAME_TAKEN` 422)
- [ ] **AC-TAG-02b:** Duplicate tag — different casing (`"Work"` when `"work"` exists → `TAG_NAME_TAKEN` 422)
- [ ] **AC-TAG-02c:** Same name, different user (allowed → 201)
- [ ] **AC-TAG-03:** List tags — returns array of 2 tags
- [ ] **AC-TAG-03b:** List tags — none exist → empty array
- [ ] **AC-TAG-04:** Delete tag — success (204; cascade verified via note tags)
- [ ] **AC-TAG-04b:** Delete another user's tag → `TAG_NOT_FOUND` 404
- [ ] **AC-TAG-05:** Attach tag to note — happy path (200; note's `tags` includes tag)
- [ ] **AC-TAG-05b:** Attach tag — already attached (idempotent → 200; no duplicate in `tags`)
- [ ] **AC-TAG-05c:** Attach tag — note is soft-deleted → `NOTE_NOT_FOUND` 404
- [ ] **AC-TAG-05d:** Attach tag — note belongs to other user → `NOTE_NOT_FOUND` 404
- [ ] **AC-TAG-06:** Detach tag from note — happy path (200; tag absent from `tags`)
- [ ] **AC-TAG-06b:** Detach tag — not attached (idempotent → 200; note unchanged)
- [ ] **AC-TAG-07:** Attach — tag belongs to other user → `TAG_NOT_FOUND` 404
- [ ] **AC-TAG-07b:** Detach — tag belongs to other user → `TAG_NOT_FOUND` 404

---

## Phase 5 — Integration tests (`tags.test.ts`)

- [ ] **AC-TAG-01:** `POST /api/tags` happy path → 201 + `{ data: { id, name } }`
- [ ] **AC-TAG-01b:** `POST /api/tags` name = 50 chars → 201
- [ ] **AC-TAG-01c:** `POST /api/tags` name = 51 chars → 400 `VALIDATION_ERROR` `fields: ["name"]`
- [ ] **AC-TAG-01d:** `POST /api/tags` missing name → 400 `VALIDATION_ERROR` `fields: ["name"]`
- [ ] **AC-TAG-02:** `POST /api/tags` exact duplicate → 422 `TAG_NAME_TAKEN`
- [ ] **AC-TAG-02b:** `POST /api/tags` case-variant duplicate → 422 `TAG_NAME_TAKEN`
- [ ] **AC-TAG-02c:** `POST /api/tags` same name, different user → 201
- [ ] **AC-TAG-03:** `GET /api/tags` → 200 array of own tags
- [ ] **AC-TAG-03b:** `GET /api/tags` no tags → 200 `{ data: [] }`
- [ ] **AC-TAG-04:** `DELETE /api/tags/:id` → 204; attached notes still exist; tag gone from their `tags` array
- [ ] **AC-TAG-04b:** `DELETE /api/tags/:id` other user's tag → 404 `TAG_NOT_FOUND`
- [ ] **AC-TAG-05:** `POST /api/notes/:id/tags/:tagId` happy path → 200 note with tag in array
- [ ] **AC-TAG-05b:** `POST /api/notes/:id/tags/:tagId` already attached → 200 no duplicate
- [ ] **AC-TAG-05c:** `POST /api/notes/:id/tags/:tagId` soft-deleted note → 404 `NOTE_NOT_FOUND`
- [ ] **AC-TAG-05d:** `POST /api/notes/:id/tags/:tagId` other user's note → 404 `NOTE_NOT_FOUND`
- [ ] **AC-TAG-06:** `DELETE /api/notes/:id/tags/:tagId` happy path → 200 note without tag
- [ ] **AC-TAG-06b:** `DELETE /api/notes/:id/tags/:tagId` tag not attached → 200 note unchanged
- [ ] **AC-TAG-07:** `POST /api/notes/:id/tags/:tagId` other user's tag → 404 `TAG_NOT_FOUND`
- [ ] **AC-TAG-07b:** `DELETE /api/notes/:id/tags/:tagId` other user's tag → 404 `TAG_NOT_FOUND`
- [ ] **AC-TAG-08:** `GET /api/tags` no auth → 401 `UNAUTHORIZED`
- [ ] **AC-TAG-08b:** `POST /api/tags` no auth → 401 `UNAUTHORIZED`
- [ ] **AC-TAG-08c:** `DELETE /api/tags/:id` no auth → 401 `UNAUTHORIZED`
- [ ] **AC-TAG-08d:** `POST /api/notes/:id/tags/:tagId` no auth → 401 `UNAUTHORIZED`
- [ ] **AC-TAG-08e:** `DELETE /api/notes/:id/tags/:tagId` no auth → 401 `UNAUTHORIZED`

**FINAL CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test` → `pnpm test --coverage` (≥80% on new code)
