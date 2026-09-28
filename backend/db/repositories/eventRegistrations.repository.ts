import { BaseRepository } from './base.repository.ts';

export type EventRegistrationStatus = 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' | 'ATTENDED';

export interface EventRegistrationRecord {
  id: string;
  reference_id?: string | null;
  event_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string | null;
  organization: string | null;
  department: string | null;
  status: EventRegistrationStatus;
  metadata: string | null; // JSON
  admin_notes?: string | null;
  registration_timestamp: string;
  created_at: string;
  updated_at: string;
}

export class EventRegistrationsRepository extends BaseRepository<EventRegistrationRecord> {
  constructor() {
    super('event_registrations');
  }

  public findById(id: string): EventRegistrationRecord | null {
    const stmt = this.db.prepare('SELECT * FROM event_registrations WHERE id = ?');
    const row = stmt.get(id);
    return (row as unknown as EventRegistrationRecord) || null;
  }

  public findByReferenceId(refId: string): EventRegistrationRecord | null {
    const stmt = this.db.prepare('SELECT * FROM event_registrations WHERE reference_id = ?');
    const row = stmt.get(refId);
    return (row as unknown as EventRegistrationRecord) || null;
  }

  public findByIdOrRef(idOrRef: string): EventRegistrationRecord | null {
    const stmt = this.db.prepare('SELECT * FROM event_registrations WHERE id = ? OR reference_id = ?');
    const row = stmt.get(idOrRef, idOrRef);
    return (row as unknown as EventRegistrationRecord) || null;
  }

  public findByEventAndEmail(eventId: string, email: string): EventRegistrationRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM event_registrations 
      WHERE event_id = ? AND LOWER(attendee_email) = LOWER(?)
    `);
    const row = stmt.get(eventId, email.trim());
    return (row as unknown as EventRegistrationRecord) || null;
  }

  public countConfirmedByEvent(eventId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM event_registrations 
      WHERE event_id = ? AND status = 'CONFIRMED'
    `);
    const row = stmt.get(eventId) as { count: number };
    return row ? row.count : 0;
  }

  public listByEvent(
    eventId: string,
    filter?: { status?: string; search?: string; page?: number; limit?: number }
  ): { items: EventRegistrationRecord[]; total: number } {
    let whereSql = ' WHERE event_id = ?';
    const params: (string | number)[] = [eventId];

    if (filter?.status && filter.status !== 'all') {
      whereSql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.search) {
      whereSql += ' AND (LOWER(attendee_name) LIKE LOWER(?) OR LOWER(attendee_email) LIKE LOWER(?) OR LOWER(COALESCE(department, organization, \'\')) LIKE LOWER(?) OR reference_id LIKE ?)';
      const q = `%${filter.search}%`;
      params.push(q, q, q, q);
    }

    const countSql = `SELECT COUNT(*) as total FROM event_registrations${whereSql}`;
    const countStmt = this.db.prepare(countSql);
    const countRow = countStmt.get(...params) as { total: number };
    const total = countRow ? countRow.total : 0;

    const page = Math.max(1, filter?.page || 1);
    const limit = Math.min(100, Math.max(1, filter?.limit || 20));
    const offset = (page - 1) * limit;

    const querySql = `
      SELECT * FROM event_registrations
      ${whereSql}
      ORDER BY registration_timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const stmt = this.db.prepare(querySql);
    const items = stmt.all(...params, limit, offset) as unknown as EventRegistrationRecord[];

    return { items, total };
  }

  public findAllGlobal(filter?: {
    status?: string;
    eventId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): { items: (EventRegistrationRecord & { event_title?: string; event_slug?: string })[]; total: number } {
    let whereSql = ' WHERE 1=1';
    const params: (string | number)[] = [];

    if (filter?.status && filter.status !== 'all') {
      whereSql += ' AND er.status = ?';
      params.push(filter.status);
    }

    if (filter?.eventId && filter.eventId !== 'all') {
      whereSql += ' AND er.event_id = ?';
      params.push(filter.eventId);
    }

    if (filter?.search) {
      whereSql += ' AND (LOWER(er.attendee_name) LIKE LOWER(?) OR LOWER(er.attendee_email) LIKE LOWER(?) OR er.reference_id LIKE ? OR LOWER(e.title) LIKE LOWER(?))';
      const q = `%${filter.search}%`;
      params.push(q, q, q, q);
    }

    const countSql = `
      SELECT COUNT(*) as total 
      FROM event_registrations er
      LEFT JOIN events e ON er.event_id = e.id
      ${whereSql}
    `;
    const countStmt = this.db.prepare(countSql);
    const countRow = countStmt.get(...params) as { total: number };
    const total = countRow ? countRow.total : 0;

    const page = Math.max(1, filter?.page || 1);
    const limit = Math.min(100, Math.max(1, filter?.limit || 20));
    const offset = (page - 1) * limit;

    const querySql = `
      SELECT er.*, e.title as event_title, e.slug as event_slug
      FROM event_registrations er
      LEFT JOIN events e ON er.event_id = e.id
      ${whereSql}
      ORDER BY er.registration_timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const stmt = this.db.prepare(querySql);
    const items = stmt.all(...params, limit, offset) as unknown as (EventRegistrationRecord & { event_title?: string; event_slug?: string })[];

    return { items, total };
  }

  public listAllForEvent(eventId: string): EventRegistrationRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM event_registrations 
      WHERE event_id = ? 
      ORDER BY registration_timestamp ASC
    `);
    return stmt.all(eventId) as unknown as EventRegistrationRecord[];
  }

  public findByEvent(eventId: string): EventRegistrationRecord[] {
    return this.listAllForEvent(eventId);
  }

  public create(data: Omit<EventRegistrationRecord, 'created_at' | 'updated_at'>): EventRegistrationRecord {
    const now = new Date().toISOString();
    const record: EventRegistrationRecord = {
      ...data,
      department: data.department || data.organization || null,
      organization: data.organization || data.department || null,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO event_registrations (
        id, reference_id, event_id, attendee_name, attendee_email, attendee_phone,
        organization, department, status, metadata, admin_notes, registration_timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.reference_id || null,
      record.event_id,
      record.attendee_name,
      record.attendee_email.toLowerCase().trim(),
      record.attendee_phone,
      record.organization,
      record.department,
      record.status,
      record.metadata,
      record.admin_notes || null,
      record.registration_timestamp,
      record.created_at,
      record.updated_at
    );

    return record;
  }

  public updateStatus(id: string, status: EventRegistrationStatus, adminNotes?: string | null): EventRegistrationRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE event_registrations 
      SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = ? 
      WHERE id = ?
    `);
    stmt.run(status, adminNotes !== undefined ? adminNotes : null, now, id);

    return {
      ...existing,
      status,
      admin_notes: adminNotes !== undefined ? adminNotes : existing.admin_notes,
      updated_at: now,
    };
  }

  public deleteById(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM event_registrations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public getFacets(): {
    total: number;
    registered: number;
    waitlisted: number;
    cancelled: number;
  } {
    const totalRow = this.db.prepare('SELECT COUNT(*) as c FROM event_registrations').get() as { c: number };
    const regRow = this.db.prepare("SELECT COUNT(*) as c FROM event_registrations WHERE status IN ('CONFIRMED', 'REGISTERED')").get() as { c: number };
    const waitRow = this.db.prepare("SELECT COUNT(*) as c FROM event_registrations WHERE status = 'WAITLISTED'").get() as { c: number };
    const cancelRow = this.db.prepare("SELECT COUNT(*) as c FROM event_registrations WHERE status = 'CANCELLED'").get() as { c: number };

    return {
      total: totalRow?.c || 0,
      registered: regRow?.c || 0,
      waitlisted: waitRow?.c || 0,
      cancelled: cancelRow?.c || 0,
    };
  }
}

export const eventRegistrationsRepository = new EventRegistrationsRepository();
