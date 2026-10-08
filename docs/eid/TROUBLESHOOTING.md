# NEXUS E-ID: Troubleshooting Guide

This document provides resolutions and diagnostics for common issues encountered when operating the NEXUS E-ID system.

---

## 1. Member Not Found (`HTTP 404`)

### Symptoms:
- Frontend renders `MEMBER NOT FOUND` card with `ShieldCheck` icon.
- Console shows `404 (Not Found)` on `GET /api/eid/members/NX-XXX`.

### Diagnostics:
1. Verify if the `uniqueId` exists in the database:
   ```bash
   cd nexus-i8-
   node -e "
   const db = require('node:sqlite').DatabaseSync('./data/nexus.db');
   const row = db.prepare('SELECT * FROM members WHERE unique_id = ?').get('NX-026');
   console.log(row ? 'Found: ' + row.name : 'Not in DB');
   "
   ```
2. If missing, re-run the seed importer:
   ```bash
   npm run db:import:eid
   ```

---

## 2. Slug Mismatch (`CREDENTIAL MISMATCH`)

### Symptoms:
- Card displays `SECURITY // SLUG MISMATCH DETECTED` and `CREDENTIAL MISMATCH`.
- Example URL: `/memberID/wrong-name/NX-026`.

### Root Cause:
The URL contains a human-readable slug that does not correspond to the canonical slug registered for that unique ID in the database.

### Resolution:
- Click the amber action button: `NAVIGATE TO OFFICIAL DOSSIER (NX-026)`.
- The router will redirect to `/memberID/{canonical-slug}/NX-026`.

---

## 3. Member Photo Not Loading

### Symptoms:
- The card renders the member's details, but the photo displays a broken image or gray fallback box.

### Diagnostics:
1. Check the image URL returned by the API:
   ```json
   "image": "/images/team/orosmit-mishra.webp"
   ```
2. Confirm the physical file exists in `Eid-card/ui/public/images/team/`:
   ```bash
   ls Eid-card/ui/public/images/team/orosmit-mishra.webp
   ```
3. If missing, mirror image assets from `nexus-i8-/frontend/public/images/team/`:
   ```bash
   cp nexus-i8-/frontend/public/images/team/* Eid-card/ui/public/images/team/
   ```

---

## 4. Backend Service Unavailable (`NETWORK_ERROR`)

### Symptoms:
- Card displays `COMMUNICATION LINK // SEVERED` and `SERVICE UNAVAILABLE`.
- Amber button shows `RETRY SECURE CONNECTION`.

### Diagnostics:
1. Check if the backend process is running on port `3001`:
   ```bash
   curl -I http://localhost:3001/api/health
   ```
2. If stopped, start the service:
   ```bash
   cd nexus-i8-
   npm run server:dev
   ```
3. In `Eid-card/ui/vite.config.ts`, verify the proxy rule:
   ```ts
   proxy: {
     '/api': {
       target: 'http://localhost:3001',
       changeOrigin: true,
     }
   }
   ```

---

## 5. QR Code Scanning Failure

### Symptoms:
- Smartphone camera scans the physical badge, but fails to recognize the URL or reports an unreadable code.

### Diagnostics:
1. Ensure the encoded value is a clean URL starting with `https://`:
   - Good: `https://nexusopen.dev/memberID/orosmit-mishra/NX-026`
   - Bad: `{"id":"NX-026","name":"Orosmit"}` (Do not embed JSON!)
2. Verify contrast: Dark modules must have at least 4.5:1 contrast against the warm cream background (`#F6D7B3`).
3. Verify quiet zone: Ensure a 2-module margin around the QR code matrix is maintained.
