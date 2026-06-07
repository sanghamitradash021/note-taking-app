# AGENTS.md

Read this first. Every session. No exceptions.

---

## 1. Project Overview

Web-based note-taking app where authenticated users create, organise, and manage personal notes with optional tags. Built as a spec-driven development tutorial; every ticket traces to FRS-NoteApp and SDS-NoteApp.

---

## 2. Repository Structure

```
noteapp/
├── apps/
│   ├── frontend/          Vite + React 19 SPA
│   │   └── src/
│   │       ├── components/  reusable UI components
│   │       ├── pages/       route-level page components
│   │       ├── hooks/       TanStack Query hooks
│   │       ├── stores/      Zustand auth state
│   │       └── lib/         API client + utils
│   └── backend/           Express 5 + TypeScript API
│       ├── src/
│       │   ├── routes/      thin route handlers (no logic)
│       │   ├── services/    business rules (no Prisma)
│       │   ├── repositories/ all Prisma queries
│       │   ├── middleware/  auth guard, error handler, validation
│       │   └── utils/       token helpers
│       └── prisma/          schema + migrations
├── packages/
│   └── shared/            ALL shared types, Zod schemas, error codes
│       └── src/
│           ├── types/       TypeScript interfaces
│           └── schemas/     Zod validation schemas
├── docs/                  FRS-NoteApp.md + SDS-NoteApp.md
├── openspec/              spec snapshots (archive, changes, specs)
└── .claude/               agents + slash commands
```

---

## 3. Tech Stack

| Layer                | Technology                     | Version               |
| -------------------- | ------------------------------ | --------------------- |
| Frontend             | React + TypeScript + Vite      | React 19, Vite 5      |
| State / Server State | TanStack Query + Zustand       | TanStack Query v5     |
| UI Components        | shadcn/ui + Tailwind CSS       | Latest                |
| Backend              | Node.js + Express + TypeScript | Node 22, Express 5    |
| Database             | PostgreSQL + Prisma ORM        | Postgres 16, Prisma 5 |
| Auth                 | JWT HS256 + bcrypt             | jsonwebtoken, bcrypt  |
| Testing              | Vitest + Supertest             | Latest                |
| Monorepo             | pnpm workspaces                | pnpm 9                |

---

## 4. Key Commands

```bash
pnpm install                        # install all workspaces
pnpm dev                            # start frontend + backend
pnpm build                          # compile all (must 0 errors)
pnpm test                           # run all tests
pnpm test --coverage                # coverage (≥80% required)
pnpm lint --max-warnings 0          # lint (0 warnings required)
pnpm format                         # prettier write
pnpm --filter backend prisma migrate dev   # run migrations
pnpm --filter backend prisma migrate reset # reset test DB
```

---

## 5. Architecture Rules

**Three-layer rule — no exceptions:**

```
Request
  ↓
Route Handler   → parse req, validate with Zod, call service, send response
  ↓               NO business logic. NO DB calls.
Service         → business rules, orchestration
  ↓               NO req/res objects. NO Prisma calls.
Repository      → ALL Prisma queries; returns domain types
  ↓
Database
```

- Routes call services only
- Services call repositories only
- Repositories return domain types, not raw Prisma objects

---

## 6. Error Response Contract

Every error across the entire API MUST use this exact shape:

```json
{
  "error": {
    "code": "SNAKE_CASE_CODE",
    "message": "Human readable description.",
    "fields": ["fieldName"]
  }
}
```

- `code` — machine-readable, from §10 error codes table
- `message` — human-readable, never exposes stack traces
- `fields` — optional array, only present on 400 validation errors

---

## 7. Success Response Contract

```json
// Single resource or action
{ "data": { ...resource } }

// Array / list
{ "data": [ ...items ] }

// Empty (204 No Content) — no body
```

---

## 8. Coding Standards

**TypeScript:**

- `strict: true` in all tsconfig files
- No `any` types anywhere
- No non-null assertions (`!`) without an explanatory comment

**Naming:**

| Pattern          | Convention                  | Example             |
| ---------------- | --------------------------- | ------------------- |
| TS interfaces    | PascalCase + `I` prefix     | `INoteResponse`     |
| Zod schemas      | camelCase + `Schema` suffix | `createNoteSchema`  |
| Service files    | PascalCase + `Service`      | `NoteService.ts`    |
| Repository files | PascalCase + `Repository`   | `NoteRepository.ts` |
| React components | PascalCase                  | `NoteCard.tsx`      |
| Custom hooks     | camelCase + `use` prefix    | `useNotes.ts`       |
| Error codes      | SCREAMING_SNAKE_CASE        | `NOTE_NOT_FOUND`    |

---

## 9. Shared Package Rule

`packages/shared` is the **only** place for:

- TypeScript interfaces (`src/types/`)
- Zod schemas (`src/schemas/`)
- Error code constants (`src/errors.ts`)

Always import from `@noteapp/shared`. Never duplicate in frontend or backend.

---

## 10. Error Codes

All strings live in `packages/shared/src/errors.ts`. HTTP status codes are final.

| Code                  | HTTP | When                                             |
| --------------------- | ---- | ------------------------------------------------ |
| `EMAIL_TAKEN`         | 422  | Registration with already-registered email       |
| `INVALID_CREDENTIALS` | 401  | Wrong email or password at login                 |
| `TOKEN_EXPIRED`       | 401  | Access token past 15-min expiry                  |
| `REFRESH_EXPIRED`     | 401  | Refresh token past 7-day expiry                  |
| `REFRESH_INVALID`     | 401  | Refresh token not in DB (logged out)             |
| `UNAUTHORIZED`        | 401  | Missing or invalid Authorization header          |
| `NOTE_NOT_FOUND`      | 404  | Note not found or belongs to another user        |
| `TAG_NOT_FOUND`       | 404  | Tag not found or belongs to another user         |
| `TAG_NAME_TAKEN`      | 422  | Duplicate tag name for same user                 |
| `VALIDATION_ERROR`    | 400  | Zod schema validation failed (includes `fields`) |

---

## 11. API Summary

| Method | Path                         | Auth | Success                                   |
| ------ | ---------------------------- | ---- | ----------------------------------------- |
| POST   | `/api/auth/register`         | No   | 201 `{ userId }`                          |
| POST   | `/api/auth/login`            | No   | 200 `{ accessToken, refreshToken, user }` |
| POST   | `/api/auth/logout`           | Yes  | 204                                       |
| POST   | `/api/auth/refresh`          | No   | 200 `{ accessToken }`                     |
| GET    | `/api/notes`                 | Yes  | 200 `[...notes]`                          |
| POST   | `/api/notes`                 | Yes  | 201 note object                           |
| GET    | `/api/notes/:id`             | Yes  | 200 note object                           |
| PATCH  | `/api/notes/:id`             | Yes  | 200 updated note                          |
| DELETE | `/api/notes/:id`             | Yes  | 204 (soft-delete)                         |
| GET    | `/api/tags`                  | Yes  | 200 `[...tags]`                           |
| POST   | `/api/tags`                  | Yes  | 201 `{ id, name }`                        |
| DELETE | `/api/tags/:id`              | Yes  | 204                                       |
| POST   | `/api/notes/:id/tags/:tagId` | Yes  | 200 note with tags                        |
| DELETE | `/api/notes/:id/tags/:tagId` | Yes  | 200 note with tags                        |

All endpoints prefixed `/api`. Protected endpoints require `Authorization: Bearer <accessToken>`.

---

## 12. Testing Approach

**File layout:**

```
apps/backend/src/__tests__/
  unit/services/        pure business logic, mocked repositories
  integration/routes/   Supertest + real test DB
```

**Rules:**

- One test per AC row — name format: `AC-{id}: {scenario name}`
- Integration tests use `TEST_DATABASE_URL` (separate DB)
- Reset DB between suites: `prisma migrate reset`
- Assert error code string, not just HTTP status:
  ```typescript
  expect(res.body.error.code).toBe('EMAIL_TAKEN');
  ```
- Cover: happy path + every error path + boundary values (max-length strings, empty strings, missing auth)

---

## 13. Do NOT Do

- **Direct Prisma in services** — services call repositories, never `prisma.*` directly
- **Types outside shared** — no interfaces or Zod schemas in `frontend/` or `backend/`
- **`any` types** — zero tolerance; TypeScript strict mode enforced
- **Business logic in routes** — routes call service and return response only
- **Raw Prisma objects returned from repositories** — map to domain types
- **Hardcoded JWT secret** — must come from env var
- **Skip quality gates** — all 5 gates must pass before raising a PR (build, lint, tests, coverage, spec review)
- **Skip or reorder tickets** — build AB-1001 → AB-1002 → AB-1003 → AB-1004 in sequence
