import http from 'http';
import { createApp } from '../app.ts';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';
import { membersRepository } from '../db/repositories/members.repository.ts';

async function runPublicMembersTests() {
  console.log('===================================================================');
  console.log('   PHASE 9: PUBLIC WEBSITE REAL MEMBER INTEGRATION TEST SUITE      ');
  console.log('===================================================================');

  const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';

  const db = getDatabase();
  seedDatabase(db);

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

  async function get(path: string, headers?: Record<string, string>): Promise<{ status: number; body: any; headers: Headers }> {
    const res = await fetch(`${baseUrl}${path}`, { headers });
    let body: any = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    return { status: res.status, body, headers: res.headers };
  }

  async function post(path: string, payload: any, headers?: Record<string, string>): Promise<{ status: number; body: any; headers: Headers }> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    let body: any = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    return { status: res.status, body, headers: res.headers };
  }

  async function patch(path: string, payload: any, headers?: Record<string, string>): Promise<{ status: number; body: any; headers: Headers }> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    let body: any = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    return { status: res.status, body, headers: res.headers };
  }

  try {
    // -------------------------------------------------------------
    // Test Group 1: Public Member Directory Listing
    // -------------------------------------------------------------
    console.log('\n--- Test Group 1: Public Member Directory Listing ---');

    const resMembers = await get('/api/members');
    assert(resMembers.status === 200, 'GET /api/members responds with HTTP 200');
    assert(Array.isArray(resMembers.body.data), 'Payload returns data array');
    assert(resMembers.body.error === null, 'Error field is null');
    assert(resMembers.body.data.length >= 26, `Returned full active member directory without 24-item truncation (found: ${resMembers.body.data.length})`);
    assert(resMembers.body.meta?.limit >= 100, `Meta limit defaults to 100 for public directory`);

    // Verify sanitized PublicMemberDto fields
    const sample = resMembers.body.data[0];
    assert(typeof sample.name === 'string' && sample.name.length > 0, 'Member has name');
    assert(typeof sample.role === 'string' && sample.role.length > 0, 'Member has role');
    assert(typeof sample.publicId === 'string' && sample.publicId.length > 0, 'Member has publicId');
    assert(sample.photoUrl !== undefined, 'Member has photoUrl');
    assert(sample.imageUrl !== undefined, 'Member has imageUrl alias for public consumers');
    assert(sample.photoUrl === sample.imageUrl, 'imageUrl matches canonical photoUrl');

    // -------------------------------------------------------------
    // Test Group 2: Zero Sensitive / Private Data Leakage
    // -------------------------------------------------------------
    console.log('\n--- Test Group 2: Public Security & Data Sanitization ---');

    let leakedEmail = false;
    let leakedDbId = false;
    let leakedSecret = false;

    for (const m of resMembers.body.data) {
      if (m.email !== undefined) leakedEmail = true;
      if (m.id && m.id.startsWith('team-') && !m.uniqueId) leakedDbId = true;
      if (m.password_hash || m.cloudinary_secret || m.api_secret) leakedSecret = true;
    }

    assert(!leakedEmail, 'Public members list does NOT leak private email addresses');
    assert(!leakedDbId, 'Public members list does NOT expose raw database team IDs');
    assert(!leakedSecret, 'Public members list does NOT leak any passwords, salts, or API secrets');

    // -------------------------------------------------------------
    // Test Group 3: Server-Side Status Filtering (Active vs Inactive)
    // -------------------------------------------------------------
    console.log('\n--- Test Group 3: Server-Side Status Filtering ---');

    // Create an inactive member and an alumni member directly in SQLite
    const inactiveId = 'test-inactive-p9';
    membersRepository.upsert({
      id: inactiveId,
      public_id: 'inactive-person-p9',
      slug: 'inactive-person-p9',
      unique_id: 'NX-980',
      name: 'INACTIVE TEST USER',
      email: 'inactive@nexus.campus',
      role: 'Former Contributor',
      status: 'INACTIVE',
    });

    const alumniId = 'test-alumni-p9';
    membersRepository.upsert({
      id: alumniId,
      public_id: 'alumni-person-p9',
      slug: 'alumni-person-p9',
      unique_id: 'NX-981',
      name: 'ALUMNI TEST USER',
      email: 'alumni@nexus.campus',
      role: 'Alumni Lead',
      status: 'ALUMNI',
    });

    // 1. Default query must NOT contain inactive or alumni
    const defaultList = await get('/api/members');
    const hasInactiveInDefault = defaultList.body.data.some((m: any) => m.uniqueId === 'NX-980' || m.slug === 'inactive-person-p9');
    const hasAlumniInDefault = defaultList.body.data.some((m: any) => m.uniqueId === 'NX-981' || m.slug === 'alumni-person-p9');
    assert(!hasInactiveInDefault, 'Inactive member is strictly EXCLUDED from default public directory');
    assert(!hasAlumniInDefault, 'Alumni member is strictly EXCLUDED from default active directory');

    // 2. Query with status=inactive or status=all must NOT return inactive members
    const inactiveAttempt = await get('/api/members?status=inactive');
    const hasInactiveInAttempt = inactiveAttempt.body.data.some((m: any) => m.uniqueId === 'NX-980');
    assert(!hasInactiveInAttempt, 'Server-side clamp rejects status=inactive queries on public endpoint');

    const allAttempt = await get('/api/members?status=all');
    const hasInactiveInAll = allAttempt.body.data.some((m: any) => m.uniqueId === 'NX-980');
    assert(!hasInactiveInAll, 'Server-side clamp rejects status=all queries on public endpoint');

    // 3. Query with status=alumni returns alumni
    const alumniList = await get('/api/members?status=alumni');
    const hasAlumniInList = alumniList.body.data.some((m: any) => m.uniqueId === 'NX-981');
    assert(hasAlumniInList, 'Public directory supports explicit status=alumni for alumni showcases');

    // -------------------------------------------------------------
    // Test Group 4: Single Member Public Lookup & Inactive Protection
    // -------------------------------------------------------------
    console.log('\n--- Test Group 4: Single Member Public Lookup ---');

    // Lookup active member by unique_id
    const resUniqueId = await get('/api/members/NX-026');
    assert(resUniqueId.status === 200, 'GET /api/members/NX-026 responds with HTTP 200');
    assert(resUniqueId.body.data.name === 'OROSMIT MISHRA', 'Resolves correct member by NX-026');
    assert(resUniqueId.body.data.imageUrl !== undefined, 'Member detail includes imageUrl');

    // Lookup active member by slug
    const resSlug = await get('/api/members/orosmit-mishra');
    assert(resSlug.status === 200, 'GET /api/members/orosmit-mishra responds with HTTP 200');
    assert(resSlug.body.data.uniqueId === 'NX-026', 'Resolves correct member by slug');

    // Inactive member direct lookup must return 404 on public endpoint
    const resInactiveLookup = await get('/api/members/NX-980');
    assert(resInactiveLookup.status === 404, 'GET /api/members/:id for INACTIVE member returns HTTP 404');
    assert(resInactiveLookup.body.error?.code === 'MEMBER_NOT_FOUND', 'Returns MEMBER_NOT_FOUND error code');

    // Non-existent member direct lookup returns 404
    const resNotFound = await get('/api/members/NX-99999');
    assert(resNotFound.status === 404, 'GET /api/members/NX-99999 returns HTTP 404');

    // -------------------------------------------------------------
    // Test Group 5: End-to-End Consistency: Admin Mutation -> Public Update
    // -------------------------------------------------------------
    console.log('\n--- Test Group 5: End-to-End Consistency & Cache Invalidation ---');

    // Log in as administrator
    const loginRes = await post('/api/admin/auth/login', { password: masterPassword });
    assert(loginRes.status === 200, 'Admin login succeeds');
    const rawCookie = loginRes.headers.get('set-cookie') || '';
    const sessionCookie = rawCookie.split(';')[0];
    const authHeaders = { Cookie: sessionCookie };

    // Find a target member in SQLite
    const targetMember = membersRepository.findByUniqueId('NX-026')!;
    assert(!!targetMember, 'Authoritative SQLite record NX-026 located');

    // 1. Admin edits member's role and display name
    const updatedRole = 'OPERATIONS ARCHITECT // LEAD';
    const patchRes = await patch(
      `/api/admin/members/${targetMember.id}`,
      { role: updatedRole, display_name: 'OROSMIT MISHRA' },
      authHeaders
    );
    assert(patchRes.status === 200, 'Admin successfully patches member in SQLite');

    // 2. Fetch public endpoint immediately
    const publicAfterPatch = await get('/api/members/NX-026');
    assert(publicAfterPatch.status === 200, 'Public endpoint returns 200 after admin edit');
    assert(publicAfterPatch.body.data.role === updatedRole, `Public API reflects updated role: "${publicAfterPatch.body.data.role}"`);

    // 3. Admin updates profile image (Cloudinary URL)
    const cloudinaryTestUrl = 'https://res.cloudinary.com/plg8gola/image/upload/v1700000000/nexus/profile-images/orosmit_new.webp';
    const patchImgRes = await patch(
      `/api/admin/members/${targetMember.id}`,
      { profile_image_url: cloudinaryTestUrl, photo_url: cloudinaryTestUrl },
      authHeaders
    );
    assert(patchImgRes.status === 200, 'Admin updates Cloudinary image URL in SQLite');

    // 4. Verify public endpoint reflects Cloudinary image immediately
    const publicAfterImg = await get('/api/members/NX-026');
    assert(publicAfterImg.body.data.photoUrl === cloudinaryTestUrl, 'Public photoUrl reflects updated Cloudinary URL');
    assert(publicAfterImg.body.data.imageUrl === cloudinaryTestUrl, 'Public imageUrl alias reflects updated Cloudinary URL');

    // 5. Admin deactivates member (changes status to INACTIVE)
    const deactivateRes = await patch(
      `/api/admin/members/${targetMember.id}`,
      { status: 'INACTIVE' },
      authHeaders
    );
    assert(deactivateRes.status === 200, 'Admin deactivates member in SQLite');

    // 6. Public directory immediately excludes the deactivated member
    const publicListAfterDeactivation = await get('/api/members');
    const isPresentInDirectory = publicListAfterDeactivation.body.data.some((m: any) => m.uniqueId === 'NX-026');
    assert(!isPresentInDirectory, 'Deactivated member is immediately excluded from public directory');

    // 7. Public single-member lookup immediately returns 404
    const publicLookupAfterDeactivation = await get('/api/members/NX-026');
    assert(publicLookupAfterDeactivation.status === 404, 'Direct public lookup of newly deactivated member returns 404');

    // 8. Restore active status
    const reactivateRes = await patch(
      `/api/admin/members/${targetMember.id}`,
      {
        status: 'ACTIVE',
        role: targetMember.role,
        display_name: targetMember.name,
        photo_url: targetMember.photo_url,
        profile_image_url: targetMember.profile_image_url,
      },
      authHeaders
    );
    assert(reactivateRes.status === 200, 'Restored test member to original active status');

    const publicListAfterRestore = await get('/api/members');
    const isPresentAfterRestore = publicListAfterRestore.body.data.some((m: any) => m.uniqueId === 'NX-026');
    assert(isPresentAfterRestore, 'Restored member is immediately present in public directory again');

    // Clean up temporary test records
    membersRepository.deleteMember(inactiveId);
    membersRepository.deleteMember(alumniId);

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n===================================================');
    console.log(`  PUBLIC MEMBERS TESTS COMPLETE: ${passed}/${total} PASSED (${((passed / total) * 100).toFixed(1)}%)`);
    console.log('===================================================\n');

    if (passed !== total) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runPublicMembersTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
