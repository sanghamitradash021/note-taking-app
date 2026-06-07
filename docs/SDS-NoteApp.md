# Software Design Specification

## Note Taking Application — Tutorial Edition

**Version:** 1.0 | **Status:** Draft | **Date:** June 2025
**FRS Reference:** FRS-NoteApp v1.0

---

## 1. Technology Stack

| Layer                | Technology                     | Version               |
| -------------------- | ------------------------------ | --------------------- |
| Frontend             | React + TypeScript + Vite      | React 19, Vite 5      |
| State / Server State | TanStack Query + Zustand       | TanStack Query v5     |
| UI Components        | shadcn/ui + Tailwind CSS       | Latest                |
| Backend              | Node.js + Express + TypeScript | Node 22, Express 5    |
| Database             | PostgreSQL + Prisma ORM        | Postgres 16, Prisma 5 |
| Auth                 | JWT (HS256) + bcrypt           | jsonwebtoken, bcrypt  |
| Testing              | Vitest + Supertest             | Latest                |
| Monorepo             | pnpm workspaces                | pnpm 9                |

---

## 2. Repository Structure

```
noteapp/
├── apps/
│   ├── frontend/              ← Vite + React 19
│   │   ├── src/
│   │   │   ├── components/    reusable UI components
│   │   │   ├── pages/         route-level page components
│   │   │   ├── hooks/         custom React hooks (TanStack Query)
│   │   │   ├── stores/        Zustand stores (auth state)
│   │   │   └── lib/           api client, utils
│   │   └── CLAUDE.md
│   └── backend/               ← Express 5 + TypeScript
│       ├── src/
│       │   ├── routes/        express route handlers (thin layer)
│       │   ├── services/      business logic
│       │   ├── repositories/  all Prisma queries
│       │   ├── middleware/     auth guard, error handler, validation
│       │   └── utils/         token helpers
│       ├── prisma/
│       │   └── schema.prisma
│       └── CLAUDE.md
├── packages/
│   └── shared/                ← ALL shared types + Zod schemas
│       ├── src/
│       │   ├── types/         TypeScript interfaces
│       │   └── schemas/       Zod validation schemas
│       └── CLAUDE.md
├── docs/
│   ├── FRS.md
│   └── SDS.md
├── openspec/
├── .claude/
│   ├── commands/
│   └── agents/
├── AGENTS.md
├── CLAUDE.md
└── pnpm-workspace.yaml
```

---

## 3. Architecture

### 3.1 Backend Layered Architecture

Every request flows top to bottom. No layer may skip the one below it.

```
Request
  ↓
Route Handler     → parse req, validate with Zod, call service, send response
  ↓                 (no business logic, no DB calls)
Service           → business rules, orchestration
  ↓                 (no req/res objects, no Prisma calls)
Repository        → all Prisma queries, returns domain types
  ↓
Database
```

### 3.2 Error Response Shape

**Every error response across the entire API MUST use this exact shape:**

```json
{
  "error": {
    "code": "SNAKE_CASE_CODE",
    "message": "Human readable description.",
    "fields": ["fieldName"]
  }
}
```

- `code` — machine-readable string, from the error codes table in §6
- `message` — human-readable, never exposes stack traces or internal details
- `fields` — optional array, only present on 400 validation errors

### 3.3 Success Response Shape

```json
// Single resource or action
{ "data": { ...resource } }

// Array / list
{ "data": [ ...items ] }

// Empty (204 No Content)
// No body
```

---

## 4. Database Schema

### 4.1 Prisma Schema

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

### 4.2 Entity Relationships

```
User (1) ──→ (many) Note        user owns notes
User (1) ──→ (many) Tag         tags are user-scoped
Note (many) ↔ (many) Tag        via NoteTag join table
User (1) ──→ (many) RefreshToken  supports multiple devices
```

---

## 5. API Contracts

### 5.1 Base URL

All endpoints prefixed with `/api`. No version prefix.

### 5.2 Auth Header

All protected endpoints require:

```
Authorization: Bearer <accessToken>
```

---

### 5.3 Auth Endpoints

| Method | Path                 | Auth | Description                         | Success |
| ------ | -------------------- | ---- | ----------------------------------- | ------- |
| POST   | `/api/auth/register` | No   | Register new user                   | 201     |
| POST   | `/api/auth/login`    | No   | Login; returns tokens               | 200     |
| POST   | `/api/auth/logout`   | Yes  | Delete refresh token                | 204     |
| POST   | `/api/auth/refresh`  | No   | New access token from refresh token | 200     |

#### POST /api/auth/register

```json
// Request body
{
  "email": "user@example.com",
  "password": "Password1"
}

// 201 Response
{
  "data": { "userId": "cluid123" }
}

// 422 Error (duplicate email)
{
  "error": { "code": "EMAIL_TAKEN", "message": "An account with this email already exists." }
}
```

#### POST /api/auth/login

```json
// Request body
{
  "email": "user@example.com",
  "password": "Password1"
}

// 200 Response
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "cluid123", "email": "user@example.com" }
  }
}

// 401 Error (wrong credentials — same message for wrong email or wrong password)
{
  "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." }
}
```

#### POST /api/auth/refresh

```json
// Request body
{
  "refreshToken": "eyJ..."
}

// 200 Response
{
  "data": { "accessToken": "eyJ..." }
}
```

---

### 5.4 Notes Endpoints

| Method | Path             | Auth | Description                    | Success |
| ------ | ---------------- | ---- | ------------------------------ | ------- |
| GET    | `/api/notes`     | Yes  | List own non-deleted notes     | 200     |
| POST   | `/api/notes`     | Yes  | Create a note                  | 201     |
| GET    | `/api/notes/:id` | Yes  | Get a single note              | 200     |
| PATCH  | `/api/notes/:id` | Yes  | Update title or content        | 200     |
| DELETE | `/api/notes/:id` | Yes  | Soft-delete (sets `deletedAt`) | 204     |

#### Note Object Shape

```json
{
  "id": "cluid123",
  "title": "My First Note",
  "content": "Some text here.",
  "createdAt": "2025-06-01T10:00:00Z",
  "updatedAt": "2025-06-01T10:00:00Z",
  "tags": [{ "id": "tagid1", "name": "work" }]
}
```

#### POST /api/notes — Request

```json
{ "title": "My Note", "content": "Optional body text." }
```

#### PATCH /api/notes/:id — Request

```json
{ "title": "Updated Title", "content": "Updated body." }
```

Both fields optional — at least one must be present.

---

### 5.5 Tags Endpoints

| Method | Path                         | Auth | Description                 | Success |
| ------ | ---------------------------- | ---- | --------------------------- | ------- |
| GET    | `/api/tags`                  | Yes  | List own tags               | 200     |
| POST   | `/api/tags`                  | Yes  | Create a tag                | 201     |
| DELETE | `/api/tags/:id`              | Yes  | Delete tag (cascade detach) | 204     |
| POST   | `/api/notes/:id/tags/:tagId` | Yes  | Attach tag to note          | 200     |
| DELETE | `/api/notes/:id/tags/:tagId` | Yes  | Detach tag from note        | 200     |

#### Tag Object Shape

```json
{ "id": "tagid1", "name": "work" }
```

#### POST /api/tags — Request

```json
{ "name": "work" }
```

---

## 6. Error Codes Reference

All error code strings live in `packages/shared/src/errors.ts`. Every HTTP status code below is final — do not deviate.

| Code                  | HTTP Status | When                                             |
| --------------------- | ----------- | ------------------------------------------------ |
| `EMAIL_TAKEN`         | 422         | Registration with already-registered email       |
| `INVALID_CREDENTIALS` | 401         | Wrong email or password at login                 |
| `TOKEN_EXPIRED`       | 401         | Access token past 15-minute expiry               |
| `REFRESH_EXPIRED`     | 401         | Refresh token past 7-day expiry                  |
| `REFRESH_INVALID`     | 401         | Refresh token not found in DB (logged out)       |
| `UNAUTHORIZED`        | 401         | Missing or invalid Authorization header          |
| `NOTE_NOT_FOUND`      | 404         | Note not found or belongs to another user        |
| `TAG_NOT_FOUND`       | 404         | Tag not found or belongs to another user         |
| `TAG_NAME_TAKEN`      | 422         | Duplicate tag name for same user                 |
| `VALIDATION_ERROR`    | 400         | Zod schema validation failed (includes `fields`) |

---

## 7. Shared Package Rules

`packages/shared` is the only place for:

- TypeScript interfaces (`src/types/`)
- Zod schemas (`src/schemas/`)
- Error code constants (`src/errors.ts`)

**Never duplicate these in `frontend` or `backend`.** Always import from `@noteapp/shared`.

---

## 8. Coding Standards

### TypeScript

- `strict: true` in all tsconfig files
- No `any` types anywhere
- No non-null assertions (`!`) without an explanatory comment

### Naming Conventions

| Pattern               | Convention                  | Example             |
| --------------------- | --------------------------- | ------------------- |
| TypeScript interfaces | PascalCase with `I` prefix  | `INoteResponse`     |
| Zod schemas           | camelCase + `Schema` suffix | `createNoteSchema`  |
| Service files         | PascalCase + `Service`      | `NoteService.ts`    |
| Repository files      | PascalCase + `Repository`   | `NoteRepository.ts` |
| React components      | PascalCase                  | `NoteCard.tsx`      |
| Custom hooks          | camelCase + `use` prefix    | `useNotes.ts`       |
| Error codes           | `SCREAMING_SNAKE_CASE`      | `NOTE_NOT_FOUND`    |

### API Rules

- Route handlers contain zero business logic — call service and return response only
- Services contain zero Prisma calls — call repository only
- Repositories return domain types, not raw Prisma objects
- Every route validates the request body with a Zod schema before calling the service

---

## 9. Testing Strategy

### Test Layout

```
apps/backend/src/__tests__/
  unit/
    services/         pure business logic, mocked repositories
  integration/
    routes/           Supertest + real test DB
```

### Test Writing Rules

- **One test per AC row** — test name format: `AC-{id}: {scenario name}`
- Integration tests use a separate test database (`TEST_DATABASE_URL`)
- Reset DB between test suites using `prisma migrate reset`
- Test the error **code string**, not just the HTTP status:
  ```typescript
  expect(res.body.error.code).toBe('EMAIL_TAKEN');
  ```
- Test happy path + every error path + boundary values

### test-writer Agent Contract

The `test-writer` agent writes test files only — never touches implementation.

For every spec scenario it writes:

1. Happy-path test
2. Every error-path test (wrong input, missing fields, wrong user, expired token)
3. Boundary tests: max-length strings, empty strings, missing auth header
4. Test name matches AC ID exactly: `'AC-REG-02: Duplicate email'`

---

## 10. Quality Gates

Every ticket must pass all of these before a PR is raised:

| Gate             | Command                             | Pass Criteria         |
| ---------------- | ----------------------------------- | --------------------- |
| TypeScript build | `pnpm build`                        | 0 errors, 0 warnings  |
| Lint             | `pnpm lint --max-warnings 0`        | Zero warnings         |
| Tests            | `pnpm test`                         | All green, no skipped |
| Coverage         | `pnpm test --coverage`              | ≥ 80% on new code     |
| Spec compliance  | `/review AB-xxxx` in fresh terminal | All ✅                |

---

## 11. Ticket Sequence

Build in this order — do not skip or reorder:

| Ticket  | Description                                                         | Estimated Time |
| ------- | ------------------------------------------------------------------- | -------------- |
| AB-1001 | Project setup — monorepo, Prisma, CLAUDE.md, agents, slash commands | 5 min          |
| AB-1002 | Auth — register, login, logout, JWT + refresh token                 | 10 min         |
| AB-1003 | Notes — full CRUD + soft-delete                                     | 10 min         |
| AB-1004 | Tags — create, delete, attach to note, detach from note             | 10 min         |

**Total: ~35 minutes** (plus review time per ticket)
