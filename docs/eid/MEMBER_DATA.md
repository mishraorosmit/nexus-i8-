# NEXUS E-ID: Member Dataset & Management Guide

This guide describes the structure of `members.json`, the automated database import process, and procedures for enrolling or updating member credentials.

---

## 1. Dataset Specification (`Eid-card/data/members.json`)

The `members.json` file represents the normalized seed and snapshot dataset. It contains all 26 authentic members mapped to permanent unique IDs:

```json
[
  {
    "uniqueId": "NX-026",
    "id": "NX-026",
    "sourceId": "team-06",
    "slug": "orosmit-mishra",
    "name": "OROSMIT MISHRA",
    "role": "MANAGEMENT LEAD",
    "group": "MEMBER",
    "domain": "Management, Operations & Studio Coordination",
    "yearOfStudy": "3rd Year",
    "bio": "Directs management workflows, operations, and cross-functional team coordination across NEXUS initiatives.",
    "image": "/images/team/orosmit-mishra.webp",
    "photo": "/images/team/orosmit-mishra.webp",
    "alternateImage": null,
    "imagePosition": "center 20%",
    "status": "ACTIVE",
    "email": null,
    "socials": null,
    "publicLinks": null
  }
]
```

### Required Fields:
- `uniqueId`: Permanent `NX-XXX` identifier.
- `slug`: Human-readable lowercase URL slug.
- `name`: Full operative name.
- `role`: Studio position or primary title.
- `status`: One of `ACTIVE`, `INACTIVE`, `ALUMNI`.
- `photo` / `image`: Relative path to portrait image (e.g. `/images/team/name.webp`).

---

## 2. Automated Import Engine

To synchronize records from `members.json` into the production SQLite database:

```bash
cd nexus-i8-
npm run db:import:eid
```

### Safety Rules Enforced by the Import Engine:
1. **Duplicate Detection**: Aborts if duplicate `uniqueId` or `slug` entries exist within the import file.
2. **Format Enforcement**: Enforces `^NX-[0-9]{3,}$` formatting.
3. **Immutability Shield**: Rejects any attempt to reassign an existing `uniqueId` to a different operative.
4. **Validation Report**: Outputs a complete validation summary to `Eid-card/data/member-validation-report.json`.

---

## 3. Adding a New Member

1. **Allocate the Next Unique ID**:
   Inspect the highest existing identifier (e.g., `NX-026`). The next operative will receive `NX-027`.
2. **Add Portrait Asset**:
   Save a `.webp` portrait (minimum 600×600px, 85% compression quality) into:
   - `nexus-i8-/frontend/public/images/team/`
   - `Eid-card/ui/public/images/team/`
3. **Update Dataset**:
   Append the record to `Eid-card/data/members.json`.
4. **Run Importer**:
   ```bash
   cd nexus-i8-
   npm run db:import:eid
   ```
5. **Verify**:
   Visit `http://localhost:3002/memberID/{slug}/NX-027` to inspect the generated badge.

---

## 4. Deactivating / Revoking a Member

To revoke an operative's credentials:
1. Set `"status": "INACTIVE"` in the database:
   ```sql
   UPDATE members SET status = 'INACTIVE' WHERE unique_id = 'NX-026';
   ```
2. The API will return `status: "INACTIVE"`, and the frontend will immediately refuse to render the card, presenting the secure `CREDENTIAL REVOKED` view.
