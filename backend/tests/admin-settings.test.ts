import assert from 'node:assert';
import { createApp } from '../app.ts';
import type { Server } from 'http';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';
import { membersService } from '../services/members.service.ts';
import { settingsService } from '../services/settings.service.ts';

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
console.log('  NEXUS ADMIN SETTINGS SYSTEM: E2E TEST SUITE (PHASE 13)');
console.log('===================================================================');

const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';
const app = createApp();
const PORT = 3903;
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

    await it('GET /api/admin/settings returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/settings`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    await it('PATCH /api/admin/settings returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { site_name: 'Hacked Name' } }),
      });
      assert.strictEqual(res.status, 401);
    });

    // --- Test Group 2: Authenticated Session Setup ---
    console.log('\n--- Test Group 2: Authenticated Session Setup ---');

    await it('POST /api/admin/auth/login establishes valid super admin session', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword }),
      });
      assert.strictEqual(res.status, 200);
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie);
      sessionCookie = setCookie.split(';')[0];
    });

    // --- Test Group 3: Settings Load & Schema Metadata ---
    console.log('\n--- Test Group 3: Settings Load & Schema Metadata ---');

    await it('GET /api/admin/settings returns complete settings dictionary and schema metadata', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data);
      assert.ok(json.data.settings);
      assert.ok(json.data.schema);

      const s = json.data.settings;
      assert.strictEqual(typeof s.site_name, 'string');
      assert.strictEqual(typeof s.tagline, 'string');
      assert.strictEqual(typeof s.contact_email, 'string');
      assert.strictEqual(typeof s.member_id_prefix, 'string');
      assert.strictEqual(typeof s.maintenance_mode, 'boolean');

      const prefixSchema = json.data.schema.find((item: any) => item.key === 'member_id_prefix');
      assert.ok(prefixSchema);
      assert.strictEqual(prefixSchema.type, 'string');
      assert.strictEqual(prefixSchema.defaultValue, 'NX-');
    });

    await it('GET /api/admin/site-settings backward compatibility alias functions identically', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/site-settings`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.settings);
      assert.strictEqual(json.data.settings.site_name, 'NEXUS');
    });

    // --- Test Group 4: Valid Setting Updates ---
    console.log('\n--- Test Group 4: Valid Setting Updates ---');

    await it('PATCH /api/admin/settings successfully updates valid settings', async () => {
      const updatePayload = {
        settings: {
          site_name: 'NEXUS Tech Club',
          tagline: 'Student Innovation and Engineering Hub',
          contact_email: 'hello@nexus.campus',
          public_identity_label: 'NEXUS // VERIFIED ID',
        },
      };

      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(updatePayload),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.updatedKeys.includes('site_name'));
      assert.ok(json.data.updatedKeys.includes('tagline'));
      assert.ok(json.data.updatedKeys.includes('contact_email'));
      assert.strictEqual(json.data.settings.site_name, 'NEXUS Tech Club');
      assert.strictEqual(json.data.settings.contact_email, 'hello@nexus.campus');

      // Verify persistence via fresh GET
      const freshRes = await fetch(`${BASE_URL}/api/admin/settings`, {
        headers: { Cookie: sessionCookie },
      });
      const freshJson = await freshRes.json();
      assert.strictEqual(freshJson.data.settings.site_name, 'NEXUS Tech Club');
    });

    // --- Test Group 5: Validation, Type Checking & Rejection of Bad Payloads ---
    console.log('\n--- Test Group 5: Validation, Type Checking & Rejection of Bad Payloads ---');

    await it('Rejects unrecognized / unauthorized setting keys', async () => {
      const badPayload = {
        settings: {
          admin_password: 'new_secret_password',
          cloudinary_api_secret: 'leaked_secret',
        },
      };

      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(badPayload),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'INVALID_SETTING_KEY');
    });

    await it('Rejects invalid contact_email format', async () => {
      const badPayload = {
        settings: {
          contact_email: 'not-an-email-address',
        },
      };

      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(badPayload),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'SETTINGS_VALIDATION_FAILED');
    });

    await it('Rejects invalid member_id_prefix format', async () => {
      const badPayload = {
        settings: {
          member_id_prefix: '123_invalid',
        },
      };

      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(badPayload),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'SETTINGS_VALIDATION_FAILED');
    });

    await it('Rejects invalid maintenance_mode boolean type', async () => {
      const badPayload = {
        settings: {
          maintenance_mode: 'not_a_boolean',
        },
      };

      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(badPayload),
      });

      assert.strictEqual(res.status, 400);
    });

    // --- Test Group 6: Deterministic Fallback Defaults ---
    console.log('\n--- Test Group 6: Deterministic Fallback Defaults ---');

    await it('Provides fallback default when database row is absent or null', () => {
      const defaultPrefix = settingsService.getSetting<string>('member_id_prefix');
      assert.ok(defaultPrefix.length >= 3);
      assert.strictEqual(settingsService.getSetting<boolean>('maintenance_mode'), false);
    });

    // --- Test Group 7: Audit Log Recording on Mutation ---
    console.log('\n--- Test Group 7: Audit Log Recording on Mutation ---');

    await it('Records SETTINGS_CHANGED in audit log with before/after state capture', async () => {
      const updatePayload = {
        settings: {
          site_name: 'NEXUS Audit Tested',
        },
      };

      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(updatePayload),
      });
      assert.strictEqual(res.status, 200);

      const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?action=SETTINGS_CHANGED&limit=5`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(auditRes.status, 200);
      const auditJson = await auditRes.json();
      assert.ok(auditJson.data.length > 0);

      const log = auditJson.data[0];
      assert.strictEqual(log.action, 'SETTINGS_CHANGED');
      assert.strictEqual(log.entity_type, 'SITE_SETTINGS');
      assert.strictEqual(log.entity_id, 'global');
      assert.ok(log.before_json);
      assert.ok(log.after_json);
      assert.strictEqual(log.after_json.site_name, 'NEXUS Audit Tested');
      assert.strictEqual(log.admin_name, 'NEXUS Super Administrator');
    });

    // --- Test Group 8: Runtime Consumer Reflection ---
    console.log('\n--- Test Group 8: Runtime Consumer Reflection ---');

    await it('Consumer 1: member_id_prefix changes alter getNextUniqueId generation', async () => {
      // Set prefix to 'NEX-'
      const patchRes = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ settings: { member_id_prefix: 'NEX-' } }),
      });
      assert.strictEqual(patchRes.status, 200);

      const nextId = membersService.getNextUniqueId();
      assert.ok(nextId.startsWith('NEX-'), `Next generated ID must use prefix NEX- but got ${nextId}`);

      // Restore prefix to 'NX-'
      await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ settings: { member_id_prefix: 'NX-' } }),
      });
    });

    await it('Consumer 2: maintenance_mode pauses public recruitment applications with 503', async () => {
      // 1. Enable maintenance mode
      const patchRes = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ settings: { maintenance_mode: true } }),
      });
      assert.strictEqual(patchRes.status, 200);

      // 2. Attempt public recruitment submission
      const applyRes = await fetch(`${BASE_URL}/api/recruitment/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Test Candidate',
          email: 'candidate@college.edu',
          phone: '+1 555-0199',
          primaryDomain: 'Engineering',
          statementOfIntent: 'Interested in joining.',
        }),
      });

      assert.strictEqual(applyRes.status, 503, 'Must return HTTP 503 when maintenance_mode is enabled');
      const applyJson = await applyRes.json();
      assert.strictEqual(applyJson.error.code, 'MAINTENANCE_MODE');

      // 3. Disable maintenance mode
      await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ settings: { maintenance_mode: false } }),
      });
    });

    await it('Consumer 3: Public GET /api/site-config reflects updated settings without leaking internal keys', async () => {
      await fetch(`${BASE_URL}/api/admin/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          settings: {
            site_name: 'NEXUS Studio',
            tagline: 'Student Innovation and Rapid Prototyping',
          },
        }),
      });

      const publicRes = await fetch(`${BASE_URL}/api/site-config`);
      assert.strictEqual(publicRes.status, 200);
      const publicJson = await publicRes.json();

      assert.strictEqual(publicJson.data.site_name, 'NEXUS Studio');
      assert.strictEqual(publicJson.data.tagline, 'Student Innovation and Rapid Prototyping');

      // Ensure internal-only key member_id_prefix is NOT leaked to public
      assert.strictEqual(publicJson.data.member_id_prefix, undefined);
    });

    // --- Test Group 9: Zero Secret Leakage ---
    console.log('\n--- Test Group 9: Zero Secret Leakage ---');

    await it('Zero secrets or environment variables exposed in admin settings response', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/settings`, {
        headers: { Cookie: sessionCookie },
      });
      const text = await res.text();

      assert.doesNotMatch(text, /argon2/i, 'Must not expose argon2 hashes');
      assert.doesNotMatch(text, /cloudinary_api_secret/i, 'Must not expose Cloudinary API secrets');
      assert.doesNotMatch(text, /password_hash/i, 'Must not expose password hashes');
      assert.doesNotMatch(text, /session_token/i, 'Must not expose session tokens');
    });

  } finally {
    // Restore default site_name
    settingsService.updateSettings({ site_name: 'NEXUS' });
    server.close();
  }

  console.log('\n===================================================');
  console.log(`  SETTINGS TESTS COMPLETE: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
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
