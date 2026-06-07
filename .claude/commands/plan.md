Create technical plan for: $ARGUMENTS

Steps:

1. Read openspec/changes/$ARGUMENTS/spec.md
2. Read docs/SDS.md — architecture (§3), DB schema (§4), API contracts (§5), error codes (§6)
3. Read AGENTS.md — naming conventions, layer rules
4. Scan existing code in apps/backend/src and packages/shared/src for reusable patterns
5. Generate openspec/changes/$ARGUMENTS/plan.md with:
   - ## Files to Create (exact path + one-line purpose for each)
   - ## Files to Modify (exact path + what changes)
   - ## Shared Package Additions (types and schemas to add to packages/shared)
   - ## DB Migration (prisma schema changes, or "none")
   - ## TypeScript Interfaces (final shapes matching SDS contracts)
   - ## Architecture Notes (any decisions that need calling out)
   - ## Phase Checkpoints (build + lint + test commands after each phase)
6. Wait for human approval before any implementation

Format: /plan AB-1002
