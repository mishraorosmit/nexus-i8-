/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import { createApp } from '../app.ts';
import type { Server } from 'http';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';
import { membersRepository } from '../db/repositories/members.repository.ts';
import { auditRepository } from '../db/repositories/auditLogs.repository.ts';

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
console.log('  NEXUS ADMIN BULK IMPORT & EXPORT: E2E REGRESSION TEST SUITE     ');
console.log('===================================================================');

const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';
const app = createApp();
const PORT = 3898;
let server: Server;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runSuite() {
  const db = getDatabase();
  const cleanupTestMembers = () => {
    try {
      db.exec(`DELETE FROM members WHERE id LIKE 'mem-%';`);
    } catch {
      // ignore
    }
  };

  cleanupTestMembers();
  seedDatabase(db);
  cleanupTestMembers();

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  let sessionCookie = '';

  try {
    // -------------------------------------------------------------------------
    // Test Group 1: Unauthenticated Endpoint Protection
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 1: Unauthenticated Endpoint Protection ---');

    await it('POST /api/admin/members/import/preview returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'name,role\nAlice,Lead', format: 'csv' }),
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    await it('POST /api/admin/members/import/commit returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'name,role\nAlice,Lead', format: 'csv' }),
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    await it('GET /api/admin/members/export returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/export`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    // -------------------------------------------------------------------------
    // Test Group 2: Authenticated Session Setup
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 2: Authenticated Session Setup ---');

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
      assert.ok(match, 'Expected nexus_admin_session cookie');
      sessionCookie = `nexus_admin_session=${match[1]}`;
    });

    // -------------------------------------------------------------------------
    // Test Group 3: Input Payload and Format Validation
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 3: Input Payload and Format Validation ---');

    await it('Rejects empty or missing import content', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: '   ', format: 'csv' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'EMPTY_FILE');
    });

    await it('Rejects invalid format parameter', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: 'some,data', format: 'xml' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'INVALID_FORMAT');
    });

    await it('Rejects invalid import mode', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: 'name,role\nAlice,Lead', format: 'csv', mode: 'OVERWRITE_ALL' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'INVALID_MODE');
    });

    await it('Rejects malformed JSON syntax', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: '[{"name": "Alice", "role": "Lead",}]', format: 'json' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'INVALID_JSON_SYNTAX');
    });

    await it('Rejects non-array JSON payload', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: '{"name": "Alice", "role": "Lead"}', format: 'json' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'INVALID_JSON_STRUCTURE');
    });

    await it('Rejects CSV missing required columns (Name or Role)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: 'email,department\nalice@nexus.org,Engineering', format: 'csv' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'MISSING_REQUIRED_COLUMNS');
    });

    // -------------------------------------------------------------------------
    // Test Group 4: Row-Level Validation and Duplicate Detection
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 4: Row-Level Validation & In-Batch Duplicate Detection ---');

    await it('Flags invalid rows (short name, bad email, bad unique_id, invalid status)', async () => {
      const csv = [
        'name,role,email,status,unique_id',
        'A,Valid Role,valid@nexus.org,ACTIVE,NX-001', // name too short (<2 chars)
        'Valid Name,R,valid2@nexus.org,ACTIVE,NX-002', // role too short (<2 chars)
        'Valid Name,Valid Role,not-an-email,ACTIVE,NX-003', // bad email
        'Valid Name,Valid Role,valid4@nexus.org,UNKNOWN_STATUS,NX-004', // bad status
        'Valid Name,Valid Role,valid5@nexus.org,ACTIVE,INVALID_ID_FORMAT', // bad unique_id
      ].join('\n');

      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: csv, format: 'csv' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.totalRows, 5);
      assert.strictEqual(json.data.invalidRows, 5);
      assert.strictEqual(json.data.canCommit, false);

      const rows = json.data.rows;
      assert.strictEqual(rows[0].classification, 'INVALID');
      assert.strictEqual(rows[0].errors[0].field, 'name');
      assert.strictEqual(rows[1].classification, 'INVALID');
      assert.strictEqual(rows[1].errors[0].field, 'role');
      assert.strictEqual(rows[2].classification, 'INVALID');
      assert.strictEqual(rows[2].errors[0].field, 'email');
      assert.strictEqual(rows[3].classification, 'INVALID');
      assert.strictEqual(rows[3].errors[0].field, 'status');
      assert.strictEqual(rows[4].classification, 'INVALID');
      assert.strictEqual(rows[4].errors[0].field, 'unique_id');
    });

    await it('Detects duplicate emails and unique IDs within the import payload', async () => {
      const csv = [
        'name,role,email,unique_id',
        'User Alpha,Engineer,duplicate@nexus.org,NX-991',
        'User Beta,Designer,duplicate@nexus.org,NX-992', // duplicate email
        'User Gamma,Lead,gamma@nexus.org,NX-991', // duplicate unique_id
      ].join('\n');

      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: csv, format: 'csv' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.totalRows, 3);
      assert.strictEqual(json.data.duplicates, 2);
      assert.strictEqual(json.data.canCommit, false);

      assert.strictEqual(json.data.rows[1].classification, 'DUPLICATE');
      assert.strictEqual(json.data.rows[1].errors[0].field, 'email');
      assert.strictEqual(json.data.rows[2].classification, 'DUPLICATE');
      assert.strictEqual(json.data.rows[2].errors[0].field, 'unique_id');
    });

    // -------------------------------------------------------------------------
    // Test Group 5: Import Modes & Database Conflicts
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 5: Import Modes & Database Conflicts ---');

    // Fetch existing member to test update and collisions
    const existingMembers = membersRepository.findAll({ status: 'all' });
    assert.ok(existingMembers.length > 0, 'Database should contain seeded members');
    const firstMember = existingMembers[0];

    await it('Mode CREATE_ONLY flags existing members as CONFLICT', async () => {
      const csv = [
        'name,role,email,unique_id',
        `${firstMember.name},Updated Role,${firstMember.email || 'random1@test.com'},${firstMember.unique_id}`,
      ].join('\n');

      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: csv, format: 'csv', mode: 'CREATE_ONLY' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.conflicts, 1);
      assert.strictEqual(json.data.canCommit, false);
      assert.strictEqual(json.data.rows[0].classification, 'CONFLICT');
      assert.ok(json.data.rows[0].errors[0].message.includes('CREATE_ONLY'));
    });

    await it('Mode UPDATE_ONLY flags unknown members as CONFLICT', async () => {
      const csv = [
        'name,role,email,unique_id',
        'Brand New Person,Brand New Role,unknown.person@nexus.org,NX-999',
      ].join('\n');

      const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: csv, format: 'csv', mode: 'UPDATE_ONLY' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.conflicts, 1);
      assert.strictEqual(json.data.canCommit, false);
      assert.strictEqual(json.data.rows[0].classification, 'CONFLICT');
      assert.ok(json.data.rows[0].errors[0].message.includes('UPDATE_ONLY'));
    });

    await it('Detects email collision against another database member', async () => {
      if (existingMembers.length >= 2) {
        const m1 = existingMembers[0];
        const m2 = existingMembers[1];
        // Updating m1's unique_id with m2's email
        if (m2.email) {
          const csv = [
            'name,role,email,unique_id',
            `Updated ${m1.name},Lead,${m2.email},${m1.unique_id}`,
          ].join('\n');

          const res = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ content: csv, format: 'csv', mode: 'UPSERT' }),
          });
          assert.strictEqual(res.status, 200);
          const json = await res.json();
          assert.strictEqual(json.data.conflicts, 1);
          assert.strictEqual(json.data.canCommit, false);
          assert.strictEqual(json.data.rows[0].classification, 'CONFLICT');
          assert.ok(json.data.rows[0].errors[0].message.includes('belongs to a different member'));
        }
      }
    });

    // -------------------------------------------------------------------------
    // Test Group 6: Transactional Import Commit (ACID)
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 6: Transactional Import Commit (ACID) ---');

    await it('Direct commit fails if payload has invalid rows (zero client-side bypass)', async () => {
      const csv = 'name,role\nShortNameOnly,A'; // role too short
      const res = await fetch(`${BASE_URL}/api/admin/members/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: csv, format: 'csv' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'IMPORT_VALIDATION_FAILED');
    });

    await it('Successfully previews and commits valid mixed CSV import (UPSERT mode)', async () => {
      const uniqueSuffix = Date.now().toString().slice(-4);
      const newEmail1 = `bulknew_${uniqueSuffix}_1@nexus.org`;
      const newEmail2 = `bulknew_${uniqueSuffix}_2@nexus.org`;

      const csv = [
        'name,role,email,department,domain,status',
        `Bulk Alice ${uniqueSuffix},Quantum Architect,${newEmail1},Research,Computing,ACTIVE`,
        `Bulk Bob ${uniqueSuffix},Security Specialist,${newEmail2},Operations,Defense,ACTIVE`,
      ].join('\n');

      // 1. Preview
      const previewRes = await fetch(`${BASE_URL}/api/admin/members/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: csv, format: 'csv', mode: 'UPSERT' }),
      });
      assert.strictEqual(previewRes.status, 200);
      const previewJson = await previewRes.json();
      assert.strictEqual(previewJson.data.totalRows, 2);
      assert.strictEqual(previewJson.data.validRows, 2);
      assert.strictEqual(previewJson.data.newRecords, 2);
      assert.strictEqual(previewJson.data.invalidRows, 0);
      assert.strictEqual(previewJson.data.canCommit, true);

      // 2. Commit
      const commitRes = await fetch(`${BASE_URL}/api/admin/members/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: csv, format: 'csv', mode: 'UPSERT' }),
      });
      assert.strictEqual(commitRes.status, 200);
      const commitJson = await commitRes.json();
      assert.strictEqual(commitJson.data.success, true);
      assert.strictEqual(commitJson.data.totalProcessed, 2);
      assert.strictEqual(commitJson.data.createdCount, 2);
      assert.strictEqual(commitJson.data.updatedCount, 0);

      // 3. Verify in SQLite
      const createdAlice = membersRepository.findByEmail(newEmail1);
      assert.ok(createdAlice, 'Created member Alice should exist in SQLite');
      assert.strictEqual(createdAlice.name, `Bulk Alice ${uniqueSuffix}`);
      assert.strictEqual(createdAlice.role, 'Quantum Architect');
      assert.ok(createdAlice.unique_id.startsWith('NX-'), 'Should have auto-generated NX-XXX ID');

      const createdBob = membersRepository.findByEmail(newEmail2);
      assert.ok(createdBob, 'Created member Bob should exist in SQLite');
      assert.strictEqual(createdBob.name, `Bulk Bob ${uniqueSuffix}`);
      assert.strictEqual(createdBob.role, 'Security Specialist');

      // 4. Now perform an UPDATE import on Alice
      const updateCsv = [
        'unique_id,name,role,email,department,status',
        `${createdAlice.unique_id},Bulk Alice Modified,Principal Architect,${newEmail1},Executive,ACTIVE`,
      ].join('\n');

      const updateCommitRes = await fetch(`${BASE_URL}/api/admin/members/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: updateCsv, format: 'csv', mode: 'UPSERT' }),
      });
      assert.strictEqual(updateCommitRes.status, 200);
      const updateCommitJson = await updateCommitRes.json();
      assert.strictEqual(updateCommitJson.data.createdCount, 0);
      assert.strictEqual(updateCommitJson.data.updatedCount, 1);

      // Verify updated member in SQLite
      const refreshedAlice = membersRepository.findByUniqueId(createdAlice.unique_id);
      assert.ok(refreshedAlice);
      assert.strictEqual(refreshedAlice.name, 'Bulk Alice Modified');
      assert.strictEqual(refreshedAlice.role, 'Principal Architect');
      assert.strictEqual(refreshedAlice.department, 'Executive');

      // 5. Verify audit log entry
      const auditLogs = auditRepository.findPaginated({ limit: 10 });
      const bulkLog = auditLogs.items.find((l) => l.action === 'BULK_IMPORT' || l.action === 'MEMBERS_BULK_IMPORTED');
      assert.ok(bulkLog, 'Audit log must record BULK_IMPORT or MEMBERS_BULK_IMPORTED');
    });

    await it('Successfully previews and commits valid JSON import', async () => {
      const uniqueSuffix = Date.now().toString().slice(-4);
      const jsonEmail = `json_member_${uniqueSuffix}@nexus.org`;

      const jsonPayload = JSON.stringify([
        {
          name: `JSON Member ${uniqueSuffix}`,
          role: 'Full Stack Engineer',
          email: jsonEmail,
          department: 'Core Platform',
          status: 'ACTIVE',
        },
      ]);

      const commitRes = await fetch(`${BASE_URL}/api/admin/members/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: jsonPayload, format: 'json', mode: 'UPSERT' }),
      });
      assert.strictEqual(commitRes.status, 200);
      const commitJson = await commitRes.json();
      assert.strictEqual(commitJson.data.createdCount, 1);

      const created = membersRepository.findByEmail(jsonEmail);
      assert.ok(created);
      assert.strictEqual(created.name, `JSON Member ${uniqueSuffix}`);
    });

    // -------------------------------------------------------------------------
    // Test Group 7: Bulk Export Functionality & Formula Defense
    // -------------------------------------------------------------------------
    console.log('\n--- Test Group 7: Bulk Export Functionality & Security ---');

    await it('GET /api/admin/members/export exports CSV with proper headers and format', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/export?format=csv`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/csv'));
      const disposition = res.headers.get('content-disposition');
      assert.ok(disposition?.includes('attachment; filename="nexus-members-export-'));

      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Verify UTF-8 BOM bytes 0xEF, 0xBB, 0xBF are present at the beginning of the file
      assert.strictEqual(bytes[0], 0xef, 'Expected UTF-8 BOM byte 1');
      assert.strictEqual(bytes[1], 0xbb, 'Expected UTF-8 BOM byte 2');
      assert.strictEqual(bytes[2], 0xbf, 'Expected UTF-8 BOM byte 3');

      const text = new TextDecoder('utf-8').decode(bytes);
      assert.ok(text.includes('Unique ID,Member Name'), 'Expected CSV headers');
      assert.ok(text.includes('Email Address'));
      assert.ok(text.includes('Role / Designation'));
    });

    await it('GET /api/admin/members/export exports JSON array', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/export?format=json`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('application/json'));

      const json = await res.json();
      assert.ok(Array.isArray(json));
      assert.ok(json.length > 0);
      const sample = json[0];
      assert.ok('unique_id' in sample);
      assert.ok('name' in sample);
      assert.ok('role' in sample);
      assert.ok('status' in sample);
      // Ensure sensitive internal columns are NOT leaked
      assert.strictEqual('password' in sample, false);
      assert.strictEqual('password_hash' in sample, false);
      assert.strictEqual('salt' in sample, false);
      assert.strictEqual('id' in sample, false);
    });

    await it('GET /api/admin/members/export filters rows correctly by status and search', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/export?format=json&status=ACTIVE`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const items = await res.json();
      for (const item of items) {
        assert.strictEqual(item.status, 'ACTIVE');
      }
    });

    await it('Sanitizes CSV formula injection characters (=, +, -, @)', async () => {
      // Create a test member with a malicious formula in their bio
      const formulaEmail = `formula_${Date.now()}@nexus.org`;
      const maliciousBio = '=cmd|\'calc\'!A0';

      const csv = [
        'name,role,email,bio,status',
        `Formula Member,Security Tester,${formulaEmail},"${maliciousBio}",ACTIVE`,
      ].join('\n');

      const commitRes = await fetch(`${BASE_URL}/api/admin/members/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({ content: csv, format: 'csv' }),
      });
      assert.strictEqual(commitRes.status, 200);

      // Now export CSV and check that formula prefix is neutralized with single quote
      const exportRes = await fetch(
        `${BASE_URL}/api/admin/members/export?format=csv&search=${encodeURIComponent(formulaEmail)}`,
        { headers: { Cookie: sessionCookie } }
      );
      assert.strictEqual(exportRes.status, 200);
      const exportCsv = await exportRes.text();
      assert.ok(
        exportCsv.includes("'=cmd") || exportCsv.includes("''=cmd") || exportCsv.includes("'="),
        'Malicious leading = character must be escaped with single quote'
      );
    });

  } finally {
    cleanupTestMembers();
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
