# Tasks: AB-1002 — Authentication

---

## Phase 1 — Foundation

- [ ] Add auth response interfaces to `packages/shared/src/types/index.ts` (`IRegisterResponse`, `ILoginUser`, `ILoginResponse`, `IRefreshResponse`, `IAccessTokenPayload`, `IRefreshTokenPayload`)
- [ ] Add Zod schemas to `packages/shared/src/schemas/index.ts` (`registerSchema`, `loginSchema`, `logoutSchema`, `refreshTokenSchema`)
- [ ] Run `pnpm --filter backend prisma migrate dev --name init` + `prisma generate`
- [ ] Create `apps/backend/src/lib/prisma.ts` — singleton `PrismaClient`
- [ ] Create `apps/backend/src/utils/tokenHelpers.ts` — `signAccessToken`, `signRefreshToken`, `verifyAccessToken`, `verifyRefreshToken`
- [ ] Create `apps/backend/src/middleware/errorHandler.ts` — global Express error handler
- [ ] Create `apps/backend/src/middleware/authMiddleware.ts` — Bearer JWT guard; attaches `res.locals.userId` + `res.locals.email`

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0`

---

## Phase 2 — Implementation

- [ ] Create `apps/backend/src/repositories/UserRepository.ts` — `findByEmail`, `create`
- [ ] Create `apps/backend/src/repositories/RefreshTokenRepository.ts` — `create`, `findByToken`, `deleteByToken`
- [ ] Create `apps/backend/src/services/AuthService.ts` — `register`, `login`, `logout`, `refresh` (token rotation in `$transaction`)
- [ ] Create `apps/backend/src/routes/authRoutes.ts` — 4 handlers: register, login, logout, refresh
- [ ] Modify `apps/backend/src/index.ts` — mount `/api/auth` router + register `errorHandler` last

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0`

---

## Phase 3 — Tests

### Unit tests (`src/__tests__/unit/services/AuthService.test.ts`)

- [ ] AC-REG-01: Successful registration — hashes password, stores user, returns `userId`
- [ ] AC-REG-02: Duplicate email — throws `EMAIL_TAKEN`
- [ ] AC-REG-03: Weak password — too short — Zod rejects before service is called
- [ ] AC-REG-03b: Weak password — no uppercase — Zod rejects before service is called
- [ ] AC-REG-03c: Weak password — no digit — Zod rejects before service is called
- [ ] AC-REG-04: Missing email — Zod rejects before service is called
- [ ] AC-REG-04b: Invalid email format — Zod rejects before service is called
- [ ] AC-REG-05: Email case normalisation — service lowercases email before repo call
- [ ] AC-LOGIN-01: Successful login — returns `accessToken`, `refreshToken`, `user`; persists refresh token
- [ ] AC-LOGIN-02: Wrong password — throws `INVALID_CREDENTIALS`
- [ ] AC-LOGIN-03: Unknown email — throws `INVALID_CREDENTIALS` (same message, no field hint)
- [ ] AC-LOGIN-04: Missing credentials — Zod rejects before service is called
- [ ] AC-LOGOUT-01: Successful logout — deletes matching `RefreshToken` row
- [ ] AC-REFRESH-01: Successful token refresh — deletes old token, persists new, returns new pair
- [ ] AC-REFRESH-02: Invalid refresh token (not in DB) — throws `REFRESH_INVALID`
- [ ] AC-REFRESH-03: Expired refresh token (past 7 days) — throws `REFRESH_INVALID`; deletes expired row
- [ ] AC-REFRESH-04: Missing `refreshToken` body field — Zod rejects before service is called

### Integration tests (`src/__tests__/integration/routes/auth.test.ts`)

- [ ] AC-REG-01: `POST /api/auth/register` — 201 + `{ data: { userId } }`
- [ ] AC-REG-02: `POST /api/auth/register` duplicate email — 422 + `error.code = "EMAIL_TAKEN"`
- [ ] AC-REG-03: `POST /api/auth/register` weak password (too short) — 400 + `error.code = "VALIDATION_ERROR"` + `fields: ["password"]`
- [ ] AC-REG-03b: `POST /api/auth/register` weak password (no uppercase) — 400 + `fields: ["password"]`
- [ ] AC-REG-03c: `POST /api/auth/register` weak password (no digit) — 400 + `fields: ["password"]`
- [ ] AC-REG-04: `POST /api/auth/register` missing email — 400 + `fields: ["email"]`
- [ ] AC-REG-04b: `POST /api/auth/register` invalid email format — 400 + `fields: ["email"]`
- [ ] AC-REG-05: `POST /api/auth/register` uppercase email — stored + matched as lowercase
- [ ] AC-LOGIN-01: `POST /api/auth/login` valid credentials — 200 + tokens + user; refresh token in DB
- [ ] AC-LOGIN-02: `POST /api/auth/login` wrong password — 401 + `error.code = "INVALID_CREDENTIALS"`
- [ ] AC-LOGIN-03: `POST /api/auth/login` unknown email — 401 + `error.code = "INVALID_CREDENTIALS"` (same message)
- [ ] AC-LOGIN-04: `POST /api/auth/login` empty body — 400 + `fields: ["email", "password"]`
- [ ] AC-LOGIN-05: Protected endpoint with expired access token — 401 + `error.code = "TOKEN_EXPIRED"`
- [ ] AC-LOGOUT-01: `POST /api/auth/logout` — 204; `RefreshToken` row deleted from DB
- [ ] AC-LOGOUT-02: `POST /api/auth/logout` no auth header — 401 + `error.code = "UNAUTHORIZED"`
- [ ] AC-REFRESH-01: `POST /api/auth/refresh` valid token — 200 + new `accessToken` + new `refreshToken`; old row deleted
- [ ] AC-REFRESH-02: `POST /api/auth/refresh` token not in DB — 401 + `error.code = "REFRESH_INVALID"`
- [ ] AC-REFRESH-03: `POST /api/auth/refresh` expired token — 401 + `error.code = "REFRESH_INVALID"`; expired row deleted
- [ ] AC-REFRESH-04: `POST /api/auth/refresh` missing body field — 400 + `fields: ["refreshToken"]`

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm test` → `pnpm test --coverage` (≥ 80%)
