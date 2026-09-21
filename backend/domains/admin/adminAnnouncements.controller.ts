import { Request, Response, NextFunction } from 'express';
import { announcementsRepository, type AnnouncementRecord } from '../../db/repositories/announcements.repository.ts';
import { auditService } from '../../services/audit.service.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { apiSuccess, createPaginationMeta } from '../../utils/apiResponse.ts';

/**
 * Sanitizes administrative content by stripping dangerous HTML, scripts,
 * iframes, embed objects, javascript: URIs, and event handlers.
 */
function sanitizeContent(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/\bon\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
    .replace(/javascript\s*:[^"'\s>]*/gi, '')
    .trim();
}

/**
 * Validates expiration date strings.
 */
function validateExpiresAt(expiresAt: string | null | undefined, allowPast: boolean = false): string | null {
  if (!expiresAt || expiresAt === 'null' || expiresAt === '') return null;
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) {
    throw new AppError(400, 'Invalid expiration date format. Must be a valid ISO 8601 date string.', undefined, 'INVALID_DATE');
  }
  // If creating or actively editing expiry, ensure it's not set in the past
  if (!allowPast && d.getTime() <= Date.now() - 60000) {
    throw new AppError(400, 'Expiration date cannot be in the past.', undefined, 'INVALID_DATE');
  }
  return d.toISOString();
}

export class AdminAnnouncementsController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;
      const search = req.query.search as string | undefined;
      const sort = req.query.sort as string | undefined;
      const order = (req.query.order as 'ASC' | 'DESC') || 'DESC';

      const { items, total, facets } = announcementsRepository.findAllAdmin({
        page,
        limit,
        status,
        priority,
        search,
        sort,
        order,
      });

      const meta = {
        ...createPaginationMeta(page, limit, total),
        facets,
      };

      res.status(200).json(apiSuccess(items, meta));
    } catch (err) {
      next(err);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const announcement = announcementsRepository.findById(id);
      if (!announcement) {
        throw new AppError(404, `Announcement with ID '${id}' was not found`, undefined, 'ANNOUNCEMENT_NOT_FOUND');
      }
      res.status(200).json(apiSuccess(announcement));
    } catch (err) {
      next(err);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, slug, title, summary, body, priority, publishStatus, status, expiresAt } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        throw new AppError(400, 'Title is required', undefined, 'INVALID_TITLE');
      }
      if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
        throw new AppError(400, 'Summary is required', undefined, 'INVALID_SUMMARY');
      }

      const sanitizedTitle = sanitizeContent(title);
      const sanitizedSummary = sanitizeContent(summary);
      const sanitizedBody = sanitizeContent(body || summary);

      // Validate custom slug if provided
      if (slug && typeof slug === 'string') {
        const cleanSlug = slug.toLowerCase().trim();
        if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
          throw new AppError(400, 'Slug must contain only lowercase alphanumeric characters and hyphens', undefined, 'INVALID_SLUG');
        }
        if (announcementsRepository.isSlugTaken(cleanSlug)) {
          throw new AppError(409, `Slug '${cleanSlug}' is already in use by another announcement`, undefined, 'SLUG_CONFLICT');
        }
      }

      const announcementId = id || `ann-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const targetStatus = publishStatus || status || 'draft';

      if (!['draft', 'published', 'archived'].includes(targetStatus)) {
        throw new AppError(400, "Status must be 'draft', 'published', or 'archived'", undefined, 'INVALID_STATUS');
      }

      const validatedExpiresAt = validateExpiresAt(expiresAt, false);
      const now = new Date().toISOString();

      const announcement = announcementsRepository.create({
        id: announcementId,
        slug: slug ? slug.trim() : undefined,
        title: sanitizedTitle,
        summary: sanitizedSummary,
        body: sanitizedBody,
        priority: priority === 'Urgent' ? 'Urgent' : 'Normal',
        publish_status: targetStatus,
        published_at: targetStatus === 'published' ? now : null,
        expires_at: validatedExpiresAt,
      });

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'ANNOUNCEMENT_CREATED',
          entityType: 'ANNOUNCEMENT',
          entityId: announcementId,
          afterJson: announcement,
          details: { title: sanitizedTitle, publishStatus: targetStatus, priority: announcement.priority },
        },
        req
      );

      res.status(201).json(apiSuccess(announcement, { message: 'Announcement created successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const expectedUpdatedAt = (req.headers['if-match'] as string | undefined) || req.body.expected_updated_at;

      const existing = announcementsRepository.findById(id);
      if (!existing) {
        throw new AppError(404, `Announcement with ID '${id}' was not found`, undefined, 'ANNOUNCEMENT_NOT_FOUND');
      }

      const updates: Partial<AnnouncementRecord> = {};

      if (req.body.title !== undefined) {
        if (!req.body.title || typeof req.body.title !== 'string' || req.body.title.trim().length === 0) {
          throw new AppError(400, 'Title cannot be empty', undefined, 'INVALID_TITLE');
        }
        updates.title = sanitizeContent(req.body.title);
      }

      if (req.body.summary !== undefined) {
        if (!req.body.summary || typeof req.body.summary !== 'string' || req.body.summary.trim().length === 0) {
          throw new AppError(400, 'Summary cannot be empty', undefined, 'INVALID_SUMMARY');
        }
        updates.summary = sanitizeContent(req.body.summary);
      }

      if (req.body.body !== undefined) {
        updates.body = sanitizeContent(req.body.body);
      }

      if (req.body.priority !== undefined) {
        updates.priority = req.body.priority === 'Urgent' ? 'Urgent' : 'Normal';
      }

      if (req.body.slug !== undefined) {
        const cleanSlug = req.body.slug ? req.body.slug.toLowerCase().trim() : '';
        if (cleanSlug && !/^[a-z0-9-]+$/.test(cleanSlug)) {
          throw new AppError(400, 'Slug must contain only lowercase alphanumeric characters and hyphens', undefined, 'INVALID_SLUG');
        }
        if (cleanSlug && announcementsRepository.isSlugTaken(cleanSlug, id)) {
          throw new AppError(409, `Slug '${cleanSlug}' is already in use by another announcement`, undefined, 'SLUG_CONFLICT');
        }
        updates.slug = cleanSlug;
      }

      if (req.body.publishStatus !== undefined || req.body.status !== undefined) {
        const targetStatus = req.body.publishStatus || req.body.status;
        if (!['draft', 'published', 'archived'].includes(targetStatus)) {
          throw new AppError(400, "Status must be 'draft', 'published', or 'archived'", undefined, 'INVALID_STATUS');
        }
        updates.publish_status = targetStatus;
        if (targetStatus === 'published' && !existing.published_at) {
          updates.published_at = new Date().toISOString();
        }
      }

      if (req.body.expiresAt !== undefined || req.body.expires_at !== undefined) {
        const expVal = req.body.expiresAt !== undefined ? req.body.expiresAt : req.body.expires_at;
        updates.expires_at = validateExpiresAt(expVal, true);
      }

      const result = announcementsRepository.updateWithConcurrency(id, updates, expectedUpdatedAt);

      if (result.conflict) {
        throw new AppError(
          409,
          'Conflict: This announcement was modified by another administrator. Please refresh and retry.',
          undefined,
          'CONCURRENCY_CONFLICT'
        );
      }

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'ANNOUNCEMENT_UPDATED',
          entityType: 'ANNOUNCEMENT',
          entityId: id,
          beforeJson: existing,
          afterJson: result.announcement,
          details: { updatedFields: Object.keys(updates) },
        },
        req
      );

      res.status(200).json(apiSuccess(result.announcement, { message: 'Announcement updated successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const existing = announcementsRepository.findById(id);
      if (!existing) {
        throw new AppError(404, `Announcement with ID '${id}' was not found`, undefined, 'ANNOUNCEMENT_NOT_FOUND');
      }

      const updated = announcementsRepository.updateStatus(id, 'published');

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'ANNOUNCEMENT_PUBLISHED',
          entityType: 'ANNOUNCEMENT',
          entityId: id,
          beforeJson: existing,
          afterJson: updated,
          details: { previousStatus: existing.publish_status, newStatus: 'published' },
        },
        req
      );

      res.status(200).json(apiSuccess(updated, { message: 'Announcement published successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async unpublish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const existing = announcementsRepository.findById(id);
      if (!existing) {
        throw new AppError(404, `Announcement with ID '${id}' was not found`, undefined, 'ANNOUNCEMENT_NOT_FOUND');
      }

      const updated = announcementsRepository.updateStatus(id, 'draft');

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'ANNOUNCEMENT_UNPUBLISHED',
          entityType: 'ANNOUNCEMENT',
          entityId: id,
          beforeJson: existing,
          afterJson: updated,
          details: { previousStatus: existing.publish_status, newStatus: 'draft' },
        },
        req
      );

      res.status(200).json(apiSuccess(updated, { message: 'Announcement unpublished and moved to draft' }));
    } catch (err) {
      next(err);
    }
  }

  public async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const existing = announcementsRepository.findById(id);
      if (!existing) {
        throw new AppError(404, `Announcement with ID '${id}' was not found`, undefined, 'ANNOUNCEMENT_NOT_FOUND');
      }

      const updated = announcementsRepository.updateStatus(id, 'archived');

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'ANNOUNCEMENT_ARCHIVED',
          entityType: 'ANNOUNCEMENT',
          entityId: id,
          beforeJson: existing,
          afterJson: updated,
          details: { previousStatus: existing.publish_status, newStatus: 'archived' },
        },
        req
      );

      res.status(200).json(apiSuccess(updated, { message: 'Announcement archived successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['draft', 'published', 'archived'].includes(status)) {
        throw new AppError(400, "Status must be one of: 'draft', 'published', 'archived'", undefined, 'INVALID_STATUS');
      }

      if (status === 'published') {
        return this.publish(req, res, next);
      } else if (status === 'archived') {
        return this.archive(req, res, next);
      } else {
        return this.unpublish(req, res, next);
      }
    } catch (err) {
      next(err);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const announcement = announcementsRepository.findById(id);
      if (!announcement) {
        throw new AppError(404, `Announcement with ID '${id}' was not found`, undefined, 'ANNOUNCEMENT_NOT_FOUND');
      }

      announcementsRepository.deleteAnnouncement(id);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'ANNOUNCEMENT_ARCHIVED',
          entityType: 'ANNOUNCEMENT',
          entityId: id,
          beforeJson: announcement,
          details: { title: announcement.title, deleted: true },
        },
        req
      );

      res.status(200).json(apiSuccess({ deleted: true, id }, { message: 'Announcement deleted successfully' }));
    } catch (err) {
      next(err);
    }
  }
}

export const adminAnnouncementsController = new AdminAnnouncementsController();
