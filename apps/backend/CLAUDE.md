# apps/backend — Rules

## Three-Layer Architecture (no exceptions)

```
Route Handler  →  Service  →  Repository  →  Database
```

- **Routes** (`src/routes/`): parse req, validate with Zod, call one service method, return response. Zero business logic. Zero Prisma.
- **Services** (`src/services/`): business rules and orchestration only. No `req`/`res`. No `prisma.*` calls.
- **Repositories** (`src/repositories/`): all Prisma queries live here. Return domain types (`INote`, `ITag`, etc.) — never raw Prisma objects.

## Error Response Shape

Every error MUST use this exact shape (from SDS §3.2):

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable.",
    "fields": ["fieldName"]
  }
}
```

Import error codes from `@noteapp/shared` — never hardcode strings.

## Naming

| File type  | Convention                | Example             |
| ---------- | ------------------------- | ------------------- |
| Service    | PascalCase + `Service`    | `AuthService.ts`    |
| Repository | PascalCase + `Repository` | `UserRepository.ts` |
| Route file | camelCase                 | `authRoutes.ts`     |

## TypeScript Rules

- `strict: true` — enforced by tsconfig
- No `any` types — use `unknown` + type guards if needed
- No non-null assertions (`!`) without an explanatory comment
- All shared types/schemas imported from `@noteapp/shared`

## Testing

- Unit tests in `src/__tests__/unit/services/` — mock repositories
- Integration tests in `src/__tests__/integration/routes/` — Supertest + `TEST_DATABASE_URL`
- One test per AC row; name format: `AC-{id}: {scenario name}`
- Assert `res.body.error.code`, not just HTTP status
