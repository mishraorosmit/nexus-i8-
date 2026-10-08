# NEXUS Admin Portal - Phase 7: Cloudinary Profile Image Management

**Document Version:** 1.0.0  
**Phase:** 7  
**Module:** Member Profile Image Management  
**Route:** `/admin/members` (Edit Member modal & Roster grid)  
**Target Endpoints:** `POST /api/admin/members/:id/image`, `DELETE /api/admin/members/:id/image`  
**Media Provider:** Cloudinary CDN  
**Reference Source of Truth:** SQLite (`data/nexus.db`)  
**Status:** Implemented, Fully Verified (100% Test Pass Rate), Production Ready

---

## 1. Executive Summary & Architecture

Phase 7 delivers a secure, production-grade media pipeline allowing administrators to upload, replace, and remove member profile images. SQLite remains the authoritative source of truth for member identity and metadata, while Cloudinary provides scalable cloud storage, automated WebP/AVIF delivery, and responsive transformations.

### End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Admin UI                              │
│  (Profile photo preview, drag/drop or file select, modal)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/admin/members/:id/image
                               │ (multipart/form-data or base64 JSON)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Express Backend Middleware                  │
│   - requireAdminSession (authenticated admin session)       │
│   - verify member existence in SQLite                       │
│   - mimeSniffer: validate extension, size (5MB limit),      │
│     and binary magic bytes (JPEG, PNG, WebP)                │
│   - hard reject executables, scripts, SVGs, HTML            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloudinary Service                         │
│   - Generate signed request server-side (HMAC-SHA1)         │
│   - Credentials strictly server-side (never in VITE_*)      │
│   - Target folder: nexus/profile-images                     │
│   - Web-optimized transformation (w_1200, h_1200, q_auto)  │
│   - POST to https://api.cloudinary.com/v1_1/.../upload      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Returns { secure_url, public_id }
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      SQLite Database                        │
│   - Update members table:                                   │
│     profile_image_url = secure_url                          │
│     profile_image_public_id = public_id                     │
│     photo_url = secure_url                                  │
│     updated_at = CURRENT_TIMESTAMP                          │
│   - Write audit log: UPLOAD_PROFILE_IMAGE                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │ If replacing existing image:        │
            │ Safely destroy old Cloudinary asset │
            │ only AFTER SQLite update succeeds   │
            └─────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Public Consumers                          │
│   - /api/members (photoUrl = profile_image_url || photo_url)│
│   - /api/eid/members (image = profile_image_url || photo_url│
│   - Resilient UI fallback if image is null or fails to load │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Credential Security & Environment Variables

Cloudinary administrative credentials remain exclusively server-side. Under NO circumstances are secret keys exposed to the client bundle or returned in API responses.

### Environment Variables Profile:
| Variable Name | Context | Exposure | Purpose |
| :--- | :--- | :--- | :--- |
| `CLOUDINARY_CLOUD_NAME` | Server & Scripts | Private | Cloudinary cloud account name (fallback `VITE_CLOUDINARY_CLOUD_NAME` or `'plg8gola'`) |
| `CLOUDINARY_API_KEY` | Server-only | Private | Cloudinary API Key for signing uploads & deletions |
| `CLOUDINARY_API_SECRET` | Server-only | Private (CRITICAL) | Cloudinary API Secret. NEVER prefix with `VITE_` or include in client builds |
| `CLOUDINARY_FOLDER` | Server & Scripts | Private | Base directory in Cloudinary (default: `nexus/profile-images`) |
| `VITE_CLOUDINARY_CLOUD_NAME`| Client / Public | Safe Public | Public CDN domain resolution only |

### Strict Security Rules:
1. **Never commit `.env` or `.env.local` to git.** Template values are kept in `.env.example`.
2. **Never expose `CLOUDINARY_API_SECRET` to Vite or client bundles.** Vite only embeds variables explicitly prefixed with `VITE_`.
3. **Never log secrets.** Error handlers and audit logs sanitize credentials before recording.
4. **Never return secrets in API responses.** Endpoints return only `secureUrl` and `publicId`.

---

## 3. Upload Validation & Security Defense

All uploaded files are subjected to multi-layered binary inspection using `backend/utils/mimeSniffer.ts` (`validateMediaUpload`) before reaching Cloudinary:

### 3.1 Allowed File Types
- **JPEG** (`image/jpeg`)
- **PNG** (`image/png`)
- **WebP** (`image/webp`)

### 3.2 Prohibited & Hard-Rejected Types
- **Executables & Binaries**: Windows PE / MZ (`4D 5A`), Linux ELF (`7F 45 4C 46`), Java/Mach-O (`CA FE BA BE`, `FE ED FA CE`), shell scripts (`#!`). Immediate HTTP 400 `EXECUTABLE_REJECTED`.
- **Dangerous Extensions**: `.exe`, `.dll`, `.sh`, `.bat`, `.cmd`, `.php`, `.js`, `.py`, `.rb`, etc. Immediate HTTP 400 `DANGEROUS_FILE_EXTENSION`.
- **HTML & Scripts**: Arbitrary MIME types and unparsed strings. Immediate HTTP 400 `UNRECOGNIZED_FILE_SIGNATURE`.
- **SVGs**: Excluded from member photos to prevent stored XSS attack vectors.

### 3.3 File Size Limit
- **Max Upload Size**: **5 MB** (5,242,880 bytes).
- Files exceeding 5MB are rejected before storage with HTTP 413 `FILE_TOO_LARGE`.

---

## 4. Cloudinary Transformation & Folder Structure

### 4.1 Predictable Folder Architecture
Assets are structured deterministically under a controlled namespace:
```
nexus/profile-images/{member-slug-or-unique-id}_{timestamp}
```
*Example:* `nexus/profile-images/orosmit-mishra_1726830000.webp`

Random or uncontrolled per-upload directories are prohibited.

### 4.2 Web-Optimized Image Transformation
During upload, Cloudinary applies server-side transformations:
- `c_limit,w_1200,h_1200`: Scales down massive original camera files to a maximum bounding box of 1200x1200px while strictly preserving aspect ratio.
- `q_auto`: Automated intelligent compression balancing visual fidelity and lightweight transfer.
- `f_auto`: Automated next-gen format delivery (serves AVIF or WebP depending on browser support).

---

## 5. Database Schema & State Management

SQLite stores references to the Cloudinary asset. Binary file data is never stored inside SQLite.

### Fields on `members` Table:
| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `profile_image_url` | `TEXT` | YES | Canonical HTTPS Cloudinary CDN delivery URL (`secure_url`) |
| `profile_image_public_id` | `TEXT` | YES | Cloudinary asset identifier used for deletion and replacements |
| `photo_url` | `TEXT` | YES | Backwards-compatible duplicate of `profile_image_url` for legacy consumers |
| `updated_at` | `TEXT` | NO | ISO 8601 timestamp tracking last mutation |

---

## 6. Safe Replacement & Deletion Workflows

### 6.1 Safe Replacement Workflow
When replacing an existing profile image:
1. Capture `oldPublicId = member.profile_image_public_id`.
2. Upload the new file to Cloudinary and obtain `newSecureUrl` and `newPublicId`.
3. Commit updates to SQLite (`profile_image_url`, `profile_image_public_id`, `photo_url`, `updated_at`).
4. **Only AFTER the database update succeeds**, safely destroy `oldPublicId` on Cloudinary.
5. **Fault Recovery**: If SQLite write throws an error, the newly uploaded Cloudinary asset (`newPublicId`) is immediately destroyed, preventing orphaned media.

### 6.2 Image Deletion Workflow
When removing a profile image via `DELETE /api/admin/members/:id/image`:
1. Verify member existence (HTTP 404 if not found).
2. Capture `oldPublicId = member.profile_image_public_id`.
3. Clear image columns in SQLite (`profile_image_url = NULL`, `profile_image_public_id = NULL`, `photo_url = NULL`).
4. Destroy `oldPublicId` from Cloudinary.
5. Member record is strictly preserved; UI gracefully displays initials fallback badge.

---

## 7. API Specification

### 7.1 `POST /api/admin/members/:id/image`
Uploads or replaces a member's profile image.

- **Authentication**: Required (`nexus_admin_session` cookie).
- **Supported Encodings**:
  - `application/json` with `{ filename: string, content: string }` (Base64 data or Data URI)
  - `multipart/form-data` with `file` form field
  - Raw binary stream with `x-filename` header
- **Success Response (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "id": "mem-026",
    "unique_id": "NX-026",
    "name": "OROSMIT MISHRA",
    "profile_image_url": "https://res.cloudinary.com/plg8gola/image/upload/v1726830000/nexus/profile-images/orosmit-mishra_1726830000.webp",
    "profile_image_public_id": "nexus/profile-images/orosmit-mishra_1726830000",
    "photo_url": "https://res.cloudinary.com/plg8gola/image/upload/v1726830000/nexus/profile-images/orosmit-mishra_1726830000.webp",
    "updated_at": "2026-09-20T12:00:00.000Z"
  },
  "meta": {
    "message": "Profile image uploaded successfully",
    "image": {
      "url": "https://res.cloudinary.com/plg8gola/image/upload/v1726830000/nexus/profile-images/orosmit-mishra_1726830000.webp",
      "publicId": "nexus/profile-images/orosmit-mishra_1726830000",
      "format": "webp",
      "bytes": 45210
    }
  },
  "error": null
}
```

### 7.2 `DELETE /api/admin/members/:id/image`
Removes a member's profile image.

- **Authentication**: Required (`nexus_admin_session` cookie).
- **Success Response (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "id": "mem-026",
    "unique_id": "NX-026",
    "name": "OROSMIT MISHRA",
    "profile_image_url": null,
    "profile_image_public_id": null,
    "photo_url": null,
    "updated_at": "2026-09-20T12:05:00.000Z"
  },
  "meta": {
    "message": "Profile image removed successfully"
  },
  "error": null
}
```

---

## 8. Public Consumers Compatibility

Both public consumers consume the updated image URL without requiring architectural redesigns:
1. **Public Member Profile** (`GET /api/members/:slug`):
   - Resolves `photoUrl: record.profile_image_url || record.photo_url || null`.
2. **E-ID Identity Card** (`GET /api/eid/members/:identifier`):
   - Resolves `image: record.profile_image_url || record.photo_url || null`.
3. **Resilient Frontend Fallbacks**:
   - In both public showcase and admin grids, broken or missing image URLs display clean initials badges (`onError` handler prevents layout crashes).

---

## 9. Automated Verification & Test Coverage

Test Suite: `backend/tests/admin-cloudinary.test.ts`  
Command: `npm run test:admin:cloudinary`

### Results (18 / 18 Tests Passing - 100%):
1. `POST /image` returns HTTP 401 when unauthenticated.
2. `DELETE /image` returns HTTP 401 when unauthenticated.
3. `POST /auth/login` establishes authenticated admin session.
4. Upload valid JPEG via JSON base64 updates SQLite record and Cloudinary reference.
5. Upload valid PNG via multipart/form-data updates SQLite record.
6. Upload valid WebP via JSON base64 updates SQLite record.
7. Safe replacement: Old Cloudinary asset is destroyed only after new image is committed to DB.
8. `DELETE /image` clears SQLite columns and destroys Cloudinary asset.
9. `DELETE /image` on member with no photo succeeds gracefully without error.
10. Executable payload disguised as image (`MZ` binary header) rejected with HTTP 400 `EXECUTABLE_REJECTED`.
11. Oversized payload (>5MB) rejected with HTTP 413 `FILE_TOO_LARGE`.
12. Plain text / unrecognized file rejected with HTTP 400 `UNRECOGNIZED_FILE_SIGNATURE`.
13. Dangerous file extension rejected with HTTP 400 `DANGEROUS_FILE_EXTENSION`.
14. Non-existent member ID returns HTTP 404 `MEMBER_NOT_FOUND`.
15. Cloudinary upload failure leaves SQLite database untouched (zero state corruption).
16. Public member profile (`/api/members/:slug`) immediately reflects updated Cloudinary image.
17. Public E-ID card endpoint (`/api/eid/members/:identifier`) immediately reflects updated Cloudinary image.
18. Production client bundle (`dist/assets/*.js`) strictly audited to verify zero leakage of `CLOUDINARY_API_SECRET` or admin credentials.

---

## 10. Operational Guidelines & Boundaries

1. **Deterministic Test Execution**: `cloudinaryService` includes an offline mock mode (`setMockMode(true)`) automatically enabled in test environments (`NODE_ENV=test`) when credentials are unset, ensuring continuous integration (CI) tests never fail due to missing cloud API keys.
2. **Immutable Unique IDs**: Assigning or updating profile photos NEVER alters or mutates a member's permanent `unique_id` (`NX-XXX`) or `slug`.
3. **Browser Bundle Isolation**: Cloudinary secrets must never be referenced in `frontend/src/*` code.
4. **E-ID Integration**: Complete synchronization of Cloudinary profile images across the public E-ID card renderer and QR code ecosystem is documented in [ADMIN_EID_INTEGRATION.md](./ADMIN_EID_INTEGRATION.md).
5. **Centralized Media Library (Phase 17)**: All member profile images uploaded to Cloudinary are cataloged in SQLite `media_assets` and fully manageable via `/admin/media`. See [ADMIN_MEDIA_LIBRARY.md](./ADMIN_MEDIA_LIBRARY.md) for usage tracking and cascade replacement.
