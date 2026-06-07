Break into implementation tasks for: $ARGUMENTS

Steps:

1. Read openspec/changes/$ARGUMENTS/spec.md
2. Read openspec/changes/$ARGUMENTS/plan.md
3. Generate openspec/changes/$ARGUMENTS/tasks.md as a checkbox checklist:

   Phase 1 — Foundation
   - [ ] shared types (packages/shared)
   - [ ] Zod schemas (packages/shared)
   - [ ] DB migration (prisma schema + migrate dev)
   - CHECKPOINT: pnpm build → pnpm lint → pnpm test

   Phase 2 — Implementation
   - [ ] repository layer
   - [ ] service layer
   - [ ] route handlers + middleware
   - CHECKPOINT: pnpm build → pnpm lint → pnpm test

   Phase 3 — Tests (one task per spec scenario — happy path + ALL error paths + edge cases)
   - [ ] AC-xxx-01: <scenario name>
   - [ ] AC-xxx-02: <scenario name>
   - ... (every row in openspec/changes/$ARGUMENTS/spec.md scenarios table)
   - CHECKPOINT: pnpm build → pnpm lint → pnpm test --coverage

4. Wait for human approval before any implementation

Format: /tasks AB-1002
