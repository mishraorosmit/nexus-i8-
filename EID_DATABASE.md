# NEXUS E-ID Cards — Database Foundation & Identity Architecture

**Document Version**: 1.0.0  
**Status**: Implemented & Verified  
**Target Repository**: `c:\Users\Orosmit Mishra\Desktop\webnexus`  
**Scope Boundary**: Backend Database (`nexus-i8-/backend/db/`), E-ID Seed Data (`Eid-card/data/`), Safe Importer (`nexus-i8-/scripts/`), E-ID API (`/api/eid`).  
**Absolute Constraint**: Main NEXUS website frontend (`nexus-i8-/frontend/src/`) remains **100% UNTOUCHED**.

---

## Executive Summary

The NEXUS identity system now provides a database-backed foundation for the suspended 3D physical **E-ID Card application** (`Eid-card/ui/`).

Every authentic NEXUS team member has been assigned exactly one permanent, stable, deterministic public unique identifier conforming to the `NX-XXX` standard (e.g. `NX-026` for Project Lead Orosmit Mishra, `NX-001` for Head of Operations Jitesh Raj).

Uniqueness is strictly enforced at the SQLite engine level via a unique index. A safe, validation-first import engine (`scripts/import-eid-members.ts`) enables declarative updates from `Eid-card/data/members.json` with conflict rejection, preventing identity hijacking or duplicate issuance.

---

## 1. Database Architecture & Audit

### Reuse of Existing Centralized Database
Rather than spinning up an isolated second database, the existing SQLite production database at `nexus-i8-/data/nexus.db` was safely audited and extended. 

- **Table Reused**: `members`
- **Migration Applied**: `004_eid_member_foundation` in `nexus-i8-/backend/db/migrate.ts`
- **Integrity Guarantee**: Fully additive schema change. No existing records were deleted, no existing columns were dropped, and zero main frontend APIs or admin features were broken.

### Complete Member Data Model (`members` Table)

| Column Name | SQLite Data Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | Internal database surrogate key (e.g. `team-02`) |
| `unique_id` | `TEXT` | `UNIQUE` (`idx_members_unique_id`) | **Permanent public identifier** (e.g. `NX-026`) |
| `public_id` | `TEXT` | `UNIQUE NOT NULL` | SEO-friendly URL slug (e.g. `orosmit-mishra`) |
| `name` | `TEXT` | `NOT NULL` | Full legal / club member name (e.g. `Orosmit Mishra`) |
| `display_name` | `TEXT` | `NULL` | Uppercase display name for card faces (e.g. `OROSMIT MISHRA`) |
| `email` | `TEXT` | `UNIQUE` (`idx_members_email`) | Campus email address (kept private, not leaked) |
| `role` | `TEXT` | `NOT NULL` | Official NEXUS role (e.g. `MANAGEMENT LEAD`) |
| `department` | `TEXT` | `DEFAULT 'ENGINEERING'` | High-level pillar: `Coordination`, `Design`, `Engineering`, `Editorial`, `Research` |
| `domain` | `TEXT` | `NULL` | Disciplines / pillars (e.g. `Community & Project Strategy, AI Systems`) |
| `bio` | `TEXT` | `NULL` | Member narrative or biography |
| `photo_url` | `TEXT` | `NULL` | Local optimized WebP portrait reference |
| `image_position` | `TEXT` | `DEFAULT 'center 20%'` | CSS focal-point alignment |
| `social_links` | `TEXT` | `NULL` (JSON) | Stringified social media links |
| `status` | `TEXT` | `NOT NULL DEFAULT 'active'` | Lifecycle status: `ACTIVE`, `INACTIVE`, `ALUMNI` |
| `clearance_level`| `TEXT` | `DEFAULT 'LVL-03 // SPEC'`| Security badge tier (e.g. `LVL-04 // LEAD`, `LVL-05 // HEAD`) |
| `special_word` | `TEXT` | `DEFAULT 'VISIONARY'` | Tactile badge keyword (e.g. `ORCHESTRATOR`, `ARCHITECT`) |
| `quote` | `TEXT` | `NULL` | Member ethos displayed on card reverse below QR |
| `node_location` | `TEXT` | `DEFAULT 'SOA LAB 204'` | Station / campus laboratory indicator |
| `frequency` | `TEXT` | `DEFAULT '108.40 MHz'` | Industrial broadcast frequency |
| `security_zone` | `TEXT` | `DEFAULT 'SEC // ALPHA'` | Access perimeter designation |
| `badge_issue` | `TEXT` | `DEFAULT '2026.Q1'` | Badge production batch cycle |
| `skills` | `TEXT` | `DEFAULT '[]'` (JSON) | Key competencies displayed in member profile |
| `current_focus` | `TEXT` | `NULL` | Active development area |
| `fun_fact` | `TEXT` | `NULL` | Personality tidbit |
| `joined_date` | `TEXT` | `NULL` | Induction date |
| `created_at` | `TEXT` | `NOT NULL` | ISO 8601 creation timestamp |
| `updated_at` | `TEXT` | `NOT NULL` | ISO 8601 modification timestamp |

### Database Indexes

```sql
-- Enforces guaranteed uniqueness for the public E-ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unique_id ON members(unique_id);

-- Rapid lookup by slug / publicId
CREATE INDEX IF NOT EXISTS idx_members_slug ON members(public_id);

-- Rapid lookup and constraint validation for email
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
```

---

## 2. Permanent Unique Public E-ID Rules & Mapping

### Inviolable Rules
1. **Permanence**: Once assigned to a member, an identifier like `NX-026` is permanent and cannot be reassigned to a different member.
2. **Deterministic Sequence**: Follows the `NX-XXX` format (`NX-001` through `NX-026`).
3. **Engine-Enforced Uniqueness**: Uniqueness is enforced at the database level by `idx_members_unique_id`. Attempting to insert or update a member with an existing ID causes an immediate database constraint error.
4. **No Derived Derivations**: Unique IDs are **never** computed from emails, hashes, names, database UUIDs, or random runtime values.

### The 26 Authentic NEXUS Team Members

| E-ID | Member Slug (`public_id`) | Full Name | Official Role | Department | Special Word | Clearance Level |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `NX-001` | `jitesh-raj` | Jitesh Raj | Head of Operations, NEXUS | Coordination | ORCHESTRATOR | `LVL-05 // HEAD` |
| `NX-002` | `manish-prakash` | Manish Prakash | Coordinator | Coordination | CATALYST | `LVL-04 // SPEC` |
| `NX-003` | `siba-prasand-panda` | Siba Prasand Panda | Vice Head of Ops | Coordination | DISCIPLINE | `LVL-04 // SPEC` |
| `NX-004` | `om-pandey` | Om Pandey | Mentor | Coordination | ARCHITECT | `LVL-05 // MENTOR` |
| `NX-005` | `anshita-dash` | Anshita Dash | Ideation & Interaction Lead | Design | VISIONARY | `LVL-04 // SPEC` |
| `NX-006` | `ankita-dutta` | Ankita Dutta | Ideation & Design Strategist | Design | CREATOR | `LVL-04 // SPEC` |
| `NX-007` | `aadyasha-swain` | Aadyasha Swain | Ideation & Experience Designer | Design | INNOVATOR | `LVL-03 // SPEC` |
| `NX-008` | `ananya-raj` | Ananya Raj | Ideation & Hardware Prototyper | Engineering | PIONEER | `LVL-03 // SPEC` |
| `NX-009` | `umesh-kumar-sahu` | Umesh Kumar Sahu | Ideation & Systems Architect | Engineering | BUILDER | `LVL-04 // SPEC` |
| `NX-010` | `suryaprasad-brahma` | Suryaprasad Brahma | Ideation & Creative Technologist | Engineering | ALCHEMIST | `LVL-03 // SPEC` |
| `NX-011` | `tushti-sinha` | Tushti Sinha | Content & Editorial Lead | Editorial | STRATEGIST | `LVL-04 // SPEC` |
| `NX-012` | `smita-jena` | Smita Jena | Content & Curation Lead | Editorial | CURATOR | `LVL-04 // SPEC` |
| `NX-013` | `siddharth-basu` | Siddharth Basu | Technical Writing & Case Studies | Editorial | SCRIBE | `LVL-03 // SPEC` |
| `NX-014` | `saswat-palo` | Saswat Palo | Media Production & Cinematics | Editorial | CHRONICLER | `LVL-03 // SPEC` |
| `NX-015` | `pratyush-sahoo` | Pratyush Sahoo | Graphic Design & Publication | Design | DESIGNER | `LVL-03 // SPEC` |
| `NX-016` | `omm-prakash-tripathy`| Omm Prakash Tripathy | Research & Documentation | Research | SCHOLAR | `LVL-03 // SPEC` |
| `NX-017` | `jagruti-pandey` | Jagruti Pandey | Community Storytelling | Editorial | VOICE | `LVL-03 // SPEC` |
| `NX-018` | `debojeet` | Debojeet | Audio & Digital Media | Editorial | RESONATOR | `LVL-03 // SPEC` |
| `NX-019` | `anshuman-meher` | Anshuman Meher | Sprint Archive & Assets | Research | PRESERVER | `LVL-03 // SPEC` |
| `NX-020` | `ishika` | Ishika | Editorial Research & Social | Editorial | COMMUNICATOR | `LVL-03 // SPEC` |
| `NX-021` | `harshit` | Harshit | Creative Media & Outreach | Editorial | EXPLORER | `LVL-03 // SPEC` |
| `NX-022` | `simrita-barick` | Simrita Barick | Editorial & Written Media | Editorial | JOURNALIST | `LVL-03 // SPEC` |
| `NX-023` | `sindhusuta-rath` | Sindhusuta Rath | Creative Documentation & Media | Editorial | REFLECTOR | `LVL-03 // SPEC` |
| `NX-024` | `swarnim` | Swarnim | Multimedia Production & Archive | Editorial | PRODUCER | `LVL-03 // SPEC` |
| `NX-025` | `anshuman-tiwary` | Anshuman Tiwary | Management Lead | Engineering | DIRECTOR | `LVL-04 // LEAD` |
| `NX-026` | `orosmit-mishra` | Orosmit Mishra | Management Lead | Engineering | ORCHESTRATOR | `LVL-04 // LEAD` |

---

## 3. Seed Data File (`Eid-card/data/members.json`)

A dedicated JSON file has been created at `Eid-card/data/members.json` with authentic records for all 26 members:

```json
[
  {
    "uniqueId": "NX-026",
    "slug": "orosmit-mishra",
    "name": "Orosmit Mishra",
    "displayName": "OROSMIT MISHRA",
    "email": "orosmit-mishra@nexus.campus",
    "role": "Management Lead",
    "department": "Engineering",
    "domain": [
      "Community & Project Strategy",
      "AI Systems"
    ],
    "image": "/images/team/orosmit-mishra.webp",
    "bio": "Leads organizational growth, team matching sessions, partnerships, and cross-disciplinary sprint execution.",
    "status": "ACTIVE",
    "clearanceLevel": "LVL-04 // LEAD",
    "specialWord": "ORCHESTRATOR",
    "quote": "When multidisciplinary minds align, execution becomes effortless.",
    "nodeLocation": "SOA LAB 204 // BHUBANESWAR",
    "frequency": "142.80 MHz",
    "securityZone": "SEC // PRIME",
    "badgeIssue": "2026.Q1",
    "skills": [
      "Sprint Planning",
      "Squad Governance",
      "Community Ops"
    ],
    "socials": null
  }
]
```

### Data Hygiene Principles
- **No Fabricated Records**: Only verified, existing members are present.
- **Null Safety**: Unknown social media handles or secondary fields are set to `null` rather than mocked.
- **Local WebP Assets**: Image paths resolve to local optimized assets (e.g. `/images/team/orosmit-mishra.webp`) rather than external Unsplash URLs.

---

## 4. Safe Import Engine (`scripts/import-eid-members.ts`)

The import engine is located in `nexus-i8-/scripts/import-eid-members.ts` and registered in `package.json` as:
```bash
npm run db:import:eid
```

### Validation Pipeline
```
[ members.json ]
       │
       ▼
1. Pre-validation Loop
   ├── Check uniqueId format (/^NX-\d{3,}$/)
   ├── Check slug format (/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
   ├── Check name non-empty
   ├── Validate email format if provided
   ├── Detect duplicates WITHIN file (seenUniqueIds, seenSlugs)
   └── Detect collisions AGAINST database:
       ├── Does slug belong to a different existing uniqueId?
       └── Is uniqueId already permanently assigned to another member?
       │
       ├── [Errors Found] ──► ABORT BATCH & REPORT REJECTIONS (Zero DB mutations)
       │
       └── [All Valid]    ──► 2. Run Safe Transactional Upsert
                              ├── Match existing member by slug or unique_id
                              ├── Update all badge metadata fields
                              └── Commit transaction atomically
```

### Execution Example
```text
> npm run db:import:eid

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  NEXUS E-ID MEMBER SEED & SAFE IMPORT ENGINE       
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Source File: C:\Users\Orosmit Mishra\Desktop\webnexus\Eid-card\data\members.json

Import Summary:
- Total Records in File: 26
- Successfully Created:  0
- Successfully Updated:  26
- Skipped / Unchanged:   0
- Rejected / Conflicted: 0

✓ All E-ID member records validated and synchronized successfully.
```

---

## 5. E-ID Backend API Endpoints

The dedicated E-ID endpoints are mounted in `nexus-i8-/backend/routes.ts` under `/api/eid`:

### 1. `GET /api/eid/members`
Returns all verified E-ID cards with complete badge configurations:
```json
{
  "success": true,
  "data": [
    {
      "uniqueId": "NX-026",
      "slug": "orosmit-mishra",
      "name": "Orosmit Mishra",
      "displayName": "OROSMIT MISHRA",
      "role": "Management Lead",
      "department": "Engineering",
      "domain": ["Community & Project Strategy", "AI Systems"],
      "image": "/images/team/orosmit-mishra.webp",
      "bio": "Leads organizational growth, team matching sessions...",
      "status": "ACTIVE",
      "clearanceLevel": "LVL-04 // LEAD",
      "specialWord": "ORCHESTRATOR",
      "quote": "When multidisciplinary minds align, execution becomes effortless.",
      "nodeLocation": "SOA LAB 204 // BHUBANESWAR",
      "frequency": "142.80 MHz",
      "securityZone": "SEC // PRIME",
      "badgeIssue": "2026.Q1",
      "skills": ["Sprint Planning", "Squad Governance", "Community Ops"],
      "socials": null,
      "qrUrl": "/memberID/orosmit-mishra/NX-026",
      "createdAt": "2026-09-13T13:28:00.000Z",
      "updatedAt": "2026-09-13T13:36:58.000Z"
    }
  ],
  "meta": {
    "total": 26
  }
}
```

### 2. `GET /api/eid/members/:identifier`
Retrieves a member card by **either** their unique ID (`NX-026` or `nx-026`) or slug (`orosmit-mishra`):
- `GET /api/eid/members/NX-026` → HTTP 200
- `GET /api/eid/members/orosmit-mishra` → HTTP 200
- Unknown identifier → HTTP 404 with `{ "error": { "code": "NOT_FOUND" } }`

### 3. `GET /api/eid/memberID/:slug/:uniqueId`
Canonical route that verifies the exact `(slug, uniqueId)` pair:
- `GET /api/eid/memberID/orosmit-mishra/NX-026` → HTTP 200
- `GET /api/eid/memberID/orosmit-mishra/NX-001` → HTTP 404 (mismatched pair rejected)

### Public Security Guarantee
Sensitive internal fields (such as internal email addresses, database surrogate IDs, password hashes, and audit tokens) are **never** included in the serialized E-ID response payloads.

---

## 6. Verification & Test Suite

The implementation includes automated tests in `nexus-i8-/backend/tests/eid.test.ts` covering:
1. Database schema and column presence verification.
2. Unique index enforcement and rejection of duplicate IDs.
3. Stability and resolution of `NX-026` and `NX-001`.
4. Verification that all 26 members have distinct, non-repeating `NX-XXX` IDs.
5. Status handling for `ACTIVE`, `INACTIVE`, and `ALUMNI`.
6. Public API endpoints: collection, single lookup, case-insensitivity, and canonical pair resolution.
7. Import engine validation: detection of bad formats, duplicate IDs in JSON, conflicting slugs, and permanent ID hijacking.

### Test Results
```text
> npm test

===================================================
  NEXUS TEST RESULTS SUMMARY
===================================================
- Public Read APIs:        32/32 Passed (100%)
- Admin Auth & RBAC:       46/46 Passed (100%)
- Media Vault & Uploads:   29/29 Passed (100%)
- Submissions & Forms:     29/29 Passed (100%)
- Production Hardening:    27/27 Passed (100%)
- E-ID Database & APIs:    66/66 Passed (100%)
---------------------------------------------------
TOTAL:                    229/229 Passed (100%)
```

- **Type Check (`npm run lint`)**: `tsc --noEmit` passed with 0 errors.
- **Production Bundle (`npm run build`)**: Vite built production assets in 9.86s.
- **Main NEXUS Frontend**: Kept completely untouched with zero regressions.
