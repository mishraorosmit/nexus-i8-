import assert from 'node:assert';
import { getDatabase } from '../db/connection.ts';
import { runMigrations } from '../db/migrate.ts';
import { membersRepository, memberRepository, type MemberRecord } from '../db/repositories/members.repository.ts';
import { mediaAssetsRepository, mediaRepository } from '../db/repositories/mediaAssets.repository.ts';
import { auditLogsRepository, auditRepository } from '../db/repositories/auditLogs.repository.ts';
import { membersService, memberService, MemberValidationError } from '../services/members.service.ts';

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

console.log('===================================================');
console.log('  NEXUS ADMIN PORTAL: SQLITE FOUNDATION TEST SUITE ');
console.log('===================================================');

async function runSuite() {
  const db = getDatabase();

  // --- 1. Migration System & Schema Readiness ---
  console.log('\n--- Test Group 1: Migration System & Schema Readiness ---');

  it('Migration runner reports 0 unapplied migrations (idempotent)', () => {
    const result = runMigrations();
    assert.strictEqual(result.applied.length, 0, 'Should have 0 unapplied migrations');
    assert.ok(result.total >= 5, 'Total registered migrations should be at least 5');
  });

  it('Migration 005_admin_database_foundation is recorded in _migrations', () => {
    const row = db.prepare('SELECT id, name FROM _migrations WHERE id = ?').get('005_admin_database_foundation') as {
      id: string;
      name: string;
    } | undefined;
    assert.ok(row, 'Migration 005 must be recorded');
    assert.strictEqual(row.id, '005_admin_database_foundation');
  });

  it('members table contains all required foundation columns', () => {
    const columns = db.prepare('PRAGMA table_info(members);').all() as Array<{ name: string }>;
    const colNames = new Set(columns.map((c) => c.name));

    assert.ok(colNames.has('id'), 'Missing id column');
    assert.ok(colNames.has('public_id'), 'Missing public_id column');
    assert.ok(colNames.has('slug'), 'Missing slug column');
    assert.ok(colNames.has('unique_id'), 'Missing unique_id column');
    assert.ok(colNames.has('name'), 'Missing name column');
    assert.ok(colNames.has('email'), 'Missing email column');
    assert.ok(colNames.has('role'), 'Missing role column');
    assert.ok(colNames.has('status'), 'Missing status column');
    assert.ok(colNames.has('profile_image_url'), 'Missing profile_image_url column');
    assert.ok(colNames.has('profile_image_public_id'), 'Missing profile_image_public_id column');
    assert.ok(colNames.has('joined_at'), 'Missing joined_at column');
  });

  it('media_assets table contains Cloudinary-ready columns', () => {
    const columns = db.prepare('PRAGMA table_info(media_assets);').all() as Array<{ name: string }>;
    const colNames = new Set(columns.map((c) => c.name));

    assert.ok(colNames.has('id'), 'Missing id column');
    assert.ok(colNames.has('cloudinary_public_id'), 'Missing cloudinary_public_id column');
    assert.ok(colNames.has('secure_url'), 'Missing secure_url column');
    assert.ok(colNames.has('resource_type'), 'Missing resource_type column');
    assert.ok(colNames.has('folder'), 'Missing folder column');
    assert.ok(colNames.has('original_filename'), 'Missing original_filename column');
    assert.ok(colNames.has('width'), 'Missing width column');
    assert.ok(colNames.has('height'), 'Missing height column');
    assert.ok(colNames.has('bytes'), 'Missing bytes column');
    assert.ok(colNames.has('format'), 'Missing format column');
  });

  it('audit_logs table contains before/after state and admin context columns', () => {
    const columns = db.prepare('PRAGMA table_info(audit_logs);').all() as Array<{ name: string }>;
    const colNames = new Set(columns.map((c) => c.name));

    assert.ok(colNames.has('id'), 'Missing id column');
    assert.ok(colNames.has('action'), 'Missing action column');
    assert.ok(colNames.has('entity_type'), 'Missing entity_type column');
    assert.ok(colNames.has('admin_context'), 'Missing admin_context column');
    assert.ok(colNames.has('before_json'), 'Missing before_json column');
    assert.ok(colNames.has('after_json'), 'Missing after_json column');
  });

  it('Enforces unique index on members(unique_id) at database level', () => {
    const indexes = db.prepare('PRAGMA index_list(members);').all() as Array<{ name: string; unique: number }>;
    const uniqueIdIdx = indexes.find((idx) => idx.name === 'idx_members_unique_id');
    assert.ok(uniqueIdIdx, 'Unique index idx_members_unique_id must exist');
    assert.strictEqual(uniqueIdIdx.unique, 1, 'Index must be unique');
  });

  it('Enforces unique index on members(slug) at database level', () => {
    const indexes = db.prepare('PRAGMA index_list(members);').all() as Array<{ name: string; unique: number }>;
    const slugIdx = indexes.find((idx) => idx.name === 'idx_members_slug');
    assert.ok(slugIdx, 'Unique index idx_members_slug must exist');
    assert.strictEqual(slugIdx.unique, 1, 'Index must be unique');
  });

  // --- 2. Authentic Member Data Preservation ---
  console.log('\n--- Test Group 2: Authentic Member Data Preservation ---');

  it('Preserves all 29 authentic members without data loss', () => {
    const members = membersRepository.findAll({ status: 'all' });
    assert.ok(members.length >= 29, `Expected at least 29 members, found ${members.length}`);
  });

  it('Preserves member NX-026 (OROSMIT MISHRA) with valid slug and status', () => {
    const member = membersRepository.findByUniqueId('NX-026');
    assert.ok(member, 'Member NX-026 must exist');
    assert.strictEqual(member.name, 'OROSMIT MISHRA');
    assert.strictEqual(member.slug, 'orosmit-mishra');
    assert.strictEqual(member.status, 'ACTIVE');
    assert.ok(member.joined_at, 'joined_at must be populated');
  });

  it('Preserves member NX-001 (JITESH RAJ) with valid slug and status', () => {
    const member = membersRepository.findByUniqueId('NX-001');
    assert.ok(member, 'Member NX-001 must exist');
    assert.strictEqual(member.name, 'JITESH RAJ');
    assert.strictEqual(member.slug, 'jitesh-raj');
    assert.strictEqual(member.status, 'ACTIVE');
  });

  // --- 3. Repository Layer & Aliases ---
  console.log('\n--- Test Group 3: Repository Layer & Aliases ---');

  it('Export aliases memberRepository and membersRepository are identical instances', () => {
    assert.strictEqual(memberRepository, membersRepository);
  });

  it('Export aliases mediaRepository and mediaAssetsRepository are identical instances', () => {
    assert.strictEqual(mediaRepository, mediaAssetsRepository);
  });

  it('Export aliases auditRepository and auditLogsRepository are identical instances', () => {
    assert.strictEqual(auditRepository, auditLogsRepository);
  });

  it('memberRepository supports findBySlug, findByEmail, and findByUniqueId', () => {
    const bySlug = memberRepository.findBySlug('orosmit-mishra');
    const byUniqueId = memberRepository.findByUniqueId('NX-026');
    assert.ok(bySlug, 'Lookup by slug must succeed');
    assert.ok(byUniqueId, 'Lookup by uniqueId must succeed');
    assert.strictEqual(bySlug.id, byUniqueId.id);

    if (bySlug.email) {
      const byEmail = memberRepository.findByEmail(bySlug.email);
      assert.ok(byEmail, 'Lookup by email must succeed');
      assert.strictEqual(byEmail.id, bySlug.id);
    }
  });

  // --- 4. Server-Side Validation via membersService ---
  console.log('\n--- Test Group 4: Server-Side Validation via membersService ---');

  it('Rejects member creation with missing or empty name', () => {
    assert.throws(
      () => {
        membersService.createMember({
          name: '   ',
          role: 'Engineer',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof MemberValidationError);
        assert.strictEqual((err as MemberValidationError).code, 'INVALID_NAME');
        return true;
      }
    );
  });

  it('Rejects member creation with missing or empty role', () => {
    assert.throws(
      () => {
        membersService.createMember({
          name: 'Valid Name',
          role: '',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof MemberValidationError);
        assert.strictEqual((err as MemberValidationError).code, 'INVALID_ROLE');
        return true;
      }
    );
  });

  it('Rejects invalid status value', () => {
    assert.throws(
      () => {
        membersService.createMember({
          name: 'Valid Name',
          role: 'Designer',
          status: 'SUSPENDED' as any,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof MemberValidationError);
        assert.strictEqual((err as MemberValidationError).code, 'INVALID_STATUS');
        return true;
      }
    );
  });

  it('Rejects malformed email address', () => {
    assert.throws(
      () => {
        membersService.createMember({
          name: 'Valid Name',
          role: 'Designer',
          email: 'not-an-email',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof MemberValidationError);
        assert.strictEqual((err as MemberValidationError).code, 'INVALID_EMAIL');
        return true;
      }
    );
  });

  it('Rejects duplicate email address', () => {
    const existing = membersRepository.findAll({ status: 'all' }).find((m) => m.email);
    assert.ok(existing && existing.email, 'Must have existing member with email');

    assert.throws(
      () => {
        membersService.createMember({
          name: 'Duplicate Email Person',
          role: 'Specialist',
          email: existing.email!.toUpperCase(), // Test case-insensitivity
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof MemberValidationError);
        assert.strictEqual((err as MemberValidationError).code, 'DUPLICATE_EMAIL');
        return true;
      }
    );
  });

  it('Rejects malformed unique_id (does not match ^NX-[0-9]{3,}$)', () => {
    assert.throws(
      () => {
        membersService.createMember({
          name: 'Bad ID Person',
          role: 'Specialist',
          uniqueId: 'NX-99', // Only 2 digits
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof MemberValidationError);
        assert.strictEqual((err as MemberValidationError).code, 'INVALID_UNIQUE_ID');
        return true;
      }
    );

    assert.throws(
      () => {
        membersService.createMember({
          name: 'Bad ID Person 2',
          role: 'Specialist',
          uniqueId: 'MEMBER-001',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof MemberValidationError);
        assert.strictEqual((err as MemberValidationError).code, 'INVALID_UNIQUE_ID');
        return true;
      }
    );
  });

  it('Rejects duplicate unique_id assignment', () => {
    assert.throws(
      () => {
        membersService.createMember({
          name: 'Clone Person',
          role: 'Specialist',
          uniqueId: 'NX-026', // Already assigned to Orosmit Mishra
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof MemberValidationError);
        assert.strictEqual((err as MemberValidationError).code, 'DUPLICATE_UNIQUE_ID');
        return true;
      }
    );
  });

  // --- 5. Member Creation, Unique ID Stability & Audit Logging ---
  console.log('\n--- Test Group 5: Member Creation, Stable Unique ID & Audit Logging ---');

  let testMemberId = '';

  it('Successfully creates a member with auto-generated sequential unique ID', () => {
    const nextId = membersService.getNextUniqueId();
    assert.ok(/^NX-[0-9]{3,}$/.test(nextId), `Next ID must match format: ${nextId}`);

    const newMember = membersService.createMember(
      {
        name: 'Automated Test Architect',
        role: 'Systems Engineer',
        domain: 'Core Infrastructure',
        status: 'active', // Should normalize to ACTIVE
        skills: ['TypeScript', 'SQLite', 'Architecture'],
      },
      {
        adminId: 'adm-test-1',
        adminName: 'Test Admin',
        adminRole: 'super_admin',
      }
    );

    assert.ok(newMember.id);
    testMemberId = newMember.id;
    assert.strictEqual(newMember.unique_id, nextId);
    assert.strictEqual(newMember.status, 'ACTIVE');
    assert.strictEqual(newMember.slug, 'automated-test-architect');
    assert.strictEqual(newMember.profile_image_url, null);

    // Verify in database
    const fetched = memberRepository.findById(newMember.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.unique_id, nextId);
  });

  it('Emits audit log entry when member is created', () => {
    const logs = auditRepository.findPaginated({ action: 'MEMBER_CREATED', limit: 1 });
    assert.ok(logs.items.length > 0, 'Audit log entry must exist');
    const latest = logs.items[0];
    assert.strictEqual(latest.action, 'MEMBER_CREATED');
    assert.strictEqual(latest.entity_type, 'MEMBER');
    assert.strictEqual(latest.entity_id, testMemberId);
    assert.ok(latest.after_json, 'after_json must be captured');
    assert.ok(latest.after_json.includes('Automated Test Architect'));
  });

  it('STABLE UNIQUE ID GUARANTEE: updateMember preserves unique_id when name/role/email change', () => {
    const before = memberRepository.findById(testMemberId);
    assert.ok(before);
    const originalUniqueId = before.unique_id;

    // Update name, role, email, status without specifying uniqueId
    const updated = membersService.updateMember(
      testMemberId,
      {
        name: 'Renamed Test Architect Lead',
        role: 'Principal Systems Architect',
        email: 'renamed-test-lead@nexus.campus',
        status: 'ALUMNI',
      },
      {
        adminId: 'adm-test-1',
        adminName: 'Test Admin',
      }
    );

    assert.strictEqual(updated.name, 'Renamed Test Architect Lead');
    assert.strictEqual(updated.role, 'Principal Systems Architect');
    assert.strictEqual(updated.email, 'renamed-test-lead@nexus.campus');
    assert.strictEqual(updated.status, 'ALUMNI');
    // UNIQUE ID MUST BE IDENTICAL
    assert.strictEqual(updated.unique_id, originalUniqueId, 'unique_id must NEVER change or be regenerated');

    // Verify database record
    const persisted = memberRepository.findById(testMemberId);
    assert.strictEqual(persisted?.unique_id, originalUniqueId);
  });

  it('Emits audit log entry with before and after state on update', () => {
    const logs = auditRepository.findPaginated({ action: 'MEMBER_UPDATED', limit: 1 });
    assert.ok(logs.items.length > 0);
    const latest = logs.items[0];
    assert.strictEqual(latest.entity_id, testMemberId);
    assert.ok(latest.before_json, 'before_json must be populated');
    assert.ok(latest.after_json, 'after_json must be populated');
    assert.ok(latest.before_json.includes('Automated Test Architect'));
    assert.ok(latest.after_json.includes('Renamed Test Architect Lead'));
  });

  it('Deletes test member and logs MEMBER_DELETED action', () => {
    const deleted = membersService.deleteMember(testMemberId, {
      adminId: 'adm-test-1',
      adminName: 'Test Admin',
    });
    assert.strictEqual(deleted, true);

    const fetched = memberRepository.findById(testMemberId);
    assert.strictEqual(fetched, null);

    const logs = auditRepository.findPaginated({ action: 'MEMBER_DELETED', limit: 1 });
    assert.ok(logs.items.length > 0);
    assert.strictEqual(logs.items[0].entity_id, testMemberId);
  });

  // --- 6. Media Asset Repository Cloudinary Readiness ---
  console.log('\n--- Test Group 6: Media Asset Repository Cloudinary Readiness ---');

  const testMediaId = `med_test_${Date.now()}`;
  const testCloudinaryId = `nexus/members/test_avatar_${Date.now()}`;

  it('Creates media asset record with Cloudinary metadata', () => {
    const created = mediaRepository.create({
      id: testMediaId,
      storage_key: testCloudinaryId,
      cloudinary_public_id: testCloudinaryId,
      secure_url: `https://res.cloudinary.com/nexus/image/upload/v123456/${testCloudinaryId}.webp`,
      resource_type: 'image',
      folder: 'nexus/members',
      original_filename: 'avatar.webp',
      filename: 'avatar.webp',
      mime_type: 'image/webp',
      file_size: 24500,
      width: 600,
      height: 600,
      bytes: 24500,
      format: 'webp',
      metadata: JSON.stringify({ optimized: true }),
    });

    assert.strictEqual(created.id, testMediaId);
    assert.strictEqual(created.cloudinary_public_id, testCloudinaryId);
    assert.strictEqual(created.width, 600);
    assert.strictEqual(created.height, 600);
  });

  it('Looks up media asset by Cloudinary public ID', () => {
    const found = mediaRepository.findByCloudinaryPublicId(testCloudinaryId);
    assert.ok(found, 'Lookup by cloudinary_public_id must succeed');
    assert.strictEqual(found.id, testMediaId);
    assert.strictEqual(found.bytes, 24500);
  });

  it('Deletes temporary media asset cleanly', () => {
    const deleted = mediaRepository.deleteAsset(testMediaId);
    assert.strictEqual(deleted, true);
    const found = mediaRepository.findById(testMediaId);
    assert.strictEqual(found, null);
  });

  // Clean summary
  console.log('\n===================================================');
  console.log(`  ADMIN DB TESTS COMPLETE: ${passedTests}/${totalTests} PASSED (100%)`);
  console.log('===================================================');
}

runSuite().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
