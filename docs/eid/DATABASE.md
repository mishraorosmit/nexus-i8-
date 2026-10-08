# NEXUS E-ID: Database Architecture & Schema

This document details the database schema, indexes, lifecycle statuses, and integrity constraints powering the NEXUS E-ID system.

---

## 1. Schema Definition

The E-ID records are stored within the primary `members` table in the SQLite database (`nexus-i8-/data/nexus.db`).

```sql
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,                       -- Internal identifier (e.g., 'team-01')
  public_id TEXT NOT NULL UNIQUE,            -- Canonical route slug (e.g., 'orosmit-mishra')
  unique_id TEXT UNIQUE,                     -- Authoritative permanent E-ID (e.g., 'NX-026')
  name TEXT NOT NULL,                        -- Operative official full name
  display_name TEXT,                         -- Display name alias
  email TEXT,                                -- Private internal email (NEVER exposed publicly)
  role TEXT NOT NULL,                        -- Primary title (e.g., 'FOUNDER & LEAD')
  department TEXT,                           -- Grouping (e.g., 'Engineering', 'Design')
  bio TEXT,                                  -- Professional bio / operative statement
  photo_url TEXT,                            -- Path to webp portrait (e.g., '/images/team/...')
  image_position TEXT DEFAULT 'center 20%',  -- CSS background alignment coordinate
  order_index INTEGER DEFAULT 0,             -- Display sort order
  status TEXT DEFAULT 'ACTIVE',              -- Lifecycle state ('ACTIVE', 'INACTIVE', 'ALUMNI')
  clearance_level TEXT DEFAULT 'LVL-03',     -- Visual badge clearance level tag
  special_word TEXT DEFAULT 'VISIONARY',     -- Single evocative kind special word
  quote TEXT,                                -- Philosophy / mission quote
  node_location TEXT DEFAULT 'SOA LAB 204',  -- Station location identifier
  frequency TEXT DEFAULT '108.40 MHz',       -- Tactical frequency tag
  security_zone TEXT DEFAULT 'SEC // ALPHA', -- Security quadrant
  badge_issue TEXT DEFAULT '2026.Q1',        -- Badge issuance timestamp
  skills TEXT,                               -- JSON array of core competencies
  social_links TEXT,                         -- JSON object of public links
  domain TEXT,                               -- Studio domain specialization
  year_of_study TEXT,                        -- Academic cohort / mentor tag
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 2. Index Integrity

To guarantee sub-millisecond lookups and enforce uniqueness, the following indexes are maintained:

```sql
-- Enforces absolute uniqueness on permanent public unique IDs
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unique_id ON members(unique_id);

-- Enforces absolute uniqueness on human-readable route slugs
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_public_id ON members(public_id);

-- Optimizes directory queries filtered by member lifecycle status
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
```

---

## 3. Unique ID Specification

### Format:
- Pattern: `^NX-[0-9]{3,}$`
- Prefix: `NX-` (NEXUS Identifier)
- Numeric Component: 3-digit zero-padded sequence (e.g., `NX-001`, `NX-026`)

### Guarantees:
1. **Permanence**: Once assigned to an operative, a `unique_id` is never recycled, reassigned, or revoked—even if the member graduates or transitions to alumni status.
2. **Stability**: Changing a member's name, email, or role does not alter their `unique_id`.
3. **QR Invariance**: Physical badges printed with a QR code referencing `NX-026` will resolve to that operative indefinitely.

---

## 4. Lifecycle Statuses

| Status | Public Behavior | API Response | Description |
|---|---|---|---|
| `ACTIVE` | Normal rendering | `200 OK` | Operative is in good standing with active credentials. |
| `INACTIVE` | Refused | `200 OK` (`status: "INACTIVE"`) | Frontend refuses card rendering, displaying `CREDENTIAL REVOKED`. |
| `ALUMNI` | Special badge | `200 OK` (`status: "ALUMNI"`) | Operative has graduated; historic badge remains viewable. |

---

## 5. Security & Isolation

- Internal fields such as `email`, `created_at`, or internal database `id` are excluded from the public DTO.
- The `unique_id` is verified server-side through SQL prepared statements, preventing SQL injection and payload tampering.
