import { BaseRepository } from './base.repository.ts';

export interface AuditLogRecord {
  id: string;
  admin_id: string | null;
  admin_name: string | null;
  admin_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  admin_context?: string | null;
  before_json?: string | null;
  after_json?: string | null;
  created_at: string;
}

export interface CreateAuditLogParams {
  id?: string;
  adminId?: string | null;
  adminName?: string | null;
  adminRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | object | string | null;
  ipAddress?: string | null;
  adminContext?: Record<string, unknown> | object | string | null;
  beforeJson?: Record<string, unknown> | object | string | null;
  afterJson?: Record<string, unknown> | object | string | null;
}

export class AuditLogsRepository extends BaseRepository<AuditLogRecord> {
  constructor() {
    super('audit_logs');
  }

  public record(params: CreateAuditLogParams): AuditLogRecord {
    const id = params.id || `aud-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const stringifyVal = (val: unknown): string | null => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'string') return val;
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    };

    const detailsStr = stringifyVal(params.details);
    const adminContextStr = stringifyVal(params.adminContext);
    const beforeJsonStr = stringifyVal(params.beforeJson);
    const afterJsonStr = stringifyVal(params.afterJson);

    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (
        id, admin_id, admin_name, admin_role, action, entity_type, entity_id,
        details, ip_address, admin_context, before_json, after_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.adminId || null,
      params.adminName || null,
      params.adminRole || null,
      params.action,
      params.entityType,
      params.entityId || null,
      detailsStr,
      params.ipAddress || null,
      adminContextStr,
      beforeJsonStr,
      afterJsonStr,
      now
    );

    return {
      id,
      admin_id: params.adminId || null,
      admin_name: params.adminName || null,
      admin_role: params.adminRole || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: detailsStr,
      ip_address: params.ipAddress || null,
      admin_context: adminContextStr,
      before_json: beforeJsonStr,
      after_json: afterJsonStr,
      created_at: now,
    };
  }

  public findPaginated(
    options: {
      action?: string;
      entityType?: string;
      entityId?: string;
      adminId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): { items: AuditLogRecord[]; total: number } {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.action) {
      conditions.push('action = ?');
      params.push(options.action);
    }
    if (options.entityType) {
      conditions.push('entity_type = ?');
      params.push(options.entityType);
    }
    if (options.entityId) {
      conditions.push('entity_id = ?');
      params.push(options.entityId);
    }
    if (options.adminId) {
      conditions.push('admin_id = ?');
      params.push(options.adminId);
    }
    if (options.startDate) {
      conditions.push('created_at >= ?');
      params.push(options.startDate);
    }
    if (options.endDate) {
      conditions.push('created_at <= ?');
      params.push(options.endDate);
    }
    if (options.search && options.search.trim() !== '') {
      const q = `%${options.search.trim()}%`;
      conditions.push('(action LIKE ? OR entity_id LIKE ? OR details LIKE ? OR admin_name LIKE ?)');
      params.push(q, q, q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = this.db.prepare(`SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`);
    const countRow = countStmt.get(...params) as { total: number } | undefined;
    const total = countRow ? Number(countRow.total) : 0;

    const selectStmt = this.db.prepare(`
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const items = selectStmt.all(...params, limit, offset) as unknown as AuditLogRecord[];

    return { items, total };
  }
}

export const auditLogsRepository = new AuditLogsRepository();
export const auditRepository = auditLogsRepository;

