# NEXUS Electronic Identity (E-ID) System

The **NEXUS E-ID System** is a high-reliability, data-driven digital credential and identification platform designed for the NEXUS collective. It provides permanent, tamper-resistant digital identification cards for students, researchers, engineers, and mentors.

Each member is assigned an authoritative, immutable **Unique ID** (e.g., `NX-026`), accessible via a clean canonical URL structure and represented physically on tactile identity cards through high-contrast QR codes.

---

## System Overview

```
                          ┌───────────────────────────┐
                          │   NEXUS SQLite Database   │
                          │     (Authoritative)       │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │  Express E-ID Backend API │
                          │   /api/eid/members/:id    │
                          └─────────────┬─────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             │                                                     │
             ▼                                                     ▼
┌─────────────────────────┐                             ┌───────────────────────┐
│   Physical Card Print   │                             │ Dynamic E-ID Frontend │
│   - Satin Polycarbonate │                             │ - Tactile UI          │
│   - Permanent QR Code   │                             │ - Lanyard Assembly    │
│   - Laser-cut Slot Hole │                             │ - Web Share API       │
└────────────┬────────────┘                             └───────────┬───────────┘
             │                                                      │
             └──────────────────► Scanned by Smartphone ────────────┘
                                  https://nexusopen.dev/memberID/orosmit-mishra/NX-026
```

---

## Core Tenets

1. **Authoritative Unique ID**:
   Every member has exactly one permanent identifier (`NX-001` through `NX-026`). Once assigned, this identifier never changes—even if a member's name, role, email, or profile changes.
2. **Deterministic Canonical URLs**:
   All public cards resolve via:
   ```
   https://nexusopen.dev/memberID/{member-slug}/{unique-id}
   ```
   The `uniqueId` is authoritative; the human-readable `member-slug` provides semantic readability and SEO clarity while strictly guarding against spoofing.
3. **Pure QR Code Payload**:
   Physical QR codes encode **only** the permanent public URL string. Full JSON datasets or bloated credentials are never burned directly into the physical QR matrix, ensuring cards remain valid in perpetuity.
4. **Preserved Tactile Aesthetics**:
   The frontend retains a dark polycarbonate aesthetic with realistic air dampening, interactive 3D card flips, satin specular sheens, and industrial loading states without generic browser spinners.
5. **Zero Main Application Regression**:
   The main NEXUS website (`nexus-i8-`) remains independent, maintaining full separation of concerns.

---

## Documentation Index

| Document | Description |
|---|---|
| [ARCHITECTURE.md](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/docs/eid/ARCHITECTURE.md) | Architectural topology, component responsibilities, and end-to-end data flows. |
| [DATABASE.md](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/docs/eid/DATABASE.md) | Database schema, `unique_id` indexes, status lifecycles, and constraint enforcement. |
| [MEMBER_DATA.md](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/docs/eid/MEMBER_DATA.md) | `members.json` dataset specifications, validation scripts, and member lifecycle operations. |
| [ROUTING.md](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/docs/eid/ROUTING.md) | URL routing rules, authoritative resolution logic, and slug mismatch defenses. |
| [QR_CODES.md](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/docs/eid/QR_CODES.md) | Machine-readable ISO/IEC 18004 QR generation, payload rules, and permanence models. |
| [DEPLOYMENT.md](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/docs/eid/DEPLOYMENT.md) | Production build steps, environment variables, reverse proxy, and health checks. |
| [TROUBLESHOOTING.md](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/docs/eid/TROUBLESHOOTING.md) | Diagnosing common failure modes (404s, slug mismatches, offline services, image faults). |

---

## Quick Start for Developers

### 1. Start the Backend Server (Port 3001)
```bash
cd nexus-i8-
npm run server:dev
```
- API Base: `http://localhost:3001`
- Health Endpoint: `http://localhost:3001/api/health`
- E-ID Members: `http://localhost:3001/api/eid/members`

### 2. Start the E-ID Frontend Dev Server (Port 3002)
```bash
cd Eid-card/ui
npm run dev
```
- Local URL: `http://localhost:3002/memberID/orosmit-mishra/NX-026`
- Primary Operative: `http://localhost:3002/NX-001`

### 3. Run Automated Validation Suites
```bash
# Backend suite (229 tests, including 66 E-ID tests)
cd nexus-i8-
npm test

# Production build test
cd Eid-card/ui
npm run build
```
