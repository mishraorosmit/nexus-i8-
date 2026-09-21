import { auditLogsRepository, type AuditLogRecord, type CreateAuditLogParams } from '../db/repositories/auditLogs.repository.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { Request } from 'express';

// Canonical whitelist of allowed member fields in audit snapshots (prevents credential/buffer leakage)
const MEMBER_SNAPSHOT_WHITELIST: (keyof Record<string, unknown>)[] = [
  'id',
  'unique_id',
  'slug',
  'public_id',
  'name',
  'display_name',
  'email',
  'role',
  'department',
  'domain',
  'status',
  'year_of_study',
  'clearance_level',
  'security_zone',
  'node_location',
  'frequency',
  'profile_image_url',
  'profile_image_public_id',
  'photo_url',
  'bio',
  'current_focus',
  'fun_fact',
  'joined_date',
  'joined_at',
  'created_at',
  'updated_at',
];

const PROJECT_SNAPSHOT_WHITELIST: (keyof Record<string, unknown>)[] = [
  'id',
  'slug',
  'project_number',
  'title',
  'category',
  'year',
  'short_description',
  'full_description',
  'disciplines',
  'status',
  'featured',
  'technologies',
  'deliverables',
  'cover_image',
  'cover_image_url',
  'cover_image_public_id',
  'demo_url',
  'live_url',
  'repository_url',
  'documentation_url',
  'start_date',
  'end_date',
  'published_at',
  'created_at',
  'updated_at',
];

const EVENT_SNAPSHOT_WHITELIST: (keyof Record<string, unknown>)[] = [
  'id',
  'slug',
  'title',
  'short_description',
  'description',
  'event_type',
  'event_date',
  'event_time',
  'event_start',
  'event_end',
  'venue',
  'location',
  'registration_url',
  'registration_enabled',
  'registration_start',
  'registration_end',
  'registration_status',
  'capacity',
  'cover_image',
  'cover_image_url',
  'cover_image_public_id',
  'featured',
  'status',
  'published_at',
  'created_at',
  'updated_at',
];

const EVENT_REGISTRATION_SNAPSHOT_WHITELIST: (keyof Record<string, unknown>)[] = [
  'id',
  'event_id',
  'attendee_name',
  'attendee_email',
  'attendee_phone',
  'organization',
  'department',
  'status',
  'registration_timestamp',
  'created_at',
  'updated_at',
];

const MEDIA_SNAPSHOT_WHITELIST: (keyof Record<string, unknown>)[] = [
  'id',
  'cloudinary_public_id',
  'secure_url',
  'storage_key',
  'filename',
  'original_filename',
  'category',
  'mime_type',
  'format',
  'bytes',
  'file_size',
  'width',
  'height',
  'alt_text',
  'uploaded_by',
  'created_at',
  'updated_at',
];

const ANNOUNCEMENT_SNAPSHOT_WHITELIST: (keyof Record<string, unknown>)[] = [
  'id',
  'slug',
  'title',
  'summary',
  'body',
  'priority',
  'publish_status',
  'published_at',
  'expires_at',
  'created_at',
  'updated_at',
];

export interface SafeAdminContext {
  adminId?: string | null;
  adminName?: string | null;
  adminRole?: string | null;
  ipAddress?: string | null;
  actor?: string;
  sessionId?: string;
}

export class AuditService {
  /**
   * Sanitizes entity state snapshots to strictly whitelist safe business fields
   * and exclude passwords, sessions, secrets, or raw buffers.
   */
  public sanitizeSnapshot(entityType: string, data: any): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') return null;

    if (entityType.toUpperCase() === 'MEMBER') {
      const sanitized: Record<string, unknown> = {};
      for (const field of MEMBER_SNAPSHOT_WHITELIST) {
        if (field in data && data[field] !== undefined) {
          sanitized[field as string] = data[field];
        }
      }
      return sanitized;
    }

    if (entityType.toUpperCase() === 'PROJECT') {
      const sanitized: Record<string, unknown> = {};
      for (const field of PROJECT_SNAPSHOT_WHITELIST) {
        if (field in data && data[field] !== undefined) {
          sanitized[field as string] = data[field];
        }
      }
      return sanitized;
    }

    if (entityType.toUpperCase() === 'EVENT') {
      const sanitized: Record<string, unknown> = {};
      for (const field of EVENT_SNAPSHOT_WHITELIST) {
        if (field in data && data[field] !== undefined) {
          sanitized[field as string] = data[field];
        }
      }
      return sanitized;
    }

    if (entityType.toUpperCase() === 'EVENT_REGISTRATION') {
      const sanitized: Record<string, unknown> = {};
      for (const field of EVENT_REGISTRATION_SNAPSHOT_WHITELIST) {
        if (field in data && data[field] !== undefined) {
          sanitized[field as string] = data[field];
        }
      }
      return sanitized;
    }

    if (entityType.toUpperCase() === 'MEDIA' || entityType.toUpperCase() === 'MEDIA_ASSET') {
      const sanitized: Record<string, unknown> = {};
      for (const field of MEDIA_SNAPSHOT_WHITELIST) {
        if (field in data && data[field] !== undefined) {
          sanitized[field as string] = data[field];
        }
      }
      return sanitized;
    }

    if (entityType.toUpperCase() === 'ANNOUNCEMENT') {
      const sanitized: Record<string, unknown> = {};
      for (const field of ANNOUNCEMENT_SNAPSHOT_WHITELIST) {
        if (field in data && data[field] !== undefined) {
          sanitized[field as string] = data[field];
        }
      }
      return sanitized;
    }

    if (entityType.toUpperCase() === 'SITE_SETTINGS') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(data)) {
        // Strip any keys containing password, secret, key, or token
        const k = key.toLowerCase();
        if (!k.includes('secret') && !k.includes('password') && !k.includes('token') && !k.includes('private')) {
          sanitized[key] = val;
        }
      }
      return sanitized;
    }

    // Default safe copy for general entities: strip dangerous keywords
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      const k = key.toLowerCase();
      if (!k.includes('password') && !k.includes('secret') && !k.includes('token') && !k.includes('buffer')) {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  /**
   * Records an immutable audit log entry.
   * If an error occurs, it throws an explicit AppError rather than silently swallowing.
   */
  public log(params: CreateAuditLogParams, req?: Request): AuditLogRecord {
    try {
      const ipAddress = params.ipAddress || (req ? req.ip || req.socket?.remoteAddress : null);

      // Sanitize before and after JSON if passed as raw entity objects
      const safeBefore = params.beforeJson && typeof params.beforeJson === 'object'
        ? this.sanitizeSnapshot(params.entityType, params.beforeJson)
        : params.beforeJson;

      const safeAfter = params.afterJson && typeof params.afterJson === 'object'
        ? this.sanitizeSnapshot(params.entityType, params.afterJson)
        : params.afterJson;

      // Ensure actor context does not leak passwords or session tokens
      const rawContext = params.adminContext as Record<string, unknown> | undefined;
      const safeContext = rawContext ? {
        adminId: rawContext.adminId || params.adminId || null,
        adminName: rawContext.adminName || params.adminName || 'Admin',
        adminRole: rawContext.adminRole || params.adminRole || 'admin',
        actor: 'authenticated-admin',
      } : {
        adminId: params.adminId || null,
        adminName: params.adminName || 'Admin',
        adminRole: params.adminRole || 'admin',
        actor: 'authenticated-admin',
      };

      return auditLogsRepository.record({
        ...params,
        ipAddress: ipAddress ? String(ipAddress) : null,
        adminContext: safeContext,
        beforeJson: safeBefore,
        afterJson: safeAfter,
      });
    } catch (err) {
      console.error('[AuditService] Failed to record audit log:', err);
      throw new AppError(500, 'Failed to record administrative audit log', err, 'AUDIT_LOG_FAILED');
    }
  }

  public getPaginated(options: {
    action?: string;
    entityType?: string;
    entityId?: string;
    adminId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): { items: AuditLogRecord[]; total: number } {
    return auditLogsRepository.findPaginated(options);
  }
}

export const auditService = new AuditService();
