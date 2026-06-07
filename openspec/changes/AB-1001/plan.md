# Plan: AB-1001 — Project Setup

---

## Files to Create

### Root

| Path            | Purpose                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| `tsconfig.json` | Root TypeScript config; composite project references to shared, backend, frontend            |
| `.env.example`  | Documents required env vars (`DATABASE_URL`, `JWT_SECRET`); never committed with real values |

### packages/shared

| Path                                   | Purpose                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/shared/package.json`         | Declares `@noteapp/shared`; exports `./src/index.ts`; marks as private workspace package |
| `packages/shared/tsconfig.json`        | Strict TS config; composite: true; outDir: dist                                          |
| `packages/shared/src/index.ts`         | Root barrel: re-exports from errors, types, schemas                                      |
| `packages/shared/src/errors.ts`        | All 10 error code constants (SCREAMING_SNAKE_CASE) from SDS §6                           |
| `packages/shared/src/types/index.ts`   | Domain interface barrel: IUser, INote, ITag, IApiResponse, IApiErrorResponse             |
| `packages/shared/src/schemas/index.ts` | Zod schema barrel — empty export for now; populated in AB-1002+                          |
| `packages/shared/CLAUDE.md`            | Package rule: types/schemas/errors only; always import from @noteapp/shared              |

### apps/backend

| Path                                     | Purpose                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/backend/package.json`              | Backend deps: express, prisma, @prisma/client, zod, jsonwebtoken, bcrypt + dev: typescript, vitest, supertest |
| `apps/backend/tsconfig.json`             | Strict TS; references packages/shared; paths: @noteapp/shared                                                 |
| `apps/backend/src/index.ts`              | Minimal Express 5 app entry — creates app, registers placeholder router, listens on PORT                      |
| `apps/backend/src/routes/.gitkeep`       | Holds routes dir in git                                                                                       |
| `apps/backend/src/services/.gitkeep`     | Holds services dir in git                                                                                     |
| `apps/backend/src/repositories/.gitkeep` | Holds repositories dir in git                                                                                 |
| `apps/backend/src/middleware/.gitkeep`   | Holds middleware dir in git                                                                                   |
| `apps/backend/src/utils/.gitkeep`        | Holds utils dir in git                                                                                        |
| `apps/backend/CLAUDE.md`                 | Backend rules: 3-layer architecture, no Prisma in services, no any, error shape contract                      |

### apps/frontend

| Path                                    | Purpose                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/frontend/package.json`            | Frontend deps: react, react-dom, @tanstack/react-query, zustand, shadcn/ui, tailwind; dev: vite, typescript |
| `apps/frontend/tsconfig.json`           | Strict TS; references shared; DOM lib; jsx: react-jsx                                                       |
| `apps/frontend/tsconfig.node.json`      | TS config for vite.config.ts (Node environment)                                                             |
| `apps/frontend/vite.config.ts`          | Vite 5 config; react plugin; proxy /api → backend port                                                      |
| `apps/frontend/index.html`              | Vite entry HTML; mounts #root                                                                               |
| `apps/frontend/src/main.tsx`            | React 19 app entry; wraps App in QueryClientProvider                                                        |
| `apps/frontend/src/App.tsx`             | Skeleton App component — placeholder only                                                                   |
| `apps/frontend/src/components/.gitkeep` | Holds components dir                                                                                        |
| `apps/frontend/src/pages/.gitkeep`      | Holds pages dir                                                                                             |
| `apps/frontend/src/hooks/.gitkeep`      | Holds hooks dir                                                                                             |
| `apps/frontend/src/stores/.gitkeep`     | Holds stores dir                                                                                            |
| `apps/frontend/src/lib/.gitkeep`        | Holds lib dir                                                                                               |
| `apps/frontend/CLAUDE.md`               | Frontend rules: TanStack Query for server state, Zustand for auth, no direct fetch calls outside lib/       |

### apps/backend/prisma

| Path                                | Purpose                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma` | Full Prisma schema — exact copy of SDS §4.1 (5 models, all indexes/constraints) |

---

## Files to Modify

| Path                  | Change                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `package.json` (root) | Add scripts: `"dev"`, `"build"`, `"test"` that delegate to workspace packages via `pnpm -r` |
| `pnpm-workspace.yaml` | Already correct (`apps/*`, `packages/*`) — no change needed                                 |
| `eslint.config.js`    | Already complete — verify `pnpm lint` passes after scaffold; no edits expected              |

---

## Shared Package Additions

### `packages/shared/src/errors.ts`

```typescript
export const ERROR_CODES = {
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  REFRESH_EXPIRED: 'REFRESH_EXPIRED',
  REFRESH_INVALID: 'REFRESH_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
  TAG_NOT_FOUND: 'TAG_NOT_FOUND',
  TAG_NAME_TAKEN: 'TAG_NAME_TAKEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

### `packages/shared/src/types/index.ts`

```typescript
export interface IUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITag {
  id: string;
  name: string;
}

export interface INote {
  id: string;
  userId: string;
  title: string;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: ITag[];
}

export interface IApiError {
  code: string;
  message: string;
  fields?: string[];
}

export interface IApiResponse<T> {
  data: T;
}

export interface IApiErrorResponse {
  error: IApiError;
}
```

---

## DB Migration

**Schema:** `apps/backend/prisma/schema.prisma` — exact SDS §4.1 definition, reproduced in full below for implementer reference.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  notes         Note[]
  tags          Tag[]
  refreshTokens RefreshToken[]
}

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

model Tag {
  id        String    @id @default(cuid())
  userId    String
  name      String    @db.VarChar(50)
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id])
  notes     NoteTag[]

  @@unique([userId, name])
}

model NoteTag {
  noteId String
  tagId  String
  note   Note   @relation(fields: [noteId], references: [id])
  tag    Tag    @relation(fields: [tagId], references: [id])

  @@id([noteId, tagId])
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

**Migration command** (run from `apps/backend/`):

```bash
pnpm prisma migrate dev --name init
pnpm prisma generate
```

Prereq: `DATABASE_URL` must be set in `.env` (gitignored) before running.

---

## TypeScript Interfaces

Defined in `packages/shared/src/types/index.ts` — see Shared Package Additions above.

**Design decisions:**

- `ITag` is minimal (`id`, `name`) — `userId` deliberately excluded from the response shape; consumers never need it
- `INote.tags` is `ITag[]` not `string[]` — matches the note object shape in SDS §5.4
- `IApiResponse<T>` is generic — covers both single-resource `{ data: INote }` and list `{ data: INote[] }` with one type
- `ErrorCode` is a union type derived from `ERROR_CODES` — downstream code imports the type to avoid string literals in error construction
- No `IRefreshToken` or `INoteTag` exported — internal DB models, never returned to clients

---

## Architecture Notes

1. **Build order matters.** `packages/shared` must compile before backend and frontend. Root `tsconfig.json` project references enforce this via `pnpm build` running `tsc --build`.

2. **ESLint `parserOptions.projectService: true`** in the existing `eslint.config.js` requires each TS file to be covered by a `tsconfig.json`. Every package needs its own `tsconfig.json` in scope, or lint will error on those files.

3. **`"type": "module"` at root.** Root `package.json` already has `"type": "module"`. All sub-packages must use ESM (`import`/`export`) — no `require()`. Backend `tsconfig.json` must target `NodeNext` module resolution.

4. **`@noteapp/shared` resolution.** In backend and frontend `package.json`, declare `"@noteapp/shared": "workspace:*"` as a dependency. This lets pnpm link the package via workspace; TypeScript resolves it through project references. No path aliases needed.

5. **Prisma client output location.** Default output (`node_modules/@prisma/client`) is fine for this project. No custom output path.

6. **No barrel re-export of Prisma types** from shared. Prisma types stay in `apps/backend` only — importing `@prisma/client` from `packages/shared` would create a circular workspace dependency.

7. **`.gitkeep` files for empty dirs.** Git does not track empty directories. Use `.gitkeep` so the SDS §2 folder structure is preserved in the repo before implementation code is added.

---

## Phase Checkpoints

### Phase A — Shared package

Create: `packages/shared/package.json`, `tsconfig.json`, `src/index.ts`, `src/errors.ts`, `src/types/index.ts`, `src/schemas/index.ts`, `packages/shared/CLAUDE.md`

```bash
pnpm --filter @noteapp/shared build
# Expected: 0 errors
```

---

### Phase B — Backend scaffold

Create: `apps/backend/package.json`, `tsconfig.json`, `src/index.ts`, all `.gitkeep` files, `apps/backend/CLAUDE.md`

```bash
pnpm --filter backend install
pnpm --filter backend build
# Expected: 0 errors; @noteapp/shared resolves
```

---

### Phase C — Frontend scaffold

Create: `apps/frontend/package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, all `.gitkeep` files, `apps/frontend/CLAUDE.md`

```bash
pnpm --filter frontend install
pnpm --filter frontend build
# Expected: 0 errors; vite build succeeds
```

---

### Phase D — Root wiring

Modify: root `package.json` (add build/dev/test scripts), create root `tsconfig.json`

```bash
pnpm install         # all workspaces
pnpm build           # builds shared → backend → frontend in dependency order
# Expected: 0 errors across all packages
```

---

### Phase E — Prisma schema + migration

Create: `apps/backend/prisma/schema.prisma`, `.env.example`

```bash
# (Requires DATABASE_URL in apps/backend/.env — user provides)
pnpm --filter backend prisma validate
pnpm --filter backend prisma migrate dev --name init
pnpm --filter backend prisma generate
# Expected: migration file created; Prisma Client generated; no schema errors
```

---

### Phase F — Full quality gate

```bash
pnpm build                    # SS-002: 0 errors, 0 warnings
pnpm lint --max-warnings 0    # SS-003: 0 warnings
pnpm format:check             # SS-012: no unformatted files
```

All three must pass before ticket is closed.
