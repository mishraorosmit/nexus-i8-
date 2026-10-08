# NEXUS System Technical Debt & Long-Term Maintenance Catalog

**Phase**: 14 (Final Production Readiness & Release Gate Audit)  
**Status**: Verified & Signed Off (0 Critical, 0 High, 0 Unremediated Blockers)  
**Scope**: NEXUS Admin Portal, Showcase Website, E-ID System, and SQLite Data Layer  

This catalog records all known architectural compromises, legacy bridges, and performance optimizations identified across Phases 11 through 14. Items are strictly prioritized by operational necessity.

---

## Priority Classification

- **MUST FIX**: Security vulnerabilities, race conditions, or unauthenticated mutation risks. Must be resolved immediately (Remediated in Phase 11).
- **SHOULD FIX**: Data-model redundancies or duplicate synchronization logic that increase maintenance burden.
- **OPTIONAL**: Non-critical developer experience improvements, script unifications, or asset cleanups.
- **DEFERRED**: Architectural migrations or deprecations that require cross-repository alignment or external client coordination.

---

## 1. MUST FIX (Remediated in Phase 11)

### DEBT-01: Unauthenticated `PUT /api/site-config` Endpoint
- **Severity**: HIGH
- **Area**: `backend/domains/site-config/siteConfig.routes.ts`
- **Issue**: The public site configuration router exposed an unauthenticated `PUT /` endpoint which allowed any caller to modify global site settings in the SQLite `site_settings` table.
- **Resolution**: Remediated in Phase 11 by adding `requireAdminSession` and `requireSuperAdmin` middleware, aligning it with the authenticated `/api/admin/site-settings` management standard.

### DEBT-01b: E-ID Card Cross-Member Dossier Exposure via Touch Swipe / Arrow Keys
- **Severity**: HIGH
- **Area**: `frontend/src/eid/components/MemberProfilePage.tsx` & `Eid-card/ui/src/components/MemberProfilePage.tsx`
- **Issue**: Horizontal swipe gestures (`handleTouchEnd`) and keyboard arrow handlers (`ArrowLeft` / `ArrowRight`) were configured with `navigate(getMemberRoute(prevMember))` and `navigate(getMemberRoute(nextMember))`, allowing any mobile visitor or key-presser viewing an individual's E-ID to cycle through all other members' confidential identity dossiers.
- **Resolution**: Remediated in Phase 11 by eliminating inter-member navigation from swipe and arrow key handlers. Horizontal swipe and arrow keys now strictly toggle card flipping (`setIsCardFlipped(prev => !prev)`) for the current member's card.

### DEBT-02: Unchecked Legacy Password-less Auth Route (`/api/auth/login`)
- **Severity**: MEDIUM
- **Area**: `backend/domains/auth/`
- **Issue**: A pre-Phase-2 in-memory mock authentication controller accepted email addresses without password validation and returned mock admin user objects.
- **Resolution**: Remediated in Phase 11 by formally deprecating `/api/auth/login` (returns HTTP 410 Gone with canonical pointer to `/api/admin/auth/login`) and deprecating `/api/auth/me`.

---

## 2. SHOULD FIX (Next Major Refactoring Cycle)

### DEBT-03: Dual Redundant Columns in SQLite `members` Table
- **Severity**: LOW
- **Area**: SQLite `members` schema (`data/nexus.db`)
- **Details**:
  - `public_id` vs `slug`: Originally created with `public_id`; `slug` was added in Migration 005. Both columns are indexed and synchronized.
  - `photo_url` vs `profile_image_url`: Both store Cloudinary CDN image URLs.
  - `joined_date` vs `joined_at`: Both store ISO date strings.
- **Impact**: Code in `members.service.ts` and `bulkMembers.service.ts` must maintain dual assignment on every write to avoid breaking legacy queries.
- **Recommended Action**: In a future non-breaking schema migration (e.g. Migration `006_schema_normalization`), create a view or drop the legacy columns (`public_id`, `photo_url`, `joined_date`) once all downstream external services verify exclusive use of `slug`, `profile_image_url`, and `joined_at`.

### DEBT-04: Multiple Mirror Copies of `members.json`
- **Severity**: LOW
- **Area**: Filesystem datasets (`Eid-card/data/`, `frontend/src/eid/data/`, `frontend/public/`, `Eid-card/ui/src/data/`)
- **Details**: Four identical or near-identical copies of `members.json` exist to support static fallback and standalone prototypes.
- **Impact**: Manual edits to one file cause silent drift unless `scripts/build-eid-dataset.ts` is explicitly run.
- **Recommended Action**: Centralize static dataset generation into the `npm run build` step, deriving fallback JSON directly from SQLite via a single automated script.

---

## 3. OPTIONAL (Developer Experience & Polish)

### DEBT-05: Consolidation of Image Map Logic
- **Severity**: INFORMATIONAL
- **Area**: `frontend/src/data/cloudinaryMap.ts`
- **Details**: `cloudinaryMap.ts` contains an extensive dictionary mapping local image paths to Cloudinary public IDs and CDN URLs.
- **Impact**: File is ~34 kB in size. While efficient for client-side synchronous lookups, it represents static mapping metadata.
- **Recommended Action**: Now that SQLite stores canonical `profile_image_url` for all members and media assets, ensure all components consume the URL directly from API responses, gradually reducing reliance on static client-side lookup tables.

### DEBT-06: Unification of Public vs Admin Member Service Layers
- **Severity**: INFORMATIONAL
- **Area**: `backend/domains/members/members.service.ts` vs `backend/services/members.service.ts`
- **Details**: Two separate files name-spaced as member services exist: one for public DTO formatting (`domains/members`), and one for administrative mutations (`services/members.service.ts`).
- **Impact**: Slight naming ambiguity for new contributors.
- **Recommended Action**: Rename `backend/domains/members/members.service.ts` to `publicMembers.service.ts` to make domain separation explicit.

---

## 4. DEFERRED (Long-Term / External)

### DEBT-07: Archival of Standalone Prototype `Eid-card/ui/`
- **Severity**: INFORMATIONAL
- **Area**: `Eid-card/ui/`
- **Details**: Contains a complete standalone Vite + React 18 frontend prototype, including its own `package.json`, `node_modules`, and lockfiles from early development before the E-ID system was embedded directly into `frontend/src/eid/`.
- **Impact**: Consumes local development disk space (~150 MB).
- **Recommended Action**: Move to a dedicated git tag or separate archive branch (`archive/eid-card-standalone-ui`) and remove from the active repository working tree when authorized by the user.

### DEBT-08: CORS Wildcard Restriction for Production Environments
- **Severity**: LOW
- **Area**: `backend/config/index.ts`
- **Details**: When `CORS_ALLOWED_ORIGINS` is not defined in production, it logs a security warning and defaults to wildcard `*`.
- **Recommended Action**: When deploying to production infrastructure (e.g. AWS, Render, Railway), configure `CORS_ALLOWED_ORIGINS=https://nexusopen.dev` in the production environment settings.

---

## 5. REMEDIATED IN PHASE 20 (Cross-Module Systems Integration)

### DEBT-09: Unclamped Query Status Parameters in Public Projects & Events
- **Severity**: MEDIUM
- **Area**: `projects.controller.ts`, `events.controller.ts`
- **Issue**: Public query filters allowed users to pass `?status=draft` or `?status=archived`, potentially querying unpublished content.
- **Resolution**: Remediated in Phase 20 by clamping status queries to exclude draft, archived, or cancelled statuses.

### DEBT-10: Public Cache Invalidation Gaps & Inconsistent Envelope
- **Severity**: MEDIUM
- **Area**: `backend/utils/cache.ts`, `backend/domains/admin/admin.routes.ts`, `backend/domains/eid/eid.controller.ts`
- **Issue**: `publicCache` checked `body.success`, ignoring standard `apiSuccess` responses; admin auto-invalidation missed `/settings`, `/applications/:id/convert`, and `/media/:id/replace`; `eid.controller.ts` used a custom response envelope.
- **Resolution**: Remediated in Phase 20 by broadening cache check to `(body.success || body.error === null)`, expanding admin auto-invalidation triggers, and standardizing E-ID response envelope.

### DEBT-11: Non-Transactional Recruitment Conversion
- **Severity**: MEDIUM
- **Area**: `backend/domains/recruitment/recruitment.service.ts`
- **Issue**: Member creation and recruitment application status updates were performed sequentially without a transaction wrapper.
- **Resolution**: Remediated in Phase 20 by wrapping `convertToMember` operations inside `runTransaction`.

