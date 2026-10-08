# NEXUS Admin Portal: SQLite Database Foundation Architecture

## Executive Summary

The NEXUS Admin Portal operates on a durable, embedded **SQLite** architecture (`data/nexus.db`) managed via Node 22 native `node:sqlite` (`DatabaseSync`). In alignment with repository constraints and the NEXUS Admin Portal Blueprint, the database foundation does **NOT** introduce PostgreSQL, MongoDB, Supabase, or external database engines.

This document outlines the SQLite foundation, the transactional migration pipeline, the aligned data models (`members`, `media_assets`, `audit_logs`), strict server-side validation, database-enforced unique constraints, repository/service layering, and verification of authentic member data preservation (including `NX-026` Orosmit Mishra and `NX-001` Jitesh Raj).

---

## 1. Architectural Flow

All administrative and public data access flows through an isolated, layered architecture:

```
┌────────────────────────────────────────────────────────┐
│             Admin Portal / Public Client               │
│         (/admin UI, /api/admin/*, /api/eid/*)          │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP JSON / Cookies
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Controller Layer                     │
│    (adminMembers.controller.ts, eid.controller.ts)     │
└───────────────────────────┬────────────────────────────┘
                            │ Typed DTOs / Admin Context
                            ▼
┌────────────────────────────────────────────────────────┐
│                    Service Layer                       │
│    (backend/services/members.service.ts, audit.ts)     │
│   - Server-side validation (Name, Role, Status, Email) │
│   - Immutable unique_id preservation (^NX-[0-9]{3,}$)  │
│   - Auto-generated sequential public IDs               │
│   - Before/After state capture for Audit Logging       │
└───────────────────────────┬────────────────────────────┘
                            │ Domain Records
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Repository Layer                     │
│ (memberRepository, mediaRepository, auditRepository)   │
│   - BaseRepository<T> abstraction                      │
│   - Prepared statements with parameterized inputs      │
│   - Dual alias exports for legacy and admin consumers  │
└───────────────────────────┬────────────────────────────┘
                            │ SQL Queries & Transactions
                            ▼
┌────────────────────────────────────────────────────────┐
│              Durable SQLite Database Engine            │
│         (data/nexus.db via Node 22 node:sqlite)        │
│   - Unique indexes on unique_id, slug, cloudinary_id   │
│   - WAL journal mode, atomic transactions              │
└────────────────────────────────────────────────────────┘
```

---

## 2. Migration Pipeline & Schema Versioning

### Migration Runner (`backend/db/migrate.ts`)
Migrations are tracked within the `_migrations` table and executed within atomic SQLite transactions:
```sql
CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  executed_at TEXT NOT NULL
);
```

### Applied Migrations

| ID | Name | Description |
|---|---|---|
| `001_initial_nexus_schema` | Core Showcase Schema | Initial showcase tables (`members`, `projects`, `events`, `media_assets`, etc.) |
| `002_admin_and_audit` | Admin & Audit Schema | Admin users, RBAC roles, admin sessions, and audit logging |
| `003_submissions_and_registrations` | Submissions & Events | Recruitment submissions and event attendee registrations |
| `004_eid_member_foundation` | E-ID Member Identity | Addition of `unique_id`, `clearance_level`, `special_word`, and badge attributes |
| `005_admin_database_foundation` | Admin Database Foundation | Schema readiness for `members` (`slug`, `profile_image_url`, `joined_at`, uppercase status), `media_assets` (Cloudinary readiness), `audit_logs` (diff context), and unique indexes |

### Migration Idempotency & Safety
The migration runner checks `_migrations` before executing unapplied scripts. Running `npm run db:migrate` on an already migrated database results in zero unapplied migrations without table rebuilds or data disruption.

---

## 3. Data Model & Schema Alignments

### 3.1 `members` Table
The `members` table holds authentic NEXUS club members and E-ID cardholders:

```sql
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  public_id TEXT UNIQUE NOT NULL,
  slug TEXT,
  unique_id TEXT,
  name TEXT NOT NULL,
  display_name TEXT,
  email TEXT UNIQUE,
  role TEXT NOT NULL,
  domain TEXT,
  department TEXT DEFAULT 'ENGINEERING',
  bio TEXT,
  photo_url TEXT,
  profile_image_url TEXT,
  profile_image_public_id TEXT,
  image_position TEXT,
  social_links TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  clearance_level TEXT DEFAULT 'LVL-03 // SPEC',
  special_word TEXT DEFAULT 'VISIONARY',
  quote TEXT,
  node_location TEXT DEFAULT 'SOA LAB 204 // BHUBANESWAR',
  frequency TEXT DEFAULT '108.40 MHz',
  security_zone TEXT DEFAULT 'SEC // ALPHA',
  badge_issue TEXT DEFAULT '2026.Q1',
  skills TEXT DEFAULT '[]',
  current_focus TEXT,
  fun_fact TEXT,
  joined_date TEXT,
  joined_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unique_id ON members(unique_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_slug ON members(slug);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
```

#### Field Synchronization Guarantees:
- **`slug` & `public_id`**: Synchronized automatically. If `slug` is provided, `public_id` mirrors it; if `public_id` is provided, `slug` mirrors it.
- **`profile_image_url` & `photo_url`**: Backward and forward compatible. Updating either mirrors the other to avoid breaking existing public showcase components.
- **`joined_at` & `joined_date`**: Mirrors date strings across both naming conventions.
- **`status`**: Normalized to uppercase (`'ACTIVE'`, `'INACTIVE'`, `'ALUMNI'`).

### 3.2 `media_assets` Table (Cloudinary-Ready)
The `media_assets` table is configured for upcoming Cloudinary integration while preserving local storage compatibility:

```sql
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  storage_key TEXT UNIQUE NOT NULL,
  cloudinary_public_id TEXT,
  secure_url TEXT,
  resource_type TEXT DEFAULT 'image',
  folder TEXT DEFAULT 'nexus',
  original_filename TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  bytes INTEGER,
  format TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Unique Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_cloudinary_public_id ON media_assets(cloudinary_public_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_storage_key ON media_assets(storage_key);
```

### 3.3 `audit_logs` Table (State Diff & Admin Context)
The `audit_logs` table records who performed each action, before/after states for full traceability, and administrative request metadata:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  admin_name TEXT,
  admin_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  admin_context TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## 4. Repository & Service Layer

### 4.1 Export Aliases
To maintain full backwards-compatibility with existing domain controllers while supporting the requested naming conventions, repository files export aliases:

```typescript
// backend/db/repositories/members.repository.ts
export const membersRepository = new MembersRepository();
export const memberRepository = membersRepository;

// backend/db/repositories/mediaAssets.repository.ts
export const mediaAssetsRepository = new MediaAssetsRepository();
export const mediaRepository = mediaAssetsRepository;

// backend/db/repositories/auditLogs.repository.ts
export const auditLogsRepository = new AuditLogsRepository();
export const auditRepository = auditLogsRepository;
```

### 4.2 Server-Side Member Validation (`backend/services/members.service.ts`)
The `MembersAdminService` enforces business rules prior to database operations:

1. **Name Validation**: Required, string, trimmed, minimum 2 characters.
2. **Role Validation**: Required, string, trimmed, minimum 2 characters.
3. **Status Validation**: Must be one of `'ACTIVE'`, `'INACTIVE'`, `'ALUMNI'`. Any lowercase status is normalized to uppercase.
4. **Email Validation**: If provided, validated against RFC regex (`^[^\s@]+@[^\s@]+\.[^\s@]+$`). Enforces case-insensitive uniqueness against existing member records.
5. **Stable `unique_id` Invariant**:
   - Must match regex `^NX-[0-9]{3,}$` (e.g., `NX-001`, `NX-026`).
   - If not provided on creation: auto-calculates the next sequential ID (e.g. `NX-030`) by inspecting existing max numeric suffixes.
   - Database-level unique constraint prevents duplicate assignment.
   - **CRITICAL PRESERVATION GUARANTEE**: During `updateMember()`, the `unique_id` is **never** regenerated or altered when a member's name, role, email, status, or bio change.
6. **Slug Generation & Uniqueness**: Lowercase, hyphen-delimited URL slug with uniqueness validation.
7. **JSON Serialization**: Structured inputs (`skills`, `social_links`) are validated and serialized to JSON strings safely.

### 4.3 Audit Service Integration
Whenever members are created, modified, or deleted:
- `MEMBER_CREATED`: Records `after_json` and metadata.
- `MEMBER_UPDATED`: Records `before_json`, `after_json`, and list of updated fields.
- `MEMBER_DELETED`: Records `before_json` snapshot before deletion.

---

## 5. Authentic Member Data Verification

Migration `005_admin_database_foundation` safely migrated existing live member records without data loss:
- **Total Members Preserved**: 29 authentic team members.
- **Member `NX-026`**:
  - Name: `OROSMIT MISHRA`
  - Unique ID: `NX-026`
  - Slug: `orosmit-mishra`
  - Status: `ACTIVE`
  - Special Word: `ORCHESTRATOR`
  - Clearance Level: `LVL-04 // LEAD`
- **Member `NX-001`**:
  - Name: `JITESH RAJ`
  - Unique ID: `NX-001`
  - Slug: `jitesh-raj`
  - Status: `ACTIVE`

---

## 6. Verification & Automated Test Suite

A dedicated automated test suite is provided at `backend/tests/admin-db.test.ts` and registered in `package.json` as `npm run test:admin:db`:

```bash
npm run test:admin:db
```

### Test Coverage Summary:
- **Group 1: Migration System & Schema Readiness**:
  - Verifies migration runner idempotency (0 unapplied migrations).
  - Confirms migration 005 recording in `_migrations`.
  - Verifies all new columns in `members`, `media_assets`, and `audit_logs`.
  - Asserts unique indexes on `members(unique_id)` and `members(slug)`.
- **Group 2: Authentic Member Data Preservation**:
  - Verifies preservation of all 29 authentic members.
  - Verifies `NX-026` (Orosmit Mishra) and `NX-001` (Jitesh Raj).
- **Group 3: Repository Layer & Aliases**:
  - Verifies alias exports (`memberRepository`, `mediaRepository`, `auditRepository`).
  - Verifies lookups by `id`, `slug`, `email`, and `unique_id`.
- **Group 4: Server-Side Validation via `membersService`**:
  - Rejects empty/short names.
  - Rejects empty/short roles.
  - Rejects invalid status strings.
  - Rejects malformed email addresses.
  - Rejects duplicate emails (case-insensitive).
  - Rejects malformed unique IDs.
  - Rejects duplicate unique IDs.
- **Group 5: Member Creation, Stable Unique ID & Audit Logging**:
  - Generates next sequential unique ID (`NX-030`).
  - Verifies emission of `MEMBER_CREATED` audit log with `after_json`.
  - **Verifies STABLE UNIQUE ID GUARANTEE**: Updating name, role, email, and status preserves the exact same `unique_id`.
  - Verifies emission of `MEMBER_UPDATED` audit log with `before_json` and `after_json`.
  - Verifies safe deletion and `MEMBER_DELETED` audit logging.
- **Group 6: Media Asset Repository Cloudinary Readiness**:
  - Inserts asset with Cloudinary attributes (`cloudinary_public_id`, `secure_url`, `bytes`, `width`, `height`).
  - Looks up asset by `cloudinary_public_id`.
  - Clean asset deletion.

**Suite Results**: 29/29 tests passing (100%).

---

## 7. Operational Runbook

```bash
# Execute migrations safely
npm run db:migrate

# Run Admin SQLite Foundation test suite
npm run test:admin:db

# Run complete NEXUS test suite (9 suites: api, admin, auth, db, foundation, media, submissions, hardening, eid)
npm test

# Verify type safety
npm run lint

# Build production assets
npm run build
```

> **Complete Foundation Integration Record**: See [ADMIN_FOUNDATION_COMPLETE.md](file:///docs/admin/ADMIN_FOUNDATION_COMPLETE.md) for full implementation details, protected dashboard API, and operational runbook.

