export const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  executed_at TEXT NOT NULL
);
`;

export const INITIAL_SCHEMA_SQL = `
-- 1. MEMBERS
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  public_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL,
  domain TEXT,
  bio TEXT,
  photo_url TEXT,
  image_position TEXT,
  social_links TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  joined_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_public_id ON members(public_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);

-- 2. PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  project_number TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  year TEXT NOT NULL,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  disciplines TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  featured INTEGER NOT NULL DEFAULT 0,
  technologies TEXT NOT NULL DEFAULT '[]',
  deliverables TEXT,
  cover_image TEXT,
  cover_image_url TEXT,
  cover_image_public_id TEXT,
  demo_url TEXT,
  live_url TEXT,
  repository_url TEXT,
  documentation_url TEXT,
  start_date TEXT,
  end_date TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(featured);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);

-- 3. PROJECT MEMBERS (Junction table with foreign keys)
CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  role TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, member_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_members_member ON project_members(member_id);

-- 4. EVENTS
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT,
  event_time TEXT,
  event_start TEXT,
  event_end TEXT,
  venue TEXT,
  location TEXT,
  registration_url TEXT,
  registration_enabled INTEGER NOT NULL DEFAULT 1,
  registration_start TEXT,
  registration_end TEXT,
  capacity INTEGER,
  cover_image TEXT,
  cover_image_url TEXT,
  cover_image_public_id TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft',
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(event_start);
CREATE INDEX IF NOT EXISTS idx_events_featured ON events(featured);

-- 5. ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  slug TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Normal',
  publish_status TEXT NOT NULL DEFAULT 'published',
  published_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_slug ON announcements(slug);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_status ON announcements(publish_status);
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON announcements(published_at);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);

-- 6. ARCHIVE ITEMS
CREATE TABLE IF NOT EXISTS archive_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  year TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  caption TEXT NOT NULL,
  media_reference TEXT NOT NULL,
  aspect_ratio TEXT,
  author TEXT,
  location TEXT,
  related_project_id TEXT,
  related_event_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (related_project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (related_event_id) REFERENCES events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_archive_category ON archive_items(category);
CREATE INDEX IF NOT EXISTS idx_archive_year ON archive_items(year);
CREATE INDEX IF NOT EXISTS idx_archive_project ON archive_items(related_project_id);
CREATE INDEX IF NOT EXISTS idx_archive_event ON archive_items(related_event_id);

-- 7. RESOURCES
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  url TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  published_status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(published_status);

-- 8. RECRUITMENT / CONTACT SUBMISSIONS
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT,
  metadata TEXT,
  status TEXT NOT NULL DEFAULT 'Unread',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);

-- 9. MEDIA ASSETS
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  storage_key TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_storage_key ON media_assets(storage_key);
CREATE INDEX IF NOT EXISTS idx_media_assets_mime_type ON media_assets(mime_type);

-- 10. SITE SETTINGS
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  value_type TEXT NOT NULL DEFAULT 'string',
  updated_at TEXT NOT NULL
);
`;

export const ADMIN_AND_AUDIT_SCHEMA_SQL = `
-- 11. ADMIN USERS
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'content_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- 12. ADMIN SESSIONS
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- 13. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  admin_name TEXT,
  admin_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
`;

export const SUBMISSIONS_AND_REGISTRATIONS_SCHEMA_SQL = `
-- 14. RECRUITMENT SUBMISSIONS
CREATE TABLE IF NOT EXISTS recruitment_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  year_of_study TEXT,
  selected_domain TEXT NOT NULL,
  interests TEXT NOT NULL DEFAULT '[]',
  portfolio_url TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  message TEXT,
  consent INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
  status_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recruitment_email ON recruitment_submissions(email);
CREATE INDEX IF NOT EXISTS idx_recruitment_domain ON recruitment_submissions(selected_domain);
CREATE INDEX IF NOT EXISTS idx_recruitment_status ON recruitment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_created_at ON recruitment_submissions(created_at);

-- 15. EVENT REGISTRATIONS
CREATE TABLE IF NOT EXISTS event_registrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  attendee_name TEXT NOT NULL,
  attendee_email TEXT NOT NULL,
  attendee_phone TEXT,
  organization TEXT,
  department TEXT,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'WAITLISTED', 'CANCELLED', 'ATTENDED')),
  metadata TEXT,
  registration_timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(event_id, attendee_email)
);

CREATE INDEX IF NOT EXISTS idx_event_reg_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_email ON event_registrations(attendee_email);
CREATE INDEX IF NOT EXISTS idx_event_reg_status ON event_registrations(status);
`;

export const EID_MEMBER_SCHEMA_SQL = `
-- 16. E-ID MEMBER IDENTITY FOUNDATION
-- Indexes for member identity resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unique_id ON members(unique_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_slug ON members(public_id);
`;

export const ADMIN_DATABASE_FOUNDATION_SQL = `
-- 17. ADMIN PORTAL DATABASE FOUNDATION
-- Unique indexes and constraints for stable identities and media readiness
DROP INDEX IF EXISTS idx_members_slug;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_slug ON members(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unique_id ON members(unique_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_cloudinary_public_id ON media_assets(cloudinary_public_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
`;


