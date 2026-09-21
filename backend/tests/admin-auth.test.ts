import http from 'http';
import { createApp } from '../app.ts';
import { seedDatabase } from '../db/seed.ts';
import { getDatabase } from '../db/connection.ts';
import { adminSessionsRepository } from '../db/repositories/adminSessions.repository.ts';
import { adminUsersRepository } from '../db/repositories/adminUsers.repository.ts';
import { generateSessionToken, hashToken } from '../utils/crypto.ts';

interface ApiResponse<T> {
  data: T;
  meta: any;
  error: { code: string; message: string; details?: any } | null;
}

async function runAdminAuthTestSuite() {
  console.log('===================================================');
  console.log('  NEXUS ONE-PASSWORD AUTHENTICATION TEST SUITE     ');
  console.log('===================================================');

  // Master password reference (CRITICAL: NEVER print this in test logs or assertions)
  const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';

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

  async function get<T>(path: string, cookie?: string): Promise<{ status: number; headers: Headers; body: ApiResponse<T> }> {
    const headers: Record<string, string> = {};
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const body = (await res.json()) as ApiResponse<T>;
    return { status: res.status, headers: res.headers, body };
  }

  async function post<T>(path: string, payload: any, cookie?: string): Promise<{ status: number; headers: Headers; body: ApiResponse<T> }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as ApiResponse<T>;
    return { status: res.status, headers: res.headers, body };
  }

  let validSessionCookie = '';
  let validSessionToken = '';

  // -------------------------------------------------------------
  // Test 1: valid password
  // -------------------------------------------------------------
  console.log('\n--- 1. Valid Password Authentication ---');
  {
    const res = await post<any>('/api/admin/auth/login', { password: masterPassword });
    assert(res.status === 200, 'Test 1: Valid password login returns HTTP 200');
    assert(Boolean(res.body.data?.token), 'Test 1: Returns active session token');
    assert(res.body.data?.user?.role === 'super_admin', 'Test 1: Authenticates as super_admin');

    const setCookie = res.headers.get('set-cookie') || '';
    assert(setCookie.includes('nexus_admin_session='), 'Test 1: Sets nexus_admin_session cookie');
    assert(setCookie.toLowerCase().includes('httponly'), 'Test 1: Cookie includes HttpOnly directive');

    if (setCookie.includes('nexus_admin_session=')) {
      validSessionCookie = setCookie.split(';')[0];
    }
    validSessionToken = res.body.data?.token;
  }

  // -------------------------------------------------------------
  // Test 2: invalid password
  // -------------------------------------------------------------
  console.log('\n--- 2. Invalid Password Authentication ---');
  {
    const res = await post<any>('/api/admin/auth/login', { password: 'IncorrectPassword_AlphaBravo' });
    assert(res.status === 401, 'Test 2: Invalid password returns HTTP 401');
    assert(res.body.error?.code === 'INVALID_CREDENTIALS', 'Test 2: Error code is INVALID_CREDENTIALS');
    assert(res.body.error?.message === 'Invalid credentials.', 'Test 2: Error message is generic "Invalid credentials."');
  }

  // -------------------------------------------------------------
  // Test 3: missing password
  // -------------------------------------------------------------
  console.log('\n--- 3. Missing Password Validation ---');
  {
    const resEmpty = await post<any>('/api/admin/auth/login', {});
    assert(resEmpty.status === 400, 'Test 3: Missing password field returns HTTP 400');
    assert(resEmpty.body.error?.code === 'INVALID_PASSWORD', 'Test 3: Missing password code is INVALID_PASSWORD');

    const resBlank = await post<any>('/api/admin/auth/login', { password: '' });
    assert(resBlank.status === 400, 'Test 3: Blank password string returns HTTP 400');
  }

  // -------------------------------------------------------------
  // Test 4: repeated failed attempts
  // -------------------------------------------------------------
  console.log('\n--- 4. Repeated Failed Attempts (Brute Force Protection) ---');
  {
    // Make rapid incorrect attempts to trigger lockout / rate limit
    let lockoutTriggered = false;
    for (let i = 0; i < 7; i++) {
      const res = await post<any>('/api/admin/auth/login', { password: `BadAttempt_${i}` });
      if (res.status === 423 || res.status === 429) {
        lockoutTriggered = true;
        break;
      }
    }
    assert(lockoutTriggered, 'Test 4: Repeated failed attempts trigger lockout (423) or rate limit (429)');

    // Reset admin failed attempts and lockout in DB so subsequent tests can continue
    const adminUser = adminUsersRepository.findByEmail('admin@nexus.campus');
    if (adminUser) {
      adminUsersRepository.resetFailedAttemptsAndRecordLogin(adminUser.id);
    }
  }

  // -------------------------------------------------------------
  // Test 5: successful session creation
  // -------------------------------------------------------------
  console.log('\n--- 5. Successful Session Creation in SQLite ---');
  {
    // Re-authenticate to get a fresh clean session
    const res = await post<any>('/api/admin/auth/login', { password: masterPassword });
    assert(res.status === 200, 'Test 5: Re-authentication succeeds with HTTP 200');
    validSessionToken = res.body.data.token;
    const setCookie = res.headers.get('set-cookie') || '';
    validSessionCookie = setCookie.split(';')[0];

    // Verify session record in SQLite
    const activeSession = adminSessionsRepository.findActiveSession(hashToken(validSessionToken));
    assert(Boolean(activeSession), 'Test 5: Session record persisted in SQLite admin_sessions');
    if (activeSession) {
      assert(new Date(activeSession.expiresAt) > new Date(), 'Test 5: Session expiration is in the future');
    }
  }

  // -------------------------------------------------------------
  // Test 6: /admin without session
  // -------------------------------------------------------------
  console.log('\n--- 6. Admin Verification Without Session ---');
  {
    const res = await get<any>('/api/admin/auth/me');
    assert(res.status === 401, 'Test 6: /api/admin/auth/me without session returns HTTP 401');
    assert(res.body.error?.code === 'UNAUTHENTICATED', 'Test 6: Rejection code is UNAUTHENTICATED');
  }

  // -------------------------------------------------------------
  // Test 7: /admin with session
  // -------------------------------------------------------------
  console.log('\n--- 7. Admin Verification With Valid Session ---');
  {
    const res = await get<any>('/api/admin/auth/me', validSessionCookie);
    assert(res.status === 200, 'Test 7: /api/admin/auth/me with session returns HTTP 200');
    assert(res.body.data?.user?.email === 'admin@nexus.campus', 'Test 7: Resolves authorized admin user');
    assert(res.body.data?.permissions?.length > 0, 'Test 7: Returns admin permissions list');
  }

  // -------------------------------------------------------------
  // Test 8: /api/admin without session
  // -------------------------------------------------------------
  console.log('\n--- 8. Protected /api/admin/* Endpoints Without Session ---');
  {
    const protectedPaths = [
      '/api/admin/members',
      '/api/admin/projects',
      '/api/admin/events',
      '/api/admin/media',
      '/api/admin/audit-logs',
      '/api/admin/site-settings',
    ];

    let allRejected = true;
    for (const p of protectedPaths) {
      const res = await get<any>(p);
      if (res.status !== 401) {
        allRejected = false;
        console.error(`Endpoint ${p} returned ${res.status} instead of 401`);
      }
    }
    assert(allRejected, 'Test 8: All protected /api/admin/* endpoints strictly reject unauthenticated requests with 401');
  }

  // -------------------------------------------------------------
  // Test 9: logout
  // -------------------------------------------------------------
  console.log('\n--- 9. Administrative Logout Flow ---');
  {
    const logoutRes = await post<any>('/api/admin/auth/logout', {}, validSessionCookie);
    assert(logoutRes.status === 200, 'Test 9: POST /api/admin/auth/logout returns HTTP 200');

    // Verify session cookie was cleared
    const setCookie = logoutRes.headers.get('set-cookie') || '';
    assert(
      setCookie.includes('nexus_admin_session=;') || setCookie.includes('Max-Age=0') || setCookie.includes('expires='),
      'Test 9: Logout clears nexus_admin_session cookie'
    );

    // Verify session cannot be reused
    const meAfterLogout = await get<any>('/api/admin/auth/me', validSessionCookie);
    assert(meAfterLogout.status === 401, 'Test 9: Terminated session rejected with HTTP 401 on subsequent requests');
  }

  // -------------------------------------------------------------
  // Test 10: expired session
  // -------------------------------------------------------------
  console.log('\n--- 10. Expired Session Graceful Handling ---');
  {
    // Create an expired session record directly in SQLite
    const { token, tokenHash } = generateSessionToken();
    const expiredDate = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour in the past
    const expiredSessionId = `sess-expired-${Date.now()}`;

    const adminUser = adminUsersRepository.findByEmail('admin@nexus.campus')!;
    adminSessionsRepository.createSession(
      expiredSessionId,
      adminUser.id,
      tokenHash,
      expiredDate,
      '127.0.0.1',
      'TestRunner/1.0'
    );

    const expiredCookie = `nexus_admin_session=${token}`;
    const res = await get<any>('/api/admin/auth/me', expiredCookie);
    assert(res.status === 401, 'Test 10: Expired session returns HTTP 401');
    assert(res.body.error?.code === 'INVALID_SESSION', 'Test 10: Error code indicates INVALID_SESSION');
  }

  // -------------------------------------------------------------
  // Test 11: invalid session cookie
  // -------------------------------------------------------------
  console.log('\n--- 11. Invalid / Malformed Session Cookie ---');
  {
    const fabricatedCookie = 'nexus_admin_session=fabricated_token_def_404_not_found';
    const res = await get<any>('/api/admin/auth/me', fabricatedCookie);
    assert(res.status === 401, 'Test 11: Non-existent / fabricated session cookie returns HTTP 401');
    assert(res.body.error?.code === 'INVALID_SESSION', 'Test 11: Error code indicates INVALID_SESSION');
  }

  // Close ephemeral server
  server.close();

  console.log('\n===================================================');
  console.log(`  ONE-PASSWORD AUTH RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('===================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runAdminAuthTestSuite().catch((err) => {
  console.error('Fatal error running admin auth test suite:', err);
  process.exit(1);
});
