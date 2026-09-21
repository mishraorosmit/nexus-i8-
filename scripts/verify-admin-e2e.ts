#!/usr/bin/env tsx

async function runVerification() {
  console.log('======================================================');
  console.log('  NEXUS ADMIN PORTAL BASE FOUNDATION E2E VERIFICATION  ');
  console.log('======================================================');

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, desc: string, details?: any) {
    total++;
    if (cond) {
      console.log(`✓ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${desc}`, details || '');
    }
  }

  // 1. Verify frontend dev server responds on /admin
  try {
    const res = await fetch('http://localhost:3000/admin');
    assert(res.status === 200, 'Frontend dev server serves /admin with HTTP 200');
    const text = await res.text();
    assert(text.includes('<div id="root">') || text.includes('<!DOCTYPE html>'), 'Frontend HTML includes root container');
  } catch (err) {
    assert(false, 'Frontend dev server on port 3000 unreachable', err);
  }

  // 2. Verify unauthenticated API access rejection
  try {
    const res = await fetch('http://localhost:3001/api/admin/auth/me');
    const data = await res.json();
    assert(res.status === 401 && data.error?.code === 'UNAUTHENTICATED', 'Unauthenticated /api/admin/auth/me rejects with 401 UNAUTHENTICATED');
  } catch (err) {
    assert(false, 'Backend API on port 3001 unreachable', err);
  }

  // 3. Verify One-Password login with invalid password
  try {
    const res = await fetch('http://localhost:3001/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'WrongPassword!999' }),
    });
    const data = await res.json();
    assert(res.status === 401 && data.error?.code === 'INVALID_CREDENTIALS', 'One-Password login rejects invalid password with 401 INVALID_CREDENTIALS');
  } catch (err) {
    assert(false, 'Backend login failed', err);
  }

  // 4. Verify One-Password login with correct master password
  let sessionCookie = '';
  try {
    const res = await fetch('http://localhost:3001/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'NexusAdmin!2026' }),
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie') || '';
    if (setCookie.includes('nexus_admin_session=')) {
      sessionCookie = setCookie.split(';')[0];
    }
    assert(res.status === 200, 'One-Password login succeeds with HTTP 200');
    assert(Boolean(data.data?.token), 'Login returns active session token');
    assert(data.data?.user?.role === 'super_admin', 'Login returns super_admin user profile');
    assert(sessionCookie.startsWith('nexus_admin_session='), 'Sets HttpOnly nexus_admin_session cookie');
  } catch (err) {
    assert(false, 'Backend login failed', err);
  }

  // 5. Verify session authentication using cookie on /api/admin/auth/me
  try {
    const res = await fetch('http://localhost:3001/api/admin/auth/me', {
      headers: { Cookie: sessionCookie },
    });
    const data = await res.json();
    assert(res.status === 200, 'GET /api/admin/auth/me with session cookie returns HTTP 200');
    assert(data.data?.user?.email === 'admin@nexus.campus', 'Session resolves correct admin user');
    assert(data.data?.permissions?.includes('manage_admins'), 'Super admin permissions verified');
  } catch (err) {
    assert(false, 'Session check failed', err);
  }

  // 6. Verify reserved route backend readiness
  const reservedEndpoints = [
    '/api/admin/members',
    '/api/admin/projects',
    '/api/admin/events',
    '/api/admin/media',
    '/api/admin/audit-logs',
    '/api/admin/site-settings',
  ];

  for (const ep of reservedEndpoints) {
    try {
      const res = await fetch(`http://localhost:3001${ep}`, {
        headers: { Cookie: sessionCookie },
      });
      assert(res.status === 200, `Reserved module backend endpoint ${ep} is operational (HTTP 200)`);
    } catch (err) {
      assert(false, `Reserved endpoint ${ep} failed`, err);
    }
  }

  // 7. Verify public showcase site is unaffected
  try {
    const res = await fetch('http://localhost:3000/');
    assert(res.status === 200, 'Public showcase homepage (/) returns HTTP 200');
  } catch (err) {
    assert(false, 'Public homepage failed', err);
  }

  // 8. Verify E-ID card endpoint & UI is unaffected
  try {
    const resPublic = await fetch('http://localhost:3000/memberID/orosmit-mishra/NX-026');
    assert(resPublic.status === 200, 'Public E-ID route (/memberID/...) returns HTTP 200');

    const resApi = await fetch('http://localhost:3001/api/eid/memberID/orosmit-mishra/NX-026');
    const eidData = await resApi.json();
    assert(resApi.status === 200, 'E-ID backend API returns HTTP 200');
    assert(eidData.data?.uniqueId === 'NX-026', 'E-ID data verifies uniqueId NX-026');
    assert(eidData.data?.name?.toUpperCase() === 'OROSMIT MISHRA', 'E-ID data verifies member name');
  } catch (err) {
    assert(false, 'E-ID verification failed', err);
  }

  // 9. Verify logout
  try {
    const res = await fetch('http://localhost:3001/api/admin/auth/logout', {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });
    assert(res.status === 200, 'POST /api/admin/auth/logout returns HTTP 200');

    // Verify session is invalidated
    const resAfter = await fetch('http://localhost:3001/api/admin/auth/me', {
      headers: { Cookie: sessionCookie },
    });
    assert(resAfter.status === 401, 'Session is invalid after logout (HTTP 401)');
  } catch (err) {
    assert(false, 'Logout failed', err);
  }

  console.log('======================================================');
  console.log(`  E2E VERIFICATION SUMMARY: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('======================================================');
}

runVerification();
