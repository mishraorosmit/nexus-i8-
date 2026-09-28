import { BaseRepository } from './base.repository.ts';

export type InquiryStatus = 'Unread' | 'Reviewed' | 'Contacted' | 'Resolved' | 'Archived';

export interface SubmissionRecord {
  id: string;
  reference_id?: string | null;
  name: string;
  email: string;
  category: string;
  message: string | null;
  metadata: string | null; // JSON
  status: InquiryStatus;
  admin_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export class SubmissionsRepository extends BaseRepository<SubmissionRecord> {
  constructor() {
    super('submissions');
  }

  public findAll(filter?: { status?: string; category?: string }): SubmissionRecord[] {
    let sql = 'SELECT * FROM submissions WHERE 1=1';
    const params: (string | number | null)[] = [];

    if (filter?.status && filter.status !== 'all') {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.category && filter.category !== 'all') {
      sql += ' AND category = ?';
      params.push(filter.category);
    }
    sql += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as unknown as SubmissionRecord[];
  }

  public findAllPaginated(filter?: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): { items: SubmissionRecord[]; total: number } {
    let sql = 'SELECT * FROM submissions WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM submissions WHERE 1=1';
    const params: (string | number)[] = [];
    const countParams: (string | number)[] = [];

    if (filter?.status && filter.status !== 'all') {
      sql += ' AND LOWER(status) = LOWER(?)';
      countSql += ' AND LOWER(status) = LOWER(?)';
      params.push(filter.status);
      countParams.push(filter.status);
    }

    if (filter?.category && filter.category !== 'all') {
      sql += ' AND LOWER(category) = LOWER(?)';
      countSql += ' AND LOWER(category) = LOWER(?)';
      params.push(filter.category);
      countParams.push(filter.category);
    }

    if (filter?.search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR message LIKE ? OR reference_id LIKE ?)';
      countSql += ' AND (name LIKE ? OR email LIKE ? OR message LIKE ? OR reference_id LIKE ?)';
      const queryParam = `%${filter.search}%`;
      params.push(queryParam, queryParam, queryParam, queryParam);
      countParams.push(queryParam, queryParam, queryParam, queryParam);
    }

    sql += ' ORDER BY created_at DESC';

    const countStmt = this.db.prepare(countSql);
    const countRow = countStmt.get(...countParams) as { total: number };
    const total = countRow ? countRow.total : 0;

    const page = Math.max(1, filter?.page || 1);
    const limit = Math.min(100, Math.max(1, filter?.limit || 20));
    const offset = (page - 1) * limit;

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const items = stmt.all(...params) as unknown as SubmissionRecord[];

    return { items, total };
  }

  public findById(id: string): SubmissionRecord | null {
    const stmt = this.db.prepare('SELECT * FROM submissions WHERE id = ?');
    const row = stmt.get(id);
    return (row as unknown as SubmissionRecord) || null;
  }

  public findByReferenceId(refId: string): SubmissionRecord | null {
    const stmt = this.db.prepare('SELECT * FROM submissions WHERE reference_id = ?');
    const row = stmt.get(refId);
    return (row as unknown as SubmissionRecord) || null;
  }

  public findByIdOrRef(idOrRef: string): SubmissionRecord | null {
    const stmt = this.db.prepare('SELECT * FROM submissions WHERE id = ? OR reference_id = ?');
    const row = stmt.get(idOrRef, idOrRef);
    return (row as unknown as SubmissionRecord) || null;
  }

  public getFacets(): {
    total: number;
    unread: number;
    reviewed: number;
    contacted: number;
    resolved: number;
    archived: number;
  } {
    const rows = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM submissions 
      GROUP BY status
    `).all() as Array<{ status: string; count: number }>;

    const facets = {
      total: 0,
      unread: 0,
      reviewed: 0,
      contacted: 0,
      resolved: 0,
      archived: 0,
    };

    for (const r of rows) {
      facets.total += r.count;
      const lower = (r.status || '').toLowerCase();
      if (lower === 'unread' || lower === 'new') facets.unread += r.count;
      else if (lower === 'reviewed') facets.reviewed += r.count;
      else if (lower === 'contacted') facets.contacted += r.count;
      else if (lower === 'resolved') facets.resolved += r.count;
      else if (lower === 'archived') facets.archived += r.count;
    }

    return facets;
  }

  public create(data: Omit<SubmissionRecord, 'created_at' | 'updated_at'>): SubmissionRecord {
    const now = new Date().toISOString();
    const record: SubmissionRecord = {
      ...data,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO submissions (
        id, reference_id, name, email, category, message, metadata, status,
        admin_notes, reviewed_by, reviewed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.reference_id || null,
      record.name,
      record.email,
      record.category,
      record.message,
      record.metadata,
      record.status,
      record.admin_notes || null,
      record.reviewed_by || null,
      record.reviewed_at || null,
      record.created_at,
      record.updated_at
    );

    return record;
  }

  public updateStatus(id: string, status: SubmissionRecord['status']): SubmissionRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?');
    stmt.run(status, now, id);

    return {
      ...existing,
      status,
      updated_at: now,
    };
  }

  public updateAdminReview(
    id: string,
    params: {
      status?: InquiryStatus;
      adminNotes?: string | null;
      reviewedBy?: string | null;
    }
  ): SubmissionRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const newStatus = params.status || existing.status;
    const newAdminNotes = params.adminNotes !== undefined ? params.adminNotes : existing.admin_notes;
    const newReviewedBy = params.reviewedBy !== undefined ? params.reviewedBy : existing.reviewed_by;
    const newReviewedAt = params.reviewedBy ? now : existing.reviewed_at;

    const stmt = this.db.prepare(`
      UPDATE submissions 
      SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? 
      WHERE id = ?
    `);
    stmt.run(newStatus, newAdminNotes, newReviewedBy, newReviewedAt, now, id);

    return {
      ...existing,
      status: newStatus,
      admin_notes: newAdminNotes,
      reviewed_by: newReviewedBy,
      reviewed_at: newReviewedAt,
      updated_at: now,
    };
  }

  public deleteById(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM submissions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

export const submissionsRepository = new SubmissionsRepository();
