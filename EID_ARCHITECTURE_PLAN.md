# NEXUS E-ID Card Application — Architecture & Integration Plan

**Document Version**: 1.0.0  
**Target Repository**: `c:\Users\Orosmit Mishra\Desktop\webnexus`  
**Scope Boundary**: `Eid-card/` + Backend/Database Integration (Main NEXUS website remains FROZEN).

---

## Executive Summary

The NEXUS repository contains two distinct frontends:
1. **Main Website** (`nexus-i8-`): Student community showcase, portfolio, design labs, and public/admin Express API backend.
2. **E-ID Card Application** (`Eid-card/ui`): A dedicated, suspended 3D physical identity badge viewer built in React 19 + Tailwind CSS + Framer Motion.

Currently, the E-ID card application relies entirely on a hardcoded static JSON file (`members.json`) populated with 24 fictitious individuals and Unsplash placeholder portraits.

**Objective**: Connect the existing, designed E-ID card frontend directly to the centralized SQLite database and backend in `nexus-i8-`, rendering dynamic, verified identity cards for all 26 authentic NEXUS team members without altering the visual design of either application.

---

## 1. Current E-ID Frontend Architecture (`Eid-card/ui/`)

### Technology Stack
- **Core**: React 19.0.1, React DOM 19.0.1, Vite 6.2.3, TypeScript 5.8.2.
- **Styling**: Tailwind CSS 4 (`@tailwindcss/vite` 4.1.14), custom Google Fonts (`Lovelo-Black`, `Dosis`, `Bitter`), tactile exhibition grid pattern.
- **Motion & Interaction**: `motion` (Framer Motion 12.23.24) with low-frequency physical air drift and spring flip transitions.
- **Graphic Utilities**:
  - `html-to-image` (1.11.13): DOM-to-Canvas high-resolution rasterizer (pixelRatio 2.5) for Spotify-style card export.
  - `qrcode` (1.5.4): Dynamic SVG QR code generator with custom dark (`#120D09`) and cream (`#F6D7B3`) themes.

### Component Structure
```text
Eid-card/ui/src/
├── App.tsx                   # Full-viewport container, layout grid, renders MemberProfilePage
├── main.tsx                  # React 19 createRoot entrypoint
├── router.tsx                # Client router, path resolution, popstate listeners
├── index.css                 # Custom font imports, 3D card flipper classes, theme tokens
├── types.ts                  # TeamMember, MemberSocials, CardPositionConfig interfaces
├── components/
│   ├── MemberProfilePage.tsx # Master controller: responsive viewport scaling, keyboard shortcuts, Web Share API
│   ├── HangingCard.tsx       # Suspended physical lanyard assembly with sinusoidal atmospheric drift
│   ├── TeamCard.tsx          # 3D flippable badge (330px x 524px) with front/back layouts
│   ├── QrCode.tsx            # SVG QR code renderer fitted into card back cream aperture
│   └── JsonInputModal.tsx    # Modal for runtime custom JSON injection / drag-and-drop
└── data/
    ├── members.ts            # normalizeMemberJson(), getMemberBySlug(), search helpers
    └── members.json          # 24 fictitious members with Unsplash images (STATIC/HARDCODED)
```

### Visual Card Anatomy
- **Dimensions**: Strictly calibrated at **330px width × 524px height** with rounded corners (`rounded-2xl`).
- **Front Side**:
  - Punched lanyard slot hole at top center.
  - Top-left department indicator (`DESIGN`, `ENGINEERING`, `RESEARCH`).
  - Top-right technical ID badge (`NX-001` through `NX-024`).
  - Centered 122×122px square portrait photo with contrast/brightness filter, industrial crosshairs overlay, clearance badge (`LVL-04 // SPEC`), and shield icon.
  - Member Name (uppercase Lovelo/display font, 20px).
  - Role / Designation (`// MANAGEMENT LEAD`).
  - Discipline & Core Pillar.
  - Station indicator (`STATION // NODE 01 // TOKYO`), industrial barcode lines, and repeat ID.
  - Bottom status rail with `NEXUS ID SYSTEM`, Web Share button, and `TAP TO FLIP` prompt.
- **Back Side**:
  - Specular polycarbonate finish over background art (`nexus-card-back-theme.png`).
  - High-precision QR code box positioned at `top: 33.31%`, `left: 25.25%`, `width: 49.45%`, `height: 33.34%`.
  - Kind Special Word: Single uppercase keyword (`VISIONARY`, `PIONEER`, `ARCHITECT`).
  - Member Quote / Ethos in quotation marks below the QR code.

---

## 2. Current Backend & Database Architecture (`nexus-i8-/backend/`)

### Technology Stack
- **Server Runtime**: Node.js + Express 4.21.2 + TypeScript (`tsx` runner).
- **Database Engine**: SQLite using Node's native `node:sqlite` driver.
- **Data Access Pattern**: Repository pattern with strict transactional integrity via `runTransaction()`.
- **Database File**: `nexus-i8-/data/nexus.db` (561 KB, active SQLite database).

### Current `members` Database Schema
```sql
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,           -- e.g. "team-01", "team-02"
  public_id TEXT UNIQUE NOT NULL,-- e.g. "anshuman-tiwary", "orosmit-mishra"
  name TEXT NOT NULL,            -- e.g. "OROSMIT MISHRA"
  email TEXT UNIQUE,             -- e.g. "orosmit-mishra@nexus.campus"
  role TEXT NOT NULL,            -- e.g. "MANAGEMENT LEAD"
  domain TEXT,                   -- e.g. "Community & Project Strategy"
  bio TEXT,                      -- e.g. "Leads organizational growth, team matching..."
  photo_url TEXT,                -- e.g. "/images/team/orosmit-mishra.webp"
  image_position TEXT,           -- e.g. "center 18%"
  social_links TEXT,             -- JSON string: {"github": "...", "linkedin": "..."}
  status TEXT NOT NULL,          -- "active" | "alumni" | "inactive"
  joined_date TEXT,              -- e.g. "2026-09-01"
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Existing Member Endpoints
- `GET /api/members` — Returns paginated list of active members with metadata.
- `GET /api/members/:id` — Retrieves member by `public_id` (slug) or internal `id`.

---

## 3. Current Team Data Sources

The canonical team data exists in `nexus-i8-/frontend/src/data/nexusData.ts`. It contains **26 authentic members**:

| ID | Public ID (Slug) | Full Name | Official Role | Group | Canonical Photo Path |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `team-01` | `anshuman-tiwary` | ANSHUMAN TIWARY | MANAGEMENT LEAD | MANAGEMENT | `/images/team/anshuman-tiwary-management.webp` |
| `team-02` | `orosmit-mishra` | OROSMIT MISHRA | MANAGEMENT LEAD | MANAGEMENT | `/images/team/orosmit-mishra.webp` |
| `team-03` | `anshita-dash` | ANSHITA DASH | IDEATION & INTERACTION LEAD | IDEATION | `/images/team/anshita-dash-ideation.webp` |
| `team-04` | `ankita-dutta` | ANKITA DUTTA | IDEATION & DESIGN STRATEGIST | IDEATION | `/images/team/ankita-dutta-ideation.webp` |
| `team-05` | `aadyasha-swain` | AADYASHA SWAIN | IDEATION & EXPERIENCE DESIGNER | IDEATION | `/images/team/aadyasha-swain-ideation.webp` |
| `team-06` | `ananya-raj` | ANANYA RAJ | IDEATION & HARDWARE PROTOTYPER | IDEATION | `/images/team/ananya-raj-ideation.webp` |
| `team-07` | `umesh-kumar-sahu` | UMESH KUMAR SAHU | IDEATION & SYSTEMS ARCHITECT | IDEATION | `/images/team/umesh-kumar-sahu-ideation.webp` |
| `team-08` | `suryaprasad-brahma` | SURYAPRASAD BRAHMA | IDEATION & CREATIVE TECHNOLOGIST | IDEATION | `/images/team/suryaprasad-brahma-ideation.webp` |
| `team-content-01` | `tushti-sinha` | TUSHTI SINHA | CONTENT & EDITORIAL LEAD | CONTENT | `/images/team/tushti-sinha-content.webp` |
| `team-content-02` | `smita-jena` | SMITA JENA | CONTENT & CURATION LEAD | CONTENT | `/images/team/smita-jena-content.webp` |
| `team-content-03` | `siddharth-basu` | SIDDHARTH BASU | TECHNICAL WRITING & CASE STUDIES | CONTENT | `/images/team/siddharth-basu-content.webp` |
| `team-content-04` | `saswat-palo` | SASWAT PALO | MEDIA PRODUCTION & CINEMATICS | CONTENT | `/images/team/saswat-palo-content.webp` |
| `team-content-05` | `pratyush-sahoo` | PRATYUSH SAHOO | VISUAL DOCUMENTATION & MOTION | CONTENT | `/images/team/pratyush-sahoo-content.webp` |
| `team-content-06` | `omm-prakash-tripathy`| OMM PRAKASH TRIPATHY | ARCHIVE RESEARCH & CASE STUDIES | CONTENT | `/images/team/omm-prakash-tripathy-content.webp` |
| `team-content-07` | `jagruti-pandey` | JAGRUTI PANDEY | AUDIO-VISUAL LABS & EDITORIAL | CONTENT | `/images/team/jagruti-pandey-content.webp` |
| `team-content-08` | `debojeet` | DEBOJEET | BRANDING & DIGITAL NARRATIVES | CONTENT | `/images/team/debojeet-content.webp` |
| `team-content-09` | `anshuman-meher` | ANSHUMAN MEHER | EDITORIAL CURATION & REVIEW | CONTENT | `/images/team/anshuman-meher-content.webp` |
| `team-content-10` | `ishika` | ISHIKA | CREATIVE WRITING & EXHIBITIONS | CONTENT | `/images/team/ishika.webp` |
| `team-content-11` | `harshit` | HARSHIT | INTERACTION ESSAYS & ARCHIVES | CONTENT | `/images/team/harshit.webp` |
| `team-content-12` | `simrita-barick` | SIMRITA BARICK | COMMUNITY DIALOGUE & OUTREACH | CONTENT | `/images/team/simrita-barick-content.webp` |
| `team-content-13` | `sindhusuta-rath` | SINDHUSUTA RATH | WORKSHOP CURATION & ARCHIVES | CONTENT | `/images/team/sindhusuta-rath-content.webp` |
| `team-content-14` | `swarnim` | SWARNIM | DIGITAL MEDIA & REPOSITORIES | CONTENT | `/images/team/swarnim-content.webp` |
| `team-coord-03` | `jitesh-raj` | JITESH RAJ | HEAD OF OPERATIONS, NEXUS | COORDINATOR & MENTOR | `/images/team/jitesh_bhaiya.webp` |
| `team-coord-01` | `manish-prakash` | MANISH PRAKASH | COORDINATOR | COORDINATOR & MENTOR | `/images/team/manish-prakash-coordinator.webp` |
| `team-coord-02` | `siba-prasand-panda`| SIBA PRASAND PANDA | VICE HEAD OF OPS | COORDINATOR & MENTOR | `/images/team/siba-hoops.webp` |
| `team-mentor-01` | `om-pandey` | OM PANDEY | MENTOR | COORDINATOR & MENTOR | `/images/team/om-pandey.webp` |

---

## 4. Hardcoded E-ID Data to be Removed

1. **Fictitious Records**: Remove all 24 mock profiles in `Eid-card/ui/src/data/members.json` and `Eid-card/ui/public/members.json`.
2. **Unsplash Photos**: Replace external Unsplash links with the centralized local WebP portraits.
3. **Hardcoded Card Total**: Replace `[01/24]` in `MemberProfilePage.tsx` with dynamic `[XX/26]`.
4. **Fictional Geographies**: Replace `NODE 01 // TOKYO`, `NODE 02 // BERLIN` with authentic NEXUS campus locations (`SOA CAMPUS // LAB 204`, `DESIGN PAVILION`, etc.).
5. **Static Client Router Logic**: Eliminate dependency on static bundled JSON in `router.tsx` in favor of backend API fetching with cache-first hydration.

---

## 5. Proposed Member Schema (Additive Migration)

To support the rich visual badge fields while preserving 100% backward compatibility with all existing main website APIs and tests, we will apply migration `002_add_eid_card_fields.sql`:

```sql
-- Migration 002: Add E-ID Card metadata fields to members table
ALTER TABLE members ADD COLUMN card_id TEXT UNIQUE;
ALTER TABLE members ADD COLUMN department TEXT DEFAULT 'ENGINEERING';
ALTER TABLE members ADD COLUMN clearance_level TEXT DEFAULT 'LVL-03 // SPEC';
ALTER TABLE members ADD COLUMN special_word TEXT DEFAULT 'VISIONARY';
ALTER TABLE members ADD COLUMN quote TEXT;
ALTER TABLE members ADD COLUMN node_location TEXT DEFAULT 'SOA CAMPUS // BHUBANESWAR';
ALTER TABLE members ADD COLUMN frequency TEXT DEFAULT '108.40 MHz';
ALTER TABLE members ADD COLUMN security_zone TEXT DEFAULT 'SEC // ALPHA';
ALTER TABLE members ADD COLUMN badge_issue TEXT DEFAULT '2026.Q1';
ALTER TABLE members ADD COLUMN skills TEXT DEFAULT '[]';
ALTER TABLE members ADD COLUMN current_focus TEXT;
ALTER TABLE members ADD COLUMN fun_fact TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_card_id ON members(card_id);
```

### Field Mapping Table

| E-ID Card UI Property | Database Column | Type | Example Value |
| :--- | :--- | :--- | :--- |
| `id` | `card_id` | `TEXT UNIQUE` | `"NX-026"` |
| `slug` | `public_id` | `TEXT UNIQUE` | `"orosmit-mishra"` |
| `name` | `name` | `TEXT` | `"OROSMIT MISHRA"` |
| `designation` | `role` | `TEXT` | `"MANAGEMENT LEAD"` |
| `corePillar` | `domain` | `TEXT` | `"Community & Project Strategy"` |
| `department` | `department` | `TEXT` | `"MANAGEMENT"` → mapped to `"ENGINEERING"`/`"DESIGN"`/`"RESEARCH"` |
| `photo` / `image` | `photo_url` | `TEXT` | `"/images/team/orosmit-mishra.webp"` |
| `bio` / `message` | `bio` | `TEXT` | `"Leads organizational growth, team matching..."` |
| `specialWord` | `special_word` | `TEXT` | `"ORCHESTRATOR"` |
| `quote` | `quote` | `TEXT` | `"When multidisciplinary minds align, execution becomes effortless."` |
| `clearanceLevel` | `clearance_level` | `TEXT` | `"LVL-04 // LEAD"` |
| `nodeLocation` | `node_location` | `TEXT` | `"SOA LAB 204 // BHUBANESWAR"` |
| `frequency` | `frequency` | `TEXT` | `"142.80 MHz"` |
| `securityZone` | `security_zone` | `TEXT` | `"SEC // PRIME"` |
| `badgeIssue` | `badge_issue` | `TEXT` | `"2026.Q1"` |
| `skills` | `skills` | `TEXT` (JSON) | `["Sprint Planning", "Squad Governance", "Community Ops"]` |
| `currentFocus` | `current_focus` | `TEXT` | `"CROSS-DISCIPLINARY COHORTS"` |
| `socials` | `social_links` | `TEXT` (JSON) | `{"github": "https://github.com/...", "linkedin": "..."}` |
| `qrUrl` | Calculated | Virtual | `"/memberID/orosmit-mishra/NX-026"` |

---

## 6. Proposed API Design

We will add a clean, dedicated E-ID domain in `nexus-i8-/backend/domains/eid/`:

### 1. `GET /api/eid/members`
Returns all verified members with card configurations for directory or list hydration:
```json
{
  "success": true,
  "data": [
    {
      "id": "NX-026",
      "slug": "orosmit-mishra",
      "name": "OROSMIT MISHRA",
      "designation": "MANAGEMENT LEAD",
      "department": "ENGINEERING",
      "corePillar": "COMMUNITY & PROJECT STRATEGY",
      "clearanceLevel": "LVL-04 // LEAD",
      "photo": "/images/team/orosmit-mishra.webp",
      "specialWord": "ORCHESTRATOR",
      "quote": "When multidisciplinary minds align, execution becomes effortless.",
      "nodeLocation": "SOA LAB 204 // BHUBANESWAR",
      "frequency": "142.80 MHz",
      "securityZone": "SEC // PRIME",
      "badgeIssue": "2026.Q1",
      "skills": ["Sprint Planning", "Squad Governance", "Community Ops"],
      "socials": { "github": "https://github.com/orosmitmishra" },
      "qrUrl": "/memberID/orosmit-mishra/NX-026"
    }
  ],
  "meta": {
    "total": 26
  }
}
```

### 2. `GET /api/eid/members/:identifier`
Retrieves a single member by **either** their slug (`orosmit-mishra`) or their card ID (`NX-026` / `nx-026`):
```bash
GET /api/eid/members/orosmit-mishra
# OR
GET /api/eid/members/NX-026
```

---

## 7. Proposed URL Structure

Per user specifications, the canonical public URL format will be:
```text
/memberID/{member-slug}/{unique-id}
```

### Live Examples:
- `/memberID/jitesh-raj/NX-001`
- `/memberID/manish-prakash/NX-002`
- `/memberID/siba-prasand-panda/NX-003`
- `/memberID/om-pandey/NX-004`
- `/memberID/anshuman-tiwary/NX-025`
- `/memberID/orosmit-mishra/NX-026`

### Routing Rules in E-ID Frontend (`router.tsx`):
1. `/memberID/:slug/:cardId` — Canonical target route.
2. `/memberID/:slug` — Resolves card ID automatically from API response.
3. `/team/:slug` — Legacy redirect to canonical `/memberID/:slug/:cardId`.
4. `/:slug` — Fallback resolution.
5. `/` — Displays the primary leadership card (`NX-001`) with next/previous navigation controls.

---

## 8. Unique ID Strategy

Card IDs must be strictly unique, short, industrial, and deterministic.

### Format:
`NX-{3-digit sequence}` (e.g. `NX-001` to `NX-026`).

### Assignment Mapping:
- `NX-001`: Jitesh Raj (Head of Operations)
- `NX-002`: Manish Prakash (Coordinator)
- `NX-003`: Siba Prasand Panda (Vice Head of Ops)
- `NX-004`: Om Pandey (Mentor)
- `NX-010` – `NX-017`: Ideation Squad Leads (Anshita, Ankita, Aadyasha, Ananya, Umesh, Suryaprasad)
- `NX-020` – `NX-029`: Management Leads (Anshuman Tiwary `NX-025`, Orosmit Mishra `NX-026`)
- `NX-030` – `NX-045`: Content & Editorial Crew (Tushti, Smita, Siddharth, Saswat, etc.)

---

## 9. Image Strategy

- **Zero Duplication**: The E-ID frontend will consume portraits directly from `nexus-i8-/frontend/images/team/` via the backend image route or public proxy:
  ```text
  /images/team/{filename}.webp
  ```
- **Fallback**: Each portrait includes the CSS grayscale contrast filter already coded in `TeamCard.tsx` (`grayscale contrast-115 brightness-95`), ensuring all photos look visually cohesive with the polycarbonate badge texture.

---

## 10. JSON Seed-Data Strategy

1. **Database Seeder**: Update `nexus-i8-/backend/db/seedData.ts` to include the specific `specialWord`, `quote`, `cardId`, `skills`, and `nodeLocation` for all 26 members.
2. **Dynamic JSON Fallback**: Generate an updated `members.json` in `Eid-card/ui/public/members.json` from the database seeder so that if the backend server is temporarily unavailable, the frontend gracefully falls back to local static JSON without breaking.

---

## 11. Deployment Implications

The two frontends can operate under either configuration:
- **Unified Monorepo Deployment**:
  - Main website hosted at root `https://nexus.community/`
  - E-ID cards hosted under path `https://nexus.community/memberID/...`
  - Single Express backend proxying both.
- **Subdomain Deployment**:
  - Main site: `https://nexus.community/`
  - E-ID portal: `https://id.nexus.community/memberID/...`
  - Shared backend API: `https://api.nexus.community/api/eid/` with standard CORS origin headers.

---

## 12. Verification & Guardrails

When executing this plan:
1. **Absolute Freeze on Main Website**: Zero modifications to `nexus-i8-/frontend/src/` components, styles, or routes.
2. **No E-ID Visual Redesign**: Keep `TeamCard.tsx` and `HangingCard.tsx` visual structure, animations, and dimensions untouched.
3. **Automated Test Suite**: Run all 163 backend tests to guarantee zero regression on core API routes.

---

**Approval Request**: This document outlines the complete audit and safe integration plan. No code or database modifications have been made yet. Review the plan and approve to proceed with implementation.
