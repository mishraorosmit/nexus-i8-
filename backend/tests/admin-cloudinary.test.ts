import assert from 'node:assert';
import { createApp } from '../app.ts';
import type { Server } from 'http';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../db/connection.ts';
import { seedDatabase } from '../db/seed.ts';
import { membersRepository } from '../db/repositories/members.repository.ts';
import { cloudinaryService } from '../services/cloudinary.service.ts';

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
console.log('  NEXUS ADMIN CLOUDINARY PROFILE IMAGE MANAGEMENT: E2E TEST SUITE  ');
console.log('===================================================================');

const masterPassword = process.env.INITIAL_ADMIN_PASSWORD || 'NexusAdmin!2026';
const app = createApp();
const PORT = 3897;
let server: Server;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Valid sample test buffers
const VALID_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const VALID_1X1_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

const VALID_WEBP = Buffer.from(
  'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
  'base64'
);

// Malicious / invalid buffers
const EXE_FAKE_IMAGE = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00Executable binary disguised as image');
const PLAIN_TEXT_FILE = Buffer.from('This is plain text and not a real image format at all.');

// Oversized PNG (> 5MB)
const OVERSIZED_PNG = Buffer.concat([
  VALID_1X1_PNG,
  Buffer.alloc(5 * 1024 * 1024 + 1024),
]);

async function runSuite() {
  const db = getDatabase();
  seedDatabase(db);

  // Enable test mock mode on Cloudinary service for deterministic execution
  cloudinaryService.setMockMode(true);
  cloudinaryService.resetTestState();

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  let sessionCookie = '';
  const allMembers = membersRepository.findAll({ status: 'all' });
  assert.ok(allMembers.length > 0, 'Seed members should exist');
  const testMember = allMembers.find((m) => m.unique_id === 'NX-026') || allMembers[0];
  const testMemberId = testMember.id;
  const testMemberSlug = testMember.slug || testMember.public_id;
  const testMemberUniqueId = testMember.unique_id || 'NX-026';

  try {
    // --- Test Group 1: Unauthenticated Endpoint Protection ---
    console.log('\n--- Test Group 1: Unauthenticated Endpoint Protection ---');

    await it('POST /api/admin/members/:id/image returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test.jpg',
          content: VALID_1X1_JPEG.toString('base64'),
        }),
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    await it('DELETE /api/admin/members/:id/image returns 401 when unauthenticated', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.data, null);
      assert.strictEqual(json.error.code, 'UNAUTHENTICATED');
    });

    // --- Test Group 2: Authenticated Session Setup ---
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
      assert.ok(match, 'Expected nexus_admin_session in cookie');
      sessionCookie = `nexus_admin_session=${match[1]}`;
    });

    // --- Test Group 3: Valid Format Uploads (JPEG, PNG, WebP) ---
    console.log('\n--- Test Group 3: Valid Image Uploads (JPEG, PNG, WebP) ---');

    await it('Upload valid JPEG image via JSON base64 updates SQLite record', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'profile-avatar.jpg',
          content: `data:image/jpeg;base64,${VALID_1X1_JPEG.toString('base64')}`,
        }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.ok(json.data.profile_image_url, 'profile_image_url should be set');
      assert.ok(json.data.profile_image_public_id, 'profile_image_public_id should be set');
      assert.strictEqual(json.data.profile_image_url, json.data.photo_url);

      // Verify SQLite state directly
      const memberInDb = membersRepository.findById(testMemberId);
      assert.ok(memberInDb);
      assert.strictEqual(memberInDb.profile_image_url, json.data.profile_image_url);
      assert.strictEqual(memberInDb.profile_image_public_id, json.data.profile_image_public_id);
    });

    await it('Upload valid PNG image via raw buffer / multipart updates SQLite record', async () => {
      const boundary = '----WebKitFormBoundaryNexusTest123';
      const multipartBody = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="new-avatar.png"\r\nContent-Type: image/png\r\n\r\n`
        ),
        VALID_1X1_PNG,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Cookie: sessionCookie,
        },
        body: multipartBody,
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.match(json.data.profile_image_url, /res\.cloudinary\.com/);
      assert.ok(json.data.profile_image_url.endsWith('.png'));
      assert.ok(json.data.profile_image_public_id.includes('nexus/profile-images'));
    });

    await it('Upload valid WebP image via JSON base64 updates SQLite record', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'compressed.webp',
          content: VALID_WEBP.toString('base64'),
        }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.error, null);
      assert.match(json.data.profile_image_url, /res\.cloudinary\.com/);
      assert.ok(json.data.profile_image_url.endsWith('.webp'));
    });

    // --- Test Group 4: Safe Replacement & Old Asset Cleanup ---
    console.log('\n--- Test Group 4: Safe Replacement & Old Asset Cleanup ---');

    await it('Replacing an existing image cleans up the previous Cloudinary asset after DB update', async () => {
      // 1. Initial upload
      const res1 = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'initial-photo.jpg',
          content: VALID_1X1_JPEG.toString('base64'),
        }),
      });
      const json1 = await res1.json();
      const firstPublicId = json1.data.profile_image_public_id;
      assert.ok(firstPublicId);

      // 2. Replacement upload
      const res2 = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'replacement-photo.png',
          content: VALID_1X1_PNG.toString('base64'),
        }),
      });
      assert.strictEqual(res2.status, 200);
      const json2 = await res2.json();
      const secondPublicId = json2.data.profile_image_public_id;
      assert.notStrictEqual(firstPublicId, secondPublicId);

      // 3. Confirm old asset was safely destroyed
      const destroyed = cloudinaryService.getDestroyedPublicIds();
      assert.ok(
        destroyed.includes(firstPublicId),
        `Previous asset "${firstPublicId}" should have been safely destroyed from Cloudinary`
      );

      // 4. Confirm new asset is the current active reference in DB
      const current = membersRepository.findById(testMemberId);
      assert.strictEqual(current?.profile_image_public_id, secondPublicId);
    });

    // --- Test Group 5: Image Removal ---
    console.log('\n--- Test Group 5: Image Removal ---');

    await it('DELETE /api/admin/members/:id/image clears image fields in SQLite and destroys asset', async () => {
      const before = membersRepository.findById(testMemberId);
      const publicIdToDelete = before?.profile_image_public_id;
      assert.ok(publicIdToDelete);

      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'DELETE',
        headers: { Cookie: sessionCookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.profile_image_url, null);
      assert.strictEqual(json.data.profile_image_public_id, null);
      assert.strictEqual(json.data.photo_url, null);

      // Confirm SQLite state
      const after = membersRepository.findById(testMemberId);
      assert.strictEqual(after?.profile_image_url, null);
      assert.strictEqual(after?.profile_image_public_id, null);
      assert.strictEqual(after?.photo_url, null);

      // Confirm Cloudinary destruction
      const destroyed = cloudinaryService.getDestroyedPublicIds();
      assert.ok(destroyed.includes(publicIdToDelete!));
    });

    await it('DELETE /api/admin/members/:id/image on member with no image succeeds gracefully', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'DELETE',
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.profile_image_url, null);
    });

    // --- Test Group 6: Strict Input Validation & Security Rejection ---
    console.log('\n--- Test Group 6: Strict Validation & Security Rejection ---');

    await it('Rejects executable payload disguised as image with 400 EXECUTABLE_REJECTED', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'hacked.png',
          content: EXE_FAKE_IMAGE.toString('base64'),
        }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'EXECUTABLE_REJECTED');
    });

    await it('Rejects oversized image (>5MB) with 413 FILE_TOO_LARGE', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'giant.png',
          content: OVERSIZED_PNG.toString('base64'),
        }),
      });

      assert.strictEqual(res.status, 413);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'FILE_TOO_LARGE');
    });

    await it('Rejects plain text file with 400 UNRECOGNIZED_FILE_SIGNATURE', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'notes.jpg',
          content: PLAIN_TEXT_FILE.toString('base64'),
        }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'UNRECOGNIZED_FILE_SIGNATURE');
    });

    await it('Rejects dangerous file extension with 400 DANGEROUS_FILE_EXTENSION', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'script.sh',
          content: VALID_1X1_PNG.toString('base64'),
        }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'DANGEROUS_FILE_EXTENSION');
    });

    await it('Returns 404 for non-existent member ID', async () => {
      const res = await fetch(`${BASE_URL}/api/admin/members/non-existent-999/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'avatar.png',
          content: VALID_1X1_PNG.toString('base64'),
        }),
      });

      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'MEMBER_NOT_FOUND');
    });

    // --- Test Group 7: Fault Tolerance & Error Handling ---
    console.log('\n--- Test Group 7: Fault Tolerance & Error Handling ---');

    await it('Cloudinary failure leaves SQLite database untouched', async () => {
      // First ensure member has a known image
      await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'safe-photo.jpg',
          content: VALID_1X1_JPEG.toString('base64'),
        }),
      });

      const before = membersRepository.findById(testMemberId);
      assert.ok(before?.profile_image_public_id);

      // Simulate Cloudinary failure
      cloudinaryService.setSimulateFailure('upload');

      const res = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'failed-photo.png',
          content: VALID_1X1_PNG.toString('base64'),
        }),
      });

      assert.strictEqual(res.status, 502);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'CLOUDINARY_UPLOAD_FAILED');

      // Verify SQLite state remains pristine
      const after = membersRepository.findById(testMemberId);
      assert.strictEqual(after?.profile_image_public_id, before?.profile_image_public_id);

      // Reset failure simulation
      cloudinaryService.setSimulateFailure(null);
    });

    // --- Test Group 8: Public Consumers Compatibility ---
    console.log('\n--- Test Group 8: Public Consumers Compatibility ---');

    await it('Public member endpoint (/api/members) reflects Cloudinary profile image', async () => {
      // Upload a fresh test avatar
      const upRes = await fetch(`${BASE_URL}/api/admin/members/${testMemberId}/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          filename: 'public-showcase-avatar.jpg',
          content: VALID_1X1_JPEG.toString('base64'),
        }),
      });
      const upJson = await upRes.json();
      const expectedUrl = upJson.data.profile_image_url;

      // Check public member profile
      const pubRes = await fetch(`${BASE_URL}/api/members/${testMemberSlug}`);
      assert.strictEqual(pubRes.status, 200);
      const pubJson = await pubRes.json();
      assert.strictEqual(pubJson.data.photoUrl, expectedUrl);
    });

    await it('Public E-ID endpoint (/api/eid/members) reflects Cloudinary profile image', async () => {
      const eidRes = await fetch(`${BASE_URL}/api/eid/members/${testMemberUniqueId}`);
      assert.strictEqual(eidRes.status, 200);
      const eidJson = await eidRes.json();
      assert.ok(eidJson.data.image);
      assert.match(eidJson.data.image, /res\.cloudinary\.com/);
    });

    // --- Test Group 9: Credential Security Audit ---
    console.log('\n--- Test Group 9: Client Bundle Credential Security Audit ---');

    await it('Production client bundle strictly contains zero Cloudinary API secrets', async () => {
      const distAssetsDir = path.resolve(process.cwd(), 'dist/assets');
      if (fs.existsSync(distAssetsDir)) {
        const files = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
        assert.ok(files.length > 0, 'Production bundle JS files should exist');

        for (const file of files) {
          const content = fs.readFileSync(path.join(distAssetsDir, file), 'utf-8');
          assert.strictEqual(
            content.includes('CLOUDINARY_API_SECRET'),
            false,
            `File ${file} must NEVER leak CLOUDINARY_API_SECRET variable`
          );
          assert.strictEqual(
            content.includes('NexusAdmin!2026'),
            false,
            `File ${file} must NEVER leak master admin password`
          );
        }
      }
    });

  } finally {
    cloudinaryService.setMockMode(false);
    cloudinaryService.resetTestState();
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
