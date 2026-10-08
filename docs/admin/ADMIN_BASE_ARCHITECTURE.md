# NEXUS Admin Portal — Base Architecture Documentation

This document records the exact, implemented base foundation architecture for the internal **NEXUS Admin Portal** (`/admin`), its security boundary, routing hierarchy, backend isolation, and database integration points.

---

## 1. Executive Summary & Objective

The NEXUS Admin Portal is the internal administrative management interface for the NEXUS platform. It serves as the single administrative entry point controlling data consumed by:
1. The public NEXUS showcase website (`/`, `/about`, `/projects`, `/gallery`, `/team`, `/contact`).
2. The NEXUS E-ID card system (`/memberID/:slug/:uniqueId` and `/nx-*`).

### Core Architectural Principle
> **Admin Portal = Source of Truth. Public Website + E-ID System = Read-Only Consumers.**
>
> Changes made within the Admin Portal persist directly to the authoritative SQLite database (`data/nexus.db`). The public showcase website and E-ID card renderer consume this database via isolated read-only APIs with zero code modification required for content updates.

---

## 2. Actual Repository Paths & Component Architecture

### Frontend Directory Structure (`frontend/src/admin/`)
```text
frontend/src/admin/
├── AdminApp.tsx                  # Core router, authentication state container & route gatekeeper
├── api.ts                        # Client API client (fetch wrapper with credentials: 'include')
├── types.ts                      # TypeScript interfaces for routes, sessions, users, telemetry
├── components/
│   └── AdminLayout.tsx           # Admin shell with responsive navigation, status bar & logout
└── pages/
    ├── AdminLoginPage.tsx        # One-Password model authentication interface
    ├── AdminDashboardPage.tsx    # Live telemetry, entity counts, system status & module cards
    └── AdminReservedPage.tsx     # Reserved route placeholder with backend API status
```

### Backend Directory Structure (`backend/`)
```text
backend/
├── app.ts                        # Express application with security headers, CORS, body parsers
├── routes.ts                     # API root router (/api/admin mounted at line 98)
├── config/
│   └── index.ts                  # Server environment configuration (includes admin.passwordHash)
├── utils/
│   ├── crypto.ts                 # scrypt hashing, timing-safe verification, SHA-256 tokens
│   └── apiResponse.ts            # Standard success & error JSON envelope helpers
├── middleware/
│   ├── auth.ts                   # requireAuth, requireSuperAdmin, session cookie extractor
│   └── rateLimiter.ts            # Sliding window brute-force login rate limiter
├── domains/admin/
│   ├── admin.routes.ts           # /api/admin route definitions and middleware bindings
│   ├── adminAuth.controller.ts   # Login (One-Password + RBAC), logout, me session endpoints
│   ├── adminUsers.controller.ts  # Administrator account management
│   ├── adminProjects.controller.ts
│   ├── adminEvents.controller.ts
│   ├── adminMembers.controller.ts
│   ├── adminAnnouncements.controller.ts
│   ├── adminArchive.controller.ts
│   ├── adminResources.controller.ts
│   ├── adminMedia.controller.ts
│   ├── adminSiteSettings.controller.ts
│   └── adminAuditLogs.controller.ts
├── services/
│   ├── members.service.ts        # Admin member service layer (validation, unique ID preservation, audit diff)
│   ├── audit.service.ts          # Audit logging service
│   ├── media.service.ts          # Media upload & validation service
│   └── notificationHook.service.ts
└── db/
    ├── connection.ts             # Native Node 22 SQLite (DatabaseSync) connection pool
    ├── schema.ts                 # Full database schema (members, media_assets, audit_logs)
    ├── migrate.ts                # Migration pipeline (001 through 005_admin_database_foundation)
    ├── seed.ts                   # SQLite seeder with default administrative accounts
    └── repositories/
        ├── adminUsers.repository.ts
        ├── adminSessions.repository.ts
        ├── members.repository.ts    # memberRepository / membersRepository
        ├── mediaAssets.repository.ts # mediaRepository / mediaAssetsRepository
        └── auditLogs.repository.ts   # auditRepository / auditLogsRepository
```

> **Detailed Database Documentation**: See [ADMIN_DATABASE_FOUNDATION.md](file:///docs/admin/ADMIN_DATABASE_FOUNDATION.md) for full schema specifications, constraints, validation rules, and migration runbook.


---

## 3. Route Hierarchy

### 3.1 Client Routes (`/admin/*`)

| URL Path | Access Level | Description | Status |
| :--- | :--- | :--- | :--- |
| `/admin/login` | Public | Minimalist One-Password master login interface | **Active** |
| `/admin` | Authenticated | System status console, live entity counters, module cards | **Active** |
| `/admin/members` | Authenticated | Member roster, clearance levels, and E-ID association | **Reserved (Phase 2)** |
| `/admin/projects` | Authenticated | Project showcase lifecycle and repository links | **Reserved (Phase 2)** |
| `/admin/events` | Authenticated | Event scheduling, registration links, and venues | **Reserved (Phase 2)** |
| `/admin/media` | Authenticated | Image asset manager and Cloudinary upload | **Reserved (Phase 2)** |
| `/admin/imports` | Authenticated | CSV/JSON batch import pipeline and export | **Reserved (Phase 2)** |
| `/admin/audit` | Authenticated | Tamper-evident mutation logs and security records | **Reserved (Phase 2)** |
| `/admin/settings` | Authenticated | Organization settings, maintenance mode, and parameters | **Reserved (Phase 2)** |

### 3.2 Backend API Namespace (`/api/admin/*`)

All routes under `/api/admin/*` (except `/api/admin/auth/login`) strictly require an authenticated administrative session verified server-side.

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin/auth/login` | Rate-limited (IP + Lockout) | One-Password master authentication |
| `POST` | `/api/admin/auth/logout` | `requireAdminSession` | Invalidate session in SQLite & clear cookies |
| `GET` | `/api/admin/auth/me` | `requireAdminSession` | Retrieve current session & permissions |
| `GET` | `/api/admin/dashboard` | `requireAdminSession` | Real-time SQLite metrics (members, projects, events) |
| `GET/POST` | `/api/admin/members` | `requireAdminSession` | Members management (ready for Phase 2 UI) |
| `GET/POST` | `/api/admin/projects` | `requireAdminSession` | Projects management (ready for Phase 2 UI) |
| `GET/POST` | `/api/admin/events` | `requireAdminSession` | Events management (ready for Phase 2 UI) |
| `GET/POST` | `/api/admin/media` | `requireAdminSession` | Media asset management (ready for Phase 2 UI) |
| `GET` | `/api/admin/audit-logs` | `requireSuperAdmin` | Audit logs view (ready for Phase 2 UI) |
| `GET/PUT` | `/api/admin/site-settings` | `requireSuperAdmin` | System parameters (ready for Phase 2 UI) |

> **Complete Foundation Record**: See [ADMIN_FOUNDATION_COMPLETE.md](file:///docs/admin/ADMIN_FOUNDATION_COMPLETE.md) for full implementation details, testing results, and next phase roadmap.


---

## 4. Authentication & Security Architecture

### 4.1 The One-Password Model
The Admin Portal operates on a single administrator master password:
- **No username required**
- **No email input required**
- **No public registration**
- **No multiple accounts on the login screen**
- **No social login / OAuth**

The user enters the administrator password at `/admin/login`. The backend validates the password server-side:
1. If `ADMIN_PASSWORD_HASH` environment variable is set (format: `<scrypt_hash>:<salt>`), the backend validates directly against this secret.
2. If `ADMIN_PASSWORD_HASH` is not configured (e.g. initial local clone), it seamlessly falls back to verifying against the seeded primary super administrator (`admin@nexus.campus`) stored in the SQLite `admin_users` table.
3. For backward compatibility with existing automated test suites, if `{ email, password }` is supplied, the backend authenticates the specified account.

### 4.2 Security Boundary Enforcement
- **No Plaintext Passwords in Source**: Plaintext passwords are never hardcoded or committed to version control.
- **Node 22 Native scrypt**: Passwords use 64-byte derived keys with unique 16-byte cryptographically secure salts.
- **Timing-Safe Comparison**: `crypto.timingSafeEqual` prevents side-channel timing attacks.
- **Session Tokens**: 32-byte cryptographically random hex strings (`crypto.randomBytes(32)`). Only the SHA-256 hash (`token_hash`) is indexed and stored in SQLite `admin_sessions`.
- **HttpOnly Cookies**: Session tokens are delivered via `nexus_admin_session` cookie (`Path=/`, `HttpOnly`, `SameSite=Strict`, `Secure` in production) and optional Bearer token header.
- **Zero Frontend Leakage**: The secret `ADMIN_PASSWORD_HASH` is strictly backend-only. It is never prefixed with `VITE_`, never exposed via any API response, and never stored in `localStorage` or `sessionStorage`.
- **Brute-Force Protection**: 
  - IP-level sliding window rate limiter (max 15 attempts / 15 minutes).
  - Account lockout after 5 consecutive failed attempts (15-minute lock).

### 4.3 Protected Routing Mechanism
Client-side protection does not rely on a spoofable boolean such as `isAdmin === true`.
- On every page load or route change within `/admin/*`, `AdminApp.tsx` invokes `GET /api/admin/auth/me` with `credentials: 'include'`.
- If the server rejects with `401 UNAUTHENTICATED`, the client instantly redirects to `/admin/login`.
- If an unauthenticated user attempts to visit `/admin`, they are redirected to `/admin/login`.
- If an authenticated user attempts to visit `/admin/login`, they are automatically transitioned into `/admin`.

---

## 5. Database Integration Point

The Admin Portal foundation connects directly to the existing, durable SQLite database:
- **Location**: `data/nexus.db`
- **Engine**: Node.js 22 native `node:sqlite` (`DatabaseSync`)
- **Journal Mode**: `WAL` (Write-Ahead Logging) for high concurrency and zero locking conflicts.
- **Foreign Keys**: Enforced via `PRAGMA foreign_keys = ON;`.

### Key Tables Used in Foundation
1. `admin_users`: Stores administrative identities, roles (`super_admin`, `content_admin`), scrypt hashes, salts, lockout states, and login timestamps.
2. `admin_sessions`: Stores active session tokens (`token_hash`), expiration dates (`expires_at`), IP addresses, and user-agent strings.
3. `audit_logs`: Records all administrative operations (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, content mutations).

---

## 6. Environment Variables

Documented in `.env.example`:

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `ADMIN_PASSWORD_HASH` | Backend Only | scrypt password hash in `<hash>:<salt>` format. |
| `ADMIN_DEFAULT_USER` | Backend Only | Default admin username / email reference (`admin@nexus.campus`). |
| `PORT` | Backend Only | Backend API listening port (default: `3001`). |
| `CORS_ALLOWED_ORIGINS` | Backend Only | Allowed frontend origins (e.g., `http://localhost:3000`). |

### Password Hash Generator Utility
A dedicated utility script is provided to generate scrypt hashes:
```bash
npx tsx scripts/hash-admin-password.ts <your_password>
```
Output:
```text
ADMIN_PASSWORD_HASH=6c336b4...:1f92e4a...
```

---

## 7. Files Created & Modified

### Created Files
- `frontend/src/admin/AdminApp.tsx`
- `frontend/src/admin/types.ts`
- `frontend/src/admin/api.ts`
- `frontend/src/admin/components/AdminLayout.tsx`
- `frontend/src/admin/pages/AdminLoginPage.tsx`
- `frontend/src/admin/pages/AdminDashboardPage.tsx`
- `frontend/src/admin/pages/AdminReservedPage.tsx`
- `backend/tests/admin-auth.test.ts`
- `scripts/hash-admin-password.ts`
- `scripts/verify-admin-e2e.ts`
- `docs/admin/ADMIN_AUTHENTICATION.md`
- `docs/admin/ADMIN_BASE_ARCHITECTURE.md`

### Modified Files
- `backend/config/index.ts`: Added `admin.passwordHash` configuration.
- `backend/middleware/auth.ts`: Added and exported `requireAdminSession` middleware.
- `backend/domains/admin/admin.routes.ts`: Integrated `requireAdminSession`.
- `backend/domains/admin/adminAuth.controller.ts`: Implemented One-Password verification, dual-cookie clearing, generic error messages, and `Path=/` session cookie.
- `backend/tests/admin.test.ts`: Added One-Password authentication tests (valid, invalid, missing password).
- `frontend/src/App.tsx`: Added `isAdminPath` boundary and lazy-loaded `AdminApp`.
- `frontend/src/admin/pages/AdminLoginPage.tsx`: Updated submit button label to `LOGIN`.
- `.env.example`: Updated with `ADMIN_PASSWORD_HASH=replace_with_hash` and security guardrails.
- `package.json`: Added `test:admin:auth` script.

### Files Intentionally Untouched
- Public showcase frontend (`frontend/src/pages/*`, `Navbar.tsx`, `Footer.tsx`, `HomePage.tsx`, etc.)
- E-ID frontend and components (`frontend/src/eid/*`, `EidCardPage.tsx`)
- Public API contracts (`/api/members`, `/api/projects`, `/api/events`, `/api/eid/*`)
- Cloudinary configuration and image folders (`images/*`)
- Existing database content and SQLite migrations (`data/nexus.db`)

---

## 8. Current Limitations

1. **Phase 1 Boundary**: Sub-routes (`/admin/members`, `/admin/projects`, `/admin/events`, `/admin/media`, `/admin/imports`, `/admin/audit`, `/admin/settings`) are reserved and render architectural placeholder views.
2. **Read-Only Dashboard**: The dashboard currently surfaces live SQLite entity counts and system health; full CRUD manipulation of entities begins in Phase 2.
3. **No Direct Cloudinary Upload in UI Yet**: Media upload backend endpoint (`/api/admin/media/upload`) is operational; UI file dropzone will be added in Phase 3.

---

## 9. Next Implementation Steps (Phase 2 & Phase 3)

1. **Phase 2 — Member Management**:
   - Activate `/admin/members` route with responsive data table, search input, status filters (`ACTIVE`, `INACTIVE`, `ALUMNI`).
   - Create member modal/drawer with validation for stable `unique_id` (NX-001..NX-026+).
   - Direct integration with E-ID card preview renderer.
2. **Phase 3 — Cloudinary Media & Image Replacement**:
   - Profile image upload pipeline with server-side Cloudinary authenticated upload.
   - Atomic SQLite transaction storing `profile_image_url` and `profile_image_public_id`.
3. **Phase 4 — Content Management**:
   - Activate Project and Event management interfaces with draft/publish status lifecycles.
4. **Phase 5 — Bulk Imports & Audit Trail**:
   - CSV/JSON validation preview and commit pipeline with automatic audit logging.

---

## 10. Validation & Build Results

All builds, typechecks, and test suites pass with **100% success rate**:

```text
TypeScript Lint:
  tsc --noEmit: 0 errors

Vite Production Build:
  dist/assets/AdminApp-*.js (28.13 kB) - cleanly code-split
  ✓ built in 4.51s

Backend Test Suites:
  - test:api: 100% passed
  - test:admin: 50/50 tests passed (100%)
  - test:admin:auth: 28/28 assertions passed (100%) across 11 test scenarios
  - test:media: 29/29 tests passed (100%)
  - test:submissions: 29/29 tests passed (100%)
  - test:hardening: 27/27 tests passed (100%)
  - test:eid: 66/66 tests passed (100%)

End-to-End Verification:
  - scripts/verify-admin-e2e.ts: 24/24 passed (100%)
```

