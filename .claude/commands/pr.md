Prepare PR for: $ARGUMENTS

Steps:

1. Run quality suite in this exact order — fix any failure before continuing:
   pnpm build
   pnpm lint --max-warnings 0
   pnpm test --coverage
   npx commitlint --from HEAD~1

2. Run: git diff main --stat

3. Read openspec/changes/$ARGUMENTS/spec.md
   Read docs/FRS.md

4. Generate a conventional commit message:
   feat(scope): short description AB#XXXX
   - bullet: what was added
   - bullet: what was changed
   - bullet: tests added

   Relates to AB#XXXX

5. Ask: "Run git add . && git commit with this message? [y/n]"

6. Generate PR description:

   ## What Changed

   ## FRS Requirements Covered (requirement ID + description, one per line)

   ## Spec Scenarios Tested (AC-id + scenario name, one per line)

   ## Out of Scope (confirm nothing from the out-of-scope list was built)

   ## Checklist
   - [ ] pnpm build: 0 errors
   - [ ] pnpm lint: 0 warnings
   - [ ] pnpm test: all green
   - [ ] coverage ≥ 80% on new code
   - [ ] /review shows all ✅
   - [ ] moved openspec/changes/$ARGUMENTS/ to openspec/archive/$ARGUMENTS/

7. Remind: "Run this before pushing:
   mv openspec/changes/$ARGUMENTS openspec/archive/$ARGUMENTS"
   Ask: "Done? [y/n]"

8. Ask: "Run git push and open PR? [y/n]"

Format: /pr AB-1002
