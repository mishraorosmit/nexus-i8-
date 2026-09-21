import http from 'http';
import { createApp } from '../app.ts';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';
import { membersRepository } from '../db/repositories/members.repository.ts';
import { memoryCache } from '../utils/cache.ts';

async function runAdminEidIntegrationTests() {
  console.log('===================================================================');
  console.log('   NEXUS E-ID REAL DATABASE INTEGRATION: TEST SUITE                ');
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

  try {
    console.log('\n--- 1. Primary Public Identity: Authoritative unique_id ---');
    {
      // Valid lookup by unique_id NX-026 (Orosmit Mishra)
      const res = await get('/api/eid/members/NX-026');
      assert(res.status === 200, 'GET /api/eid/members/NX-026 responds with HTTP 200');
      assert(res.body.success === true, 'Response body has success: true');
      assert(res.body.data.uniqueId === 'NX-026', 'Payload returns authoritative uniqueId NX-026');
      assert(res.body.data.slug === 'orosmit-mishra', 'Payload returns registered slug "orosmit-mishra"');

      // Case-insensitive lookup (nx-026)
      const lowerRes = await get('/api/eid/members/nx-026');
      assert(lowerRes.status === 200, 'GET /api/eid/members/nx-026 (lowercase) responds with HTTP 200');
      assert(lowerRes.body.data.uniqueId === 'NX-026', 'Resolves uppercase NX-026 for lowercase input');

      // Valid lookup by unique_id NX-001 (Jitesh Raj)
      const jiteshRes = await get('/api/eid/members/NX-001');
      assert(jiteshRes.status === 200, 'GET /api/eid/members/NX-001 responds with HTTP 200');
      assert(jiteshRes.body.data.uniqueId === 'NX-001', 'Resolves NX-001');
      assert(jiteshRes.body.data.slug === 'jitesh-raj', 'Resolves slug "jitesh-raj"');
    }

    console.log('\n--- 2. Canonical Route & Slug Pair Verification ---');
    {
      // Canonical route /api/eid/memberID/:slug/:uniqueId
      const canonicalRes = await get('/api/eid/memberID/orosmit-mishra/NX-026');
      assert(canonicalRes.status === 200, 'GET /api/eid/memberID/orosmit-mishra/NX-026 responds with HTTP 200');
      assert(canonicalRes.body.data.uniqueId === 'NX-026', 'Canonical route returns correct member');
      assert(canonicalRes.body.data.qrUrl === '/memberID/orosmit-mishra/NX-026', 'qrUrl is strictly canonical /memberID/orosmit-mishra/NX-026');

      // Mismatched slug returns 404 (does not return wrong person)
      const mismatchRes = await get('/api/eid/memberID/wrong-slug/NX-026');
      assert(mismatchRes.status === 404, 'Mismatched slug in canonical route returns HTTP 404');
    }

    console.log('\n--- 3. Invalid Identifier & Non-Existent Member Handling ---');
    {
      // Non-existent unique_id
      const notFoundRes = await get('/api/eid/members/NX-999');
      assert(notFoundRes.status === 404, 'Non-existent unique_id NX-999 returns HTTP 404');
      assert(notFoundRes.body.success === false, 'Error response has success: false');

      // Malformed identifier
      const invalidRes = await get('/api/eid/members/NX-INVALID-NONEXISTENT-XYZ');
      assert(invalidRes.status === 404, 'Invalid/non-existent identifier safely returns 404 without crashing');
    }

    console.log('\n--- 4. Status Lifecycle: ACTIVE, INACTIVE, ALUMNI ---');
    {
      const testId = 'test-phase8-status-member';
      const testSlug = 'test-status-member';
      const testUniqueId = 'NX-777';

      membersRepository.deleteMember(testId);
      memoryCache.invalidate('eid');

      try {
        // 4a. Create as ACTIVE
        membersRepository.create({
          id: testId,
          public_id: testSlug,
          unique_id: testUniqueId,
          name: 'Phase 8 Status Member',
          email: `${testSlug}@nexus.campus`,
          role: 'Security Analyst',
          department: 'Engineering',
          domain: 'Security',
          bio: 'Test bio',
          photo_url: null,
          image_position: null,
          social_links: null,
          status: 'ACTIVE',
          joined_date: '2026-09-01',
        });

        memoryCache.invalidate('eid');
        const activeRes = await get(`/api/eid/members/${testUniqueId}`);
        assert(activeRes.status === 200, 'Active member returns 200');
        assert(activeRes.body.data.status === 'ACTIVE', 'Active member has status ACTIVE');

        // 4b. Update to INACTIVE
        membersRepository.update(testId, { status: 'INACTIVE' });
        memoryCache.invalidate('eid');
        const inactiveRes = await get(`/api/eid/members/${testUniqueId}`);
        assert(inactiveRes.status === 200, 'Inactive member returns 200 for public card resolution');
        assert(inactiveRes.body.data.status === 'INACTIVE', 'Inactive member status is explicitly serialized as INACTIVE for revoked card UI');

        // 4c. Update to ALUMNI
        membersRepository.update(testId, { status: 'ALUMNI' });
        memoryCache.invalidate('eid');
        const alumniRes = await get(`/api/eid/members/${testUniqueId}`);
        assert(alumniRes.status === 200, 'Alumni member returns 200');
        assert(alumniRes.body.data.status === 'ALUMNI', 'Alumni member status is explicitly serialized as ALUMNI');
      } finally {
        membersRepository.deleteMember(testId);
        memoryCache.invalidate('eid');
      }
    }

    console.log('\n--- 5. Cloudinary Image Consumption & Fallbacks ---');
    {
      const testId = 'test-phase8-image-member';
      const testSlug = 'test-image-member';
      const testUniqueId = 'NX-778';
      const mockCloudinaryUrl = 'https://res.cloudinary.com/mock-cloud/image/upload/v12345/nexus/profile-images/test_123.webp';

      membersRepository.deleteMember(testId);
      memoryCache.invalidate('eid');

      try {
        // Record with Cloudinary profile_image_url
        membersRepository.create({
          id: testId,
          public_id: testSlug,
          unique_id: testUniqueId,
          name: 'Cloudinary Image Member',
          email: `${testSlug}@nexus.campus`,
          role: 'Designer',
          department: 'Design',
          domain: 'Tactile UI',
          bio: 'Test bio',
          profile_image_url: mockCloudinaryUrl,
          profile_image_public_id: 'nexus/profile-images/test_123',
          photo_url: mockCloudinaryUrl,
          image_position: null,
          social_links: null,
          status: 'ACTIVE',
          joined_date: '2026-09-01',
        });

        memoryCache.invalidate('eid');
        const res = await get(`/api/eid/members/${testUniqueId}`);
        assert(res.status === 200, 'Image member returns 200');
        assert(res.body.data.image === mockCloudinaryUrl, 'E-ID card consumes Cloudinary profile_image_url as primary image');

        // Missing/null image
        membersRepository.update(testId, { profile_image_url: null, photo_url: null });
        memoryCache.invalidate('eid');
        const noImgRes = await get(`/api/eid/members/${testUniqueId}`);
        assert(noImgRes.status === 200, 'Null image member returns 200 without error');
        assert(noImgRes.body.data.image === null, 'Missing image safely resolves to null for client fallback');
      } finally {
        membersRepository.deleteMember(testId);
        memoryCache.invalidate('eid');
      }
    }

    console.log('\n--- 6. QR Code Payload Safety ---');
    {
      const res = await get('/api/eid/members/NX-026');
      const data = res.body.data;
      assert(data.qrUrl === '/memberID/orosmit-mishra/NX-026', 'qrUrl contains only canonical route');
      assert(!data.qrUrl.includes('email'), 'qrUrl does not contain email');
      assert(!data.qrUrl.includes('password'), 'qrUrl does not contain credentials');
      assert(!data.qrUrl.includes('team-'), 'qrUrl does not contain internal database primary key');
      assert(data.email === undefined, 'Public E-ID card DTO strictly omits email');
    }

    console.log('\n--- 7. Public Member Lookup API (/api/members/:uniqueId) ---');
    {
      // Lookup by unique_id NX-026
      const pubRes = await get('/api/members/NX-026');
      assert(pubRes.status === 200, 'GET /api/members/NX-026 responds with HTTP 200');
      assert(pubRes.body.error === null, 'Response has error: null');
      assert(pubRes.body.data.uniqueId === 'NX-026', 'Resolves public member by uniqueId');
      assert(pubRes.body.data.publicId === 'orosmit-mishra', 'Resolves public member publicId');
      assert(pubRes.body.data.name.toLowerCase().includes('orosmit'), 'Resolves correct member name');
      assert(pubRes.body.data.id === 'NX-026' || pubRes.body.data.id === 'orosmit-mishra', 'Public DTO id is public identity, NOT internal database rowid (team-02)');
      assert(pubRes.body.data.email === undefined, 'Public DTO strictly omits private email address');
      assert(pubRes.body.data.password === undefined, 'Public DTO strictly omits password');
      assert(pubRes.body.data.profile_image_public_id === undefined, 'Public DTO omits internal Cloudinary asset public IDs');

      // Non-existent member
      const pubNotFound = await get('/api/members/NX-999');
      assert(pubNotFound.status === 404, 'GET /api/members/NX-999 returns HTTP 404');
    }

    console.log('\n--- 8. Admin Mutation Cache Invalidation (Data Freshness) ---');
    {
      // 1. Prime the eid cache
      memoryCache.clear();
      const firstGet = await get('/api/eid/members/NX-026');
      assert(firstGet.headers.get('X-Cache') === 'MISS', 'Initial GET /api/eid/members/NX-026 is cache MISS');

      // 2. Second GET should hit cache
      const cachedGet = await get('/api/eid/members/NX-026');
      assert(cachedGet.headers.get('X-Cache') === 'HIT', 'Second GET /api/eid/members/NX-026 is cache HIT');

      // 3. Login as admin and perform an update on member to trigger cache invalidation
      const loginRes = await post('/api/admin/auth/login', { password: masterPassword });
      const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
      assert(Boolean(cookie), 'Admin authentication establishes valid session cookie');

      const allMembers = membersRepository.findAll({ status: 'all' });
      const orosmit = allMembers.find((m) => m.unique_id === 'NX-026');
      assert(Boolean(orosmit), 'Located Orosmit in SQLite');

      if (orosmit && cookie) {
        // Perform update via Admin API
        const patchRes = await fetch(`${baseUrl}/api/admin/members/${orosmit.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: JSON.stringify({ role: 'Lead Architect & Orchestrator' }),
        });
        assert(patchRes.status === 200, 'PATCH /api/admin/members/:id succeeds');

        // Allow res.on("finish") microtask to invalidate memoryCache
        await new Promise((r) => setTimeout(r, 60));

        // 4. GET /api/eid/members/NX-026 should now be a cache MISS and reflect update
        const freshGet = await get('/api/eid/members/NX-026');
        assert(freshGet.headers.get('X-Cache') === 'MISS', 'Subsequent GET after admin mutation is cache MISS (cache invalidated)');
        assert(freshGet.body.data.role === 'Lead Architect & Orchestrator', 'E-ID card immediately reflects updated member data from SQLite');

        // Revert role
        await fetch(`${baseUrl}/api/admin/members/${orosmit.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: JSON.stringify({ role: 'Team Lead' }),
        });
      }
    }

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n===================================================');
  console.log(`  SUITE COMPLETE: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('===================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runAdminEidIntegrationTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
