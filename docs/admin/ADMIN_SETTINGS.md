# NEXUS Admin Portal: Safe, Database-Backed Admin Settings System (Phase 13)

This document describes the actual, verified implementation of the **Admin Settings System** in Phase 13 of the NEXUS Admin Portal. It serves as the authoritative technical record of the runtime settings registry, schema validation, deterministic fallback defaults, active runtime consumers, protected REST APIs, audit logging, cache invalidation, operations UI, and automated regression testing.

---

## 1. Architectural Philosophy & Strict Guardrails

The NEXUS Admin Settings System adheres to strict operational boundaries:
1. **Zero Secret Storage**: Secrets (master passwords, argon2 hashes, Cloudinary API secrets, session encryption secrets) **never** reside in editable SQLite settings. They remain strictly in environment variables (`.env`).
2. **Only Genuine Runtime Consumers**: Settings are only created if an active runtime subsystem consumes them. No speculative, decorative, or dead-end toggles exist.
3. **Deterministic Fallbacks**: Application stability never depends on the presence or validity of a database row. Every setting resolution follows:
   $$\text{Database Row} \longrightarrow \text{Strict Schema Validation} \longrightarrow \text{Sanitization} \longrightarrow \text{Fallback Default}$$
4. **Untrusted Admin Inputs**: Even authenticated administrator inputs are treated as untrusted: HTML and script tags are stripped, lengths are strictly bounded, and regexes are enforced.

---

## 2. Setting Registry & Consumer Matrix

The authoritative schema registry is declared in `backend/services/settings.service.ts`:

| Key | Label | Type | Default Value | Validation & Boundary Rules | Active Runtime Consumer | Publicly Exposed? |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| `site_name` | Organization Display Name | `string` | `'NEXUS'` | 2–50 chars, printable text, HTML stripped | `GET /api/site-config`, website headers, document titles, E-ID card badges | **Yes** |
| `tagline` | Hero & Community Tagline | `string` | `'Student Innovation & Project Building Community'` | 5–150 chars, printable text, HTML stripped | `GET /api/site-config`, hero and about sections | **Yes** |
| `contact_email` | Official Contact Email | `string` | `'contact@nexus.campus'` | RFC email regex, max 100 chars, normalized lowercase | `GET /api/site-config`, rendered in `ContactPage.tsx` Student Inbox | **Yes** |
| `member_id_prefix` | Member ID Prefix | `string` | `'NX-'` | Regex `^[A-Z]{2,5}-$` (e.g. `NX-`, `NEX-`) | `backend/services/members.service.ts` (`getNextUniqueId`) and `bulkMembers.service.ts` | **No** (Internal) |
| `public_identity_label` | Public Identity Label | `string` | `'NEXUS // E-ID'` | 2–40 chars, uppercase alphanumeric + `/` `-` | `backend/domains/eid/eid.service.ts` card badge classification | **Yes** |
| `eid_base_url` | E-ID Canonical Base URL | `string` | `''` (relative) | Empty string or valid HTTP/HTTPS URL, max 200 chars, no trailing slash | `backend/domains/eid/eid.service.ts` canonical QR code target and card share link | **Yes** |
| `maintenance_mode` | Maintenance Mode | `boolean` | `false` | Strict boolean (`true` or `false`) | `backend/domains/recruitment/recruitment.routes.ts` (returns HTTP 503) & `GET /api/site-config` | **Yes** |
| `socials` | Official Social Media Links | `json` | `{ github: '...', instagram: '...' }` | Valid JSON key-value map with valid URL strings | `GET /api/site-config`, public footer and navigation links | **Yes** |
| `open_sessions` | Studio Schedule & Room | `json` | `{ day: '...', time: '...', location: '...' }` | Valid JSON key-value map with meeting days, hours, and room | `GET /api/site-config`, `ContactPage.tsx` studio hours | **Yes** |

---

## 3. Database Schema (`site_settings`)

Settings are stored in the SQLite table `site_settings`:

```sql
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  value_type TEXT NOT NULL DEFAULT 'string',
  updated_at TEXT NOT NULL
);
```

### Migration `007_admin_settings_schema` (`backend/db/migrate.ts`)
- Automatically ensures the `value_type` column exists.
- Backfills existing settings with appropriate types (`string`, `json`, `boolean`).
- Seeds default rows for `member_id_prefix` (`NX-`), `public_identity_label` (`NEXUS // E-ID`), `eid_base_url` (`""`), and `maintenance_mode` (`"false"`).

---

## 4. Setting Resolution & Mutation Engine (`settings.service.ts`)

### Safe Getter with Fallback Default
```typescript
public getSetting<T = any>(key: string): T {
  const def = SETTING_DEFINITIONS[key];
  if (!def) return undefined as unknown as T;

  const row = siteSettingsRepository.get(key);
  if (!row || row.value === undefined || row.value === null) {
    return def.defaultValue as T;
  }

  try {
    let parsedVal = row.value;
    if (def.type === 'boolean') parsedVal = row.value === 'true' || row.value === '1';
    else if (def.type === 'number') parsedVal = Number(row.value);
    else if (def.type === 'json') parsedVal = JSON.parse(row.value);

    const validation = def.validate(parsedVal);
    return (validation.valid ? validation.sanitized : def.defaultValue) as T;
  } catch {
    return def.defaultValue as T;
  }
}
```

### Atomic Multi-Key Mutation with Full Pre-Validation
When administrators update settings:
1. Every submitted key is checked against the schema registry. Unknown keys immediately trigger HTTP 400 `INVALID_SETTING_KEY`.
2. Every value is validated against its boundary rules. If any validation fails, the entire batch is rejected with HTTP 400 `SETTINGS_VALIDATION_FAILED` (zero partial writes).
3. Previous values and new sanitized values are snapshotted.
4. Changes are committed to SQLite.
5. Caches are immediately purged: `memoryCache.invalidate('site-config')` and `memoryCache.invalidate('eid')`.
6. An immutable audit record `SETTINGS_CHANGED` is emitted.

---

## 5. Active Runtime Consumer Verifications

### 1. Unique ID Generation (`backend/services/members.service.ts`)
When creating a member or generating the next sequential ID:
```typescript
const prefix = settingsService.getSetting<string>('member_id_prefix') || 'NX-';
// Scans existing IDs matching either default 'NX-' or configured prefix
return `${prefix}${String(nextNum).padStart(3, '0')}`;
```
Changing `member_id_prefix` to `NEX-` causes subsequent member creations to automatically receive `NEX-030`, `NEX-031`, etc.

### 2. Maintenance Mode Guard (`backend/domains/recruitment/recruitment.routes.ts`)
Public recruitment submissions (`POST /api/recruitment/apply`) verify the operational mode:
```typescript
if (settingsService.getSetting<boolean>('maintenance_mode')) {
  res.status(503).json({
    data: null,
    meta: null,
    error: {
      code: 'MAINTENANCE_MODE',
      message: 'Recruitment submissions are temporarily paused for scheduled maintenance.',
    },
  });
  return;
}
```

### 3. Public Canonical E-ID Base URL (`backend/domains/eid/eid.service.ts`)
Card QR codes dynamically resolve to absolute domains when configured:
```typescript
const baseUrl = settingsService.getSetting<string>('eid_base_url') || '';
const canonicalRoute = `/memberID/${slug}/${uniqueId}`;
const qrUrl = baseUrl ? `${baseUrl}${canonicalRoute}` : canonicalRoute;
```

### 4. Public Site Configuration (`backend/domains/site-config/siteConfig.service.ts`)
`GET /api/site-config` calls `settingsService.getPublicSettings()`. It publishes safe public variables while strictly omitting internal parameters such as `member_id_prefix`.

---

## 6. Admin API Endpoints

All admin endpoints require valid session authentication (`requireAdminSession`) and super admin permissions (`requireSuperAdmin`).

### 1. `GET /api/admin/settings` (and alias `GET /api/admin/site-settings`)
Returns current settings map alongside schema metadata:
```json
{
  "data": {
    "settings": {
      "site_name": "NEXUS",
      "tagline": "Student Innovation & Project Building Community",
      "contact_email": "contact@nexus.campus",
      "member_id_prefix": "NX-",
      "public_identity_label": "NEXUS // E-ID",
      "eid_base_url": "",
      "maintenance_mode": false,
      "socials": { ... },
      "open_sessions": { ... }
    },
    "schema": [
      {
        "key": "site_name",
        "label": "Organization Display Name",
        "category": "general",
        "description": "...",
        "type": "string",
        "defaultValue": "NEXUS"
      }
    ]
  },
  "error": null
}
```

### 2. `PATCH /api/admin/settings` (and alias `PUT /api/admin/settings`, `PUT /api/admin/site-settings`)
Updates one or more settings:
```json
// Request Payload
{
  "settings": {
    "site_name": "NEXUS Tech Club",
    "maintenance_mode": false
  }
}

// Success Response (HTTP 200)
{
  "data": {
    "updatedKeys": ["site_name", "maintenance_mode"],
    "settings": { ... }
  },
  "meta": {
    "message": "2 setting(s) updated successfully"
  },
  "error": null
}
```

---

## 7. Audit Log Integration

Settings mutations automatically emit an audit record:
- **Action**: `SETTINGS_CHANGED`
- **Entity Type**: `SITE_SETTINGS`
- **Entity ID**: `'global'`
- **Details**: `{ updatedKeys: string[] }`
- **Before Snapshot**: Complete pre-mutation key-value map.
- **After Snapshot**: Complete post-mutation key-value map.
- **Admin Context**: Administrator name, role (`super_admin`), and client IP address.

---

## 8. Frontend Operations Interface (`AdminSettingsPage.tsx`)

Mounted at route `/admin/settings` and enabled via `frontend/src/admin/components/AdminLayout.tsx`:
- **Logical Operations Grouping**:
  1. *Organization & Public Branding* (`site_name`, `tagline`, `contact_email`)
  2. *Member Directory & E-ID Identity* (`member_id_prefix`, `public_identity_label`, `eid_base_url`)
  3. *Platform Availability & Operations* (Maintenance Mode toggle with real-time status pill and submission pause warning)
  4. *Studio Schedule & Community Links* (`open_sessions`, `socials`)
- **Unsaved Changes Tracking**: Displays modified key count, Discard Changes button, and Save Settings action.
- **Field-Level Validation**: Instant feedback on invalid emails, bad prefix formats, and out-of-range strings.
- **Quick Reset Actions**: Per-field "Reset Default" button.

---

## 9. Verification & Automated Test Suite

Dedicated test suite:
```bash
npm run test:admin:settings
```

### Tested & Verified Scenarios (16/16 Passed):
1. `GET /api/admin/settings` returns HTTP 401 when unauthenticated.
2. `PATCH /api/admin/settings` returns HTTP 401 when unauthenticated.
3. Authenticated login establishes valid super admin session.
4. `GET /api/admin/settings` returns complete settings map and schema metadata.
5. Backward compatibility alias `GET /api/admin/site-settings` returns identical data.
6. `PATCH /api/admin/settings` successfully updates valid settings and persists them to SQLite.
7. Rejects unrecognized or unauthorized setting keys (e.g. `admin_password`) with HTTP 400.
8. Rejects invalid `contact_email` format with HTTP 400.
9. Rejects invalid `member_id_prefix` pattern with HTTP 400.
10. Rejects invalid `maintenance_mode` boolean type with HTTP 400.
11. Provides fallback default when database rows are absent or null.
12. Records `SETTINGS_CHANGED` in `audit_logs` with before/after state captures.
13. Consumer 1: `member_id_prefix` changes alter `getNextUniqueId()` generation.
14. Consumer 2: `maintenance_mode` pauses public recruitment submissions with HTTP 503.
15. Consumer 3: Public `GET /api/site-config` reflects updated settings without leaking internal keys.
16. Zero password hashes, session tokens, or API secrets leak across responses.
