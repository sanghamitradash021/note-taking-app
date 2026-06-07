# Tasks: AB-1001 — Project Setup

> No test suite for this ticket — AB-1001 has no business logic.
> Phase 3 is verification against spec scenarios SS-001–SS-012.

---

## Phase 1 — Shared Package + Root Wiring

- [ ] Create `packages/shared/package.json` — name `@noteapp/shared`, exports `./src/index.ts`, `"type": "module"`
- [ ] Create `packages/shared/tsconfig.json` — strict, composite: true, outDir: dist
- [ ] Create `packages/shared/src/errors.ts` — 10 error code constants + `ErrorCode` union type
- [ ] Create `packages/shared/src/types/index.ts` — IUser, INote, ITag, IApiResponse\<T\>, IApiErrorResponse, IApiError
- [ ] Create `packages/shared/src/schemas/index.ts` — empty barrel export (populated in AB-1002+)
- [ ] Create `packages/shared/src/index.ts` — re-export from errors, types, schemas
- [ ] Create `packages/shared/CLAUDE.md` — types/schemas/errors only; always import from @noteapp/shared
- [ ] Create root `tsconfig.json` — composite project references to shared, backend, frontend
- [ ] Modify root `package.json` — add `build`, `dev`, `test` scripts delegating via `pnpm -r`
- [ ] Create `.env.example` — documents `DATABASE_URL` and `JWT_SECRET` (no real values)

**CHECKPOINT:**

```bash
pnpm --filter @noteapp/shared build   # 0 errors
pnpm lint --max-warnings 0            # 0 warnings
```

---

## Phase 2 — Backend Scaffold

- [ ] Create `apps/backend/package.json` — deps: express@5, @prisma/client, zod, jsonwebtoken, bcrypt; dev: typescript, @types/\*, vitest, supertest, prisma
- [ ] Create `apps/backend/tsconfig.json` — strict, NodeNext module, references packages/shared, @noteapp/shared path alias
- [ ] Create `apps/backend/src/index.ts` — minimal Express 5 app: create app, health-check route, listen on `process.env.PORT ?? 3000`
- [ ] Create `apps/backend/src/routes/.gitkeep`
- [ ] Create `apps/backend/src/services/.gitkeep`
- [ ] Create `apps/backend/src/repositories/.gitkeep`
- [ ] Create `apps/backend/src/middleware/.gitkeep`
- [ ] Create `apps/backend/src/utils/.gitkeep`
- [ ] Create `apps/backend/CLAUDE.md` — 3-layer rule, no Prisma in services, error shape contract, no any

**CHECKPOINT:**

```bash
pnpm --filter backend build   # 0 errors; @noteapp/shared resolves
pnpm lint --max-warnings 0
```

---

## Phase 3 — Frontend Scaffold

- [ ] Create `apps/frontend/package.json` — deps: react@19, react-dom, @tanstack/react-query@5, zustand, tailwindcss; dev: vite@5, @vitejs/plugin-react, typescript
- [ ] Create `apps/frontend/tsconfig.json` — strict, DOM lib, jsx: react-jsx, references packages/shared
- [ ] Create `apps/frontend/tsconfig.node.json` — TS config for vite.config.ts (Node env)
- [ ] Create `apps/frontend/vite.config.ts` — react plugin; proxy `/api` → `http://localhost:3000`
- [ ] Create `apps/frontend/index.html` — Vite entry HTML, mounts `#root`
- [ ] Create `apps/frontend/src/main.tsx` — React 19 entry; wraps App in QueryClientProvider
- [ ] Create `apps/frontend/src/App.tsx` — skeleton placeholder component
- [ ] Create `apps/frontend/src/components/.gitkeep`
- [ ] Create `apps/frontend/src/pages/.gitkeep`
- [ ] Create `apps/frontend/src/hooks/.gitkeep`
- [ ] Create `apps/frontend/src/stores/.gitkeep`
- [ ] Create `apps/frontend/src/lib/.gitkeep`
- [ ] Create `apps/frontend/CLAUDE.md` — TanStack Query for server state, Zustand for auth, no direct fetch outside lib/

**CHECKPOINT:**

```bash
pnpm --filter frontend build   # 0 errors; vite build succeeds
pnpm lint --max-warnings 0
```

---

## Phase 4 — Prisma Schema + Migration

- [ ] Create `apps/backend/prisma/schema.prisma` — exact SDS §4.1 schema (User, Note, Tag, NoteTag, RefreshToken with all indexes/constraints)
- [ ] Run `pnpm --filter backend prisma validate` — schema must validate with 0 errors
- [ ] Run `pnpm --filter backend prisma migrate dev --name init` — migration file created under `prisma/migrations/`; DB schema applied
- [ ] Run `pnpm --filter backend prisma generate` — Prisma Client generated; `@prisma/client` importable

**CHECKPOINT:**

```bash
pnpm --filter backend prisma validate   # schema valid
# migration file exists at apps/backend/prisma/migrations/*/migration.sql
# @prisma/client importable from backend src
```

---

## Phase 5 — Verification (Spec Scenarios)

> No automated tests for setup. Verify each scenario manually or via command output.

- [ ] SS-001: `pnpm install` exits 0; all workspace deps resolve; no missing packages
- [ ] SS-002: `pnpm build` exits 0; 0 TS errors, 0 warnings across all packages
- [ ] SS-003: `pnpm lint --max-warnings 0` exits 0; 0 warnings
- [ ] SS-004: `schema.prisma` contains all 5 models; fields, types, indexes match SDS §4.1 exactly
- [ ] SS-005: `prisma/migrations/` contains initial migration SQL; DB schema applied locally
- [ ] SS-006: `prisma generate` completed; `@prisma/client` imports without error in backend
- [ ] SS-007: `@noteapp/shared` exports all 10 error codes — `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `REFRESH_EXPIRED`, `REFRESH_INVALID`, `UNAUTHORIZED`, `NOTE_NOT_FOUND`, `TAG_NOT_FOUND`, `TAG_NAME_TAKEN`, `VALIDATION_ERROR`
- [ ] SS-008: Backend and frontend `package.json` declare `"@noteapp/shared": "workspace:*"`; no unresolved module errors on build
- [ ] SS-009: All SDS §2 directories present — `apps/frontend/src/{components,pages,hooks,stores,lib}`, `apps/backend/src/{routes,services,repositories,middleware,utils}`, `packages/shared/src/{types,schemas}`
- [ ] SS-010: `CLAUDE.md` exists and is non-empty in: repo root, `apps/frontend/`, `apps/backend/`, `packages/shared/`
- [ ] SS-011: Commit with non-conventional message (e.g. `"wip"`) is rejected by commitlint hook
- [ ] SS-012: `pnpm format:check` exits 0; no unformatted files

---

## Final Quality Gate

```bash
pnpm build                  # SS-002: 0 errors, 0 warnings
pnpm lint --max-warnings 0  # SS-003: 0 warnings
pnpm format:check           # SS-012: no unformatted files
```

All three green → ticket complete → raise PR on `feature/backend/AB-1001-project-setup`.
