# NEXUS — Student Innovation & Identity Platform

NEXUS is a platform built for a student-led collective focused on ideation, hardware/software prototyping, creative media production, and project building. 

The repository hosts two main components:
1. **Main Collective Website (`frontend/`)**: Showcase platform for student projects, team member profiles, research labs, recruitment forms, and an admin management interface.
2. **E-ID Identity System (`Eid-card/ui/`)**: An interactive 3D physical identity badge viewer built to display tamper-resistant digital credentials for all 26 verified NEXUS team members.

---

## 🛠️ How the Website Works

```text
                               ┌───────────────────────────────────┐
                               │       Express API Backend         │
                               │        (Port 3001 / Node)        │
                               └─────────────────┬─────────────────┘
                                                 │
                                                 ▼
                               ┌───────────────────────────────────┐
                               │       SQLite Database Engine      │
                               │        (data/nexus.db)            │
                               └─────────┬───────────────────┬─────┘
                                         │                   │
                     ┌───────────────────┘                   └───────────────────┐
                     ▼                                                           ▼
┌──────────────────────────────────────────┐               ┌──────────────────────────────────────────┐
│          Main NEXUS Frontend             │               │         E-ID 3D Card Application         │
│         (React 19 + Vite + CSS)          │               │     (React 19 + Tailwind + Motion)       │
│  - Project Showcase & Team Roster        │               │  - Interactive 3D Lanyard & Badge Card   │
│  - Member Profiles & Labs                │               │  - ISO/IEC 18004 SVG QR Codes            │
│  - Recruitment & Project Submissions     │               │  - Spotify-Style Canvas Export (.png)    │
│  - Admin Dashboard & Role Management     │               │  - Anti-Spoofing Slug Verification       │
└──────────────────────────────────────────┘               └──────────────────────────────────────────┘
```

### Main Application (`frontend/`)
- Built with **React 19**, **Vite**, **TypeScript**, and **Vanilla CSS** with HSL color tokens.
- Manages client-side routing, interactive project galleries, squad cards, and member detail views.
- Handles public submission forms for recruitment and project ideas, piping entries to the backend API.
- Includes an admin control center protected by session authentication and role-based access controls.

### E-ID Card System (`Eid-card/ui/`)
- Built using **React 19**, **Tailwind CSS v4**, and **Framer Motion** (`motion`).
- Features a physical card hanging from a lanyard with realistic 3D flip controls and subtle air-drift animations.
- Generates dynamic SVG QR codes using `qrcode` that resolve directly to canonical public URLs (`/memberID/:slug/:uniqueId`).
- Exports high-resolution identity card images via `html-to-image` for physical printing or social sharing.

### Express Backend API (`backend/`)
- Modular **Node.js + Express** server running on port 3001.
- Features pluggable media storage: local WebP file serving with Cloudinary integration and SHA-256 asset deduplication.
- Fully tested with **229 automated backend tests** covering read APIs, admin security, file uploads, submission processing, and E-ID lookup logic.

---

## 💾 Database Architecture & Identity System

The database uses SQLite (`data/nexus.db`) managed via Node's native `node:sqlite` driver. Database updates are handled through a clean migration pipeline (`backend/db/migrate.ts`) that runs sequentially without altering existing records.

### Migrations
1. `001_initial_nexus_schema` — Creates core tables (`members`, `projects`, `project_members`, `archive_items`, `events`).
2. `002_admin_and_audit` — Adds `admin_users`, `admin_sessions`, and `audit_logs` for security tracking.
3. `003_submissions_and_registrations` — Sets up `recruitment_applications`, `project_ideas`, and `event_registrations`.
4. `004_eid_member_foundation` — Extends the `members` table with E-ID metadata fields and unique index constraints.

### Member Database Schema (`members` Table)

| Column | Type | Constraints / Details |
|---|---|---|
| `id` | `TEXT` | Primary key (e.g. `team-01`) |
| `unique_id` | `TEXT` | **Permanent Public E-ID** (`NX-001` to `NX-026`). Enforced UNIQUE (`idx_members_unique_id`) |
| `public_id` | `TEXT` | SEO slug (e.g. `orosmit-mishra`). Enforced UNIQUE NOT NULL (`idx_members_slug`) |
| `name` | `TEXT` | Full legal / club name |
| `display_name` | `TEXT` | Uppercase badge display name (e.g. `OROSMIT MISHRA`) |
| `email` | `TEXT` | Campus email address (`idx_members_email`) |
| `role` | `TEXT` | Official designation (e.g. `Management Lead`) |
| `department` | `TEXT` | Pillar (`Engineering`, `Design`, `Coordination`, `Editorial`, `Research`) |
| `domain` | `TEXT` | Focus disciplines (JSON or string array) |
| `bio` | `TEXT` | Narrative overview |
| `photo_url` | `TEXT` | Local WebP portrait path |
| `clearance_level` | `TEXT` | Security tier (e.g. `LVL-04 // LEAD`, `LVL-05 // HEAD`) |
| `special_word` | `TEXT` | Badge keyword (e.g. `ORCHESTRATOR`, `VISIONARY`, `ARCHITECT`) |
| `quote` | `TEXT` | Member ethos printed on badge reverse |
| `node_location` | `TEXT` | Station / lab location indicator |
| `frequency` | `TEXT` | Station radio frequency |
| `security_zone` | `TEXT` | Access perimeter |
| `badge_issue` | `TEXT` | Production batch (e.g. `2026.Q1`) |
| `skills` | `TEXT` | Skills list (JSON array) |

### Safe Import & Seeding Engine (`scripts/import-eid-members.ts`)
Running `npm run db:import:eid` processes `Eid-card/data/members.json` through a strict validation pipeline:
- Validates E-ID formats (`NX-XXX`) and slug naming rules.
- Scans for duplicate IDs or slugs within the seed file.
- Checks database state to prevent overwriting existing member IDs.
- Performs atomic updates inside a single database transaction.

---

## 📚 Codebase Markdown Documentation Index

All architectural specs, API contracts, database migration plans, and audits are documented across `.md` files in the repository. Here is what each file covers:

### E-ID & Identity Credentials (`docs/eid/` & Root)
- [`EID_DATABASE.md`](EID_DATABASE.md) — SQLite schema specs for E-ID badges, unique index constraints, column definitions, and safe import engine breakdown.
- [`EID_ARCHITECTURE_PLAN.md`](EID_ARCHITECTURE_PLAN.md) — System architecture design connecting the suspended 3D card UI to the Express SQLite backend.
- [`EID_MEMBER_DATA.md`](EID_MEMBER_DATA.md) — Canonical mapping of the 26 real team members to permanent `NX-001`..`NX-026` IDs, clearance tiers, and badge attributes.
- [`docs/eid/ROUTING.md`](docs/eid/ROUTING.md) — URL structure (`/memberID/:slug/:uniqueId`), client routing, anti-spoofing logic, and canonical slug matching.
- [`docs/eid/QR_CODES.md`](docs/eid/QR_CODES.md) — ISO/IEC 18004 machine-readable QR specification, SVG rendering, payload constraints, and physical card print specs.
- [`docs/eid/DEPLOYMENT.md`](docs/eid/DEPLOYMENT.md) — Step-by-step production deployment guide, Nginx reverse proxy configurations, environment flags, and health checks.
- [`docs/eid/TROUBLESHOOTING.md`](docs/eid/TROUBLESHOOTING.md) — Diagnostics for common runtime issues: 404 URL mismatches, offline database fallbacks, image focal alignment, and CORS errors.
- [`docs/eid/README.md`](docs/eid/README.md) — High-level technical overview of the E-ID subsystem and physical badge anatomy.

### Cloudinary & Media Vault (`docs/cloudinary/`)
- [`CLOUDINARY_AUDIT.md`](docs/cloudinary/CLOUDINARY_AUDIT.md) — Asset audit covering image formats, cloud migration requirements, and bandwidth optimization.
- [`CLOUDINARY_IMAGE_MAP.md`](docs/cloudinary/CLOUDINARY_IMAGE_MAP.md) — Direct mapping table linking local file paths to Cloudinary CDN URLs.
- [`CLOUDINARY_FINAL_REPORT.md`](docs/cloudinary/CLOUDINARY_FINAL_REPORT.md) — Status report covering remote asset migration, fallbacks, and local storage parity.

### Backend Architecture & API Specifications (`documentation/`)
- [`API_REFERENCE.md`](documentation/API_REFERENCE.md) — REST API endpoints for members, projects, submissions, public search, and health checks.
- [`ADMIN_API_REFERENCE.md`](documentation/ADMIN_API_REFERENCE.md) — Admin endpoints covering session authentication, RBAC authorization, applicant processing, and audit logs.
- [`BACKEND_ARCHITECTURE.md`](documentation/BACKEND_ARCHITECTURE.md) — Node/Express architecture, repository layer design, SQLite connection handling, and middleware setup.
- [`MEDIA_STORAGE.md`](documentation/MEDIA_STORAGE.md) — Local and cloud storage providers, WebP converter setup, and SHA-256 deduplication hashing.

### Codebase Audits & Performance Reports (`documentation/` & `docs/cleanup/`)
- [`CODEBASE_OPTIMIZATION_REPORT.md`](documentation/CODEBASE_OPTIMIZATION_REPORT.md) — Analysis of unused dependencies, bundle footprint optimizations, and code cleanup.
- [`IMAGE_DUPLICATION_REPORT.md`](documentation/IMAGE_DUPLICATION_REPORT.md) — Audit identifying duplicate image binaries and detailing SHA-256 deduplication results.
- [`PERFORMANCE_BASELINE.md`](documentation/PERFORMANCE_BASELINE.md) — Benchmark metrics for Vite compilation times, database query execution, and memory usage.
- [`PERFORMANCE_OPTIMIZATION_REPORT.md`](documentation/PERFORMANCE_OPTIMIZATION_REPORT.md) — Steps taken to optimize build speeds and API latency under load.
- [`FRONTEND_CLEANUP_AUDIT.md`](docs/cleanup/FRONTEND_CLEANUP_AUDIT.md) — Audit of legacy components, styling utilities, and asset cleanup on the frontend.

### Repository Structure & Lifecycle (`PROJECT_STRUCTURE.md` & Root)
- [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md) — Full tree representation of the codebase directories and domain organization.
- [`REPOSITORY_STRUCTURE_PLAN.md`](documentation/REPOSITORY_STRUCTURE_PLAN.md) — Original plan for restructuring project directories and modularizing components.
- [`STRUCTURE_MIGRATION_REPORT.md`](documentation/STRUCTURE_MIGRATION_REPORT.md) — Execution report covering directory reorganization and path migrations.
- [`STRUCTURE_FINAL_REPORT.md`](STRUCTURE_FINAL_REPORT.md) — Verification checklist confirming clean directory state post-migration.
- [`CHANGELOG.md`](CHANGELOG.md) — Full changelog tracking codebase changes, migrations, and release milestones.

---

## ⚡ Quick Start & Development Setup

### 1. Requirements
- **Node.js**: v20 or higher
- **npm**: v10 or higher

### 2. Environment Setup
Copy the environment template:
```bash
cp .env.example .env
```

### 3. Database Initialization
Run SQLite migrations and import member identity records:
```bash
# Run schema migrations
npm run db:migrate

# Seed initial showcase data
npm run db:seed

# Import verified E-ID team member credentials
npm run db:import:eid
```

### 4. Running the Applications
Start the backend API server and frontend development servers:

```bash
# Terminal 1: Express Backend Server (http://localhost:3001)
npm run server:dev

# Terminal 2: Main Frontend Vite Server (http://localhost:3000)
npm run dev
```

If working on the **E-ID 3D Card Application** directly:
```bash
cd Eid-card/ui
npm run dev
```

---

## 🧪 Testing & Code Quality

```bash
# TypeScript compiler check across all modules
npm run lint

# Run the complete backend test suite (229 automated tests)
npm run test

# Verify production build compilation
npm run build
```

---

## 🚀 Deployment Notes

- **Backend**: Deployed as a Node service with `data/nexus.db` stored on persistent volume storage.
- **Frontend**: Built via `npm run build` and served via reverse proxy (Nginx / Vercel).
- **Environment Flags**: Ensure `PORT`, `NODE_ENV`, and any media storage provider keys (e.g. Cloudinary credentials if enabled) are defined in production environment configs.
