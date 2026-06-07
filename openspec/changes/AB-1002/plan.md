# Plan: AB-1002 — Authentication

## Pre-flight Observations

- Prisma schema already complete (all 5 models defined in AB-1001) — no schema edits needed
- All runtime deps installed: `bcrypt`, `jsonwebtoken`, `zod`, `@prisma/client`, `supertest`
- `packages/shared/src/errors.ts` — all error codes already defined; no changes needed
- `packages/shared/src/types/index.ts` — base interfaces exist; auth response types to add
- `packages/shared/src/schemas/index.ts` — empty placeholder; all auth schemas to add
- `apps/backend/src/index.ts` — bare Express app; wire up routes + error handler

---

## Files to Create

### packages/shared

| File                              | Purpose                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| _(modify)_ `src/types/index.ts`   | Add `IRegisterResponse`, `ILoginResponse`, `IRefreshResponse`, `IAccessTokenPayload`, `IRefreshTokenPayload` |
| _(modify)_ `src/schemas/index.ts` | Add `registerSchema`, `loginSchema`, `logoutSchema`, `refreshTokenSchema`                                    |

### apps/backend

| File                                              | Purpose                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/prisma.ts`                               | Singleton `PrismaClient` instance — import everywhere instead of `new PrismaClient()`                                               |
| `src/utils/tokenHelpers.ts`                       | `signAccessToken`, `signRefreshToken`, `verifyAccessToken`, `verifyRefreshToken` — all JWT logic isolated here                      |
| `src/repositories/UserRepository.ts`              | `findByEmail(email)`, `create(email, passwordHash)` — returns `IUser` (strips `passwordHash`)                                       |
| `src/repositories/RefreshTokenRepository.ts`      | `create(userId, token, expiresAt)`, `findByToken(token)`, `deleteByToken(token)`                                                    |
| `src/services/AuthService.ts`                     | `register`, `login`, `logout`, `refresh` — business rules, calls repos only                                                         |
| `src/middleware/authMiddleware.ts`                | Bearer token guard; verifies JWT, attaches `{ userId, email }` to `res.locals`; returns `UNAUTHORIZED` / `TOKEN_EXPIRED` on failure |
| `src/middleware/errorHandler.ts`                  | Global Express error handler; catches thrown errors and formats them to `{ error: { code, message, fields? } }`                     |
| `src/routes/authRoutes.ts`                        | 4 route handlers: register, login, logout, refresh — parse → validate (Zod) → call service → respond                                |
| `src/__tests__/unit/services/AuthService.test.ts` | Unit tests — mock `UserRepository` + `RefreshTokenRepository` with `vi.fn()`                                                        |
| `src/__tests__/integration/routes/auth.test.ts`   | Integration tests — Supertest + real `TEST_DATABASE_URL` DB; covers all AC rows                                                     |

---

## Files to Modify

| File                                   | Change                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `apps/backend/src/index.ts`            | Import `authRoutes`; mount at `/api/auth`; register `errorHandler` last |
| `packages/shared/src/types/index.ts`   | Add 5 auth interfaces (append; existing interfaces untouched)           |
| `packages/shared/src/schemas/index.ts` | Replace placeholder `export {}` with 4 Zod schemas                      |

---

## Shared Package Additions

### New TypeScript Interfaces (`src/types/index.ts`)

```typescript
export interface IRegisterResponse {
  userId: string;
}

export interface ILoginUser {
  id: string;
  email: string;
}

export interface ILoginResponse {
  accessToken: string;
  refreshToken: string;
  user: ILoginUser;
}

export interface IRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// Used by authMiddleware and tokenHelpers — not an API response type
export interface IAccessTokenPayload {
  sub: string; // userId
  email: string;
}

export interface IRefreshTokenPayload {
  sub: string; // userId
}
```

### New Zod Schemas (`src/schemas/index.ts`)

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one digit'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
```

---

## DB Migration

Run **after** Prisma schema is confirmed unchanged:

```bash
pnpm --filter backend prisma migrate dev --name init
```

Creates a single migration covering all 5 models (User, Note, Tag, NoteTag, RefreshToken). Note and Tag tables exist after this migration but are unused until AB-1003/AB-1004.

For the test database:

```bash
TEST_DATABASE_URL=<test-db-url> pnpm --filter backend prisma migrate deploy
```

---

## TypeScript Interfaces — Final API Response Shapes

```typescript
// POST /api/auth/register — 201
{
  data: IRegisterResponse;
} // { data: { userId: "cuid..." } }

// POST /api/auth/login — 200
{
  data: ILoginResponse;
}
// {
//   data: {
//     accessToken: "eyJ...",
//     refreshToken: "eyJ...",
//     user: { id: "cuid...", email: "user@example.com" }
//   }
// }

// POST /api/auth/logout — 204
// No body

// POST /api/auth/refresh — 200
{
  data: IRefreshResponse;
} // { data: { accessToken: "eyJ...", refreshToken: "eyJ..." } }
```

---

## Architecture Notes

### 1. Prisma singleton

`src/lib/prisma.ts` exports a single `PrismaClient` instance. Repositories import it directly. Do not instantiate `PrismaClient` anywhere else.

### 2. Token helpers isolation

All `jwt.sign` / `jwt.verify` calls live in `src/utils/tokenHelpers.ts`. `AuthService` calls these helpers — no JWT logic leaks into service or route layer.

### 3. `res.locals` typing for authMiddleware

Extend Express `Locals` via declaration merging so `res.locals.userId` and `res.locals.email` are typed:

```typescript
declare global {
  namespace Express {
    interface Locals {
      userId: string;
      email: string;
    }
  }
}
```

Place this declaration in `src/middleware/authMiddleware.ts`.

### 4. Error handler contract

`errorHandler` middleware catches anything thrown from routes/services. Services throw plain `Error` objects enriched with `code` and optional `fields` properties. The handler maps these to the standard error response shape. Route handlers do not contain try/catch — they call `next(err)` style via Express 5's native async error propagation.

### 5. Validation helper in routes

Each route calls a shared inline validator pattern:

```typescript
const result = schema.safeParse(req.body);
if (!result.success) {
  const fields = result.error.issues.map((i) => String(i.path[0]));
  // throw AppError with code VALIDATION_ERROR + fields
}
```

No separate validation middleware — keeps validation co-located with the route it guards.

### 6. Timing-safe credential check

In `AuthService.login`: always call `bcrypt.compare` even when user is not found (compare against a dummy hash) to prevent timing-based user enumeration.

### 7. Refresh token rotation atomicity

`AuthService.refresh` performs delete-old + create-new in a single Prisma `$transaction`. If new token write fails, old token is not deleted (no silent logout).

### 8. Test DB isolation

Integration tests set `process.env['DATABASE_URL']` to `TEST_DATABASE_URL` before `PrismaClient` is instantiated. Use `beforeAll` to run `prisma migrate reset --force` and `afterAll` to disconnect.

---

## Implementation Phases

### Phase 1 — Shared package contracts

1. Add 5 interfaces to `packages/shared/src/types/index.ts`
2. Replace `packages/shared/src/schemas/index.ts` with 4 Zod schemas

**Checkpoint:**

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 2 — DB migration

3. Run `pnpm --filter backend prisma migrate dev --name init`
4. Run `pnpm --filter backend prisma generate`

**Checkpoint:**

```bash
pnpm build
```

---

### Phase 3 — Backend infrastructure

5. Create `src/lib/prisma.ts`
6. Create `src/utils/tokenHelpers.ts`
7. Create `src/middleware/errorHandler.ts`
8. Create `src/middleware/authMiddleware.ts`

**Checkpoint:**

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 4 — Repository + Service layer

9. Create `src/repositories/UserRepository.ts`
10. Create `src/repositories/RefreshTokenRepository.ts`
11. Create `src/services/AuthService.ts`

**Checkpoint:**

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 5 — Route handlers + app wiring

12. Create `src/routes/authRoutes.ts`
13. Modify `src/index.ts` — mount auth router + error handler

**Checkpoint:**

```bash
pnpm build
pnpm lint --max-warnings 0
```

---

### Phase 6 — Tests

14. Create `src/__tests__/unit/services/AuthService.test.ts`
15. Create `src/__tests__/integration/routes/auth.test.ts`

**Checkpoint:**

```bash
pnpm test
pnpm test --coverage   # must be ≥ 80%
```

---

### Final Gate

```bash
pnpm build              # 0 errors, 0 warnings
pnpm lint --max-warnings 0
pnpm test               # all green
pnpm test --coverage    # ≥ 80%
```
