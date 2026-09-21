import { BaseRepository } from './base.repository.ts';

export interface EventRecord {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string;
  event_type: 'Workshop' | 'Showcase' | 'OpenStudio' | 'Meeting' | 'Hackathon' | string;
  event_date: string | null;
  event_time: string | null;
  event_start: string | null;
  event_end: string | null;
  venue: string | null;
  location: string | null;
  registration_url: string | null;
  cover_image: string | null;
  cover_image_url: string | null;
  cover_image_public_id: string | null;
  featured: number; // 0 or 1
  status: 'Draft' | 'Published' | 'Archived' | 'Upcoming' | 'Completed' | 'Cancelled' | string;
  capacity?: number | null;
  registration_enabled: number; // 0 or 1
  registration_start: string | null;
  registration_end: string | null;
  registration_status?: 'OPEN' | 'CLOSED' | 'INVITE_ONLY';
  published_at: string | null;
  confirmed_count?: number;
  created_at: string;
  updated_at: string;
}

export interface EventFilterOptions {
  status?: string;
  event_type?: string;
  year?: string;
  featured?: boolean;
  offset?: number;
  limit?: number;
}

export class EventsRepository extends BaseRepository<EventRecord> {
  constructor() {
    super('events');
  }

  public findPaginated(options: EventFilterOptions = {}): { items: EventRecord[]; total: number } {
    let whereClause = " WHERE LOWER(status) NOT IN ('draft', 'archived', 'cancelled')";
    const params: (string | number | null)[] = [];

    if (options.status) {
      whereClause = ' WHERE LOWER(status) = LOWER(?)';
      params.push(options.status);
    }
    if (options.event_type) {
      whereClause += ' AND LOWER(event_type) = LOWER(?)';
      params.push(options.event_type);
    }
    if (options.year) {
      whereClause += ' AND (event_date LIKE ? OR event_start LIKE ?)';
      params.push(`%${options.year}%`, `%${options.year}%`);
    }
    if (options.featured !== undefined) {
      whereClause += ' AND featured = ?';
      params.push(options.featured ? 1 : 0);
    }

    const countSql = `SELECT COUNT(*) as count FROM events${whereClause}`;
    const countRow = this.db.prepare(countSql).get(...params) as { count: number };
    const total = Number(countRow?.count || 0);

    let querySql = `
      SELECT 
        e.*,
        (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'CONFIRMED') as confirmed_count
      FROM events e
      ${whereClause} 
      ORDER BY COALESCE(e.event_start, e.event_date) ASC, e.created_at DESC
    `;
    const queryParams = [...params];

    if (options.limit !== undefined) {
      querySql += ' LIMIT ? OFFSET ?';
      queryParams.push(options.limit, options.offset || 0);
    }

    const items = this.db.prepare(querySql).all(...queryParams) as unknown as EventRecord[];
    return { items, total };
  }

  public findUpcoming(): EventRecord[] {
    const stmt = this.db.prepare(`
      SELECT 
        e.*,
        (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'CONFIRMED') as confirmed_count
      FROM events e
      WHERE LOWER(e.status) IN ('upcoming', 'published')
      ORDER BY COALESCE(e.event_start, e.event_date) ASC
    `);
    return stmt.all() as unknown as EventRecord[];
  }

  public findPast(): EventRecord[] {
    const stmt = this.db.prepare(`
      SELECT 
        e.*,
        (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'CONFIRMED') as confirmed_count
      FROM events e
      WHERE LOWER(e.status) = 'completed'
      ORDER BY COALESCE(e.event_start, e.event_date) DESC
    `);
    return stmt.all() as unknown as EventRecord[];
  }

  public findFeatured(): EventRecord[] {
    const stmt = this.db.prepare(`
      SELECT 
        e.*,
        (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'CONFIRMED') as confirmed_count
      FROM events e
      WHERE e.featured = 1 AND LOWER(e.status) NOT IN ('draft', 'archived')
      ORDER BY COALESCE(e.event_start, e.event_date) ASC
    `);
    return stmt.all() as unknown as EventRecord[];
  }

  public findById(id: string): EventRecord | null {
    const stmt = this.db.prepare(`
      SELECT 
        e.*,
        (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'CONFIRMED') as confirmed_count
      FROM events e
      WHERE e.id = ?
    `);
    const row = stmt.get(id);
    return (row as unknown as EventRecord) || null;
  }

  public findBySlug(slug: string): EventRecord | null {
    const stmt = this.db.prepare(`
      SELECT 
        e.*,
        (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'CONFIRMED') as confirmed_count
      FROM events e
      WHERE LOWER(e.slug) = LOWER(?) OR e.id = ?
    `);
    const row = stmt.get(slug, slug);
    return (row as unknown as EventRecord) || null;
  }

  public isSlugTaken(slug: string, excludeId?: string): boolean {
    let sql = 'SELECT id FROM events WHERE LOWER(slug) = LOWER(?)';
    const params: string[] = [slug.trim()];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    const row = this.db.prepare(sql).get(...params);
    return Boolean(row);
  }

  public create(data: Partial<EventRecord> & Pick<EventRecord, 'id' | 'slug' | 'title'>): EventRecord {
    const now = new Date().toISOString();
    const record: EventRecord = {
      id: data.id,
      slug: data.slug,
      title: data.title,
      description: data.description || '',
      event_type: data.event_type || 'Workshop',
      short_description: data.short_description || (data.description ? data.description.substring(0, 160) : null),
      location: data.location || data.venue || null,
      venue: data.venue || data.location || null,
      event_date: data.event_date || (data.event_start ? data.event_start.split('T')[0] : null),
      event_time: data.event_time || (data.event_start ? data.event_start.split('T')[1]?.substring(0, 5) : '18:00'),
      event_start: data.event_start || now,
      event_end: data.event_end || data.event_start || now,
      registration_url: data.registration_url || null,
      cover_image: data.cover_image || data.cover_image_url || null,
      cover_image_url: data.cover_image_url || data.cover_image || null,
      cover_image_public_id: data.cover_image_public_id || null,
      featured: data.featured !== undefined ? data.featured : 0,
      status: data.status || 'Draft',
      capacity: data.capacity !== undefined ? data.capacity : null,
      registration_enabled: data.registration_enabled !== undefined ? data.registration_enabled : 1,
      registration_start: data.registration_start || null,
      registration_end: data.registration_end || null,
      registration_status: data.registration_status || (data.registration_enabled === 0 ? 'CLOSED' : 'OPEN'),
      published_at: data.published_at || (LOWER_IS_PUB(data.status) ? now : null),
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO events (
        id, slug, title, short_description, description, event_type, 
        event_date, event_time, event_start, event_end, venue, location,
        registration_url, cover_image, cover_image_url, cover_image_public_id,
        featured, status, capacity, registration_enabled, registration_start, 
        registration_end, registration_status, published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.slug,
      record.title,
      record.short_description,
      record.description,
      record.event_type,
      record.event_date,
      record.event_time,
      record.event_start,
      record.event_end,
      record.venue,
      record.location,
      record.registration_url,
      record.cover_image,
      record.cover_image_url,
      record.cover_image_public_id,
      record.featured,
      record.status,
      record.capacity,
      record.registration_enabled,
      record.registration_start,
      record.registration_end,
      record.registration_status,
      record.published_at,
      record.created_at,
      record.updated_at
    );

    return record;
  }

  public update(id: string, data: Partial<EventRecord>): EventRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: EventRecord = {
      ...existing,
      ...data,
      id,
      short_description: data.short_description !== undefined ? data.short_description : existing.short_description,
      location: data.location !== undefined ? data.location : (data.venue !== undefined ? data.venue : existing.location),
      venue: data.venue !== undefined ? data.venue : (data.location !== undefined ? data.location : existing.venue),
      cover_image_url: data.cover_image_url !== undefined ? data.cover_image_url : (data.cover_image !== undefined ? data.cover_image : existing.cover_image_url),
      cover_image: data.cover_image !== undefined ? data.cover_image : (data.cover_image_url !== undefined ? data.cover_image_url : existing.cover_image),
      published_at: data.status === 'Draft'
        ? null
        : (data.status && LOWER_IS_PUB(data.status) && !existing.published_at
            ? now
            : (data.published_at !== undefined ? data.published_at : existing.published_at)),
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      UPDATE events SET
        slug = ?, title = ?, short_description = ?, description = ?, event_type = ?, 
        event_date = ?, event_time = ?, event_start = ?, event_end = ?, venue = ?, location = ?,
        registration_url = ?, cover_image = ?, cover_image_url = ?, cover_image_public_id = ?,
        featured = ?, status = ?, capacity = ?, registration_enabled = ?, registration_start = ?,
        registration_end = ?, registration_status = ?, published_at = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.slug,
      updated.title,
      updated.short_description,
      updated.description,
      updated.event_type,
      updated.event_date,
      updated.event_time,
      updated.event_start,
      updated.event_end,
      updated.venue,
      updated.location,
      updated.registration_url,
      updated.cover_image,
      updated.cover_image_url,
      updated.cover_image_public_id,
      updated.featured,
      updated.status,
      updated.capacity !== undefined ? updated.capacity : null,
      updated.registration_enabled !== undefined ? updated.registration_enabled : 1,
      updated.registration_start || null,
      updated.registration_end || null,
      updated.registration_status || (updated.registration_enabled === 0 ? 'CLOSED' : 'OPEN'),
      updated.published_at || null,
      updated.updated_at,
      id
    );

    return this.findById(id);
  }

  public findAllAdmin(options: {
    page?: number;
    limit?: number;
    status?: string;
    event_type?: string;
    registration_state?: string;
    search?: string;
    sort?: string;
  } = {}): { items: EventRecord[]; total: number } {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = ' WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.status && options.status !== 'all') {
      whereClause += ' AND LOWER(e.status) = LOWER(?)';
      params.push(options.status);
    }
    if (options.event_type && options.event_type !== 'all') {
      whereClause += ' AND LOWER(e.event_type) = LOWER(?)';
      params.push(options.event_type);
    }
    if (options.registration_state && options.registration_state !== 'all') {
      if (options.registration_state === 'open') {
        whereClause += " AND e.registration_enabled = 1 AND (e.registration_status = 'OPEN' OR e.registration_status IS NULL)";
      } else if (options.registration_state === 'closed') {
        whereClause += " AND (e.registration_enabled = 0 OR e.registration_status = 'CLOSED')";
      } else if (options.registration_state === 'full') {
        whereClause += ` AND e.capacity IS NOT NULL AND e.capacity > 0 AND (
          SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'CONFIRMED'
        ) >= e.capacity`;
      }
    }
    if (options.search) {
      whereClause += ' AND (LOWER(e.title) LIKE LOWER(?) OR LOWER(e.description) LIKE LOWER(?) OR LOWER(COALESCE(e.location, e.venue, \'\')) LIKE LOWER(?))';
      const q = `%${options.search}%`;
      params.push(q, q, q);
    }

    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM events e${whereClause}`);
    const countRow = countStmt.get(...params) as { count: number };
    const total = countRow.count;

    let orderBy = 'e.updated_at DESC, e.id ASC';
    if (options.sort === 'start_asc') orderBy = 'COALESCE(e.event_start, e.event_date) ASC';
    if (options.sort === 'start_desc') orderBy = 'COALESCE(e.event_start, e.event_date) DESC';
    if (options.sort === 'created_desc') orderBy = 'e.created_at DESC';

    const query = `
      SELECT 
        e.*,
        (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'CONFIRMED') as confirmed_count
      FROM events e
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    const items = this.db.prepare(query).all(...params, limit, offset) as unknown as EventRecord[];
    return { items, total };
  }

  public updateWithConcurrency(
    id: string,
    updates: Partial<EventRecord>,
    expectedUpdatedAt?: string
  ): { success: boolean; conflict?: boolean; event?: EventRecord } {
    const existing = this.findById(id);
    if (!existing) return { success: false };

    if (expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
      return { success: false, conflict: true, event: existing };
    }

    const updated = this.update(id, updates);
    return { success: true, event: updated || undefined };
  }

  public updateStatus(id: string, status: string): EventRecord | null {
    const now = new Date().toISOString();
    const existing = this.findById(id);
    if (!existing) return null;

    const publishedAt = status === 'Draft'
      ? null
      : (LOWER_IS_PUB(status) && !existing.published_at
          ? now
          : existing.published_at);

    const stmt = this.db.prepare('UPDATE events SET status = ?, published_at = ?, updated_at = ? WHERE id = ?');
    const result = stmt.run(status, publishedAt, now, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  }

  public toggleRegistration(id: string, enabled: boolean): EventRecord | null {
    const now = new Date().toISOString();
    const regEnabled = enabled ? 1 : 0;
    const regStatus = enabled ? 'OPEN' : 'CLOSED';
    const stmt = this.db.prepare('UPDATE events SET registration_enabled = ?, registration_status = ?, updated_at = ? WHERE id = ?');
    const result = stmt.run(regEnabled, regStatus, now, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  }

  public deleteEvent(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM events WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

function LOWER_IS_PUB(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'published' || s === 'upcoming';
}

export const eventsRepository = new EventsRepository();
