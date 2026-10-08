# NEXUS Admin Portal - Phase 18: Controlled Announcements & Content Management

**Document Version:** 1.0.0  
**Phase:** 18  
**Module:** Controlled Announcements & Public Content Management System  
**Route:** `/admin/announcements`  
**Target Endpoints:**
- `GET /api/admin/announcements`
- `GET /api/admin/announcements/:id`
- `POST /api/admin/announcements`
- `PATCH /api/admin/announcements/:id`
- `PATCH /api/admin/announcements/:id/publish`
- `PATCH /api/admin/announcements/:id/unpublish`
- `PATCH /api/admin/announcements/:id/archive`
- `DELETE /api/admin/announcements/:id`
- `GET /api/announcements` (Public listing of active, unexpired announcements)
- `GET /api/announcements/:idOrSlug` (Public detail lookup by ID or slug)

**Database Schema:** SQLite (`data/nexus.db` -> `announcements` table with `011_admin_announcements_schema` migration)  
**Status:** Implemented, Fully Verified (100% Test Pass Rate across 22 Test Suites), Production Ready

---

## 1. Executive Summary & Design Principles

Phase 18 implements a tightly controlled content management system for NEXUS announcements, recruitment notices, application windows, and club updates.

### Core Architectural Mandates:
1. **NOT a Generic CMS or Page Builder**:
   - The admin cannot modify the site template, layout structure, header/footer, typography, or styling.
   - Only curated, time-sensitive content entities (`announcements`) with fixed structured schemas are managed.
2. **Simplified One-Admin Publishing Lifecycle**:
   - `draft` $\rightarrow$ `published` $\rightarrow$ `archived`.
   - Publishing can be directly undone back to `draft` via `PATCH /unpublish`.
   - No unnecessary multi-stage enterprise approval workflows or role-staging hierarchies.
3. **Query-Time Expiration Evaluation**:
   - Announcements with `expires_at` in the past are automatically excluded at query time using `(expires_at IS NULL OR datetime(expires_at) > datetime('now'))`.
   - Expired announcements are **never physically deleted** by background cron jobs or automated sweeps; they are retained in SQLite for historical and audit reference.
4. **Content Security & Sanitization**:
   - Strict XSS and script stripping on `title`, `summary`, and `body`.
   - `<script>`, `<iframe>`, `javascript:`, and inline event handlers (`onload=`, `onerror=`) are stripped before storage.
5. **Optimistic Concurrency Protection**:
   - Updates support `If-Match` HTTP headers or `expected_updated_at` request fields.
   - Stale writes trigger `HTTP 409 CONCURRENCY_CONFLICT`.
6. **Public Website Integration**:
   - Non-intrusive cyber-styled `AnnouncementBanner` mounted above `Hero` in `HomePage.tsx`.
   - Renders `null` with zero DOM footprints or layout shifts when no active announcements exist.
   - Includes live beacon indicators, priority badges (`URGENT`, `NORMAL`), headline links, and detail popover modals.

---

## 2. Database Schema & Migration (`011_admin_announcements_schema`)

```sql
-- Migration 011: Slug support and indexing for announcements
ALTER TABLE announcements ADD COLUMN slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_slug ON announcements(slug);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_status ON announcements(publish_status);
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON announcements(published_at);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
```

### Record Model (`announcements`):
- `id` (TEXT PRIMARY KEY): Stable identifier (e.g., `ann-001`, `ann-1789965...`).
- `slug` (TEXT UNIQUE): URL-friendly identifier derived from title or custom specified.
- `title` (TEXT NOT NULL): Announcement headline.
- `summary` (TEXT NOT NULL): Brief synopsis displayed on banners and listings.
- `body` (TEXT NOT NULL): Full announcement text and instructions.
- `priority` (TEXT CHECK ('Normal', 'Urgent')): Visual hierarchy flag.
- `publish_status` (TEXT CHECK ('draft', 'published', 'archived')): Lifecycle status.
- `published_at` (TEXT ISO 8601): Populated upon publication, null for drafts.
- `expires_at` (TEXT ISO 8601): Optional cutoff timestamp for automated query-time deprecation.
- `created_at` (TEXT ISO 8601): Creation timestamp.
- `updated_at` (TEXT ISO 8601): Concurrency tracking timestamp.

---

## 3. Public API Contract & Expiry Isolation

### Public Listing: `GET /api/announcements`
Returns only active announcements that meet both conditions:
1. `publish_status = 'published'`
2. `expires_at IS NULL OR datetime(expires_at) > datetime('now')`

Response format:
```json
{
  "data": [
    {
      "id": "ann-001",
      "slug": "spring-hackathon-2027",
      "title": "NEXUS Spring Hackathon 2027 Registration Open",
      "summary": "Join 300+ builders for our flagship annual 48-hour hardware/software build sprint.",
      "body": "Registration is officially open...",
      "priority": "Urgent",
      "published_at": "2026-03-01T00:00:00.000Z",
      "expires_at": "2026-10-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 12,
    "totalItems": 1,
    "totalPages": 1
  },
  "error": null
}
```

### Public Detail: `GET /api/announcements/:idOrSlug`
Looks up an announcement by either primary key `id` or unique `slug`. Rejects any announcement that is a `draft`, `archived`, or has expired with `HTTP 404 NOT_FOUND`.

---

## 4. Admin API Contract & Concurrency Guardrails

All `/api/admin/announcements` endpoints require an authenticated admin session via `Cookie: nexus_admin_session` (enforced by `requireAdminAuth`).

### Operations:
1. **`GET /api/admin/announcements`**:
   - Query Parameters: `page`, `limit`, `status` (`all` | `draft` | `published` | `archived`), `priority` (`all` | `Normal` | `Urgent`), `search` (keyword across title, summary, body).
   - Telemetry Facets:
     ```json
     "facets": {
       "total": 5,
       "published": 2,
       "draft": 2,
       "archived": 1
     }
     ```
2. **`POST /api/admin/announcements`**:
   - Creates a new announcement.
   - Validates title, summary, status (`draft`, `published`, `archived`), priority, and `expiresAt` (must not be in the past).
   - Automatically sanitizes XSS vectors.
   - Emits audit log `ANNOUNCEMENT_CREATED`.
3. **`PATCH /api/admin/announcements/:id`**:
   - Updates announcement fields.
   - Enforces optimistic concurrency via `If-Match` or `expected_updated_at`.
   - Emits audit log `ANNOUNCEMENT_UPDATED`.
4. **`PATCH /api/admin/announcements/:id/publish`**:
   - Sets `publish_status = 'published'` and `published_at = CURRENT_TIMESTAMP`.
   - Emits audit log `ANNOUNCEMENT_PUBLISHED`.
5. **`PATCH /api/admin/announcements/:id/unpublish`**:
   - Reverts `publish_status = 'draft'`.
   - Emits audit log `ANNOUNCEMENT_UNPUBLISHED`.
6. **`PATCH /api/admin/announcements/:id/archive`**:
   - Transitions `publish_status = 'archived'`.
   - Emits audit log `ANNOUNCEMENT_ARCHIVED`.
7. **`DELETE /api/admin/announcements/:id`**:
   - Deletes announcement record from SQLite.
   - Emits audit log `ANNOUNCEMENT_DELETED`.

---

## 5. Audit Trail Integration

The audit logging subsystem records all mutation actions for announcements. The `audit_logs` table records:
- `action`: `ANNOUNCEMENT_CREATED`, `ANNOUNCEMENT_UPDATED`, `ANNOUNCEMENT_PUBLISHED`, `ANNOUNCEMENT_UNPUBLISHED`, `ANNOUNCEMENT_ARCHIVED`, `ANNOUNCEMENT_DELETED`.
- `entity_type`: `ANNOUNCEMENT`.
- `entity_id`: Announcement ID.
- `before_json` / `after_json`: Sanitized state snapshots (sensitive fields redacted, content capped).
- Read operations (`GET`) are strictly omitted to prevent audit noise.

---

## 6. Frontend Admin Portal Interface (`/admin/announcements`)

The administrative interface is fully integrated into the NEXUS Admin Portal (`frontend/src/admin/pages/AdminAnnouncementsPage.tsx`):
- **Telemetry Bar**: Displays total, published, draft, and archived counts alongside live query filters.
- **Status Tabs**: Quick filters for `All`, `Published`, `Draft`, and `Archived`.
- **Search & Priority Controls**: Real-time filtering by keyword and priority (`Normal`, `Urgent`).
- **Data Table**: Columns for Title/Summary, Slug, Priority, Status, Published Date, Expiry Date, and Action menus.
- **Slide-Over Drawer Editor**: Responsive form for drafting/editing with title, slug, priority, publish status, expiration date picker, and content body.
- **Public Preview Modal**: Live simulated card preview showing exactly how the announcement renders to public visitors before publishing.
- **Delete Confirmation Modal**: Prevents accidental data loss.

---

## 7. Public Website Banner (`AnnouncementBanner.tsx`)

Mounted dynamically above the hero section in `HomePage.tsx`:
- Fetches active announcements from `GET /api/announcements`.
- If zero announcements exist or all announcements are expired/drafts, the component returns `null` with no DOM elements, completely preserving the standard layout.
- If published announcements exist:
  - Displays a high-contrast cyber-styled banner with a pulsing beacon dot (`emerald` for normal, `amber/rose` for urgent).
  - Shows priority tag and announcement headline with external link icon.
  - Clicking opens a detail modal with full announcement body and action links.
  - Dismissible per browser session with an integrated close button.

---

## 8. Verification & Test Matrix

The Phase 18 test suite (`backend/tests/admin-announcements.test.ts`) executes 27 rigorous integration checks across 13 requirement groups:
1. **Unauthenticated Route Defense (401)**: Verification that `GET`, `POST`, `PATCH`, and `DELETE` strictly reject unauthenticated calls.
2. **Draft Creation**: Validates slug generation, initial timestamps, and draft status.
3. **Public Isolation**: Verifies drafts are excluded from public listing and direct lookup returns 404.
4. **Optimistic Concurrency**: Verifies `If-Match` header mismatches trigger 409 conflict.
5. **Publishing Workflow**: Verifies `PATCH /publish` updates status, populates `published_at`, and appears in public listing and slug lookup.
6. **Unpublishing Workflow**: Verifies `PATCH /unpublish` returns status to draft and immediately hides from public API.
7. **Archiving Workflow**: Verifies `PATCH /archive` transitions to archived and excludes from public API.
8. **Expiry Evaluation**: Verifies validation rejects past dates, and simulates expiration showing query-time exclusion without deleting SQLite rows.
9. **XSS Sanitization**: Verifies `<script>`, `<iframe>`, and event handlers are neutralized.
10. **Audit Ledger**: Verifies all lifecycle transitions are logged in `audit_logs`.
11. **Telemetry & Search**: Verifies faceted counts and keyword searching.
12. **Deletion**: Verifies physical deletion when requested by admin.
13. **Secrets Isolation**: Verifies no server passwords or tokens are leaked in responses.

**Test Execution Result:** 27/27 Tests Passed (100.0%). All 22 NEXUS test suites passed (100.0%).
