# NEXUS Admin: Event Management & Registration System Architecture (Phase 16)

## 1. Executive Summary

Phase 16 introduces an enterprise-grade, database-backed **Event Management and Attendee Registration System** for the NEXUS platform. It unifies the internal administrative portal (`/admin/events`) with the public website (`/` and `/api/events`), backed by atomic SQLite transactions, concurrency-safe capacity enforcement, Cloudinary media processing with magic bytes validation, decoupled notification hooks, RFC 4180 CSV attendee exports, and tamper-evident audit logging.

---

## 2. Architecture & Data Model

### 2.1 SQLite Schema & Migration `009_admin_events_and_registrations_schema`

The system manages two tightly coupled relational tables with cascading foreign keys:

```sql
-- Events Entity Table
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'Workshop',
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  event_start TEXT,
  event_end TEXT,
  venue TEXT NOT NULL,
  location TEXT NOT NULL,
  registration_url TEXT,
  cover_image TEXT,
  cover_image_url TEXT,
  cover_image_public_id TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft',
  capacity INTEGER,
  registration_enabled INTEGER NOT NULL DEFAULT 1,
  registration_start TEXT,
  registration_end TEXT,
  registration_status TEXT NOT NULL DEFAULT 'OPEN',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Attendee Registrations Table
CREATE TABLE IF NOT EXISTS event_registrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendee_name TEXT NOT NULL,
  attendee_email TEXT NOT NULL,
  attendee_phone TEXT,
  organization TEXT,
  department TEXT,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  metadata TEXT,
  registration_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, attendee_email)
);
```

### 2.2 Performance & Constraint Indexes
- `idx_events_slug`: Enforces global slug uniqueness and enables O(1) public lookups.
- `idx_events_status_type`: Accelerates public list queries filtering by status and event type.
- `idx_events_published_at`: Enables rapid reverse-chronological ordering for the home page showcase.
- `idx_event_registrations_event_status`: Optimizes correlated subqueries calculating live confirmed attendee counts.
- `idx_event_registrations_attendee_email`: Fast lookup for duplicate detection and attendee history.
- `UNIQUE(event_id, attendee_email)`: Hard database constraint preventing double booking.

---

## 3. Atomic Registration & Concurrency Engine

### 3.1 Write-Lock Serialization (`BEGIN IMMEDIATE`)
In multi-user environments, high registration demand can trigger overbooking races between reading remaining capacity and writing new registration records. To solve this in SQLite WAL mode:
1. `eventRegistrationService.register()` initiates an immediate transaction via `db.exec('BEGIN IMMEDIATE TRANSACTION;')`.
2. This reserves a write-lock upfront, blocking all other write transactions until commit or rollback.
3. The service queries live confirmed attendance:
   ```sql
   SELECT COUNT(*) FROM event_registrations WHERE event_id = ? AND status = 'CONFIRMED'
   ```
4. If `confirmedCount >= event.capacity`, the transaction aborts with HTTP 400 (`EVENT_CAPACITY_REACHED`) without inserting a row.
5. If duplicate email exists for the event, it aborts with HTTP 409 (`DUPLICATE_REGISTRATION`).
6. Upon successful insert, `db.exec('COMMIT;')` commits atomically.

### 3.2 Timezone & Window Strategy
All event and registration timestamps (`event_start`, `event_end`, `registration_start`, `registration_end`, `published_at`) are strictly stored as ISO-8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- Registration is automatically evaluated dynamically as open if:
  - `registration_enabled == 1` AND `registration_status == 'OPEN'`
  - `NOW() >= registration_start` (if configured)
  - `NOW() <= registration_end` (if configured)
  - `status IN ('Published', 'Upcoming')`
  - `confirmed_count < capacity` (if capacity configured)

---

## 4. Privacy & API Separation

### 4.1 Strict Isolation Boundaries
- **Public API (`/api/events`, `/api/events/:slug`)**:
  - Exposes `PublicEventDto` containing public metadata, event timing, venue, `registrationOpen`, and `capacityRemaining`.
  - **NEVER** includes attendee rosters, email addresses, phone numbers, or registration IDs.
  - Drafts, archived events, and cancelled events return HTTP 404 on slug lookups and are omitted from paginated lists.
- **Admin API (`/api/admin/events/*`)**:
  - Protected by `authenticateAdmin` session middleware.
  - Provides full CRUD, status transitions, Cloudinary image upload, attendee roster inspection, and CSV exports.

---

## 5. Media Pipeline (Cloudinary & Magic Bytes Sniffing)

Image uploads via `POST /api/admin/events/:id/image` undergo strict validation:
1. **Payload Extraction**: Supports standard `multipart/form-data` and Base64 JSON payloads.
2. **Magic Bytes Validation**: Inspects the first 16 bytes of the binary buffer to verify authentic signatures for PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), and WebP (`RIFF...WEBP`). Blocks executable binaries, shell scripts, and disguised payloads.
3. **Size Ceiling**: Strictly enforces a 10MB maximum limit.
4. **Safe Replacement**: Uploads the new image to Cloudinary, persists the new `cover_image_url` and `cover_image_public_id` to SQLite, and only then destroys the obsolete Cloudinary asset.

---

## 6. Export Engine & Audit Logging

### 6.1 RFC 4180 CSV Export
`GET /api/admin/events/:id/registrations/export` outputs standard CSV with:
- `\uFEFF` UTF-8 Byte Order Mark (BOM) ensuring correct rendering across Microsoft Excel, Google Sheets, and LibreOffice.
- Formula injection defense and field escaping (double quotes for fields containing commas or quotes).
- Filename header: `attachment; filename="event-[slug]-attendees.csv"`.

### 6.2 Audit Trail
Every mutation records administrator identity, IP address, and before/after state into `audit_logs`:
- `EVENT_CREATED`
- `EVENT_UPDATED`
- `EVENT_PUBLISHED`
- `EVENT_UNPUBLISHED`
- `EVENT_ARCHIVED`
- `EVENT_DELETED`
- `REGISTRATION_OPENED`
- `REGISTRATION_CLOSED`
- `REGISTRATION_CONFIRMED`
- `REGISTRATION_CANCELLED`
- `EVENT_REGISTRATIONS_EXPORTED`

---

## 7. Frontend Interfaces

- **Admin Portal (`/admin/events`)**:
  - Metrics banner tracking Total, Upcoming, Active Registrations, and Full Sessions.
  - High-density table with real-time capacity progress indicators.
  - Slide-over drawer editor for creating and modifying events.
  - Cloudinary drag-and-drop cover image uploader.
  - Attendee management modal with real-time search, status filtering, and one-click CSV export.
- **Public Website (`frontend/src/components/home/EventShowcaseSection.tsx`)**:
  - Automatically queries published events from `/api/events`.
  - Dynamic capacity remaining indicators.
  - Interactive registration modal submitting to `/api/events/:id/register`.
  - Graceful handling of duplicate registrations (409) and closed registrations.

---

## 8. Media Library Integration (Phase 17)

All event promotional and cover imagery uploaded via `/admin/events` or directly through `/admin/media` is indexed in `media_assets` under the `event` category namespace. The Centralized Media Library protects referenced event banners against accidental deletion and provides cascade reassignment on asset replacement. See [ADMIN_MEDIA_LIBRARY.md](./ADMIN_MEDIA_LIBRARY.md).
