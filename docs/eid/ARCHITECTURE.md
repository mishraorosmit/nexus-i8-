# NEXUS E-ID: System Architecture

This document describes the high-level architecture, layer separation, data flow, and runtime boundaries of the NEXUS E-ID system.

---

## 1. Architectural Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (BROWSER / MOBILE)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Physical QR Scan (Camera) ──────► URL: /memberID/orosmit-mishra/NX-026      │
│                                                                             │
│  React 19 Single Page App (Eid-card/ui/)                                    │
│  ├── router.tsx (Asynchronous URL Parser & Route Manager)                   │
│  ├── api.ts (Backend HTTP Client & Schema Normalizer)                       │
│  ├── MemberProfilePage.tsx (Tactile Lanyard Assembly & Shell)               │
│  │   ├── HangingCard.tsx (Physics Oscillations & 3D Specular Wrapper)       │
│  │   └── TeamCard.tsx (Polycarbonate Badge, QR Code, Barcode)               │
│  └── JsonInputModal.tsx (Emergency Offline Importer)                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP /api/eid/members/:id
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXPRESS BACKEND (nexus-i8-)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 1: Express Router (/backend/domains/eid/eid.routes.ts)               │
│  Layer 2: Controller & DTO Serializer (/backend/domains/eid/eid.controller) │
│  Layer 3: E-ID Service (/backend/domains/eid/eid.service.ts)                │
│  Layer 4: SQLite Repository (/backend/db/repositories/members.repository.ts)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ SQLite Prepared Queries
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATABASE ENGINE (nexus.db)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Table: `members`                                                           │
│  Unique Index: `idx_members_unique_id` ON members(unique_id)                │
│  Unique Index: `idx_members_public_id` ON members(public_id)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer Separation & Boundaries

### Frontend: `Eid-card/ui/`
- **Zero Hardcoded Data**: Member profiles are loaded on demand via asynchronous API requests.
- **Offline Resilience**: Bundled with a fallback dataset (`src/data/members.json`) ensuring cards can render even in network-constrained environments.
- **Physical Layout Fidelity**: Employs fixed aspect ratios, scaled CSS transforms, and 3D card perspectives so the card displays with pixel accuracy across desktop, tablet, and mobile browsers.

### Backend: `nexus-i8-/backend/domains/eid/`
- **Domain-Driven Isolation**: E-ID features live in their own domain package (`/backend/domains/eid/`) without polluting existing recruitment, submissions, or gallery handlers.
- **Information Boundary Enforcement**: Serializers explicitly curate public attributes, guaranteeing that internal passwords, administrative flags, or sensitive personal data are never exposed.

---

## 3. End-to-End Data Flow

```
1. User enters URL: /memberID/orosmit-mishra/NX-026
       │
2. Router parses URL:
       ├── uniqueId: "NX-026"  (Authoritative)
       └── slug: "orosmit-mishra" (Verification)
       │
3. Format Validation:
       └── /NX-[0-9]{3,}$/i passes "NX-026"
       │
4. Dynamic API Query:
       └── GET /api/eid/members/NX-026
       │
5. Database Lookup:
       └── SELECT * FROM members WHERE unique_id = 'NX-026' LIMIT 1
       │
6. Status & Security Check:
       ├── status === 'ACTIVE'? Yes.
       └── email / password / internal IDs stripped from response payload.
       │
7. Slug Verification:
       └── response.slug === "orosmit-mishra"? Yes.
       │
8. Render:
       └── Populate HangingCard / TeamCard with authentic operative data.
```

---

## 4. Design-Preserved States

### A. Loading State
- Preserves the exact 330px × 524px card container and lanyard strap.
- Renders an industrial wireframe skeleton with technical corner brackets and a pulsing `[NEXUS ID SYSTEM // RETRIEVING OPERATIVE DOSSIER...]` badge.
- Eliminates layout shifts and avoids generic circular spinners.

### B. Error States
- Handled uniformly inside `#nexus-member-not-found`:
  - `INVALID_ID`: Syntax failure (e.g. malformed uniqueId).
  - `NOT_FOUND`: Identifier not registered in collective database.
  - `SLUG_MISMATCH`: Human-readable slug disagrees with authoritative unique ID.
  - `INACTIVE`: Credential revoked or deactivated.
  - `NETWORK_ERROR`: Backend service offline; offers one-click retry.
