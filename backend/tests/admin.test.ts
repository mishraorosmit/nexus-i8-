import http from 'http';
import { createApp } from '../app.ts';
import { seedDatabase } from '../db/seed.ts';
import { getDatabase } from '../db/connection.ts';
import { adminUsersRepository } from '../db/repositories/adminUsers.repository.ts';

interface ApiResponse<T> {
  data: T;
  meta: any;
  error: { code: string; message: string; details?: any } | null;
}

async function runAdminTestSuite() {
  console.log('===================================================');
  console.log('  NEXUS SECURE ADMIN BACKEND TEST SUITE            ');
  console.log('===================================================');

  // 1. Ensure DB is seeded
  const db = getDatabase();
  seedDatabase(db);

  // 2. Start test server on ephemeral port
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

  // Tokens for authorized requests
  let superAdminToken = '';
  let contentAdminToken = '';

  console.log('\n--- Test Group 1: Unauthenticated Access Protection ---');
  {
    const routes = [
      '/api/admin/users',
      '/api/admin/projects',
      '/api/admin/events',
      '/api/admin/members',
      '/api/admin/announcements',
      '/api/admin/archive',
      '/api/admin/resources',
      '/api/admin/media',
      '/api/admin/site-settings',
      '/api/admin/audit-logs',
      '/api/admin/auth/me',
    ];

    for (const route of routes) {
      const res = await get(route);
      assert(
        res.status === 401 && res.body.error?.code === 'UNAUTHENTICATED',
        `Unauthenticated GET ${route} is rejected with 401 UNAUTHENTICATED`
      );
    }
  }

  console.log('\n--- Test Group 2: Authentication, Sessions & Credentials ---');
  {
    // One-Password Model login (no email, only password)
    const onePasswordRes = await post<any>('/api/admin/auth/login', {
      password: 'NexusAdmin!2026',
    });
    assert(onePasswordRes.status === 200, 'One-Password model login returns status 200');
    assert(
      onePasswordRes.body.data.token && onePasswordRes.body.data.user.role === 'super_admin',
      'One-Password login returns active session token and super_admin profile'
    );

    // One-Password Model with invalid password
    const onePasswordWrong = await post<any>('/api/admin/auth/login', {
      password: 'IncorrectPassword!999',
    });
    assert(
      onePasswordWrong.status === 401 && onePasswordWrong.body.error?.code === 'INVALID_CREDENTIALS',
      'One-Password login with invalid password is rejected with 401'
    );

    // One-Password Model with missing password
    const onePasswordMissing = await post<any>('/api/admin/auth/login', {});
    assert(
      onePasswordMissing.status === 400 && onePasswordMissing.body.error?.code === 'INVALID_PASSWORD',
      'One-Password login with missing password is rejected with 400'
    );

    // Super admin login (with email)
    const loginRes = await post<any>('/api/admin/auth/login', {
      email: 'admin@nexus.campus',
      password: 'NexusAdmin!2026',
    });
    assert(loginRes.status === 200, 'Super admin login returns status 200');
    assert(loginRes.body.data.token && loginRes.body.data.user.role === 'super_admin', 'Returns valid bearer token and super_admin profile');
    superAdminToken = loginRes.body.data.token;

    // Content admin login
    const editorRes = await post<any>('/api/admin/auth/login', {
      email: 'editor@nexus.campus',
      password: 'NexusEditor!2026',
    });
    assert(editorRes.status === 200, 'Content admin login returns status 200');
    assert(editorRes.body.data.token && editorRes.body.data.user.role === 'content_admin', 'Returns valid bearer token and content_admin profile');
    contentAdminToken = editorRes.body.data.token;

    // Verify /me endpoint
    const meRes = await get<any>('/api/admin/auth/me', superAdminToken);
    assert(
      meRes.status === 200 && meRes.body.data.user.email === 'admin@nexus.campus',
      'GET /api/admin/auth/me retrieves active authenticated admin details'
    );
    assert(
      meRes.body.data.permissions.includes('manage_admins'),
      'Super admin permissions include manage_admins'
    );

    // Verify content_admin permissions
    const editorMeRes = await get<any>('/api/admin/auth/me', contentAdminToken);
    assert(
      editorMeRes.status === 200 && !editorMeRes.body.data.permissions.includes('manage_admins'),
      'Content admin does not have manage_admins permission'
    );
  }

  console.log('\n--- Test Group 3: Role-Based Access Control (RBAC) ---');
  {
    // Content admin cannot view admin users
    const resUsers = await get('/api/admin/users', contentAdminToken);
    assert(
      resUsers.status === 403 && resUsers.body.error?.code === 'INSUFFICIENT_PERMISSIONS',
      'Content admin cannot access GET /api/admin/users (403 Forbidden)'
    );

    // Content admin cannot update site settings
    const resSettings = await put('/api/admin/site-settings', { settings: { foo: 'bar' } }, contentAdminToken);
    assert(
      resSettings.status === 403 && resSettings.body.error?.code === 'INSUFFICIENT_PERMISSIONS',
      'Content admin cannot modify site settings (403 Forbidden)'
    );

    // Content admin cannot delete projects
    const resDel = await del('/api/admin/projects/nxs-001', contentAdminToken);
    assert(
      resDel.status === 403 && resDel.body.error?.code === 'INSUFFICIENT_PERMISSIONS',
      'Content admin cannot delete projects (403 Forbidden)'
    );

    // Content admin cannot view audit logs
    const resAudit = await get('/api/admin/audit-logs', contentAdminToken);
    assert(
      resAudit.status === 403 && resAudit.body.error?.code === 'INSUFFICIENT_PERMISSIONS',
      'Content admin cannot view audit logs (403 Forbidden)'
    );
  }

  console.log('\n--- Test Group 4: Content Lifecycle (DRAFT -> PUBLISHED -> ARCHIVED) ---');
  let testProjectId = '';
  {
    // Content admin creates project in Draft status
    const createRes = await post<any>(
      '/api/admin/projects',
      {
        title: 'Project Quantum Chrono',
        category: 'Hardware',
        year: '2026',
        shortDescription: 'High precision clock synchronization module',
        status: 'Draft',
      },
      contentAdminToken
    );
    assert(createRes.status === 201 && createRes.body.data.status === 'Draft', 'Content admin creates project in Draft status');
    testProjectId = createRes.body.data.id;

    // Verify it is hidden from public projects list
    const publicList = await get<any[]>('/api/projects');
    const leaked = publicList.body.data.find((p) => p.id === testProjectId);
    assert(leaked === undefined, 'Draft project is NOT visible on public read API /api/projects');

    // Super admin publishes the project
    const publishRes = await patch<any>(
      `/api/admin/projects/${testProjectId}/status`,
      { status: 'Published' },
      superAdminToken
    );
    assert(publishRes.status === 200 && publishRes.body.data.status === 'Published', 'Super admin transitions project to Published');

    // Verify it is now visible on public projects list
    const publicListAfter = await get<any[]>('/api/projects');
    const visible = publicListAfter.body.data.find((p) => p.id === testProjectId);
    assert(visible !== undefined, 'Published project is visible on public read API /api/projects');

    // Content admin tries to archive project (should fail with 403)
    const editorArchiveRes = await patch<any>(
      `/api/admin/projects/${testProjectId}/status`,
      { status: 'Archived' },
      contentAdminToken
    );
    assert(
      editorArchiveRes.status === 403 && editorArchiveRes.body.error?.code === 'INSUFFICIENT_PERMISSIONS',
      'Content admin cannot archive content (403 Forbidden)'
    );

    // Super admin archives project
    const superArchiveRes = await patch<any>(
      `/api/admin/projects/${testProjectId}/status`,
      { status: 'Archived' },
      superAdminToken
    );
    assert(superArchiveRes.status === 200 && superArchiveRes.body.data.status === 'Archived', 'Super admin transitions project to Archived');

    // Super admin deletes test project
    const deleteRes = await del<any>(`/api/admin/projects/${testProjectId}`, superAdminToken);
    assert(deleteRes.status === 200 && deleteRes.body.data.deleted === true, 'Super admin deletes project cleanly');
  }

  console.log('\n--- Test Group 5: Input Validation & Concurrency Protection ---');
  {
    // Invalid email on admin creation
    const invalidEmailRes = await post<any>(
      '/api/admin/users',
      {
        name: 'New Admin',
        email: 'invalid-email-format',
        password: 'Password123!',
        role: 'content_admin',
      },
      superAdminToken
    );
    assert(invalidEmailRes.status === 400 && invalidEmailRes.body.error?.code === 'INVALID_EMAIL', 'Rejects invalid email format');

    // Weak password
    const weakPassRes = await post<any>(
      '/api/admin/users',
      {
        name: 'New Admin',
        email: 'test@nexus.campus',
        password: 'short',
        role: 'content_admin',
      },
      superAdminToken
    );
    assert(weakPassRes.status === 400 && weakPassRes.body.error?.code === 'WEAK_PASSWORD', 'Rejects password shorter than 8 characters');

    // Optimistic Concurrency Conflict on Project Update
    const conflictRes = await put<any>(
      '/api/admin/projects/nxs-001',
      {
        title: 'Concurrent Title Change',
        expected_updated_at: '2020-01-01T00:00:00.000Z', // Stale timestamp
      },
      superAdminToken
    );
    assert(
      conflictRes.status === 409 && conflictRes.body.error?.code === 'CONCURRENCY_CONFLICT',
      'Rejects stale updates with 409 CONCURRENCY_CONFLICT'
    );
  }

  console.log('\n--- Test Group 6: Brute Force Protection & Lockout ---');
  {
    // Create dedicated test user for lockout testing
    const testEmail = `lockout-${Date.now()}@nexus.campus`;
    await post<any>(
      '/api/admin/users',
      {
        name: 'Lockout Target',
        email: testEmail,
        password: 'CorrectPassword123!',
        role: 'content_admin',
      },
      superAdminToken
    );

    // Attempt 5 incorrect logins
    for (let i = 1; i <= 4; i++) {
      const failRes = await post<any>('/api/admin/auth/login', {
        email: testEmail,
        password: 'WrongPassword!',
      });
      assert(failRes.status === 401 && failRes.body.error?.code === 'INVALID_CREDENTIALS', `Attempt ${i}: 401 INVALID_CREDENTIALS`);
    }

    // 5th attempt triggers lockout
    const lockRes = await post<any>('/api/admin/auth/login', {
      email: testEmail,
      password: 'WrongPassword!',
    });
    assert(lockRes.status === 423 && lockRes.body.error?.code === 'ACCOUNT_LOCKED', '5th failed attempt triggers 423 ACCOUNT_LOCKED');

    // 6th attempt even with correct password is blocked while locked
    const lockedAttempt = await post<any>('/api/admin/auth/login', {
      email: testEmail,
      password: 'CorrectPassword123!',
    });
    assert(lockedAttempt.status === 423 && lockedAttempt.body.error?.code === 'ACCOUNT_LOCKED', 'Locked account blocks correct credentials with 423');
  }

  console.log('\n--- Test Group 7: Audit Logging Verification ---');
  {
    const auditRes = await get<any>('/api/admin/audit-logs', superAdminToken);
    assert(auditRes.status === 200, 'Super admin retrieves audit logs');
    assert(auditRes.body.data.length > 0, 'Audit logs contains recorded administrative actions');

    const actions = auditRes.body.data.map((l: any) => l.action);
    assert(actions.includes('LOGIN_SUCCESS'), 'Audit logs recorded LOGIN_SUCCESS');
    assert(actions.includes('CREATE') || actions.includes('PROJECT_CREATED'), 'Audit logs recorded CREATE');
    assert(actions.includes('STATUS_CHANGE') || actions.includes('PUBLISH') || actions.includes('PROJECT_PUBLISHED') || actions.includes('PROJECT_STATUS_CHANGED') || actions.includes('PROJECT_ARCHIVED'), 'Audit logs recorded publication / status change');
    assert(actions.includes('DELETE') || actions.includes('PROJECT_DELETED'), 'Audit logs recorded DELETE');
  }

  console.log('\n--- Test Group 8: Logout Session Invalidation ---');
  {
    // Login temporary session
    const tempLogin = await post<any>('/api/admin/auth/login', {
      email: 'editor@nexus.campus',
      password: 'NexusEditor!2026',
    });
    const tempToken = tempLogin.body.data.token;

    // Logout
    const logoutRes = await post<any>('/api/admin/auth/logout', {}, tempToken);
    assert(logoutRes.status === 200 && logoutRes.body.data.loggedOut === true, 'POST /api/admin/auth/logout succeeds');

    // Calling /me with invalidated token fails
    const invalidCheck = await get<any>('/api/admin/auth/me', tempToken);
    assert(invalidCheck.status === 401, 'Invalidated session token is rejected with 401');
  }

  console.log('\n===================================================');
  console.log(`  ADMIN TEST RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('===================================================');

  server.close();
  if (passed !== total) {
    process.exit(1);
  }
}

runAdminTestSuite().catch((err) => {
  console.error('Test suite runner failed:', err);
  process.exit(1);
});
