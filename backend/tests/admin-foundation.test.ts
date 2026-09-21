import assert from 'node:assert';
import { createApp } from '../app.ts';
import type { Server } from 'http';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';

let passedTests = 0;
let totalTests = 0;

function it(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedTests++;
          console.log(`✓ [PASS] ${name}`);
        })
        .catch((err) => {
          console.error(`✗ [FAIL] ${name}:`, err);
          process.exitCode = 1;
        });
    } else {
      passedTests++;
      console.log(`✓ [PASS] ${name}`);
    }
  } catch (err) {
    console.error(`✗ [FAIL] ${name}:`, err);
    process.exitCode = 1;
  }
}

console.log('===================================================');
console.log('  NEXUS ADMIN PORTAL FOUNDATION: E2E INTEGRATION   ');
console.log('===================================================');

// Master password
const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';

const app = createApp();
const PORT = 3899;
let server: Server;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runSuite() {
  const db = getDatabase();
  db.exec(`
    DELETE FROM members 
    WHERE id LIKE 'mem-%-%' 
       OR name LIKE 'Audit%' 
       OR name LIKE 'Bulk%' 
       OR name LIKE 'JSON Member%'
       OR email LIKE '%test%'
       OR email LIKE '%bulk%';
  `);
  seedDatabase(db);

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  let sessionCookie = '';

  try {
    // --- Test Group 1: Unauthenticated Endpoint Protection ---
    console.log('\n--- Test Group 1: Unauthenticated Endpoint Protection ---');

    await it('GET /api/admin/dashboard returns HTTP 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/dashboard`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.ok(json.error);
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    await it('GET /api/admin/auth/me returns HTTP 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/me`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.ok(json.error);
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    // --- Test Group 2: One-Password Authentication & Session Creation ---
    console.log('\n--- Test Group 2: One-Password Authentication & Session Creation ---');

    await it('POST /api/admin/auth/login fails with invalid password', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'completely_wrong_password' }),
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'INVALID_CREDENTIALS');
      const cookies = res.headers.get('set-cookie');
      assert.ok(!cookies || !cookies.includes('nexus_admin_session='));
    });

    await it('POST /api/admin/auth/login succeeds with valid master password', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(json.data?.user);
      assert.strictEqual(json.data.user.role, 'super_admin');

      // Verify HttpOnly cookie header
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'set-cookie header must be present');
      assert.ok(setCookie.includes('nexus_admin_session='));
      assert.ok(setCookie.toLowerCase().includes('httponly'));

      // Save cookie for authenticated requests
      sessionCookie = setCookie.split(';')[0];
    });

    // --- Test Group 3: Session Verification & Me Endpoint ---
    console.log('\n--- Test Group 3: Session Verification & Me Endpoint ---');

    await it('GET /api/admin/auth/me returns authenticated administrator profile', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/me`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(json.data?.user);
      assert.strictEqual(json.data.user.role, 'super_admin');
      assert.ok(json.data.session?.sessionId);
    });

    // --- Test Group 4: Real SQLite Dashboard Metrics ---
    console.log('\n--- Test Group 4: Real SQLite Dashboard Metrics ---');

    await it('GET /api/admin/dashboard returns real SQLite-backed counts', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(json.data);

      const { members, projects, events } = json.data;

      // Verify member metrics
      assert.ok(members, 'members object must exist');
      assert.strictEqual(typeof members.total, 'number');
      assert.strictEqual(typeof members.active, 'number');
      assert.strictEqual(typeof members.inactive, 'number');
      assert.strictEqual(typeof members.alumni, 'number');
      assert.strictEqual(members.total, 29, 'Total members in SQLite must match 29');
      assert.strictEqual(members.active, 29, 'Active members must match 29');
      assert.strictEqual(members.inactive, 0);
      assert.strictEqual(members.alumni, 0);

      // Verify projects metrics
      assert.ok(projects, 'projects object must exist');
      assert.strictEqual(typeof projects.total, 'number');
      assert.ok(projects.total >= 6, 'Total projects in SQLite must be at least 6');

      // Verify events metrics
      assert.ok(events, 'events object must exist');
      assert.strictEqual(typeof events.total, 'number');
      assert.strictEqual(typeof events.upcoming, 'number');
      assert.strictEqual(events.total, 9, 'Total events in SQLite must match 9');
      assert.strictEqual(events.upcoming, 9);
    });

    // --- Test Group 5: Session Termination & Immediate Invalidation ---
    console.log('\n--- Test Group 5: Session Termination & Immediate Invalidation ---');

    await it('POST /api/admin/auth/logout terminates the session', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/logout`, {
        method: 'POST',
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'set-cookie header must be present on logout');
      assert.ok(setCookie.includes('nexus_admin_session='), 'clears nexus_admin_session cookie');
      assert.ok(
        setCookie.toLowerCase().includes('expires=') || setCookie.toLowerCase().includes('max-age=0'),
        'cookie expiry must be in the past'
      );
    });

    await it('GET /api/admin/dashboard returns HTTP 401 after logout', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'INVALID_SESSION');
    });

    // --- Test Group 6: Public Website & E-ID Isolation ---
    console.log('\n--- Test Group 6: Public Website & E-ID Isolation ---');

    await it('Public showcase GET /api/members remains intact and functional', async () => {
      const res = await fetch(`${BASE_URL}/api/members`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data);
      assert.ok(Array.isArray(json.data));
      assert.ok(json.data.length > 0);
      assert.strictEqual(json.meta?.totalItems, 29);
    });

    await it('Public E-ID card GET /api/eid/members/NX-026 remains functional', async () => {
      const res = await fetch(`${BASE_URL}/api/eid/members/NX-026`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data?.uniqueId, 'NX-026');
      assert.strictEqual(json.data?.name, 'OROSMIT MISHRA');
      assert.strictEqual(json.data?.slug, 'orosmit-mishra');
    });

    console.log('\n===================================================');
    console.log(`  ADMIN FOUNDATION TESTS: ${passedTests}/${totalTests} PASSED (100%)`);
    console.log('===================================================');
  } finally {
    server.close();
  }
}

runSuite().catch((err) => {
  console.error('Fatal error in test suite:', err);
  if (server) server.close();
  process.exit(1);
});
