# NEXUS Admin Portal: Member Management System (Phase 5)

This document describes the actual, verified implementation of the **Member Management System** in Phase 5 of the NEXUS Admin Portal. It serves as the authoritative technical record of the SQLite-backed member registry, route bindings, CRUD operations, identifier stability guarantees, status lifecycle, validation rules, and automated testing.

---

## 1. Overview & Primary Objective

The Member Management System turns `/admin/members` from a placeholder into a complete, SQLite-backed administrative module. Administrators can view, filter, search, create, inspect, edit, and change statuses for club members without touching raw SQLite files or using mock data.

In accordance with strict phase guardrails:
- **No Cloudinary uploads**: Image fields accept URLs/paths; dedicated asset uploading is reserved for later phases.
- **No bulk CSV/JSON imports/exports**: Handled in dedicated import phases.
- **No E-ID redesign**: Existing public E-ID card renderer (`/memberID/:slug/:uniqueId`) and public API (`/api/eid/*`) remain 100% untouched and functional.
- **No public website redesign**: Public showcase pages (`/`, `/about`, `/projects`, `/team`, `/contact`) remain intact.
- **Zero fake data or decorative metrics**: Real records from `data/nexus.db` are queried.

---

## 2. Database Schema & Fields Actually Used

The members table in `data/nexus.db` was defined in initial migrations and aligned in `004_eid_member_foundation` and `005_admin_database_foundation`.

### Active Fields in SQLite:

| Column Name | SQLite Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | Internal surrogate record key (e.g. `mem-1789888149124-9a6043`). |
| `unique_id` | `TEXT` | `UNIQUE` (`idx_members_unique_id`) | Stable public identifier (e.g. `NX-001`, `NX-026`). Permanent identity. |
| `slug` | `TEXT` | `UNIQUE` (`idx_members_slug`) | Normalized URL slug (e.g. `orosmit-mishra`). |
| `public_id` | `TEXT` | `UNIQUE` (`idx_members_public_id`) | Synonymous with `slug` for backward compatibility with older services. |
| `name` | `TEXT` | `NOT NULL` | Member's full official name. |
| `display_name` | `TEXT` | `NULL` | Optional preferred display name. |
| `email` | `TEXT` | `UNIQUE` (`idx_members_email`) | Unique institutional or personal contact email. |
| `role` | `TEXT` | `NOT NULL` | Primary team role (e.g. `Lead Architect`, `Core Team Member`). |
| `domain` | `TEXT` | `NULL` | Specialization track (e.g. `Engineering & Design`, `Research & Innovation`). |
| `department` | `TEXT` | Default `'ENGINEERING'` | Department grouping (`ENGINEERING`, `DESIGN`, `OPERATIONS`, `RESEARCH`, `COMMUNITY`). |
| `bio` | `TEXT` | `NULL` | Brief biography or responsibilities summary. |
| `photo_url` | `TEXT` | `NULL` | URL or relative path to profile photo. |
| `profile_image_url` | `TEXT` | `NULL` | Synced with `photo_url` for media readiness. |
| `profile_image_public_id`| `TEXT` | `NULL` | Cloudinary asset public ID placeholder for future media phases. |
| `image_position` | `TEXT` | `NULL` | CSS object-position coordinate (e.g. `center 20%`). |
| `social_links` | `TEXT` | `NULL` | JSON stringified object of social profile links (GitHub, LinkedIn, Twitter). |
| `status` | `TEXT` | Default `'ACTIVE'` | Member status: `'ACTIVE'`, `'INACTIVE'`, or `'ALUMNI'`. |
| `clearance_level` | `TEXT` | Default `'LVL-03 // SPEC'` | E-ID card clearance specification. |
| `special_word` | `TEXT` | Default `'VISIONARY'` | E-ID card hallmark descriptor. |
| `quote` | `TEXT` | `NULL` | Member personal motto/quote. |
| `node_location` | `TEXT` | Default `'SOA LAB 204 // BHUBANESWAR'` | Campus lab node reference. |
| `frequency` | `TEXT` | Default `'108.40 MHz'` | E-ID frequency identifier. |
| `security_zone` | `TEXT` | Default `'SEC // ALPHA'` | E-ID security zone tier. |
| `badge_issue` | `TEXT` | Default `'2026.Q1'` | E-ID badge issuance batch. |
| `skills` | `TEXT` | Default `'[]'` | JSON stringified array of technical skills. |
| `current_focus` | `TEXT` | `NULL` | Current project/research focus area. |
| `fun_fact` | `TEXT` | `NULL` | Personal trivia for E-ID card. |
| `joined_date` | `TEXT` | `NULL` | Date of joining (`YYYY-MM-DD`). |
| `joined_at` | `TEXT` | `NULL` | Synced with `joined_date`. |
| `created_at` | `TEXT` | `NOT NULL` | ISO 8601 creation timestamp. |
| `updated_at` | `TEXT` | `NOT NULL` | ISO 8601 last update timestamp. |

---

## 3. Stable Unique ID & Slug Generation Rules

### Unique ID (`unique_id`):
1. **Format**: Strictly conforms to `^NX-[0-9]{3,}$` (e.g. `NX-001`, `NX-026`, `NX-030`).
2. **Sequential Assignment**: When creating a member without a custom `uniqueId`, `membersService.getNextUniqueId()` scans all existing records, finds the maximum numeric suffix, and assigns `NX-(max + 1)` zero-padded to 3+ digits.
3. **Database Uniqueness**: Enforced by SQLite unique index `idx_members_unique_id`.
4. **Permanent Immutability**:
   - `unique_id` is never regenerated or recalculated when a member's name, email, role, or status changes.
   - Deleted or gapped IDs are never recycled automatically.
   - An administrator cannot accidentally reassign or overwrite an existing member's `unique_id`.

### URL Slug (`slug`):
1. **Normalization**: Slugs are generated using `slugify(name)`:
   - Lowercased
   - Stripped of special punctuation (`/[^a-z0-9\s-]/g`)
   - Whitespace converted to single hyphens (`-`)
   - Leading and trailing hyphens stripped
   - Example: `"Orosmit Mishra"` → `"orosmit-mishra"`.
2. **Database Uniqueness**: Enforced by SQLite unique index `idx_members_slug`.
3. **Preservation**: Editing a member's name does **not** auto-mutate their public URL slug, preventing breaking public routes and QR codes.

---

## 4. Administrative APIs Created / Aligned

All endpoints are mounted in `backend/domains/admin/admin.routes.ts` behind the `requireAdminSession` middleware. Unauthenticated requests return `401 Unauthorized` with `{ error: { code: 'UNAUTHENTICATED' } }`.

### 1. `GET /api/admin/members`
- **Description**: Paginated member list with search and filtering.
- **Query Parameters**:
  - `page` (default `1`)
  - `limit` (default `20`, max `100`)
  - `status` (`all` | `ACTIVE` | `INACTIVE` | `ALUMNI`)
  - `search` (searches `name`, `email`, `role`, `unique_id`, `slug`)
  - `role` (partial match)
  - `domain` (partial match)
- **Response**: `200 OK`
  ```json
  {
    "data": [
      {
        "id": "mem-1789888149124-9a6043",
        "unique_id": "NX-030",
        "slug": "ananya-sharma",
        "name": "Ananya Sharma",
        "email": "ananya.sharma@nexus.campus",
        "role": "Full Stack Engineer",
        "domain": "Engineering & Design",
        "department": "ENGINEERING",
        "status": "ACTIVE",
        "joined_date": "2026-03-15",
        "created_at": "2026-09-20T07:09:09.124Z",
        "updated_at": "2026-09-20T07:09:09.124Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "totalItems": 30,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "error": null
  }
  ```

### 2. `POST /api/admin/members`
- **Description**: Create a new member record.
- **Request Body**:
  ```json
  {
    "name": "Ananya Sharma",
    "email": "ananya.sharma@nexus.campus",
    "role": "Full Stack Engineer",
    "domain": "Engineering & Design",
    "department": "ENGINEERING",
    "status": "ACTIVE",
    "uniqueId": "NX-030", // optional, auto-assigned if omitted
    "slug": "ananya-sharma", // optional, auto-generated if omitted
    "joinedAt": "2026-03-15",
    "bio": "Passionate about cloud architecture."
  }
  ```
- **Validation**:
  - `name`: Required, string, min 2 characters (`INVALID_NAME`).
  - `role`: Required, string, min 2 characters (`INVALID_ROLE`).
  - `status`: Optional, must be `ACTIVE`, `INACTIVE`, or `ALUMNI` (`INVALID_STATUS`).
  - `email`: Optional, must be valid email format if provided (`INVALID_EMAIL`). Must not duplicate existing member (`DUPLICATE_EMAIL`).
  - `uniqueId`: Optional, must match `^NX-[0-9]{3,}$` (`INVALID_UNIQUE_ID`). Must not duplicate existing ID (`DUPLICATE_UNIQUE_ID`).
  - `slug`: Optional, URL-safe. Must not duplicate existing slug (`DUPLICATE_SLUG`).
- **Response**: `201 Created` with created record and audit log entry.

### 3. `GET /api/admin/members/:id`
- **Description**: Get full member details by internal ID.
- **Response**: `200 OK` on success, or `404 Not Found` with code `MEMBER_NOT_FOUND`.

### 4. `PATCH /api/admin/members/:id`
- **Description**: Update editable fields on a member record.
- **Editable Fields**: `name`, `displayName`, `email`, `role`, `domain`, `department`, `bio`, `photoUrl`, `joinedAt`, `slug`.
- **Protected Fields**: `unique_id` is immutable; `id` is primary key.
- **Concurrency**: Checks `If-Match` header or `expected_updated_at` body parameter against current `updated_at`. Returns `409 Conflict` (`CONCURRENCY_CONFLICT`) if modified concurrently.
- **Response**: `200 OK` with updated record.

### 5. `PATCH /api/admin/members/:id/status`
- **Description**: Reversible status transition.
- **Request Body**: `{"status": "ACTIVE" | "INACTIVE" | "ALUMNI"}`
- **Validation**: Rejects any status other than the three allowed values (`INVALID_STATUS`).
- **Response**: `200 OK` with updated record.

### 6. `DELETE /api/admin/members/:id`
- **Description**: Soft/Hard delete reserved for Super Admins only (`requireSuperAdmin`). Normal administration workflows use status transitions (`INACTIVE`) instead of deletion.

---

## 5. Frontend Admin UI (`/admin/members`)

Implemented in `frontend/src/admin/pages/AdminMembersPage.tsx` using Tailwind CSS and Lucide icons matching the dark theme design system (`neutral-950`, `neutral-900`, `neutral-800`):

1. **Roster Table**:
   - Responsive, dense layout displaying: Avatar / Initial circle, Name, Email, Unique ID badge (`NX-XXX`), URL Slug, Role, Department, Status Badge, Joined Date, and Action buttons.
   - Status badges:
     - `ACTIVE`: Emerald pill with dot indicator.
     - `INACTIVE`: Neutral/zinc pill with dot indicator.
     - `ALUMNI`: Indigo pill with dot indicator.
2. **Search and Filter Bar**:
   - Real-time search by member name, role, email, unique ID, or slug.
   - Status tabs (`All Members`, `ACTIVE`, `INACTIVE`, `ALUMNI`) with active tab styling.
3. **View Member Detail Drawer/Modal**:
   - Displays real SQLite fields: Photo/Initials, Full Name, Email, Unique ID (flagged as Permanent Identity), URL Slug, Role, Department, Status, Joined Date, Last Updated timestamp, and Biography.
   - Live link to test/preview the public E-ID URL (`/memberID/:slug/:uniqueId`).
   - Clean, factual presentation without fake technical decoration tags.
4. **Create Member Modal**:
   - Fields: Full Name, Email, Role, Department, Status, Optional Custom Unique ID, Joined Date, Bio.
   - In-line validation, server-side error alerts, double-submission protection.
5. **Edit Member Modal**:
   - Pre-populated with real database values.
   - Displays `Unique ID` as read-only and immutable.
   - Allows safe editing of name, email, role, department, bio, and joined date.
6. **Status Change Confirmation Modal**:
   - Clear confirmation dialog before activating, deactivating, or setting alumni status.
   - Explains the effect of each status state.

---

## 6. Files Created and Modified

### Files Created:
- [frontend/src/admin/pages/AdminMembersPage.tsx](file:///frontend/src/admin/pages/AdminMembersPage.tsx): Main admin members UI component with list, create, edit, view, and status dialogs.
- [backend/tests/admin-members.test.ts](file:///backend/tests/admin-members.test.ts): 29-test comprehensive E2E test suite covering member operations.
- [docs/admin/ADMIN_MEMBER_MANAGEMENT.md](file:///docs/admin/ADMIN_MEMBER_MANAGEMENT.md): This technical record.

### Files Modified:
- [backend/db/repositories/members.repository.ts](file:///backend/db/repositories/members.repository.ts):
  - Updated `findAllAdmin` to handle `status === 'all'` without filtering out records.
  - Expanded search to match `unique_id` and `slug` in addition to `name`, `email`, and `role`.
- [backend/domains/admin/adminMembers.controller.ts](file:///backend/domains/admin/adminMembers.controller.ts):
  - Integrated `membersService.createMember` and `membersService.updateMember`.
  - Added `updateStatus` handler for `PATCH /members/:id/status`.
- [backend/domains/admin/admin.routes.ts](file:///backend/domains/admin/admin.routes.ts):
  - Mounted `PATCH /members/:id` and `PATCH /members/:id/status`.
- [frontend/src/admin/types.ts](file:///frontend/src/admin/types.ts):
  - Added `AdminMember`, `CreateMemberInput`, and `UpdateMemberInput` interfaces.
- [frontend/src/admin/api.ts](file:///frontend/src/admin/api.ts):
  - Added `adminGetMembers`, `adminGetMember`, `adminCreateMember`, `adminUpdateMember`, and `adminUpdateMemberStatus`.
- [frontend/src/admin/AdminApp.tsx](file:///frontend/src/admin/AdminApp.tsx):
  - Routed `/admin/members` to `AdminMembersPage`.
- [frontend/src/admin/components/AdminLayout.tsx](file:///frontend/src/admin/components/AdminLayout.tsx):
  - Marked `members` navigation item as `isReserved: false`.
- [package.json](file:///package.json):
  - Added `"test:admin:members": "tsx backend/tests/admin-members.test.ts"`.
  - Included `test:admin:members` in `npm test`.

---

## 7. Tests Performed & Validation Results

### Automated Test Suites:
All 10 test suites in `npm test` execute with zero errors (100% passing):

1. `test:api`: Public endpoints validation (100% pass)
2. `test:admin`: Admin route security and permission enforcement (100% pass)
3. `test:admin:auth`: One-Password authentication, rate limiting, and scrypt verification (100% pass)
4. `test:admin:db`: SQLite schema integrity, repository methods, and unique constraints (100% pass)
5. `test:admin:foundation`: Dashboard metrics, sessions, and route guards (100% pass)
6. `test:admin:members`: **29/29 tests passed (100%)**:
   - `GET /api/admin/members` returns 401 when unauthenticated
   - `POST /api/admin/members` returns 401 when unauthenticated
   - `PATCH /api/admin/members/:id` returns 401 when unauthenticated
   - `PATCH /api/admin/members/:id/status` returns 401 when unauthenticated
   - `POST /api/admin/auth/login` establishes valid session
   - `GET /api/admin/members` returns all seeded members (29 items)
   - `GET /api/admin/members?status=all` returns all members
   - `GET /api/admin/members?status=ACTIVE` filters active members
   - `GET /api/admin/members?search=Orosmit` searches by name
   - `GET /api/admin/members?search=NX-001` searches by unique ID
   - `GET /api/admin/members?search=jitesh-raj` searches by slug
   - `POST /api/admin/members` creates valid member with auto-generated unique ID (`NX-030`)
   - `POST /api/admin/members` rejects missing name (`INVALID_NAME`)
   - `POST /api/admin/members` rejects missing role (`INVALID_ROLE`)
   - `POST /api/admin/members` rejects malformed email (`INVALID_EMAIL`)
   - `POST /api/admin/members` rejects duplicate email (`DUPLICATE_EMAIL`)
   - `POST /api/admin/members` rejects duplicate unique_id (`DUPLICATE_UNIQUE_ID`)
   - `POST /api/admin/members` rejects duplicate slug (`DUPLICATE_SLUG`)
   - `GET /api/admin/members/:id` returns full member record
   - `GET /api/admin/members/non-existent-id` returns 404 `MEMBER_NOT_FOUND`
   - `PATCH /api/admin/members/:id` updates editable fields and strictly preserves `unique_id`
   - `PATCH /api/admin/members/:id` preserves stable slug when name changes
   - `PATCH /api/admin/members/:id/status` deactivates member (`INACTIVE`)
   - `PATCH /api/admin/members/:id/status` reactivates member (`ACTIVE`)
   - `PATCH /api/admin/members/:id/status` sets member status to `ALUMNI`
   - `PATCH /api/admin/members/:id/status` rejects invalid status value
   - Public showcase `GET /api/members` remains functional
   - Public E-ID `GET /api/eid/members/NX-026` remains functional
   - Public E-ID `GET /api/eid/memberID/orosmit-mishra/NX-026` remains functional
7. `test:media`: Media asset tracking and cleanup (100% pass)
8. `test:submissions`: Recruitment and registration status flows (100% pass)
9. `test:hardening`: Concurrency, sanitization, and SQL injection defense (100% pass)
10. `test:eid`: E-ID identity stability and card rendering constraints (100% pass)

### Static Typing & Production Build:
- `npm run lint` (`tsc --noEmit`): Clean, zero TypeScript errors.
- `npm run build` (`vite build`): Production bundle built in 4.55s; `AdminApp-*.js` bundled with zero warnings.

---

## 8. Limitations & Known Boundaries

1. **Direct File Uploads**: Image uploads via Cloudinary or local multipart handling are intentionally omitted in Phase 5 per guardrails. Image URLs can be entered directly.
2. **Bulk CSV/JSON Import**: Batch import tooling belongs to a future dedicated phase (`/admin/imports`).
3. **Audit Log UI**: While all member creations, updates, deletions, and status changes write audit log entries into SQLite (`audit_logs`), the dedicated `/admin/audit` viewer UI belongs to a future phase.

---

## 9. Related Documentation & Subsequent Phases

- **Phase 6 Completed**: [ADMIN_SEARCH_FILTERS.md](./ADMIN_SEARCH_FILTERS.md) documents the complete server-side member search, faceted filtering, whitelisted sorting, and controlled pagination engine.
- **Phase 7 Completed**: [ADMIN_CLOUDINARY.md](./ADMIN_CLOUDINARY.md) documents the secure Cloudinary profile image management system, upload endpoints, binary magic bytes validation, safe asset replacement, and deletion.
- **Phase 8 Completed**: [ADMIN_EID_INTEGRATION.md](./ADMIN_EID_INTEGRATION.md) documents the single source of truth connection between the SQLite member database, public E-ID cards (`/memberID/:slug/:unique_id`), QR code security, and admin preview.
- **Phase 9 Completed**: [ADMIN_PUBLIC_SITE_INTEGRATION.md](./ADMIN_PUBLIC_SITE_INTEGRATION.md) documents the authoritative connection between the public NEXUS website (`/team`, `TeamPreview`), the public members API (`/api/members`), server-side status filtering, and live SQLite database synchronization.
- **Phase 10 Completed**: [ADMIN_BULK_IMPORT_EXPORT.md](./ADMIN_BULK_IMPORT_EXPORT.md) documents the transactional bulk member import/export system with ACID rollback, CSV/JSON support, spreadsheet formula injection defense, in-batch duplicate detection, and import modes.
