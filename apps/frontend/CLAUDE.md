# apps/frontend — Rules

## State Management

- **Server state** (notes, tags, auth API calls): TanStack Query (`useQuery`, `useMutation`) only
- **Client state** (auth tokens, user session): Zustand store in `src/stores/`
- No `useState` for data that comes from the API

## API Calls

- All `fetch` / HTTP calls live in `src/lib/` only — never inline in components or hooks
- Hooks in `src/hooks/` wrap TanStack Query and call `src/lib/` functions
- Components call hooks — never `fetch` directly

## Component Rules

- PascalCase filenames and component names (`NoteCard.tsx`, `export function NoteCard`)
- One component per file
- No business logic in components — derive from query data or call mutation hooks

## TypeScript

- `strict: true` enforced by tsconfig
- No `any` types
- Import shared types from `@noteapp/shared` — never redefine `INote`, `ITag`, etc.

## Naming

| Artifact    | Convention                 | Example        |
| ----------- | -------------------------- | -------------- |
| Component   | PascalCase                 | `NoteCard.tsx` |
| Custom hook | camelCase + `use` prefix   | `useNotes.ts`  |
| Store       | camelCase + `Store` suffix | `authStore.ts` |
| Lib file    | camelCase                  | `apiClient.ts` |
