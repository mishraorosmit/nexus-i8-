import crypto from 'node:crypto';
import { getDatabase } from '../../db/connection.ts';
import {
  eventRegistrationsRepository,
  type EventRegistrationRecord,
  type EventRegistrationStatus,
} from '../../db/repositories/eventRegistrations.repository.ts';
import { eventsRepository, type EventRecord } from '../../db/repositories/events.repository.ts';
import { auditService } from '../../services/audit.service.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { sanitizeText } from '../../middleware/spamProtection.ts';
import { notificationHooks, NotificationHookService } from '../../services/notificationHook.service.ts';
import type { Request } from 'express';

export const VALID_REGISTRATION_TRANSITIONS: Record<EventRegistrationStatus, EventRegistrationStatus[]> = {
  CONFIRMED: ['CANCELLED', 'ATTENDED'],
  WAITLISTED: ['CONFIRMED', 'CANCELLED'],
  CANCELLED: [],
  ATTENDED: [],
};

export interface RegisterEventDto {
  name?: string;
  attendee_name?: string;
  email?: string;
  attendee_email?: string;
  phone?: string;
  attendee_phone?: string;
  organization?: string;
  department?: string;
  college?: string;
  metadata?: Record<string, any>;
}

export class EventRegistrationService {
  /**
   * Helper to resolve event by ID or Slug
   */
  public resolveEvent(eventIdentifier: string): EventRecord {
    let event = eventsRepository.findById(eventIdentifier);
    if (!event) {
      event = eventsRepository.findBySlug(eventIdentifier);
    }
    if (!event) {
      throw new AppError(404, `Event not found: ${eventIdentifier}`, undefined, 'EVENT_NOT_FOUND');
    }
    return event;
  }

  /**
   * Atomic, race-condition protected event registration
   */
  public async register(eventIdentifier: string, dto: RegisterEventDto): Promise<EventRegistrationRecord> {
    // 1. Resolve event initially
    const initialEvent = this.resolveEvent(eventIdentifier);

    // 2. Validate attendee inputs
    const rawName = dto.name || dto.attendee_name || '';
    const attendeeName = sanitizeText(rawName).trim();
    if (!attendeeName || attendeeName.length < 2 || attendeeName.length > 100) {
      throw new AppError(400, 'Attendee name must be between 2 and 100 characters', undefined, 'INVALID_NAME');
    }

    const rawEmail = dto.email || dto.attendee_email || '';
    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new AppError(400, 'A valid attendee email address is required', undefined, 'INVALID_EMAIL');
    }

    const rawPhone = dto.phone || dto.attendee_phone;
    const phone = rawPhone ? sanitizeText(rawPhone).substring(0, 30) : null;

    const rawDept = dto.department || dto.college || dto.organization;
    const dept = rawDept ? sanitizeText(rawDept).substring(0, 100) : null;
    const org = dto.organization ? sanitizeText(dto.organization).substring(0, 100) : dept;

    const registrationId = `evreg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const db = getDatabase();

    // 3. Execute capacity check and insertion inside an immediate SQLite transaction
    // SQLite BEGIN IMMEDIATE acquires a reserved write-lock upfront, preventing concurrent overbooking
    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    let record: any;
    try {
      const lockedEvent = eventsRepository.findById(initialEvent.id);
      if (!lockedEvent) {
        throw new AppError(404, 'Event not found', undefined, 'EVENT_NOT_FOUND');
      }

      // Check status
      if (
        lockedEvent.registration_enabled === 0 ||
        lockedEvent.registration_status === 'CLOSED' ||
        lockedEvent.status === 'Draft' ||
        lockedEvent.status === 'Archived' ||
        lockedEvent.status === 'Completed' ||
        lockedEvent.status === 'Cancelled'
      ) {
        throw new AppError(
          400,
          `Registration for "${lockedEvent.title}" is currently closed.`,
          undefined,
          'EVENT_REGISTRATION_CLOSED'
        );
      }

      const now = new Date().toISOString();

      // Check scheduling window
      if (lockedEvent.registration_start && now < lockedEvent.registration_start) {
        throw new AppError(
          400,
          `Registration for "${lockedEvent.title}" has not opened yet.`,
          undefined,
          'REGISTRATION_NOT_STARTED'
        );
      }
      if (lockedEvent.registration_end && now > lockedEvent.registration_end) {
        throw new AppError(
          400,
          `Registration for "${lockedEvent.title}" closed on ${lockedEvent.registration_end}.`,
          undefined,
          'REGISTRATION_EXPIRED'
        );
      }

      // Check duplicate
      const existing = eventRegistrationsRepository.findByEventAndEmail(lockedEvent.id, email);
      if (existing && (existing.status === 'CONFIRMED' || existing.status === 'WAITLISTED')) {
        throw new AppError(
          409,
          `Attendee "${email}" is already registered for this event.`,
          undefined,
          'DUPLICATE_REGISTRATION'
        );
      }

      // Check capacity
      if (typeof lockedEvent.capacity === 'number' && lockedEvent.capacity > 0) {
        const confirmedCount = eventRegistrationsRepository.countConfirmedByEvent(lockedEvent.id);
        if (confirmedCount >= lockedEvent.capacity) {
          throw new AppError(
            400,
            `Event "${lockedEvent.title}" has reached its maximum capacity of ${lockedEvent.capacity} attendees.`,
            undefined,
            'EVENT_CAPACITY_REACHED'
          );
        }
      }

      // Insert record
      record = eventRegistrationsRepository.create({
        id: registrationId,
        event_id: lockedEvent.id,
        attendee_name: attendeeName,
        attendee_email: email,
        attendee_phone: phone,
        organization: org,
        department: dept,
        status: 'CONFIRMED',
        metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
        registration_timestamp: now,
      });

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    // 4. Record Audit Log
    auditService.log({
      adminId: 'system',
      adminName: 'Public Registration',
      adminRole: 'attendee',
      action: 'REGISTRATION_CONFIRMED',
      entityType: 'EVENT_REGISTRATION',
      entityId: record.event_id,
      details: {
        registrationId: record.id,
        attendeeName: record.attendee_name,
        attendeeEmail: record.attendee_email,
        status: record.status,
      },
      afterJson: record,
    });

    // 5. Dispatch Decoupled Notification Hook
    notificationHooks.dispatch('event.registered', {
      registrationId: record.id,
      eventId: record.event_id,
      attendeeName: record.attendee_name,
      maskedEmail: NotificationHookService.maskEmail(record.attendee_email),
      timestamp: record.registration_timestamp,
    });

    return record;
  }

  public async getRegistrationsForEvent(
    eventId: string,
    filter?: { status?: string; search?: string; page?: number; limit?: number }
  ): Promise<{ items: EventRegistrationRecord[]; total: number }> {
    const event = this.resolveEvent(eventId);
    return eventRegistrationsRepository.listByEvent(event.id, filter);
  }

  public async getAllRegistrationsForEvent(eventId: string): Promise<EventRegistrationRecord[]> {
    const event = this.resolveEvent(eventId);
    return eventRegistrationsRepository.listAllForEvent(event.id);
  }

  public async updateStatus(
    registrationId: string,
    newStatus: EventRegistrationStatus,
    req?: Request
  ): Promise<EventRegistrationRecord> {
    const existing = eventRegistrationsRepository.findById(registrationId);
    if (!existing) {
      throw new AppError(404, `Registration not found: ${registrationId}`, undefined, 'REGISTRATION_NOT_FOUND');
    }

    // State machine check
    const allowed = VALID_REGISTRATION_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        400,
        `Cannot transition registration status from ${existing.status} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'None (Terminal)'}`,
        undefined,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = eventRegistrationsRepository.updateStatus(registrationId, newStatus);
    if (!updated) {
      throw new AppError(500, 'Failed to update registration status', undefined, 'INTERNAL_SERVER_ERROR');
    }

    // Audit log cancellation
    if (newStatus === 'CANCELLED' && req) {
      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'REGISTRATION_CANCELLED',
          entityType: 'EVENT_REGISTRATION',
          entityId: registrationId,
          details: {
            eventId: updated.event_id,
            attendeeEmail: updated.attendee_email,
            previousStatus: existing.status,
          },
          beforeJson: existing,
          afterJson: updated,
        },
        req
      );
    }

    if (newStatus === 'CANCELLED') {
      notificationHooks.dispatch('event.cancelled', {
        registrationId: updated.id,
        eventId: updated.event_id,
        timestamp: updated.updated_at,
      });
    }

    return updated;
  }
}

export const eventRegistrationService = new EventRegistrationService();
