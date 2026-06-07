# Spec: AB-1001 — Project Setup

## Summary

Scaffold the full monorepo foundation: workspaces, per-package configs, Prisma schema + initial migration, shared error constants, and all CLAUDE.md/agent/command files — so `pnpm build` and `pnpm lint` both pass cleanly before any feature work begins.

---

## FRS References

None. AB-1001 is infrastructure only. No user-facing functional requirements are delivered by this ticket.

---

## Scope

### In Scope

- Root `package.json` + `pnpm-workspace.yaml` wired for `apps/*` and `packages/*`
- Per-package `package.json` + `tsconfig.json` with workspace references for:
  - `apps/backend`
  - `apps/frontend`
  - `packages/shared`
- Root `tsconfig.json` with project references
- `packages/shared/src/errors.ts` — all 10 error code constants from SDS §6
- `packages/shared/src/types/` + `packages/shared/src/schemas/` directories with barrel `index.ts` exports
- `packages/shared/package.json` exporting `@noteapp/shared`
- `apps/backend/prisma/schema.prisma` — full schema from SDS §4.1 (User, Note, Tag, NoteTag, RefreshToken)
- `prisma migrate dev` run → initial migration file generated under `prisma/migrations/`
- Prisma Client generated successfully (`prisma generate`)
- Root `CLAUDE.md` (already created; verify it references `@AGENTS.md`)
- `apps/frontend/CLAUDE.md` — React/UI conventions
- `apps/backend/CLAUDE.md` — API/service/repository/DB rules
- `packages/shared/CLAUDE.md` — shared types/errors/contracts only rule
- `.claude/commands/` — implement, plan, pr, spec, tasks (already exist; verify)
- `.claude/agents/` — reviewer, test-writer (already exist; verify)
- Root ESLint + Prettier config (already present; verify passes)
- Husky + commitlint hooks (already present; verify)

### Out of Scope

- Any route, service, repository, or middleware implementation
- Frontend components, pages, hooks, or stores
- Auth logic (JWT, bcrypt) — AB-1002
- Notes CRUD — AB-1003
- Tags logic — AB-1004
- Seeding or test data
- `TEST_DATABASE_URL` test DB setup (configured per-ticket as needed)
- Pagination, search, file uploads (out of scope for entire project per FRS)

---

## Spec Scenarios

| ID     | Scenario                                    | Given                                                                  | When                                | Then                                                                                                                                                                                                                         |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SS-001 | Workspace installs cleanly                  | Fresh clone, `pnpm-workspace.yaml` present                             | `pnpm install`                      | Exit 0; all workspace deps resolve; no missing packages                                                                                                                                                                      |
| SS-002 | TypeScript compiles with 0 errors           | All `tsconfig.json` files wired with project references                | `pnpm build`                        | Exit 0; 0 errors, 0 warnings across all packages                                                                                                                                                                             |
| SS-003 | Lint passes with 0 warnings                 | ESLint config at root                                                  | `pnpm lint --max-warnings 0`        | Exit 0; 0 warnings, 0 errors                                                                                                                                                                                                 |
| SS-004 | Prisma schema matches SDS §4.1              | `schema.prisma` created                                                | Visual / `prisma validate`          | All 5 models present: User, Note, Tag, NoteTag, RefreshToken; fields + indexes match SDS exactly                                                                                                                             |
| SS-005 | Initial migration generated                 | `schema.prisma` valid; `DATABASE_URL` set                              | `prisma migrate dev --name init`    | Migration SQL file created under `prisma/migrations/`; DB schema applied                                                                                                                                                     |
| SS-006 | Prisma Client generated                     | Migration applied                                                      | `prisma generate`                   | Client generated without error; `@prisma/client` importable from backend                                                                                                                                                     |
| SS-007 | Shared error codes exported                 | `packages/shared/src/errors.ts` written                                | Import `@noteapp/shared`            | All 10 error code constants accessible: `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `REFRESH_EXPIRED`, `REFRESH_INVALID`, `UNAUTHORIZED`, `NOTE_NOT_FOUND`, `TAG_NOT_FOUND`, `TAG_NAME_TAKEN`, `VALIDATION_ERROR` |
| SS-008 | Workspace cross-references resolve          | `@noteapp/shared` declared as dep in backend + frontend `package.json` | `pnpm build` in backend or frontend | No "cannot find module @noteapp/shared" errors                                                                                                                                                                               |
| SS-009 | Folder structure matches SDS §2             | Scaffold complete                                                      | `ls` inspection                     | All directories present: `apps/frontend/src/{components,pages,hooks,stores,lib}`, `apps/backend/src/{routes,services,repositories,middleware,utils}`, `packages/shared/src/{types,schemas}`                                  |
| SS-010 | All CLAUDE.md files exist and are non-empty | Scaffold complete                                                      | File inspection                     | Root, `apps/frontend/`, `apps/backend/`, `packages/shared/` each contain a `CLAUDE.md` with package-relevant content                                                                                                         |
| SS-011 | Husky hooks active                          | `husky` installed; `prepare` script present                            | `git commit` with bad message       | commitlint rejects message that violates conventional commit format                                                                                                                                                          |
| SS-012 | Prettier format passes                      | `.prettierignore` + `prettier.config.js` present                       | `pnpm format:check`                 | Exit 0; no unformatted files                                                                                                                                                                                                 |

---

## API Delta

**None.** AB-1001 delivers no HTTP endpoints.

---

## DB Changes

Initial schema — all tables created by the first migration:

| Model          | Key Fields                                                                                                 | Notes                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `User`         | `id` (cuid), `email` (unique), `passwordHash`, `createdAt`, `updatedAt`                                    | Root entity                                |
| `Note`         | `id`, `userId` (FK→User), `title` (varchar 255), `content` (text?), `deletedAt`?, `createdAt`, `updatedAt` | Composite index on `[userId, deletedAt]`   |
| `Tag`          | `id`, `userId` (FK→User), `name` (varchar 50), `createdAt`                                                 | Unique constraint on `[userId, name]`      |
| `NoteTag`      | `noteId` (FK→Note), `tagId` (FK→Tag)                                                                       | Composite PK `[noteId, tagId]`; join table |
| `RefreshToken` | `id`, `userId` (FK→User), `token` (unique), `expiresAt`, `createdAt`                                       | Supports multiple devices                  |

Schema source: SDS §4.1 — do not deviate from field names, types, or constraints defined there.

---

## Assumptions

1. `DATABASE_URL` env var is set locally before running `prisma migrate dev` — not committed to the repo.
2. The root `CLAUDE.md` (already created) and `AGENTS.md` satisfy the root-level documentation requirement; this ticket verifies they exist, not rewrites them.
3. `.claude/commands/` and `.claude/agents/` files already exist from earlier setup; AB-1001 verifies their presence and correctness, not recreates them.
4. Per-package `CLAUDE.md` files contain real content (not placeholders) as clarified: frontend → React/UI conventions; backend → API/service/DB rules; shared → types/errors/contracts-only rule.
5. `pnpm format:check` is treated as a quality gate equivalent to lint for this ticket.
6. No test suite is written for AB-1001 — there is no business logic to test. Testing begins at AB-1002.
7. TypeScript project references used (not path aliases) for cross-package imports, consistent with pnpm workspaces + Prisma 5 / Node 22 constraints.
