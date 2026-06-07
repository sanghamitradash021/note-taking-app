# Plan: AB-1005 — Frontend SPA

## Pre-flight Observations

- `react-router-dom@^7.17.0` added to `apps/frontend/package.json`
- `@tanstack/react-query@^5`, `zustand@^5`, `react@^19` already installed
- Vite proxy already configured: `/api → http://localhost:3000`
- `packages/shared` exports `INoteResponse`, `ITag`, `ILoginUser`, `ILoginResponse`, `IRegisterResponse` — use directly; do not redefine
- No CSS framework installed — inline styles only
- Backend API fully operational on port 3000

---

## Files to Create

| File                                | Purpose                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/stores/authStore.ts`           | Zustand store with `persist`: `accessToken`, `refreshToken`, `user`, `setAuth`, `setAccessToken`, `clearAuth` |
| `src/lib/apiClient.ts`              | `apiFetch<T>` fetch wrapper + `ApiError` class; injects auth header; 401 → refresh → retry                    |
| `src/lib/auth.ts`                   | `register`, `login`, `logout` — call `/api/auth/*`; return typed responses                                    |
| `src/lib/notes.ts`                  | `listNotes`, `getNote`, `createNote`, `updateNote`, `deleteNote`, `attachTag`, `detachTag`                    |
| `src/lib/tags.ts`                   | `listTags`, `createTag`, `deleteTag`                                                                          |
| `src/hooks/useNotes.ts`             | TanStack Query wrappers for all note mutations + `useNotes` query                                             |
| `src/hooks/useTags.ts`              | TanStack Query wrappers for all tag mutations + `useTags` query                                               |
| `src/components/ProtectedRoute.tsx` | Reads `accessToken`; renders children or `<Navigate to="/login" />`                                           |
| `src/components/NoteForm.tsx`       | Controlled form: `title` (required) + `content` (optional); calls `onSave(title, content)`                    |
| `src/components/NoteCard.tsx`       | Note display + inline edit (NoteForm) + delete + tag attach/detach                                            |
| `src/pages/LoginPage.tsx`           | Login form; on success calls `setAuth` + `navigate('/')`                                                      |
| `src/pages/RegisterPage.tsx`        | Register form; on success auto-calls `login` + `setAuth` + `navigate('/')`                                    |
| `src/pages/NotesPage.tsx`           | Full app shell: header, tag sidebar, notes grid                                                               |

## Files to Modify

| File          | Change                                                                                |
| ------------- | ------------------------------------------------------------------------------------- |
| `src/App.tsx` | Replace placeholder with `BrowserRouter` + routes for `/`, `/login`, `/register`, `*` |

---

## Architecture Notes

### 1. Zustand selector discipline

Never return an object from a `useAuthStore` selector — always select primitives or stable references:

```typescript
// WRONG — new object every render → infinite re-render loop
const { user, refreshToken } = useAuthStore((s) => ({
  user: s.user,
  refreshToken: s.refreshToken,
}));

// RIGHT — separate primitive selectors
const user = useAuthStore((s) => s.user);
const refreshToken = useAuthStore((s) => s.refreshToken);
```

### 2. `apiFetch` — 401 retry flow

```
apiFetch(path, init)
  → build headers with current accessToken
  → fetch()
  → if res.status === 401
      → refreshAccessToken()
          → POST /api/auth/refresh with stored refreshToken
          → success: setAccessToken(newToken); return newToken
          → failure: clearAuth(); return null
      → if newToken: retry original fetch with new header
  → if still not ok: throw ApiError(message, code, status)
  → if 204: return undefined
  → return res.json()
```

### 3. TanStack Query invalidation

All mutations use `onSuccess: () => qc.invalidateQueries({ queryKey })`:

- Note mutations → invalidate `['notes']`
- Tag delete → invalidate `['tags']` + `['notes']` (tag removal reflects on note cards)
- Tag create → invalidate `['tags']`

### 4. NoteCard tag dropdown

Dropdown only shows tags not already attached to the note:

```typescript
const attachedIds = new Set(note.tags.map((t) => t.id));
const availableTags = allTags.filter((t) => !attachedIds.has(t.id));
```

`allTags` passed as prop from `NotesPage` (already fetched by `useTags`).

### 5. React Router v7 compatibility

`BrowserRouter` + `Routes` + `Route` from `react-router-dom` v7 is fully backwards-compatible with v6 usage patterns.

---

## Implementation Phases

### Phase 1 — Auth foundation

1. Create `src/stores/authStore.ts`
2. Create `src/lib/apiClient.ts`
3. Create `src/lib/auth.ts`

**Checkpoint:** `pnpm build` → `pnpm lint --max-warnings 0`

---

### Phase 2 — Data layer

4. Create `src/lib/notes.ts`
5. Create `src/lib/tags.ts`
6. Create `src/hooks/useNotes.ts`
7. Create `src/hooks/useTags.ts`

**Checkpoint:** `pnpm build` → `pnpm lint --max-warnings 0`

---

### Phase 3 — Components + pages

8. Create `src/components/ProtectedRoute.tsx`
9. Create `src/components/NoteForm.tsx`
10. Create `src/components/NoteCard.tsx`
11. Create `src/pages/LoginPage.tsx`
12. Create `src/pages/RegisterPage.tsx`
13. Create `src/pages/NotesPage.tsx`
    - Header `backgroundColor` must be `#add8e6` (light blue); do **not** use black or `#000`

**Checkpoint:** `pnpm build` → `pnpm lint --max-warnings 0`

---

### Phase 5 — UI Colour Fix

15. Update `src/pages/NotesPage.tsx` header: set `backgroundColor: '#add8e6'`; remove any black/`#000` value

**Checkpoint:** `pnpm build` → `pnpm lint --max-warnings 0`

---

### Phase 4 — Router wiring

14. Replace `src/App.tsx` with `BrowserRouter` + all routes

**Checkpoint:** `pnpm build` → `pnpm lint --max-warnings 0`

---

### Final Gate

```bash
pnpm build              # 0 errors, 0 warnings
pnpm lint --max-warnings 0
```

Manually verify in browser: register → notes page → create note → create tag → attach tag → edit note → delete note → sign out → redirect to login.
