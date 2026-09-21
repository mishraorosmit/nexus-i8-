import { Request, Response, NextFunction } from 'express';
import { eventRegistrationService } from './eventRegistration.service.ts';
import { eventsRepository } from '../../db/repositories/events.repository.ts';
import { auditService } from '../../services/audit.service.ts';
import { AppError } from '../../middleware/errorHandler.ts';

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class EventRegistrationController {
  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = req.params.id || req.params.eventId;
      const {
        name,
        attendee_name,
        email,
        attendee_email,
        phone,
        attendee_phone,
        organization,
        department,
        college,
        metadata,
      } = req.body;

      const registration = await eventRegistrationService.register(eventId, {
        name: name || attendee_name,
        attendee_name: attendee_name || name,
        email: email || attendee_email,
        attendee_email: attendee_email || email,
        phone: phone || attendee_phone,
        organization,
        department: department || college || organization,
        metadata,
      });

      res.status(201).json({
        data: {
          id: registration.id,
          event_id: registration.event_id,
          attendee_name: registration.attendee_name,
          attendee_email: registration.attendee_email,
          status: registration.status,
          department: registration.department,
          registration_timestamp: registration.registration_timestamp,
          message: 'Registration confirmed. You are on the attendee list.',
        },
        meta: null,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  public async listForEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = req.params.id || req.params.eventId;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const { items, total } = await eventRegistrationService.getRegistrationsForEvent(eventId, {
        status,
        search,
        page,
        limit,
      });

      const totalPages = Math.ceil(total / limit);

      res.json({
        data: items.map((r) => ({
          ...r,
          metadata: r.metadata ? JSON.parse(r.metadata) : null,
        })),
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  public async exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = req.params.id || req.params.eventId;
      const event = eventsRepository.findById(eventId) || eventsRepository.findBySlug(eventId);
      if (!event) {
        throw new AppError(404, `Event not found: ${eventId}`, undefined, 'EVENT_NOT_FOUND');
      }

      const attendees = await eventRegistrationService.getAllRegistrationsForEvent(event.id);

      const headers = ['Registration ID', 'Event Title', 'Attendee Name', 'Attendee Email', 'Phone', 'Department/Org', 'Status', 'Registered At'];
      const rows = attendees.map((a) => [
        escapeCsvField(a.id),
        escapeCsvField(event.title),
        escapeCsvField(a.attendee_name),
        escapeCsvField(a.attendee_email),
        escapeCsvField(a.attendee_phone || ''),
        escapeCsvField(a.department || a.organization || ''),
        escapeCsvField(a.status),
        escapeCsvField(a.registration_timestamp),
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

      auditService.log(
        {
          adminId: (req as any).admin?.adminId,
          adminName: (req as any).admin?.name,
          adminRole: (req as any).admin?.role,
          action: 'EVENT_REGISTRATIONS_EXPORTED',
          entityType: 'EVENT',
          entityId: event.id,
          details: {
            eventTitle: event.title,
            recordCount: attendees.length,
            format: 'csv',
          },
        },
        req
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="event-${event.slug || event.id}-attendees.csv"`);
      res.status(200).send(csvContent);
    } catch (err) {
      next(err);
    }
  }

  public async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const registrationId = req.params.id;
      const { status } = req.body;
      if (!status) {
        throw new AppError(400, 'Status is required', undefined, 'INVALID_STATUS');
      }

      const updated = await eventRegistrationService.updateStatus(registrationId, status, req);

      res.json({
        data: {
          ...updated,
          metadata: updated.metadata ? JSON.parse(updated.metadata) : null,
        },
        meta: null,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const eventRegistrationController = new EventRegistrationController();
