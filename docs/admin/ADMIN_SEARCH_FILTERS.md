# NEXUS Admin Portal - Phase 6: Member Search, Filtering, Sorting & Pagination

**Document Version:** 1.0.0  
**Phase:** 6  
**Route:** `/admin/members`  
**API Endpoints:** `GET /api/admin/members`, `GET /api/admin/members/facets`  
**Target Database:** SQLite (`data/nexus.db`)  
**Status:** Implemented, Fully Tested (100% Pass Rate), Production Ready

---

## 1. Executive Summary

Phase 6 scales the NEXUS Admin Portal Member Management system from an unpaginated view to a high-performance, server-side data grid capable of handling hundreds or thousands of member records without client-side lag or memory exhaustion.

### Core Architectural Mandates Achieved
1. **100% Server-Side Execution**: Zero client-side in-memory JavaScript array filtering or full table dumps. Every keystroke (debounced) and filter choice delegates directly to SQLite with optimized parameterized SQL.
2. **Multi-Field Case-Insensitive Search**: Matches across `name`, `unique_id`, `email`, `role`, `domain`, `department`, and `slug`.
3. **Faceted Filtering**: Filter by status (`ACTIVE`, `INACTIVE`, `ALUMNI`, or `all`), department, domain, and role, dynamically powered by SQLite distinct facets.
4. **Whitelisted Sorting & SQL Injection Defense**: Sorting keys (`name_asc`, `name_desc`, `newest`, `oldest`, `unique_id_asc`, `unique_id_desc`, `updated_desc`) are validated against a strict server whitelist. Client values are never concatenated directly into `ORDER BY`.
5. **Controlled Pagination**: Standardized page sizes (`25`, `50`, `100`), returning total matching counts, total pages, and navigation availability flags (`hasNextPage`, `hasPrevPage`).
6. **URL Query State Synchronization**: Filter state, search terms, sorting, and pagination are mirrored to the browser URL query string (`?q=...&status=...&department=...&sort=...&page=...&pageSize=...`). Supports page reload, bookmarking, and browser back/forward navigation (`popstate`).
7. **Local Loading & Race Condition Protection**: Subtle progress bar indicator over the table during network queries. Monotonic request tracking (`latestRequestIdRef`) discards out-of-order stale responses.

---

## 2. Database Optimization & Indexing

To ensure fast search and filter queries even under high record volume, migration `006_member_search_filter_indexes` was added to `backend/db/migrate.ts` and applied to `data/nexus.db`:

```sql
-- Migration 006: Indexes for Member Search, Filter & Sorting Performance
CREATE INDEX IF NOT EXISTS idx_members_domain ON members(domain);
CREATE INDEX IF NOT EXISTS idx_members_department ON members(department);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);
```

### Complete Index Profile on `members` Table:
| Index Name | Column(s) | Purpose |
| :--- | :--- | :--- |
| `idx_members_unique_id` | `unique_id` (UNIQUE) | Constant-time identity lookups and uniqueness enforcement |
| `idx_members_slug` | `slug` (UNIQUE) | Permanent public URL routing |
| `idx_members_email` | `email` (UNIQUE) | Collision detection and login resolution |
| `idx_members_status` | `status` | Direct status tab filtering (`ACTIVE`, `INACTIVE`, `ALUMNI`) |
| `idx_members_domain` | `domain` | Fast domain dropdown filtering |
| `idx_members_department` | `department` | Fast department dropdown filtering |
| `idx_members_name` | `name` | Collation-based sorting and name search |
| `idx_members_created_at` | `created_at` | Chronological sorting (`newest`, `oldest`) |

---

## 3. Server-Side Query Engine & Repository Implementation

Located in `backend/db/repositories/members.repository.ts`, `findAllAdmin` executes parameterized queries:

### 3.1 Multi-Field Search
Search terms are trimmed of whitespace and applied using parameterized SQL placeholders across 7 columns:
```sql
SELECT * FROM members
WHERE 1=1
  AND (
    LOWER(name) LIKE LOWER(?) 
    OR LOWER(unique_id) LIKE LOWER(?) 
    OR LOWER(email) LIKE LOWER(?) 
    OR LOWER(role) LIKE LOWER(?) 
    OR LOWER(domain) LIKE LOWER(?) 
    OR LOWER(department) LIKE LOWER(?) 
    OR LOWER(slug) LIKE LOWER(?)
  )
```
Parameterized values use wildcard wrapping (`%${term}%`), immune to SQL syntax breaking from characters like `'`, `"`, `%`, or `;`.

### 3.2 Dynamic Facets Endpoint
`GET /api/admin/members/facets` retrieves populated categories directly from existing SQLite records:
```ts
public getFilterFacets(): {
  roles: string[];
  domains: string[];
  departments: string[];
  statuses: string[];
} {
  const rolesRows = this.db
    .prepare("SELECT DISTINCT role FROM members WHERE role IS NOT NULL AND role != '' ORDER BY role ASC")
    .all() as Array<{ role: string }>;
  const domainsRows = this.db
    .prepare("SELECT DISTINCT domain FROM members WHERE domain IS NOT NULL AND domain != '' ORDER BY domain ASC")
    .all() as Array<{ domain: string }>;
  const departmentsRows = this.db
    .prepare("SELECT DISTINCT department FROM members WHERE department IS NOT NULL AND department != '' ORDER BY department ASC")
    .all() as Array<{ department: string }>;

  return {
    roles: rolesRows.map((r) => r.role),
    domains: domainsRows.map((d) => d.domain),
    departments: departmentsRows.map((d) => d.department),
    statuses: ['ACTIVE', 'INACTIVE', 'ALUMNI'],
  };
}
```

### 3.3 Whitelisted Sorting Matrix
`ORDER BY` clauses in SQL cannot accept parameterized `?` placeholders. To prevent SQL injection vulnerabilities, a strict whitelist maps user input to verified clauses:

| Sort Key | SQL Order By Clause | Fallback / Default |
| :--- | :--- | :--- |
| `name_asc` | `ORDER BY name COLLATE NOCASE ASC` | Alphabetical (case-insensitive) |
| `name_desc` | `ORDER BY name COLLATE NOCASE DESC` | Reverse Alphabetical |
| `unique_id_asc` | `ORDER BY unique_id ASC` | ID Order (`NX-001` -> `NX-029`) |
| `unique_id_desc` | `ORDER BY unique_id DESC` | ID Order (`NX-029` -> `NX-001`) |
| `newest` | `ORDER BY created_at DESC` | Most recently created first |
| `oldest` | `ORDER BY created_at ASC` | Oldest created first |
| `updated_desc` (default) | `ORDER BY updated_at DESC, name ASC` | Most recently modified first |

Any unrecognized or malicious sort input silently defaults to `updated_desc`, preventing SQL syntax exceptions and SQL injection attacks.

### 3.4 Pagination & Windowing
- `page`: Clamped to `Math.max(1, parseInt(query.page))`.
- `pageSize`: Clamped between `1` and `100` (default: `25`).
- `offset`: Calculated as `(page - 1) * limit`.
- `totalPages`: Calculated as `total === 0 ? 0 : Math.ceil(total / limit)`.
- `hasNextPage`: `totalPages > 0 && page < totalPages`.
- `hasPrevPage`: `totalPages > 0 && page > 1`.

---

## 4. API Endpoints & Request/Response Contracts

### 4.1 `GET /api/admin/members`
Protected by `requireAdminAuth`.

#### Query Parameters:
| Param | Type | Description | Default |
| :--- | :--- | :--- | :--- |
| `q` / `search` | `string` | Search query across 7 fields | `""` |
| `status` | `string` | `ACTIVE`, `INACTIVE`, `ALUMNI`, or `all` | `all` |
| `department` | `string` | Department filter name or `all` | `all` |
| `domain` | `string` | Domain filter name or `all` | `all` |
| `role` | `string` | Role filter substring or `all` | `all` |
| `sort` | `string` | One of whitelisted sort keys | `updated_desc` |
| `page` | `number` | 1-based page index | `1` |
| `pageSize` / `limit` | `number` | Number of items per page (1 - 100) | `25` |

#### Response Format:
```json
{
  "success": true,
  "data": [
    {
      "id": "mem-026",
      "unique_id": "NX-026",
      "name": "OROSMIT MISHRA",
      "display_name": "Orosmit Mishra",
      "slug": "orosmit-mishra",
      "email": "orosmit.mishra@nexus.campus",
      "role": "PROJECT ARCHITECT & LEAD",
      "domain": "Applied Computer Science",
      "department": "Engineering",
      "status": "ACTIVE",
      "created_at": "2026-09-01T00:00:00.000Z",
      "updated_at": "2026-09-20T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 25,
    "pageSize": 25,
    "totalItems": 29,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPrevPage": false,
    "sort": "updated_desc",
    "filters": {
      "status": "all",
      "role": null,
      "domain": null,
      "department": null,
      "q": null
    }
  },
  "error": null
}
```

### 4.2 `GET /api/admin/members/facets`
Protected by `requireAdminAuth`. Returns distinct categories for populating client filter dropdowns:
```json
{
  "success": true,
  "data": {
    "roles": ["AUDIO & DIGITAL MEDIA", "CORE PROTOCOL LEAD", "PROJECT ARCHITECT & LEAD"],
    "domains": ["Applied Computer Science", "Cyber-Physical Systems", "Interactive Systems"],
    "departments": ["Coordination", "Design", "Engineering"],
    "statuses": ["ACTIVE", "INACTIVE", "ALUMNI"]
  },
  "meta": {
    "maxPageSize": 100
  },
  "error": null
}
```

---

## 5. Frontend Architecture & UX

File: `frontend/src/admin/pages/AdminMembersPage.tsx`

### 5.1 URL Query Synchronization & History
- Synchronizes search (`q`), status (`status`), department (`dept`), domain (`domain`), role (`role`), sort (`sort`), page (`p`), and page size (`size`) with the browser URL `window.location.search`.
- Listens to `popstate` events so browser "Back" and "Forward" navigation transitions seamlessly without losing view state.
- Refreshing the page preserves all current filter selections.

### 5.2 Responsive Control Toolbar
- **Debounced Search Bar**: Debounced at 300ms to prevent request flood while typing. Includes quick clear ("✕") icon button.
- **Status Filter Segment**: Tab group (`All`, `Active`, `Inactive`, `Alumni`) with active counts.
- **Dropdown Filters**:
  - Department dropdown (dynamically populated from facets).
  - Domain dropdown (dynamically populated from facets).
  - Role dropdown (dynamically populated from facets).
  - Sort dropdown (`Updated (Recent First)`, `Name (A-Z)`, `Name (Z-A)`, `Unique ID (Ascending)`, `Unique ID (Descending)`, `Creation (Newest First)`, `Creation (Oldest First)`).
- **Page Size Selector**: Dropdown options for `25`, `50`, and `100` items per page.
- **Reset Filters Button**: Displays whenever filters or search terms deviate from defaults to reset back to initial view with a single click.

### 5.3 Localized Loading State & Concurrency Safety
- A high-tech gradient progress bar renders at the top of the table container during background fetch operations (`isSearching`).
- The previous table rows remain visible beneath the progress bar, preventing disruptive layout jumps or white screen flashes.
- `latestRequestIdRef` ensures slow responses from previous queries do not overwrite fresher results.

### 5.4 Pagination Footer
- Precise count range display: `Showing 1 to 25 of 29 members`.
- Navigation controls: `First`, `Previous`, `Next`, `Last` buttons.
- Buttons dynamically disable when at start/end boundaries or when loading.

---

## 6. Automated Verification Suite

Test Suite: `backend/tests/admin-search-filters.test.ts`  
Command: `npm run test:admin:search`

### Test Coverage (29 / 29 Tests Passing - 100%):
1. **Unauthenticated Protection**:
   - `GET /api/admin/members?q=test` strictly rejected with HTTP 401.
   - `GET /api/admin/members/facets` strictly rejected with HTTP 401.
2. **Authentication & Facets**:
   - `POST /api/admin/auth/login` sets secure session cookie.
   - `GET /api/admin/members/facets` returns structured arrays for roles, domains, departments, and statuses.
3. **Multi-field Search**:
   - Search by exact `unique_id` (`q=nx-026`).
   - Search by case-insensitive name (`q=orosmit`).
   - Search with leading/trailing whitespace trimmed automatically (`q=  orosmit  `).
   - Search by partial role (`q=lead`).
   - Search by email domain (`q=@nexus.campus`).
   - Search with SQL special characters (`%` and `_`) handled safely without injection.
   - Search with no matching records returns `data: []`, `totalItems: 0`, `totalPages: 0`.
4. **Faceted Filtering**:
   - Filter by `status=ACTIVE`.
   - Filter by `status=INACTIVE`.
   - Filter by `status=all`.
   - Filter by department (dynamically verified from facets).
   - Filter by domain (dynamically verified from facets).
   - Filter by role (dynamically verified from facets).
5. **Whitelisted Sorting & SQL Injection Defense**:
   - `sort=name_asc` verified alphabetical order.
   - `sort=name_desc` verified reverse alphabetical order.
   - `sort=unique_id_asc` verified `NX-001` first.
   - `sort=unique_id_desc` verified `NX-029` first.
   - Malicious SQL injection payload (`sort=malicious_col DESC;--`) safely intercepted and defaulted without error.
6. **Controlled Pagination**:
   - Default pagination (page 1, pageSize 25, 29 total items, 2 total pages, `hasNextPage: true`).
   - Page 2 retrieval (remaining 4 items, `hasNextPage: false`, `hasPrevPage: true`).
   - Page size 50 returns all 29 items on page 1 with `totalPages: 1`.
   - Excessive page size (`pageSize=5000`) clamped to max limit 100.
   - Negative page numbers (`page=-5`) clamped to page 1.
   - Out-of-bounds page (`page=999`) returns empty array with accurate metadata.
7. **Combined Operation**:
   - Search + filter + sort + pagination combined simultaneously (`q=NX&status=ACTIVE&sort=name_asc&page=1&pageSize=10`) verified 100% accurate.

---

## 7. Operational Boundaries & Rules

1. **Client-Side Filtering Prohibited**: All data transformations, slicing, sorting, and matching MUST happen inside SQLite via `members.repository.ts`.
2. **Permanent Identifiers Preserved**: `unique_id` and `slug` remain permanent and unalterable across all search and filter operations.
3. **Public API Integrity**: Public showcase endpoints (`GET /api/members`) and E-ID card endpoints (`GET /api/eid/members/*`) operate independently and are untouched by admin search changes.
