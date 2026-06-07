# Functional Requirements Specification

## Note Taking Application — Tutorial Edition

**Version:** 1.0 | **Status:** Draft | **Date:** June 2025
**Project:** Note Taking App (Spec-Driven Development Tutorial)

---

## 1. Introduction

### 1.1 Purpose

This document defines the functional requirements for a simple Note Taking Application built as a Spec-Driven Development tutorial. Every ticket, spec, and test must trace back to a requirement listed here.

### 1.2 Product Vision

A web-based note-taking app where authenticated users can create, organise, and manage personal notes with optional tags.

### 1.3 Scope

**In Scope:**

- User authentication — register, login, logout
- Notes — create, read, update, soft-delete
- Tags — create, delete, attach to notes, detach from notes

**Out of Scope (do not build these):**

- Password reset / OTP flow
- Full-text search
- Public sharing / shareable links
- Version history / snapshots
- Pagination, sorting, or filtering
- File or image attachments
- OAuth / social login
- Real-time collaboration

---

## 2. User Roles

| Role                 | Description              | Access                          |
| -------------------- | ------------------------ | ------------------------------- |
| Unauthenticated User | Visitor with no session  | Auth endpoints only             |
| Authenticated User   | Registered and logged-in | Full CRUD on own notes and tags |

---

## 3. Authentication

### 3.1 Register (FR-AUTH-001)

The system SHALL allow a new user to register with an email and password.

**Business Rules:**

- Email MUST be unique across all accounts
- Password MUST be at least 8 characters with at least one uppercase letter, one lowercase letter, and one digit
- Email MUST be normalised to lowercase before storage
- Passwords MUST be hashed with bcrypt (cost factor ≥ 10) — never stored as plaintext

**Acceptance Criteria:**

| ID        | Scenario                 | Given                              | When                    | Then                                  |
| --------- | ------------------------ | ---------------------------------- | ----------------------- | ------------------------------------- |
| AC-REG-01 | Successful registration  | Valid email + strong password      | POST /api/auth/register | 201 + `{ userId }`                    |
| AC-REG-02 | Duplicate email          | Email already registered           | POST /api/auth/register | 422; error code `EMAIL_TAKEN`         |
| AC-REG-03 | Weak password            | Password shorter than 8 chars      | POST /api/auth/register | 400; `fields: ["password"]`           |
| AC-REG-04 | Missing email            | No email in request body           | POST /api/auth/register | 400; `fields: ["email"]`              |
| AC-REG-05 | Email case normalisation | Email submitted as `USER@TEST.COM` | POST /api/auth/register | Stored and matched as `user@test.com` |

---

### 3.2 Login (FR-AUTH-002)

The system SHALL authenticate registered users and return a JWT access token (15-minute expiry) and a refresh token (7-day expiry) stored in the database.

**Business Rules:**

- Invalid credentials MUST return a generic 401 — do not reveal which field is wrong
- Access token returned in response body
- Refresh token stored in DB and returned in response body
- Token signed with HS256, secret ≥ 32 characters

**Acceptance Criteria:**

| ID          | Scenario             | Given                         | When                   | Then                                 |
| ----------- | -------------------- | ----------------------------- | ---------------------- | ------------------------------------ |
| AC-LOGIN-01 | Successful login     | Valid credentials             | POST /api/auth/login   | 200 + `accessToken` + `refreshToken` |
| AC-LOGIN-02 | Wrong password       | Correct email, wrong password | POST /api/auth/login   | 401; generic message, no field hint  |
| AC-LOGIN-03 | Unknown email        | Email not in DB               | POST /api/auth/login   | 401; same message as AC-LOGIN-02     |
| AC-LOGIN-04 | Missing credentials  | Empty body                    | POST /api/auth/login   | 400; `fields: ["email", "password"]` |
| AC-LOGIN-05 | Expired access token | Token older than 15 minutes   | Any protected endpoint | 401; code `TOKEN_EXPIRED`            |

---

### 3.3 Logout (FR-AUTH-003)

The system SHALL allow an authenticated user to invalidate their current session by deleting the refresh token from the database.

**Acceptance Criteria:**

| ID           | Scenario               | Given                               | When                  | Then                               |
| ------------ | ---------------------- | ----------------------------------- | --------------------- | ---------------------------------- |
| AC-LOGOUT-01 | Successful logout      | Authenticated user with valid token | POST /api/auth/logout | 204; refresh token deleted from DB |
| AC-LOGOUT-02 | Unauthenticated logout | No auth header                      | POST /api/auth/logout | 401; code `UNAUTHORIZED`           |

---

## 4. Notes

### 4.1 Notes CRUD (FR-NOTES-001)

The system SHALL allow authenticated users to create, read, update, and soft-delete their own notes.

**Business Rules:**

- A note MUST belong to exactly one user
- Users MUST NOT access, edit, or delete another user's notes
- Soft-delete MUST set a `deletedAt` timestamp — the row MUST NOT be physically removed
- Soft-deleted notes MUST NOT appear in list or fetch responses
- Note title is REQUIRED and MUST NOT exceed 255 characters
- Note content is optional

**Acceptance Criteria:**

| ID          | Scenario                        | Given                            | When                    | Then                                      |
| ----------- | ------------------------------- | -------------------------------- | ----------------------- | ----------------------------------------- |
| AC-NOTES-01 | Create note                     | Authenticated user + valid title | POST /api/notes         | 201 + full note object                    |
| AC-NOTES-02 | Create without title            | No title in body                 | POST /api/notes         | 400; `fields: ["title"]`                  |
| AC-NOTES-03 | List own notes                  | Authenticated user with 3 notes  | GET /api/notes          | 200; array of 3 notes                     |
| AC-NOTES-04 | Read own note                   | Note owned by current user       | GET /api/notes/:id      | 200 + note object                         |
| AC-NOTES-05 | Read another user's note        | Note owned by different user     | GET /api/notes/:id      | 404 (do not reveal existence)             |
| AC-NOTES-06 | Update note                     | Own note + new title             | PATCH /api/notes/:id    | 200 + updated note; `updatedAt` refreshed |
| AC-NOTES-07 | Soft-delete note                | Own note                         | DELETE /api/notes/:id   | 204; `deletedAt` set; row still in DB     |
| AC-NOTES-08 | Deleted note excluded from list | Note with `deletedAt` set        | GET /api/notes          | 200; deleted note NOT in array            |
| AC-NOTES-09 | Unauthenticated access          | No auth header                   | Any /api/notes endpoint | 401; code `UNAUTHORIZED`                  |

---

## 5. Tags

### 5.1 Tag Management (FR-TAGS-001)

The system SHALL allow authenticated users to create and delete their own tags, and attach or detach tags from their notes.

**Business Rules:**

- Tag name MUST be unique per user (case-insensitive)
- Tag name MUST NOT exceed 50 characters
- Deleting a tag MUST remove it from all notes but MUST NOT delete the notes
- A user MUST NOT see or use another user's tags

**Acceptance Criteria:**

| ID        | Scenario                    | Given                             | When                              | Then                                              |
| --------- | --------------------------- | --------------------------------- | --------------------------------- | ------------------------------------------------- |
| AC-TAG-01 | Create tag                  | Authenticated user + unique name  | POST /api/tags                    | 201 + `{ id, name }`                              |
| AC-TAG-02 | Duplicate tag name          | Name already exists for this user | POST /api/tags                    | 422; code `TAG_NAME_TAKEN`                        |
| AC-TAG-03 | List tags                   | User with 2 tags                  | GET /api/tags                     | 200; array of 2 tags                              |
| AC-TAG-04 | Delete tag                  | Own tag attached to 2 notes       | DELETE /api/tags/:id              | 204; notes still exist; tag removed from them     |
| AC-TAG-05 | Attach tag to note          | Own tag + own note                | POST /api/notes/:id/tags/:tagId   | 200; note's tags array includes the tag           |
| AC-TAG-06 | Detach tag from note        | Tag currently on note             | DELETE /api/notes/:id/tags/:tagId | 200; note's tags array no longer includes the tag |
| AC-TAG-07 | Cannot use other user's tag | Tag owned by different user       | POST /api/notes/:id/tags/:tagId   | 404                                               |

---

## 6. Non-Functional Requirements

| Requirement      | Target                                   |
| ---------------- | ---------------------------------------- |
| Test coverage    | ≥ 80% on all new code                    |
| TypeScript       | Strict mode; no `any` types              |
| Lint             | 0 warnings (`--max-warnings 0`)          |
| Password storage | bcrypt, never plaintext                  |
| Token security   | JWT secret from env var, never hardcoded |

---

## 7. Requirement Traceability Matrix

| Requirement ID | Feature              | Ticket  |
| -------------- | -------------------- | ------- |
| FR-AUTH-001    | Registration         | AB-1002 |
| FR-AUTH-002    | Login + JWT          | AB-1002 |
| FR-AUTH-003    | Logout               | AB-1002 |
| FR-NOTES-001   | Notes CRUD           | AB-1003 |
| FR-TAGS-001    | Tags + attach/detach | AB-1004 |
