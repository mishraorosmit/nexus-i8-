# NEXUS Admin: Project Management System Architecture & Operation (Phase 15)

## 1. Executive Summary

Phase 15 introduces a comprehensive, database-backed **Project Management System** for the NEXUS ecosystem. It seamlessly unifies the internal Admin Portal (`/admin/projects`) with the public NEXUS website (`/projects`, `/`, etc.), backed by SQLite schema migrations, Cloudinary media handling, relationship junction tables, optimistic concurrency, and tamper-evident audit logging.

---

## 2. Architecture & Data Model

### 2.1 SQLite Schema & Migration `008_admin_projects_schema`
The project management subsystem builds directly on top of the native SQLite `projects` and `project_members` tables:

```sql
-- Projects Table Definition
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  project_number TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  year TEXT NOT NULL DEFAULT '2026',
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  disciplines TEXT NOT NULL DEFAULT 'TECHNOLOGY',
  status TEXT NOT NULL DEFAULT 'Draft',
  featured INTEGER NOT NULL DEFAULT 0,
  technologies TEXT NOT NULL DEFAULT '[]',
  deliverables TEXT,
  cover_image TEXT,
  cover_image_url TEXT,
  cover_image_public_id TEXT,
  demo_url TEXT,
  live_url TEXT,
  repository_url TEXT,
  documentation_url TEXT,
  start_date TEXT,
  end_date TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Member Association Junction Table
CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, member_id)
);
```

### 2.2 Performance & Integrity Indexes
- `idx_projects_slug`: Unique index guaranteeing slug uniqueness and constant-time URL routing.
- `idx_projects_status_featured`: Compound index accelerating public filtered portfolio queries (`status IN ('published', ...)`).
- `idx_projects_category`: Speeds up category filtration.
- `idx_project_members_project_id`: Fast batch joining of team members for project cards.
- `idx_project_members_member_id`: Reverse lookup indexing to locate all projects led or authored by a specific member.

---

## 3. Content Lifecycle & Access Control

### 3.1 Content Status Progression
1. **`Draft`**: Internal working state. Content is only visible to authenticated administrators in `/admin/projects`. Completely hidden from public endpoints (`/api/projects`, `/api/projects/:slug`, `/api/projects/featured`).
2. **`Published`**: Active public showcase state. Fully indexed and queryable on the public NEXUS website and API. Automatically populates `published_at` timestamp on transition.
3. **`Archived`**: Retained internally for historical and institutional memory. Hidden from public listings; requires `super_admin` clearance to transition into or out of archived state.

### 3.2 URL Stability & Slug Management
- Project slugs are sanitized into URL-safe strings on creation (`a-z0-9-`).
- Slugs remain immutable and permanent during title/content edits unless explicitly modified by an administrator with clearance.
- Custom slugs are strictly verified against existing records to prevent 409 collisions.

### 3.3 Member Relationships
- Project team associations are established by linking authentic `members.id` entries in `project_members`.
- Batch retrieval (`projectsRepository.getMembersForProjects(projectIds)`) avoids N+1 query overhead.
- Atomic sync operations (`PUT /api/admin/projects/:id/members`) ensure transactional consistency.

---

## 4. Media & Security Pipeline

### 4.1 Cloudinary Image Upload & Safe Replacement
- **Sniffing**: Validates uploaded media via magic byte analysis (PNG, JPEG, WebP, GIF), enforcing a 10MB ceiling and blocking executable/script payloads.
- **Safe Replacement**: Uploads the new cover asset to Cloudinary, commits the SQLite transaction, and only then schedules deletion of the obsolete Cloudinary `public_id`, preventing data loss on database failures.

### 4.2 Security & URL Validation
- All external links (`repository_url`, `live_url`, `documentation_url`) are strictly validated against `http:` and `https:` schemes, preventing `javascript:` XSS vectors.
- Concurrency conflict detection via `If-Match` / `expected_updated_at` prevents stale write overwrites across concurrent administrators.

---

## 5. Audit Logging Integration

All project operations emit structured records into SQLite `audit_logs`:

| Action | Entity Type | Details Captured |
| :--- | :--- | :--- |
| `PROJECT_CREATED` | `PROJECT` | Initial title, slug, status, initial author |
| `PROJECT_UPDATED` | `PROJECT` | Specific field diffs with `beforeJson` and `afterJson` |
| `PROJECT_PUBLISHED` | `PROJECT` | Previous status, published timestamp |
| `PROJECT_UNPUBLISHED` | `PROJECT` | Previous status, draft transition |
| `PROJECT_ARCHIVED` | `PROJECT` | Previous status, archival timestamp |
| `PROJECT_FEATURED` | `PROJECT` | Featured boolean flag transition |
| `PROJECT_IMAGE_CHANGED` | `PROJECT` | Cloudinary secure URL, public ID, bytes |
| `PROJECT_MEMBERS_CHANGED` | `PROJECT` | Action (`ADD`/`REMOVE`/`SYNC`), member ID, assigned role |
| `PROJECT_DELETED` | `PROJECT` | Full pre-deletion record snapshot |

---

## 6. Verification & Automated Test Suite

The project system is backed by `backend/tests/admin-projects.test.ts` (27 tests), verifying:
- Unauthenticated rejection (401) across all admin endpoints.
- Auto-generated and custom slug creation with conflict rejection (409).
- URL scheme sanitization (blocking `javascript:`).
- Concurrency conflict prevention (409).
- Status lifecycle (`Draft` ⇄ `Published` ⇄ `Archived`).
- Member assignment, removal, and transactional sync.
- Cloudinary media upload and magic bytes validation.
- Complete public API isolation (drafts/archived excluded from public feeds).
- Full audit log traceability.
- Cascade deletion of junction records.

---

## 7. Media Library Integration (Phase 17)

All project cover images uploaded via `/admin/projects` or directly via the Media Library are cataloged in `media_assets` under the `project` category namespace. The Centralized Media Library (`/admin/media`) prevents deletion of assets actively referenced by projects and supports atomic cascade reassignment if an asset is replaced. See [ADMIN_MEDIA_LIBRARY.md](./ADMIN_MEDIA_LIBRARY.md).
