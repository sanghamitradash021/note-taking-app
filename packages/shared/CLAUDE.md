# packages/shared — Rules

This package is the **single source of truth** for all shared contracts.

## What lives here (and ONLY here)

- `src/types/` — TypeScript interfaces (`I` prefix, PascalCase)
- `src/schemas/` — Zod validation schemas (`camelCase` + `Schema` suffix)
- `src/errors.ts` — Error code constants and `ErrorCode` union type

## What does NOT live here

- Business logic
- Prisma imports or DB types
- Express/React imports
- Any runtime code beyond type-safe constants

## Import rule

Both `apps/backend` and `apps/frontend` MUST import all shared types and error codes from `@noteapp/shared`.
Never define interfaces or Zod schemas inline in backend or frontend — add them here first.

## Naming

| Artifact            | Convention                  | Example            |
| ------------------- | --------------------------- | ------------------ |
| Interface           | PascalCase + `I` prefix     | `INote`            |
| Zod schema          | camelCase + `Schema` suffix | `createNoteSchema` |
| Error code constant | SCREAMING_SNAKE_CASE        | `NOTE_NOT_FOUND`   |
