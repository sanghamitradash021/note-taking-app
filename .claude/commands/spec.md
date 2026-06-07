Run spec creation for ticket: $ARGUMENTS

Steps:

1. Read docs/FRS.md — find every acceptance criterion for this ticket
2. Read docs/SDS.md — find the API contracts, error codes, and DB changes for this ticket
3. Read AGENTS.md — understand architecture constraints
4. Ask 3 to 5 clarifying questions about edge cases before writing anything
5. Create folder openspec/changes/$ARGUMENTS/ if it does not exist
6. Generate openspec/changes/$ARGUMENTS/spec.md with these exact sections:
   - ## Summary (one sentence)
   - ## FRS References (list the FR-xxx IDs this ticket covers)
   - ## Scope — In Scope and Out of Scope
   - ## Spec Scenarios (table: ID | Scenario | Given | When | Then — must include every AC row from FRS for this ticket, plus any edge cases identified in clarifications)
   - ## API Delta (new or modified endpoints with request/response shapes from SDS)
   - ## DB Changes (new tables or columns, or "none")
   - ## Assumptions
7. Do NOT write any implementation code
8. Wait for human approval of spec.md before stopping

Format: /spec AB-1002
