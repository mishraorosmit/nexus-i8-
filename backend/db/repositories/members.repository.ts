import { BaseRepository } from './base.repository.ts';

export interface MemberRecord {
  id: string;
  public_id: string;
  slug?: string;
  unique_id?: string | null;
  name: string;
  display_name?: string | null;
  email: string | null;
  role: string;
  domain: string | null;
  department?: string | null;
  bio: string | null;
  photo_url: string | null;
  profile_image_url?: string | null;
  profile_image_public_id?: string | null;
  image_position: string | null;
  social_links: string | null; // JSON stringified
  status: 'active' | 'alumni' | 'inactive' | 'ACTIVE' | 'ALUMNI' | 'INACTIVE';
  clearance_level?: string | null;
  special_word?: string | null;
  quote?: string | null;
  node_location?: string | null;
  frequency?: string | null;
  security_zone?: string | null;
  badge_issue?: string | null;
  skills?: string | null; // JSON stringified array
  current_focus?: string | null;
  fun_fact?: string | null;
  joined_date: string | null;
  joined_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberFilterOptions {
  status?: string;
  role?: string;
  domain?: string;
  search?: string;
  offset?: number;
  limit?: number;
}

export class MembersRepository extends BaseRepository<MemberRecord> {
  constructor() {
    super('members');
  }

  public findPaginated(options: MemberFilterOptions = {}): { items: MemberRecord[]; total: number } {
    let whereClause = ' WHERE 1=1';
    const params: (string | number | null)[] = [];

    // By default, public API queries only active members
    const status = options.status || 'active';
    if (status !== 'all') {
      whereClause += ' AND LOWER(status) = LOWER(?)';
      params.push(status);
    }

    if (options.role) {
      whereClause += ' AND LOWER(role) LIKE LOWER(?)';
      params.push(`%${options.role}%`);
    }

    if (options.domain) {
      whereClause += ' AND LOWER(domain) LIKE LOWER(?)';
      params.push(`%${options.domain}%`);
    }

    if (options.search) {
      whereClause += ' AND (LOWER(name) LIKE LOWER(?) OR LOWER(role) LIKE LOWER(?) OR LOWER(domain) LIKE LOWER(?))';
      const q = `%${options.search}%`;
      params.push(q, q, q);
    }

    const countSql = `SELECT COUNT(*) as count FROM members${whereClause}`;
    const countRow = this.db.prepare(countSql).get(...params) as { count: number };
    const total = Number(countRow?.count || 0);

    let querySql = `SELECT * FROM members${whereClause} ORDER BY name ASC, created_at ASC`;
    const queryParams = [...params];

    if (options.limit !== undefined) {
      querySql += ' LIMIT ? OFFSET ?';
      queryParams.push(options.limit, options.offset || 0);
    }

    const items = this.db.prepare(querySql).all(...queryParams) as unknown as MemberRecord[];
    return { items, total };
  }

  public findAll(filter?: MemberFilterOptions): MemberRecord[] {
    return this.findPaginated(filter).items;
  }

  public findById(id: string): MemberRecord | null {
    const stmt = this.db.prepare('SELECT * FROM members WHERE id = ?');
    const row = stmt.get(id);
    return (row as unknown as MemberRecord) || null;
  }

  public findByPublicId(publicId: string): MemberRecord | null {
    const stmt = this.db.prepare('SELECT * FROM members WHERE LOWER(public_id) = LOWER(?) OR LOWER(slug) = LOWER(?) OR id = ?');
    const row = stmt.get(publicId, publicId, publicId);
    return (row as unknown as MemberRecord) || null;
  }

  public findBySlug(slug: string): MemberRecord | null {
    const stmt = this.db.prepare('SELECT * FROM members WHERE LOWER(slug) = LOWER(?) OR LOWER(public_id) = LOWER(?)');
    const row = stmt.get(slug, slug);
    return (row as unknown as MemberRecord) || null;
  }

  public findByEmail(email: string): MemberRecord | null {
    const stmt = this.db.prepare('SELECT * FROM members WHERE LOWER(email) = LOWER(?)');
    const row = stmt.get(email);
    return (row as unknown as MemberRecord) || null;
  }

  public findByUniqueId(uniqueId: string): MemberRecord | null {
    const stmt = this.db.prepare('SELECT * FROM members WHERE UPPER(unique_id) = UPPER(?)');
    const row = stmt.get(uniqueId);
    return (row as unknown as MemberRecord) || null;
  }

  public findByIdentifier(identifier: string): MemberRecord | null {
    const stmt = this.db.prepare(
      'SELECT * FROM members WHERE UPPER(unique_id) = UPPER(?) OR LOWER(slug) = LOWER(?) OR LOWER(public_id) = LOWER(?) OR id = ?'
    );
    const row = stmt.get(identifier, identifier, identifier, identifier);
    return (row as unknown as MemberRecord) || null;
  }

  public findBySlugAndUniqueId(slug: string, uniqueId: string): MemberRecord | null {
    const stmt = this.db.prepare(
      'SELECT * FROM members WHERE (LOWER(slug) = LOWER(?) OR LOWER(public_id) = LOWER(?)) AND UPPER(unique_id) = UPPER(?)'
    );
    const row = stmt.get(slug, slug, uniqueId);
    return (row as unknown as MemberRecord) || null;
  }

  public create(data: Omit<MemberRecord, 'created_at' | 'updated_at'>): MemberRecord {
    const now = new Date().toISOString();
    const slug = data.slug || data.public_id;
    const publicId = data.public_id || slug;
    const photoUrl = data.photo_url || data.profile_image_url || null;
    const profileImageUrl = data.profile_image_url || data.photo_url || null;
    const joinedDate = data.joined_date || data.joined_at || null;
    const joinedAt = data.joined_at || data.joined_date || null;
    const status = (data.status || 'ACTIVE').toUpperCase() as MemberRecord['status'];

    const record: MemberRecord = {
      ...data,
      slug,
      public_id: publicId,
      photo_url: photoUrl,
      profile_image_url: profileImageUrl,
      joined_date: joinedDate,
      joined_at: joinedAt,
      status,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO members (
        id, public_id, slug, unique_id, name, display_name, email, role, domain, department, bio,
        photo_url, profile_image_url, profile_image_public_id,
        image_position, social_links, status, clearance_level, special_word, quote, node_location,
        frequency, security_zone, badge_issue, skills, current_focus, fun_fact, joined_date, joined_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.public_id,
      record.slug || record.public_id,
      record.unique_id || null,
      record.name,
      record.display_name || null,
      record.email,
      record.role,
      record.domain,
      record.department || null,
      record.bio,
      record.photo_url,
      record.profile_image_url || null,
      record.profile_image_public_id || null,
      record.image_position,
      record.social_links,
      record.status,
      record.clearance_level || null,
      record.special_word || null,
      record.quote || null,
      record.node_location || null,
      record.frequency || null,
      record.security_zone || null,
      record.badge_issue || null,
      record.skills || null,
      record.current_focus || null,
      record.fun_fact || null,
      record.joined_date,
      record.joined_at || null,
      record.created_at,
      record.updated_at
    );

    return record;
  }

  public update(id: string, data: Partial<MemberRecord>): MemberRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const slug = data.slug !== undefined ? data.slug : (data.public_id !== undefined ? data.public_id : existing.slug);
    const publicId = data.public_id !== undefined ? data.public_id : (slug || existing.public_id);
    const photoUrl = data.photo_url !== undefined ? data.photo_url : (data.profile_image_url !== undefined ? data.profile_image_url : existing.photo_url);
    const profileImageUrl = data.profile_image_url !== undefined ? data.profile_image_url : (data.photo_url !== undefined ? data.photo_url : existing.profile_image_url);
    const joinedDate = data.joined_date !== undefined ? data.joined_date : (data.joined_at !== undefined ? data.joined_at : existing.joined_date);
    const joinedAt = data.joined_at !== undefined ? data.joined_at : (data.joined_date !== undefined ? data.joined_date : existing.joined_at);
    const status = data.status ? (data.status.toUpperCase() as MemberRecord['status']) : existing.status;

    const updated: MemberRecord = {
      ...existing,
      ...data,
      id,
      slug: slug || existing.slug || existing.public_id,
      public_id: publicId || existing.public_id,
      photo_url: photoUrl,
      profile_image_url: profileImageUrl,
      joined_date: joinedDate,
      joined_at: joinedAt,
      status,
      updated_at: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE members SET
        public_id = ?, slug = ?, unique_id = ?, name = ?, display_name = ?, email = ?, role = ?, domain = ?, department = ?, bio = ?,
        photo_url = ?, profile_image_url = ?, profile_image_public_id = ?,
        image_position = ?, social_links = ?, status = ?, clearance_level = ?, special_word = ?,
        quote = ?, node_location = ?, frequency = ?, security_zone = ?, badge_issue = ?, skills = ?,
        current_focus = ?, fun_fact = ?, joined_date = ?, joined_at = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.public_id,
      updated.slug || updated.public_id,
      updated.unique_id || null,
      updated.name,
      updated.display_name || null,
      updated.email,
      updated.role,
      updated.domain,
      updated.department || null,
      updated.bio,
      updated.photo_url,
      updated.profile_image_url || null,
      updated.profile_image_public_id || null,
      updated.image_position,
      updated.social_links,
      updated.status,
      updated.clearance_level || null,
      updated.special_word || null,
      updated.quote || null,
      updated.node_location || null,
      updated.frequency || null,
      updated.security_zone || null,
      updated.badge_issue || null,
      updated.skills || null,
      updated.current_focus || null,
      updated.fun_fact || null,
      updated.joined_date,
      updated.joined_at || null,
      updated.updated_at,
      id
    );

    return updated;
  }

  public upsert(data: Partial<MemberRecord> & { id: string; public_id?: string; slug?: string }): MemberRecord {
    const slug = data.slug || data.public_id || '';
    const existing = this.findById(data.id) || (slug ? this.findByPublicId(slug) : null);
    if (existing) {
      const updated = this.update(existing.id, data);
      return updated!;
    } else {
      return this.create({
        id: data.id,
        public_id: data.public_id || slug,
        slug: slug,
        unique_id: data.unique_id || null,
        name: data.name || '',
        display_name: data.display_name || null,
        email: data.email || null,
        role: data.role || '',
        domain: data.domain || null,
        department: data.department || null,
        bio: data.bio || null,
        photo_url: data.photo_url || null,
        image_position: data.image_position || null,
        social_links: data.social_links || null,
        status: data.status || 'ACTIVE',
        clearance_level: data.clearance_level || null,
        special_word: data.special_word || null,
        quote: data.quote || null,
        node_location: data.node_location || null,
        frequency: data.frequency || null,
        security_zone: data.security_zone || null,
        badge_issue: data.badge_issue || null,
        skills: data.skills || null,
        current_focus: data.current_focus || null,
        fun_fact: data.fun_fact || null,
        joined_date: data.joined_date || null,
      });
    }
  }


  public findAllAdmin(options: {
    page?: number;
    pageSize?: number;
    limit?: number;
    status?: string;
    role?: string;
    domain?: string;
    department?: string;
    search?: string;
    q?: string;
    sort?: string;
  } = {}): {
    items: MemberRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    sort: string;
  } {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.pageSize || options.limit) || 25));
    const offset = (page - 1) * limit;

    let whereClause = ' WHERE 1=1';
    const params: (string | number)[] = [];

    // 1. Status Filter
    if (options.status && options.status.trim().toLowerCase() !== 'all') {
      whereClause += ' AND LOWER(status) = LOWER(?)';
      params.push(options.status.trim());
    }

    // 2. Department Filter
    if (options.department && options.department.trim().toLowerCase() !== 'all') {
      whereClause += ' AND LOWER(department) = LOWER(?)';
      params.push(options.department.trim());
    }

    // 3. Domain Filter
    if (options.domain && options.domain.trim().toLowerCase() !== 'all') {
      whereClause += ' AND LOWER(domain) = LOWER(?)';
      params.push(options.domain.trim());
    }

    // 4. Role Filter
    if (options.role && options.role.trim().toLowerCase() !== 'all') {
      whereClause += ' AND LOWER(role) LIKE LOWER(?)';
      params.push(`%${options.role.trim()}%`);
    }

    // 5. Multi-field Search (name, unique_id, email, role, domain, department, slug)
    const rawSearch = (options.q || options.search || '').trim();
    if (rawSearch) {
      whereClause += ` AND (
        LOWER(name) LIKE LOWER(?) 
        OR LOWER(unique_id) LIKE LOWER(?) 
        OR LOWER(email) LIKE LOWER(?) 
        OR LOWER(role) LIKE LOWER(?) 
        OR LOWER(domain) LIKE LOWER(?) 
        OR LOWER(department) LIKE LOWER(?) 
        OR LOWER(slug) LIKE LOWER(?)
      )`;
      const pattern = `%${rawSearch}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }

    // Total matching records
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM members${whereClause}`);
    const countRow = countStmt.get(...params) as { count: number };
    const total = Number(countRow?.count || 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    // 6. Whitelisted Sorting Logic (strict defense against SQL injection)
    const normalizedSort = (options.sort || 'updated_desc').trim().toLowerCase();
    let orderByClause = 'ORDER BY updated_at DESC, name ASC';
    let validatedSortKey = 'updated_desc';

    switch (normalizedSort) {
      case 'name':
      case 'name_asc':
      case 'name:asc':
        orderByClause = 'ORDER BY name COLLATE NOCASE ASC';
        validatedSortKey = 'name_asc';
        break;
      case 'name_desc':
      case 'name:desc':
        orderByClause = 'ORDER BY name COLLATE NOCASE DESC';
        validatedSortKey = 'name_desc';
        break;
      case 'newest':
      case 'created_at_desc':
      case 'created_desc':
        orderByClause = 'ORDER BY created_at DESC';
        validatedSortKey = 'newest';
        break;
      case 'oldest':
      case 'created_at_asc':
      case 'created_asc':
        orderByClause = 'ORDER BY created_at ASC';
        validatedSortKey = 'oldest';
        break;
      case 'unique_id':
      case 'unique_id_asc':
      case 'id_asc':
        orderByClause = 'ORDER BY unique_id ASC';
        validatedSortKey = 'unique_id_asc';
        break;
      case 'unique_id_desc':
      case 'id_desc':
        orderByClause = 'ORDER BY unique_id DESC';
        validatedSortKey = 'unique_id_desc';
        break;
      case 'updated_desc':
      case 'updated':
      case 'recent':
      default:
        orderByClause = 'ORDER BY updated_at DESC, name ASC';
        validatedSortKey = 'updated_desc';
        break;
    }

    const query = `
      SELECT * FROM members
      ${whereClause}
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;
    const items = this.db.prepare(query).all(...params, limit, offset) as unknown as MemberRecord[];

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: totalPages > 0 && page < totalPages,
      hasPrevPage: totalPages > 0 && page > 1,
      sort: validatedSortKey,
    };
  }

  public getFilterFacets(): {
    roles: string[];
    domains: string[];
    departments: string[];
    statuses: string[];
  } {
    const rolesRows = this.db
      .prepare("SELECT DISTINCT role FROM members WHERE role IS NOT NULL AND role != '' ORDER BY role ASC")
      .all() as Array<{ role: string }>;
    const domainsRows = this.db
      .prepare("SELECT DISTINCT domain FROM members WHERE domain IS NOT NULL AND domain != '' ORDER BY domain ASC")
      .all() as Array<{ domain: string }>;
    const departmentsRows = this.db
      .prepare("SELECT DISTINCT department FROM members WHERE department IS NOT NULL AND department != '' ORDER BY department ASC")
      .all() as Array<{ department: string }>;

    return {
      roles: rolesRows.map((r) => r.role),
      domains: domainsRows.map((d) => d.domain),
      departments: departmentsRows.map((dept) => dept.department),
      statuses: ['ACTIVE', 'INACTIVE', 'ALUMNI'],
    };
  }

  public updateWithConcurrency(
    id: string,
    updates: Partial<MemberRecord>,
    expectedUpdatedAt?: string
  ): { success: boolean; conflict?: boolean; member?: MemberRecord } {
    const existing = this.findById(id);
    if (!existing) return { success: false };

    if (expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
      return { success: false, conflict: true, member: existing };
    }

    const updated = this.update(id, updates);
    return { success: true, member: updated || undefined };
  }

  public deleteMember(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM members WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

export const membersRepository = new MembersRepository();
export const memberRepository = membersRepository;
