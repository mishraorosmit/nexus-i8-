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

console.log('===================================================================');
console.log('  NEXUS ADMIN MEMBER SEARCH, FILTERS & PAGINATION: E2E TEST SUITE  ');
console.log('===================================================================');

const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';
const app = createApp();
const PORT = 3899;
let server: Server;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runSuite() {
  const db = getDatabase();
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

    await it('GET /api/admin/members with search params returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?q=test&status=ACTIVE`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    await it('GET /api/admin/members/facets returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/facets`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    // --- Test Group 2: Authenticated Session Setup & Facets ---
    console.log('\n--- Test Group 2: Authenticated Session & Facets Endpoint ---');

    await it('POST /api/admin/auth/login establishes valid admin session', async () => {
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

    await it('GET /api/admin/members/facets returns distinct roles, domains, departments, statuses', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/facets`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(Array.isArray(json.data.roles));
      assert.ok(Array.isArray(json.data.domains));
      assert.ok(Array.isArray(json.data.departments));
      assert.ok(Array.isArray(json.data.statuses));
      assert.ok(json.data.roles.length > 0, 'Roles should have facets');
      assert.ok(json.data.domains.length > 0, 'Domains should have facets');
      assert.ok(json.data.departments.length > 0, 'Departments should have facets');
      assert.ok(json.data.statuses.includes('ACTIVE'));
      assert.strictEqual(json.meta.maxPageSize, 100);
    });

    // --- Test Group 3: Server-side Search Execution ---
    console.log('\n--- Test Group 3: Server-side Search Execution ---');

    await it('Search by exact unique_id (case-insensitive)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?q=nx-026`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 1);
      assert.strictEqual(json.data[0].unique_id, 'NX-026');
      assert.strictEqual(json.meta.totalItems, 1);
    });

    await it('Search by name case-insensitive (lowercase query matches uppercase name)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?q=orosmit`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 1);
      assert.strictEqual(json.data[0].unique_id, 'NX-026');
      assert.match(json.data[0].name.toLowerCase(), /orosmit/);
    });

    await it('Search with leading and trailing whitespace is automatically trimmed', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?q=%20%20orosmit%20%20`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 1);
      assert.strictEqual(json.data[0].unique_id, 'NX-026');
    });

    await it('Search by partial role match', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?q=lead`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 0);
      for (const m of json.data) {
        const matched = 
          m.role.toLowerCase().includes('lead') || 
          m.name.toLowerCase().includes('lead') ||
          (m.domain && m.domain.toLowerCase().includes('lead')) ||
          (m.department && m.department.toLowerCase().includes('lead'));
        assert.ok(matched, `Member ${m.name} should match query "lead"`);
      }
    });

    await it('Search by partial email match', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?q=@nexus.campus`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 0);
    });

    await it('Search handles SQL special characters without SQL error or injection (% and _)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?q=%25`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(Array.isArray(json.data));
    });

    await it('Search with no matching records returns empty array and totalItems=0', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?q=NonExistentMemberQuery999`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 0);
      assert.strictEqual(json.meta.totalItems, 0);
      assert.strictEqual(json.meta.totalPages, 0);
      assert.strictEqual(json.meta.hasNextPage, false);
      assert.strictEqual(json.meta.hasPrevPage, false);
    });

    // --- Test Group 4: Server-side Filtering ---
    console.log('\n--- Test Group 4: Server-side Filtering ---');

    await it('Filter by status=ACTIVE returns only active members', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?status=ACTIVE&pageSize=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 0);
      for (const m of json.data) {
        assert.strictEqual(m.status.toUpperCase(), 'ACTIVE');
      }
    });

    await it('Filter by status=INACTIVE returns 0 items for seed data', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?status=INACTIVE`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 0);
      assert.strictEqual(json.meta.totalItems, 0);
    });

    await it('Filter by status=all returns all members', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?status=all&pageSize=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 29);
      assert.strictEqual(json.meta.totalItems, 29);
    });

    await it('Filter by department returns only members of that department', async () => {
      const facetsRes = await fetch(`${BASE_URL}/api/admin/members/facets`, {
        headers: { Cookie: sessionCookie },
      });
      const facetsJson = await facetsRes.json();
      const testDept = facetsJson.data.departments[0];
      assert.ok(testDept, 'Test department should exist');

      const res = await fetch(`${BASE_URL}/api/admin/members?department=${encodeURIComponent(testDept)}&pageSize=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 0);
      for (const m of json.data) {
        assert.strictEqual(m.department, testDept);
      }
    });

    await it('Filter by domain returns only members of that domain', async () => {
      // Pick the domain of the first member
      const facetsRes = await fetch(`${BASE_URL}/api/admin/members/facets`, {
        headers: { Cookie: sessionCookie },
      });
      const facetsJson = await facetsRes.json();
      const testDomain = facetsJson.data.domains[0];
      assert.ok(testDomain, 'Test domain should exist');

      const res = await fetch(`${BASE_URL}/api/admin/members?domain=${encodeURIComponent(testDomain)}&pageSize=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 0);
      for (const m of json.data) {
        assert.strictEqual(m.domain, testDomain);
      }
    });

    await it('Filter by role returns only members of that role', async () => {
      const facetsRes = await fetch(`${BASE_URL}/api/admin/members/facets`, {
        headers: { Cookie: sessionCookie },
      });
      const facetsJson = await facetsRes.json();
      const testRole = facetsJson.data.roles[0];
      assert.ok(testRole, 'Test role should exist');

      const res = await fetch(`${BASE_URL}/api/admin/members?role=${encodeURIComponent(testRole)}&pageSize=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 0);
      for (const m of json.data) {
        assert.strictEqual(m.role, testRole);
      }
    });

    // --- Test Group 5: Whitelisted Sorting & Injection Protection ---
    console.log('\n--- Test Group 5: Whitelisted Sorting & SQL Injection Protection ---');

    await it('Sort by name_asc returns items in alphabetical order', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?sort=name_asc&pageSize=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 1);
      for (let i = 0; i < json.data.length - 1; i++) {
        const a = json.data[i].name.toLowerCase();
        const b = json.data[i + 1].name.toLowerCase();
        assert.ok(a.localeCompare(b) <= 0, `Expected ${a} <= ${b}`);
      }
    });

    await it('Sort by name_desc returns items in reverse alphabetical order', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?sort=name_desc&pageSize=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 1);
      for (let i = 0; i < json.data.length - 1; i++) {
        const a = json.data[i].name.toLowerCase();
        const b = json.data[i + 1].name.toLowerCase();
        assert.ok(a.localeCompare(b) >= 0, `Expected ${a} >= ${b}`);
      }
    });

    await it('Sort by unique_id_asc returns NX-001 first', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?sort=unique_id_asc&pageSize=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data[0].unique_id, 'NX-001');
    });

    await it('Sort by unique_id_desc returns NX-029 first', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?sort=unique_id_desc&pageSize=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data[0].unique_id, 'NX-029');
    });

    await it('Malicious or unknown sort string safely falls back to default sorting without error', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?sort=malicious_col%20DESC;--`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(Array.isArray(json.data));
      assert.strictEqual(json.data.length, 25); // default page size
    });

    // --- Test Group 6: Controlled Pagination ---
    console.log('\n--- Test Group 6: Controlled Pagination ---');

    await it('Default pagination is page 1 with pageSize 25', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.meta.page, 1);
      assert.strictEqual(json.meta.pageSize, 25);
      assert.strictEqual(json.meta.totalItems, 29);
      assert.strictEqual(json.meta.totalPages, 2);
      assert.strictEqual(json.meta.hasNextPage, true);
      assert.strictEqual(json.meta.hasPrevPage, false);
      assert.strictEqual(json.data.length, 25);
    });

    await it('Page 2 retrieves remaining 4 items with hasNextPage=false, hasPrevPage=true', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?page=2&pageSize=25`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.meta.page, 2);
      assert.strictEqual(json.meta.pageSize, 25);
      assert.strictEqual(json.meta.totalItems, 29);
      assert.strictEqual(json.meta.totalPages, 2);
      assert.strictEqual(json.meta.hasNextPage, false);
      assert.strictEqual(json.meta.hasPrevPage, true);
      assert.strictEqual(json.data.length, 4);
    });

    await it('Page size 50 returns all 29 items on page 1 with totalPages=1', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?page=1&pageSize=50`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.meta.page, 1);
      assert.strictEqual(json.meta.pageSize, 50);
      assert.strictEqual(json.meta.totalItems, 29);
      assert.strictEqual(json.meta.totalPages, 1);
      assert.strictEqual(json.meta.hasNextPage, false);
      assert.strictEqual(json.meta.hasPrevPage, false);
      assert.strictEqual(json.data.length, 29);
    });

    await it('Page size exceeding 100 is clamped to 100', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?pageSize=5000`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.meta.pageSize, 100);
    });

    await it('Invalid negative or zero page is clamped to page 1', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?page=-5`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.meta.page, 1);
    });

    await it('Out of bounds page returns empty data with accurate meta', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members?page=999&pageSize=25`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 0);
      assert.strictEqual(json.meta.page, 999);
      assert.strictEqual(json.meta.totalItems, 29);
      assert.strictEqual(json.meta.hasNextPage, false);
      assert.strictEqual(json.meta.hasPrevPage, true);
    });

    // --- Test Group 7: Combined Search, Filter, Sort & Pagination ---
    console.log('\n--- Test Group 7: Combined Search, Filter, Sort & Pagination ---');

    await it('Combines search + filter + sort + pagination accurately', async () => {
      const res = await fetch(
        `${BASE_URL}/api/admin/members?q=NX&status=ACTIVE&sort=name_asc&page=1&pageSize=10`,
        { headers: { Cookie: sessionCookie } }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.meta.page, 1);
      assert.strictEqual(json.meta.pageSize, 10);
      assert.strictEqual(json.data.length, 10);
      assert.strictEqual(json.meta.totalItems, 29);
      assert.strictEqual(json.meta.totalPages, 3);
      assert.strictEqual(json.meta.hasNextPage, true);

      // Verify each member is ACTIVE, matches NX, and sorted ascending
      for (let i = 0; i < json.data.length; i++) {
        assert.strictEqual(json.data[i].status.toUpperCase(), 'ACTIVE');
        assert.ok(json.data[i].unique_id.includes('NX'));
        if (i < json.data.length - 1) {
          const a = json.data[i].name.toLowerCase();
          const b = json.data[i + 1].name.toLowerCase();
          assert.ok(a.localeCompare(b) <= 0, `Expected ${a} <= ${b}`);
        }
      }
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n===================================================');
  console.log(`  SUITE COMPLETE: ${passedTests}/${totalTests} tests passed`);
  console.log('===================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) {
    server.close();
  }
  process.exit(1);
});
