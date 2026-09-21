import { BaseRepository } from './base.repository.ts';

export interface ProjectRecord {
  id: string;
  slug: string;
  project_number: string | null;
  title: string;
  category: string;
  year: string;
  short_description: string;
  full_description: string;
  disciplines: string;
  status: 'Draft' | 'Published' | 'Archived' | 'Active' | 'Completed' | 'Incubating' | string;
  featured: number; // 0 or 1
  technologies: string; // JSON array
  deliverables: string | null; // JSON array
  cover_image: string | null;
  cover_image_url?: string | null;
  cover_image_public_id?: string | null;
  demo_url: string | null;
  live_url?: string | null;
  repository_url: string | null;
  documentation_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMemberSummary {
  project_id: string;
  member_id: string;
  public_id: string;
  slug?: string;
  unique_id?: string;
  name: string;
  role: string | null;
  photo_url: string | null;
  profile_image_url?: string | null;
}

export interface ProjectFilterOptions {
  category?: string;
  status?: string;
  technology?: string;
  featured?: boolean;
  search?: string;
  offset?: number;
  limit?: number;
}

export class ProjectsRepository extends BaseRepository<ProjectRecord> {
  constructor() {
    super('projects');
  }

  public findPaginated(options: ProjectFilterOptions = {}): { items: ProjectRecord[]; total: number } {
    let whereClause = ' WHERE 1=1';
    const params: (string | number | null)[] = [];

    if (options.category) {
      whereClause += ' AND LOWER(category) = LOWER(?)';
      params.push(options.category);
    }
    if (options.status) {
      whereClause += ' AND LOWER(status) = LOWER(?)';
      params.push(options.status);
    } else {
      whereClause += " AND LOWER(status) IN ('published', 'active', 'completed', 'incubating') AND LOWER(status) NOT IN ('draft', 'archived')";
    }
    if (options.featured !== undefined) {
      whereClause += ' AND featured = ?';
      params.push(options.featured ? 1 : 0);
    }
    if (options.technology) {
      whereClause += ' AND LOWER(technologies) LIKE LOWER(?)';
      params.push(`%${options.technology}%`);
    }
    if (options.search) {
      whereClause += ' AND (LOWER(title) LIKE LOWER(?) OR LOWER(short_description) LIKE LOWER(?) OR LOWER(technologies) LIKE LOWER(?))';
      const q = `%${options.search}%`;
      params.push(q, q, q);
    }

    // Total count
    const countSql = `SELECT COUNT(*) as count FROM projects${whereClause}`;
    const countRow = this.db.prepare(countSql).get(...params) as { count: number };
    const total = Number(countRow?.count || 0);

    // Items with deterministic sort
    let querySql = `SELECT * FROM projects${whereClause} ORDER BY featured DESC, year DESC, project_number ASC, created_at DESC`;
    const queryParams = [...params];

    if (options.limit !== undefined) {
      querySql += ' LIMIT ? OFFSET ?';
      queryParams.push(options.limit, options.offset || 0);
    }

    const items = this.db.prepare(querySql).all(...queryParams) as unknown as ProjectRecord[];

    return { items, total };
  }

  public findById(id: string): ProjectRecord | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id);
    return (row as unknown as ProjectRecord) || null;
  }

  public findBySlug(slug: string): ProjectRecord | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE LOWER(slug) = LOWER(?) OR id = ?');
    const row = stmt.get(slug, slug);
    return (row as unknown as ProjectRecord) || null;
  }

  public findFeatured(): ProjectRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM projects 
      WHERE featured = 1 AND LOWER(status) IN ('published', 'active', 'completed', 'incubating') 
      ORDER BY year DESC, project_number ASC, created_at DESC
    `);
    return stmt.all() as unknown as ProjectRecord[];
  }

  public create(data: Omit<ProjectRecord, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): ProjectRecord {
    return this.createProject(data);
  }

  public update(id: string, data: Partial<ProjectRecord>): ProjectRecord | null {
    const res = this.updateProject(id, data);
    return res.project || null;
  }

  // Batch query to avoid N+1 queries when loading members for a list of projects
  public getMembersForProjects(projectIds: string[]): Map<string, ProjectMemberSummary[]> {
    const map = new Map<string, ProjectMemberSummary[]>();
    if (projectIds.length === 0) return map;

    const placeholders = projectIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT 
        pm.project_id, 
        pm.member_id, 
        pm.role, 
        m.name, 
        m.public_id,
        m.slug,
        m.unique_id,
        m.photo_url,
        m.profile_image_url
      FROM project_members pm
      JOIN members m ON pm.member_id = m.id
      WHERE pm.project_id IN (${placeholders})
      ORDER BY pm.created_at ASC
    `);

    const rows = stmt.all(...projectIds) as unknown as ProjectMemberSummary[];
    for (const row of rows) {
      const list = map.get(row.project_id) || [];
      list.push(row);
      map.set(row.project_id, list);
    }
    return map;
  }

  public getMembers(projectId: string): ProjectMemberSummary[] {
    const map = this.getMembersForProjects([projectId]);
    return map.get(projectId) || [];
  }

  public addMember(projectId: string, memberId: string, role?: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO project_members (project_id, member_id, role, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(projectId, memberId, role || null, new Date().toISOString());
  }

  public removeMember(projectId: string, memberId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM project_members WHERE project_id = ? AND member_id = ?');
    const res = stmt.run(projectId, memberId);
    return Number(res.changes) > 0;
  }

  public setMembers(projectId: string, members: Array<{ memberId: string; role?: string }>): void {
    const now = new Date().toISOString();
    this.db.exec('BEGIN TRANSACTION;');
    try {
      this.db.prepare('DELETE FROM project_members WHERE project_id = ?').run(projectId);
      const insertStmt = this.db.prepare(`
        INSERT INTO project_members (project_id, member_id, role, created_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const m of members) {
        if (m.memberId) {
          insertStmt.run(projectId, m.memberId, m.role || null, now);
        }
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public getRelatedEvents(projectId: string): Array<{ id: string; title: string; event_date: string; event_type: string }> {
    const stmt = this.db.prepare(`
      SELECT DISTINCT e.id, e.title, e.event_date, e.event_type
      FROM events e
      JOIN archive_items a ON a.related_event_id = e.id
      WHERE a.related_project_id = ?
      ORDER BY e.event_date DESC
    `);
    return stmt.all(projectId) as unknown as Array<{ id: string; title: string; event_date: string; event_type: string }>;
  }

  public findAllAdmin(options: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    featured?: boolean;
    search?: string;
    sort?: string;
  } = {}): { items: ProjectRecord[]; total: number } {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = ' WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.status && options.status !== 'all') {
      whereClause += ' AND LOWER(status) = LOWER(?)';
      params.push(options.status);
    }
    if (options.category && options.category !== 'all') {
      whereClause += ' AND LOWER(category) = LOWER(?)';
      params.push(options.category);
    }
    if (options.featured !== undefined) {
      whereClause += ' AND featured = ?';
      params.push(options.featured ? 1 : 0);
    }
    if (options.search) {
      whereClause += ' AND (LOWER(title) LIKE LOWER(?) OR LOWER(short_description) LIKE LOWER(?) OR LOWER(slug) LIKE LOWER(?) OR LOWER(technologies) LIKE LOWER(?))';
      const q = `%${options.search}%`;
      params.push(q, q, q, q);
    }

    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM projects${whereClause}`);
    const countRow = countStmt.get(...params) as { count: number };
    const total = countRow ? countRow.count : 0;

    let orderBy = 'updated_at DESC, id ASC';
    if (options.sort === 'created_desc') orderBy = 'created_at DESC, id ASC';
    else if (options.sort === 'created_asc') orderBy = 'created_at ASC, id ASC';
    else if (options.sort === 'title_asc') orderBy = 'title ASC, id ASC';
    else if (options.sort === 'title_desc') orderBy = 'title DESC, id ASC';
    else if (options.sort === 'year_desc') orderBy = 'year DESC, project_number ASC';
    else if (options.sort === 'featured') orderBy = 'featured DESC, updated_at DESC';

    const query = `
      SELECT * FROM projects
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    const items = this.db.prepare(query).all(...params, limit, offset) as unknown as ProjectRecord[];
    return { items, total };
  }

  public createProject(project: Omit<ProjectRecord, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): ProjectRecord {
    const now = new Date().toISOString();
    const created_at = project.created_at || now;
    const updated_at = project.updated_at || now;
    const cover_image_url = project.cover_image_url || project.cover_image || null;
    const live_url = project.live_url || project.demo_url || null;
    const published_at = project.published_at || (project.status === 'Published' ? now : null);

    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, slug, project_number, title, category, year, short_description,
        full_description, disciplines, status, featured, technologies,
        deliverables, cover_image, cover_image_url, cover_image_public_id,
        demo_url, live_url, repository_url, documentation_url,
        start_date, end_date, published_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    stmt.run(
      project.id,
      project.slug,
      project.project_number || null,
      project.title,
      project.category,
      project.year,
      project.short_description,
      project.full_description,
      project.disciplines,
      project.status,
      project.featured ? 1 : 0,
      project.technologies || '[]',
      project.deliverables || null,
      cover_image_url,
      cover_image_url,
      project.cover_image_public_id || null,
      live_url,
      live_url,
      project.repository_url || null,
      project.documentation_url || null,
      project.start_date || null,
      project.end_date || null,
      published_at,
      created_at,
      updated_at
    );

    return {
      ...project,
      featured: project.featured ? 1 : 0,
      cover_image: cover_image_url,
      cover_image_url,
      cover_image_public_id: project.cover_image_public_id || null,
      demo_url: live_url,
      live_url,
      repository_url: project.repository_url || null,
      documentation_url: project.documentation_url || null,
      start_date: project.start_date || null,
      end_date: project.end_date || null,
      published_at,
      created_at,
      updated_at,
    };
  }

  public updateProject(
    id: string,
    updates: Partial<ProjectRecord>,
    expectedUpdatedAt?: string
  ): { success: boolean; conflict?: boolean; project?: ProjectRecord } {
    const existing = this.findById(id);
    if (!existing) return { success: false };

    if (expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
      return { success: false, conflict: true, project: existing };
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const allowedKeys: (keyof ProjectRecord)[] = [
      'slug', 'project_number', 'title', 'category', 'year', 'short_description',
      'full_description', 'disciplines', 'status', 'featured', 'technologies',
      'deliverables', 'cover_image', 'cover_image_url', 'cover_image_public_id',
      'demo_url', 'live_url', 'repository_url', 'documentation_url',
      'start_date', 'end_date', 'published_at'
    ];

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        let val = updates[key] as string | number | null;
        if (key === 'featured') {
          val = updates[key] ? 1 : 0;
        }
        values.push(val);
      }
    }

    if (updates.cover_image_url !== undefined && updates.cover_image === undefined) {
      fields.push('cover_image = ?');
      values.push(updates.cover_image_url);
    } else if (updates.cover_image !== undefined && updates.cover_image_url === undefined) {
      fields.push('cover_image_url = ?');
      values.push(updates.cover_image);
    }

    if (updates.live_url !== undefined && updates.demo_url === undefined) {
      fields.push('demo_url = ?');
      values.push(updates.live_url);
    } else if (updates.demo_url !== undefined && updates.live_url === undefined) {
      fields.push('live_url = ?');
      values.push(updates.demo_url);
    }

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    values.push(now);

    values.push(id);

    const query = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(query).run(...values);

    const updated = this.findById(id);
    return { success: true, project: updated || undefined };
  }

  public updateStatus(id: string, status: string): ProjectRecord | null {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE projects 
      SET status = ?, 
          published_at = CASE 
            WHEN LOWER(?) = 'published' THEN COALESCE(published_at, ?) 
            WHEN LOWER(?) = 'draft' THEN NULL
            ELSE published_at 
          END,
          updated_at = ? 
      WHERE id = ?
    `);
    const result = stmt.run(status, status, now, status, now, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  }

  public deleteProject(id: string): boolean {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      this.db.prepare('DELETE FROM project_members WHERE project_id = ?').run(id);
      const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
      const result = stmt.run(id);
      this.db.exec('COMMIT;');
      return result.changes > 0;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }
}

export const projectsRepository = new ProjectsRepository();
