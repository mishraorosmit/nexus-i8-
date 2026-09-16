import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../app.ts';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';
import { membersRepository } from '../db/repositories/members.repository.ts';
import { validateAndImportEidMembers } from '../../scripts/import-eid-members.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runEidTestSuite() {
  console.log('===================================================');
  console.log('  NEXUS E-ID CARD DATABASE & API TEST SUITE        ');
  console.log('===================================================');

  const db = getDatabase();
  db.exec(`
    DELETE FROM members WHERE id NOT IN (
      'team-01', 'team-02', 'team-03', 'team-04', 'team-05', 'team-06', 'team-07', 'team-08',
      'team-content-01', 'team-content-02', 'team-content-03', 'team-content-04', 'team-content-05',
      'team-content-06', 'team-content-07', 'team-content-08', 'team-content-09', 'team-content-10',
      'team-content-11', 'team-content-12', 'team-content-13', 'team-content-14',
      'team-coord-01', 'team-coord-02', 'team-coord-03', 'team-mentor-01'
    );
  `);
  seedDatabase(db);
  validateAndImportEidMembers(undefined, db);

  // Start test server on ephemeral port
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, failureDetails?: any) {
    total++;
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName}`, failureDetails || '');
    }
  }

  async function get(path: string): Promise<{ status: number; body: any }> {
    const res = await fetch(`${baseUrl}${path}`);
    const body = await res.json();
    return { status: res.status, body };
  }

  console.log('\n--- Test Group 1: Database Schema & Index Integrity ---');
  {
    // Check columns
    const columns = db.prepare('PRAGMA table_info(members);').all() as Array<{ name: string }>;
    const colNames = new Set(columns.map((c) => c.name));

    assert(colNames.has('id'), 'members table has column "id"');
    assert(colNames.has('unique_id'), 'members table has column "unique_id"');
    assert(colNames.has('public_id'), 'members table has column "public_id" (slug)');
    assert(colNames.has('name'), 'members table has column "name"');
    assert(colNames.has('display_name'), 'members table has column "display_name"');
    assert(colNames.has('email'), 'members table has column "email"');
    assert(colNames.has('role'), 'members table has column "role"');
    assert(colNames.has('department'), 'members table has column "department"');
    assert(colNames.has('clearance_level'), 'members table has column "clearance_level"');
    assert(colNames.has('special_word'), 'members table has column "special_word"');
    assert(colNames.has('quote'), 'members table has column "quote"');
    assert(colNames.has('node_location'), 'members table has column "node_location"');
    assert(colNames.has('frequency'), 'members table has column "frequency"');
    assert(colNames.has('security_zone'), 'members table has column "security_zone"');
    assert(colNames.has('badge_issue'), 'members table has column "badge_issue"');
    assert(colNames.has('skills'), 'members table has column "skills"');

    // Check unique index on unique_id
    const indexes = db.prepare('PRAGMA index_list(members);').all() as Array<{ name: string; unique: number }>;
    const uniqueIdIndex = indexes.find((idx) => idx.name === 'idx_members_unique_id');
    assert(Boolean(uniqueIdIndex && uniqueIdIndex.unique === 1), 'idx_members_unique_id enforces UNIQUE constraint at database level');

    // Test unique constraint violation
    let threwDuplicateError = false;
    try {
      db.prepare(`
        INSERT INTO members (id, public_id, unique_id, name, role, status, created_at, updated_at)
        VALUES ('test-dup', 'test-dup-slug', 'NX-026', 'Duplicate Test', 'Lead', 'ACTIVE', datetime('now'), datetime('now'))
      `).run();
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        threwDuplicateError = true;
      }
    }
    assert(threwDuplicateError, 'Database strictly rejects duplicate unique_id insertion with UNIQUE constraint failure');
  }

  console.log('\n--- Test Group 2: Public Identifier Stability & Member Data Model ---');
  {
    // Verify NX-026 resolves to Orosmit Mishra
    const orosmit = membersRepository.findByUniqueId('NX-026');
    assert(Boolean(orosmit), 'Member NX-026 exists in database');
    assert(orosmit?.public_id === 'orosmit-mishra', 'Member NX-026 has stable slug "orosmit-mishra"');
    assert(orosmit?.name === 'Orosmit Mishra' || orosmit?.name === 'OROSMIT MISHRA', 'Member NX-026 has authentic name');
    assert(orosmit?.special_word === 'ORCHESTRATOR', 'Member NX-026 has specialWord "ORCHESTRATOR"');

    // Verify NX-001 resolves to Jitesh Raj
    const jitesh = membersRepository.findByUniqueId('NX-001');
    assert(Boolean(jitesh), 'Member NX-001 exists in database');
    assert(jitesh?.public_id === 'jitesh-raj', 'Member NX-001 has slug "jitesh-raj"');

    // Check total count and uniqueness across all members
    const allMembers = membersRepository.findAll({ status: 'all' });
    const assignedUniqueIds = allMembers.map((m) => m.unique_id).filter(Boolean);
    const uniqueSet = new Set(assignedUniqueIds);
    assert(assignedUniqueIds.length >= 26, `All authentic members have an assigned unique_id (${assignedUniqueIds.length}/26+)`);
    assert(uniqueSet.size === assignedUniqueIds.length, 'All assigned unique IDs are 100% distinct and non-repeating');

    // Check ID pattern NX-XXX
    const allMatchPattern = assignedUniqueIds.every((id) => /^NX-\d{3}$/.test(id!));
    assert(allMatchPattern, 'All assigned unique IDs conform strictly to standard "NX-XXX" format');
  }

  console.log('\n--- Test Group 3: Status Support (ACTIVE, INACTIVE, ALUMNI) ---');
  {
    const statuses = ['ACTIVE', 'INACTIVE', 'ALUMNI'];
    for (let idx = 0; idx < statuses.length; idx++) {
      const st = statuses[idx];
      const tempId = `test-status-${st.toLowerCase()}`;
      const tempSlug = `test-status-${st.toLowerCase()}`;
      const tempUniqueId = `NX-9${idx}9`;

      // Ensure any leftover is deleted
      membersRepository.deleteMember(tempId);

      try {
        const created = membersRepository.create({
          id: tempId,
          public_id: tempSlug,
          unique_id: tempUniqueId,
          name: `Test Member ${st}`,
          email: `${tempSlug}@nexus.campus`,
          role: 'Test Role',
          domain: 'Testing',
          department: 'Engineering',
          bio: 'Bio',
          photo_url: null,
          image_position: null,
          social_links: null,
          status: st as any,
          joined_date: '2026-09-01',
        });

        assert(created.status.toUpperCase() === st, `Member status correctly supports ${st}`);

        // Query via E-ID endpoint
        const res = await get(`/api/eid/members/${tempUniqueId}`);
        assert(res.status === 200, `GET /api/eid/members/${tempUniqueId} returns 200 for ${st}`);
        assert(res.body.data.status === st, `E-ID API serializes status as "${st}"`);
      } finally {
        membersRepository.deleteMember(tempId);
      }
    }
  }


  console.log('\n--- Test Group 4: E-ID API Read Endpoints ---');
  {
    // 1. GET /api/eid/members
    const listRes = await get('/api/eid/members');
    assert(listRes.status === 200, 'GET /api/eid/members responds with HTTP 200');
    assert(listRes.body.success === true, 'Response payload has success: true');
    assert(Array.isArray(listRes.body.data), 'Response data is an array of member cards');
    assert(listRes.body.data.length >= 26, `Returned ${listRes.body.data.length} member cards`);

    // Verify card structure
    const sample = listRes.body.data.find((m: any) => m.uniqueId === 'NX-026');
    assert(Boolean(sample), 'List contains NX-026 (Orosmit Mishra)');
    assert(sample.slug === 'orosmit-mishra', 'Card has slug "orosmit-mishra"');
    assert(sample.qrUrl === '/memberID/orosmit-mishra/NX-026', 'Card contains calculated qrUrl "/memberID/orosmit-mishra/NX-026"');
    assert(sample.clearanceLevel === 'LVL-04 // LEAD', 'Card has clearanceLevel "LVL-04 // LEAD"');
    assert(sample.specialWord === 'ORCHESTRATOR', 'Card has specialWord "ORCHESTRATOR"');
    assert(Array.isArray(sample.domain), 'Card has domain as string array');
    assert(Array.isArray(sample.skills), 'Card has skills as string array');
    assert(sample.email === undefined, 'Internal email address is NOT leaked publicly');

    // 2. GET /api/eid/members/:identifier (by uniqueId)
    const byIdRes = await get('/api/eid/members/NX-026');
    assert(byIdRes.status === 200, 'GET /api/eid/members/NX-026 responds with HTTP 200');
    assert(byIdRes.body.data.uniqueId === 'NX-026', 'Resolves correct member by uniqueId NX-026');

    // 3. GET /api/eid/members/:identifier (by lowercase uniqueId)
    const byLowerIdRes = await get('/api/eid/members/nx-026');
    assert(byLowerIdRes.status === 200, 'GET /api/eid/members/nx-026 case-insensitively responds with HTTP 200');
    assert(byLowerIdRes.body.data.uniqueId === 'NX-026', 'Case-insensitive lookup resolves NX-026');

    // 4. GET /api/eid/members/:identifier (by slug)
    const bySlugRes = await get('/api/eid/members/orosmit-mishra');
    assert(bySlugRes.status === 200, 'GET /api/eid/members/orosmit-mishra responds with HTTP 200');
    assert(bySlugRes.body.data.slug === 'orosmit-mishra', 'Resolves correct member by slug');

    // 5. GET /api/eid/memberID/:slug/:uniqueId (canonical route)
    const canonicalRes = await get('/api/eid/memberID/orosmit-mishra/NX-026');
    assert(canonicalRes.status === 200, 'GET /api/eid/memberID/orosmit-mishra/NX-026 responds with HTTP 200');
    assert(canonicalRes.body.data.uniqueId === 'NX-026' && canonicalRes.body.data.slug === 'orosmit-mishra', 'Canonical route verifies both slug and uniqueId pair');

    // 6. Mismatched slug and uniqueId
    const mismatchRes = await get('/api/eid/memberID/orosmit-mishra/NX-001');
    assert(mismatchRes.status === 404, 'Mismatched slug and uniqueId returns HTTP 404 NOT_FOUND');

    // 7. Non-existent identifier
    const notFoundRes = await get('/api/eid/members/non-existent-user');
    assert(notFoundRes.status === 404, 'Non-existent identifier returns HTTP 404');
    assert(notFoundRes.body.error?.code === 'NOT_FOUND', 'Returns clean NOT_FOUND error code');
  }

  console.log('\n--- Test Group 5: Seed & Safe Import Engine Validation ---');
  {
    const scratchDir = path.resolve(__dirname, '../temp_test_scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

    // Subtest: Rejects duplicate unique IDs in JSON file
    const dupIdFile = path.join(scratchDir, 'test_dup_id.json');
    fs.writeFileSync(
      dupIdFile,
      JSON.stringify([
        { uniqueId: 'NX-999', slug: 'user-one', name: 'User One' },
        { uniqueId: 'NX-999', slug: 'user-two', name: 'User Two' },
      ])
    );
    const dupIdReport = validateAndImportEidMembers(dupIdFile, db);
    assert(dupIdReport.rejected.length === 1, 'Import engine detects duplicate uniqueId within seed file');
    assert(dupIdReport.rejected[0].reason.includes('Duplicate uniqueId'), 'Reports duplicate uniqueId error clearly');

    // Subtest: Rejects malformed unique IDs
    const badIdFile = path.join(scratchDir, 'test_bad_id.json');
    fs.writeFileSync(
      badIdFile,
      JSON.stringify([{ uniqueId: 'INVALID_ID', slug: 'user-valid', name: 'User Valid' }])
    );
    const badIdReport = validateAndImportEidMembers(badIdFile, db);
    assert(badIdReport.rejected.length === 1, 'Import engine detects invalid uniqueId format');
    assert(badIdReport.rejected[0].reason.includes('Invalid uniqueId format'), 'Reports invalid format clearly');

    // Subtest: Rejects conflicting slugs
    const dupSlugFile = path.join(scratchDir, 'test_dup_slug.json');
    fs.writeFileSync(
      dupSlugFile,
      JSON.stringify([
        { uniqueId: 'NX-991', slug: 'same-slug', name: 'User One' },
        { uniqueId: 'NX-992', slug: 'same-slug', name: 'User Two' },
      ])
    );
    const dupSlugReport = validateAndImportEidMembers(dupSlugFile, db);
    assert(dupSlugReport.rejected.length === 1, 'Import engine detects conflicting slugs within seed file');

    // Subtest: Rejects conflicting unique ID reassignment to existing different member
    const conflictFile = path.join(scratchDir, 'test_conflict.json');
    fs.writeFileSync(
      conflictFile,
      JSON.stringify([
        // Trying to assign NX-026 (Orosmit Mishra's permanent ID) to another member
        { uniqueId: 'NX-026', slug: 'some-imposter', name: 'Imposter' },
      ])
    );
    const conflictReport = validateAndImportEidMembers(conflictFile, db);
    assert(conflictReport.rejected.length === 1, 'Import engine rejects attempts to hijack an existing permanent unique ID');
    assert(conflictReport.rejected[0].reason.includes('permanently assigned'), 'Explains permanent uniqueId assignment conflict');

    // Clean up test scratch files
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }

  // Close server
  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log('\n===================================================');
  console.log(`  E-ID TEST RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('===================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runEidTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
