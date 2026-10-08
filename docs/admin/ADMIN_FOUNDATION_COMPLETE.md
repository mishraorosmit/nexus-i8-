# NEXUS Admin Portal: Complete Foundation Architecture & Integration

This document serves as the comprehensive, authoritative record of the implemented and verified **NEXUS Admin Portal Foundation**. It covers the complete end-to-end integration between the client interface (`/admin`), the One-Password authentication system, the secure server-side session layer, the protected `/api/admin/dashboard` endpoint, and real SQLite database queries (`data/nexus.db`).

---

## 1. Admin Route Structure

The Admin Portal lives strictly within the `/admin` namespace on the client side, decoupled from the public website:

| Client Route | Access Requirement | Component | Description & Current State |
| :--- | :--- | :--- | :--- |
| `/admin` | Authenticated | `AdminDashboardPage` | **Active**: Real-time SQLite metrics, database connection health, active session badge, module navigation cards. |
| `/admin/login` | Public (Unauthenticated) | `AdminLoginPage` | **Active**: One-Password interface (`Password` input + `LOGIN` button). Authenticated users are redirected to `/admin`. |
| `/admin/members` | Authenticated | `AdminMembersPage` | **Active**: Full SQLite-backed member management. Roster table, create, edit, view, reversible status transitions, search/filtering, Cloudinary images, and transactional bulk import/export (Phase 10). |
| `/admin/projects` | Authenticated | `AdminProjectsPage` | **Active**: Full SQLite-backed project management. Portfolio showcases, status transitions, member assignments, Cloudinary cover images, and public website integration (Phase 15). |
| `/admin/events` | Authenticated | `AdminEventsPage` | **Active**: Full SQLite-backed event management. Scheduling, capacity enforcement, registration toggles, attendee roster, CSV exports, and public website showcase (Phase 16). |
| `/admin/media` | Authenticated | `AdminMediaPage` | **Active**: Centralized Media Library with Cloudinary CDN storage, SQLite metadata registry, multi-field search, category filtering, usage state detection, referenced asset deletion protection, and atomic cascade replacement (Phase 17). |
| `/admin/announcements` | Authenticated | `AdminAnnouncementsPage` | **Active**: Controlled announcements & public content management system. Drafting, publishing, unpublishing, query-time expiration, optimistic concurrency, public banner integration, and audit tracking (Phase 18). |
| `/admin/workflows` | Authenticated | `AdminWorkflowsPage` | **Active**: Unified Inbound Operations console. Applications review & member conversion, Contact inquiries triage, and Cross-event registration attendance/cancellation tracking (Phase 19). |
| `/admin/imports` | Authenticated | `AdminReservedPage` | **Reserved Placeholder**: *"This module is not implemented yet."* (Target: Standalone batch import view; inline bulk import/export is Active on `/admin/members`). |
| `/admin/audit` | Authenticated | `AdminAuditLogsPage` | **Active**: Tamper-evident mutation log view, server-side filtering, and interactive Side-by-Side Diff Inspector console (Phase 12). |
| `/admin/settings` | Authenticated | `AdminSettingsPage` | **Active**: Whitelisted runtime parameters, site branding, E-ID resolution toggles, and recruitment controls (Phase 13). |

---

## 2. Admin Navigation Structure

The administrative navigation shell is rendered by `AdminLayout.tsx` and exposes the primary modules:
1. **Dashboard** (`/admin`) — Active
2. **Members** (`/admin/members`) — Active
3. **Projects** (`/admin/projects`) — Active (Phase 15)
4. **Events** (`/admin/events`) — Active (Phase 16)
5. **Media** (`/admin/media`) — Active (Phase 17)
6. **Announcements** (`/admin/announcements`) — Active (Phase 18)
7. **Workflows** (`/admin/workflows`) — Active (Phase 19)
8. **Imports** (`/admin/imports`) — Deliberate Placeholder
9. **Audit Logs** (`/admin/audit`) — Active (Phase 12)
10. **Settings** (`/admin/settings`) — Active (Phase 13)

*Note*: Full cross-module systems integration, API contracts, relationship cascading, and cache revalidation across all modules was verified and hardened in **Phase 20** (`docs/admin/ADMIN_CROSS_MODULE_AUDIT.md`).

### Layout & Responsiveness:
- **Desktop**: Fixed left navigation sidebar with current active route highlighting, system health status, and administrative logout button.
- **Mobile**: Hamburger toggle collapses the navigation into a responsive overlay drawer with accessible touch targets.

---

## 3. Authentication Flow

The Admin Portal operates exclusively under the **One-Password Model**:
- No username input
- No email input
- No multi-user account selector
- No public user registration
- No OAuth / social buttons
- No client-side storage of passwords or tokens

```
[Administrator at /admin/login]
              │
              │  Enters Master Password
              ▼
   POST /api/admin/auth/login
              │
              ├── Rate Limiting Check (20 requests / 15m window; 5 failed attempt lockout)
              │
              ├── Server-side scrypt verification:
              │   1. Verifies against ADMIN_PASSWORD_HASH if set
              │   2. Fallback to seeded super administrator in SQLite (admin_users)
              │
              ├── If invalid → Returns HTTP 401 {"error": {"code": "INVALID_CREDENTIALS"}}
              │                Audit log: LOGIN_FAILED
              │
              └── If valid:
                  ├── Generates high-entropy crypto token (32 bytes hex)
                  ├── Hashes token via SHA-256 for storage in SQLite (admin_sessions)
                  ├── Issues HttpOnly, Secure, SameSite=Strict cookie (nexus_admin_session)
                  ├── Audit log: LOGIN_SUCCESS
                  └── Returns HTTP 200 {"data": {"user": {...}, "expiresAt": "..."}}
```

---

## 4. Session Flow & Lifecycle

1. **Session Issuance**: Upon successful login, the backend issues an HTTP response header:
   ```http
   Set-Cookie: nexus_admin_session=<token>; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict
   ```
2. **Session Persistence**: Session duration is 24 hours (`86,400` seconds). The token hash is stored in the SQLite `admin_sessions` table with expiration timestamp, IP address, and User-Agent.
3. **Session Verification**: When visiting `/admin`, the client issues `GET /api/admin/auth/me`. The server extracts the cookie, computes SHA-256(`token`), and queries `admin_sessions` joining `admin_users`.
4. **Session Termination (Logout)**:
   - Client sends `POST /api/admin/auth/logout`.
   - Server removes session row from SQLite `admin_sessions`.
   - Server sends `Set-Cookie: nexus_admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`.
   - Client clears all in-memory authentication state and redirects to `/admin/login`.
5. **No Client-Side Token Storage**: Neither `localStorage` nor `sessionStorage` stores session tokens or credentials. All authentication is strictly bound to HttpOnly cookies.

---

## 5. Protected-Route Mechanism

### Client-Side Route Protection (`AdminApp.tsx`):
- Mounts and calls `verifySession()`.
- While verifying, renders a loading indicator.
- If unauthenticated, redirects any route other than `/admin/login` to `/admin/login`.
- If authenticated, attempting to view `/admin/login` immediately redirects to `/admin`.

### Server-Side Route Protection (`backend/middleware/auth.ts`):
All routes mounted under `/api/admin/*` (except `POST /api/admin/auth/login`) are gated behind `requireAdminSession`:
- Extracts cookie `nexus_admin_session` (or `Authorization: Bearer <token>`).
- If missing: throws `AppError(401, 'Authentication required. Valid session not found.', undefined, 'UNAUTHENTICATED')`.
- If invalid or expired in SQLite: throws `AppError(401, 'Administrative session is invalid or has expired.', undefined, 'INVALID_SESSION')`.

---

## 6. Dashboard API Specification

### Endpoint: `GET /api/admin/dashboard`
- **Protection**: `requireAdminSession` (HTTP 401 if unauthenticated or session expired).
- **Controller**: `AdminDashboardController.getDashboard` ([backend/domains/admin/adminDashboard.controller.ts](file:///backend/domains/admin/adminDashboard.controller.ts))
- **Service**: `AdminDashboardService.getDashboardStats` ([backend/services/adminDashboard.service.ts](file:///backend/services/adminDashboard.service.ts))
- **Response Format**: Standard NEXUS API envelope:

```json
{
  "data": {
    "members": {
      "total": 29,
      "active": 29,
      "inactive": 0,
      "alumni": 0
    },
    "projects": {
      "total": 6
    },
    "events": {
      "total": 9,
      "upcoming": 9
    }
  },
  "meta": null,
  "error": null
}
```

---

## 7. Dashboard Data Sources

All metrics returned by `GET /api/admin/dashboard` and displayed in `AdminDashboardPage` are calculated via SQL aggregate queries executed directly against `data/nexus.db`:

```sql
-- Member metrics
SELECT 
  COUNT(*) AS total,
  COALESCE(SUM(CASE WHEN UPPER(status) = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS active,
  COALESCE(SUM(CASE WHEN UPPER(status) = 'INACTIVE' THEN 1 ELSE 0 END), 0) AS inactive,
  COALESCE(SUM(CASE WHEN UPPER(status) = 'ALUMNI' THEN 1 ELSE 0 END), 0) AS alumni
FROM members;

-- Projects count
SELECT COUNT(*) AS total FROM projects;

-- Events metrics
SELECT 
  COUNT(*) AS total,
  COALESCE(SUM(CASE WHEN LOWER(status) = 'upcoming' THEN 1 ELSE 0 END), 0) AS upcoming
FROM events;
```

**Zero Sample Data Rule**: If any table has zero rows, the query evaluates to `0`. No mocked, hardcoded, or fabricated figures are permitted.

---

## 8. SQLite Tables Currently Used

| Table | Role in Foundation | Source Migration |
| :--- | :--- | :--- |
| `_migrations` | Tracks applied transactional migration scripts | `backend/db/migrate.ts` |
| `admin_users` | Master administrative accounts and scrypt password hashes | `002_admin_and_audit` |
| `admin_sessions` | Active administrator sessions with token hashes and expirations | `002_admin_and_audit` |
| `audit_logs` | Cryptographic audit trail of all administrative actions & diffs | `002_admin_and_audit`, `005_admin_database_foundation` |
| `members` | Member roster queried for dashboard total, active, inactive, alumni | `001_initial_nexus_schema`, `004_eid`, `005_admin_database_foundation` |
| `projects` | Portfolio projects queried for dashboard total initiatives | `001_initial_nexus_schema` |
| `events` | Platform events queried for dashboard upcoming and total events | `001_initial_nexus_schema`, `003_submissions_and_registrations` |
| `media_assets` | Schema readiness for Cloudinary uploads | `001_initial_nexus_schema`, `005_admin_database_foundation` |

---

## 9. Repository & Service Layer Structure

The architectural path follows: **UI → API Client → Controller → Service → Repository → SQLite Database**:

- `backend/services/adminDashboard.service.ts`: Aggregates real metrics across SQLite tables.
- `backend/domains/admin/adminDashboard.controller.ts`: Handles HTTP requests, validation, and JSON responses.
- `backend/services/members.service.ts`: Server-side member validation, stable `unique_id` preservation, and audit logging.
- `backend/services/audit.service.ts`: Structured audit event logging.
- `backend/db/repositories/members.repository.ts`: Member records and lookup methods.
- `backend/db/repositories/adminSessions.repository.ts`: Session lifecycle management.
- `backend/db/repositories/adminUsers.repository.ts`: Account credentials verification.

---

## 10. Environment Variables

| Variable | Required in Production | Purpose | Default / Fallback |
| :--- | :--- | :--- | :--- |
| `ADMIN_PASSWORD_HASH` | Recommended | `<scrypt_hash>:<salt>` for single administrator password | Seeded user in SQLite (`admin@nexus.campus`) |
| `INITIAL_ADMIN_PASSWORD`| Development only | Password used during initial SQLite database seeding | `NexusAdmin!2026` |
| `NODE_ENV` | Yes | Controls cookie `secure` attribute and detailed error display | `development` |
| `PORT` | Optional | Backend HTTP port | `3001` |
| `CORS_ORIGIN` | Optional | Allowed client origins | Defaults to localhost/127.0.0.1 in development |

---

## 11. Security Controls

1. **Brute-Force Rate Limiting**: `authRateLimiter` restricts `/api/admin/auth/login` to 20 attempts per 15 minutes per IP address.
2. **5-Attempt Account Lockout**: 5 consecutive incorrect password entries trigger an automated 15-minute lockout recorded in SQLite `admin_users`.
3. **Timing-Safe Hash Comparison**: Passwords and session token hashes are evaluated with `crypto.timingSafeEqual`.
4. **HttpOnly Cookie Protection**: `nexus_admin_session` cookie cannot be read by JavaScript, mitigating XSS session theft.
5. **Cache Invalidation on Mutation**: Admin POST/PUT/PATCH/DELETE automatically invalidates memory caches for public showcase endpoints.
6. **No Token Leaks**: Stack traces, database file paths, tokens, and secrets are strictly excluded from all API responses.

---

## 12. Error-Handling Behavior

| Condition | Client Behavior | Server Response |
| :--- | :--- | :--- |
| **Unauthenticated access to `/admin`** | Redirects to `/admin/login` | N/A (Client route guard) |
| **Unauthenticated access to `/api/admin/*`** | Shows login screen or error message | HTTP 401 `{"error": {"code": "UNAUTHENTICATED"}}` |
| **Expired session token** | Clears client session, redirects to `/admin/login` | HTTP 401 `{"error": {"code": "INVALID_SESSION"}}` |
| **Incorrect password entered** | Displays "Access Denied: Invalid credentials" | HTTP 401 `{"error": {"code": "INVALID_CREDENTIALS"}}` |
| **5 consecutive failed attempts** | Displays "Account locked for 15 minutes" | HTTP 423 `{"error": {"code": "ACCOUNT_LOCKED"}}` |
| **Rate limit exceeded (>20 req/15m)** | Displays "Too many attempts" | HTTP 429 `{"error": {"code": "RATE_LIMIT_EXCEEDED"}}` |
| **Backend offline / unreachable** | Non-technical alert ("Cannot reach backend server") | Browser network error caught gracefully |
| **Database error / unexpected failure** | Shows "Unable to load metrics" with Retry button | HTTP 500 (Details logged to server console only) |

---

## 13. Testing Performed

All 9 test suites pass with 100% success rate:

```bash
npm test
```

### Breakdown of Test Suites:
1. `npm run test:admin:foundation` (10/10 passed) — E2E login, session cookie, dashboard data, logout invalidation, public website isolation.
2. `npm run test:admin:auth` (28/28 passed) — Scrypt password verification, brute-force lockout, session expiration, token hashing.
3. `npm run test:admin:db` (29/29 passed) — Migrations 001-005, column inspection, member validation, unique ID preservation.
4. `npm run test:api` (37/37 passed) — Core public showcase endpoints and pagination.
5. `npm run test:admin` (44/44 passed) — Admin domain controllers.
6. `npm run test:media` (29/29 passed) — File storage driver, MIME sniffing, orphan cleanup.
7. `npm run test:submissions` (29/29 passed) — Recruitment applications and event registrations.
8. `npm run test:hardening` (27/27 passed) — CORS headers, input sanitization, rate limiting.
9. `npm run test:eid` (66/66 passed) — E-ID card resolution, QR routes, authentic member records (`NX-026`, `NX-001`).

### Manual Flow Verification (Tests 1 to 11):
- **TEST 1**: `/admin` while logged out → Redirects to `/admin/login`.
- **TEST 2**: `/admin/login` → Password form with `LOGIN` button.
- **TEST 3**: Incorrect password → Generic authentication error, no session.
- **TEST 4**: Correct password → Authenticated session created, redirects to `/admin`.
- **TEST 5**: Refresh `/admin` → Remains authenticated, loads real SQLite counts.
- **TEST 6**: Click Logout → Session invalidated, redirects to `/admin/login`.
- **TEST 7**: `/admin` after logout → Requires authentication.
- **TEST 8**: `GET /api/admin/dashboard` unauthenticated → HTTP 401.
- **TEST 9**: `GET /api/admin/dashboard` authenticated → Real database metrics returned.
- **TEST 10**: Public homepage (`/`) → Unchanged and functional.
- **TEST 11**: Public E-ID page (`/memberID/orosmit-mishra/NX-026`) → Unchanged and functional.

---

## 14. Build Results

- **TypeScript Typecheck (`npm run lint`)**: `tsc --noEmit` exited with code `0` (Zero errors).
- **Vite Production Build (`npm run build`)**: Vite bundle compiled cleanly in 4.72s with no errors.

---

## 15. Files Created

1. `backend/services/adminDashboard.service.ts` — Real SQLite aggregation service for dashboard metrics.
2. `backend/domains/admin/adminDashboard.controller.ts` — Controller for `GET /api/admin/dashboard`.
3. `backend/tests/admin-foundation.test.ts` — Integration test suite for the complete Admin foundation flow.
4. `docs/admin/ADMIN_FOUNDATION_COMPLETE.md` — This comprehensive documentation document.

---

## 16. Files Modified

1. `backend/domains/admin/admin.routes.ts` — Mounted `GET /dashboard` protected by `requireAdminSession`.
2. `frontend/src/admin/types.ts` — Added `AdminDashboardData` interface.
3. `frontend/src/admin/api.ts` — Added `adminGetDashboardData()` calling `/api/admin/dashboard`.
4. `frontend/src/admin/pages/AdminDashboardPage.tsx` — Replaced mock metrics with real SQLite metrics and error handling.
5. `frontend/src/admin/pages/AdminReservedPage.tsx` — Restrained placeholder stating *"This module is not implemented yet."*
6. `frontend/src/admin/AdminApp.tsx` — Enforced session check, login redirect, and authenticated access to `/admin`.
7. `package.json` — Added `"test:admin:foundation"` script and included in `"test"`.
8. `docs/admin/ADMIN_BASE_ARCHITECTURE.md` — Updated references to dashboard API and architecture.
9. `docs/admin/ADMIN_AUTHENTICATION.md` — Updated session verification and flow details.
10. `docs/admin/ADMIN_DATABASE_FOUNDATION.md` — Updated data flow references.

---

## 17. Files Intentionally Untouched

To guarantee zero regression to the public showcase website and E-ID card renderer:
- `frontend/src/App.tsx` (public routing unaffected)
- `frontend/src/pages/*` (`HomePage.tsx`, `AboutPage.tsx`, `ProjectsPage.tsx`, `TeamPage.tsx`, `GalleryPage.tsx`, `ContactPage.tsx`)
- `frontend/src/components/*` (all public layout, motion, cursor, shaders, and widgets)
- `frontend/src/eid/*` (`EidCardPage.tsx`, QR scanner, canvas card generator)
- `frontend/src/index.css` (public design system tokens and styling)
- `backend/domains/eid/*` (E-ID resolver APIs)
- `backend/domains/members/*` (public member list & showcase profiles)
- `backend/domains/projects/*` (public projects showcase API)
- `backend/domains/events/*` (public events & registration API)

---

## 18. Features Deliberately NOT Implemented Yet

As stipulated by phase boundaries, the following modules are deferred to subsequent phases:
- E-ID badge modification UI
- Bulk CSV / JSON import pipeline
- Media asset manager & replacement UI (site-wide gallery assets)
- Audit log explorer UI
- Project and Event CRUD interfaces
- System settings editor UI

---

## 19. Known Limitations

- The dashboard currently displays high-level entity counts from SQLite. Detailed activity timeline and mutation graphs will be activated when the audit log UI is introduced.
- Multi-admin role management (super_admin vs content_admin) is implemented at the database/API level, but role switching is invisible in the UI since the One-Password model provisions super_admin privileges.

---

## 20. Completed Modules & Next Recommended Phase

- **Phase 5 (Completed)**: [ADMIN_MEMBER_MANAGEMENT.md](./ADMIN_MEMBER_MANAGEMENT.md) documents full member CRUD, modal drawers, status lifecycles (`ACTIVE`, `INACTIVE`, `ALUMNI`), and immutable unique IDs.
- **Phase 6 (Completed)**: [ADMIN_SEARCH_FILTERS.md](./ADMIN_SEARCH_FILTERS.md) documents production-ready server-side member search across 7 fields, faceted filtering, whitelisted sorting, and controlled pagination with URL state synchronization.
- **Phase 7 (Completed)**: [ADMIN_CLOUDINARY.md](./ADMIN_CLOUDINARY.md) documents secure Cloudinary profile image management, server-side signature uploads, safe replacement workflow, magic-bytes MIME sniffing, offline mock support, and dual-column public/E-ID consumption.
- **Phase 8 (Completed)**: [ADMIN_EID_INTEGRATION.md](./ADMIN_EID_INTEGRATION.md) documents real database integration connecting the SQLite member database to public E-ID cards (`/memberID/:slug/:unique_id`), authoritative unique ID lookups, QR code URL security, Cloudinary profile image rendering, data freshness with memory cache invalidation, and admin preview actions.
- **Phase 9 (Completed)**: [ADMIN_PUBLIC_SITE_INTEGRATION.md](./ADMIN_PUBLIC_SITE_INTEGRATION.md) documents the authoritative connection between the public NEXUS website (`/team`, `TeamPreview`), the public members API (`/api/members`), server-side status filtering, and live SQLite database synchronization.
- **Phase 10 (Completed)**: [ADMIN_BULK_IMPORT_EXPORT.md](./ADMIN_BULK_IMPORT_EXPORT.md) documents transactional bulk member import/export system with ACID rollback, CSV/JSON support, spreadsheet formula injection defense, in-batch duplicate detection, and import modes.
- **Phase 11 (Completed)**: [ADMIN_ARCHITECTURE_AUDIT.md](./ADMIN_ARCHITECTURE_AUDIT.md) & [ADMIN_TECHNICAL_DEBT.md](./ADMIN_TECHNICAL_DEBT.md) document the full system architecture, data-flow, security surface audit, dead-code classification, single-source-of-truth verification, and controlled remediation of unauthenticated mutation endpoints, legacy auth deprecation, E-ID cross-member privacy isolation, and squad classification alignment.
- **Phase 12 (Completed)**: [ADMIN_AUDIT_LOGS.md](./ADMIN_AUDIT_LOGS.md) documents the immutable administrative audit ledger, tracking WHO, WHAT, WHEN, TO WHICH ENTITY, BEFORE, AFTER, and RESULT for all mutations, zero-leakage sensitive data sanitization, full server-side query filters and pagination, and the interactive Side-by-Side Diff Inspector console at `/admin/audit`.
- **Phase 13 (Completed)**: [ADMIN_SETTINGS.md](./ADMIN_SETTINGS.md) documents the small, safe, database-backed admin settings system with typed schema validation, deterministic fallbacks, zero secret leakage, audit log integration, runtime consumption across Member IDs, E-ID URLs, and recruitment maintenance mode, and operations UI at `/admin/settings`.
- **Phase 17 (Completed)**: [ADMIN_MEDIA_LIBRARY.md](./ADMIN_MEDIA_LIBRARY.md) documents the centralized administrative media library, Cloudinary storage layer, SQLite asset registry, usage state detection, and referential integrity protection.
- **Phase 18 (Completed)**: [ADMIN_ANNOUNCEMENTS.md](./ADMIN_ANNOUNCEMENTS.md) documents the controlled announcements and public content management system, dynamic query-time expiry evaluation, optimistic concurrency protection, XSS defense, public banner integration, and audit tracking.
- **System Status**: **PRODUCTION READY & HARDENED**. All 22 test suites passing at 100%. Next roadmap targets: Standalone Bulk Import view (`/admin/imports`) or public form submissions review.
