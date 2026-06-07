# Plan: AB-1004 — Tags (Create, Delete, Attach, Detach)

---

## Files to Create

| Path                                                          | Purpose                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/backend/src/repositories/TagRepository.ts`              | All Prisma queries for Tag and NoteTag — create, findAll, findById (ownership check), delete; attach/detach NoteTag rows                         |
| `apps/backend/src/services/TagService.ts`                     | Business rules: duplicate-name guard (TAG_NAME_TAKEN), TAG_NOT_FOUND throws, NOTE_NOT_FOUND delegation to NoteRepository                         |
| `apps/backend/src/routes/tagRoutes.ts`                        | Route handlers for GET/POST /api/tags, DELETE /api/tags/:id, POST/DELETE /api/notes/:id/tags/:tagId — thin layer, Zod validation, authMiddleware |
| `apps/backend/src/__tests__/unit/services/TagService.test.ts` | Unit tests (mocked TagRepository + NoteRepository), one test per AC row                                                                          |
| `apps/backend/src/__tests__/integration/routes/tags.test.ts`  | Supertest integration tests against TEST_DATABASE_URL, one test per AC row                                                                       |

---

## Files to Modify

| Path                                              | What changes                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/backend/prisma/schema.prisma`               | (1) Add `normalizedName` to `Tag`; replace `@@unique([userId, name])` with `@@unique([userId, normalizedName])`; (2) Add `onDelete: Cascade` to both FK relations in `NoteTag` |
| `packages/shared/src/types/index.ts`              | Add `ITagResponse` interface                                                                                                                                                   |
| `packages/shared/src/schemas/index.ts`            | Add `createTagSchema`                                                                                                                                                          |
| `apps/backend/src/app.ts`                         | Mount `tagRouter` at `/api/tags`; mount note-tag sub-routes at `/api/notes` (or extend noteRouter — see Architecture Notes)                                                    |
| `apps/backend/src/repositories/NoteRepository.ts` | Update `toNoteResponse` mapper + all Prisma queries to `include: { tags: { include: { tag: true } } }` and map real tags instead of returning `[]`                             |

---

## Shared Package Additions

### `packages/shared/src/types/index.ts`

```typescript
export interface ITagResponse {
  id: string;
  name: string;
}
```

> `ITag` already exists and has the same shape. **Use `ITag` as-is** — no new interface needed.
> `INoteResponse` already references `tags: ITag[]` — no change required there either.

### `packages/shared/src/schemas/index.ts`

```typescript
export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
});
```

No `updateTagSchema` — renaming is out of scope.

---

## DB Migration

### Changes to `apps/backend/prisma/schema.prisma`

```prisma
model Tag {
  id             String    @id @default(cuid())
  userId         String
  name           String    @db.VarChar(50)
  normalizedName String    @db.VarChar(50)        // ← NEW
  createdAt      DateTime  @default(now())
  user           User      @relation(fields: [userId], references: [id])
  notes          NoteTag[]

  @@unique([userId, normalizedName])              // ← replaces @@unique([userId, name])
}

model NoteTag {
  noteId String
  tagId  String
  note   Note   @relation(fields: [noteId], references: [id], onDelete: Cascade)  // ← Cascade added
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)   // ← Cascade added

  @@id([noteId, tagId])
}
```

**Migration command:**

```bash
pnpm --filter backend prisma migrate dev --name add-tag-normalized-name-and-cascade
```

> **Warning:** This migration requires `[y/n]` approval per CLAUDE.md before running.

---

## TypeScript Interfaces

All interfaces already exist in `packages/shared/src/types/index.ts`. No new interfaces needed.

| Interface       | Already exists?                   | Notes                                        |
| --------------- | --------------------------------- | -------------------------------------------- |
| `ITag`          | ✅ `{ id: string; name: string }` | Used as tag shape in responses               |
| `INoteResponse` | ✅ includes `tags: ITag[]`        | NoteRepository must populate this in AB-1004 |
| `INote`         | ✅ includes `tags: ITag[]`        | Internal domain type                         |

`normalizedName` is a DB/repo-level concern — it is never in any interface or API response.

---

## Architecture Notes

### 1. Note-tag routes: separate router vs. extend noteRouter

The endpoints `POST /api/notes/:id/tags/:tagId` and `DELETE /api/notes/:id/tags/:tagId` are mounted under `/api/notes`. Two valid approaches:

**Option A (chosen): mount `tagRouter` on `/api/notes` in `app.ts` as a second router**

```typescript
// app.ts
app.use('/api/notes', noteRouter); // existing
app.use('/api/notes', tagRouter); // new — only handles /:id/tags/:tagId
```

Express merges routes from both routers on the same prefix — no conflict. `tagRouter` only defines `/:id/tags/:tagId` routes.

**Option B: add attach/detach handlers directly to `noteRoutes.ts`**

Would couple tag logic into note routes. Violates single-responsibility and makes testing harder.

→ **Option A** is cleaner.

### 2. NoteRepository tag population

Currently all NoteRepository queries return `tags: []` (stub). AB-1004 must populate tags from the `NoteTag` join table. All five queries (`create`, `findAll`, `findById`, `update`, `softDelete`-lookup) use this Prisma include:

```typescript
include: {
  tags: {
    include: { tag: true },
  },
},
```

The mapper becomes:

```typescript
function toNoteResponse(raw: NoteWithTags): INoteResponse {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    tags: raw.tags.map((nt) => ({ id: nt.tag.id, name: nt.tag.name })),
  };
}
```

`NoteWithTags` is the Prisma return type — use `Prisma.NoteGetPayload<{ include: { tags: { include: { tag: true } } } }>` or define inline as `typeof prisma.note.findFirst` result with include.

### 3. TagRepository — idempotent attach/detach

- **Attach:** use `prisma.noteTag.upsert` with `where: { noteId_tagId: { noteId, tagId } }` — create if missing, no-op if exists. Then return current note via `NoteRepository.findById`.
- **Detach:** use `prisma.noteTag.deleteMany({ where: { noteId, tagId } })` — zero-match is a no-op. Then return current note via `NoteRepository.findById`.

### 4. Ownership checks in TagService (attach/detach)

Order of checks per spec assumption #4:

1. Call `NoteRepository.findById(noteId, userId)` — throws `NOTE_NOT_FOUND` if not found, wrong user, or soft-deleted.
2. Call `TagRepository.findById(tagId, userId)` — throws `TAG_NOT_FOUND` if not found or wrong user.
3. Proceed with attach/detach.

### 5. normalizedName — repo-only concern

`TagRepository.create` sets `normalizedName: name.toLowerCase()` before the Prisma insert. No service or route code touches `normalizedName`. The unique constraint violation from Prisma (`P2002`) maps to `TAG_NAME_TAKEN` in `TagService.createTag`.

### 6. Prisma P2002 handling for duplicate tag

```typescript
import { Prisma } from '@prisma/client';
// in TagService.createTag:
try {
  return await TagRepository.create(userId, name);
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new AppError(ERROR_CODES.TAG_NAME_TAKEN, 'A tag with this name already exists.', 422);
  }
  throw e;
}
```

---

## Implementation Phases

### Phase 1 — DB migration + shared package

1. Update `prisma/schema.prisma` (add `normalizedName`, cascade)
2. Run `pnpm --filter backend prisma migrate dev` [requires y/n approval]
3. Add `createTagSchema` to `packages/shared/src/schemas/index.ts`

**Checkpoint:**

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 2 — NoteRepository tag population

Update `NoteRepository.ts`:

- Add Prisma `include` to all five query functions
- Update `toNoteResponse` mapper to map real tags instead of `[]`

**Checkpoint:**

```bash
pnpm build
pnpm lint --max-warnings 0
pnpm test  # existing note tests must still pass; tags now populated
```

---

### Phase 3 — TagRepository

Create `TagRepository.ts` with:

- `create(userId, name)` — sets `normalizedName`, returns `ITag`
- `findAll(userId)` — returns `ITag[]`
- `findById(id, userId)` — returns `ITag | null`
- `deleteById(id, userId)` — deletes tag (cascade handles NoteTag)
- `attachTag(noteId, tagId)` — upsert NoteTag; returns updated `INoteResponse` via NoteRepository
- `detachTag(noteId, tagId)` — deleteMany NoteTag; returns updated `INoteResponse` via NoteRepository

**Checkpoint:**

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 4 — TagService + tagRoutes

Create `TagService.ts` — business rules, P2002 → TAG_NAME_TAKEN, ownership guards, NOTE_NOT_FOUND/TAG_NOT_FOUND throws.

Create `tagRoutes.ts` — five route handlers, authMiddleware, `parseBody` (copy pattern from noteRoutes).

Mount in `app.ts`:

```typescript
app.use('/api/notes', tagRouter);
app.use('/api/tags', tagRouter); // Actually: separate routers — see below
```

Two separate routers needed:

- `tagRoutes.ts` exports one router for `/api/tags` routes (GET, POST, DELETE /:id)
- Attach/detach handlers on `/api/notes/:id/tags/:tagId` — can be same file, mounted on `/api/notes` in app.ts

**Checkpoint:**

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 5 — Tests

Write unit tests `TagService.test.ts` and integration tests `tags.test.ts` covering all 23 AC rows.

**Final quality gate:**

```bash
pnpm build
pnpm lint --max-warnings 0
pnpm test
pnpm test --coverage   # ≥80% on new code
```

---

## Route Mount Strategy (final)

```typescript
// app.ts additions
import tagRouter from './routes/tagRoutes.js';
import noteTagRouter from './routes/tagRoutes.js'; // same file, two mount points

app.use('/api/tags', tagRouter); // GET/POST /api/tags, DELETE /api/tags/:id
app.use('/api/notes', noteTagRouter); // POST/DELETE /api/notes/:id/tags/:tagId
```

`tagRoutes.ts` defines all five handlers. The same router instance can serve both mount points because the note-tag routes are prefixed with `/:id/tags/` and won't conflict with `/api/tags` routes.

> Simpler: export one router from `tagRoutes.ts`. Mount it at both prefixes. Express evaluates each mount independently.
