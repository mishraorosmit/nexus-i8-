# NEXUS Website — Changelog

All notable changes to the NEXUS website project are documented here.
Changes are grouped by session and ordered from most recent to oldest.

## [Session 4] — 2026-10-05

### Added & Updated Team Members (E-ID Expansion)
- **New Coordinators & Mentors**:
  - **Mohit Kumar**: Added as Coordinator (`NX-033`, slug `mohit-kumar`, image `/images/team/Mohit_Kumar.jpeg`).
  - **Pratham Srivastava**: Added as Coordinator (`NX-036`, slug `pratham-srivastava`, image `/images/team/pratham_srivastava.jpeg`).
  - **Anubhav Jaiswal**: Added as Coordinator (`NX-032`, slug `anubhav-jaiswal`, image `/images/team/Anubhav_Jaiswal.jpeg`).
- **New Ideation Squad Members**:
  - **Saswat Barai**: Added as Ideation & Hardware Prototyper (`NX-034`, canonical slug `satyajit-barik`, image `/images/team/Saswat_Barai.jpeg`).
  - **Ujjwal Prusty**: Added as Ideation & Software Developer (`NX-035`, slug `ujjwal-prusty`, image `/images/team/Ujjwal_Prusty.jpeg`).
- **Updated Leadership & Content Members**:
  - **Imtiaz Alam**: Updated portrait asset (`/images/team/Imtiaz_Alam.jpeg`), assigned permalink `NX-038` with canonical slug `imtiyaz-allam`.
  - **Sidharth Basu**: Updated portrait asset (`/images/team/Sidharth_Basu.jpeg`) and normalized name/slug (`NX-013`).

### System & Routing Enhancements
- **Bidirectional Slug & ID Aliasing**:
  - Implemented slug and unique ID alias resolution in `members.repository.ts`, `frontend/src/eid/data/api.ts`, and `Eid-card/ui/src/data/api.ts`.
  - Seamlessly handles `satyajit-barik` ↔ `saswat-barai`, `imtiyaz-allam` ↔ `imtiaz-allam`, `sidharth-basu` ↔ `siddharth-basu`, and legacy `NX-027` ↔ `NX-038` lookups.
- **E-ID Dataset & Report Sync**:
  - Rebuilt `members.json` across all 5 mirror locations (34 members, 100% validation pass).
  - Updated `members_eid_links.csv` and generated updated `EID_MEMBER_DATA.md` and `member-validation-report.json`.
- **Database Synchronization**:
  - Re-seeded SQLite database `nexus.db` via `npm run db:seed`.

---

## [Session 3] — 2026-09-13 (Previous Session)

### Added
- **Cinematic Theme Transition System** — NEXUS signature LIGHT ↔ DARK curtain animation
  - `src/context/CinematicTransitionContext.tsx` *(new file)*
    - `CinematicTransitionProvider` manages `isTransitioning`, `pendingTheme`, `requestTransition`, `onTransitionComplete`
    - Synchronous ref-based debounce lock prevents overlapping transitions
    - No setTimeout delay on lock release — race condition eliminated
  - `src/components/motion/CinematicThemeTransition.tsx` *(new file)*
    - Two opaque panels (LEFT 50vw + RIGHT 50vw) slide in symmetrically from viewport edges
    - Panels meet at exact mathematical center — no gap, no overlap, no border-radius, no blur
    - NEXUS X logo appears at the seam as a visual seal
    - Three-beat sequence: CLOSE → X SEAL → OPEN
    - Theme state changes only while viewport is fully covered (zero flash guarantee)
    - Generation-counter abort model — superseded animation calls skip cleanup
    - `data-nexus-covering` attribute on `<html>` during covered phase
    - Module-level preload link for X logo — cache-warm before first click
    - `prefers-reduced-motion` fallback: instant opacity crossfade, no panel movement
  - **CSS Transition Suppression Rule** added to `src/index.css`
    - `html[data-nexus-covering] * { transition-property: none !important }`
    - Prevents page CSS color transitions from bleeding through as panels open

### Modified
- **`src/components/layout/ThemeToggle.tsx`**
  - Removed direct `toggleTheme()` / `setTheme()` calls
  - Now calls `requestTransition(targetTheme)` via `useCinematicTransition()`
  - Button has `disabled={isTransitioning}` — prevents double-trigger
- **`src/App.tsx`**
  - Wrapped ThemeProvider children in `CinematicTransitionProvider`
  - `<CinematicThemeTransition />` mounted at root level above all page content

### Timing Refinements (3 iterations)
| Constant       | v1      | v2      | v3 (final) |
|---------------|---------|---------|------------|
| Panel close   | 260 ms  | 420 ms  | 580 ms     |
| Panel open    | 260 ms  | 420 ms  | 580 ms     |
| Easing        | 0.76    | 0.65    | 0.55       |
| X fade-in     | 130 ms  | 160 ms  | 200 ms     |
| X hold        | 90 ms   | 140 ms  | 180 ms     |
| X fade-out    | 90 ms   | 120 ms  | 150 ms     |
| Total         | ~800 ms | ~1280 ms| ~1750 ms   |

### 2. Team & Leadership Updates
- **New Member - Jitesh Raj**:
  - Added to Coordinators & Mentors section as **Head Of Operations, NEXUS**.
  - Synchronized portrait asset (`jitesh_bhaiya.jpeg` / `jitesh_bhaiya.webp`) from `assets/team/`.
  - Updated `TEAM_MEMBERS` dataset, `LeadershipShowcase` 4-column side-by-side grid, and `CrewDirectory`.
  - Re-seeded database members via `npm run db:seed`.
- **New Member - Siba Prasand Panda**:
  - Added to Coordinators & Mentors section as **Vice Head Of Ops**.
  - Synchronized portrait asset (`siba-hoops.png` / `siba-hoops.webp`) from `assets/team/`.
  - Updated `TEAM_MEMBERS` dataset, `LeadershipShowcase` side-by-side grid, and `CrewDirectory`.
  - Re-seeded database members via `npm run db:seed`.

---

### 3. Production Security Hardening & Observability
- **Distributed Request Tracing**:
  - Implemented `requestIdMiddleware` in `server/middleware/requestId.ts`.
  - Assigns unique `X-Request-Id` (`req_<uuid>`) per request, attaches `req.id`, and reflects it back in response headers. Supports client-propagated trace IDs.
- **Structured Production Logging**:
  - Implemented structured JSON logging in `server/middleware/requestLogger.ts` for production environments.
  - Automatically masks client IP addresses (`192.168.*.*`) and redacts sensitive query parameters (`token`, `password`, `secret`, `key`, `apiKey`).
- **Incident Error IDs & Safe Error Responses**:
  - Enhanced `server/middleware/errorHandler.ts` to generate unique incident reference tokens (`err_<timestamp>_<randomHex>`) for internal 500 errors.
  - Sanitizes production error messages (`An internal server error occurred. Please quote error reference ID.`) while logging full stacks and diagnostics server-side with zero secret or stack leakage.
- **Production HTTP Security Headers**:
  - Implemented `server/middleware/securityHeaders.ts` enforcing `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 0`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, and `Strict-Transport-Security` (HSTS).
- **Origin-Restricted CORS**:
  - Updated `server/app.ts` to validate incoming origins against `config.cors.allowedOrigins` and local development ports.
  - Sets `Vary: Origin` and `Access-Control-Max-Age: 86400` on preflight `OPTIONS` requests.
- **Multi-Tier Rate Limiting**:
  - Implemented `authRateLimiter` (20 attempts / 15 min per IP) on `/api/admin/auth/login`.
  - Implemented `apiRateLimiter` (1000 requests / 15 min per IP) on all `/api/*` endpoints.
- **Database ACID Transactions**:
  - Added `runTransaction<T>(fn: (db: DatabaseSync) => T): T` helper in `server/db/connection.ts` for executing multi-step mutations with automatic rollback on error.
  - Enforced `PRAGMA foreign_keys = ON;`, `PRAGMA journal_mode = WAL;`, and `PRAGMA synchronous = NORMAL;`.
- **Deep Health Probe & Diagnostics**:
  - Upgraded `GET /api/health` in `server/routes.ts` to execute a live SQLite connectivity probe (`SELECT 1 as alive;`) and storage provider verification.
  - Reports memory metrics (`heapUsedMb`, `rssMb`) and uptime without leaking database file paths, credentials, or environment secrets. Returns HTTP 200 when healthy, or HTTP 503 if degraded.
- **Environment Validation**:
  - Strict typed configuration validation in `server/config/index.ts` with production sanity checks.
  - Created production-ready `.env.example` template.
- **Automated Hardening Test Suite**:
  - Added `server/tests/hardening.test.ts` (`npm run test:hardening`) with 27 automated security and observability test cases (100% pass).

---

### 4. Public Submission & Event Registration Workflows
- **NEXUS Recruitment Pipeline**:
  - Added structured recruitment applications under `server/domains/recruitment/`.
  - Captures name, email, department, year of study, selected domain (`Software & Systems`, `Hardware & Robotics`, `Design & Creative Media`, `Research & AI`, `General Core`), interests, portfolio/GitHub/LinkedIn URLs, and consent.
  - Implemented 30-day active application duplicate prevention (`409 DUPLICATE_APPLICATION`).
  - Strict state machine validation (`SUBMITTED` -> `UNDER_REVIEW` -> `SHORTLISTED` / `REJECTED` -> `ACCEPTED` / `REJECTED`, or `WITHDRAWN`).
  - Public endpoint: `POST /api/recruitment/apply`.
- **Contact & Collaboration Pipeline**:
  - Enhanced `server/domains/submissions/` to support categories (`collaboration`, `sponsorship`, `workshop`, `project`, `general inquiry`) alongside existing frontend intents (`COLLABORATE WITH US`, `ASK A QUESTION`).
  - Locked down submission retrieval endpoints (`GET /api/submissions`, `GET /api/submissions/:id`) behind admin authentication (`requireAuth`).
  - Public endpoints: `POST /api/submissions` and alias `POST /api/contact`.
- **Event Registration Pipeline**:
  - Implemented attendee event registration under `server/domains/events/eventRegistration.service.ts`.
  - Enforced `UNIQUE(event_id, attendee_email)` duplicate registration guard (`409 DUPLICATE_REGISTRATION`).
  - Enforced closed event check (`400 EVENT_REGISTRATION_CLOSED`).
  - Enforced event capacity limit check against `events.capacity` (`400 EVENT_CAPACITY_REACHED`).
  - Public endpoint: `POST /api/events/:id/register`.
- **Anti-Spam & Submission Rate Limiting**:
  - Sliding-window rate limiter in `server/middleware/rateLimiter.ts` limiting submissions to 5 per 10 minutes per IP (`429 TOO_MANY_REQUESTS`).
  - Honeypot check in `server/middleware/spamProtection.ts` detecting automated bot submissions via hidden fields (`400 SPAM_DETECTED`).
- **Decoupled Notification Hooks**:
  - Implemented `server/services/notificationHook.service.ts` providing asynchronous event dispatching (`recruitment.submitted`, `recruitment.status_changed`, `contact.submitted`, `event.registered`, `event.cancelled`).
  - Features privacy-preserving email masking (`a***a@nexus.edu`) in log outputs.
- **Automated Submissions Test Suite**:
  - Added `server/tests/submissions.test.ts` (`npm run test:submissions`) with 29 automated test cases (100% pass).

---

### 5. Media & Storage Architecture
- **Pluggable Storage Abstraction**:
  - Created `IStorageProvider` interface in `server/storage/storageProvider.interface.ts`.
  - Implemented `LocalStorageProvider` (`server/storage/localStorageProvider.ts`) with strict path boundary validation (`path.resolve()`), automatic category/year directory creation, and ETag generation.
  - Implemented `S3StorageProvider` (`server/storage/s3StorageProvider.ts`) supporting AWS S3, Cloudflare R2, MinIO, or GCP Object Storage with seamless local fallback.
- **Magic-Bytes Sniffing & Security Rejection**:
  - Built `server/utils/mimeSniffer.ts` inspecting true binary signatures (PNG, JPEG, GIF, WebP, PDF, ZIP, SVG).
  - Immediate rejection of executable headers (`MZ`, `ELF`, Mach-O, scripts) disguised with image extensions (`400 EXECUTABLE_REJECTED`).
  - Category MIME and size limits: 10MB for projects, events, members, archive; 25MB for resources.
  - Strict SVG XML sanitization stripping script tags and inline event handlers.
- **Image Processing & Variant Generation**:
  - Integrated `sharp` for extracting width, height, and aspect ratios.
  - Automated generation of WebP thumbnail variants (`-thumb.webp`) for images larger than 400px.
  - SHA-256 cryptographic checksum calculation for file integrity.
- **Serving & Media Management APIs**:
  - Public delivery endpoint `GET /api/media/file/*` with `Cache-Control: public, max-age=31536000, immutable`, ETag conditional requests (`304 Not Modified`), and path traversal blocking (`403 PATH_TRAVERSAL_REJECTED`).
  - Administrative endpoints for upload, metadata updates, in-place binary replacement (preserving asset ID), and orphan detection/cleanup.
- **Automated Media Test Suite**:
  - Added `server/tests/media.test.ts` (`npm run test:media`) with 29 automated test cases (100% pass).

---

### 6. Secure Admin Backend & RBAC
- **Authentication & Sessions**:
  - Node 22 native scrypt password hashing with 16-byte random salts and constant-time verification.
  - Cryptographically secure session tokens (32 bytes / 64 hex characters) stored as SHA-256 hashes with 24-hour expiration.
  - Account lockout after 5 consecutive failed login attempts (15-minute cooldown).
- **Role-Based Access Control (RBAC)**:
  - Strict role enforcement for `super_admin` and `content_admin`.
  - Super admin exclusive endpoints: user management, site settings, audit logs, media hard deletes, and content archival.
- **Content Lifecycle & Concurrency**:
  - Strict status transitions (`Draft` -> `Published` -> `Archived`).
  - Optimistic concurrency control using `expected_updated_at` rejecting stale writes with HTTP 409 `CONCURRENCY_CONFLICT`.
- **Administrative Audit Logging**:
  - Immutable audit logs capturing admin ID, name, role, action, entity type, entity ID, and IP address.
- **Automated Admin Test Suite**:
  - Added `server/tests/admin.test.ts` (`npm run test:admin`) with 46 automated test cases (100% pass).

---

### 7. Public Read APIs & Core Database
- **Database Engine**:
  - Embedded SQLite database via Node 22 native `node:sqlite` (`DatabaseSync`).
  - Migration runner (`server/db/migrate.ts`) applying migrations `001`, `002`, and `003`.
  - Complete demo seeding for members, projects, events, announcements, archive, resources, and site settings.
- **Public Read Endpoints**:
  - Implemented paginated, filtered endpoints for all showcase domains under `server/domains/`.
  - Strict privacy protection preventing leakage of internal credentials or administrative fields on public routes.
- **Automated API Test Suite**:
  - Added `server/tests/api.test.ts` (`npm run test:api`) with 32 automated test cases (100% pass).

---

## Test Suite Summary

All 163 backend tests across all 5 test suites pass with 100% success rate:
- **`npm run test:api`**: 32/32 tests passed
- **`npm run test:admin`**: 46/46 tests passed
- **`npm run test:media`**: 29/29 tests passed
- **`npm run test:submissions`**: 29/29 tests passed
- **`npm run test:hardening`**: 27/27 tests passed
- **Total**: **163 / 163 tests passing (100%)**
- **Typecheck (`npm run lint`)**: 0 errors
- **Frontend Production Build (`npm run build`)**: 0 errors

---

## [Session 2] — 2026-09-13 (Earlier)

### Added
- `src/assets/cn/coding_ninjas_dark_clean.png` *(new asset)* — transparent dark-mode logo
- `src/assets/cn/coding_ninjas_light_clean.png` *(new asset)* — transparent light-mode logo
  - Both generated via Python/PIL to remove opaque backgrounds

### Modified
- **`src/components/layout/Footer.tsx`**
  - Removed duplicate second footer structure — site now has exactly one footer
  - Integrated Coding Ninjas column into existing 5-column grid:
    `[NEXUS] [NAVIGATION] [SOCIALS] [CAMPUS] [CODING NINJAS]`
  - Dynamic theme-aware logo switching via `useTheme()`:
    - Dark mode → `coding_ninjas_dark_clean.png`
    - Light mode → `coding_ninjas_light_clean.png`
  - Fixed missing `import { AppRoute } from '../../types.ts'`
  - Fixed NEXUS branding and Coding Ninjas logo visibility in both themes
  - Alignment pass: Coding Ninjas column respects same margins as other columns

---

## [Session 1] — 2026-09-13 (Earliest)

### Modified
- **`src/components/about/NexusOrbitingSparkle.tsx`**
  - Fixed asymmetrical petal geometry on About page orbital sparkle element
  - Replaced ad-hoc SVG path with mathematically precise symmetric path
  - Enforced 4-fold rotational symmetry — each petal is geometrically identical
  - Enhanced astroid star center for visual crispness
  - No changes to animation timing, orbit behavior, or component API

---

## Conventions

- `*(new file)*` — file did not exist before this change
- `*(new asset)*` — binary asset added to the project
- All changes preserve: page layouts, typography, navigation, routing,
  existing animations, component APIs, and theme persistence via localStorage
