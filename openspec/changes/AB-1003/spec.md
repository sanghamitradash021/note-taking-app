# Spec: AB-1003 — Notes CRUD + Soft-Delete

## Summary

Implement full CRUD for authenticated users' notes with soft-delete semantics across five endpoints.

---

## FRS References

- **FR-NOTES-001** — Notes CRUD (create, read, update, soft-delete)

---

## Scope

### In Scope

- `POST /api/notes` — create note
- `GET /api/notes` — list own non-deleted notes
- `GET /api/notes/:id` — fetch single own non-deleted note
- `PATCH /api/notes/:id` — update title and/or content
- `DELETE /api/notes/:id` — soft-delete (set `deletedAt`, row stays in DB)
- Note object always includes `tags: []` (empty array; tag population is AB-1004)
- `NoteRepository`, `NoteService`, notes route handler
- Zod schemas + TypeScript interfaces in `packages/shared`
- Unit tests (mocked repo) + integration tests (Supertest + real test DB)

### Out of Scope

- Tag creation, attachment, or detachment (AB-1004)
- Pagination, sorting, filtering
- Full-text search
- Physical row deletion
- Frontend implementation

---

## Spec Scenarios

| ID           | Scenario                              | Given                                            | When                    | Then                                                                                          |
| ------------ | ------------------------------------- | ------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------- |
| AC-NOTES-01  | Create note — happy path              | Authenticated user, valid title                  | `POST /api/notes`       | 201; full note object in `data`; `tags: []`                                                   |
| AC-NOTES-01b | Create note — optional content absent | Authenticated user, title only, no content field | `POST /api/notes`       | 201; `content` is `null` or absent; `tags: []`                                                |
| AC-NOTES-02  | Create without title                  | Authenticated user, body missing title           | `POST /api/notes`       | 400; `code: VALIDATION_ERROR`; `fields: ["title"]`                                            |
| AC-NOTES-02b | Create — title too long               | Authenticated user, title is 256 chars           | `POST /api/notes`       | 400; `code: VALIDATION_ERROR`; `fields: ["title"]`                                            |
| AC-NOTES-02c | Create — title at max boundary        | Authenticated user, title is 255 chars           | `POST /api/notes`       | 201; note created successfully                                                                |
| AC-NOTES-03  | List own notes                        | Authenticated user with 3 non-deleted notes      | `GET /api/notes`        | 200; `data` array of 3 note objects                                                           |
| AC-NOTES-04  | Read own note                         | Note owned by current user, not deleted          | `GET /api/notes/:id`    | 200; full note object in `data`                                                               |
| AC-NOTES-05  | Read another user's note              | Note owned by a different user                   | `GET /api/notes/:id`    | 404; `code: NOTE_NOT_FOUND`                                                                   |
| AC-NOTES-05b | Read own soft-deleted note            | Note owned by current user, `deletedAt` is set   | `GET /api/notes/:id`    | 404; `code: NOTE_NOT_FOUND`                                                                   |
| AC-NOTES-06  | Update note — happy path              | Own note, body has new title                     | `PATCH /api/notes/:id`  | 200; updated note in `data`; `updatedAt` refreshed                                            |
| AC-NOTES-06b | Update note — content only            | Own note, body has new content only              | `PATCH /api/notes/:id`  | 200; updated note in `data`                                                                   |
| AC-NOTES-06c | Update note — empty string content    | Own note, `content: ""`                          | `PATCH /api/notes/:id`  | 200; `content` stored as empty string                                                         |
| AC-NOTES-06d | Update note — null content            | Own note, `content: null`                        | `PATCH /api/notes/:id`  | 200; `content` stored as null                                                                 |
| AC-NOTES-06e | Update note — empty body              | Own note, body is `{}`                           | `PATCH /api/notes/:id`  | 400; `code: VALIDATION_ERROR`; message "At least one field must be provided"; no fields array |
| AC-NOTES-06f | Update another user's note            | Note owned by different user                     | `PATCH /api/notes/:id`  | 404; `code: NOTE_NOT_FOUND`                                                                   |
| AC-NOTES-07  | Soft-delete own note                  | Own note, not already deleted                    | `DELETE /api/notes/:id` | 204; `deletedAt` set in DB; row still exists; no response body                                |
| AC-NOTES-07b | Delete another user's note            | Note owned by different user                     | `DELETE /api/notes/:id` | 404; `code: NOTE_NOT_FOUND`                                                                   |
| AC-NOTES-08  | Deleted note excluded from list       | User has 3 notes, 1 has `deletedAt` set          | `GET /api/notes`        | 200; array contains 2 notes only                                                              |
| AC-NOTES-09  | Unauthenticated — create              | No `Authorization` header                        | `POST /api/notes`       | 401; `code: UNAUTHORIZED`                                                                     |
| AC-NOTES-09b | Unauthenticated — list                | No `Authorization` header                        | `GET /api/notes`        | 401; `code: UNAUTHORIZED`                                                                     |
| AC-NOTES-09c | Unauthenticated — read                | No `Authorization` header                        | `GET /api/notes/:id`    | 401; `code: UNAUTHORIZED`                                                                     |
| AC-NOTES-09d | Unauthenticated — update              | No `Authorization` header                        | `PATCH /api/notes/:id`  | 401; `code: UNAUTHORIZED`                                                                     |
| AC-NOTES-09e | Unauthenticated — delete              | No `Authorization` header                        | `DELETE /api/notes/:id` | 401; `code: UNAUTHORIZED`                                                                     |

---

## API Delta

### New Endpoints

#### `POST /api/notes`

**Auth:** Required

**Request:**

```json
{ "title": "My Note", "content": "Optional body text." }
```

- `title` — required, string, 1–255 chars
- `content` — optional; string, null, or omitted

**Response 201:**

```json
{
  "data": {
    "id": "cluid123",
    "title": "My Note",
    "content": "Optional body text.",
    "createdAt": "2025-06-01T10:00:00Z",
    "updatedAt": "2025-06-01T10:00:00Z",
    "tags": []
  }
}
```

**Errors:**

- 400 `VALIDATION_ERROR` + `fields: ["title"]` — missing or invalid title
- 401 `UNAUTHORIZED` — no/invalid token

---

#### `GET /api/notes`

**Auth:** Required

**Response 200:**

```json
{
  "data": [
    {
      "id": "cluid123",
      "title": "My Note",
      "content": null,
      "createdAt": "2025-06-01T10:00:00Z",
      "updatedAt": "2025-06-01T10:00:00Z",
      "tags": []
    }
  ]
}
```

Only non-deleted notes (`deletedAt IS NULL`) for the authenticated user.

**Errors:**

- 401 `UNAUTHORIZED`

---

#### `GET /api/notes/:id`

**Auth:** Required

**Response 200:** Single note object (same shape as above).

**Errors:**

- 401 `UNAUTHORIZED`
- 404 `NOTE_NOT_FOUND` — not found, belongs to another user, or soft-deleted

---

#### `PATCH /api/notes/:id`

**Auth:** Required

**Request:**

```json
{ "title": "Updated Title", "content": "Updated body." }
```

Both fields optional — **at least one must be present**.

**Response 200:** Updated note object (same shape, `updatedAt` refreshed).

**Errors:**

- 400 `VALIDATION_ERROR` — empty body `{}`; no `fields` array
- 401 `UNAUTHORIZED`
- 404 `NOTE_NOT_FOUND`

---

#### `DELETE /api/notes/:id`

**Auth:** Required

**Response:** 204 No Content (no body).

Sets `deletedAt` to current timestamp. Row is NOT removed from DB.

**Errors:**

- 401 `UNAUTHORIZED`
- 404 `NOTE_NOT_FOUND`

---

## DB Changes

`Note` model is new — requires a migration.

```prisma
model Note {
  id        String    @id @default(cuid())
  userId    String
  title     String    @db.VarChar(255)
  content   String?   @db.Text
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  user      User      @relation(fields: [userId], references: [id])
  tags      NoteTag[]

  @@index([userId, deletedAt])
}
```

`NoteTag` join table also required (used in AB-1004, but Note relation references it):

```prisma
model NoteTag {
  noteId String
  tagId  String
  note   Note   @relation(fields: [noteId], references: [id])
  tag    Tag    @relation(fields: [tagId], references: [id])

  @@id([noteId, tagId])
}
```

`Tag` model also required for the relation — but tag business logic is AB-1004.

**Migration command:** `pnpm --filter backend prisma migrate dev`

---

## Assumptions

1. `PATCH {}` (empty body) is a business-rule violation, not a field-level Zod error — `VALIDATION_ERROR` 400 with no `fields` array, message: `"At least one field must be provided"`.
2. `tags: []` always present on note responses in AB-1003; tag population wired in AB-1004.
3. Any note with `deletedAt` set returns 404 for all fetch/update/delete operations, regardless of ownership — consistent with FRS "MUST NOT appear in fetch responses."
4. `content` accepts string, null, or omitted — all valid. Zod schema: `z.string().nullable().optional()`.
5. Repository always appends `deletedAt: null` filter to all note queries (list, findById, update, delete lookup).
6. `NoteTag` and `Tag` models must exist in schema for Prisma relations to compile, even though tag business logic ships in AB-1004.
7. `INoteResponse` interface and `createNoteSchema` / `updateNoteSchema` live in `packages/shared`.
