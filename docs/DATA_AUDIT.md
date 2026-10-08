# NEXUS Repository Complete Data Audit Report (Phase 1)

**Generated**: 2026-10-08  
**Scope**: Complete repository scan (Public Frontend, Admin Portal, E-ID System, Backend/API Layer, SQLite Database, Seed Scripts, JSON/TS/JS Data Constants, Media Metadata, and System Components)  
**Status**: READ-ONLY PHASE 1 AUDIT COMPLETE (Zero Destructive Changes Made)

---

## 1. Executive Summary

This data audit establishes a comprehensive inventory of all data sources, data flows, fallback mechanisms, duplicate stores, and records across the NEXUS repository (`nexus-i8-`).

### Key Findings
1. **Dual Data Paradigms**: The platform operates on a dual architecture:
   - **Static TS/JSON Source of Truth**: Primary member (`TEAM_MEMBERS`), project (`PROJECTS`), and gallery (`GALLERY_ITEMS`) datasets originate in [`frontend/src/data/nexusData.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/data/nexusData.ts).
   - **SQLite Database Source of Truth**: The backend database ([`data/nexus.db`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/connection.ts)) is initialized and seeded from [`backend/db/seed.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/seed.ts) using `nexusData.ts` + `members.json`.
2. **Frontend Fallback Pattern**: Frontend API client modules ([`membersApi.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/api/membersApi.ts), [`projectsApi.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/api/projectsApi.ts), [`LinuxDesktop.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/components/linux/LinuxDesktop.tsx)) attempt to fetch live SQLite data via REST APIs (`/api/members`, `/api/projects`), but gracefully fall back to hardcoded static TS arrays if the network fails or backend is unreachable.
3. **E-ID Dataset Mirrors**: E-ID member data is mirrored across 5 identical `members.json` files maintained deterministically by [`scripts/build-eid-dataset.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/scripts/build-eid-dataset.ts).
4. **No Destructive Changes**: No code, data, database schema, or authentication logic was deleted or modified in this audit phase.

---

## 2. Entity-by-Entity Data Source Map

| Entity | Current Data Source | Authoritative Source of Truth | Frontend/Backend Alignment | Competing / Duplicate Sources | Fallback / Overrides | Authenticity Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Members / Squad** | `nexusData.ts`, SQLite `members` table, 5x `members.json` mirrors | `frontend/src/data/nexusData.ts` (Builds DB & E-ID) | Aligned via API + static fallback | 1. `nexusData.ts`<br>2. SQLite `members`<br>3. 5x `members.json` | `membersApi.ts` falls back to `TEAM_MEMBERS`. `TeamPage.tsx` has inline fallback objects. | **Authentic**: 34 real 2026 squad members. |
| **Projects** | `nexusData.ts`, SQLite `projects` table | `frontend/src/data/nexusData.ts` | Aligned via API + static fallback | 1. `nexusData.ts`<br>2. SQLite `projects` | `projectsApi.ts` & `LinuxDesktop.tsx` fall back to `PROJECTS`. | **Authentic**: 9 student projects built in 2026. |
| **Events** | `seedData.ts`, SQLite `events` table | SQLite `events` table | Backend API (`/api/events`) | 1. `seedData.ts`<br>2. SQLite `events` | `EventShowcaseSection.tsx` returns `null` (hides section) if empty. | **Demo / Seed**: 3 demo event records. |
| **Announcements** | `seedData.ts`, SQLite `announcements` table | SQLite `announcements` table | Backend API (`/api/announcements`) | 1. `seedData.ts`<br>2. SQLite `announcements` | Returns empty array `[]` if empty. | **Demo / Seed**: 2 demo announcement items. |
| **Gallery / Archive** | `nexusData.ts`, SQLite `archive_items` table | `frontend/src/data/nexusData.ts` | Static TS in frontend, API in backend | 1. `nexusData.ts`<br>2. SQLite `archive_items` | `GalleryPage.tsx` reads `GALLERY_ITEMS` directly. | **Authentic**: 9 photography/artifact items. |
| **Resources** | `seedData.ts`, SQLite `resources` table | SQLite `resources` table | Backend API (`/api/resources`) | 1. `seedData.ts`<br>2. SQLite `resources` | Returns empty array if empty. | **Authentic**: 3 technical schematics & starter kits. |
| **Site Settings** | `seedData.ts`, SQLite `site_settings` table | SQLite `site_settings` table | Admin API (`/api/admin/site-settings`) | 1. `seedData.ts`<br>2. SQLite `site_settings` | Admin settings page loads from backend. | **Authentic**: Studio name, term, and open hours. |
| **Admin Accounts** | `seedData.ts`, SQLite `admin_users` table | SQLite `admin_users` table | Backend Auth (`/api/admin/auth/login`) | 1. `seedData.ts`<br>2. SQLite `admin_users` | Hardcoded default passwords in seed script. | **Seed Credentials**: `admin@nexus.campus` super_admin. |
| **Registrations** | SQLite `event_registrations` table | SQLite `event_registrations` table | Live POST (`/api/events/:id/register`) | Single source (SQLite table) | Zero seed rows created. | **Live Production Table**: Populated by user actions. |
| **Submissions** | SQLite `submissions` table | SQLite `submissions` table | Live POST (`/api/submissions`) | Single source (SQLite table) | Zero seed rows created. | **Live Production Table**: Populated by recruitment forms. |
| **Audit Logs** | SQLite `audit_logs` table | SQLite `audit_logs` table | Admin API (`/api/admin/audit-logs`) | Single source (SQLite table) | Zero seed rows created. Generated by admin actions. | **Live Production Table**: Populated by admin actions. |
| **Media Assets** | SQLite `media_assets` table | SQLite `media_assets` table | Admin API (`/api/admin/media`) | Single source (SQLite table) | Scanned dynamically from `/images` directory. | **Authentic**: Scanned physical images on disk. |
| **Dashboard Stats** | SQLite `members` & `projects` tables | SQLite database queries | Admin API (`/api/admin/dashboard`) | Computed dynamically via `COUNT(*)` & `SUM()` | Displays error banner if backend is down. | **Real Aggregated Metrics**: 100% database backed. |

---

## 3. Identification of Duplicate Data Locations

The audit identified the following primary duplicate data channels:

1. **Member Datasets**:
   - [`frontend/src/data/nexusData.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/data/nexusData.ts) (`TEAM_MEMBERS` array)
   - [`backend/db/seedData.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/seedData.ts) (`SEED_MEMBERS` = `TEAM_MEMBERS`)
   - [`backend/db/seed.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/seed.ts) (Seeds `members` table in SQLite)
   - 5x `members.json` mirrors:
     - `Eid-card/data/members.json`
     - `frontend/src/eid/data/members.json`
     - `frontend/public/members.json`
     - `Eid-card/ui/src/data/members.json`
     - `Eid-card/ui/public/members.json`
   - 2x CSV exports: `members_eid_links.csv` and `Eid-card/data/members_eid_links.csv`
   - Inline fallbacks in [`TeamPage.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/pages/TeamPage.tsx#L67-L154)

2. **Project Datasets**:
   - [`frontend/src/data/nexusData.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/data/nexusData.ts) (`PROJECTS` array)
   - [`backend/db/seedData.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/seedData.ts) (`SEED_PROJECTS` = `PROJECTS`)
   - [`backend/db/seed.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/seed.ts) (Seeds `projects` table in SQLite)

3. **Gallery / Archive Datasets**:
   - [`frontend/src/data/nexusData.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/data/nexusData.ts) (`GALLERY_ITEMS` array)
   - [`backend/db/seedData.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/seedData.ts) (`SEED_ARCHIVE` = `GALLERY_ITEMS`)
   - [`backend/db/seed.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/seed.ts) (Seeds `archive_items` table in SQLite)

---

## 4. Pattern Search Results for Fake / Placeholder / Demo Data

Search across all source files for standard fake data patterns yielded:

| Pattern / Keyword | Locations Found | Assessment |
| :--- | :--- | :--- |
| `Lorem ipsum` | None found in active content | Clean |
| `John Doe` / `Jane Doe` | [`JsonInputModal.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/eid/components/JsonInputModal.tsx#L205) (input placeholder text) | UI placeholder prompt only |
| `Ada Lovelace` / `ada@example.com` | [`EventShowcaseSection.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/components/home/EventShowcaseSection.tsx#L336-L351) | Form input placeholder text |
| `Maya Chen` / `mchen@college.edu` | [`ContactPage.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/pages/ContactPage.tsx#L236-L255) | Form input placeholder text |
| `admin@nexus.campus` | `seedData.ts`, `seed.ts` | Default seed super_admin credentials |
| `editor@nexus.campus` | `seed.ts` | Default seed content_admin credentials |
| `evt-001`, `evt-002`, `evt-003` | `seedData.ts` | Seed event records |
| `ann-001`, `ann-002` | `seedData.ts` | Seed announcement records |

---

## 5. Record Classification

### A. Authentic Records (100% Real)
- **34 Member Profiles**: All 34 student researchers, leads, and coordinators listed in `TEAM_MEMBERS` (e.g., Manish Prakash, Saswat Barai, Om Pandey, Jitesh Raj, Imtiaz Alam, Siba Prasand Panda, Pratham Srivastava, Orosmit Mishra, Anshuman Tiwary).
- **9 Student Projects**: Algolog, Arcanum, NeuroMesh, PulseOS, Loom, ChronoShift, Aether, Voxen, Solstice.
- **9 Gallery Artifacts**: Photo records and studio hardware captures.
- **3 Resources**: Interface tokens primer, Voxen MIDI schematics, Canvas shader starter.

### B. Seed / Demo / Development Records
- **3 Seed Events**: `evt-001`, `evt-002`, `evt-003` in `seedData.ts`.
- **2 Seed Announcements**: `ann-001`, `ann-002` in `seedData.ts`.
- **2 Seed Admin Users**: `admin@nexus.campus`, `editor@nexus.campus` with default initial passwords in `seed.ts`.

### C. Records Requiring Cautious Handling
- **E-ID Generator Pipeline** ([`scripts/build-eid-dataset.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/scripts/build-eid-dataset.ts)): Responsible for deterministic ID assignment (`NX-001` through `NX-038`), URL-safe slug mapping, and validation reporting. Must be preserved to ensure E-ID card links remain stable.
- **Static Fallback Arrays**: Static arrays in `nexusData.ts` serve as resilient fallbacks when backend services are offline.

---

## 6. Impacted Code Locations

- **Frontend Components & Pages**:
  - [`TeamPage.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/pages/TeamPage.tsx)
  - [`LeadershipShowcase.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/components/team/LeadershipShowcase.tsx)
  - [`HeadsShowcase.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/components/team/HeadsShowcase.tsx)
  - [`CrewDirectory.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/components/team/CrewDirectory.tsx)
  - [`ProjectsPage.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/pages/ProjectsPage.tsx)
  - [`LinuxDesktop.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/components/linux/LinuxDesktop.tsx)
  - [`LinuxTerminal.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/components/linux/LinuxTerminal.tsx)
  - [`LinuxFileManager.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/components/linux/LinuxFileManager.tsx)
  - [`GalleryPage.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/pages/GalleryPage.tsx)
  - [`EventShowcaseSection.tsx`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/frontend/src/components/home/EventShowcaseSection.tsx)

- **Backend Routes & Repositories**:
  - `/api/members` ([`members.repository.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/repositories/members.repository.ts))
  - `/api/projects` ([`projects.repository.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/repositories/projects.repository.ts))
  - `/api/events` ([`events.repository.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/repositories/events.repository.ts))
  - `/api/announcements` ([`announcements.repository.ts`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/db/repositories/announcements.repository.ts))
  - `/api/admin/*` ([`backend/domains/admin/`](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/domains/admin))

- **Database Tables**:
  - `members`, `projects`, `project_members`, `events`, `event_registrations`, `announcements`, `archive_items`, `resources`, `site_settings`, `admin_users`, `admin_sessions`, `audit_logs`, `media_assets`, `recruitment_applications`, `submissions`.

---

## 7. Recommended Cleanup Order (For Subsequent Phases)

1. **Phase 2 — Single Source of Truth Enforcement**: Establish SQLite (`data/nexus.db`) as the primary database source of truth for runtime queries while preserving static fallback TS files strictly for offline/degraded mode.
2. **Phase 3 — Inline Fallback Removal**: Remove inline hardcoded duplicate objects inside `TeamPage.tsx` lines 67-154, ensuring `TeamPage.tsx` consumes the single state array cleanly.
3. **Phase 4 — E-ID Mirror Optimization**: Retain `scripts/build-eid-dataset.ts` as the sole build-time script to maintain canonical E-ID JSON mirrors across UI components.
4. **Phase 5 — Seed Content Review**: Review demo events (`evt-001` - `evt-003`) and announcements (`ann-001` - `ann-002`) with studio leads to determine whether to replace them with live upcoming schedule data or manage them strictly via the Admin Portal.
