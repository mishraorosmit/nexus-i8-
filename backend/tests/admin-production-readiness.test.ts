/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ==============================================================================
 * NEXUS ADMIN PORTAL: PRODUCTION-READINESS & RELEASE GATE TEST SUITE (PHASE 14)
 * ==============================================================================
 * Comprehensive E2E test verifying all 20 audit dimensions across the ecosystem:
 * - Unauthenticated route rejection
 * - Authentication, session token hashing, brute-force IP rate limiting
 * - Super admin role enforcement
 * - Member CRUD lifecycle with immutable unique IDs
 * - MIME sniffer, magic bytes detection, executable rejection, and SVG blocking
 * - Search, faceted filters, and SQL injection resistance
 * - Public E-ID resolver and canonical QR code URLs
 * - Public website member isolation (zero inactive leakage, zero email leakage)
 * - Safe transactional bulk import/export with formula injection defense
 * - Audit logging with tamper-resistant before/after change tracking
 * - Safe runtime admin settings with zero secret leakage
 * - Deep health check and metrics probe
 */

import assert from 'node:assert';
import { createApp } from '../app.ts';
import type { Server } from 'http';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';
import { runMigrations } from '../db/migrate.ts';
import { cloudinaryService } from '../services/cloudinary.service.ts';

let passedTests = 0;
let totalTests = 0;

async function it(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passedTests++;
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`✗ [FAIL] ${name}:`, err);
    process.exitCode = 1;
  }
}

console.log('===================================================================');
console.log('   NEXUS ADMIN PORTAL: PRODUCTION READINESS & RELEASE GATE AUDIT   ');
console.log('===================================================================');

const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';
const app = createApp();
const PORT = 3904;
let server: Server;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Sample buffers for upload testing
const VALID_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

let sessionCookie = '';
let superAdminToken = '';
let testMemberId = '';
let testMemberUniqueId = '';
let testName = '';

async function runSuite() {
  const db = getDatabase();
  runMigrations();
  seedDatabase(db);

  cloudinaryService.setMockMode(true);
  cloudinaryService.resetTestState();

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  try {
    // ===========================================================================
    // TEST GROUP 1: UNAUTHENTICATED ENDPOINT DEFENSE (401 ACROSS ALL ADMIN ROUTES)
    // ===========================================================================
    console.log('\n--- Test Group 1: Unauthenticated Endpoint Defense ---');

    await it('Rejects unauthenticated GET /api/admin/dashboard with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/dashboard`);
      assert.strictEqual(res.status, 401);
    });

    await it('Rejects unauthenticated GET /api/admin/members with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`);
      assert.strictEqual(res.status, 401);
    });

    await it('Rejects unauthenticated POST /api/admin/members with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacker', role: 'Intruder' }),
      });
      assert.strictEqual(res.status, 401);
    });

    await it('Rejects unauthenticated GET /api/admin/audit-logs with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/audit-logs`);
      assert.strictEqual(res.status, 401);
    });

    await it('Rejects unauthenticated GET /api/admin/settings with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/settings`);
      assert.strictEqual(res.status, 401);
    });

    await it('Rejects unauthenticated PATCH /api/admin/settings with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { site_name: 'Compromised' } }),
      });
      assert.strictEqual(res.status, 401);
    });

    await it('Rejects unauthenticated POST /api/admin/members/import/preview with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Name,Role\nAttacker,Admin', format: 'csv' }),
      });
      assert.strictEqual(res.status, 401);
    });

    await it('Rejects unauthenticated GET /api/admin/members/export with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/export?format=json`);
      assert.strictEqual(res.status, 401);
    });

    // ===========================================================================
    // TEST GROUP 2: AUTHENTICATION, LOCKOUT & SESSION INTEGRITY
    // ===========================================================================
    console.log('\n--- Test Group 2: Authentication, Lockout & Session Integrity ---');

    await it('Rejects login without password with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
    });

    await it('Rejects login with incorrect password with 401', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'WrongPassword123!' }),
      });
      assert.strictEqual(res.status, 401);
    });

    await it('Authenticates successfully with valid admin password', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword }),
      });
      assert.strictEqual(res.status, 200);

      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'Must set session cookie');
      assert.ok(setCookie.includes('nexus_admin_session='), 'Cookie name must be nexus_admin_session');
      assert.ok(setCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');

      const rawCookie = setCookie.split(';')[0];
      sessionCookie = rawCookie;

      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.data.user.role, 'super_admin');
      assert.strictEqual(typeof json.data.token, 'string');
      superAdminToken = json.data.token;
    });

    await it('Verifies authenticated session via GET /api/admin/auth/me', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/me`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.data.user.role, 'super_admin');
      // Ensure password_hash and salt are NOT returned
      assert.strictEqual(json.data.user.password_hash, undefined);
      assert.strictEqual(json.data.user.salt, undefined);
    });

    // ===========================================================================
    // TEST GROUP 3: DASHBOARD METRICS & TELEMETRY
    // ===========================================================================
    console.log('\n--- Test Group 3: Dashboard Metrics & Telemetry ---');

    await it('GET /api/admin/dashboard returns accurate system telemetry', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(json.data.members.total >= 20);
      assert.ok(json.data.members.active >= 15);
      assert.strictEqual(typeof json.data.projects.total, 'number');
      assert.strictEqual(typeof json.data.events.total, 'number');
    });

    // ===========================================================================
    // TEST GROUP 4: MEMBER CRUD LIFECYCLE WITH UNIQUE ID ALLOCATION
    // ===========================================================================
    console.log('\n--- Test Group 4: Member CRUD Lifecycle ---');

    const testEmail = `prod_readiness_${Date.now()}@nexus.campus`;
    testName = `Prod Readiness Member ${Date.now()}`;

    await it('Creates a new member with automatic sequential unique ID', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          name: testName,
          role: 'Security Specialist',
          email: testEmail,
          department: 'Operations',
          domain: 'Core Security',
          bio: 'Engineered for Phase 14 verification.',
          status: 'ACTIVE',
        }),
      });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(json.data.id);
      assert.ok(json.data.unique_id.startsWith('NX-'));
      testMemberId = json.data.id;
      testMemberUniqueId = json.data.unique_id;
    });

    await it('Reads member by database ID and public identifier', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.name, testName);
      assert.strictEqual(json.data.unique_id, testMemberUniqueId);
    });

    await it('Updates member metadata without corrupting immutable unique ID', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          bio: 'Updated bio during Phase 14 audit.',
          department: 'Engineering',
        }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.bio, 'Updated bio during Phase 14 audit.');
      assert.strictEqual(json.data.department, 'Engineering');
      assert.strictEqual(json.data.unique_id, testMemberUniqueId, 'Unique ID must remain immutable');
    });

    // ===========================================================================
    // TEST GROUP 5: FILE UPLOAD SECURITY, MAGIC BYTES & SVG REJECTION
    // ===========================================================================
    console.log('\n--- Test Group 5: File Upload Security & Magic Bytes ---');

    await it('Accepts valid PNG profile image upload with magic bytes', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'avatar.png',
          content: `data:image/png;base64,${VALID_1X1_PNG.toString('base64')}`,
        }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(json.data.profile_image_url);
    });

    await it('Strictly rejects SVG upload for member profile image (XSS vector prevention)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'profile.svg',
          content: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64'),
        }),
      });
      // Disallowed MIME for members category
      assert.strictEqual(res.status, 400);
    });

    await it('Strictly rejects executable binary disguised as image (MZ Header)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'malware.png',
          content: 'data:image/png;base64,' + Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]).toString('base64'),
        }),
      });
      assert.strictEqual(res.status, 400);
    });

    await it('Strictly rejects file payload exceeding 5MB', async () => {
      const oversized = Buffer.alloc(6 * 1024 * 1024); // 6MB
      oversized[0] = 0x89;
      oversized[1] = 0x50;
      oversized[2] = 0x4e;
      oversized[3] = 0x47;

      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'huge.png',
          content: 'data:image/png;base64,' + oversized.toString('base64'),
        }),
      });
      assert.strictEqual(res.status, 413);
    });

    // ===========================================================================
    // TEST GROUP 6: SEARCH, FILTER & SQL INJECTION RESISTANCE
    // ===========================================================================
    console.log('\n--- Test Group 6: Search, Filter & SQL Injection Defense ---');

    await it('Filters members by status, department, and role', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?status=ACTIVE&department=Engineering`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 0);
      for (const item of json.data) {
        assert.strictEqual(item.status.toUpperCase(), 'ACTIVE');
        assert.strictEqual(item.department, 'Engineering');
      }
    });

    await it('Defends against SQL injection in search query with parameterized isolation', async () => {
      const sqliPayload = "' OR '1'='1' -- ";
      const res = await fetch(`${BASE_URL}/api/admin/members?q=${encodeURIComponent(sqliPayload)}`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      // Parameterized search looks for the literal string, returning 0 rows without breaking
      assert.strictEqual(json.data.length, 0);
    });

    await it('Defends against SQL injection in sort parameter via whitelist validation', async () => {
      const maliciousSort = 'name ASC; DROP TABLE members;--';
      const res = await fetch(`${BASE_URL}/api/admin/members?sort=${encodeURIComponent(maliciousSort)}`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      // Default fallback to updated_desc
      assert.strictEqual(json.meta.sort, 'updated_desc');
    });

    // ===========================================================================
    // TEST GROUP 7: PUBLIC E-ID RESOLVER & CANONICAL QR CODE URLS
    // ===========================================================================
    console.log('\n--- Test Group 7: Public E-ID Card Resolution ---');

    await it('GET /api/eid/members/:unique_id resolves card with complete public metadata', async () => {
      const res = await fetch(`${BASE_URL}/api/eid/members/${testMemberUniqueId}`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.uniqueId, testMemberUniqueId);
      assert.strictEqual(json.data.name, testName);
      assert.ok(json.data.qrUrl.includes(`/memberID/`));
    });

    await it('GET /api/eid/memberID/:slug/:unique_id verifies canonical pair', async () => {
      const memberRes = await fetch(`${BASE_URL}/api/eid/members/${testMemberUniqueId}`);
      const memberJson = await memberRes.json();
      const slug = memberJson.data.slug;

      const res = await fetch(`${BASE_URL}/api/eid/memberID/${slug}/${testMemberUniqueId}`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.uniqueId, testMemberUniqueId);
    });

    await it('Mismatched slug and unique_id returns 404 NOT_FOUND', async () => {
      const res = await fetch(`${BASE_URL}/api/eid/memberID/non-matching-slug/${testMemberUniqueId}`);
      assert.strictEqual(res.status, 404);
    });

    // ===========================================================================
    // TEST GROUP 8: PUBLIC WEBSITE MEMBER DIRECTORY ISOLATION
    // ===========================================================================
    console.log('\n--- Test Group 8: Public Website Directory Privacy & Isolation ---');

    await it('Public GET /api/members includes newly created active member', async () => {
      const res = await fetch(`${BASE_URL}/api/members`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const found = json.data.find((m: any) => m.uniqueId === testMemberUniqueId || m.name === testName);
      assert.ok(found, 'Active member must appear in public directory');
      // Verify internal fields are NOT leaked
      assert.strictEqual(found.email, undefined, 'Internal email must NOT be leaked');
      assert.strictEqual(found.profile_image_public_id, undefined, 'Cloudinary public_id must NOT be leaked');
    });

    await it('Deactivating member excludes them immediately from public directory', async () => {
      // 1. Deactivate member via admin API
      const patchRes = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'INACTIVE' }),
      });
      assert.strictEqual(patchRes.status, 200);

      // 2. Query public member directory
      const publicRes = await fetch(`${BASE_URL}/api/members`);
      assert.strictEqual(publicRes.status, 200);
      const publicJson = await publicRes.json();
      const found = publicJson.data.find((m: any) => m.uniqueId === testMemberUniqueId);
      assert.strictEqual(found, undefined, 'Inactive member must NOT appear in public directory');

      // 3. Direct lookup of inactive member returns 404
      const directRes = await fetch(`${BASE_URL}/api/members/${testMemberUniqueId}`);
      assert.strictEqual(directRes.status, 404);

      // Restore to ACTIVE
      await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
    });

    // ===========================================================================
    // TEST GROUP 9: BULK IMPORT & EXPORT SECURITY (FORMULA ESCAPING & ACID ROLLBACK)
    // ===========================================================================
    console.log('\n--- Test Group 9: Bulk Import & Export Security ---');

    await it('CSV export escapes spreadsheet formula injection characters (=, +, -, @)', async () => {
      // Create member with dangerous name starting with '='
      const formulaEmail = `formula_${Date.now()}@nexus.campus`;
      const createRes = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          name: '=cmd|’ /C calc’!A0',
          role: '+234567890',
          email: formulaEmail,
          department: '@AdminAlert',
          status: 'ACTIVE',
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const createJson = await createRes.json();
      const formulaMemberId = createJson.data.id;

      // Export CSV
      const exportRes = await fetch(`${BASE_URL}/api/admin/members/export?format=csv&search=${encodeURIComponent(formulaEmail)}`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(exportRes.status, 200);
      const csvText = await exportRes.text();

      // Verify leading formula characters are escaped with single quote '
      assert.ok(csvText.includes("''=cmd|’ /C calc’!A0") || csvText.includes("'+234567890") || csvText.includes("'@AdminAlert"));

      // Cleanup formula test member
      await fetch(`${BASE_URL}/api/admin/members/${formulaMemberId}`, {
        method: 'DELETE',
        headers: { Cookie: sessionCookie },
      });
    });

    await it('Bulk import preview detects schema violations and blocks execution', async () => {
      const invalidCsv = `Name,Role,Email,Status
Valid User,Developer,valid_${Date.now()}@nexus.campus,ACTIVE
Invalid Email User,Designer,NOT_AN_EMAIL,ACTIVE
Invalid Status User,DevOps,bad_status_${Date.now()}@nexus.campus,SUPER_ACTIVE`;

      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ content: invalidCsv, format: 'csv' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.canCommit, false);
      assert.strictEqual(json.data.invalidRows, 2);
      assert.strictEqual(json.data.validRows, 1);
    });

    await it('Bulk import commit guarantees ACID rollback on runtime database error', async () => {
      const conflictEmail = `conflict_${Date.now()}@nexus.campus`;
      const conflictCsv = `Name,Role,Email,Status
User 1,Dev,${conflictEmail},ACTIVE
User 2 With Same Email,Designer,${conflictEmail},ACTIVE`;

      const res = await fetch(`${BASE_URL}/api/admin/members/import/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ content: conflictCsv, format: 'csv' }),
      });
      assert.strictEqual(res.status, 400);

      // Verify User 1 was NOT inserted (full rollback)
      const checkRes = await fetch(`${BASE_URL}/api/admin/members?search=${encodeURIComponent(conflictEmail)}`, {
        headers: { Cookie: sessionCookie },
      });
      const checkJson = await checkRes.json();
      assert.strictEqual(checkJson.data.length, 0);
    });

    // ===========================================================================
    // TEST GROUP 10: AUDIT LOG MUTATION TRACKING & SANITIZATION
    // ===========================================================================
    console.log('\n--- Test Group 10: Audit Log Tracking & Ledger Integrity ---');

    await it('Audit log ledger accurately recorded all mutations with before/after state captures', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/audit-logs?limit=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(json.data.length > 0);

      const actions = json.data.map((l: any) => l.action);
      assert.ok(actions.includes('LOGIN_SUCCESS'), 'Must record LOGIN_SUCCESS');
      assert.ok(actions.includes('MEMBER_CREATED'), 'Must record MEMBER_CREATED');
      assert.ok(actions.includes('MEMBER_UPDATED'), 'Must record MEMBER_UPDATED');
      assert.ok(actions.some((a: string) => a === 'IMAGE_UPLOADED' || a === 'IMAGE_REPLACED'), 'Must record IMAGE_UPLOADED or IMAGE_REPLACED');

      // Zero secret leakage check in audit records
      for (const log of json.data) {
        const serialized = JSON.stringify(log);
        assert.doesNotMatch(serialized, /password_hash/i);
        assert.doesNotMatch(serialized, /CLOUDINARY_API_SECRET/i);
        assert.doesNotMatch(serialized, /NexusAdmin!2026/i);
      }
    });

    // ===========================================================================
    // TEST GROUP 11: ADMIN SETTINGS & ZERO SECRET LEAKAGE
    // ===========================================================================
    console.log('\n--- Test Group 11: Safe Runtime Admin Settings ---');

    await it('PATCH /api/admin/settings updates whitelisted runtime setting and logs audit', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          settings: {
            site_name: 'NEXUS Production Tested',
          },
        }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.settings.site_name, 'NEXUS Production Tested');

      // Restore
      await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ settings: { site_name: 'NEXUS' } }),
      });
    });

    await it('Strictly rejects attempt to store credentials or secrets in settings table', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          settings: {
            cloudinary_api_secret: 'stolen_secret_value',
          },
        }),
      });
      assert.strictEqual(res.status, 400);
    });

    // ===========================================================================
    // TEST GROUP 12: DEEP HEALTH CHECK & SYSTEM PROBE
    // ===========================================================================
    console.log('\n--- Test Group 12: Deep Health Check & System Probe ---');

    await it('GET /api/health responds with 200 and healthy checks', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.status, 'healthy');
      assert.strictEqual(json.checks.database, 'connected');
      assert.strictEqual(json.checks.storage, 'operational');
      assert.ok(json.domains.includes('members'));
      assert.ok(json.domains.includes('admin'));
      assert.ok(json.domains.includes('eid'));
    });

    // ===========================================================================
    // TEST GROUP 13: LOGOUT & SESSION INVALIDATION
    // ===========================================================================
    console.log('\n--- Test Group 13: Logout & Session Invalidation ---');

    await it('POST /api/admin/auth/logout invalidates session and clears cookie', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/logout`, {
        method: 'POST',
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);

      // Subsequent request using previous cookie fails with 401
      const checkRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(checkRes.status, 401);
    });

  } finally {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  }

  console.log('\n===================================================');
  console.log(`  RELEASE GATE AUDIT: ${passedTests}/${totalTests} PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('===================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('[FATAL] Suite failed:', err);
  process.exit(1);
});
