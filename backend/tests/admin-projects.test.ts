import assert from 'node:assert';
import { createApp } from '../app.ts';
import type { Server } from 'http';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';
import { auditLogsRepository } from '../db/repositories/auditLogs.repository.ts';
import { membersRepository } from '../db/repositories/members.repository.ts';

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
console.log('  NEXUS ADMIN PROJECT MANAGEMENT: E2E TEST SUITE (PHASE 15)');
console.log('===================================================================');

const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';
const app = createApp();
const PORT = 3905;
let server: Server;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runSuite() {
  const db = getDatabase();
  seedDatabase(db);

  // Clean up any test project artifacts from previous runs
  db.prepare("DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE slug LIKE '%quantum%' OR slug LIKE '%mesh%' OR slug LIKE '%unreleased%' OR slug LIKE '%custom%' OR id LIKE 'prj-%')").run();
  db.prepare("DELETE FROM projects WHERE slug LIKE '%quantum%' OR slug LIKE '%mesh%' OR slug LIKE '%unreleased%' OR slug LIKE '%custom%' OR id LIKE 'prj-%'").run();

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  let sessionCookie = '';
  let testMemberId = '';
  let createdProjectId = '';
  let customSlugProjectId = '';

  try {
    // --- Setup: Fetch an existing member to use for project membership tests ---
    const allMembers = membersRepository.findAll({ limit: 5 });
    if (allMembers.length > 0) {
      testMemberId = allMembers[0].id;
    }

    // --- Test Group 1: Unauthenticated Endpoint Protection ---
    console.log('\n--- Test Group 1: Unauthenticated Endpoint Protection ---');

    await it('GET /api/admin/projects returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    await it('POST /api/admin/projects returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Unauthorized Project', category: 'Technology' }),
      });
      assert.strictEqual(res.status, 401);
    });

    await it('PATCH /api/admin/projects/:id returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/any-id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hacked Title' }),
      });
      assert.strictEqual(res.status, 401);
    });

    await it('DELETE /api/admin/projects/:id returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/any-id`, {
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 401);
    });

    // --- Test Group 2: Admin Authentication ---
    console.log('\n--- Test Group 2: Admin Authentication ---');

    await it('POST /api/admin/auth/login succeeds and provides session cookie', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword }),
      });
      assert.strictEqual(res.status, 200);
      const rawCookie = res.headers.get('set-cookie');
      assert.ok(rawCookie && rawCookie.includes('nexus_admin_session='));
      sessionCookie = rawCookie.split(';')[0];
    });

    // --- Test Group 3: Input Validation & Project Creation ---
    console.log('\n--- Test Group 3: Input Validation & Project Creation ---');

    await it('POST /api/admin/projects rejects invalid payload (missing title)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ category: 'Technology', short_description: 'Valid summary' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    });

    await it('POST /api/admin/projects rejects malicious URL protocol (javascript:)', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          title: 'XSS Attack Project',
          category: 'Technology',
          live_url: 'javascript:alert(1)',
        }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.message.includes('Invalid live_url URL format'));
    });

    await it('POST /api/admin/projects creates project with auto-generated slug', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          title: 'Quantum Simulator Core',
          category: 'Research & Software',
          disciplines: 'PHYSICS × COMPUTING',
          short_description: 'An advanced quantum wave function simulator for campus research.',
          full_description: 'Full markdown documentation of the quantum simulator core library.',
          status: 'Draft',
          technologies: ['Rust', 'WebAssembly', 'WebGL'],
          deliverables: ['Simulation Engine', 'WASM Module'],
          repository_url: 'https://github.com/nexus-club/quantum-core',
          live_url: 'https://quantum.nexus.dev',
        }),
      });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(json.data.id);
      assert.strictEqual(json.data.title, 'Quantum Simulator Core');
      assert.strictEqual(json.data.slug, 'quantum-simulator-core');
      assert.strictEqual(json.data.status, 'Draft');
      assert.strictEqual(json.data.featured, false);
      createdProjectId = json.data.id;
    });

    await it('POST /api/admin/projects creates project with explicit custom slug', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          title: 'Nexus Decentralized Mesh',
          slug: 'custom-mesh-node',
          category: 'Physical Computing',
          short_description: 'Campus mesh nodes for low latency sensor networks.',
          status: 'Published',
        }),
      });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.data.slug, 'custom-mesh-node');
      assert.strictEqual(json.data.status, 'Published');
      assert.ok(json.data.published_at);
      customSlugProjectId = json.data.id;
    });

    await it('POST /api/admin/projects rejects duplicate slug with 409 Conflict', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          title: 'Another Project With Same Slug',
          slug: 'custom-mesh-node',
          category: 'Technology',
        }),
      });
      assert.strictEqual(res.status, 409);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'SLUG_CONFLICT');
    });

    // --- Test Group 4: Project Retrieval & Administration Listing ---
    console.log('\n--- Test Group 4: Project Retrieval & Administration Listing ---');

    await it('GET /api/admin/projects lists projects with pagination and filters', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects?q=Quantum&limit=10`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(Array.isArray(json.data));
      const found = json.data.find((p: any) => p.id === createdProjectId);
      assert.ok(found);
      assert.strictEqual(found.title, 'Quantum Simulator Core');
    });

    await it('GET /api/admin/projects/:id returns full project detail', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.data.id, createdProjectId);
      assert.strictEqual(json.data.slug, 'quantum-simulator-core');
    });

    // --- Test Group 5: Updates, Slug Stability & Concurrency ---
    console.log('\n--- Test Group 5: Updates, Slug Stability & Concurrency ---');

    await it('PATCH /api/admin/projects/:id updates title without altering existing slug', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          title: 'Quantum Simulator Core (Renamed)',
          short_description: 'Updated short description text.',
        }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.data.title, 'Quantum Simulator Core (Renamed)');
      // Slug should remain stable unless explicitly updated
      assert.strictEqual(json.data.slug, 'quantum-simulator-core');
      assert.strictEqual(json.data.short_description, 'Updated short description text.');
    });

    await it('PATCH /api/admin/projects/:id rejects conflicting expected_updated_at', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          title: 'Stale Update Attempt',
          expected_updated_at: '2020-01-01T00:00:00.000Z',
        }),
      });
      assert.strictEqual(res.status, 409);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'CONCURRENCY_CONFLICT');
    });

    // --- Test Group 6: Status Lifecycle & Featured Toggle ---
    console.log('\n--- Test Group 6: Status Lifecycle & Featured Toggle ---');

    await it('PATCH /api/admin/projects/:id/status publishes a draft project', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'Published' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.data.status, 'Published');
      assert.ok(json.data.published_at);
    });

    await it('PATCH /api/admin/projects/:id/featured toggles featured flag', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}/featured`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ featured: true }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.data.featured, true);
    });

    await it('PATCH /api/admin/projects/:id/status unpublishes back to Draft', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'Draft' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.data.status, 'Draft');
      assert.strictEqual(json.data.published_at, null);
    });

    await it('PATCH /api/admin/projects/:id/status archives project', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'Archived' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.data.status, 'Archived');
    });

    // Re-publish created project so we can test public APIs
    await it('PATCH /api/admin/projects/:id/status re-publishes project', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ status: 'Published' }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'Published');
    });

    // --- Test Group 7: Member Association & Junction Operations ---
    console.log('\n--- Test Group 7: Member Association & Junction Operations ---');

    if (testMemberId) {
      await it('POST /api/admin/projects/:id/members associates member to project', async () => {
        const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}/members`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: sessionCookie,
          },
          body: JSON.stringify({
            member_id: testMemberId,
            role: 'Lead Quantum Architect',
          }),
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.error, null);
        assert.ok(Array.isArray(json.data));
        const match = json.data.find((m: any) => m.member_id === testMemberId);
        assert.ok(match);
        assert.strictEqual(match.role, 'Lead Quantum Architect');
      });

      await it('PUT /api/admin/projects/:id/members syncs member list atomically', async () => {
        const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}/members`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: sessionCookie,
          },
          body: JSON.stringify({
            members: [
              { member_id: testMemberId, role: 'Principal Investigator' },
            ],
          }),
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.error, null);
        assert.strictEqual(json.data.length, 1);
        assert.strictEqual(json.data[0].role, 'Principal Investigator');
      });
    }

    // --- Test Group 8: Public API Visibility Isolation ---
    console.log('\n--- Test Group 8: Public API Visibility Isolation ---');

    // Create a draft project to verify it stays hidden from public API
    let draftOnlyId = '';
    const draftRes = await fetch(`${BASE_URL}/api/admin/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        title: 'Secret Unreleased Project',
        category: 'Technology',
        status: 'Draft',
      }),
    });
    const draftJson = await draftRes.json();
    draftOnlyId = draftJson.data.id;

    await it('GET /api/projects returns published projects and excludes drafts', async () => {
      const res = await fetch(`${BASE_URL}/api/projects?limit=50`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(Array.isArray(json.data));

      // Should include created published project
      const publishedMatch = json.data.find((p: any) => p.id === createdProjectId);
      assert.ok(publishedMatch, 'Published project should be present in public list');

      // Should EXCLUDE draft project
      const draftMatch = json.data.find((p: any) => p.id === draftOnlyId);
      assert.strictEqual(draftMatch, undefined, 'Draft project must NOT appear in public listing');
    });

    await it('GET /api/projects/:slug returns published project by slug with team members', async () => {
      const res = await fetch(`${BASE_URL}/api/projects/quantum-simulator-core`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.strictEqual(json.data.id, createdProjectId);
      assert.strictEqual(json.data.slug, 'quantum-simulator-core');
      if (testMemberId) {
        assert.ok(Array.isArray(json.data.members));
        assert.ok(json.data.members.length > 0);
      }
    });

    await it('GET /api/projects/:slug returns 404 for draft project', async () => {
      const res = await fetch(`${BASE_URL}/api/projects/secret-unreleased-project`);
      assert.strictEqual(res.status, 404);
    });

    // --- Test Group 9: Media Upload Validation ---
    console.log('\n--- Test Group 9: Media Upload Validation ---');

    await it('POST /api/admin/projects/:id/image rejects non-image payload', async () => {
      const boundary = '----WebKitFormBoundaryTest123';
      const fakeExecutable = Buffer.from('MZ\x90\x00\x03\x00\x00\x00FakeExePayload');
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="payload.exe"\r\nContent-Type: application/octet-stream\r\n\r\n`),
        fakeExecutable,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Cookie: sessionCookie,
        },
        body,
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.message.includes('file') || json.error.message.includes('image') || json.error.code === 'VALIDATION_ERROR');
    });

    // --- Test Group 10: Audit Log Verification ---
    console.log('\n--- Test Group 10: Audit Log Verification ---');

    await it('Audit log contains records for project lifecycle operations', async () => {
      const { items: logs } = auditLogsRepository.findPaginated({ limit: 50 });
      assert.ok(logs.length > 0);

      const createdLog = logs.find((l) => l.action === 'PROJECT_CREATED' && l.entity_id === createdProjectId);
      assert.ok(createdLog, 'Audit log must record PROJECT_CREATED');

      const updatedLog = logs.find((l) => l.action === 'PROJECT_UPDATED' && l.entity_id === createdProjectId);
      assert.ok(updatedLog, 'Audit log must record PROJECT_UPDATED');

      const statusLog = logs.find((l) => l.action === 'PROJECT_PUBLISHED' && l.entity_id === createdProjectId);
      assert.ok(statusLog, 'Audit log must record PROJECT_PUBLISHED');

      const featuredLog = logs.find((l) => l.action === 'PROJECT_FEATURED' && l.entity_id === createdProjectId);
      assert.ok(featuredLog, 'Audit log must record PROJECT_FEATURED');
    });

    // --- Test Group 11: Deletion & Cleanup Cascade ---
    console.log('\n--- Test Group 11: Deletion & Cleanup Cascade ---');

    await it('DELETE /api/admin/projects/:id deletes project and cascades member records', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}`, {
        method: 'DELETE',
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);

      // Verify project is no longer accessible in admin
      const checkRes = await fetch(`${BASE_URL}/api/admin/projects/${createdProjectId}`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(checkRes.status, 404);

      // Verify deletion is recorded in audit log
      const { items: logs } = auditLogsRepository.findPaginated({ limit: 10 });
      const deleteLog = logs.find((l) => l.action === 'PROJECT_DELETED' && l.entity_id === createdProjectId);
      assert.ok(deleteLog, 'Audit log must record PROJECT_DELETED');
    });

  } finally {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  }

  console.log('===================================================================');
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('===================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
