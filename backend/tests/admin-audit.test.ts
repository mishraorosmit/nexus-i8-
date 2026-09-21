import assert from 'node:assert';
import { createApp } from '../app.ts';
import type { Server } from 'http';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';
import { auditLogsRepository } from '../db/repositories/auditLogs.repository.ts';

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
console.log('  NEXUS ADMIN AUDIT LOG & CHANGE-TRACKING: E2E TEST SUITE (PHASE 12)');
console.log('===================================================================');

const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';
const app = createApp();
const PORT = 3902;
let server: Server;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runSuite() {
  const db = getDatabase();
  db.exec(`
    DELETE FROM members 
    WHERE name LIKE 'Audit%' 
       OR email LIKE '%audit%';
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

    await it('GET /api/admin/audit-logs returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/audit-logs`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    // --- Test Group 2: Authenticated Session Setup & Login Audit ---
    console.log('\n--- Test Group 2: Authenticated Session Setup & Login Audit ---');

    await it('POST /api/admin/auth/login records LOGIN_SUCCESS audit log with admin context', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword }),
      });
      assert.strictEqual(res.status, 200);

      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'Must return session cookie');
      sessionCookie = setCookie.split(';')[0];

      // Check DB directly or via audit API
      const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?action=LOGIN_SUCCESS&limit=5`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(auditRes.status, 200);
      const auditJson = await auditRes.json();
      assert.ok(auditJson.data.length > 0);
      const loginLog = auditJson.data[0];
      assert.strictEqual(loginLog.action, 'LOGIN_SUCCESS');
      assert.ok(loginLog.admin_name);
      assert.strictEqual(loginLog.admin_role, 'super_admin');
    });

    // --- Test Group 3: Member Lifecycle Mutations & Audit Ledger ---
    console.log('\n--- Test Group 3: Member Lifecycle Mutations & Audit Ledger ---');

    let createdMemberId = '';
    let createdMemberUniqueId = '';

    await it('Member creation records MEMBER_CREATED with full state snapshot', async () => {
      const payload = {
        name: 'Audit Test Member',
        role: 'Security Engineer',
        email: `audit.test.${Date.now()}@nexus.campus`,
        department: 'Security Ops',
        status: 'ACTIVE',
      };

      const res = await fetch(`${BASE_URL}/api/admin/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(payload),
      });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      createdMemberId = json.data.id;
      createdMemberUniqueId = json.data.unique_id;
      assert.ok(createdMemberId);

      // Verify audit log using createdMemberId
      const auditRes = await fetch(
        `${BASE_URL}/api/admin/audit-logs?action=MEMBER_CREATED&entityId=${createdMemberId}`,
        { headers: { Cookie: sessionCookie } }
      );
      assert.strictEqual(auditRes.status, 200);
      const auditJson = await auditRes.json();
      assert.ok(auditJson.data.length > 0);
      const createLog = auditJson.data[0];

      assert.strictEqual(createLog.action, 'MEMBER_CREATED');
      assert.strictEqual(createLog.entity_type.toUpperCase(), 'MEMBER');
      assert.strictEqual(createLog.entity_id, createdMemberId);
      assert.strictEqual(createLog.before_json, null);
      assert.ok(createLog.after_json);
      assert.strictEqual(createLog.after_json.name, 'Audit Test Member');
      assert.strictEqual(createLog.after_json.role, 'Security Engineer');
      assert.strictEqual(createLog.details.unique_id, createdMemberUniqueId);
      assert.strictEqual(createLog.admin_context?.actor, 'authenticated-admin');
    });

    await it('Member update records MEMBER_UPDATED with before and after state capture', async () => {
      const updatePayload = {
        role: 'Staff Security Engineer',
        department: 'Infrastructure Sec',
      };

      const res = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(updatePayload),
      });
      assert.strictEqual(res.status, 200);

      // Verify audit log
      const auditRes = await fetch(
        `${BASE_URL}/api/admin/audit-logs?action=MEMBER_UPDATED&entityId=${createdMemberId}`,
        { headers: { Cookie: sessionCookie } }
      );
      assert.strictEqual(auditRes.status, 200);
      const auditJson = await auditRes.json();
      assert.ok(auditJson.data.length > 0);
      const updateLog = auditJson.data[0];

      assert.strictEqual(updateLog.action, 'MEMBER_UPDATED');
      assert.ok(updateLog.before_json);
      assert.ok(updateLog.after_json);
      assert.strictEqual(updateLog.before_json.role, 'Security Engineer');
      assert.strictEqual(updateLog.after_json.role, 'Staff Security Engineer');
      assert.strictEqual(updateLog.before_json.department, 'Security Ops');
      assert.strictEqual(updateLog.after_json.department, 'Infrastructure Sec');
    });

    await it('Member status change records MEMBER_STATUS_CHANGED with previousStatus & newStatus', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'INACTIVE' }),
      });
      assert.strictEqual(res.status, 200);

      // Verify audit log
      const auditRes = await fetch(
        `${BASE_URL}/api/admin/audit-logs?action=MEMBER_STATUS_CHANGED&entityId=${createdMemberId}`,
        { headers: { Cookie: sessionCookie } }
      );
      assert.strictEqual(auditRes.status, 200);
      const auditJson = await auditRes.json();
      assert.ok(auditJson.data.length > 0);
      const statusLog = auditJson.data[0];

      assert.strictEqual(statusLog.action, 'MEMBER_STATUS_CHANGED');
      assert.ok(statusLog.details);
      assert.strictEqual(statusLog.details.previousStatus, 'ACTIVE');
      assert.strictEqual(statusLog.details.newStatus, 'INACTIVE');
      assert.strictEqual(statusLog.before_json?.status, 'ACTIVE');
      assert.strictEqual(statusLog.after_json?.status, 'INACTIVE');
    });

    await it('Member deletion records MEMBER_DELETED with pre-deletion state preserved', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${createdMemberId}`, {
        method: 'DELETE',
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);

      // Verify audit log
      const auditRes = await fetch(
        `${BASE_URL}/api/admin/audit-logs?action=MEMBER_DELETED&entityId=${createdMemberId}`,
        { headers: { Cookie: sessionCookie } }
      );
      assert.strictEqual(auditRes.status, 200);
      const auditJson = await auditRes.json();
      assert.ok(auditJson.data.length > 0);
      const deleteLog = auditJson.data[0];

      assert.strictEqual(deleteLog.action, 'MEMBER_DELETED');
      assert.ok(deleteLog.before_json);
      assert.strictEqual(deleteLog.before_json.name, 'Audit Test Member');
      assert.strictEqual(deleteLog.after_json, null);
    });

    // --- Test Group 4: Site Settings Mutations & Audit ---
    console.log('\n--- Test Group 4: Site Settings Mutations & Audit ---');

    await it('Site settings update records SETTINGS_CHANGED with updatedKeys and before/after captures', async () => {
      const settingsPayload = {
        settings: {
          site_title: 'NEXUS Club (Audit Verification)',
        },
      };

      const res = await fetch(`${BASE_URL}/api/admin/site-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(settingsPayload),
      });
      assert.strictEqual(res.status, 200);

      const auditRes = await fetch(
        `${BASE_URL}/api/admin/audit-logs?action=SETTINGS_CHANGED&limit=5`,
        { headers: { Cookie: sessionCookie } }
      );
      assert.strictEqual(auditRes.status, 200);
      const auditJson = await auditRes.json();
      assert.ok(auditJson.data.length > 0);
      const settingsLog = auditJson.data[0];

      assert.strictEqual(settingsLog.action, 'SETTINGS_CHANGED');
      assert.strictEqual(settingsLog.entity_type, 'SITE_SETTINGS');
      assert.ok(settingsLog.details?.updatedKeys?.includes('site_title'));
      assert.strictEqual(settingsLog.after_json?.site_title, 'NEXUS Club (Audit Verification)');
    });

    // --- Test Group 5: Bulk Import Audit Recording ---
    console.log('\n--- Test Group 5: Bulk Import Audit Recording ---');

    await it('Bulk import commit records BULK_IMPORT with row counts and format metadata', async () => {
      const csvContent = `Name,Role,Email,Department,Status
Audit Bulk User 1,Developer,audit_bulk1_${Date.now()}@nexus.campus,Core,ACTIVE
Audit Bulk User 2,Designer,audit_bulk2_${Date.now()}@nexus.campus,Design,ACTIVE`;

      const commitRes = await fetch(`${BASE_URL}/api/admin/members/import/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          content: csvContent,
          format: 'csv',
          mode: 'UPSERT',
        }),
      });
      assert.strictEqual(commitRes.status, 200);

      const auditRes = await fetch(
        `${BASE_URL}/api/admin/audit-logs?action=BULK_IMPORT&limit=5`,
        { headers: { Cookie: sessionCookie } }
      );
      assert.strictEqual(auditRes.status, 200);
      const auditJson = await auditRes.json();
      assert.ok(auditJson.data.length > 0);
      const bulkLog = auditJson.data[0];

      assert.strictEqual(bulkLog.action, 'BULK_IMPORT');
      assert.ok(bulkLog.entity_type === 'MEMBER' || bulkLog.entity_type === 'bulk_import');
      assert.strictEqual(bulkLog.details?.format, 'csv');
      assert.strictEqual(bulkLog.details?.mode, 'UPSERT');
      assert.strictEqual(bulkLog.details?.createdCount, 2);
    });

    // --- Test Group 6: Sensitive Data Sanitization & Zero Leakage ---
    console.log('\n--- Test Group 6: Sensitive Data Sanitization & Zero Leakage ---');

    await it('Zero credential or token leakage across all audit records', async () => {
      const allLogs = auditLogsRepository.findPaginated({ limit: 100 });
      for (const log of allLogs.items) {
        const fullString = JSON.stringify(log);
        assert.doesNotMatch(
          fullString,
          /"password"/i,
          `Log ${log.id} must not contain password keys`
        );
        assert.doesNotMatch(
          fullString,
          /argon2/i,
          `Log ${log.id} must not contain password hash`
        );
        assert.doesNotMatch(
          fullString,
          /session_token/i,
          `Log ${log.id} must not contain session token`
        );
        assert.doesNotMatch(
          fullString,
          /data:image\//i,
          `Log ${log.id} must not contain raw base64 data URI`
        );
      }
    });

    // --- Test Group 7: Filtering, Pagination and Search ---
    console.log('\n--- Test Group 7: Filtering, Pagination and Search ---');

    await it('Filters audit logs by action accurately', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/audit-logs?action=MEMBER_UPDATED`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 0);
      for (const item of json.data) {
        assert.strictEqual(item.action, 'MEMBER_UPDATED');
      }
    });

    await it('Filters audit logs by entityType accurately', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/audit-logs?entityType=SITE_SETTINGS`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 0);
      for (const item of json.data) {
        assert.strictEqual(item.entity_type, 'SITE_SETTINGS');
      }
    });

    await it('Searches audit logs by keyword', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/audit-logs?search=Security`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.length > 0);
    });

    await it('Paginates audit logs with valid metadata', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/audit-logs?page=1&limit=2`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.length, 2);
      assert.ok(json.meta);
      assert.strictEqual(json.meta.page, 1);
      assert.strictEqual(json.meta.limit, 2);
      assert.ok(json.meta.total >= 2);
      assert.ok(json.meta.totalPages >= 1);
    });

    // --- Test Group 8: Public Website & E-ID System Isolation ---
    console.log('\n--- Test Group 8: Public Website & E-ID System Isolation ---');

    await it('Public member directory remains fully functional', async () => {
      const res = await fetch(`${BASE_URL}/api/members`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.data));
    });

    await it('Public E-ID card lookup remains fully functional', async () => {
      const res = await fetch(`${BASE_URL}/api/eid/members/NX-001`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.uniqueId, 'NX-001');
    });

  } finally {
    db.exec(`
      DELETE FROM members 
      WHERE name LIKE 'Audit%' 
         OR email LIKE '%audit%';
    `);
    server.close();
  }

  console.log('\n===================================================');
  console.log(`  AUDIT LOG TESTS COMPLETE: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('===================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error during test suite execution:', err);
  if (server) server.close();
  process.exit(1);
});
