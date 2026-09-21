import { BaseRepository } from './base.repository.ts';

export type EventRegistrationStatus = 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' | 'ATTENDED';

export interface EventRegistrationRecord {
  id: string;
  event_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone: string | null;
  organization: string | null;
  department: string | null;
  status: EventRegistrationStatus;
  metadata: string | null; // JSON
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
      whereSql += ' AND (LOWER(attendee_name) LIKE LOWER(?) OR LOWER(attendee_email) LIKE LOWER(?) OR LOWER(COALESCE(department, organization, \'\')) LIKE LOWER(?))';
      const q = `%${filter.search}%`;
      params.push(q, q, q);
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
        id, event_id, attendee_name, attendee_email, attendee_phone,
        organization, department, status, metadata, registration_timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.event_id,
      record.attendee_name,
      record.attendee_email.toLowerCase().trim(),
      record.attendee_phone,
      record.organization,
      record.department,
      record.status,
      record.metadata,
      record.registration_timestamp,
      record.created_at,
      record.updated_at
    );

    return record;
  }

  public updateStatus(id: string, status: EventRegistrationStatus): EventRegistrationRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE event_registrations SET status = ?, updated_at = ? WHERE id = ?');
    stmt.run(status, now, id);

    return {
      ...existing,
      status,
      updated_at: now,
    };
  }

  public deleteById(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM event_registrations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

export const eventRegistrationsRepository = new EventRegistrationsRepository();
