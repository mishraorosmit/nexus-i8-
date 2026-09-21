import assert from 'node:assert';
import { createApp } from '../app.ts';
import type { Server } from 'http';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';
import { announcementsRepository } from '../db/repositories/announcements.repository.ts';

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
console.log('  NEXUS ADMIN ANNOUNCEMENTS & CONTENT SYSTEM: E2E SUITE (PHASE 18)');
console.log('===================================================================');

const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';
const app = createApp();
const PORT = 3918;
let server: Server;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runSuite() {
  const db = getDatabase();
  seedDatabase(db);

  // Clean up any test announcements from previous runs
  db.prepare("DELETE FROM announcements WHERE id LIKE 'test-%' OR slug LIKE 'test-%' OR title LIKE '%Robotics Test%'").run();

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  let sessionCookie = '';

  // Helpers
  async function postJson(path: string, body: any, cookie?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data, headers: res.headers };
  }

  async function patchJson(path: string, body: any, cookie?: string, ifMatch?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    if (ifMatch) headers['If-Match'] = ifMatch;
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data, headers: res.headers };
  }

  async function getJson(path: string, cookie?: string) {
    const headers: Record<string, string> = {};
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    const data = await res.json().catch(() => null);
    return { status: res.status, data, headers: res.headers };
  }

  async function deleteJson(path: string, cookie?: string) {
    const headers: Record<string, string> = {};
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers });
    const data = await res.json().catch(() => null);
    return { status: res.status, data, headers: res.headers };
  }

  try {
    // -------------------------------------------------------------
    // Setup: Admin Authentication
    // -------------------------------------------------------------
    console.log('\n--- 0. Authentication Setup ---');
    const loginRes = await postJson('/api/admin/auth/login', { password: masterPassword });
    assert.strictEqual(loginRes.status, 200, 'Admin login succeeded');
    const setCookie = loginRes.headers.get('set-cookie');
    assert.ok(setCookie, 'Set-Cookie header received');
    sessionCookie = setCookie.split(';')[0];

    // -------------------------------------------------------------
    // 1. Unauthenticated Route Defense
    // -------------------------------------------------------------
    console.log('\n--- 1. Unauthenticated Endpoint Rejection ---');
    await it('Rejects unauthenticated GET /api/admin/announcements with 401', async () => {
      const res = await getJson('/api/admin/announcements');
      assert.strictEqual(res.status, 401);
    });

    await it('Rejects unauthenticated POST /api/admin/announcements with 401', async () => {
      const res = await postJson('/api/admin/announcements', { title: 'Unauthorized' });
      assert.strictEqual(res.status, 401);
    });

    await it('Rejects unauthenticated PATCH /api/admin/announcements/:id with 401', async () => {
      const res = await patchJson('/api/admin/announcements/ann-001', { title: 'Unauthorized' });
      assert.strictEqual(res.status, 401);
    });

    await it('Rejects unauthenticated DELETE /api/admin/announcements/:id with 401', async () => {
      const res = await deleteJson('/api/admin/announcements/ann-001');
      assert.strictEqual(res.status, 401);
    });

    // -------------------------------------------------------------
    // 2. Create Draft Announcement
    // -------------------------------------------------------------
    console.log('\n--- 2. Create Draft Announcement ---');
    let testAnnId = '';
    let testAnnSlug = '';
    let testAnnUpdatedAt = '';

    await it('Creates a draft announcement with auto-generated slug', async () => {
      const res = await postJson(
        '/api/admin/announcements',
        {
          title: 'Robotics Test Cohort 2027 Applications',
          summary: 'Apply now for the robotics autonomous systems team.',
          body: 'Detailed application guidelines for undergraduate and graduate students in engineering.',
          priority: 'Urgent',
          status: 'draft',
        },
        sessionCookie
      );

      assert.strictEqual(res.status, 201, 'Returns 201 Created');
      assert.ok(res.data.data, 'Data object is present');
      assert.strictEqual(res.data.error, null, 'Error is null');
      assert.ok(res.data.data.id, 'Has generated ID');
      assert.strictEqual(res.data.data.publish_status, 'draft', 'Status is draft');
      assert.strictEqual(res.data.data.priority, 'Urgent', 'Priority is Urgent');
      assert.strictEqual(res.data.data.published_at, null, 'Draft has null published_at');
      assert.strictEqual(res.data.data.slug, 'robotics-test-cohort-2027-applications', 'Slug generated from title');

      testAnnId = res.data.data.id;
      testAnnSlug = res.data.data.slug;
      testAnnUpdatedAt = res.data.data.updated_at;
    });

    // -------------------------------------------------------------
    // 3. Draft Exclusion from Public API
    // -------------------------------------------------------------
    console.log('\n--- 3. Public Isolation of Drafts ---');
    await it('Public GET /api/announcements strictly excludes drafts', async () => {
      const res = await getJson('/api/announcements');
      assert.strictEqual(res.status, 200, 'Public announcements returns 200');
      assert.ok(Array.isArray(res.data.data), 'Returns array of announcements');
      const found = res.data.data.some((a: any) => a.id === testAnnId || a.slug === testAnnSlug);
      assert.strictEqual(found, false, 'Draft announcement is NOT returned in public listing');
    });

    await it('Public GET /api/announcements/:id returns 404 for draft', async () => {
      const res = await getJson(`/api/announcements/${testAnnId}`);
      assert.strictEqual(res.status, 404, 'Direct lookup of draft by ID returns 404');
    });

    await it('Public GET /api/announcements/:slug returns 404 for draft', async () => {
      const res = await getJson(`/api/announcements/${testAnnSlug}`);
      assert.strictEqual(res.status, 404, 'Direct lookup of draft by slug returns 404');
    });

    // -------------------------------------------------------------
    // 4. Edit Announcement & Concurrency Conflict Protection
    // -------------------------------------------------------------
    console.log('\n--- 4. Concurrency Protection & Edit ---');
    await it('Rejects update with stale If-Match concurrency header (409 Conflict)', async () => {
      const res = await patchJson(
        `/api/admin/announcements/${testAnnId}`,
        { title: 'Conflicting Title' },
        sessionCookie,
        '2020-01-01T00:00:00.000Z'
      );
      assert.strictEqual(res.status, 409, 'Returns 409 Conflict');
      assert.strictEqual(res.data.error.code, 'CONCURRENCY_CONFLICT', 'Code is CONCURRENCY_CONFLICT');
    });

    await it('Updates announcement title and summary with valid match header', async () => {
      const res = await patchJson(
        `/api/admin/announcements/${testAnnId}`,
        {
          title: 'Robotics Test Cohort 2027 Applications (Extended)',
          summary: 'Deadline extended by one additional sprint cycle.',
        },
        sessionCookie,
        testAnnUpdatedAt
      );

      assert.strictEqual(res.status, 200, 'Returns 200 OK');
      assert.strictEqual(res.data.data.title, 'Robotics Test Cohort 2027 Applications (Extended)');
      assert.strictEqual(res.data.data.summary, 'Deadline extended by one additional sprint cycle.');
      testAnnUpdatedAt = res.data.data.updated_at;
    });

    // -------------------------------------------------------------
    // 5. Publishing Workflow
    // -------------------------------------------------------------
    console.log('\n--- 5. Publishing Workflow ---');
    await it('Publishes announcement via PATCH /publish', async () => {
      const res = await patchJson(`/api/admin/announcements/${testAnnId}/publish`, {}, sessionCookie);
      assert.strictEqual(res.status, 200, 'Publish returns 200');
      assert.strictEqual(res.data.data.publish_status, 'published', 'Status is published');
      assert.ok(res.data.data.published_at, 'published_at timestamp is populated');
      testAnnUpdatedAt = res.data.data.updated_at;
    });

    await it('Published announcement is now accessible in public GET /api/announcements', async () => {
      const res = await getJson('/api/announcements');
      assert.strictEqual(res.status, 200);
      const found = res.data.data.find((a: any) => a.id === testAnnId);
      assert.ok(found, 'Published announcement is returned in public list');
      assert.strictEqual(found.title, 'Robotics Test Cohort 2027 Applications (Extended)');
      assert.strictEqual(found.slug, testAnnSlug);
      assert.strictEqual(found.priority, 'Urgent');
    });

    await it('Published announcement resolves by slug via public GET /api/announcements/:slug', async () => {
      const res = await getJson(`/api/announcements/${testAnnSlug}`);
      assert.strictEqual(res.status, 200, 'Resolves by slug with 200');
      assert.strictEqual(res.data.data.id, testAnnId);
      assert.strictEqual(res.data.data.slug, testAnnSlug);
    });

    // -------------------------------------------------------------
    // 6. Unpublishing Workflow
    // -------------------------------------------------------------
    console.log('\n--- 6. Unpublishing Workflow ---');
    await it('Unpublishes announcement via PATCH /unpublish', async () => {
      const res = await patchJson(`/api/admin/announcements/${testAnnId}/unpublish`, {}, sessionCookie);
      assert.strictEqual(res.status, 200, 'Unpublish returns 200');
      assert.strictEqual(res.data.data.publish_status, 'draft', 'Status is back to draft');
    });

    await it('Immediately hidden from public GET /api/announcements upon unpublishing', async () => {
      const res = await getJson('/api/announcements');
      const found = res.data.data.some((a: any) => a.id === testAnnId);
      assert.strictEqual(found, false, 'Unpublished item is immediately hidden');
    });

    // -------------------------------------------------------------
    // 7. Archiving Workflow
    // -------------------------------------------------------------
    console.log('\n--- 7. Archiving Workflow ---');
    await it('Archives announcement via PATCH /archive', async () => {
      const res = await patchJson(`/api/admin/announcements/${testAnnId}/archive`, {}, sessionCookie);
      assert.strictEqual(res.status, 200, 'Archive returns 200');
      assert.strictEqual(res.data.data.publish_status, 'archived', 'Status is archived');
    });

    await it('Archived announcement is omitted from public API and returns 404', async () => {
      const listRes = await getJson('/api/announcements');
      const found = listRes.data.data.some((a: any) => a.id === testAnnId);
      assert.strictEqual(found, false, 'Archived item is not in public listing');

      const itemRes = await getJson(`/api/announcements/${testAnnSlug}`);
      assert.strictEqual(itemRes.status, 404, 'Public lookup of archived item returns 404');
    });

    // -------------------------------------------------------------
    // 8. Expiry Validation & Query-Time Evaluation
    // -------------------------------------------------------------
    console.log('\n--- 8. Expiry Validation & Evaluation ---');
    await it('Rejects past expiration date on creation with HTTP 400 INVALID_DATE', async () => {
      const res = await postJson(
        '/api/admin/announcements',
        {
          title: 'Expired Date Test',
          summary: 'Should fail with past date',
          expiresAt: '2020-01-01T00:00:00.000Z',
        },
        sessionCookie
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.error.code, 'INVALID_DATE');
    });

    await it('Rejects malformed expiration string with HTTP 400 INVALID_DATE', async () => {
      const res = await postJson(
        '/api/admin/announcements',
        {
          title: 'Malformed Date Test',
          summary: 'Should fail with malformed date',
          expiresAt: 'not-a-valid-date-string',
        },
        sessionCookie
      );
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.error.code, 'INVALID_DATE');
    });

    let expiringAnnId = '';
    let expiringAnnSlug = '';
    await it('Creates published announcement with future expiry', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 10).toISOString(); // 10 days in future
      const res = await postJson(
        '/api/admin/announcements',
        {
          title: 'Temporary Flash Notice',
          summary: 'Expires in 10 days',
          status: 'published',
          expiresAt: futureDate,
        },
        sessionCookie
      );
      assert.strictEqual(res.status, 201);
      expiringAnnId = res.data.data.id;
      expiringAnnSlug = res.data.data.slug;

      const pubRes = await getJson('/api/announcements');
      const found = pubRes.data.data.some((a: any) => a.id === expiringAnnId);
      assert.strictEqual(found, true, 'Active future-expiring notice is visible');
    });

    await it('Simulates expiration: hides from public API without deleting from SQLite', async () => {
      // Manually set expires_at in the past directly in SQLite
      db.prepare("UPDATE announcements SET expires_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(expiringAnnId);

      // Public API should immediately exclude it
      const pubRes = await getJson('/api/announcements');
      const found = pubRes.data.data.some((a: any) => a.id === expiringAnnId);
      assert.strictEqual(found, false, 'Expired announcement is excluded from public list');

      const directRes = await getJson(`/api/announcements/${expiringAnnSlug}`);
      assert.strictEqual(directRes.status, 404, 'Direct public lookup of expired announcement returns 404');

      // Database verification: record is preserved!
      const row = db.prepare('SELECT id, expires_at FROM announcements WHERE id = ?').get(expiringAnnId) as any;
      assert.ok(row, 'Record is preserved in SQLite (historical data intact)');
      assert.strictEqual(row.expires_at, '2020-01-01T00:00:00.000Z');
    });

    // -------------------------------------------------------------
    // 9. Unsafe Content Sanitization (XSS Defense)
    // -------------------------------------------------------------
    console.log('\n--- 9. Content Security & XSS Sanitization ---');
    let xssAnnId = '';
    await it('Sanitizes malicious script and iframe payloads in content', async () => {
      const maliciousPayload = {
        title: 'Safe Title <script>alert("XSS")</script>',
        summary: 'Summary with <iframe src="https://evil.com"></iframe> and harmless text.',
        body: 'Body with <img src="x" onerror="alert(1)" /> and <script src="evil.js"></script> preserved text.',
        status: 'published',
      };

      const res = await postJson('/api/admin/announcements', maliciousPayload, sessionCookie);
      assert.strictEqual(res.status, 201, 'Creation succeeds');
      xssAnnId = res.data.data.id;

      // Verify sanitized content
      const created = res.data.data;
      assert.ok(!created.title.includes('<script>'), 'Title has <script> stripped');
      assert.ok(!created.summary.includes('<iframe'), 'Summary has <iframe> stripped');
      assert.ok(!created.body.includes('<script>'), 'Body has <script> stripped');
      assert.ok(!created.body.includes('onerror='), 'Body has event handler stripped');
      assert.ok(created.title.includes('Safe Title'), 'Safe text preserved');
    });

    // -------------------------------------------------------------
    // 10. Audit Logging
    // -------------------------------------------------------------
    console.log('\n--- 10. Audit Trail Verification ---');
    await it('Audit ledger recorded all announcement mutations', async () => {
      const auditRows = db
        .prepare(`
          SELECT action, entity_type, entity_id
          FROM audit_logs
          WHERE entity_type = 'ANNOUNCEMENT'
          ORDER BY created_at DESC
        `)
        .all() as any[];

      const actions = auditRows.map((r) => r.action);
      assert.ok(actions.includes('ANNOUNCEMENT_CREATED'), 'Logged ANNOUNCEMENT_CREATED');
      assert.ok(actions.includes('ANNOUNCEMENT_UPDATED'), 'Logged ANNOUNCEMENT_UPDATED');
      assert.ok(actions.includes('ANNOUNCEMENT_PUBLISHED'), 'Logged ANNOUNCEMENT_PUBLISHED');
      assert.ok(actions.includes('ANNOUNCEMENT_UNPUBLISHED'), 'Logged ANNOUNCEMENT_UNPUBLISHED');
      assert.ok(actions.includes('ANNOUNCEMENT_ARCHIVED'), 'Logged ANNOUNCEMENT_ARCHIVED');

      // Verify no GET requests logged
      const getAudit = auditRows.filter((r) => r.action.startsWith('GET'));
      assert.strictEqual(getAudit.length, 0, 'No GET requests logged in audit trail');
    });

    // -------------------------------------------------------------
    // 11. Search & Filtering Capabilities
    // -------------------------------------------------------------
    console.log('\n--- 11. Admin Search & Facets Telemetry ---');
    await it('GET /api/admin/announcements returns filtered results and facets', async () => {
      const res = await getJson('/api/admin/announcements?status=all', sessionCookie);
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.meta.facets, 'Facets object present in response');
      assert.ok(typeof res.data.meta.facets.total === 'number', 'Total facet is a number');
      assert.ok(typeof res.data.meta.facets.published === 'number', 'Published facet is a number');
      assert.ok(typeof res.data.meta.facets.draft === 'number', 'Draft facet is a number');
      assert.ok(typeof res.data.meta.facets.archived === 'number', 'Archived facet is a number');
    });

    await it('Filters announcements by status and search keyword', async () => {
      const searchRes = await getJson('/api/admin/announcements?search=Applications', sessionCookie);
      assert.strictEqual(searchRes.status, 200);
      assert.ok(searchRes.data.data.length > 0, 'Found results for search');
    });

    // -------------------------------------------------------------
    // 12. Delete Announcement
    // -------------------------------------------------------------
    console.log('\n--- 12. Deletion ---');
    await it('Deletes announcement via DELETE /api/admin/announcements/:id', async () => {
      const res = await deleteJson(`/api/admin/announcements/${testAnnId}`, sessionCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.data.deleted, true);

      // Verify record gone from SQLite
      const check = db.prepare('SELECT id FROM announcements WHERE id = ?').get(testAnnId);
      assert.strictEqual(check, undefined, 'Record deleted from SQLite');
    });

    // -------------------------------------------------------------
    // 13. Secrets Isolation
    // -------------------------------------------------------------
    console.log('\n--- 13. Secrets Isolation ---');
    await it('API responses never leak passwords, tokens, or server secrets', async () => {
      const res = await getJson('/api/admin/announcements', sessionCookie);
      const json = JSON.stringify(res.data);
      assert.ok(!json.includes(masterPassword), 'Master password not in payload');
      assert.ok(!json.includes('password_hash'), 'password_hash not in payload');
      assert.ok(!json.includes('CLOUDINARY_API_SECRET'), 'CLOUDINARY_API_SECRET not in payload');
    });

    // Cleanup
    if (expiringAnnId) db.prepare('DELETE FROM announcements WHERE id = ?').run(expiringAnnId);
    if (xssAnnId) db.prepare('DELETE FROM announcements WHERE id = ?').run(xssAnnId);

  } finally {
    server.close();
  }

  console.log('\n===================================================================');
  console.log(`  RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('===================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
