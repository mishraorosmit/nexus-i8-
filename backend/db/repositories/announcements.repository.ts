import { BaseRepository } from './base.repository.ts';

export interface AnnouncementRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  priority: 'Normal' | 'Urgent';
  publish_status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementFacets {
  total: number;
  published: number;
  draft: number;
  archived: number;
  urgent: number;
  expired: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class AnnouncementsRepository extends BaseRepository<AnnouncementRecord> {
  constructor() {
    super('announcements');
  }

  /**
   * Returns active, published, non-expired announcements for public consumers.
   * Prioritizes 'Urgent' priority, then recent publication timestamp.
   */
  public findPublishedPaginated(options: { offset?: number; limit?: number } = {}): {
    items: AnnouncementRecord[];
    total: number;
  } {
    const countRow = this.db
      .prepare(`
        SELECT COUNT(*) as count 
        FROM announcements 
        WHERE publish_status = 'published'
          AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
      `)
      .get() as { count: number };
    const total = Number(countRow?.count || 0);

    let querySql = `
      SELECT * FROM announcements
      WHERE publish_status = 'published'
        AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
      ORDER BY 
        CASE WHEN priority = 'Urgent' THEN 0 ELSE 1 END ASC,
        published_at DESC, 
        created_at DESC
    `;
    const params: number[] = [];

    if (options.limit !== undefined) {
      querySql += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const items = this.db.prepare(querySql).all(...params) as unknown as AnnouncementRecord[];
    return { items, total };
  }

  /**
   * Resolves a public announcement by ID or slug.
   * Rejects drafts, archived items, and expired announcements.
   */
  public findPublishedByIdOrSlug(identifier: string): AnnouncementRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM announcements 
      WHERE (id = ? OR slug = ?) 
        AND publish_status = 'published'
        AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
    `);
    const row = stmt.get(identifier, identifier);
    return (row as unknown as AnnouncementRecord) || null;
  }

  /**
   * For backwards compatibility with existing code.
   */
  public findPublishedById(id: string): AnnouncementRecord | null {
    return this.findPublishedByIdOrSlug(id);
  }

  public findById(id: string): AnnouncementRecord | null {
    const stmt = this.db.prepare('SELECT * FROM announcements WHERE id = ?');
    const row = stmt.get(id);
    return (row as unknown as AnnouncementRecord) || null;
  }

  public findBySlug(slug: string): AnnouncementRecord | null {
    const stmt = this.db.prepare('SELECT * FROM announcements WHERE slug = ?');
    const row = stmt.get(slug);
    return (row as unknown as AnnouncementRecord) || null;
  }

  public isSlugTaken(slug: string, excludeId?: string): boolean {
    if (excludeId) {
      const row = this.db
        .prepare('SELECT COUNT(*) as count FROM announcements WHERE slug = ? AND id != ?')
        .get(slug, excludeId) as { count: number };
      return Number(row?.count || 0) > 0;
    }
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM announcements WHERE slug = ?')
      .get(slug) as { count: number };
    return Number(row?.count || 0) > 0;
  }

  public create(data: Omit<AnnouncementRecord, 'created_at' | 'updated_at' | 'slug'> & { slug?: string }): AnnouncementRecord {
    const now = new Date().toISOString();
    let slug = data.slug ? slugify(data.slug) : slugify(data.title);
    if (!slug) slug = `ann-${Date.now()}`;

    // Ensure slug uniqueness
    let candidateSlug = slug;
    let counter = 1;
    while (this.isSlugTaken(candidateSlug)) {
      candidateSlug = `${slug}-${counter++}`;
    }
    slug = candidateSlug;

    const record: AnnouncementRecord = {
      ...data,
      slug,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO announcements (
        id, slug, title, summary, body, priority, publish_status,
        published_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.slug,
      record.title,
      record.summary,
      record.body,
      record.priority,
      record.publish_status,
      record.published_at,
      record.expires_at,
      record.created_at,
      record.updated_at
    );

    return record;
  }

  public update(id: string, data: Partial<AnnouncementRecord>): AnnouncementRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    let slug = existing.slug;
    if (data.slug !== undefined && data.slug !== null) {
      const sanitizedSlug = slugify(data.slug);
      if (sanitizedSlug && sanitizedSlug !== existing.slug) {
        if (this.isSlugTaken(sanitizedSlug, id)) {
          throw new Error(`Slug '${sanitizedSlug}' is already in use by another announcement.`);
        }
        slug = sanitizedSlug;
      }
    } else if (data.title !== undefined && (!existing.slug || existing.slug.trim() === '')) {
      slug = slugify(data.title) || existing.id;
    }

    const updated: AnnouncementRecord = {
      ...existing,
      ...data,
      id,
      slug,
      updated_at: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE announcements SET
        slug = ?, title = ?, summary = ?, body = ?, priority = ?, publish_status = ?,
        published_at = ?, expires_at = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.slug,
      updated.title,
      updated.summary,
      updated.body,
      updated.priority,
      updated.publish_status,
      updated.published_at,
      updated.expires_at,
      updated.updated_at,
      id
    );

    return updated;
  }

  public findAllAdmin(options: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    search?: string;
    sort?: string;
    order?: 'ASC' | 'DESC';
  } = {}): { items: AnnouncementRecord[]; total: number; facets: AnnouncementFacets } {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = ' WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.status && options.status !== 'all') {
      whereClause += ' AND LOWER(publish_status) = LOWER(?)';
      params.push(options.status);
    }
    if (options.priority && options.priority !== 'all') {
      whereClause += ' AND LOWER(priority) = LOWER(?)';
      params.push(options.priority);
    }
    if (options.search && options.search.trim().length > 0) {
      whereClause += ' AND (LOWER(title) LIKE LOWER(?) OR LOWER(summary) LIKE LOWER(?) OR LOWER(body) LIKE LOWER(?) OR LOWER(slug) LIKE LOWER(?))';
      const q = `%${options.search.trim()}%`;
      params.push(q, q, q, q);
    }

    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM announcements${whereClause}`);
    const countRow = countStmt.get(...params) as { count: number };
    const total = countRow.count;

    // Sorting with whitelist
    const allowedSortFields: Record<string, string> = {
      title: 'title',
      created_at: 'created_at',
      updated_at: 'updated_at',
      published_at: 'published_at',
      expires_at: 'expires_at',
      priority: 'priority',
    };
    const sortField = options.sort && allowedSortFields[options.sort] ? allowedSortFields[options.sort] : 'updated_at';
    const sortOrder = options.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT * FROM announcements
      ${whereClause}
      ORDER BY ${sortField} ${sortOrder}, created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = this.db.prepare(query).all(...params, limit, offset) as unknown as AnnouncementRecord[];

    const facets = this.getAdminFacets();

    return { items, total, facets };
  }

  public getAdminFacets(): AnnouncementFacets {
    const rows = this.db
      .prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN publish_status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN publish_status = 'draft' THEN 1 ELSE 0 END) as draft,
          SUM(CASE WHEN publish_status = 'archived' THEN 1 ELSE 0 END) as archived,
          SUM(CASE WHEN priority = 'Urgent' THEN 1 ELSE 0 END) as urgent,
          SUM(CASE WHEN expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now') THEN 1 ELSE 0 END) as expired
        FROM announcements
      `)
      .get() as any;

    return {
      total: Number(rows?.total || 0),
      published: Number(rows?.published || 0),
      draft: Number(rows?.draft || 0),
      archived: Number(rows?.archived || 0),
      urgent: Number(rows?.urgent || 0),
      expired: Number(rows?.expired || 0),
    };
  }

  public updateWithConcurrency(
    id: string,
    updates: Partial<AnnouncementRecord>,
    expectedUpdatedAt?: string
  ): { success: boolean; conflict?: boolean; announcement?: AnnouncementRecord } {
    const existing = this.findById(id);
    if (!existing) return { success: false };

    if (expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
      return { success: false, conflict: true, announcement: existing };
    }

    const updated = this.update(id, updates);
    return { success: true, announcement: updated || undefined };
  }

  public updateStatus(id: string, status: 'draft' | 'published' | 'archived'): AnnouncementRecord | null {
    const now = new Date().toISOString();
    const publishedAt = status === 'published' ? now : null;

    let query = 'UPDATE announcements SET publish_status = ?, updated_at = ?';
    const params: (string | null)[] = [status, now];

    if (status === 'published') {
      query += ', published_at = COALESCE(published_at, ?)';
      params.push(publishedAt);
    } else if (status === 'draft') {
      // Retain published_at or keep history, but status is draft
    }

    query += ' WHERE id = ?';
    params.push(id);

    const stmt = this.db.prepare(query);
    const result = stmt.run(...params);
    if (result.changes === 0) return null;
    return this.findById(id);
  }

  public deleteAnnouncement(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM announcements WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

export const announcementsRepository = new AnnouncementsRepository();
