# Phase 19: Controlled Admin Workflows & Inbound Submissions Architecture

> **Notice**: This document contains confidential internal system architecture and workflows for NEXUS engineers and administrators. It is retained strictly within local repositories and excluded from remote version control.

---

## 1. Executive Summary & Boundaries

Phase 19 establishes a unified, controlled administrative workflow for the three distinct types of inbound submissions already active across the NEXUS digital presence:
1. **Recruitment / Membership Applications** (`recruitment_submissions`)
2. **Contact Desk Inquiries** (`submissions`)
3. **Event Registrations** (`event_registrations`)

### Critical Guardrails: Not an Uncontrolled CRM
- **Zero Arbitrary Page Builders**: NEXUS core architecture remains code-driven.
- **Zero AI Lead Scoring / Algorithmic Tracking**: Inbound submissions are human-reviewed by NEXUS club officers.
- **Zero Automated Dispatch to WhatsApp/SMS**: All notifications flow through decoupled internal webhook/logging hooks.
- **Verbatim Submission Immutability**: The public applicant's original submission (name, email, statement of purpose, message, links) is permanent and immutable. Internal officer decisions and remarks are stored strictly within dedicated `admin_notes` and review metadata fields.

---

## 2. Privacy-First Data Model

Rather than collapsing disparate data into a generic, bloated submissions bucket, NEXUS maintains three dedicated relational tables in SQLite (`data/nexus.db`):

| Entity | Table | Reference Pattern | Key Fields | Target Workflow |
| :--- | :--- | :--- | :--- | :--- |
| **Membership Applications** | `recruitment_submissions` | `APP-YYYY-NNN` | `reference_id`, `name`, `email`, `selected_domain`, `status`, `admin_notes`, `reviewed_by`, `reviewed_at`, `converted_member_id` | Review $\rightarrow$ Interview $\rightarrow$ Acceptance $\rightarrow$ Member Conversion |
| **Contact Inquiries** | `submissions` | `INQ-YYYY-NNN` | `reference_id`, `name`, `email`, `category`, `message`, `status`, `admin_notes`, `reviewed_by`, `reviewed_at` | Categorization $\rightarrow$ Response $\rightarrow$ Resolution |
| **Event Registrations** | `event_registrations` | `REG-YYYY-NNN` | `reference_id`, `event_id`, `attendee_name`, `attendee_email`, `status`, `admin_notes`, `registration_timestamp` | Capacity Locking $\rightarrow$ Confirmation $\rightarrow$ Roster Export |

### Migration `012_admin_workflows_and_submissions_schema.sql`
- Adds `reference_id TEXT UNIQUE` to all 3 tables with dedicated B-Tree indices (`idx_recruitment_reference_id`, `idx_submissions_reference_id`, `idx_event_reg_reference_id`).
- Adds `admin_notes TEXT`, `reviewed_by TEXT`, `reviewed_at TEXT`, and `converted_member_id TEXT` (linked to `members(id)`).
- Backfills legacy submissions with deterministic, sequential references.

---

## 3. Human-Readable Sequential Reference IDs

Implemented in `backend/utils/referenceId.ts`:
- **Collision-Resistant & Sequential**: Uses atomic database counts per year/type to guarantee zero collisions.
- **Public & Internal Visibility**: Returned upon submission to the user for tracking (`APP-2026-001`, `INQ-2026-001`, `REG-2026-001`).
- **Audit & Email Reconciliation**: Enables instant search across admin listings.

---

## 4. Application-to-Member Conversion Lifecycle

Conversion is an explicit, administrative decision that transitions a candidate into an official NEXUS member:
1. **Candidate Review**: Admin inspects candidate portfolio, GitHub, LinkedIn, statement of purpose, and technical focus.
2. **Review Update**: Status shifts from `PENDING` to `UNDER_REVIEW` with internal review notes.
3. **Conversion Modal**: Admin triggers "Convert to Member", choosing their assigned Role (e.g. `Systems Lead`) and Security Clearance Tier (`CORE`, `LEAD`, `EXECUTIVE`).
4. **Member Creation**: Delegates directly to `membersAdminService.createMember()`, auto-generating the next sequential club ID (`NX-XXX`), generating secure member records, and saving avatar metadata.
5. **State Transition & Audit**:
   - `recruitment_submissions.status` $\rightarrow$ `ACCEPTED`
   - `recruitment_submissions.converted_member_id` $\rightarrow$ `member.id`
   - Emits `APPLICATION_ACCEPTED` and `MEMBER_CREATED` tamper-evident audit records.

---

## 5. Security & CSV Formula Injection Protection

In RFC 4180 CSV exports (`/api/admin/applications/export`, `/api/admin/inquiries/export`):
- Any cell value beginning with `=`, `+`, `-`, or `@` poses a formula injection / DDE vulnerability when opened in spreadsheet software (Excel, LibreOffice).
- NEXUS automatically prepends a single apostrophe (`'`) to neutralize executable expressions while preserving the exact text content.
- CSVs are UTF-8 encoded with BOM (`\uFEFF`) for perfect cross-platform rendering.

---

## 6. Verification & Test Matrix

Phase 19 is covered by the 15-point test suite in `backend/tests/admin-workflows.test.ts`:
1. Admin authentication & session acquisition
2. Public application submission & `APP-YYYY-NNN` generation
3. Duplicate application defense
4. Public contact inquiry submission & `INQ-YYYY-NNN` generation
5. Input validation & spam prevention
6. Public event registration & `REG-YYYY-NNN` generation
7. 401 unauthenticated endpoint defense
8. Application listing, search, and facets
9. Application review & notes mutation
10. Application $\rightarrow$ Member conversion & `NX-XXX` ID allocation
11. Inquiry listing, search, and facets
12. Inquiry review & resolution
13. Global cross-event registration listing
14. Registration cancellation with reasons
15. CSV export with formula injection defense
