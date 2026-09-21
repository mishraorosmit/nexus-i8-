import { getDatabase } from './connection.ts';
import {
  MIGRATIONS_TABLE_SQL,
  INITIAL_SCHEMA_SQL,
  ADMIN_AND_AUDIT_SCHEMA_SQL,
  SUBMISSIONS_AND_REGISTRATIONS_SCHEMA_SQL,
  EID_MEMBER_SCHEMA_SQL,
  ADMIN_DATABASE_FOUNDATION_SQL,
} from './schema.ts';

export interface Migration {
  id: string;
  name: string;
  up: (db: ReturnType<typeof getDatabase>) => void;
}

export const migrations: Migration[] = [
  {
    id: '001_initial_nexus_schema',
    name: 'Initial NEXUS core showcase schema',
    up: (db) => {
      db.exec(INITIAL_SCHEMA_SQL);
    },
  },
  {
    id: '002_admin_and_audit',
    name: 'Admin authentication, RBAC, sessions, and audit logging schema',
    up: (db) => {
      db.exec(ADMIN_AND_AUDIT_SCHEMA_SQL);

      // Add status column to archive_items if not present
      const columns = db.prepare('PRAGMA table_info(archive_items);').all() as Array<{ name: string }>;
      const hasStatus = columns.some((c) => c.name === 'status');
      if (!hasStatus) {
        db.exec("ALTER TABLE archive_items ADD COLUMN status TEXT NOT NULL DEFAULT 'published';");
        db.exec('CREATE INDEX IF NOT EXISTS idx_archive_status ON archive_items(status);');
      }
    },
  },
  {
    id: '003_submissions_and_registrations',
    name: 'Recruitment submissions, event registrations, and event capacity schema',
    up: (db) => {
      db.exec(SUBMISSIONS_AND_REGISTRATIONS_SCHEMA_SQL);

      // Add capacity and registration_status columns to events if not present
      const eventColumns = db.prepare('PRAGMA table_info(events);').all() as Array<{ name: string }>;
      const hasCapacity = eventColumns.some((c) => c.name === 'capacity');
      if (!hasCapacity) {
        db.exec('ALTER TABLE events ADD COLUMN capacity INTEGER DEFAULT NULL;');
      }
      const hasRegStatus = eventColumns.some((c) => c.name === 'registration_status');
      if (!hasRegStatus) {
        db.exec("ALTER TABLE events ADD COLUMN registration_status TEXT NOT NULL DEFAULT 'OPEN';");
        db.exec('CREATE INDEX IF NOT EXISTS idx_events_reg_status ON events(registration_status);');
      }
    },
  },
  {
    id: '004_eid_member_foundation',
    name: 'NEXUS E-ID Card member foundation with unique public identifiers',
    up: (db) => {
      const memberColumns = db.prepare('PRAGMA table_info(members);').all() as Array<{ name: string }>;
      const existingColNames = new Set(memberColumns.map((c) => c.name));

      if (!existingColNames.has('unique_id')) {
        db.exec('ALTER TABLE members ADD COLUMN unique_id TEXT;');
      }
      if (!existingColNames.has('display_name')) {
        db.exec('ALTER TABLE members ADD COLUMN display_name TEXT;');
      }
      if (!existingColNames.has('department')) {
        db.exec("ALTER TABLE members ADD COLUMN department TEXT DEFAULT 'ENGINEERING';");
      }
      if (!existingColNames.has('clearance_level')) {
        db.exec("ALTER TABLE members ADD COLUMN clearance_level TEXT DEFAULT 'LVL-03 // SPEC';");
      }
      if (!existingColNames.has('special_word')) {
        db.exec("ALTER TABLE members ADD COLUMN special_word TEXT DEFAULT 'VISIONARY';");
      }
      if (!existingColNames.has('quote')) {
        db.exec('ALTER TABLE members ADD COLUMN quote TEXT;');
      }
      if (!existingColNames.has('node_location')) {
        db.exec("ALTER TABLE members ADD COLUMN node_location TEXT DEFAULT 'SOA LAB 204 // BHUBANESWAR';");
      }
      if (!existingColNames.has('frequency')) {
        db.exec("ALTER TABLE members ADD COLUMN frequency TEXT DEFAULT '108.40 MHz';");
      }
      if (!existingColNames.has('security_zone')) {
        db.exec("ALTER TABLE members ADD COLUMN security_zone TEXT DEFAULT 'SEC // ALPHA';");
      }
      if (!existingColNames.has('badge_issue')) {
        db.exec("ALTER TABLE members ADD COLUMN badge_issue TEXT DEFAULT '2026.Q1';");
      }
      if (!existingColNames.has('skills')) {
        db.exec("ALTER TABLE members ADD COLUMN skills TEXT DEFAULT '[]';");
      }
      if (!existingColNames.has('current_focus')) {
        db.exec('ALTER TABLE members ADD COLUMN current_focus TEXT;');
      }
      if (!existingColNames.has('fun_fact')) {
        db.exec('ALTER TABLE members ADD COLUMN fun_fact TEXT;');
      }

      db.exec(EID_MEMBER_SCHEMA_SQL);
    },
  },
  {
    id: '005_admin_database_foundation',
    name: 'Admin Portal SQLite foundation: schema readiness, indexes, and column alignment',
    up: (db) => {
      // 1. Inspect members columns
      const memberColumns = db.prepare('PRAGMA table_info(members);').all() as Array<{ name: string }>;
      const memberColNames = new Set(memberColumns.map((c) => c.name));

      if (!memberColNames.has('slug')) {
        db.exec('ALTER TABLE members ADD COLUMN slug TEXT;');
        // Backfill slug from public_id where slug is null or empty
        db.exec("UPDATE members SET slug = public_id WHERE slug IS NULL OR slug = '';");
      }
      if (!memberColNames.has('profile_image_url')) {
        db.exec('ALTER TABLE members ADD COLUMN profile_image_url TEXT;');
        // Backfill profile_image_url from photo_url
        db.exec('UPDATE members SET profile_image_url = photo_url WHERE profile_image_url IS NULL;');
      }
      if (!memberColNames.has('profile_image_public_id')) {
        db.exec('ALTER TABLE members ADD COLUMN profile_image_public_id TEXT;');
      }
      if (!memberColNames.has('joined_at')) {
        db.exec('ALTER TABLE members ADD COLUMN joined_at TEXT;');
        // Backfill joined_at from joined_date
        db.exec('UPDATE members SET joined_at = joined_date WHERE joined_at IS NULL;');
      }

      // Normalize member status values to uppercase
      db.exec(`
        UPDATE members 
        SET status = UPPER(status) 
        WHERE status IN ('active', 'inactive', 'alumni');
      `);

      // 2. Inspect media_assets columns
      const mediaColumns = db.prepare('PRAGMA table_info(media_assets);').all() as Array<{ name: string }>;
      const mediaColNames = new Set(mediaColumns.map((c) => c.name));

      if (!mediaColNames.has('cloudinary_public_id')) {
        db.exec('ALTER TABLE media_assets ADD COLUMN cloudinary_public_id TEXT;');
        if (mediaColNames.has('storage_key')) {
          db.exec('UPDATE media_assets SET cloudinary_public_id = storage_key WHERE cloudinary_public_id IS NULL AND storage_key IS NOT NULL;');
        }
      }
      if (!mediaColNames.has('secure_url')) {
        db.exec('ALTER TABLE media_assets ADD COLUMN secure_url TEXT;');
        if (mediaColNames.has('storage_key')) {
          db.exec('UPDATE media_assets SET secure_url = storage_key WHERE secure_url IS NULL AND storage_key IS NOT NULL;');
        }
      }
      if (!mediaColNames.has('resource_type')) {
        db.exec("ALTER TABLE media_assets ADD COLUMN resource_type TEXT DEFAULT 'image';");
      }
      if (!mediaColNames.has('folder')) {
        db.exec("ALTER TABLE media_assets ADD COLUMN folder TEXT DEFAULT 'nexus';");
      }
      if (!mediaColNames.has('original_filename')) {
        db.exec('ALTER TABLE media_assets ADD COLUMN original_filename TEXT;');
        if (mediaColNames.has('filename')) {
          db.exec('UPDATE media_assets SET original_filename = filename WHERE original_filename IS NULL AND filename IS NOT NULL;');
        }
      }
      if (!mediaColNames.has('width')) {
        db.exec('ALTER TABLE media_assets ADD COLUMN width INTEGER;');
      }
      if (!mediaColNames.has('height')) {
        db.exec('ALTER TABLE media_assets ADD COLUMN height INTEGER;');
      }
      if (!mediaColNames.has('bytes')) {
        db.exec('ALTER TABLE media_assets ADD COLUMN bytes INTEGER;');
        if (mediaColNames.has('file_size')) {
          db.exec('UPDATE media_assets SET bytes = file_size WHERE bytes IS NULL AND file_size IS NOT NULL;');
        }
      }
      if (!mediaColNames.has('format')) {
        db.exec('ALTER TABLE media_assets ADD COLUMN format TEXT;');
      }
      if (!mediaColNames.has('updated_at')) {
        db.exec('ALTER TABLE media_assets ADD COLUMN updated_at TEXT;');
        if (mediaColNames.has('created_at')) {
          db.exec('UPDATE media_assets SET updated_at = created_at WHERE updated_at IS NULL;');
        }
      }

      // 3. Inspect audit_logs columns
      const auditColumns = db.prepare('PRAGMA table_info(audit_logs);').all() as Array<{ name: string }>;
      const auditColNames = new Set(auditColumns.map((c) => c.name));

      if (!auditColNames.has('admin_context')) {
        db.exec('ALTER TABLE audit_logs ADD COLUMN admin_context TEXT;');
      }
      if (!auditColNames.has('before_json')) {
        db.exec('ALTER TABLE audit_logs ADD COLUMN before_json TEXT;');
      }
      if (!auditColNames.has('after_json')) {
        db.exec('ALTER TABLE audit_logs ADD COLUMN after_json TEXT;');
      }

      // 4. Apply ADMIN_DATABASE_FOUNDATION_SQL indexes
      db.exec(ADMIN_DATABASE_FOUNDATION_SQL);
    },
  },
  {
    id: '006_member_search_filter_indexes',
    name: 'Add targeted SQLite indexes on members for search, filtering, and sorting performance',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_members_domain ON members(domain);
        CREATE INDEX IF NOT EXISTS idx_members_department ON members(department);
        CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
        CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);
      `);
    },
  },
  {
    id: '007_admin_settings_schema',
    name: 'Add value_type to site_settings and seed core runtime admin settings',
    up: (db) => {
      const settingCols = db.prepare('PRAGMA table_info(site_settings);').all() as Array<{ name: string }>;
      const hasValueType = settingCols.some((c) => c.name === 'value_type');
      if (!hasValueType) {
        db.exec("ALTER TABLE site_settings ADD COLUMN value_type TEXT NOT NULL DEFAULT 'string';");
      }

      // Backfill types for existing settings
      db.exec(`
        UPDATE site_settings SET value_type = 'string' WHERE key IN ('site_name', 'tagline', 'description', 'current_term', 'cohort_year', 'contact_email');
        UPDATE site_settings SET value_type = 'json' WHERE key IN ('socials', 'open_sessions');
      `);

      // Seed initial rows if missing
      const now = new Date().toISOString();
      const insertSetting = db.prepare(`
        INSERT OR IGNORE INTO site_settings (key, value, description, value_type, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertSetting.run('member_id_prefix', 'NX-', 'Permanent Member Unique ID Prefix', 'string', now);
      insertSetting.run('public_identity_label', 'NEXUS // E-ID', 'Public Identity Card Classification Label', 'string', now);
      insertSetting.run('eid_base_url', '', 'Public Canonical Base URL for E-ID Cards', 'string', now);
      insertSetting.run('maintenance_mode', 'false', 'Operational Maintenance Mode Flag', 'boolean', now);
    },
  },
  {
    id: '008_admin_projects_schema',
    name: 'Enhance projects schema with media fields, canonical URLs, publication lifecycle, and indexing',
    up: (db) => {
      const projectCols = db.prepare('PRAGMA table_info(projects);').all() as Array<{ name: string }>;
      const existingCols = new Set(projectCols.map((c) => c.name));

      if (!existingCols.has('cover_image_url')) {
        db.exec('ALTER TABLE projects ADD COLUMN cover_image_url TEXT;');
        db.exec('UPDATE projects SET cover_image_url = cover_image WHERE cover_image_url IS NULL AND cover_image IS NOT NULL;');
      }
      if (!existingCols.has('cover_image_public_id')) {
        db.exec('ALTER TABLE projects ADD COLUMN cover_image_public_id TEXT;');
      }
      if (!existingCols.has('live_url')) {
        db.exec('ALTER TABLE projects ADD COLUMN live_url TEXT;');
        db.exec('UPDATE projects SET live_url = demo_url WHERE live_url IS NULL AND demo_url IS NOT NULL;');
      }
      if (!existingCols.has('documentation_url')) {
        db.exec('ALTER TABLE projects ADD COLUMN documentation_url TEXT;');
      }
      if (!existingCols.has('start_date')) {
        db.exec('ALTER TABLE projects ADD COLUMN start_date TEXT;');
      }
      if (!existingCols.has('end_date')) {
        db.exec('ALTER TABLE projects ADD COLUMN end_date TEXT;');
      }
      if (!existingCols.has('published_at')) {
        db.exec('ALTER TABLE projects ADD COLUMN published_at TEXT;');
        db.exec(`
          UPDATE projects 
          SET published_at = created_at 
          WHERE published_at IS NULL AND LOWER(status) IN ('published', 'active', 'completed', 'incubating');
        `);
      }

      // Normalize project status values to standardized TitleCase ('Draft', 'Published', 'Archived')
      db.exec(`
        UPDATE projects SET status = 'Published' WHERE LOWER(status) IN ('published', 'active', 'completed', 'incubating');
        UPDATE projects SET status = 'Draft' WHERE LOWER(status) IN ('draft', 'inactive');
        UPDATE projects SET status = 'Archived' WHERE LOWER(status) = 'archived';
      `);

      // Ensure indexes exist for fast filtering, search, and sorting
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
        CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
        CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
        CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(featured);
        CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
        CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
      `);
    },
  },
  {
    id: '009_admin_events_and_registrations_schema',
    name: 'Enhance events with ISO UTC schedule, location, capacity, registration controls and attendee department',
    up: (db) => {
      // 1. Inspect events columns
      const eventCols = db.prepare('PRAGMA table_info(events);').all() as Array<{ name: string }>;
      const existingEventCols = new Set(eventCols.map((c) => c.name));

      if (!existingEventCols.has('short_description')) {
        db.exec('ALTER TABLE events ADD COLUMN short_description TEXT;');
        db.exec("UPDATE events SET short_description = SUBSTR(description, 1, 160) WHERE short_description IS NULL AND description IS NOT NULL;");
      }
      if (!existingEventCols.has('location')) {
        db.exec('ALTER TABLE events ADD COLUMN location TEXT;');
        db.exec('UPDATE events SET location = venue WHERE location IS NULL AND venue IS NOT NULL;');
      }
      if (!existingEventCols.has('event_start')) {
        db.exec('ALTER TABLE events ADD COLUMN event_start TEXT;');
        db.exec('UPDATE events SET event_start = created_at WHERE event_start IS NULL;');
      }
      if (!existingEventCols.has('event_end')) {
        db.exec('ALTER TABLE events ADD COLUMN event_end TEXT;');
        db.exec('UPDATE events SET event_end = event_start WHERE event_end IS NULL;');
      }
      if (!existingEventCols.has('registration_enabled')) {
        db.exec('ALTER TABLE events ADD COLUMN registration_enabled INTEGER NOT NULL DEFAULT 1;');
        db.exec(`
          UPDATE events 
          SET registration_enabled = CASE WHEN UPPER(registration_status) = 'CLOSED' THEN 0 ELSE 1 END
          WHERE registration_status IS NOT NULL;
        `);
      }
      if (!existingEventCols.has('registration_start')) {
        db.exec('ALTER TABLE events ADD COLUMN registration_start TEXT;');
      }
      if (!existingEventCols.has('registration_end')) {
        db.exec('ALTER TABLE events ADD COLUMN registration_end TEXT;');
      }
      if (!existingEventCols.has('cover_image_url')) {
        db.exec('ALTER TABLE events ADD COLUMN cover_image_url TEXT;');
        db.exec('UPDATE events SET cover_image_url = cover_image WHERE cover_image_url IS NULL AND cover_image IS NOT NULL;');
      }
      if (!existingEventCols.has('cover_image_public_id')) {
        db.exec('ALTER TABLE events ADD COLUMN cover_image_public_id TEXT;');
      }
      if (!existingEventCols.has('published_at')) {
        db.exec('ALTER TABLE events ADD COLUMN published_at TEXT;');
        db.exec(`
          UPDATE events 
          SET published_at = created_at 
          WHERE published_at IS NULL AND LOWER(status) IN ('published', 'upcoming', 'completed');
        `);
      }

      // Ensure indexes exist on events
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
        CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
        CREATE INDEX IF NOT EXISTS idx_events_start ON events(event_start);
        CREATE INDEX IF NOT EXISTS idx_events_featured ON events(featured);
      `);

      // 2. Inspect event_registrations columns
      const regCols = db.prepare('PRAGMA table_info(event_registrations);').all() as Array<{ name: string }>;
      const existingRegCols = new Set(regCols.map((c) => c.name));

      if (!existingRegCols.has('department')) {
        db.exec('ALTER TABLE event_registrations ADD COLUMN department TEXT;');
        db.exec('UPDATE event_registrations SET department = organization WHERE department IS NULL AND organization IS NOT NULL;');
      }

      // Ensure indexes on event_registrations
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_event_reg_event ON event_registrations(event_id);
        CREATE INDEX IF NOT EXISTS idx_event_reg_email ON event_registrations(attendee_email);
        CREATE INDEX IF NOT EXISTS idx_event_reg_status ON event_registrations(status);
      `);
    },
  },
  {
    id: '010_admin_media_library_schema',
    name: 'Add category, alt_text, uploaded_by to media_assets and sync existing imagery',
    up: (db) => {
      // 1. Inspect media_assets columns
      const mediaCols = db.prepare('PRAGMA table_info(media_assets);').all() as Array<{ name: string }>;
      const existingMediaCols = new Set(mediaCols.map((c) => c.name));

      if (!existingMediaCols.has('category')) {
        db.exec("ALTER TABLE media_assets ADD COLUMN category TEXT NOT NULL DEFAULT 'general';");
      }
      if (!existingMediaCols.has('alt_text')) {
        db.exec('ALTER TABLE media_assets ADD COLUMN alt_text TEXT;');
      }
      if (!existingMediaCols.has('uploaded_by')) {
        db.exec('ALTER TABLE media_assets ADD COLUMN uploaded_by TEXT;');
      }

      // Create index on category
      db.exec('CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets(category);');

      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO media_assets (
          id, storage_key, cloudinary_public_id, secure_url, resource_type, folder,
          original_filename, filename, mime_type, file_size, width, height, bytes, format,
          category, alt_text, uploaded_by, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Initial sync of existing content imagery into media_assets if not already tracked
      // 1. Members profile images
      try {
        const membersWithImages = db.prepare(`
          SELECT id, unique_id, name, slug, profile_image_url, profile_image_public_id, photo_url, created_at, updated_at
          FROM members
          WHERE (profile_image_url IS NOT NULL AND profile_image_url != '')
             OR (photo_url IS NOT NULL AND photo_url != '')
        `).all() as any[];

        for (const m of membersWithImages) {
          const url = m.profile_image_url || m.photo_url;
          const publicId = m.profile_image_public_id || url;
          const storageKey = m.profile_image_public_id || url;
          const filename = url.split('/').pop()?.split('?')[0] || `${m.slug || m.id}.webp`;
          const ext = filename.split('.').pop()?.toLowerCase() || 'webp';
          const mimeType = ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/webp';
          const assetId = `med-mem-${m.id}`;

          const existing = db.prepare('SELECT id FROM media_assets WHERE cloudinary_public_id = ? OR secure_url = ? OR storage_key = ?').get(publicId, url, storageKey);
          if (!existing) {
            insertStmt.run(
              assetId,
              storageKey,
              m.profile_image_public_id || null,
              url,
              'image',
              'nexus/profile-images',
              filename,
              filename,
              mimeType,
              45000,
              800,
              800,
              45000,
              ext,
              'member',
              `Profile photo for ${m.name}`,
              'System Cold-Boot Sync',
              JSON.stringify({ category: 'member', memberId: m.id, uniqueId: m.unique_id }),
              m.created_at || new Date().toISOString(),
              m.updated_at || new Date().toISOString()
            );
          }
        }
      } catch (err) {
        console.warn('[Migration 010] Note on members media sync:', err);
      }

      // 2. Projects cover images
      try {
        const projectsWithImages = db.prepare(`
          SELECT id, slug, title, cover_image, cover_image_url, cover_image_public_id, created_at, updated_at
          FROM projects
          WHERE (cover_image_url IS NOT NULL AND cover_image_url != '')
             OR (cover_image IS NOT NULL AND cover_image != '')
        `).all() as any[];

        for (const p of projectsWithImages) {
          const url = p.cover_image_url || p.cover_image;
          const publicId = p.cover_image_public_id || url;
          const storageKey = p.cover_image_public_id || url;
          const filename = url.split('/').pop()?.split('?')[0] || `${p.slug || p.id}.webp`;
          const ext = filename.split('.').pop()?.toLowerCase() || 'webp';
          const mimeType = ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : (ext === 'svg' ? 'image/svg+xml' : 'image/webp');
          const assetId = `med-prj-${p.id}`;

          const existing = db.prepare('SELECT id FROM media_assets WHERE cloudinary_public_id = ? OR secure_url = ? OR storage_key = ?').get(publicId, url, storageKey);
          if (!existing) {
            insertStmt.run(
              assetId,
              storageKey,
              p.cover_image_public_id || null,
              url,
              'image',
              'nexus/projects',
              filename,
              filename,
              mimeType,
              65000,
              1200,
              800,
              65000,
              ext,
              'project',
              `Cover image for ${p.title}`,
              'System Cold-Boot Sync',
              JSON.stringify({ category: 'project', projectId: p.id, slug: p.slug }),
              p.created_at || new Date().toISOString(),
              p.updated_at || new Date().toISOString()
            );
          }
        }
      } catch (err) {
        console.warn('[Migration 010] Note on projects media sync:', err);
      }

      // 3. Events cover images
      try {
        const eventsWithImages = db.prepare(`
          SELECT id, slug, title, cover_image, cover_image_url, cover_image_public_id, created_at, updated_at
          FROM events
          WHERE (cover_image_url IS NOT NULL AND cover_image_url != '')
             OR (cover_image IS NOT NULL AND cover_image != '')
        `).all() as any[];

        for (const e of eventsWithImages) {
          const url = e.cover_image_url || e.cover_image;
          const publicId = e.cover_image_public_id || url;
          const storageKey = e.cover_image_public_id || url;
          const filename = url.split('/').pop()?.split('?')[0] || `${e.slug || e.id}.webp`;
          const ext = filename.split('.').pop()?.toLowerCase() || 'webp';
          const mimeType = ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/webp';
          const assetId = `med-evt-${e.id}`;

          const existing = db.prepare('SELECT id FROM media_assets WHERE cloudinary_public_id = ? OR secure_url = ? OR storage_key = ?').get(publicId, url, storageKey);
          if (!existing) {
            insertStmt.run(
              assetId,
              storageKey,
              e.cover_image_public_id || null,
              url,
              'image',
              'nexus/events',
              filename,
              filename,
              mimeType,
              55000,
              1200,
              800,
              55000,
              ext,
              'event',
              `Cover image for ${e.title}`,
              'System Cold-Boot Sync',
              JSON.stringify({ category: 'event', eventId: e.id, slug: e.slug }),
              e.created_at || new Date().toISOString(),
              e.updated_at || new Date().toISOString()
            );
          }
        }
      } catch (err) {
        console.warn('[Migration 010] Note on events media sync:', err);
      }
    },
  },
  {
    id: '011_admin_announcements_schema',
    name: 'Add slug column, indexes, and synchronize slugs for announcements table',
    up: (db) => {
      // 1. Check if slug column exists in announcements
      const columns = db.prepare('PRAGMA table_info(announcements);').all() as Array<{ name: string }>;
      const hasSlug = columns.some((c) => c.name === 'slug');

      if (!hasSlug) {
        db.exec('ALTER TABLE announcements ADD COLUMN slug TEXT;');
      }

      // 2. Ensure indexes exist
      db.exec('CREATE INDEX IF NOT EXISTS idx_announcements_slug ON announcements(slug);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_announcements_publish_status ON announcements(publish_status);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON announcements(published_at);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);');

      // 3. Backfill missing slugs for existing announcements
      const rows = db.prepare('SELECT id, title, slug FROM announcements').all() as Array<{ id: string; title: string; slug: string | null }>;
      const updateStmt = db.prepare('UPDATE announcements SET slug = ? WHERE id = ?');

      for (const row of rows) {
        if (!row.slug) {
          const generatedSlug = row.title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || row.id;
          updateStmt.run(generatedSlug, row.id);
        }
      }
    },
  },
];


export function runMigrations(customDb?: ReturnType<typeof getDatabase>): { applied: string[]; total: number } {
  const db = customDb || getDatabase();

  // 1. Ensure migrations table exists
  db.exec(MIGRATIONS_TABLE_SQL);

  // 2. Fetch applied migrations
  const stmt = db.prepare('SELECT id FROM _migrations');
  const rows = stmt.all() as Array<{ id: string }>;
  const appliedSet = new Set(rows.map((r) => r.id));

  const newlyApplied: string[] = [];

  // 3. Execute unapplied migrations
  for (const migration of migrations) {
    if (!appliedSet.has(migration.id)) {
      console.log(`[Migration] Applying ${migration.id}: ${migration.name}...`);
      
      // Execute within transaction
      db.exec('BEGIN TRANSACTION;');
      try {
        migration.up(db);
        const recordStmt = db.prepare('INSERT INTO _migrations (id, name, executed_at) VALUES (?, ?, ?)');
        recordStmt.run(migration.id, migration.name, new Date().toISOString());
        db.exec('COMMIT;');
        newlyApplied.push(migration.id);
        console.log(`[Migration] ✓ Applied ${migration.id}`);
      } catch (err) {
        db.exec('ROLLBACK;');
        console.error(`[Migration] ✗ Failed ${migration.id}:`, err);
        throw err;
      }
    }
  }

  return {
    applied: newlyApplied,
    total: migrations.length,
  };
}

// Allow direct execution via CLI (node / tsx)
if (process.argv[1] && process.argv[1].includes('migrate')) {
  try {
    const result = runMigrations();
    console.log(`[Migration] Complete. ${result.applied.length} new migrations applied (${result.total} total).`);
  } catch (err) {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  }
}
