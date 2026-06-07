Implement ticket: $ARGUMENTS

Before writing a single line of code, read ALL of these in order:

1. AGENTS.md
2. docs/FRS.md — business rules for this ticket
3. docs/SDS.md — API contracts (§5), error codes (§6), layer rules (§3)
4. apps/backend/CLAUDE.md (if it exists)
5. openspec/changes/$ARGUMENTS/spec.md
6. openspec/changes/$ARGUMENTS/plan.md
7. openspec/changes/$ARGUMENTS/tasks.md

Implementation rules:

- Ask [y/n] before writing or overwriting any file
- Work through tasks.md phase by phase — never skip a phase
- After every phase checkpoint: run pnpm build, pnpm lint --max-warnings 0, pnpm test
- Stop immediately if any checkpoint fails — fix it before continuing
- Error codes in code MUST exactly match the codes table in docs/SDS.md §6
- HTTP status codes MUST exactly match the API contracts in docs/SDS.md §5
- All types and Zod schemas go in packages/shared — never inline in backend or frontend
- Route handlers call services only — no Prisma, no business logic in routes
- Services call repositories only — no Prisma directly in services
- Repositories contain all Prisma calls — nothing else

When implementation is complete, output:

- ## Files Changed (path + what changed)
- ## Spec Scenarios Covered (AC-id → test name)
- ## FRS Requirements Covered (FR-xxx → where implemented)
- ## Assumptions Made

Format: /implement AB-1002
