# Spec: AB-1004 — Tags (Create, Delete, Attach, Detach)

## Summary

Implement tag management for authenticated users: create and delete personal tags, attach and detach them from owned notes, with case-insensitive uniqueness enforcement and Prisma-level cascade delete.

---

## FRS References

- **FR-TAGS-001** — Tag Management (create, delete, attach to note, detach from note)

---

## Scope

### In Scope

- `GET /api/tags` — list own tags
- `POST /api/tags` — create tag (store original casing; unique by `normalizedName` per user)
- `DELETE /api/tags/:id` — delete tag; cascade-removes all `NoteTag` rows via Prisma `onDelete: Cascade`
- `POST /api/notes/:id/tags/:tagId` — attach tag to note (idempotent)
- `DELETE /api/notes/:id/tags/:tagId` — detach tag from note (idempotent)
- `Tag` model migration: add `normalizedName` field + updated unique index
- `NoteTag` model migration: add `onDelete: Cascade` to both FK relations
- `ITagResponse` interface + `createTagSchema` in `packages/shared`
- Unit tests (mocked repo) + integration tests (Supertest + real test DB)

### Out of Scope

- Tag search or filtering
- Renaming tags (PATCH /api/tags/:id)
- Pagination or sorting
- Frontend implementation
- Notes CRUD (AB-1003)

---

## Spec Scenarios

| ID         | Scenario                                   | Given                                                   | When                                  | Then                                                                             |
| ---------- | ------------------------------------------ | ------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| AC-TAG-01  | Create tag — happy path                    | Authenticated user, unique name                         | `POST /api/tags`                      | 201; `data: { id, name }` with original casing                                   |
| AC-TAG-01b | Create tag — max length boundary           | Name is exactly 50 chars                                | `POST /api/tags`                      | 201; tag created                                                                 |
| AC-TAG-01c | Create tag — name too long                 | Name is 51 chars                                        | `POST /api/tags`                      | 400; `code: VALIDATION_ERROR`; `fields: ["name"]`                                |
| AC-TAG-01d | Create tag — missing name                  | Body has no `name` field                                | `POST /api/tags`                      | 400; `code: VALIDATION_ERROR`; `fields: ["name"]`                                |
| AC-TAG-02  | Duplicate tag — exact match                | `"work"` already exists for this user                   | `POST /api/tags` with `"work"`        | 422; `code: TAG_NAME_TAKEN`                                                      |
| AC-TAG-02b | Duplicate tag — different casing           | `"work"` already exists for this user                   | `POST /api/tags` with `"Work"`        | 422; `code: TAG_NAME_TAKEN`                                                      |
| AC-TAG-02c | Same name, different user                  | `"work"` exists for user A                              | User B `POST /api/tags` with `"work"` | 201; allowed — uniqueness is per-user                                            |
| AC-TAG-03  | List own tags                              | User has 2 tags                                         | `GET /api/tags`                       | 200; `data` array of 2 tag objects                                               |
| AC-TAG-03b | List tags — none exist                     | User has no tags                                        | `GET /api/tags`                       | 200; `data: []`                                                                  |
| AC-TAG-04  | Delete own tag — cascade detach            | Own tag attached to 2 notes                             | `DELETE /api/tags/:id`                | 204; `NoteTag` rows removed; notes still exist with tag absent from their arrays |
| AC-TAG-04b | Delete another user's tag                  | Tag owned by a different user                           | `DELETE /api/tags/:id`                | 404; `code: TAG_NOT_FOUND`                                                       |
| AC-TAG-05  | Attach tag to note — happy path            | Own tag + own non-deleted note, tag not yet attached    | `POST /api/notes/:id/tags/:tagId`     | 200; full note object; `tags` array includes the tag                             |
| AC-TAG-05b | Attach tag — already attached (idempotent) | Own tag already attached to own note                    | `POST /api/notes/:id/tags/:tagId`     | 200; full note object; no duplicate in `tags` array                              |
| AC-TAG-05c | Attach tag — note is soft-deleted          | Note has `deletedAt` set                                | `POST /api/notes/:id/tags/:tagId`     | 404; `code: NOTE_NOT_FOUND`                                                      |
| AC-TAG-05d | Attach tag — note belongs to other user    | Note owned by different user                            | `POST /api/notes/:id/tags/:tagId`     | 404; `code: NOTE_NOT_FOUND`                                                      |
| AC-TAG-06  | Detach tag from note — happy path          | Own tag currently attached to own note                  | `DELETE /api/notes/:id/tags/:tagId`   | 200; full note object; `tags` array no longer includes the tag                   |
| AC-TAG-06b | Detach tag — not attached (idempotent)     | Own tag NOT attached to own note                        | `DELETE /api/notes/:id/tags/:tagId`   | 200; full note object; `tags` array unchanged                                    |
| AC-TAG-07  | Attach — tag belongs to other user         | Tag owned by different user, note owned by current user | `POST /api/notes/:id/tags/:tagId`     | 404; `code: TAG_NOT_FOUND`                                                       |
| AC-TAG-07b | Detach — tag belongs to other user         | Tag owned by different user, note owned by current user | `DELETE /api/notes/:id/tags/:tagId`   | 404; `code: TAG_NOT_FOUND`                                                       |
| AC-TAG-08  | Unauthenticated — list tags                | No `Authorization` header                               | `GET /api/tags`                       | 401; `code: UNAUTHORIZED`                                                        |
| AC-TAG-08b | Unauthenticated — create tag               | No `Authorization` header                               | `POST /api/tags`                      | 401; `code: UNAUTHORIZED`                                                        |
| AC-TAG-08c | Unauthenticated — delete tag               | No `Authorization` header                               | `DELETE /api/tags/:id`                | 401; `code: UNAUTHORIZED`                                                        |
| AC-TAG-08d | Unauthenticated — attach tag               | No `Authorization` header                               | `POST /api/notes/:id/tags/:tagId`     | 401; `code: UNAUTHORIZED`                                                        |
| AC-TAG-08e | Unauthenticated — detach tag               | No `Authorization` header                               | `DELETE /api/notes/:id/tags/:tagId`   | 401; `code: UNAUTHORIZED`                                                        |

---

## API Delta

### New Endpoints

#### `GET /api/tags`

**Auth:** Required

**Response 200:**

```json
{
  "data": [
    { "id": "tagid1", "name": "Work" },
    { "id": "tagid2", "name": "personal" }
  ]
}
```

Returns only tags owned by the authenticated user. Empty array if none.

**Errors:**

- 401 `UNAUTHORIZED`

---

#### `POST /api/tags`

**Auth:** Required

**Request:**

```json
{ "name": "Work" }
```

- `name` — required, string, 1–50 chars

**Response 201:**

```json
{
  "data": { "id": "tagid1", "name": "Work" }
}
```

Name stored with original casing. Uniqueness enforced against `normalizedName` (lowercase).

**Errors:**

- 400 `VALIDATION_ERROR` + `fields: ["name"]` — missing or exceeds 50 chars
- 401 `UNAUTHORIZED`
- 422 `TAG_NAME_TAKEN` — case-insensitive duplicate for this user

---

#### `DELETE /api/tags/:id`

**Auth:** Required

**Response:** 204 No Content (no body)

All `NoteTag` rows referencing this tag are removed by Prisma cascade (`onDelete: Cascade`). Notes themselves are not affected.

**Errors:**

- 401 `UNAUTHORIZED`
- 404 `TAG_NOT_FOUND` — not found or belongs to another user

---

#### `POST /api/notes/:id/tags/:tagId`

**Auth:** Required

**Response 200:** Full note object with updated `tags` array.

```json
{
  "data": {
    "id": "noteid1",
    "title": "My Note",
    "content": "Some text.",
    "createdAt": "2025-06-01T10:00:00Z",
    "updatedAt": "2025-06-01T10:00:00Z",
    "tags": [{ "id": "tagid1", "name": "Work" }]
  }
}
```

Idempotent: if tag already attached, returns 200 with current note state, no duplicate created.

**Errors:**

- 401 `UNAUTHORIZED`
- 404 `NOTE_NOT_FOUND` — note not found, belongs to another user, or soft-deleted
- 404 `TAG_NOT_FOUND` — tag not found or belongs to another user

---

#### `DELETE /api/notes/:id/tags/:tagId`

**Auth:** Required

**Response 200:** Full note object with updated `tags` array (tag absent).

Idempotent: if tag not attached, returns 200 with current note state unchanged.

**Errors:**

- 401 `UNAUTHORIZED`
- 404 `NOTE_NOT_FOUND` — note not found, belongs to another user, or soft-deleted
- 404 `TAG_NOT_FOUND` — tag not found or belongs to another user

---

## DB Changes

### `Tag` model — modified

Replace `@@unique([userId, name])` with `normalizedName` field + `@@unique([userId, normalizedName])`:

```prisma
model Tag {
  id             String    @id @default(cuid())
  userId         String
  name           String    @db.VarChar(50)
  normalizedName String    @db.VarChar(50)
  createdAt      DateTime  @default(now())
  user           User      @relation(fields: [userId], references: [id])
  notes          NoteTag[]

  @@unique([userId, normalizedName])
}
```

`normalizedName` is set in the repository as `name.toLowerCase()` before insert. Never exposed in API responses.

### `NoteTag` model — modified

Add `onDelete: Cascade` to both FK relations:

```prisma
model NoteTag {
  noteId String
  tagId  String
  note   Note   @relation(fields: [noteId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([noteId, tagId])
}
```

**Migration command:** `pnpm --filter backend prisma migrate dev`

---

## Assumptions

1. `normalizedName` is set to `name.toLowerCase()` in `TagRepository.create` — never in service or route. Never returned in API responses.
2. Duplicate-attach (AC-TAG-05b) is handled via `upsert` or existence check in `NoteTagRepository` — no DB unique violation surfaces to the caller.
3. Idempotent detach (AC-TAG-06b) succeeds silently: if `NoteTag` row does not exist, `deleteMany` with zero matches is a no-op; service returns current note state.
4. Both note and tag ownership are verified before attach/detach — note check first, then tag check. Both use `deletedAt: null` guard on note lookup.
5. Attach/detach endpoints return the full note object (same shape as `GET /api/notes/:id`) including current `tags` array — requires a join/include in `NoteRepository.findById`.
6. `ITagResponse` (`{ id: string; name: string }`) and `createTagSchema` live in `packages/shared`. `normalizedName` is NOT included in `ITagResponse`.
7. `TAG_NOT_FOUND` (404) is the correct error when tag belongs to another user — consistent with not revealing resource existence across users.
8. `onDelete: Cascade` on `NoteTag.noteId` also means soft-deleting a note does NOT remove `NoteTag` rows (soft-delete only sets `deletedAt`, no DB cascade fires). This is correct — if a note is restored in future, its tags remain intact.
