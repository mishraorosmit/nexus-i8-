# NEXUS Admin Portal: Admin Audit Log & Change-Tracking System (Phase 12)

This document describes the actual, verified implementation of the **Admin Audit Log and Change-Tracking System** in Phase 12 of the NEXUS Admin Portal. It serves as the authoritative technical record of the audit log schema, sensitive data sanitization engine, event taxonomy, before/after diff tracking, query filtering, frontend inspection console, and automated regression testing.

---

## 1. Objective & Architectural Guarantees

The NEXUS Audit Log system provides an immutable, persistent ledger of administrative mutations across the entire ecosystem. For every mutation, the system rigorously records:

| Dimension | Meaning | Database Column |
| :--- | :--- | :--- |
| **WHO** | The authenticated administrator acting on the system | `admin_id`, `admin_name`, `admin_role`, `admin_context`, `ip_address` |
| **WHAT** | The specific mutation or operation performed | `action` (e.g. `MEMBER_CREATED`, `MEMBER_UPDATED`, `BULK_IMPORT`) |
| **WHEN** | Precise ISO-8601 UTC timestamp | `created_at` |
| **TO WHICH ENTITY** | The target domain object affected | `entity_type`, `entity_id` |
| **BEFORE** | Pre-mutation state snapshot (for updates, status changes, deletions, image replacements) | `before_json` |
| **AFTER** | Post-mutation state snapshot (for creations, updates, status changes, image uploads/replacements) | `after_json` |
| **RESULT** | High-level mutation metadata, key summaries, or counts | `details` |

---

## 2. Security & Sanitization Architecture

A fundamental security mandate of the NEXUS audit system is **Zero Credential or Secret Leakage**.

### Sanitization Rules (`backend/services/audit.service.ts`)
The audit service implements strict object whitelisting and property redaction before persisting any record to SQLite:
1. **Password & Token Blacklisting**: Keys matching `password`, `hash`, `secret`, `token`, `cookie`, `key`, `authorization` are recursively stripped.
2. **Buffer & Binary Stripping**: Large file buffers, streams, and raw Base64 data URIs (`data:image/...`) are replaced with placeholder descriptors (`[BINARY_PAYLOAD: X bytes]`) to prevent database bloat and memory leaks.
3. **Safe Administrator Context**: In the One-Password authentication model, administrator context is normalized to:
   ```json
   {
     "adminId": "admin-1",
     "adminName": "NEXUS Super Administrator",
     "adminRole": "super_admin",
     "actor": "authenticated-admin"
   }
   ```
4. **Resilient Failure Handling**: Audit log operations fail safely using standardized `AppError` rather than crashing the database or corrupting transaction states.

---

## 3. Database Schema (`audit_logs`)

The SQLite database foundation stores audit records in the indexed `audit_logs` table:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  admin_name TEXT,
  admin_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,               -- JSON metadata & summary
  ip_address TEXT,
  admin_context TEXT,        -- JSON normalized administrator context
  before_json TEXT,          -- JSON state snapshot before mutation
  after_json TEXT,           -- JSON state snapshot after mutation
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
```

---

## 4. Tracked Action Taxonomy

The following actions are instrumented across backend controllers and services:

| Action | Entity Type | Before State Captured | After State Captured | Details Metadata |
| :--- | :--- | :---: | :---: | :--- |
| `MEMBER_CREATED` | `MEMBER` | `null` | Sanitized member record | `name`, `unique_id`, `role` |
| `MEMBER_UPDATED` | `MEMBER` | Previous member record | Updated member record | Updated field keys |
| `MEMBER_STATUS_CHANGED` | `MEMBER` | Pre-status record | Post-status record | `previousStatus`, `newStatus` |
| `MEMBER_DELETED` | `MEMBER` | Complete pre-deletion record | `null` | Deletion confirmation |
| `IMAGE_UPLOADED` | `member_image` | `null` | New Cloudinary image URL & ID | Public ID, format, bytes |
| `IMAGE_REPLACED` | `member_image` | Previous Cloudinary image URL & ID | New Cloudinary image URL & ID | Public ID, format, bytes |
| `IMAGE_REMOVED` | `member_image` | Removed Cloudinary image URL & ID | `null` | Removal confirmation |
| `BULK_IMPORT` | `MEMBER` / `bulk_import` | `null` | `null` | `totalProcessed`, `createdCount`, `updatedCount`, `mode`, `format` |
| `SETTINGS_CHANGED` | `SITE_SETTINGS` | Previous key/value pairs | New key/value pairs | `updatedKeys` list |
| `LOGIN_SUCCESS` | `admin_user` / `auth` | `null` | `null` | Login timestamp & IP |
| `LOGIN_FAILED` | `admin_user` / `auth` | `null` | `null` | Failure reason & IP |
| `PASSWORD_CHANGED` | `admin_user` | `null` | `null` | Timestamp |
| `PROJECT_CREATED` | `PROJECT` | `null` | Sanitized project record | `title`, `slug`, `category` |
| `PROJECT_UPDATED` | `PROJECT` | Previous project record | Updated project record | `updatedFields` list |
| `PROJECT_PUBLISHED` | `PROJECT` | Previous project record | Updated project record | `status: 'Published'` |
| `PROJECT_UNPUBLISHED`| `PROJECT` | Previous project record | Updated project record | `status: 'Draft'` |
| `PROJECT_ARCHIVED` | `PROJECT` | Previous project record | Updated project record | `status: 'Archived'` |
| `PROJECT_DELETED` | `PROJECT` | Complete pre-deletion record | `null` | `deletedProjectTitle`, `slug` |
| `EVENT_CREATED` | `EVENT` | `null` | Sanitized event record | `title`, `slug`, `eventType` |
| `EVENT_UPDATED` | `EVENT` | Previous event record | Updated event record | `updatedFields` list |
| `EVENT_PUBLISHED` | `EVENT` | Previous event record | Updated event record | `status: 'Published'` |
| `EVENT_UNPUBLISHED` | `EVENT` | Previous event record | Updated event record | `status: 'Draft'` |
| `EVENT_ARCHIVED` | `EVENT` | Previous event record | Updated event record | `status: 'Archived'` |
| `EVENT_DELETED` | `EVENT` | Complete pre-deletion record | `null` | `deletedEventTitle`, `slug` |
| `REGISTRATION_OPENED` | `EVENT` | Previous event record | Updated event record | `registrationEnabled: true` |
| `REGISTRATION_CLOSED` | `EVENT` | Previous event record | Updated event record | `registrationEnabled: false` |
| `REGISTRATION_CONFIRMED` | `EVENT_REGISTRATION` | `null` | Confirmed registration record | `attendeeName`, `attendeeEmail`, `eventId` |
| `REGISTRATION_CANCELLED` | `EVENT_REGISTRATION` | Previous registration record | Cancelled registration record | `cancellationReason` |
| `EVENT_REGISTRATIONS_EXPORTED` | `EVENT` | `null` | `null` | `eventTitle`, `recordCount`, `format: 'csv'` |
| `MEDIA_UPLOADED` | `MEDIA` | `null` | Sanitized media asset record | `filename`, `category`, `publicId`, `byteSize` |
| `MEDIA_REPLACED` | `MEDIA` | Previous media asset record | Updated media asset record | `oldPublicId`, `newPublicId`, `reassignedCount` |
| `MEDIA_REASSIGNED` | `MEDIA` | Previous media asset record | Updated media asset record | `assetId`, `entityType`, `entityId`, `field` |
| `MEDIA_UPDATED` | `MEDIA` | Previous metadata record | Updated metadata record | `alt_text`, `category` |
| `MEDIA_DELETED` | `MEDIA` | Complete pre-deletion asset | `null` | `deletedAssetId`, `storage_key`, `publicId` |
| `ANNOUNCEMENT_CREATED` | `ANNOUNCEMENT` | `null` | Sanitized announcement record | `title`, `publishStatus`, `priority` |
| `ANNOUNCEMENT_UPDATED` | `ANNOUNCEMENT` | Previous announcement record | Updated announcement record | `updatedFields` list |
| `ANNOUNCEMENT_PUBLISHED` | `ANNOUNCEMENT` | Previous announcement record | Updated announcement record | `publish_status: 'published'` |
| `ANNOUNCEMENT_UNPUBLISHED` | `ANNOUNCEMENT` | Previous announcement record | Updated announcement record | `publish_status: 'draft'` |
| `ANNOUNCEMENT_ARCHIVED` | `ANNOUNCEMENT` | Previous announcement record | Updated announcement record | `publish_status: 'archived'` |
| `ANNOUNCEMENT_DELETED` | `ANNOUNCEMENT` | Complete pre-deletion record | `null` | `deletedAnnouncementTitle`, `id` |

---

## 5. Backend API Endpoints

### `GET /api/admin/audit-logs`
Protected administrative endpoint returning paginated, filtered audit records.

#### Query Parameters
- `page` (number, default: `1`): Current page index.
- `limit` (number, default: `20`, max: `100`): Page size.
- `action` (string, optional): Exact action filter (e.g. `MEMBER_CREATED`).
- `entityType` (string, optional): Entity type filter (e.g. `MEMBER`, `SITE_SETTINGS`).
- `entityId` (string, optional): Filter by target entity ID (e.g. `mem-12345` or `NX-001`).
- `adminId` (string, optional): Filter by administrator ID.
- `startDate` (ISO-8601 string, optional): Filter events on or after this timestamp.
- `endDate` (ISO-8601 string, optional): Filter events on or before this timestamp.
- `search` (string, optional): Full-text keyword match across `details`, `action`, `admin_name`, and `entity_id`.

#### Response Structure
```json
{
  "data": [
    {
      "id": "audit-1789916575570-8b12f",
      "admin_id": "admin-1",
      "admin_name": "NEXUS Super Administrator",
      "admin_role": "super_admin",
      "action": "MEMBER_CREATED",
      "entity_type": "MEMBER",
      "entity_id": "mem-1789916575568-cd145w",
      "details": {
        "name": "Audit Test Member",
        "unique_id": "NX-030",
        "role": "Security Engineer"
      },
      "ip_address": "127.0.0.1",
      "admin_context": {
        "adminId": "admin-1",
        "adminName": "NEXUS Super Administrator",
        "adminRole": "super_admin",
        "actor": "authenticated-admin"
      },
      "before_json": null,
      "after_json": {
        "id": "mem-1789916575568-cd145w",
        "name": "Audit Test Member",
        "role": "Security Engineer",
        "email": "audit.test@nexus.campus",
        "status": "ACTIVE"
      },
      "created_at": "2026-09-20T15:02:55.570Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalItems": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false,
    "hasNextPage": false,
    "hasPrevPage": false
  },
  "error": null
}
```

---

## 6. Frontend Audit Management Console

Mounted at route `/admin/audit` and rendered via `AdminAuditPage.tsx`:

1. **Telemetry & Metric Cards**:
   - **Total Recorded Logs**: Live count of all historical mutations in SQLite.
   - **Member Mutations**: Live count of member creation, update, and deletion events.
   - **Media Mutations**: Cloudinary avatar upload, replacement, and purge operations.
   - **Bulk Import Batches**: Batch import job runs and synchronization operations.

2. **Multi-Faceted Search & Filter Toolbar**:
   - Instant search input with debounced querying across actions, entities, and details.
   - Action taxonomy dropdown selector.
   - Entity type selector.
   - Target entity ID filter.
   - Per-page size selector (`10`, `25`, `50`, `100`).
   - One-click filter reset button.

3. **Ledger Table**:
   - Columns: When (UTC), Who (Actor & IP), What (Action badge), Target Entity, Summary, Diff Inspector.
   - Interactive row selection opens the Side-by-Side Diff Inspector.

4. **Side-by-Side Diff Inspector Modal**:
   - Compares `before_json` vs `after_json` snapshots field-by-field.
   - Automatically detects and tags fields as `MODIFIED`, `ADDED`, or `REMOVED`.
   - Visual toggle between structured Field Diff view and Raw JSON view.
   - One-click JSON copy-to-clipboard button.

---

## 7. Verification & Automated Test Coverage

The system is validated by the standalone end-to-end test suite:
```bash
npm run test:admin:audit
```

### Verified Acceptance Scenarios (15/15 Passed):
1. `GET /api/admin/audit-logs` strictly rejects unauthenticated requests with HTTP 401.
2. `POST /api/admin/auth/login` records `LOGIN_SUCCESS` with administrator context.
3. Member creation records `MEMBER_CREATED` with full post-state snapshot and unique ID details.
4. Member update records `MEMBER_UPDATED` with before and after state captures.
5. Member status change records `MEMBER_STATUS_CHANGED` with `previousStatus` and `newStatus`.
6. Member deletion records `MEMBER_DELETED` with complete pre-deletion state preserved.
7. Site settings updates record `SETTINGS_CHANGED` with `updatedKeys` and before/after captures.
8. Bulk import commits record `BULK_IMPORT` with row counts and format metadata.
9. Zero password hashes, session tokens, or binary file buffers leak across all audit records.
10. Query filtering by `action` filters correctly.
11. Query filtering by `entityType` filters correctly.
12. Keyword search filters correctly.
13. Server-side pagination metadata calculates correctly.
14. Public member directory showcase (`GET /api/members`) remains 100% operational.
15. Public E-ID card lookup (`GET /api/eid/members/NX-001`) remains 100% operational.
