# NEXUS Admin Portal: Safe, Transactional Bulk Member Import & Export System (Phase 10)

This document describes the actual, verified implementation of the **Bulk Member Import and Export System** in Phase 10 of the NEXUS Admin Portal. It serves as the authoritative technical record of the transactional import engine, CSV parsing & serialization, formula injection protection, validation lifecycle, import modes, UI modals, export capabilities, and automated regression testing.

---

## 1. Overview & Architecture

The Bulk Import and Export System enables administrators to onboard, update, and extract member rosters at scale without manual one-by-one data entry, while guaranteeing absolute database integrity through atomic SQLite transactions.

### Exact Import Lifecycle

```
[UPLOAD / PASTE]
       │
       ▼
[STRICT PARSING (RFC 4180 / JSON)]
       │
       ▼
[HEADER & FIELD NORMALIZATION]
       │
       ▼
[CANONICAL FIELD VALIDATION]
       │
       ▼
[DUPLICATE & COLLISION DETECTION]
  ├── In-batch email & unique_id collision
  └── Cross-database conflict detection
       │
       ▼
[STRUCTURED PREVIEW & CLASSIFICATION]
  ├── NEW (Unmatched unique_id/email)
  ├── UPDATE (Matched existing member)
  ├── DUPLICATE (Same identifier repeated in file)
  ├── CONFLICT (Cross-member collisions or mode violation)
  └── INVALID (Syntax / length / regex errors)
       │
       ▼
[EXPLICIT ADMIN CONFIRMATION] (Blocked if invalid/duplicate/conflict > 0)
       │
       ▼
[SERVER-SIDE RE-VALIDATION & RE-CHECK] (Zero client-trust architecture)
       │
       ▼
[ACID SQLITE TRANSACTION (`runTransaction`)]
  ├── Commit all or Rollback all
  ├── Allocate sequential unique IDs (NX-XXX)
  ├── Invalidate 'members' and 'eid' caches
  └── Write Audit Log ('MEMBERS_BULK_IMPORTED')
       │
       ▼
[TRANSACTION REPORT]
```

---

## 2. Security Guarantees & Safeguards

1. **Zero Client-Side Validation Bypass**:
   The `POST /api/admin/members/import/commit` endpoint never relies on preview client state. It independently re-parses raw import payloads, re-validates all fields against domain constraints, re-checks duplicate/collision rules, and runs inside a strict database transaction.
2. **Atomic Rollback on Error (ACID)**:
   All database operations are wrapped inside `runTransaction((db) => { ... })`. Any syntax error, database constraint violation, or unexpected exception instantly rolls back the entire batch, preventing partial or corrupted imports.
3. **CSV Formula Injection Defense**:
   Spreadsheet software (Microsoft Excel, LibreOffice Calc, Google Sheets) interprets cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` as executable commands (e.g. `=cmd|'calc'!A0`). In all export generation, values starting with these characters are safely prefixed with a single quote `'`, and UTF-8 Byte Order Marks (`\uFEFF`) are prepended for correct international character rendering.
4. **No Remote Image Fetching (SSRF Prevention)**:
   The import service treats `photo_url` strictly as validated URL/path string metadata. It does not perform outgoing HTTP network requests to download or inspect remote files during bulk import, eliminating Server-Side Request Forgery (SSRF) and server hanging risks.
5. **Payload Limits**:
   - Max file/payload size: `5 MB`
   - Max rows per import batch: `1000`
   - Enforced by `Buffer.byteLength` and row-counter guardrails.
6. **Data Privacy & Secret Sanitization in Exports**:
   Internal surrogate database IDs, password hashes, encryption salts, session tokens, and Cloudinary API secrets are excluded from both CSV and JSON exports.

---

## 3. Import Modes

The system supports three import operational modes:

| Mode | Target Use Case | Behavior on Existing Member | Behavior on New Member |
| :--- | :--- | :--- | :--- |
| `UPSERT` *(Default)* | Standard sync / sync external rosters | Updates existing records matching `unique_id` or `email` | Creates new member records with sequential `NX-XXX` |
| `CREATE_ONLY` | Onboarding new batches | Flags row as `CONFLICT` (blocks commit) | Creates new member records |
| `UPDATE_ONLY` | Updating titles, departments, statuses | Updates existing matched member | Flags row as `CONFLICT` (blocks commit) |

---

## 4. API Specification

All administrative bulk endpoints require authenticated admin sessions (`nexus_admin_session` cookie).

### 4.1 Preview Import
- **Route**: `POST /api/admin/members/import/preview`
- **Request Body**:
```json
{
  "content": "name,role,email,department\nAlice,Lead Architect,alice@nexus.org,Engineering",
  "format": "csv",
  "mode": "UPSERT"
}
```
- **Response**: `200 OK`
```json
{
  "data": {
    "totalRows": 1,
    "validRows": 1,
    "invalidRows": 0,
    "newRecords": 1,
    "updates": 0,
    "duplicates": 0,
    "conflicts": 0,
    "mode": "UPSERT",
    "canCommit": true,
    "rows": [
      {
        "rowNumber": 1,
        "classification": "NEW",
        "uniqueId": null,
        "name": "Alice",
        "email": "alice@nexus.org",
        "role": "Lead Architect",
        "department": "Engineering",
        "status": "ACTIVE",
        "errors": [],
        "warnings": []
      }
    ]
  },
  "error": null
}
```

### 4.2 Commit Import
- **Route**: `POST /api/admin/members/import/commit`
- **Request Body**: Same schema as preview (`content`, `format`, `mode`).
- **Response**: `200 OK`
```json
{
  "data": {
    "success": true,
    "totalProcessed": 1,
    "createdCount": 1,
    "updatedCount": 0,
    "mode": "UPSERT",
    "durationMs": 4
  },
  "error": null
}
```

### 4.3 Export Members
- **Route**: `GET /api/admin/members/export`
- **Query Parameters**:
  - `format`: `'csv'` (default) or `'json'`
  - `status`: `'ACTIVE' | 'INACTIVE' | 'ALUMNI'` (optional)
  - `role`: string filter (optional)
  - `domain`: string filter (optional)
  - `department`: string filter (optional)
  - `q` or `search`: search query (optional)
  - `sort`: sorting order (optional)
- **Response Headers**:
  - `Content-Type`: `text/csv; charset=utf-8` or `application/json; charset=utf-8`
  - `Content-Disposition`: `attachment; filename="nexus-members-export-YYYY-MM-DD.csv"`

---

## 5. Frontend UI Components

### 5.1 Import Modal (`frontend/src/admin/components/BulkImportModal.tsx`)
- Multi-step workflow:
  1. **Upload / Paste**: Drag-and-drop file zone (`.csv`, `.json`), raw text paste textarea, format selector, and import mode selector (`UPSERT`, `CREATE_ONLY`, `UPDATE_ONLY`). Sample template download buttons for both CSV and JSON.
  2. **Preview Breakdown**: Summary cards showing metrics (Total, New, Updates, Duplicates, Conflicts, Invalid). Detailed data table with row numbers, status tags, pill badges, and expandable inline error details.
  3. **Commit Report**: Success confirmation with processed counts and automatic member roster reload.

### 5.2 Export Modal (`frontend/src/admin/components/ExportModal.tsx`)
- Format selector (CSV spreadsheet vs JSON data).
- Scope selector:
  - **Filtered Selection**: Exports current search, department, role, domain, and status query.
  - **Entire Roster**: Exports all members across the database.
- Formula injection defense security advisory and live download trigger.

### 5.3 Members Page Header (`frontend/src/admin/pages/AdminMembersPage.tsx`)
- Modern, cohesive action buttons: **Export** (Download icon) and **Import** (Upload icon) located beside "Add Member", seamlessly matching the NEXUS cyber-industrial dark aesthetic.

---

## 6. Audit Logging & Cache Management

- **Audit Log Action**: `MEMBERS_BULK_IMPORTED` recorded in SQLite `audit_logs` table with metadata detailing admin identity, processed counts, creation/update metrics, mode, and client IP.
- **Cache Invalidation**:
  - Domain cache `members` cleared immediately on commit.
  - Domain cache `eid` cleared immediately on commit.
  - Changes instantly propagate to the public `/team` page and E-ID system `/memberID/:slug/:uniqueId`.

---

## 7. Verification & Automated Regression Tests

The automated test suite `backend/tests/admin-bulk-import-export.test.ts` contains 22 end-to-end tests:

1. **Unauthenticated Endpoint Protection**:
   - `POST /api/admin/members/import/preview` returns 401.
   - `POST /api/admin/members/import/commit` returns 401.
   - `GET /api/admin/members/export` returns 401.
2. **Authenticated Session Setup**:
   - `POST /api/admin/auth/login` sets cookie session.
3. **Payload & Format Validation**:
   - Rejects empty content.
   - Rejects unsupported format (`xml`).
   - Rejects invalid import mode.
   - Rejects malformed JSON syntax.
   - Rejects non-array JSON.
   - Rejects CSV missing required columns (`Name`, `Role`).
4. **Row-Level Validation & In-Batch Duplicate Detection**:
   - Identifies name too short, role too short, bad email, bad status, bad unique ID format.
   - Flags in-batch duplicate emails and duplicate unique IDs.
5. **Import Modes & Database Conflicts**:
   - `CREATE_ONLY` flags existing members as `CONFLICT`.
   - `UPDATE_ONLY` flags unknown members as `CONFLICT`.
   - Detects cross-member email collisions.
6. **Transactional Import Commit (ACID)**:
   - Direct commit fails on invalid payloads (zero client-side bypass).
   - Previews and commits mixed CSV import in `UPSERT` mode with sequential `NX-XXX` allocation.
   - Previews and commits JSON import.
   - Verifies `MEMBERS_BULK_IMPORTED` in `audit_logs`.
7. **Bulk Export Functionality & Security**:
   - Exports valid CSV with UTF-8 BOM (`\uFEFF`) and RFC 4180 escaping.
   - Exports valid sanitized JSON array (no credentials or internal IDs).
   - Correctly filters exported records by query parameters.
   - Neutralizes formula injection characters (`=`, `+`, `-`, `@`).
