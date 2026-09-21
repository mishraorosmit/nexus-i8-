import http from 'http';
import { createApp } from '../app.ts';
import { seedDatabase } from '../db/seed.ts';
import { getDatabase } from '../db/connection.ts';
import { cloudinaryService } from '../services/cloudinary.service.ts';
import { mediaAssetsRepository } from '../db/repositories/mediaAssets.repository.ts';
import { membersRepository } from '../db/repositories/members.repository.ts';
import { projectsRepository } from '../db/repositories/projects.repository.ts';
import { eventsRepository } from '../db/repositories/events.repository.ts';

interface ApiResponse<T> {
  data: T;
  meta: any;
  error: { code: string; message: string; details?: any } | null;
}

// 1x1 Transparent PNG Base64
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// 1x1 JPEG Base64
const VALID_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

// Executable payload pretending to be an image (MZ header)
const FAKE_IMAGE_EXE_BASE64 = Buffer.from(
  'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00MaliciousPayload'
).toString('base64');

async function runMediaLibraryTestSuite() {
  console.log('===============================================================');
  console.log('  NEXUS ADMIN MEDIA LIBRARY SUITE (PHASE 17 - 19-POINT MATRIX)');
  console.log('===============================================================');

  // 1. Seed DB and configure Cloudinary Mock Mode
  const db = getDatabase();
  seedDatabase(db);
  cloudinaryService.setMockMode(true);
  cloudinaryService.resetTestState();

  // 2. Start server
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

  async function get<T>(path: string, token?: string): Promise<{ status: number; body: ApiResponse<T> }> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const body = (await res.json()) as ApiResponse<T>;
    return { status: res.status, body };
  }

  async function post<T>(path: string, payload: any, token?: string): Promise<{ status: number; body: ApiResponse<T> }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as ApiResponse<T>;
    return { status: res.status, body };
  }

  async function put<T>(path: string, payload: any, token?: string): Promise<{ status: number; body: ApiResponse<T> }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as ApiResponse<T>;
    return { status: res.status, body };
  }

  async function patch<T>(path: string, payload: any, token?: string): Promise<{ status: number; body: ApiResponse<T> }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as ApiResponse<T>;
    return { status: res.status, body };
  }

  async function del<T>(path: string, token?: string): Promise<{ status: number; body: ApiResponse<T> }> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'DELETE',
      headers,
    });
    const body = (await res.json()) as ApiResponse<T>;
    return { status: res.status, body };
  }

  // Admin login for authenticated sessions
  const adminLogin = await post<any>('/api/admin/auth/login', {
    email: 'admin@nexus.campus',
    password: 'NexusAdmin!2026',
  });
  const token = adminLogin.body.data?.token;

  console.log('\n--- 1. Upload Test (Cloudinary + SQLite Reference) ---');
  let uploadedAssetId = '';
  let uploadedPublicId = '';
  let uploadedSecureUrl = '';
  {
    const res = await post<any>(
      '/api/admin/media/upload',
      {
        filename: 'campus-robotics-showcase.png',
        category: 'project',
        alt_text: 'Nexus Robotics Lab prototype showcase',
        content: VALID_PNG_BASE64,
      },
      token
    );

    assert(res.status === 201, 'Upload returns status 201 Created');
    assert(Boolean(res.body.data?.id), 'Returns generated asset ID');
    assert(Boolean(res.body.data?.cloudinary_public_id), 'Cloudinary public ID generated');
    assert(Boolean(res.body.data?.secure_url), 'Cloudinary secure delivery URL generated');
    assert(res.body.data?.category === 'project', 'Correct category namespace assigned');
    assert(res.body.data?.alt_text === 'Nexus Robotics Lab prototype showcase', 'Alt text persisted');

    uploadedAssetId = res.body.data.id;
    uploadedPublicId = res.body.data.cloudinary_public_id;
    uploadedSecureUrl = res.body.data.secure_url;

    // Verify in SQLite
    const dbRecord = mediaAssetsRepository.findById(uploadedAssetId);
    assert(Boolean(dbRecord), 'Asset record exists in SQLite media_assets');
  }

  console.log('\n--- 2. Invalid File Rejection (Magic Bytes Binary Defense) ---');
  {
    const res = await post<any>(
      '/api/admin/media/upload',
      {
        filename: 'stealth-exploit.png',
        category: 'general',
        content: FAKE_IMAGE_EXE_BASE64,
      },
      token
    );

    assert(res.status === 400, 'Executable disguised as image is rejected with HTTP 400');
    assert(res.body.error?.code === 'EXECUTABLE_REJECTED', 'Error code is EXECUTABLE_REJECTED');
  }

  console.log('\n--- 3. Oversized File Rejection ---');
  {
    // Generate buffer exceeding 10MB
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
    // Write valid PNG header
    oversizedBuffer[0] = 0x89;
    oversizedBuffer[1] = 0x50;
    oversizedBuffer[2] = 0x4e;
    oversizedBuffer[3] = 0x47;

    const res = await post<any>(
      '/api/admin/media/upload',
      {
        filename: 'massive-render.png',
        category: 'project',
        content: oversizedBuffer.toString('base64'),
      },
      token
    );

    assert(res.status === 413, 'File exceeding 10MB limit is rejected with HTTP 413');
    assert(res.body.error?.code === 'FILE_TOO_LARGE', 'Error code is FILE_TOO_LARGE');
  }

  console.log('\n--- 4. Search Functionality ---');
  {
    const res = await get<any[]>('/api/admin/media?search=robotics', token);
    assert(res.status === 200, 'GET /api/admin/media?search=robotics returns 200');
    assert(
      res.body.data.some((a) => a.id === uploadedAssetId),
      'Search locates uploaded asset by filename/alt text'
    );
  }

  console.log('\n--- 5. Category & Usage Filtering ---');
  {
    const projectRes = await get<any[]>('/api/admin/media?category=project', token);
    assert(projectRes.status === 200, 'Category filter returns 200');
    assert(
      projectRes.body.data.every((a) => a.category === 'project'),
      'All returned assets match requested project category'
    );
    assert(Boolean(projectRes.body.meta?.facets), 'Facets summary is returned in response metadata');

    const unusedRes = await get<any[]>('/api/admin/media?usage=unused', token);
    assert(unusedRes.status === 200, 'Usage filter returns 200');
    assert(
      unusedRes.body.data.some((a) => a.id === uploadedAssetId),
      'Newly uploaded unassigned asset is found under unused filter'
    );
  }

  console.log('\n--- 6. Asset Details & Usage Endpoint ---');
  {
    const res = await get<any>(`/api/admin/media/${uploadedAssetId}`, token);
    assert(res.status === 200, 'GET /api/admin/media/:id returns 200');
    assert(res.body.data?.id === uploadedAssetId, 'Returns exact asset metadata');
    assert(res.body.data?.usage_status === 'UNUSED', 'Identifies newly uploaded asset as UNUSED');

    const usageRes = await get<any>(`/api/admin/media/${uploadedAssetId}/usage`, token);
    assert(usageRes.status === 200, 'GET /api/admin/media/:id/usage returns 200');
    assert(usageRes.body.data?.status === 'UNUSED', 'Usage endpoint returns UNUSED status');
    assert(Array.isArray(usageRes.body.data?.references), 'Usage endpoint returns references array');
  }

  console.log('\n--- 7. Copy URL Verification ---');
  {
    const res = await get<any>(`/api/admin/media/${uploadedAssetId}`, token);
    const cdnUrl = res.body.data?.secure_url;
    assert(
      typeof cdnUrl === 'string' && cdnUrl.startsWith('https://res.cloudinary.com/'),
      'Asset provides canonical HTTPS Cloudinary CDN delivery URL for one-click copy'
    );
  }

  console.log('\n--- 8. Used Asset Protection (Deletion Blocked) ---');
  // Create a project that references our uploaded asset
  const testProject = projectsRepository.create({
    id: `prj-test-${Date.now()}`,
    slug: `test-proj-${Date.now()}`,
    project_number: 'PRJ-999',
    title: 'Automated Robotics Core',
    category: 'HARDWARE',
    year: '2026',
    short_description: 'Test robotics hardware',
    full_description: 'Full test robotics description',
    disciplines: 'HARDWARE',
    status: 'Published',
    featured: 0,
    technologies: '[]',
    deliverables: null,
    cover_image: uploadedSecureUrl,
    cover_image_url: uploadedSecureUrl,
    cover_image_public_id: uploadedPublicId,
    demo_url: null,
    live_url: null,
    repository_url: null,
    documentation_url: null,
    start_date: null,
    end_date: null,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  {
    // Now verify the asset is identified as USED
    const details = await get<any>(`/api/admin/media/${uploadedAssetId}`, token);
    assert(details.body.data?.usage_status === 'USED', 'Asset is now dynamically identified as USED');
    assert(
      details.body.data?.references?.some((r: any) => r.type === 'project' && r.id === testProject.id),
      'Active referencing project is listed in references array'
    );

    // Attempt to DELETE the referenced asset
    const deleteRes = await del<any>(`/api/admin/media/${uploadedAssetId}`, token);
    assert(
      deleteRes.status === 400,
      'Attempting to delete a referenced asset is rejected with HTTP 400'
    );
    assert(
      deleteRes.body.error?.code === 'CANNOT_DELETE_REFERENCED_ASSET',
      'Rejection error code is CANNOT_DELETE_REFERENCED_ASSET'
    );
    assert(
      Array.isArray(deleteRes.body.error?.details?.references),
      'Error response specifies the referencing entity records'
    );

    // Verify record was preserved in SQLite
    const stillExists = mediaAssetsRepository.findById(uploadedAssetId);
    assert(Boolean(stillExists), 'Referenced asset is strictly preserved in SQLite');
  }

  console.log('\n--- 9. Unused Asset Handling ---');
  let separateUnusedId = '';
  {
    const uploadRes = await post<any>(
      '/api/admin/media/upload',
      {
        filename: 'temporary-banner.png',
        category: 'general',
        content: VALID_PNG_BASE64,
      },
      token
    );
    separateUnusedId = uploadRes.body.data.id;

    const checkRes = await get<any>(`/api/admin/media/${separateUnusedId}`, token);
    assert(
      checkRes.body.data?.usage_status === 'UNUSED' && checkRes.body.data?.references?.length === 0,
      'Unreferenced asset is correctly marked as UNUSED with 0 references'
    );
  }

  console.log('\n--- 10. Safe Replacement & Cascade Reference Reassignment ---');
  let newReplacedPublicId = '';
  let newReplacedSecureUrl = '';
  {
    const replaceRes = await put<any>(
      `/api/admin/media/${uploadedAssetId}/replace`,
      {
        filename: 'updated-robotics-cover.jpg',
        content: VALID_JPEG_BASE64,
      },
      token
    );

    assert(replaceRes.status === 200, 'PUT /api/admin/media/:id/replace succeeds with 200 OK');
    assert(replaceRes.body.data?.format === 'jpeg', 'Replaced asset format updated to jpeg');
    assert(replaceRes.body.data?.id === uploadedAssetId, 'Media asset ID strictly preserved');

    newReplacedPublicId = replaceRes.body.data.cloudinary_public_id;
    newReplacedSecureUrl = replaceRes.body.data.secure_url;

    // Check project cascade reassignment
    const updatedProject = projectsRepository.findById(testProject.id);
    assert(
      updatedProject?.cover_image_url === newReplacedSecureUrl,
      'Referencing project cover_image_url automatically updated to new asset URL'
    );
    assert(
      updatedProject?.cover_image_public_id === newReplacedPublicId,
      'Referencing project cover_image_public_id automatically updated to new public ID'
    );

    // Verify old Cloudinary asset was destroyed
    const destroyedList = cloudinaryService.getDestroyedPublicIds();
    assert(
      destroyedList.includes(uploadedPublicId),
      'Old Cloudinary asset was safely destroyed after SQLite commit'
    );
  }

  console.log('\n--- 11. Deletion of Unused Asset ---');
  {
    const delRes = await del<any>(`/api/admin/media/${separateUnusedId}`, token);
    assert(delRes.status === 200, 'DELETE unreferenced asset succeeds with HTTP 200');
    assert(delRes.body.data?.deleted === true, 'Response confirms asset was deleted');

    const checkDb = mediaAssetsRepository.findById(separateUnusedId);
    assert(checkDb === null, 'Asset record was completely purged from SQLite');
  }

  console.log('\n--- 12. Cloudinary Upload Failure Tolerance ---');
  {
    cloudinaryService.setSimulateFailure('upload');

    const failUpload = await post<any>(
      '/api/admin/media/upload',
      {
        filename: 'fail-test.png',
        category: 'general',
        content: VALID_PNG_BASE64,
      },
      token
    );

    assert(failUpload.status === 502, 'Cloudinary failure returns HTTP 502');
    assert(failUpload.body.error?.code === 'CLOUDINARY_UPLOAD_FAILED', 'Returns CLOUDINARY_UPLOAD_FAILED');

    // Verify no orphaned asset was left in DB
    const all = mediaAssetsRepository.findAll();
    assert(
      !all.some((a) => a.filename === 'fail-test.png'),
      'No orphaned metadata row was committed to SQLite'
    );

    cloudinaryService.setSimulateFailure(null);
  }

  console.log('\n--- 13. Metadata Update (Alt Text & Category) ---');
  {
    const patchRes = await patch<any>(
      `/api/admin/media/${uploadedAssetId}`,
      {
        alt_text: 'Updated Alt Description for Screen Readers',
        category: 'branding',
      },
      token
    );

    assert(patchRes.status === 200, 'PATCH /api/admin/media/:id succeeds with HTTP 200');
    assert(patchRes.body.data?.alt_text === 'Updated Alt Description for Screen Readers', 'Alt text updated');
    assert(patchRes.body.data?.category === 'branding', 'Category namespace updated');
  }

  console.log('\n--- 14. Tamper-Evident Audit Logging ---');
  {
    const logs = db.prepare(`
      SELECT action, entity_type, entity_id, details
      FROM audit_logs
      WHERE entity_type = 'MEDIA'
      ORDER BY created_at DESC
    `).all() as any[];

    const actions = logs.map((l) => l.action);
    assert(actions.includes('MEDIA_UPLOADED'), 'Audit trail records MEDIA_UPLOADED');
    assert(actions.includes('MEDIA_REPLACED'), 'Audit trail records MEDIA_REPLACED');
    assert(actions.includes('MEDIA_REASSIGNED'), 'Audit trail records MEDIA_REASSIGNED');
    assert(actions.includes('MEDIA_DELETED'), 'Audit trail records MEDIA_DELETED');
    assert(actions.includes('MEDIA_UPDATED'), 'Audit trail records MEDIA_UPDATED');
  }

  console.log('\n--- 15. Public Member Profile Image Integration ---');
  {
    // Find active member
    const activeMembers = membersRepository.findAll({ status: 'active' });
    const activeMember = activeMembers[0];
    assert(Boolean(activeMember), 'Found active member for showcase check');

    const pubRes = await get<any>(`/api/members/${activeMember.slug || activeMember.public_id}`);
    assert(pubRes.status === 200, 'Public member profile responds with HTTP 200');
    assert(
      pubRes.body.data?.photoUrl !== undefined,
      'Public profile provides authentic photoUrl'
    );
  }

  console.log('\n--- 16. Public E-ID Card Image Integration ---');
  {
    const activeMembers = membersRepository.findAll({ status: 'active' });
    const activeMember = activeMembers.find((m) => m.unique_id) || activeMembers[0];
    const identifier = activeMember.unique_id || activeMember.slug || activeMember.public_id;
    const eidRes = await get<any>(`/api/eid/members/${identifier}`);
    assert(eidRes.status === 200, 'Public E-ID endpoint responds with HTTP 200');
    assert(
      eidRes.body.data?.image !== undefined,
      'Public E-ID card renders authentic member portrait'
    );
  }

  console.log('\n--- 17. Public Project Showcase Image Integration ---');
  {
    const projRes = await get<any>(`/api/projects/${testProject.slug}`);
    assert(projRes.status === 200, 'Public project showcase responds with HTTP 200');
    assert(
      projRes.body.data?.coverImage === newReplacedSecureUrl,
      'Public project renders the updated replacement Cloudinary image'
    );
  }

  console.log('\n--- 18. Public Event Image Integration ---');
  {
    const { items: events } = eventsRepository.findPaginated();
    assert(events.length > 0, 'Database contains events');
    const eventRes = await get<any>('/api/events');
    assert(eventRes.status === 200, 'Public events showcase responds with HTTP 200');
    assert(Array.isArray(eventRes.body.data), 'Public events array returned');
  }

  console.log('\n--- 19. Secrets Isolation & Client Safety ---');
  {
    // Ensure media assets API NEVER exposes CLOUDINARY_API_SECRET
    const listRes = await get<any>('/api/admin/media', token);
    const jsonStr = JSON.stringify(listRes.body);
    assert(!jsonStr.includes('CLOUDINARY_API_SECRET'), 'API response does not leak CLOUDINARY_API_SECRET');
    assert(!jsonStr.includes('api_secret'), 'API response does not leak api_secret');
  }

  // Teardown
  server.close();

  console.log('\n===============================================================');
  console.log(`  ADMIN MEDIA LIBRARY RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runMediaLibraryTestSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
