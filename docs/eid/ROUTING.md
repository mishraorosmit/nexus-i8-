# NEXUS E-ID: Public Routing & URL Specification

This document defines the routing rules, canonical URL structures, parameter verification semantics, and slug-mismatch defense for the NEXUS E-ID frontend.

---

## 1. Canonical URL Structure

The authoritative permanent public URL format for all NEXUS operative identity cards is:

```
/memberID/{member-slug}/{unique-id}
```

### Example:
```
https://nexusopen.dev/memberID/orosmit-mishra/NX-026
```

### Components:
- `/memberID/`: Route namespace distinguishing digital credentials from marketing pages.
- `{member-slug}`: Human-readable identifier (e.g., `orosmit-mishra`), designed for visual clarity and accessibility.
- `{unique-id}`: **The authoritative, permanent identifier** (e.g., `NX-026`).

---

## 2. Dynamic Router Behavior

The E-ID router ([router.tsx](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/Eid-card/ui/src/router.tsx)) enforces the following processing order:

```
User accesses: /memberID/orosmit-mishra/NX-026
                       │
                       ▼
1. Extract Params: { slug: "orosmit-mishra", uniqueId: "NX-026" }
                       │
                       ▼
2. Syntax Check: Does uniqueId match /^NX-[0-9]{3,}$/i?
   ├── NO  ──► Render ERROR (INVALID_ID)
   └── YES ──► Proceed to Step 3
                       │
                       ▼
3. Backend Query: GET /api/eid/members/NX-026
   ├── 404 ──► Render ERROR (NOT_FOUND)
   ├── 503 ──► Render ERROR (NETWORK_ERROR)
   └── 200 ──► Proceed to Step 4
                       │
                       ▼
4. Status Check: Is status === 'INACTIVE'?
   ├── YES ──► Render ERROR (INACTIVE)
   └── NO  ──► Proceed to Step 5
                       │
                       ▼
5. Slug Verification: Does member.slug === urlSlug?
   ├── NO  ──► Render ERROR (SLUG_MISMATCH) with Canonical Recovery
   └── YES ──► Render SUCCESS (Populate Tactile ID Card)
```

---

## 3. Authoritative Identity vs. Human-Readable Slug

| Dimension | `uniqueId` | `memberSlug` |
|---|---|---|
| **Role** | Authoritative database primary lookup key | Human-readable verification label |
| **Mutability** | Immutable. Permanent once allocated. | Mutable if legal name changes. |
| **Physical Printing** | Encoded in QR matrix | Displayed in printed URL caption |
| **Spoof Defense** | Verified strictly against database records | Rejected if mismatched with `uniqueId` |

---

## 4. Slug Mismatch & Safe Redirect Flow

If an operative's legal name changes from `old-name` to `new-name`, existing physical QR codes containing `NX-026` will encounter the following:

- User visits: `/memberID/old-name/NX-026`
- System verifies `NX-026` in database: found operative with current canonical slug `new-name`.
- System detects mismatch: `old-name !== new-name`.
- Frontend displays the safe `CREDENTIAL MISMATCH` card state with an explicit button:
  ```
  [ NAVIGATE TO OFFICIAL DOSSIER (NX-026) ]
  ```
- Clicking immediately navigates to `/memberID/new-name/NX-026`.
- **Key Guarantee**: The system never blindly trusts the URL slug, preventing impersonation attacks while preserving QR code usability.

---

## 5. Supported Alternate / Fallback Routes

For developer convenience and internal squad links, the following routes are also supported:
- Direct ID: `/NX-026` or `/team/NX-026`
- Query Parameter: `/?id=NX-026`
- Hash Routing: `#/memberID/orosmit-mishra/NX-026`
