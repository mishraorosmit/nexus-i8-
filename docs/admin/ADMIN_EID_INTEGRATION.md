# NEXUS Admin Portal & E-ID System Integration (Phase 8)

## 1. Overview & Objective

Phase 8 establishes a **Single Source of Truth** for member identity by connecting the NEXUS digital suspended E-ID card frontend (`/memberID/:slug/:unique_id`) to the SQLite database (`data/nexus.db`) and Phase 5/7 Member Management systems.

```
┌─────────────────────────────────────────────────────────────┐
│                    SQLite (data/nexus.db)                   │
│                     Table: members                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      NEXUS Member APIs                      │
│   • GET /api/eid/members/:identifier                        │
│   • GET /api/eid/memberID/:slug/:uniqueId                   │
│   • GET /api/members/:uniqueId                              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Public Routing Layer                      │
│   • Primary Canonical: /memberID/:slug/:unique_id           │
│   • Legacy Compatible: /:slug/:unique_id                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      E-ID Frontend UI                       │
│   • EidCardPage -> MemberProfilePage -> TeamCard            │
│   • QR Code: encodes ONLY canonical public URL              │
│   • Cloudinary Image: profile_image_url || photo_url        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Public Member Identity & Canonical Routes

- **Authoritative Identifier**: Permanent `unique_id` formatted as `NX-XXX` (e.g. `NX-026`).
- **Canonical Public Route**: `/memberID/:slug/:unique_id` (e.g. `/memberID/orosmit-mishra/NX-026`).
- **Secondary / Legacy Compatibility**: `/:slug/:unique_id` and `/memberID/:unique_id` automatically canonicalize to `/memberID/:slug/:unique_id`.
- **Slug Canonicalization**:
  - The `unique_id` remains authoritative.
  - If a user navigates to `/memberID/wrong-slug/NX-026`, the authoritative ID lookup detects the mismatch and automatically replaces browser history state with the canonical URL (`/memberID/orosmit-mishra/NX-026`), preventing duplicate public pages.
  - If `unique_id` does not exist in SQLite, returns a deliberate 404 NOT_FOUND state without server crash.

---

## 3. Public Member Lookup APIs & Data Sanitization

### Endpoints
1. `GET /api/eid/members/:identifier` — Resolves active card by `unique_id` (case-insensitive) or `slug`.
2. `GET /api/eid/memberID/:slug/:uniqueId` — Verifies canonical pair.
3. `GET /api/members/:uniqueId` — Public member directory lookup.

### Public Fields (Sanitized)
| Field | Type | Description |
|---|---|---|
| `uniqueId` | `string` | Permanent public ID (e.g. `NX-026`) |
| `slug` | `string` | URL-safe slug (e.g. `orosmit-mishra`) |
| `name` | `string` | Member full name |
| `displayName` | `string` | Display name alias |
| `role` | `string` | Squad designation / role |
| `department` | `string` | Operational department |
| `domain` | `string[]` | Technical domain pill array |
| `image` | `string \| null` | Cloudinary profile image CDN URL |
| `bio` | `string \| null` | Quote / bio |
| `status` | `'ACTIVE' \| 'INACTIVE' \| 'ALUMNI'` | Public status indicator |
| `clearanceLevel` | `string` | Security clearance level |
| `specialWord` | `string` | Core operative word |
| `nodeLocation` | `string` | Campus lab station |
| `frequency` | `string` | Operating frequency |
| `securityZone` | `string` | Security zone assignment |
| `badgeIssue` | `string` | Issue cycle code |
| `skills` | `string[]` | Array of technical proficiencies |
| `socials` | `Record<string, string>` | Public social profiles |
| `qrUrl` | `string` | Canonical card path: `/memberID/:slug/:uniqueId` |

### Strictly Protected Fields (Never Exposed Publicly)
- Internal SQLite primary key (`id` like `team-02`)
- Member email address (`email`)
- Session tokens, passwords, and crypto salts
- Audit log records
- Cloudinary `api_key` and `api_secret`
- Internal Cloudinary asset public IDs (`profile_image_public_id`)

---

## 4. Public Status Behavior

| Member Status | Visual / E-ID Behavior | API Response |
|---|---|---|
| `ACTIVE` | Digital physical hanging badge renders normally with full interactive 3D flip, QR scanner, and share controls. | HTTP 200 `{ success: true, data: { status: 'ACTIVE', ... } }` |
| `ALUMNI` | Digital badge renders with distinctive `ALUMNI` badge alongside the department pill. | HTTP 200 `{ success: true, data: { status: 'ALUMNI', ... } }` |
| `INACTIVE` | Card rendering is restricted; displays an industrial **"ACCESS SUSPENDED // CREDENTIAL REVOKED"** security card with lock icon and explanation. Route remains intact to confirm identity revocation. | HTTP 200 (E-ID API serializes `status: 'INACTIVE'`; client router triggers revoked UI) |

---

## 5. QR Code Payload Security

- **Strict Rule**: QR module encodes **exclusively** the public canonical card URL:
  ```
  https://<domain>/memberID/<slug>/<unique_id>
  ```
- **Prohibited Data in QR**:
  - Full member JSON
  - Member email
  - Internal DB row IDs
  - Authentication tokens or cookies
  - Cloudinary public IDs
- Phone camera testing confirms immediate ISO/IEC 18004 Reed-Solomon recognition with white modules on dark background and quiet-zone margins.

---

## 6. Profile Image & Cloudinary Fallback Pipeline

1. **Primary Source**: Cloudinary CDN image reference stored in `members.profile_image_url` or legacy `photo_url`.
2. **Fallback on Failure**: `TeamCard` applies `onError={handleImageFallbackError}` which falls back to the default SVG silhouette without breaking card assembly or flipping mechanics.
3. **Null / Unset Image**: Explicitly handled with fallback avatar; never crashes card canvas or DOM snapshot generators.

---

## 7. Data Freshness & Cache Invalidation

- Public read endpoints utilize memory caching (`publicCache('eid', 60)`).
- When an administrator modifies a member via `/api/admin/members/*` (edit, status toggle, photo upload, photo deletion), the cache invalidation middleware automatically flushes both `'members'` and `'eid'` domain caches.
- Subsequent requests to `/api/eid/members/:id` immediately retrieve the updated SQLite record (`X-Cache: MISS`).

---

## 8. Data Source Cleanup & Demarcation

- **Competing Runtime Resurrections Removed**: The offline cache fallback in `api.ts` no longer overrides HTTP 404 responses. When a member is deleted in SQLite, the API returns 404 and the UI displays the deliberate not-found screen rather than resurrecting stale records from `members.json`.
- **Dynamic Directory Loading**: `fetchAllMembers()` and `router.tsx` load directory cards directly from SQLite via `/api/eid/members`.
- `members.json` remains strictly as a seed reference for initial database initialization and offline fallback when the server is completely unreachable.

---

## 9. Admin Preview Integration

- **Table Action**: Every row in `/admin/members` includes an E-ID Preview button (`<ExternalLink />`) that opens `/memberID/:slug/:uniqueId` in a new tab.
- **View Member Modal**: Contains a dedicated "Public E-ID Identity" card with direct link and preview action.

---

## 10. Automated Verification

- Integration test suite: `npm run test:admin:eid` (**48/48 tests, 100% pass**).
- Full regression suite: `npm test` (**all 14 test suites, 100% pass**).
- TypeScript Typecheck: `npm run lint` (**0 errors**).
- Production Build: `npm run build` (**clean bundle compilation in 4.76s**).

---

## 11. Cross-System Integration (Phase 9)

With the completion of Phase 9 ([ADMIN_PUBLIC_SITE_INTEGRATION.md](./ADMIN_PUBLIC_SITE_INTEGRATION.md)), the public NEXUS website (`/team`, `TeamPreview`) and E-ID card system consume the identical SQLite member database via `/api/members` and `/api/eid/*`. Both systems use canonical Cloudinary image delivery, consistent status handling (`ACTIVE`, `INACTIVE`, `ALUMNI`), and unified cache invalidation.
