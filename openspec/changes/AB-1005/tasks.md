# Tasks: AB-1005 — Frontend SPA

---

## Phase 1 — Auth Foundation

- [x] Add `react-router-dom` dependency to `apps/frontend/package.json`
- [x] Create `src/stores/authStore.ts` — Zustand store with `persist`: `accessToken`, `refreshToken`, `user`, `setAuth`, `setAccessToken`, `clearAuth`
- [x] Create `src/lib/apiClient.ts` — `apiFetch<T>` with auth header injection, 401 auto-refresh, `ApiError` class
- [x] Create `src/lib/auth.ts` — `register(email, password)`, `login(email, password)`, `logout(refreshToken)`

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0`

---

## Phase 2 — Data Layer

- [x] Create `src/lib/notes.ts` — `listNotes`, `getNote`, `createNote`, `updateNote`, `deleteNote`, `attachTag`, `detachTag`
- [x] Create `src/lib/tags.ts` — `listTags`, `createTag`, `deleteTag`
- [x] Create `src/hooks/useNotes.ts` — `useNotes`, `useCreateNote`, `useUpdateNote`, `useDeleteNote`, `useAttachTag`, `useDetachTag`
- [x] Create `src/hooks/useTags.ts` — `useTags`, `useCreateTag`, `useDeleteTag`

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0`

---

## Phase 3 — Components + Pages

- [x] Create `src/components/ProtectedRoute.tsx` — reads `accessToken`; renders children or `<Navigate to="/login" />`
- [x] Create `src/components/NoteForm.tsx` — controlled form: title (required) + content (optional); `onSave` / `onCancel` props
- [x] Create `src/components/NoteCard.tsx` — note display, inline edit via `NoteForm`, delete, tag attach/detach dropdown, tag badge × buttons
- [x] Create `src/pages/LoginPage.tsx` — login form with error display; on success `setAuth` + `navigate('/')`
- [x] Create `src/pages/RegisterPage.tsx` — register form; on success auto-login + `setAuth` + `navigate('/')`
- [x] Create `src/pages/NotesPage.tsx` — header (logo + email + sign-out), tag sidebar, "+ New note" button, notes grid

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0`

---

## Phase 4 — Router Wiring

- [x] Replace `src/App.tsx` placeholder with `BrowserRouter` + routes: `/login`, `/register`, `/` (protected), `*` → redirect to `/`

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0`

---

## Phase 5 — UI Colour Fix

- [x] Update `src/pages/NotesPage.tsx` header: change `backgroundColor` to `#add8e6` (light blue); remove black/`#000`

**CHECKPOINT:** `pnpm build` → `pnpm lint --max-warnings 0`

---

## Bug Fixes

- [x] Fix blank page after login — `NotesPage` was using object selector `useAuthStore(s => ({ ... }))` causing infinite re-render loop; replaced with individual primitive selectors

---

## Acceptance Criteria Verification

- [ ] AC-FE-AUTH-01: Register → auto-login → notes page shown
- [ ] AC-FE-AUTH-02: Duplicate email → error message on register page
- [ ] AC-FE-AUTH-03: Login → tokens stored → notes page shown
- [ ] AC-FE-AUTH-04: Wrong password → error message on login page
- [ ] AC-FE-AUTH-05: Sign out → tokens cleared → redirect to `/login`
- [ ] AC-FE-AUTH-06: No token → navigate to `/` → redirect to `/login`
- [ ] AC-FE-NOTES-01: Notes list loads on `/`
- [ ] AC-FE-NOTES-02: Create note → card appears in grid
- [ ] AC-FE-NOTES-03: Missing title → client-side error; no API call
- [ ] AC-FE-NOTES-04: Edit note → card updates in place
- [ ] AC-FE-NOTES-05: Delete note → card removed from grid
- [ ] AC-FE-TAGS-01: Create tag → appears in sidebar
- [ ] AC-FE-TAGS-02: Delete tag → removed from sidebar + all note cards
- [ ] AC-FE-TAGS-03: Attach tag → badge appears on note card
- [ ] AC-FE-TAGS-04: Detach tag → badge removed from note card
- [ ] AC-FE-UI-01: Navbar background is light blue (`#add8e6`) on authenticated pages

---

## Final Gate

```bash
pnpm build              # 0 errors, 0 warnings
pnpm lint --max-warnings 0
```
