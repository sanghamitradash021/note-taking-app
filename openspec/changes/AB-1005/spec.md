# Spec: AB-1005 — Frontend SPA (Auth + Notes + Tags)

## Summary

Build the React 19 frontend SPA. Authenticated users can register, log in, manage notes (create, edit, soft-delete), manage tags (create, delete), and attach/detach tags on notes. TanStack Query handles all server state; Zustand persists auth tokens; React Router v7 guards protected routes.

---

## FRS References

- FR-AUTH-001 — Registration
- FR-AUTH-002 — Login + JWT
- FR-AUTH-003 — Logout
- FR-NOTES-001 — Notes CRUD
- FR-TAGS-001 — Tag Management

---

## Scope

### In Scope

- `src/stores/authStore.ts` — Zustand store with `persist` middleware: `accessToken`, `refreshToken`, `user`
- `src/lib/apiClient.ts` — fetch wrapper: injects `Authorization` header, auto-refreshes on 401, exposes `ApiError`
- `src/lib/auth.ts` — `register`, `login`, `logout` API functions
- `src/lib/notes.ts` — `listNotes`, `getNote`, `createNote`, `updateNote`, `deleteNote`, `attachTag`, `detachTag`
- `src/lib/tags.ts` — `listTags`, `createTag`, `deleteTag`
- `src/hooks/useNotes.ts` — TanStack Query hooks: `useNotes`, `useCreateNote`, `useUpdateNote`, `useDeleteNote`, `useAttachTag`, `useDetachTag`
- `src/hooks/useTags.ts` — TanStack Query hooks: `useTags`, `useCreateTag`, `useDeleteTag`
- `src/components/ProtectedRoute.tsx` — redirects unauthenticated users to `/login`
- `src/components/NoteForm.tsx` — create/edit form with title + content fields
- `src/components/NoteCard.tsx` — displays a note; inline edit, delete, attach/detach tags
- `src/pages/LoginPage.tsx` — email + password form; on success stores tokens + navigates to `/`
- `src/pages/RegisterPage.tsx` — email + password form; on success auto-logs in + navigates to `/`
- `src/pages/NotesPage.tsx` — header with sign-out, tag sidebar, notes grid
- `src/App.tsx` — React Router v7 `BrowserRouter` with `/`, `/login`, `/register` routes

### Out of Scope

- Password reset
- Email verification
- Pagination / search / filtering
- Offline support
- Unit or integration tests for the frontend
- shadcn/ui or Tailwind (not installed; uses inline styles)

---

## Spec Scenarios

| ID             | Scenario                        | Given                                     | Action                               | Then                                                                  |
| -------------- | ------------------------------- | ----------------------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| AC-FE-AUTH-01  | Register new account            | `/register` page                          | Submit valid email + strong password | Auto-login; redirect to `/`; notes page shown                         |
| AC-FE-AUTH-02  | Register — duplicate email      | Email already exists                      | Submit form                          | Error message shown; stays on `/register`                             |
| AC-FE-AUTH-03  | Login                           | `/login` page                             | Submit valid credentials             | Tokens stored; redirect to `/`; notes page shown                      |
| AC-FE-AUTH-04  | Login — wrong password          | Valid email, wrong password               | Submit form                          | Error message shown; stays on `/login`                                |
| AC-FE-AUTH-05  | Sign out                        | Authenticated; click "Sign out"           | —                                    | Tokens cleared; redirected to `/login`                                |
| AC-FE-AUTH-06  | Unauthenticated access          | No token in store                         | Navigate to `/`                      | Redirected to `/login`                                                |
| AC-FE-AUTH-07  | Token auto-refresh              | Access token expired; refresh token valid | Any API call returns 401             | `apiClient` refreshes silently; request retried; user unaware         |
| AC-FE-AUTH-08  | Refresh token expired           | Both tokens expired                       | Any API call returns 401 on retry    | Auth cleared; user redirected to `/login`                             |
| AC-FE-NOTES-01 | View notes list                 | Authenticated; 3 notes exist              | Load `/`                             | 3 note cards shown; deleted notes absent                              |
| AC-FE-NOTES-02 | Create note                     | Click "+ New note"; fill title            | Submit form                          | New card appears in grid; form closes                                 |
| AC-FE-NOTES-03 | Create note — missing title     | Leave title blank                         | Submit form                          | Client-side error shown; no API call                                  |
| AC-FE-NOTES-04 | Edit note                       | Click ✏️ on a card                        | Update title; submit                 | Card updates in place; `updatedAt` refreshed                          |
| AC-FE-NOTES-05 | Delete note                     | Click 🗑️ on a card                        | —                                    | Card removed from grid; note soft-deleted                             |
| AC-FE-TAGS-01  | Create tag                      | Type name in sidebar; click "Add"         | —                                    | Tag appears in sidebar list                                           |
| AC-FE-TAGS-02  | Delete tag                      | Click × next to tag in sidebar            | —                                    | Tag removed from sidebar; detached from all cards                     |
| AC-FE-TAGS-03  | Attach tag to note              | Select tag from dropdown on card          | —                                    | Tag badge appears on card                                             |
| AC-FE-TAGS-04  | Detach tag from note            | Click × on tag badge on card              | —                                    | Badge removed from card                                               |
| AC-FE-UI-01    | Navbar background is light blue | Load any authenticated page               | —                                    | Header `backgroundColor` renders as `#add8e6` (light blue), not black |

---

## Component Tree

```
App (BrowserRouter)
├── /login          → LoginPage
├── /register       → RegisterPage
└── / (protected)  → ProtectedRoute → NotesPage
                         ├── header (logo + user email + sign-out)
                         ├── aside  (Tags sidebar)
                         │     ├── tag list (name + × delete button)
                         │     └── new-tag form (input + "Add" button)
                         └── main
                               ├── "+ New note" button
                               ├── NoteForm (when creating)
                               └── notes grid
                                     └── NoteCard[]
                                           ├── title + ✏️ + 🗑️
                                           ├── content (optional)
                                           ├── tag badges (name + × detach)
                                           ├── "+ tag" select dropdown
                                           └── updatedAt date
```

---

## Data Flow

```
User action
  ↓
Page / Component  →  calls mutation hook  →  useMutation (TanStack Query)
                                                ↓
                                          lib function (notes.ts / tags.ts)
                                                ↓
                                          apiFetch (apiClient.ts)
                                                ↓  injects Bearer token
                                          Backend API  (:3000 via Vite proxy)
                                                ↓
                                          onSuccess → invalidateQueries → useQuery refetch → UI update
```

---

## Auth Token Lifecycle

1. `login()` / `register()` → `setAuth(accessToken, refreshToken, user)` → persisted to `localStorage` via Zustand `persist`
2. Every `apiFetch` reads `accessToken` from `useAuthStore.getState()`
3. On 401 → `refreshAccessToken()` → `POST /api/auth/refresh` → `setAccessToken(newToken)`
4. On refresh failure → `clearAuth()` → Zustand clears store + `localStorage`
5. `ProtectedRoute` reads `accessToken`; null → `<Navigate to="/login" />`

---

## Routing

| Path        | Component                          | Auth required |
| ----------- | ---------------------------------- | ------------- |
| `/login`    | `LoginPage`                        | No            |
| `/register` | `RegisterPage`                     | No            |
| `/`         | `NotesPage` (via `ProtectedRoute`) | Yes           |
| `*`         | Redirect to `/`                    | —             |

---

## Assumptions

1. **No CSS framework** — all styles via inline `React.CSSProperties` objects co-located with components.
2. **Zustand selector pattern** — each `useAuthStore` call uses a primitive selector (`(s) => s.accessToken`) to avoid object-reference churn causing infinite re-renders.
3. **Token storage** — `localStorage` via Zustand `persist` middleware; acceptable for this tutorial scope.
4. **Vite proxy** — `/api` on the frontend dev server (any port) proxies to `http://localhost:3000`; no CORS config needed.
5. **react-router-dom v7** — `BrowserRouter` + `Routes` + `Route` API used (v6-compatible surface still supported in v7).
6. **No error boundaries** — API errors surface as inline text messages within forms/components.
7. **TanStack Query invalidation strategy** — all mutations invalidate the relevant top-level query key (`['notes']` or `['tags']`); no optimistic updates.
