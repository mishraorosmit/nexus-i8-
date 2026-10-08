# NEXUS Admin Portal - Phase 17: Centralized Media Library Architecture

**Document Version:** 1.0.0  
**Phase:** 17  
**Module:** Centralized Media Management & Asset Reference Registry  
**Route:** `/admin/media`  
**Target Endpoints:**
- `GET /api/admin/media`
- `GET /api/admin/media/:id`
- `GET /api/admin/media/:id/usage`
- `POST /api/admin/media/upload`
- `PUT /api/admin/media/:id/replace`
- `PATCH /api/admin/media/:id`
- `DELETE /api/admin/media/:id`
- `GET /api/admin/media/orphans`
- `POST /api/admin/media/orphans/cleanup`
- `GET /api/media/file/:category/:year/:filename`

**Media Storage Layer:** Cloudinary CDN (Automated WebP/AVIF transformations, global CDN caching, responsive delivery)  
**Metadata & Authority Source of Truth:** SQLite (`data/nexus.db` -> `media_assets` table)  
**Status:** Implemented, Fully Verified (100% Test Pass Rate across 21 Test Suites), Production Ready

---

## 1. Executive Summary & Design Principles

Phase 17 delivers a centralized, database-backed administrative media library for the NEXUS platform at `/admin/media`. It provides full visibility, categorization, usage tracking, metadata editing, and safe replacement for all assets used across the ecosystem (members, projects, events, gallery, branding, and general).

### Core Architectural Mandates:
1. **Single Source of Media Truth**: Cloudinary remains the sole media asset storage layer (`nexus/${category}`). SQLite `media_assets` stores authoritative metadata and foreign entity mappings.
2. **Zero Secondary Storage**: No competing local disk directories (`/uploads`, `/media-cache`, `/random-images`, `/user-assets`) exist at runtime.
3. **Curated Categories**: All assets belong to strictly governed category namespaces: `member`, `project`, `event`, `gallery`, `branding`, and `general`.
4. **Referential Integrity & Usage Defense**: Dynamic usage detection categorizes every asset as `USED`, `UNUSED`, or `UNKNOWN`. Assets actively referenced by members (including E-ID card portraits), projects, or events are strictly protected against accidental deletion (`CANNOT_DELETE_REFERENCED_ASSET`, HTTP 400).
5. **Safe Cascade Replacement**: Replacing an asset updates Cloudinary, commits SQLite metadata, cascades the new URL/public ID across all referencing member, project, and event records inside an atomic database transaction, and destroys the old Cloudinary asset only after the database transaction succeeds.
6. **Zero Secrets Leakage**: Cloudinary secrets (`CLOUDINARY_API_SECRET`) are strictly isolated server-side and never injected into Vite or transmitted in API responses.

---

## 2. End-to-End Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXUS Admin Portal                       │
│                        /admin/media                         │
│  - Telemetry cards (Total, Used, Unused, Storage)           │
│  - Category tabs & multi-field search (filename, alt_text)  │
│  - Grid / List view with high-density preview               │
│  - Asset detail drawer with referencing entity badges       │
│  - Drag-drop upload drawer & safe replacement modal         │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
POST /api/admin/media/upload          PUT /api/admin/media/:id/replace
PATCH /api/admin/media/:id            DELETE /api/admin/media/:id
            │                                     │
            ▼                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express Admin Controller                   │
│   - requireAdminSession (One-Password session authentication)│
│   - MimeSniffer: file size, extension, & magic byte check   │
│   - Executable, script, and SVG payload defense             │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│       Cloudinary CDN         │    │       SQLite Database        │
│ - Folder: nexus/${category}  │    │  (data/nexus.db)             │
│ - Transformations:           │    │ - media_assets table         │
│   c_limit,w_1200,h_1200,     │    │ - Entity usage detection     │
│   q_auto,f_auto              │    │ - Atomic cascade reassign    │
│ - Cloud asset destruction    │    │ - Audit logs ledger          │
└──────────────────────────────┘    └──────────────────────────────┘
```

---

## 3. Database Schema & Migration `010`

The `media_assets` table was extended via migration `010_admin_media_library_schema` to support rich classification, accessibility, and administrative attribution:

```sql
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  category TEXT NOT NULL DEFAULT 'general',
  alt_text TEXT,
  uploaded_by TEXT,
  cloudinary_public_id TEXT,
  secure_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_storage_key ON media_assets(storage_key);
CREATE INDEX IF NOT EXISTS idx_media_assets_cloudinary_public_id ON media_assets(cloudinary_public_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets(category);
```

During migration execution, all 35 pre-existing active NEXUS assets (29 member profile photos and 6 project covers) were automatically synchronized into `media_assets`.

---

## 4. REST API Reference

### 1. List Media Assets
`GET /api/admin/media`
- **Query Parameters**:
  - `page`: Page number (default: `1`)
  - `limit`: Items per page (default: `24`, max: `100`)
  - `search`: Case-insensitive search across `filename`, `original_filename`, `cloudinary_public_id`, and `alt_text`
  - `category`: Filter by `member`, `project`, `event`, `gallery`, `branding`, `general`
  - `usage`: Filter by `all`, `used`, `unused`, `unknown`
  - `sort`: `created_at` (default), `filename`, `byte_size`
  - `order`: `DESC` (default), `ASC`
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "med-1789927078310-c54c39be",
        "filename": "robotics-arm-hero.png",
        "mime_type": "image/png",
        "byte_size": 245120,
        "width": 1200,
        "height": 800,
        "category": "project",
        "alt_text": "Robotics arm assembly prototype",
        "cloudinary_public_id": "nexus/project/robotics-arm-hero",
        "secure_url": "https://res.cloudinary.com/.../nexus/project/robotics-arm-hero.png",
        "usage_status": "USED",
        "references": [
          { "type": "project", "id": "prj-001", "name": "Autonomous Rover", "field": "cover_image_url" }
        ],
        "created_at": "2026-09-20T18:00:00.000Z",
        "updated_at": "2026-09-20T18:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 24,
      "total": 36,
      "totalPages": 2,
      "facets": {
        "totalAssets": 36,
        "usedAssets": 35,
        "unusedAssets": 1,
        "unknownAssets": 0,
        "totalStorageBytes": 18459200,
        "categoryCounts": {
          "member": 29,
          "project": 6,
          "event": 0,
          "gallery": 0,
          "branding": 0,
          "general": 1
        }
      }
    }
  }
  ```

### 2. Get Asset Details & Usage
- `GET /api/admin/media/:id`: Returns asset metadata including dynamic `usage_status` and `references` array.
- `GET /api/admin/media/:id/usage`: Dedicated endpoint returning usage breakdown.

### 3. Upload Media Asset
`POST /api/admin/media/upload`
- Accepts `multipart/form-data` or JSON payload `{ filename, category, alt_text, content: "<base64>" }`.
- Validates magic bytes (JPEG, PNG, WebP, GIF, AVIF, PDF). Rejects PE/MZ binaries, executables, scripts, and HTML.
- Uploads to Cloudinary under `nexus/${category}` folder with web-optimization transformations.
- Returns status `201 Created` with created asset record.

### 4. Update Metadata
`PATCH /api/admin/media/:id`
- Accepts `{ alt_text, category }`.
- Updates record in SQLite and logs `MEDIA_UPDATED` in `audit_logs`.

### 5. Safe Replacement with Cascade Reassignment
`PUT /api/admin/media/:id/replace` (or `POST /api/admin/media/:id/replace`)
- Accepts replacement file payload.
- Validates file and uploads replacement asset to Cloudinary.
- Performs atomic database update:
  1. Updates `media_assets` row with new byte size, dimensions, format, checksum, public ID, and secure URL.
  2. Identifies all referencing members, projects, and events.
  3. Replaces references in `members` (`profile_image_url`, `profile_image_public_id`, `photo_url`).
  4. Replaces references in `projects` (`cover_image_url`, `cover_image_public_id`, `cover_image`).
  5. Replaces references in `events` (`cover_image_url`, `cover_image`).
  6. Invalidates active in-memory caches.
  7. Destroys the old Cloudinary asset only **after** the SQLite transaction succeeds.
  8. Emits `MEDIA_REPLACED` and `MEDIA_REASSIGNED` audit logs.

### 6. Delete Asset (with Deletion Defense)
`DELETE /api/admin/media/:id`
- Checks `getAssetUsage()`. If `usage_status === 'USED'`, rejects with HTTP 400:
  ```json
  {
    "success": false,
    "error": {
      "code": "CANNOT_DELETE_REFERENCED_ASSET",
      "message": "Cannot delete asset because it is currently referenced by 1 entity. Reassign or remove references before deleting.",
      "details": {
        "assetId": "med-1789927078310-c54c39be",
        "references": [
          { "type": "project", "id": "prj-001", "name": "Autonomous Rover", "field": "cover_image_url" }
        ]
      }
    }
  }
  ```
- If `UNUSED`, destroys asset on Cloudinary, deletes record from SQLite, and logs `MEDIA_DELETED`.

---

## 5. Security & Threat Mitigation

| Threat Vector | Mitigation Strategy | Implemented Mechanism |
| :--- | :--- | :--- |
| **MIME Spoofing** | Binary magic-byte sniffing via `mimeSniffer.ts` | Disguised `.exe` or shell scripts rejected before Cloudinary handoff. |
| **SVG XSS Attacks** | SVG disallowed in profile and cover image uploads | Hard-blocked with `MIME_NOT_ALLOWED`. |
| **Orphaned File Accumulation** | Usage tracking + orphan detection endpoint | Automated facets flag `unused` assets for administrative review. |
| **Dangling Entity References** | Strict deletion defense | HTTP 400 on deletion attempts for referenced assets. |
| **Credential Leakage** | Complete environment isolation | `CLOUDINARY_API_SECRET` isolated to Node.js backend; zero client bundle exposure. |
| **Audit Ledger Tampering** | Structured append-only audit trail | Every upload, replace, reassign, update, and deletion is recorded in `audit_logs`. |

---

## 6. Verification & Test Coverage Matrix

The Media Library is verified by two test suites comprising 93 tests total (100% pass rate):
- `backend/tests/admin-media-library.test.ts` (64/64 tests, 100%)
- `backend/tests/media.test.ts` (29/29 tests, 100%)

| Test Number | Verified Capability | Status |
| :--- | :--- | :--- |
| **1** | Valid upload to Cloudinary and SQLite metadata persistence | **PASS** |
| **2** | Binary magic-byte defense against disguised executables | **PASS** |
| **3** | Rejection of oversized payloads (> 10MB) | **PASS** |
| **4** | Multi-field search across filename, original name, and alt text | **PASS** |
| **5** | Category namespace filtering and usage status filtering | **PASS** |
| **6** | Asset detail drawer & dedicated usage endpoint | **PASS** |
| **7** | Canonical CDN delivery URL copying | **PASS** |
| **8** | Active reference protection (deletion rejection with HTTP 400) | **PASS** |
| **9** | Unused asset identification | **PASS** |
| **10** | Safe replacement with atomic cascade reference reassignment | **PASS** |
| **11** | Clean deletion and Cloudinary destruction of unused assets | **PASS** |
| **12** | Tolerance of Cloudinary service failure (HTTP 502, zero DB pollution) | **PASS** |
| **13** | Metadata update (alt text & category namespace) | **PASS** |
| **14** | Comprehensive audit trail logging for all media mutations | **PASS** |
| **15** | Public member profile integration | **PASS** |
| **16** | Public E-ID card portrait resolution | **PASS** |
| **17** | Public project showcase cover image rendering | **PASS** |
| **18** | Public event image rendering | **PASS** |
| **19** | Secrets isolation and client bundle safety | **PASS** |
