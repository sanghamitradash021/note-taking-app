# Spec: AB-1002 — Authentication (Register, Login, Logout, Token Refresh)

## Summary

Implement JWT-based authentication: user registration with bcrypt password hashing, login returning access + refresh tokens, logout invalidating the current session, and refresh token rotation issuing a new access + refresh token pair.

---

## FRS References

- FR-AUTH-001 — Registration
- FR-AUTH-002 — Login + JWT
- FR-AUTH-003 — Logout

---

## Scope

### In Scope

- `POST /api/auth/register` — create user, hash password, return `userId`
- `POST /api/auth/login` — verify credentials, issue access token (15 min) + refresh token (7 days), store refresh token in DB
- `POST /api/auth/logout` — delete single refresh token row matching token sent in body
- `POST /api/auth/refresh` — validate refresh token, rotate (delete old, persist new), return new access token + new refresh token
- `packages/shared` — Zod schemas for all four request bodies; TypeScript interfaces for responses; error code constants
- `packages/backend` — `UserRepository`, `AuthService`, auth route handlers, `authMiddleware` JWT guard
- Prisma `User` and `RefreshToken` models + initial migration
- Unit tests (services, mocked repos) + integration tests (Supertest + test DB) for all AC rows

### Out of Scope

- Password reset / OTP
- OAuth / social login
- Email verification
- Frontend pages or hooks
- Notes or Tags endpoints (AB-1003, AB-1004)

---

## Spec Scenarios

| ID            | Scenario                        | Given                                            | When                      | Then                                                                                              |
| ------------- | ------------------------------- | ------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------- |
| AC-REG-01     | Successful registration         | Valid email + strong password                    | `POST /api/auth/register` | 201 `{ data: { userId } }`                                                                        |
| AC-REG-02     | Duplicate email                 | Email already registered                         | `POST /api/auth/register` | 422; `error.code = "EMAIL_TAKEN"`                                                                 |
| AC-REG-03     | Weak password — too short       | Password < 8 chars                               | `POST /api/auth/register` | 400; `error.code = "VALIDATION_ERROR"`; `fields: ["password"]`                                    |
| AC-REG-03b    | Weak password — no uppercase    | Password has no uppercase letter                 | `POST /api/auth/register` | 400; `error.code = "VALIDATION_ERROR"`; `fields: ["password"]`                                    |
| AC-REG-03c    | Weak password — no digit        | Password has no digit                            | `POST /api/auth/register` | 400; `error.code = "VALIDATION_ERROR"`; `fields: ["password"]`                                    |
| AC-REG-04     | Missing email                   | No `email` field in body                         | `POST /api/auth/register` | 400; `error.code = "VALIDATION_ERROR"`; `fields: ["email"]`                                       |
| AC-REG-04b    | Invalid email format            | `email` is not a valid email string              | `POST /api/auth/register` | 400; `error.code = "VALIDATION_ERROR"`; `fields: ["email"]`                                       |
| AC-REG-05     | Email case normalisation        | Email submitted as `USER@TEST.COM`               | `POST /api/auth/register` | Stored and matched as `user@test.com`; 201                                                        |
| AC-LOGIN-01   | Successful login                | Valid credentials                                | `POST /api/auth/login`    | 200 `{ data: { accessToken, refreshToken, user: { id, email } } }`; refresh token persisted in DB |
| AC-LOGIN-02   | Wrong password                  | Correct email, wrong password                    | `POST /api/auth/login`    | 401; `error.code = "INVALID_CREDENTIALS"`; no field hint                                          |
| AC-LOGIN-03   | Unknown email                   | Email not in DB                                  | `POST /api/auth/login`    | 401; `error.code = "INVALID_CREDENTIALS"`; same message as AC-LOGIN-02                            |
| AC-LOGIN-04   | Missing credentials             | Empty body                                       | `POST /api/auth/login`    | 400; `error.code = "VALIDATION_ERROR"`; `fields: ["email", "password"]`                           |
| AC-LOGIN-05   | Expired access token            | Token older than 15 minutes                      | Any protected endpoint    | 401; `error.code = "TOKEN_EXPIRED"`                                                               |
| AC-LOGOUT-01  | Successful logout               | Authenticated user; valid `refreshToken` in body | `POST /api/auth/logout`   | 204; matching `RefreshToken` row deleted from DB                                                  |
| AC-LOGOUT-02  | Unauthenticated logout          | No `Authorization` header                        | `POST /api/auth/logout`   | 401; `error.code = "UNAUTHORIZED"`                                                                |
| AC-REFRESH-01 | Successful token refresh        | Valid, unexpired refresh token in DB             | `POST /api/auth/refresh`  | 200 `{ data: { accessToken, refreshToken } }`; old token deleted; new token persisted             |
| AC-REFRESH-02 | Invalid / missing refresh token | Token not in DB (logged out or never existed)    | `POST /api/auth/refresh`  | 401; `error.code = "REFRESH_INVALID"`                                                             |
| AC-REFRESH-03 | Expired refresh token           | Token past 7-day expiry (row still in DB)        | `POST /api/auth/refresh`  | 401; `error.code = "REFRESH_INVALID"`; expired row deleted from DB                                |
| AC-REFRESH-04 | Missing body field              | No `refreshToken` in body                        | `POST /api/auth/refresh`  | 400; `error.code = "VALIDATION_ERROR"`; `fields: ["refreshToken"]`                                |

---

## API Delta

### POST /api/auth/register

```
Request body
{
  "email": "user@example.com",   // required, valid email format
  "password": "Password1"        // required, ≥8 chars, ≥1 upper, ≥1 lower, ≥1 digit
}

201 Response
{
  "data": { "userId": "cuid..." }
}

422 Error
{
  "error": { "code": "EMAIL_TAKEN", "message": "An account with this email already exists." }
}

400 Error
{
  "error": { "code": "VALIDATION_ERROR", "message": "Validation failed.", "fields": ["password"] }
}
```

### POST /api/auth/login

```
Request body
{
  "email": "user@example.com",
  "password": "Password1"
}

200 Response
{
  "data": {
    "accessToken": "eyJ...",     // HS256, expires 15 min, payload: { sub: userId, email }
    "refreshToken": "eyJ...",    // HS256, expires 7 days, stored in DB
    "user": { "id": "cuid...", "email": "user@example.com" }
  }
}

401 Error
{
  "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." }
}
```

### POST /api/auth/logout

```
Request headers
Authorization: Bearer <accessToken>

Request body
{
  "refreshToken": "eyJ..."
}

204 Response  (no body)

401 Error (no/invalid Authorization header)
{
  "error": { "code": "UNAUTHORIZED", "message": "Authentication required." }
}
```

### POST /api/auth/refresh

```
Request body
{
  "refreshToken": "eyJ..."
}

200 Response
{
  "data": {
    "accessToken": "eyJ...",    // new access token
    "refreshToken": "eyJ..."    // new refresh token (old one deleted from DB)
  }
}

401 Error (expired or not found)
{
  "error": { "code": "REFRESH_INVALID", "message": "Refresh token is invalid or expired." }
}
```

---

## DB Changes

Two new tables via Prisma migration.

**User**

| Column         | Type            | Constraints  |
| -------------- | --------------- | ------------ |
| `id`           | `String` (cuid) | PK           |
| `email`        | `String`        | UNIQUE       |
| `passwordHash` | `String`        | NOT NULL     |
| `createdAt`    | `DateTime`      | default now  |
| `updatedAt`    | `DateTime`      | auto-updated |

**RefreshToken**

| Column      | Type            | Constraints  |
| ----------- | --------------- | ------------ |
| `id`        | `String` (cuid) | PK           |
| `userId`    | `String`        | FK → User.id |
| `token`     | `String`        | UNIQUE       |
| `expiresAt` | `DateTime`      | NOT NULL     |
| `createdAt` | `DateTime`      | default now  |

`Note`, `Tag`, `NoteTag` models are defined in Prisma schema now (they belong to AB-1003/AB-1004) but migration for those tables deferred to their tickets.

---

## Assumptions

1. **Token rotation confirmed** — `POST /api/auth/refresh` deletes the incoming refresh token and issues a new refresh token + new access token in a single atomic operation.
2. **Logout scope** — logout deletes only the single `RefreshToken` row matching the token sent in the request body; other sessions for the same user remain active.
3. **JWT payload** — access token payload: `{ sub: userId, email }`; refresh token payload: `{ sub: userId }`. Both signed with `JWT_SECRET` env var (≥32 chars).
4. **Expired refresh token handling** — expired tokens still present in DB return `REFRESH_INVALID` (same code as not-found); the expired row is deleted on that request.
5. **Email normalisation** — `email.toLowerCase()` applied in `AuthService.register` before uniqueness check and DB write.
6. **Password validation** — Zod `.regex()` enforcing: length ≥ 8, ≥1 uppercase `[A-Z]`, ≥1 lowercase `[a-z]`, ≥1 digit `[0-9]`.
7. **Timing-safe comparison** — `bcrypt.compare` used for password check; no early exit that leaks which field is wrong.
8. **RefreshToken storage** — token value is the raw JWT string; `expiresAt` computed as `now + 7 days` at issuance.
9. **No rate limiting** in scope for this ticket.
10. **`Note`, `Tag`, `NoteTag` models** declared in `schema.prisma` now per SDS §4.1, but their migrations run in AB-1003/AB-1004.
