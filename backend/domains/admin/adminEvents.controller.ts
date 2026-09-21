import { Request, Response, NextFunction } from 'express';
import { eventsRepository, type EventRecord } from '../../db/repositories/events.repository.ts';
import { auditService } from '../../services/audit.service.ts';
import { cloudinaryService } from '../../services/cloudinary.service.ts';
import { validateMediaUpload } from '../../utils/mimeSniffer.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { apiSuccess, createPaginationMeta } from '../../utils/apiResponse.ts';

function sanitizeSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseMultipartFile(buffer: Buffer, boundary: string): { buffer: Buffer; filename: string } | null {
  const boundaryBytes = Buffer.from(`--${boundary}`);
  const startIdx = buffer.indexOf(boundaryBytes);
  if (startIdx === -1) return null;

  const headerStart = startIdx + boundaryBytes.length + 2;
  const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
  if (headerEnd === -1) return null;

  const headerStr = buffer.subarray(headerStart, headerEnd).toString('utf-8');
  const filenameMatch = headerStr.match(/filename="([^"]+)"/i) || headerStr.match(/filename=([^\s;]+)/i);
  const filename = filenameMatch ? filenameMatch[1] : 'cover.png';

  const bodyStart = headerEnd + 4;
  const nextBoundary = buffer.indexOf(boundaryBytes, bodyStart);
  if (nextBoundary === -1) return null;

  let bodyEnd = nextBoundary;
  if (bodyEnd >= 2 && buffer[bodyEnd - 2] === 0x0d && buffer[bodyEnd - 1] === 0x0a) {
    bodyEnd -= 2;
  }

  const fileBuffer = buffer.subarray(bodyStart, bodyEnd);
  return { buffer: fileBuffer, filename };
}

function extractUploadPayload(req: Request): { buffer: Buffer; filename: string } {
  if (req.is('application/json') && req.body) {
    const raw = req.body.content || req.body.file || req.body.data || req.body.image;
    if (!raw || typeof raw !== 'string') {
      throw new AppError(400, 'Image payload is required (base64 string or data URL)', undefined, 'INVALID_IMAGE_PAYLOAD');
    }
    const base64Data = raw.includes(';base64,') ? raw.split(';base64,')[1] : raw;
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = req.body.filename || req.body.fileName || 'cover.png';
    return { buffer, filename };
  }

  if (Buffer.isBuffer(req.body)) {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1].trim().replace(/^["']|["']$/g, '');
        const file = parseMultipartFile(req.body, boundary);
        if (file) return file;
      }
    }
    const filename = (req.headers['x-filename'] as string) || 'cover.png';
    return { buffer: req.body, filename };
  }

  throw new AppError(400, 'Unsupported upload Content-Type. Use multipart/form-data or application/json with Base64 payload.', undefined, 'UNSUPPORTED_MEDIA_TYPE');
}

export function formatAdminEvent(e: EventRecord): Record<string, unknown> {
  return {
    ...e,
    shortDescription: e.short_description,
    eventType: e.event_type,
    eventStart: e.event_start,
    eventEnd: e.event_end,
    eventDate: e.event_date,
    eventTime: e.event_time,
    registrationUrl: e.registration_url,
    registrationEnabled: e.registration_enabled === 1,
    registrationStart: e.registration_start,
    registrationEnd: e.registration_end,
    registrationStatus: e.registration_status,
    coverImageUrl: e.cover_image_url || e.cover_image,
    coverImagePublicId: e.cover_image_public_id,
    featured: e.featured === 1,
    confirmedCount: e.confirmed_count || 0,
    publishedAt: e.published_at,
  };
}

export class AdminEventsController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as string | undefined;
      const eventType = req.query.eventType as string | undefined || req.query.event_type as string | undefined;
      const registrationState = req.query.registrationState as string | undefined || req.query.registration_state as string | undefined;
      const search = req.query.search as string | undefined;
      const sort = req.query.sort as string | undefined;

      const { items, total } = eventsRepository.findAllAdmin({
        page,
        limit,
        status,
        event_type: eventType,
        registration_state: registrationState,
        search,
        sort,
      });

      const meta = createPaginationMeta(page, limit, total);
      res.status(200).json(apiSuccess(items.map(formatAdminEvent), meta));
    } catch (err) {
      next(err);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const event = eventsRepository.findById(id);
      if (!event) {
        throw new AppError(404, `Event with ID '${id}' was not found`, undefined, 'EVENT_NOT_FOUND');
      }
      res.status(200).json(apiSuccess(formatAdminEvent(event)));
    } catch (err) {
      next(err);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        id,
        slug,
        title,
        shortDescription,
        short_description,
        description,
        eventType,
        event_type,
        eventStart,
        event_start,
        eventEnd,
        event_end,
        venue,
        location,
        registrationUrl,
        registration_url,
        registrationEnabled,
        registration_enabled,
        registrationStart,
        registration_start,
        registrationEnd,
        registration_end,
        capacity,
        coverImage,
        cover_image,
        coverImageUrl,
        cover_image_url,
        featured,
        status,
      } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        throw new AppError(400, 'Event title is required', undefined, 'INVALID_TITLE');
      }

      const finalEventType = eventType || event_type || 'Workshop';
      const finalDesc = description || '';
      const finalShortDesc = shortDescription || short_description || (finalDesc ? finalDesc.substring(0, 160) : title.trim());
      const finalLocation = location || venue || 'SOA Main Lab';
      const finalVenue = venue || location || finalLocation;

      // Schedule validation
      const finalStart = eventStart || event_start || new Date().toISOString();
      const finalEnd = eventEnd || event_end || finalStart;

      const startTime = new Date(finalStart).getTime();
      const endTime = new Date(finalEnd).getTime();

      if (isNaN(startTime) || isNaN(endTime)) {
        throw new AppError(400, 'Invalid event start or end date representation', undefined, 'INVALID_DATE');
      }
      if (endTime < startTime) {
        throw new AppError(400, 'event_end must be chronologically after event_start', undefined, 'INVALID_SCHEDULE');
      }

      // Registration window validation
      const regStart = registrationStart || registration_start || null;
      const regEnd = registrationEnd || registration_end || null;
      if (regStart && regEnd) {
        const rsTime = new Date(regStart).getTime();
        const reTime = new Date(regEnd).getTime();
        if (isNaN(rsTime) || isNaN(reTime)) {
          throw new AppError(400, 'Invalid registration start or end date representation', undefined, 'INVALID_DATE');
        }
        if (reTime < rsTime) {
          throw new AppError(400, 'Registration closing date must be after registration opening date', undefined, 'INVALID_SCHEDULE');
        }
        if (reTime > startTime) {
          throw new AppError(400, 'registration_end cannot be after event_start', undefined, 'INVALID_SCHEDULE');
        }
      }

      // Capacity validation
      let finalCapacity: number | null = null;
      if (capacity !== undefined && capacity !== null && capacity !== '') {
        const capNum = Number(capacity);
        if (!Number.isInteger(capNum) || capNum < 0) {
          throw new AppError(400, 'Invalid capacity: capacity must be a non-negative whole number', undefined, 'INVALID_CAPACITY');
        }
        finalCapacity = capNum;
      }

      // Slug generation and conflict check
      const eventSlug = sanitizeSlug(slug || title);
      if (!eventSlug) {
        throw new AppError(400, 'Valid event slug could not be generated from title', undefined, 'INVALID_SLUG');
      }
      if (eventsRepository.isSlugTaken(eventSlug)) {
        throw new AppError(409, `An event with slug '${eventSlug}' already exists`, undefined, 'SLUG_CONFLICT');
      }

      const eventId = id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const normalizedStatus = status || 'Draft';
      const isRegEnabled = registrationEnabled !== undefined ? (registrationEnabled ? 1 : 0) : (registration_enabled !== undefined ? (registration_enabled ? 1 : 0) : 1);

      const event = eventsRepository.create({
        id: eventId,
        slug: eventSlug,
        title: title.trim(),
        short_description: finalShortDesc.trim(),
        description: finalDesc,
        event_type: finalEventType,
        event_date: finalStart.split('T')[0],
        event_time: finalStart.split('T')[1]?.substring(0, 5) || '18:00',
        event_start: finalStart,
        event_end: finalEnd,
        venue: finalVenue,
        location: finalLocation,
        registration_url: registrationUrl || registration_url || null,
        registration_enabled: isRegEnabled,
        registration_start: regStart,
        registration_end: regEnd,
        registration_status: isRegEnabled === 0 ? 'CLOSED' : 'OPEN',
        capacity: finalCapacity,
        cover_image: coverImageUrl || cover_image_url || coverImage || cover_image || null,
        cover_image_url: coverImageUrl || cover_image_url || coverImage || cover_image || null,
        cover_image_public_id: null,
        featured: featured ? 1 : 0,
        status: normalizedStatus,
        published_at: normalizedStatus === 'Published' || normalizedStatus === 'Upcoming' ? new Date().toISOString() : null,
      });

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'EVENT_CREATED',
          entityType: 'EVENT',
          entityId: eventId,
          details: { title: event.title, slug: event.slug, status: event.status },
          afterJson: event,
        },
        req
      );

      res.status(201).json(apiSuccess(formatAdminEvent(event), { message: 'Event created successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const expectedUpdatedAt = (req.headers['if-match'] as string | undefined) || req.body.expected_updated_at;

      const event = eventsRepository.findById(id);
      if (!event) {
        throw new AppError(404, `Event with ID '${id}' was not found`, undefined, 'EVENT_NOT_FOUND');
      }

      const updates: Partial<EventRecord> = {};

      if (req.body.title !== undefined) {
        const title = String(req.body.title).trim();
        if (!title) throw new AppError(400, 'Title cannot be empty', undefined, 'INVALID_TITLE');
        updates.title = title;
      }

      if (req.body.slug !== undefined) {
        const cleanSlug = sanitizeSlug(req.body.slug);
        if (!cleanSlug) throw new AppError(400, 'Slug cannot be empty', undefined, 'INVALID_SLUG');
        if (eventsRepository.isSlugTaken(cleanSlug, id)) {
          throw new AppError(409, `An event with slug '${cleanSlug}' already exists`, undefined, 'SLUG_CONFLICT');
        }
        updates.slug = cleanSlug;
      }

      if (req.body.shortDescription !== undefined || req.body.short_description !== undefined) {
        updates.short_description = (req.body.shortDescription ?? req.body.short_description ?? '').trim();
      }
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.eventType !== undefined || req.body.event_type !== undefined) {
        updates.event_type = req.body.eventType || req.body.event_type;
      }

      const newStart = req.body.eventStart !== undefined ? req.body.eventStart : req.body.event_start;
      const newEnd = req.body.eventEnd !== undefined ? req.body.eventEnd : req.body.event_end;
      const finalStart = newStart !== undefined ? newStart : event.event_start;
      const finalEnd = newEnd !== undefined ? newEnd : event.event_end;

      if (newStart !== undefined || newEnd !== undefined) {
        if (finalStart && finalEnd) {
          const st = new Date(finalStart).getTime();
          const et = new Date(finalEnd).getTime();
          if (isNaN(st) || isNaN(et)) {
            throw new AppError(400, 'Invalid event start or end date representation', undefined, 'INVALID_DATE');
          }
          if (et < st) {
            throw new AppError(400, 'Event end date must be after event start date', undefined, 'INVALID_SCHEDULE');
          }
        }
        if (newStart !== undefined) {
          updates.event_start = newStart;
          updates.event_date = newStart ? newStart.split('T')[0] : null;
          updates.event_time = newStart ? newStart.split('T')[1]?.substring(0, 5) : '18:00';
        }
        if (newEnd !== undefined) updates.event_end = newEnd;
      }

      const newRegStart = req.body.registrationStart !== undefined ? req.body.registrationStart : req.body.registration_start;
      const newRegEnd = req.body.registrationEnd !== undefined ? req.body.registrationEnd : req.body.registration_end;
      const finalRegStart = newRegStart !== undefined ? newRegStart : event.registration_start;
      const finalRegEnd = newRegEnd !== undefined ? newRegEnd : event.registration_end;

      if (newRegStart !== undefined || newRegEnd !== undefined) {
        if (finalRegStart && finalRegEnd) {
          const rs = new Date(finalRegStart).getTime();
          const re = new Date(finalRegEnd).getTime();
          if (isNaN(rs) || isNaN(re)) {
            throw new AppError(400, 'Invalid registration dates', undefined, 'INVALID_DATE');
          }
          if (re < rs) {
            throw new AppError(400, 'Registration closing date must be after registration opening date', undefined, 'INVALID_SCHEDULE');
          }
          if (finalEnd && re > new Date(finalEnd).getTime()) {
            throw new AppError(400, 'Registration cannot close after event has ended', undefined, 'INVALID_SCHEDULE');
          }
        }
        if (newRegStart !== undefined) updates.registration_start = newRegStart;
        if (newRegEnd !== undefined) updates.registration_end = newRegEnd;
      }

      if (req.body.venue !== undefined || req.body.location !== undefined) {
        const loc = req.body.location || req.body.venue;
        updates.location = loc;
        updates.venue = loc;
      }

      if (req.body.registrationUrl !== undefined || req.body.registration_url !== undefined) {
        updates.registration_url = req.body.registrationUrl ?? req.body.registration_url ?? null;
      }

      if (req.body.registrationEnabled !== undefined || req.body.registration_enabled !== undefined) {
        const en = req.body.registrationEnabled !== undefined ? req.body.registrationEnabled : req.body.registration_enabled;
        updates.registration_enabled = en ? 1 : 0;
        updates.registration_status = en ? 'OPEN' : 'CLOSED';
      }

      if (req.body.capacity !== undefined) {
        if (req.body.capacity === null || req.body.capacity === '') {
          updates.capacity = null;
        } else {
          const capNum = Number(req.body.capacity);
          if (!Number.isInteger(capNum) || capNum < 0) {
            throw new AppError(400, 'Capacity must be a non-negative integer', undefined, 'INVALID_CAPACITY');
          }
          updates.capacity = capNum;
        }
      }

      if (req.body.coverImageUrl !== undefined || req.body.cover_image_url !== undefined || req.body.coverImage !== undefined) {
        const img = req.body.coverImageUrl ?? req.body.cover_image_url ?? req.body.coverImage ?? null;
        updates.cover_image = img;
        updates.cover_image_url = img;
      }

      if (req.body.featured !== undefined) updates.featured = req.body.featured ? 1 : 0;
      if (req.body.status !== undefined) updates.status = req.body.status;

      const result = eventsRepository.updateWithConcurrency(id, updates, expectedUpdatedAt);

      if (result.conflict) {
        throw new AppError(
          409,
          'Conflict: This event was modified by another administrator. Please refresh and retry.',
          undefined,
          'CONCURRENCY_CONFLICT'
        );
      }

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'EVENT_UPDATED',
          entityType: 'EVENT',
          entityId: id,
          details: { updatedFields: Object.keys(updates) },
          beforeJson: event,
          afterJson: result.event,
        },
        req
      );

      res.status(200).json(apiSuccess(formatAdminEvent(result.event || event), { message: 'Event updated successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['Draft', 'Published', 'Archived', 'Upcoming', 'Completed', 'Cancelled'].includes(status)) {
        throw new AppError(400, "Status must be one of: 'Draft', 'Published', 'Archived'", undefined, 'INVALID_STATUS');
      }

      if (status === 'Archived' && req.admin?.role !== 'super_admin') {
        throw new AppError(403, 'Forbidden: Only super_admin can archive events', undefined, 'INSUFFICIENT_PERMISSIONS');
      }

      const event = eventsRepository.findById(id);
      if (!event) {
        throw new AppError(404, `Event with ID '${id}' was not found`, undefined, 'EVENT_NOT_FOUND');
      }

      const previousStatus = event.status;
      const updated = eventsRepository.updateStatus(id, status);

      let auditAction = 'EVENT_UPDATED';
      if (status === 'Published' || status === 'Upcoming') auditAction = 'EVENT_PUBLISHED';
      else if (status === 'Archived') auditAction = 'EVENT_ARCHIVED';
      else if (status === 'Draft') auditAction = 'EVENT_UNPUBLISHED';

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: auditAction,
          entityType: 'EVENT',
          entityId: id,
          details: { previousStatus, newStatus: status },
          beforeJson: event,
          afterJson: updated || undefined,
        },
        req
      );

      res.status(200).json(apiSuccess(formatAdminEvent(updated || event), { message: `Event status updated to '${status}'` }));
    } catch (err) {
      next(err);
    }
  }

  public async toggleRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { enabled, registration_enabled, registrationEnabled, registration_status, registrationStatus } = req.body;
      let isEnabled = true;
      if (enabled !== undefined) {
        isEnabled = Boolean(enabled);
      } else if (registration_enabled !== undefined) {
        isEnabled = Boolean(registration_enabled);
      } else if (registrationEnabled !== undefined) {
        isEnabled = Boolean(registrationEnabled);
      } else if (registration_status !== undefined) {
        isEnabled = String(registration_status).toUpperCase() === 'OPEN';
      } else if (registrationStatus !== undefined) {
        isEnabled = String(registrationStatus).toUpperCase() === 'OPEN';
      }

      const event = eventsRepository.findById(id);
      if (!event) {
        throw new AppError(404, `Event with ID '${id}' was not found`, undefined, 'EVENT_NOT_FOUND');
      }

      const updated = eventsRepository.toggleRegistration(id, isEnabled);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: isEnabled ? 'REGISTRATION_OPENED' : 'REGISTRATION_CLOSED',
          entityType: 'EVENT',
          entityId: id,
          details: { registrationEnabled: isEnabled },
          beforeJson: event,
          afterJson: updated || undefined,
        },
        req
      );

      res.status(200).json(
        apiSuccess(formatAdminEvent(updated || event), {
          message: `Registration ${isEnabled ? 'opened' : 'closed'} successfully`,
        })
      );
    } catch (err) {
      next(err);
    }
  }

  public async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const event = eventsRepository.findById(id);
      if (!event) {
        throw new AppError(404, `Event with ID '${id}' was not found`, undefined, 'EVENT_NOT_FOUND');
      }

      const { buffer, filename } = extractUploadPayload(req);

      // Enforces 10MB ceiling and sniffs magic bytes (JPEG, PNG, WebP)
      const validation = validateMediaUpload(buffer, filename, 'events');
      if (!validation.valid || !validation.detectedMime) {
        throw new AppError(
          validation.code === 'FILE_TOO_LARGE' ? 413 : 400,
          validation.error || 'Invalid cover image format or size',
          undefined,
          validation.code || 'INVALID_FILE'
        );
      }

      const bufferToUpload = validation.sanitizedBuffer || buffer;
      const oldPublicId = event.cover_image_public_id;

      // Upload to Cloudinary
      const uploadResult = await cloudinaryService.uploadProfileImage({
        buffer: bufferToUpload,
        filename,
        memberIdentifier: `event-${event.slug || event.id}`,
      });

      // Update SQLite record
      try {
        eventsRepository.update(event.id, {
          cover_image_url: uploadResult.secureUrl,
          cover_image_public_id: uploadResult.publicId,
          cover_image: uploadResult.secureUrl,
        });
      } catch (dbErr) {
        // If DB write fails, clean up uploaded asset
        try {
          await cloudinaryService.destroyImage(uploadResult.publicId);
        } catch {
          // ignore cleanup failure
        }
        throw new AppError(500, 'Database error while saving event cover image reference', undefined, 'DATABASE_ERROR');
      }

      // Safe replacement: Clean up old asset only AFTER SQLite write succeeds
      if (oldPublicId && oldPublicId !== uploadResult.publicId) {
        try {
          await cloudinaryService.destroyImage(oldPublicId);
        } catch (cleanupErr) {
          console.warn(`[Cloudinary] Failed to clean up replaced asset "${oldPublicId}":`, cleanupErr);
        }
      }

      const updated = eventsRepository.findById(event.id);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'EVENT_IMAGE_CHANGED',
          entityType: 'EVENT',
          entityId: event.id,
          beforeJson: event,
          afterJson: updated || undefined,
          details: {
            publicId: uploadResult.publicId,
            secureUrl: uploadResult.secureUrl,
            bytes: bufferToUpload.length,
          },
        },
        req
      );

      res.status(200).json(apiSuccess(formatAdminEvent(updated || event), { message: 'Cover image uploaded successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (req.admin?.role !== 'super_admin') {
        throw new AppError(403, 'Forbidden: Only super_admin can permanently delete events', undefined, 'INSUFFICIENT_PERMISSIONS');
      }

      const event = eventsRepository.findById(id);
      if (!event) {
        throw new AppError(404, `Event with ID '${id}' was not found`, undefined, 'EVENT_NOT_FOUND');
      }

      eventsRepository.deleteEvent(id);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'EVENT_DELETED',
          entityType: 'EVENT',
          entityId: id,
          details: { title: event.title, slug: event.slug },
          beforeJson: event,
        },
        req
      );

      res.status(200).json(apiSuccess({ deleted: true, id }, { message: 'Event permanently deleted' }));
    } catch (err) {
      next(err);
    }
  }
}

export const adminEventsController = new AdminEventsController();
