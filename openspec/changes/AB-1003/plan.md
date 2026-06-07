# Plan: AB-1003 — Notes CRUD + Soft-Delete

---

## Files to Create

| Path                                                           | Purpose                                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/backend/src/repositories/NoteRepository.ts`              | All Prisma queries for notes; maps raw rows to `INote` domain type                      |
| `apps/backend/src/services/NoteService.ts`                     | Business rules for create/list/read/update/soft-delete; throws `AppError` on violations |
| `apps/backend/src/routes/noteRoutes.ts`                        | Express route handlers for 5 note endpoints; Zod validation; calls NoteService          |
| `apps/backend/src/__tests__/unit/services/NoteService.test.ts` | Unit tests with mocked NoteRepository; one test per AC row                              |
| `apps/backend/src/__tests__/integration/routes/notes.test.ts`  | Supertest integration tests against real test DB; one test per AC row                   |

---

## Files to Modify

| Path                                   | Change                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `apps/backend/src/app.ts`              | Import `noteRouter`; add `app.use('/api/notes', noteRouter)` before `errorHandler` |
| `packages/shared/src/schemas/index.ts` | Add `createNoteSchema` and `updateNoteSchema`                                      |

---

## Shared Package Additions

**No new types needed** — `INote`, `ITag`, `NOTE_NOT_FOUND` already exist.

### New schemas in `packages/shared/src/schemas/index.ts`

```typescript
export const createNoteSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().nullable().optional(),
});

export const updateNoteSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    content: z.string().nullable().optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'At least one field must be provided',
  });
```

> `updateNoteSchema` uses `.refine()` — the route detects a non-field-level Zod error and throws
> `AppError(VALIDATION_ERROR, 'At least one field must be provided', 400)` with **no** `fields` array.

---

## DB Migration

`Note`, `Tag`, and `NoteTag` models are **already in `schema.prisma`** (scaffolded in AB-1001). Tables must be created via migration:

```bash
pnpm --filter backend prisma migrate dev --name add-notes-tags
```

Run against both dev and test databases before tests.

---

## TypeScript Interfaces

All already in `packages/shared/src/types/index.ts`. No additions needed.

```typescript
// Already exists — shown for reference only
interface INote {
  id: string;
  userId: string; // present internally; excluded from response mapper
  title: string;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: ITag[]; // always [] in AB-1003
}

interface ITag {
  id: string;
  name: string;
}
```

> `userId` is on `INote` but is **not** sent in API responses. The route returns the full `INote`
> object from the service; the response contract omits `userId` implicitly since the SDS Note
> object shape does not include it. Two options: (a) keep `INote` as-is and rely on callers not
> serializing `userId`, or (b) define a separate `INoteResponse` without `userId`. **Choose (a)**:
> the route wraps in `{ data: note }` and JSON.stringify includes `userId`. **Correction — choose
> (b)**: add `INoteResponse` without `userId` to avoid leaking the field.

### Revised shared types addition

Add to `packages/shared/src/types/index.ts`:

```typescript
export interface INoteResponse {
  id: string;
  title: string;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: ITag[];
}
```

`NoteRepository` returns `INote` internally (service needs `userId` for ownership checks).
`NoteService` returns `INoteResponse` to routes (strips `userId`).

---

## Architecture Notes

### Layer responsibilities

```
noteRoutes.ts
  → parseBody(createNoteSchema / updateNoteSchema, req.body)
  → calls NoteService.*
  → res.status(N).json({ data: result }) or res.status(204).send()

NoteService.ts
  → ownership/existence checks via NoteRepository
  → throws AppError on NOTE_NOT_FOUND, VALIDATION_ERROR (empty patch body)
  → returns INoteResponse (userId stripped)

NoteRepository.ts
  → all prisma.note.* queries
  → every query includes: where: { ..., deletedAt: null }  ← enforced at repo layer
  → toNoteResponse() mapper: picks id/title/content/createdAt/updatedAt, tags: []
```

### parseBody helper

`authRoutes.ts` defines `parseBody` locally. Replicate the same local helper in `noteRoutes.ts`
(same pattern — premature extraction would be over-engineering at this stage).

Empty-body PATCH special case in parseBody:

```typescript
function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    // refine() errors have no path — treat as body-level, no fields array
    const fields = result.error.issues
      .map((i) => String(i.path[0]))
      .filter((f) => f !== 'undefined' && f !== '');
    if (fields.length > 0) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Validation failed.', 400, fields);
    }
    // body-level refine failure (e.g. empty PATCH body)
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      result.error.issues[0]?.message ?? 'Validation failed.',
      400,
    );
  }
  return result.data;
}
```

### Soft-delete lookup pattern

All NoteRepository queries use `userId + deletedAt: null`:

```typescript
// findById — used by read, update, delete
await prisma.note.findFirst({
  where: { id, userId, deletedAt: null },
});

// list
await prisma.note.findMany({
  where: { userId, deletedAt: null },
});
```

Note ownership + soft-delete check are combined in a single DB query — no extra round trip.

### tags: [] in AB-1003

`toNoteResponse` mapper always returns `tags: []`. AB-1004 will replace this with a real join.

### NoteService owns the 404 decision

`NoteRepository.findById(id, userId)` returns `null` for: not found, wrong owner, soft-deleted.
`NoteService` converts `null` → `throw new AppError(NOTE_NOT_FOUND, ..., 404)`.
Routes never check ownership directly.

---

## Implementation Phases

### Phase 1 — Shared schemas + INoteResponse interface

Files: `packages/shared/src/schemas/index.ts`, `packages/shared/src/types/index.ts`

Checkpoint:

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 2 — DB Migration

```bash
pnpm --filter backend prisma migrate dev --name add-notes-tags
```

Verify tables exist in dev DB. Confirm `pnpm build` still 0 errors.

---

### Phase 3 — NoteRepository

File: `apps/backend/src/repositories/NoteRepository.ts`

Methods:

- `create(userId, title, content)` → `INoteResponse`
- `findAll(userId)` → `INoteResponse[]`
- `findById(id, userId)` → `INoteResponse | null` _(null = missing, wrong owner, or deleted)_
- `update(id, userId, data)` → `INoteResponse | null`
- `softDelete(id, userId)` → `boolean` _(false = not found)_

Checkpoint:

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 4 — NoteService

File: `apps/backend/src/services/NoteService.ts`

Methods:

- `createNote(userId, title, content?)` → `INoteResponse`
- `listNotes(userId)` → `INoteResponse[]`
- `getNote(id, userId)` → `INoteResponse`
- `updateNote(id, userId, data)` → `INoteResponse`
- `deleteNote(id, userId)` → `void`

Checkpoint:

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 5 — noteRoutes + register in app.ts

Files: `apps/backend/src/routes/noteRoutes.ts`, `apps/backend/src/app.ts`

Route table:
| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/` | `NoteService.createNote` → 201 |
| `GET` | `/` | `NoteService.listNotes` → 200 |
| `GET` | `/:id` | `NoteService.getNote` → 200 |
| `PATCH` | `/:id` | `NoteService.updateNote` → 200 |
| `DELETE` | `/:id` | `NoteService.deleteNote` → 204 |

All routes use `authMiddleware`. Route reads `res.locals['userId']` (typed as `string`).

Checkpoint:

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 6 — Unit tests

File: `apps/backend/src/__tests__/unit/services/NoteService.test.ts`

Mock: `vi.mock('../../../repositories/NoteRepository.js', () => ({ ... }))`

Covers all 23 AC scenarios at the service layer.

Checkpoint:

```bash
pnpm test
pnpm test --coverage
```

---

### Phase 7 — Integration tests

File: `apps/backend/src/__tests__/integration/routes/notes.test.ts`

Uses `registerAndLogin()` helper (same pattern as `auth.test.ts`).
`beforeEach` deletes: `noteTag → note → tag → refreshToken → user` (FK order).

Covers all 23 AC scenarios end-to-end via Supertest.

Checkpoint:

```bash
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm test --coverage
```
