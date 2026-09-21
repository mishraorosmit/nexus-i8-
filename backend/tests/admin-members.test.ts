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
console.log('  NEXUS ADMIN MEMBER MANAGEMENT: E2E TEST SUITE    ');
console.log('===================================================');

const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';
const app = createApp();
const PORT = 3898;
let server: Server;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runSuite() {
  const db = getDatabase();
  // Clean up any test members from prior test runs
  db.exec(`
    DELETE FROM members 
    WHERE email = 'ananya.sharma@nexus.campus' 
       OR slug = 'ananya-sharma' 
       OR unique_id = 'NX-030';
  `);
  seedDatabase(db);

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  let sessionCookie = '';

  try {
    // --- Test Group 1: Unauthenticated Protection ---
    console.log('\n--- Test Group 1: Unauthenticated Endpoint Protection ---');

    await it('GET /api/admin/members returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    await it('POST /api/admin/members returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unauth User', role: 'Tester' }),
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    await it('PATCH /api/admin/members/:id returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/mem-1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked' }),
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    await it('PATCH /api/admin/members/:id/status returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/mem-1/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INACTIVE' }),
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    // --- Test Group 2: Authenticated Session Setup ---
    console.log('\n--- Test Group 2: Administrator Authentication ---');

    await it('POST /api/admin/auth/login establishes valid session', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword }),
      });
      assert.strictEqual(res.status, 200);
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'Expected Set-Cookie header');
      const match = setCookie.match(/nexus_admin_session=([^;]+)/);
      assert.ok(match, 'Expected nexus_admin_session in cookie');
      sessionCookie = `nexus_admin_session=${match[1]}`;
    });

    // --- Test Group 3: Members Listing, Filtering & Search ---
    console.log('\n--- Test Group 3: Member List, Status Filtering & Search ---');

    await it('GET /api/admin/members returns all seeded members', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?limit=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.data));
      assert.strictEqual(json.data.length, 29);
      assert.strictEqual(json.meta.totalItems, 29);
      assert.strictEqual(json.error, null);
    });

    await it('GET /api/admin/members?status=all returns all members', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?status=all&limit=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 29);
    });

    await it('GET /api/admin/members?status=ACTIVE returns only active members', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?status=ACTIVE&limit=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 29);
      for (const m of json.data) {
        assert.strictEqual(m.status.toUpperCase(), 'ACTIVE');
      }
    });

    await it('GET /api/admin/members?search=Orosmit matches member by name', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?search=Orosmit`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 1);
      assert.strictEqual(json.data[0].unique_id, 'NX-026');
      assert.strictEqual(json.data[0].slug, 'orosmit-mishra');
    });

    await it('GET /api/admin/members?search=NX-001 matches member by unique_id', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?search=NX-001`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 1);
      assert.strictEqual(json.data[0].unique_id, 'NX-001');
      assert.strictEqual(json.data[0].name.toUpperCase(), 'JITESH RAJ');
    });

    await it('GET /api/admin/members?search=jitesh-raj matches member by slug', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?search=jitesh-raj`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 1);
      assert.strictEqual(json.data[0].slug, 'jitesh-raj');
    });

    // --- Test Group 4: Member Creation & Auto Unique ID ---
    console.log('\n--- Test Group 4: Member Creation & Auto Unique ID Generation ---');

    let createdMemberId = '';
    let createdUniqueId = '';

    await it('POST /api/admin/members creates valid member with auto-generated unique ID', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          name: 'Ananya Sharma',
          email: 'ananya.sharma@nexus.campus',
          role: 'Full Stack Engineer',
          domain: 'Engineering & Design',
          department: 'ENGINEERING',
          status: 'ACTIVE',
          bio: 'Passionate about distributed systems and cloud native tools.',
          joinedAt: '2026-03-15',
        }),
      });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.ok(json.data);
      assert.strictEqual(json.data.name, 'Ananya Sharma');
      assert.strictEqual(json.data.slug, 'ananya-sharma');
      assert.strictEqual(json.data.role, 'Full Stack Engineer');
      assert.strictEqual(json.data.status, 'ACTIVE');
      assert.ok(json.data.unique_id && /^NX-[0-9]{3,}$/.test(json.data.unique_id));
      // Since seeded members go up to NX-029, this should be NX-030
      assert.strictEqual(json.data.unique_id, 'NX-030');

      createdMemberId = json.data.id;
      createdUniqueId = json.data.unique_id;
    });

    // --- Test Group 5: Validation & Constraint Error Handling ---
    console.log('\n--- Test Group 5: Validation & Constraint Error Handling ---');

    await it('POST /api/admin/members rejects missing name', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ role: 'Developer' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'INVALID_NAME');
    });

    await it('POST /api/admin/members rejects missing role', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ name: 'Valid Name' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'INVALID_ROLE');
    });

    await it('POST /api/admin/members rejects malformed email', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          name: 'Valid Name',
          role: 'Developer',
          email: 'not-an-email',
        }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'INVALID_EMAIL');
    });

    await it('POST /api/admin/members rejects duplicate email', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          name: 'Duplicate Email User',
          role: 'Designer',
          email: 'ananya.sharma@nexus.campus',
        }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'DUPLICATE_EMAIL');
    });

    await it('POST /api/admin/members rejects duplicate unique_id', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          name: 'Duplicate Unique ID User',
          role: 'Designer',
          uniqueId: 'NX-026', // already belongs to Orosmit Mishra
        }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'DUPLICATE_UNIQUE_ID');
    });

    await it('POST /api/admin/members rejects duplicate slug', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          name: 'Ananya Sharma', // resolves to existing slug 'ananya-sharma'
          role: 'Developer',
        }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'DUPLICATE_SLUG');
    });

    // --- Test Group 6: Member Retrieval & 404 Handling ---
    console.log('\n--- Test Group 6: Single Member Details & 404 Handling ---');

    await it('GET /api/admin/members/:id returns full member record', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data);
      assert.strictEqual(json.data.id, createdMemberId);
      assert.strictEqual(json.data.name, 'Ananya Sharma');
      assert.strictEqual(json.data.unique_id, createdUniqueId);
      assert.strictEqual(json.data.status, 'ACTIVE');
    });

    await it('GET /api/admin/members/non-existent-id returns 404 MEMBER_NOT_FOUND', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/mem-non-existent-999`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'MEMBER_NOT_FOUND');
    });

    // --- Test Group 7: Member Editing & Unique ID Preservation ---
    console.log('\n--- Test Group 7: Member Editing & Unique ID Preservation ---');

    await it('PATCH /api/admin/members/:id updates editable fields and preserves unique_id', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          name: 'Ananya Sharma (Senior)',
          role: 'Lead Cloud Architect',
          bio: 'Updated bio information.',
        }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data);
      assert.strictEqual(json.data.name, 'Ananya Sharma (Senior)');
      assert.strictEqual(json.data.role, 'Lead Cloud Architect');
      assert.strictEqual(json.data.bio, 'Updated bio information.');
      // CRITICAL: unique_id MUST be preserved and NOT regenerated!
      assert.strictEqual(json.data.unique_id, createdUniqueId);
    });

    await it('PATCH /api/admin/members/:id preserves stable slug when name changes', async () => {
      const getRes = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}`, {
        headers: { Cookie: sessionCookie },
      });
      const getJson = await getRes.json();
      // Slug should remain the original stable slug unless explicitly requested
      assert.strictEqual(getJson.data.slug, 'ananya-sharma');
      assert.strictEqual(getJson.data.unique_id, createdUniqueId);
    });

    // --- Test Group 8: Status Transitions (ACTIVE, INACTIVE, ALUMNI) ---
    console.log('\n--- Test Group 8: Status Transitions (Reversible, No Hard Delete) ---');

    await it('PATCH /api/admin/members/:id/status deactivates member (INACTIVE)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'INACTIVE' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'INACTIVE');

      // Verify member still exists in database
      const verifyRes = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}`, {
        headers: { Cookie: sessionCookie },
      });
      const verifyJson = await verifyRes.json();
      assert.strictEqual(verifyJson.data.status, 'INACTIVE');
      assert.strictEqual(verifyJson.data.unique_id, createdUniqueId);
    });

    await it('PATCH /api/admin/members/:id/status reactivates member (ACTIVE)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'ACTIVE');
    });

    await it('PATCH /api/admin/members/:id/status sets member status to ALUMNI', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'ALUMNI' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'ALUMNI');
    });

    await it('PATCH /api/admin/members/:id/status rejects invalid status value', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'DELETED' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'INVALID_STATUS');
    });

    // --- Test Group 9: Public Website and E-ID Isolation ---
    console.log('\n--- Test Group 9: Public Website & E-ID Isolation ---');

    await it('Public showcase GET /api/members remains functional', async () => {
      const res = await fetch(`${BASE_URL}/api/members`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(Array.isArray(json.data));
      assert.ok(json.meta.totalItems >= 29);
    });

    await it('Public E-ID GET /api/eid/members/NX-026 remains functional', async () => {
      const res = await fetch(`${BASE_URL}/api/eid/members/NX-026`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.uniqueId, 'NX-026');
      assert.strictEqual(json.data.name.toUpperCase(), 'OROSMIT MISHRA');
    });

    await it('Public E-ID GET /api/eid/memberID/orosmit-mishra/NX-026 remains functional', async () => {
      const res = await fetch(`${BASE_URL}/api/eid/memberID/orosmit-mishra/NX-026`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.uniqueId, 'NX-026');
      assert.strictEqual(json.data.slug, 'orosmit-mishra');
    });
  } finally {
    db.exec(`
      DELETE FROM members 
      WHERE email = 'ananya.sharma@nexus.campus' 
         OR slug = 'ananya-sharma' 
         OR unique_id = 'NX-030';
    `);
    server.close();
  }

  console.log('\n===================================================');
  console.log(`  ADMIN MEMBERS TESTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('===================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error running admin members test suite:', err);
  process.exit(1);
});
