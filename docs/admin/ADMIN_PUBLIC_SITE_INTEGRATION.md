# NEXUS Public Website Member Integration (Phase 9)

## 1. Executive Summary & Objective

Phase 9 connects the existing public NEXUS website (`/team` and Homepage `TeamPreview`) to the **Single Authoritative Member Source of Truth** in SQLite (`data/nexus.db`). The Admin Portal acts as the write layer; the public website, directory, and E-ID card renderer consume it without redesigning or disturbing the public user experience.

```
┌─────────────────────────────────────────────────────────────┐
│                    SQLite (data/nexus.db)                   │
│                     Table: members                          │
└──────────────┬──────────────────────────────┬───────────────┘
               │ Write (CRUD / Image Upload)  │ Read (Live Queries)
               ▼                              ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│         Admin Portal         │   │      Public Member APIs      │
│   • /admin/members           │   │   • GET /api/members         │
│   • POST/PATCH/DELETE        │   │   • GET /api/members/:id     │
└──────────────────────────────┘   └──────────────┬───────────────┘
                                                  │
                        ┌─────────────────────────┴─────────────────────────┐
                        ▼                                                   ▼
┌───────────────────────────────────────────────┐   ┌───────────────────────────────────────────────┐
│              Public NEXUS Website             │   │                   NEXUS E-ID                  │
│   • /team (Coordinators, Mentors, Heads,      │   │   • /memberID/:slug/:uniqueId                 │
│     Crew Directory, Dossier Overlay)          │   │   • 3D Hanging Badge, QR Code, Offline Sync   │
│   • / (TeamPreview carousel / grid)           │   │   • Profile image via Cloudinary CDN          │
│   • Cloudinary profile image rendering        │   │                                               │
└───────────────────────────────────────────────┘   └───────────────────────────────────────────────┘
```

---

## 2. Public Member Data Flow & Architecture

1. **Write Authority**:
   - Only the Admin Portal (`/admin/members`) and migration scripts write to the `members` SQLite table.
   - Any member mutation automatically invalidates `'members'` and `'eid'` cached responses in `memoryCache`.

2. **Read Consumers**:
   - **Public Website (`TeamPage.tsx` & `TeamPreview.tsx`)**:
     - Consumes `GET /api/members?limit=100` via `frontend/src/api/membersApi.ts`.
     - First paint initializes from bundled static records (`TEAM_MEMBERS`) to prevent layout shifts or blank screens.
     - Once the API responds, the state updates with live SQLite records.
     - Module-level memoization prevents duplicate requests between `TeamPreview` and `TeamPage`.
   - **E-ID Subsystem (`/memberID/:slug/:uniqueId`)**:
     - Consumes `GET /api/eid/memberID/:slug/:uniqueId` and `GET /api/eid/members/:identifier`.

---

## 3. Public API Specification & Endpoints

### 1. `GET /api/members`
- **Purpose**: Retrieves all active members for the public directory and showcases.
- **Default Limit**: `100` (allowing single roundtrip retrieval for all active members without pagination cutoff).
- **Query Parameters**:
  - `limit` (optional, default `100`, max `100`)
  - `page` (optional, default `1`)
  - `role` (optional, partial match)
  - `domain` (optional, partial match)
  - `q` (optional, multi-field search)
  - `status` (optional, constrained to `'active'` or `'alumni'`)
- **Server-Side Status Enforcement**:
  - Unauthenticated requests querying `status=inactive` or `status=all` are strictly clamped to `status=active`.
  - Inactive/suspended members are **never** returned in directory listings.
- **Payload Structure**:
  ```json
  {
    "data": [
      {
        "id": "NX-026",
        "publicId": "orosmit-mishra",
        "slug": "orosmit-mishra",
        "uniqueId": "NX-026",
        "name": "OROSMIT MISHRA",
        "displayName": "OROSMIT MISHRA",
        "role": "MANAGEMENT",
        "department": "Engineering",
        "domain": "Community & Project Strategy",
        "bio": "Leads organizational growth, team matching sessions, partnerships, and cross-disciplinary sprint execution.",
        "photoUrl": "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/orosmit-mishra.webp",
        "imageUrl": "https://res.cloudinary.com/plg8gola/image/upload/aarambh/team/orosmit-mishra.webp",
        "imagePosition": "center 18%",
        "socials": { "github": "https://github.com/mishraorosmit" },
        "status": "ACTIVE",
        "joinedDate": "2026-09-01",
        "createdAt": "2026-09-20T10:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 100,
      "totalItems": 29,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    },
    "error": null
  }
  ```

### 2. `GET /api/members/:id`
- **Purpose**: Single member profile detail lookup by `unique_id` (e.g. `NX-026`), `slug` (e.g. `orosmit-mishra`), or `public_id`.
- **Inactive Member Protection**:
  - If a member exists in SQLite but has `status = 'INACTIVE'`, this public endpoint returns HTTP `404 Not Found` with `{ "error": { "code": "MEMBER_NOT_FOUND" } }`.
  - Revoked or suspended identities cannot be inspected via public directory endpoints.

---

## 4. Public Fields vs Protected Fields

| Publicly Exposed | Type | Description |
| :--- | :--- | :--- |
| `id` / `uniqueId` | `string` | Public permanent identifier (e.g. `NX-026`) |
| `publicId` / `slug` | `string` | URL-safe name slug |
| `name` / `displayName` | `string` | Official and display names |
| `role` | `string` | Team / squad designation |
| `department` | `string` | Department grouping |
| `domain` | `string` | Specialization track |
| `bio` | `string` | Member biography |
| `photoUrl` / `imageUrl` | `string` | Canonical Cloudinary CDN image URL |
| `imagePosition` | `string` | CSS object-position coordinate |
| `socials` | `object` | Public GitHub, LinkedIn, Twitter links |
| `status` | `string` | `'ACTIVE'` or `'ALUMNI'` |

| Strictly Protected (Never Leaked Publicly) | Security Rationale |
| :--- | :--- |
| Internal SQLite Primary Key (`id`) | Protects internal database surrogate keys (e.g. `team-02`) |
| Member Contact Email (`email`) | Prevents email scraping and privacy violations |
| Passwords & Cryptographic Salts | Protects administrator accounts |
| Admin Session Cookies & Tokens | Enforces perimeter security |
| Cloudinary API Key & API Secret | Protects cloud asset storage |
| Database Audit Logs | Internal administrative trail |

---

## 5. Status Rules & Member Lifecycle

1. **`ACTIVE`**:
   - Displayed in public showcases: `LeadershipShowcase`, `HeadsShowcase`, `CrewDirectory`, and `TeamPreview`.
   - Included in public crew count: `<span>{members.length} CREW MEMBERS</span>`.
2. **`ALUMNI`**:
   - Excluded from active squad directory by default.
   - Accessible when explicitly querying `GET /api/members?status=alumni`.
3. **`INACTIVE`**:
   - Excluded server-side from all public directory listings.
   - Attempting to query `GET /api/members?status=inactive` is clamped server-side to `'active'`.
   - Direct lookup on `/api/members/:id` returns HTTP 404.
   - Record remains safely archived in SQLite for administrative audits.

---

## 6. Image Flow & Cloudinary Delivery

```
Admin Upload / Edit
        ↓
Cloudinary CDN URL stored in SQLite (profile_image_url & photo_url)
        ↓
Public Member API serializes photoUrl & imageUrl
        ↓
Frontend resolveImageUrl() maps canonical URLs
        ↓
TeamCard / ProfileCard renders with onError -> handleImageFallbackError
```

- **Canonical URL**: Profile images always point to Cloudinary CDN delivery URLs (e.g. `https://res.cloudinary.com/plg8gola/image/upload/...`).
- **Graceful Fallback**: If an image fails to load (offline development, invalid CDN URL), `handleImageFallbackError` intercepts the `onError` event and seamlessly swaps the source to the local canonical path without breaking the UI.

---

## 7. Performance & Deduplication Strategy

- **Instant First Paint**: `TeamPage` and `TeamPreview` initialize their state with static fallback data. There is zero layout shift, zero blank screen, and no loading spinners.
- **Single Request Batching**: `fetchPublicMembers()` requests `/api/members?limit=100`, receiving the entire active roster in one call instead of firing multiple paginated queries.
- **In-Memory Memoization**: An in-memory cache variable holds the resolved `TeamMember[]` list. If the user navigates from the Homepage (`TeamPreview`) to the Team page (`TeamPage`), the cached promise/result is reused immediately without making a duplicate network request.
- **Zero Polling & Zero WebSockets**: The site relies on controlled HTTP caching and on-demand invalidation. No persistent WebSocket or polling overhead is introduced.

---

## 8. Obsolete Data Sources & Retained Assets

- **Runtime Switch Complete**:
  - `TeamPage.tsx` and `TeamPreview.tsx` now dynamically consume the real backend API.
- **Intentionally Retained Assets**:
  - `RAW_TEAM_MEMBERS` / `TEAM_MEMBERS` in `frontend/src/data/nexusData.ts`:
    - Retained strictly as an offline/build-time fallback when backend servers are unreachable or during cold compilation.
  - Canonical images in `frontend/public/images/team/`:
    - Retained for offline fallback and static builds.
  - `Eid-card/data/members.json`:
    - Retained as a seed reference for initial SQLite migrations and CLI import tools (`scripts/import-eid-members.ts`).

---

## 9. Verification & Automated Testing

A dedicated integration test suite (`backend/tests/public-members.test.ts`) tests all 5 critical domains:

```bash
npm run test:public:members
```

| Test Group | Verification Coverage | Result |
| :--- | :--- | :--- |
| **Test Group 1** | Public directory returns 200, format matches DTO, limit defaults to 100, no truncation | **PASS** |
| **Test Group 2** | Zero leakage of internal team IDs, emails, passwords, or Cloudinary secrets | **PASS** |
| **Test Group 3** | Inactive members excluded server-side; status=inactive clamp; alumni filtering | **PASS** |
| **Test Group 4** | Single lookup by NX-XXX, slug; inactive member returns 404; non-existent returns 404 | **PASS** |
| **Test Group 5** | Admin PATCH invalidates cache; role, name, image, and deactivation reflect immediately | **PASS** |

### Complete Regression Suite:
All 14 test suites in `npm test` pass with 100% success rate:
- `test:api`
- `test:admin`
- `test:admin:auth`
- `test:admin:db`
- `test:admin:foundation`
- `test:admin:members`
- `test:admin:search`
- `test:admin:cloudinary`
- `test:admin:eid`
- `test:public:members` (Phase 9)
- `test:media`
- `test:submissions`
- `test:hardening`
- `test:eid`

---

## 10. Known Limitations & Next Steps

1. **Project / Event Showcases**: Public projects and events continue to use static definitions in `nexusData.ts`. Their migration to SQLite will be addressed in dedicated showcase management phases.
2. **CDN Geographic Caching**: When deploying to production edge caches (Cloudflare / Vercel Edge), cache headers on `/api/members` should specify `s-maxage=60, stale-while-revalidate=300`.
