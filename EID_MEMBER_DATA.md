# NEXUS E-ID Member Dataset — Extraction, Normalization & Validation Report

**Generated**: 2026-09-15T05:04:30.826Z  
**Dataset Path**: `Eid-card/data/members.json`  
**Machine-Readable Report**: `Eid-card/data/member-validation-report.json`  
**Source of Truth**: `nexus-i8-/frontend/src/data/nexusData.ts` (`TEAM_MEMBERS`)  
**Status**: ✓ ALL 29 MEMBERS VALIDATED (100% PASS)

---

## 1. Executive Summary

This dataset represents a pure, zero-invention data extraction from the authentic NEXUS website codebase (`nexus-i8-`). Every record maps directly to an active student or coordinator listed in the primary website's team data.

- **Total Members Extracted**: `29`
- **Unique Public Identifiers**: `NX-001` through `NX-029` (100% unique, sequential, and permanent)
- **Name Preservation**: 100% authentic names preserved directly from source
- **Zero Fabrication**: No roles, emails, biographies, social handles, or portraits were invented. Fields absent from source data are explicitly `null`.
- **Image Integrity**: All 29 referenced images exist physically on disk and are referenced at their canonical paths (`/images/team/*`).

---

## 2. Source-to-EID Canonical Mapping Table

| Unique ID | Member Name | URL-Safe Slug | Official Role | Group Division | Core Domain / Discipline | Canonical Image Reference |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `NX-001` | **JITESH RAJ** | `jitesh-raj` | HEAD OF OPERATIONS, NEXUS | HEADS | Operations & Studio Leadership | `/images/team/jitesh_bhaiya.webp` |
| `NX-002` | **MANISH PRAKASH** | `manish-prakash` | COORDINATOR | COORDINATOR & MENTOR | Studio Operations & Program Coordination | `/images/team/manish-prakash-coordinator.webp` |
| `NX-003` | **SIBA PRASAND PANDA** | `siba-prasand-panda` | VICE HEAD OF OPS | HEADS | Studio Operations & Program Coordination | `/images/team/siba-hoops.webp` |
| `NX-004` | **OM PANDEY** | `om-pandey` | MENTOR | COORDINATOR & MENTOR | Systems Architecture & Creative Mentorship | `/images/team/om-pandey.webp` |
| `NX-005` | **ANSHITA DASH** | `anshita-dash` | IDEATION & INTERACTION | IDEATION | Computer Science & Human-Centered Design | `/images/team/anshita-dash-ideation.webp` |
| `NX-006` | **ANKITA DUTTA** | `ankita-dutta` | IDEATION & DESIGN STRATEGIST | IDEATION | Visual Communication & Design Systems | `/images/team/ankita-dutta-ideation.webp` |
| `NX-007` | **AADYASHA SWAIN** | `aadyasha-swain` | IDEATION & EXPERIENCE DESIGNER | IDEATION | Human-Computer Interaction | `/images/team/aadyasha-swain-ideation.webp` |
| `NX-008` | **ANANYA RAJ** | `ananya-raj` | IDEATION & HARDWARE PROTOTYPER | IDEATION | Electronics & Systems Engineering | `/images/team/ananya-raj-ideation.webp` |
| `NX-009` | **UMESH KUMAR SAHU** | `umesh-kumar-sahu` | IDEATION & SYSTEMS ARCHITECT | IDEATION | Software Engineering & Cloud Systems | `/images/team/umesh-kumar-sahu-ideation.webp` |
| `NX-010` | **SURYAPRASAD BRAHMA** | `suryaprasad-brahma` | IDEATION & CREATIVE TECHNOLOGIST | IDEATION | Computational Media & Systems | `/images/team/suryaprasad-brahma-ideation.webp` |
| `NX-011` | **TUSHTI SINHA** | `tushti-sinha` | IDEATION | IDEATION | Editorial Strategy & Media Communication | `/images/team/tushti-sinha-content.webp` |
| `NX-012` | **SMITA JENA** | `smita-jena` | CONTENT & CURATION | CONTENT | Visual Media & Creative Writing | `/images/team/smita-jena-content.webp` |
| `NX-013` | **SIDDHARTH BASU** | `siddharth-basu` | TECHNICAL WRITING & CASE STUDIES | CONTENT | Computer Science & Technical Communication | `/images/team/siddharth-basu-content.webp` |
| `NX-014` | **SASWAT PALO** | `saswat-palo` | MEDIA PRODUCTION & CINEMATICS | CONTENT | Film, Digital Media & Visual Storytelling | `/images/team/saswat-palo-content.webp` |
| `NX-015` | **PRATYUSH SAHOO** | `pratyush-sahoo` | GRAPHIC DESIGN & PUBLICATION | CONTENT | Visual Communication & Design | `/images/team/pratyush-sahoo-content.webp` |
| `NX-016` | **OMM PRAKASH TRIPATHY** | `omm-prakash-tripathy` | RESEARCH & DOCUMENTATION | CONTENT | Information Systems & Technical Research | `/images/team/omm-prakash-tripathy-content.webp` |
| `NX-017` | **JAGRUTI PANDEY** | `jagruti-pandey` | COMMUNITY STORYTELLING | CONTENT | Media Studies & Human-Centered Design | `/images/team/jagruti-pandey-content.webp` |
| `NX-018` | **DEBOJEET** | `debojeet` | AUDIO & DIGITAL MEDIA | CONTENT | Sound Engineering & Digital Audio | `/images/team/debojeet-content.webp` |
| `NX-019` | **ANSHUMAN MEHER** | `anshuman-meher` | SPRINT ARCHIVE & ASSETS | CONTENT | Applied Computer Science | `/images/team/anshuman-meher-content.webp` |
| `NX-020` | **ISHIKA** | `ishika` | EDITORIAL RESEARCH & SOCIAL | CONTENT | Communication & Design | `/images/team/ishika.webp` |
| `NX-021` | **HARSHIT** | `harshit` | CREATIVE MEDIA & OUTREACH | CONTENT | Digital Arts & Engineering | `/images/team/harshit.webp` |
| `NX-022` | **SIMRITA BARICK** | `simrita-barick` | EDITORIAL & WRITTEN MEDIA | CONTENT | Media Communication & Technical Writing | `/images/team/simrita-barick-content.webp` |
| `NX-023` | **SINDHUSUTA RATH** | `sindhusuta-rath` | CREATIVE DOCUMENTATION & MEDIA | CONTENT | Visual Media & Creative Writing | `/images/team/sindhusuta-rath-content.webp` |
| `NX-024` | **RASHI SWARNIM** | `rashi-swarnim` | MULTIMEDIA PRODUCTION & ARCHIVE | CONTENT | Digital Media & Visual Arts | `/images/team/swarnim-content.webp` |
| `NX-025` | **ANSHUMAN TIWARY** | `anshuman-tiwary` | MANAGEMENT | MANAGEMENT | Systems & Engineering Operations | `/images/team/anshuman-tiwary-management.webp` |
| `NX-026` | **OROSMIT MISHRA** | `orosmit-mishra` | MANAGEMENT | MANAGEMENT | Community & Project Strategy | `/images/team/orosmit-mishra.webp` |
| `NX-027` | **IMTIAZ ALLAM** | `imtiaz-allam` | HEAD OF TECH | HEADS | Technical Architecture & Systems Engineering | `/images/team/Imtiaz_Allam.jpeg` |
| `NX-028` | **ABHINAB JENA** | `abhinab-jena` | IDEATION & CONCEPT DEVELOPER | IDEATION | Computer Science & Engineering | `/images/team/abhinab_jena.jpg` |
| `NX-029` | **HIMANSHI MOHAPATRA** | `himanshi-mohapatra` | CONTENT & EDITORIAL STRATEGIST | CONTENT | Media Communication & Editorial Strategy | `/images/team/himanshi_mohapatra.jpeg` |

---

## 3. Canonical Image Verification Table

All portraits were inspected in canonical `images/team/`:

| Unique ID | Name | Canonical Image Path | Exists in Canonical Images | File Size |
| :--- | :--- | :--- | :---: | :---: |
| `NX-001` | JITESH RAJ | `/images/team/jitesh_bhaiya.webp` | ✓ | 109.9 KB |
| `NX-002` | MANISH PRAKASH | `/images/team/manish-prakash-coordinator.webp` | ✓ | 17.0 KB |
| `NX-003` | SIBA PRASAND PANDA | `/images/team/siba-hoops.webp` | ✓ | 19.4 KB |
| `NX-004` | OM PANDEY | `/images/team/om-pandey.webp` | ✓ | 20.5 KB |
| `NX-005` | ANSHITA DASH | `/images/team/anshita-dash-ideation.webp` | ✓ | 23.0 KB |
| `NX-006` | ANKITA DUTTA | `/images/team/ankita-dutta-ideation.webp` | ✓ | 59.0 KB |
| `NX-007` | AADYASHA SWAIN | `/images/team/aadyasha-swain-ideation.webp` | ✓ | 128.8 KB |
| `NX-008` | ANANYA RAJ | `/images/team/ananya-raj-ideation.webp` | ✓ | 85.7 KB |
| `NX-009` | UMESH KUMAR SAHU | `/images/team/umesh-kumar-sahu-ideation.webp` | ✓ | 35.6 KB |
| `NX-010` | SURYAPRASAD BRAHMA | `/images/team/suryaprasad-brahma-ideation.webp` | ✓ | 8.6 KB |
| `NX-011` | TUSHTI SINHA | `/images/team/tushti-sinha-content.webp` | ✓ | 59.1 KB |
| `NX-012` | SMITA JENA | `/images/team/smita-jena-content.webp` | ✓ | 77.2 KB |
| `NX-013` | SIDDHARTH BASU | `/images/team/siddharth-basu-content.webp` | ✓ | 35.7 KB |
| `NX-014` | SASWAT PALO | `/images/team/saswat-palo-content.webp` | ✓ | 22.0 KB |
| `NX-015` | PRATYUSH SAHOO | `/images/team/pratyush-sahoo-content.webp` | ✓ | 56.0 KB |
| `NX-016` | OMM PRAKASH TRIPATHY | `/images/team/omm-prakash-tripathy-content.webp` | ✓ | 39.2 KB |
| `NX-017` | JAGRUTI PANDEY | `/images/team/jagruti-pandey-content.webp` | ✓ | 45.9 KB |
| `NX-018` | DEBOJEET | `/images/team/debojeet-content.webp` | ✓ | 80.7 KB |
| `NX-019` | ANSHUMAN MEHER | `/images/team/anshuman-meher-content.webp` | ✓ | 26.1 KB |
| `NX-020` | ISHIKA | `/images/team/ishika.webp` | ✓ | 23.9 KB |
| `NX-021` | HARSHIT | `/images/team/harshit.webp` | ✓ | 78.5 KB |
| `NX-022` | SIMRITA BARICK | `/images/team/simrita-barick-content.webp` | ✓ | 208.6 KB |
| `NX-023` | SINDHUSUTA RATH | `/images/team/sindhusuta-rath-content.webp` | ✓ | 143.3 KB |
| `NX-024` | RASHI SWARNIM | `/images/team/swarnim-content.webp` | ✓ | 42.9 KB |
| `NX-025` | ANSHUMAN TIWARY | `/images/team/anshuman-tiwary-management.webp` | ✓ | 12.2 KB |
| `NX-026` | OROSMIT MISHRA | `/images/team/orosmit-mishra.webp` | ✓ | 33.3 KB |
| `NX-027` | IMTIAZ ALLAM | `/images/team/Imtiaz_Allam.jpeg` | ✓ | 44.8 KB |
| `NX-028` | ABHINAB JENA | `/images/team/abhinab_jena.jpg` | ✓ | 107.9 KB |
| `NX-029` | HIMANSHI MOHAPATRA | `/images/team/himanshi_mohapatra.jpeg` | ✓ | 146.7 KB |

---

## 4. Normalization Rules Applied

1. **Unique ID Assignment**:
   - Sequential, stable, and deterministic allocation (`NX-001` to `NX-029`).
   - Permanent identifier for card QR codes and URL paths (`/memberID/{slug}/{uniqueId}`).
2. **Slug Generation**:
   - Strictly lowercase alphanumeric with hyphens, derived from the actual member name: `name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`.
3. **Role & Domain Preservation**:
   - Preserves exact source strings (e.g. `"MANAGEMENT"`, `"Community & Project Strategy"`).
4. **Data Hygiene & Null Discipline**:
   - Unspecified emails, social handles, or secondary links remain `null`. Zero mocked or invented data.
5. **No Image Duplication**:
   - References canonical portraits without re-encoding, resizing, or creating duplicate copies.

---

## 5. Validation Checklist

- [x] **Unique IDs are Unique**: 29 / 29 unique identifiers (`NX-001` – `NX-029`).
- [x] **Names are Non-Empty**: All 29 records have authentic non-empty names.
- [x] **Slugs are Unique & URL-Safe**: 29 / 29 distinct URL-safe slugs.
- [x] **Image References Exist**: 29 / 29 portraits verified on filesystem.
- [x] **JSON is Valid**: Validated syntax in `Eid-card/data/members.json`.
- [x] **No Duplicate People**: 0 duplicate records.
- [x] **No Shared Images**: Every member has their own dedicated portrait.
- [x] **Zero Content Fabrication**: All fields originate strictly from `nexus-i8-`.
