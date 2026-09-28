import crypto from 'node:crypto';
import { submissionsRepository, SubmissionRecord, InquiryStatus } from '../../db/repositories/submissions.repository.ts';
import { notificationHooks, NotificationHookService } from '../../services/notificationHook.service.ts';
import { sanitizeText } from '../../middleware/spamProtection.ts';
import { generateReferenceId } from '../../utils/referenceId.ts';
import { auditService } from '../../services/audit.service.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import type { Request } from 'express';

export const ALLOWED_CONTACT_CATEGORIES = [
  'collaboration',
  'sponsorship',
  'workshop',
  'project',
  'general inquiry',
  'COLLABORATE WITH US',
  'ASK A QUESTION',
  'JOIN SQUAD',
  'GENERAL',
];

export class SubmissionsService {
  public async getSubmissions(query?: { status?: string; category?: string; intent?: string }): Promise<SubmissionRecord[]> {
    return submissionsRepository.findAll({
      status: query?.status,
      category: query?.category || query?.intent,
    });
  }

  public async getPaginatedInquiries(filter?: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: SubmissionRecord[]; total: number }> {
    return submissionsRepository.findAllPaginated(filter);
  }

  public getFacets() {
    return submissionsRepository.getFacets();
  }

  public async getSubmissionById(idOrRef: string): Promise<SubmissionRecord | null> {
    return submissionsRepository.findByIdOrRef(idOrRef);
  }

  public async createSubmission(data: {
    fullName?: string;
    name?: string;
    email: string;
    intent?: string;
    category?: string;
    majorOrAffiliation?: string;
    message?: string;
  }): Promise<SubmissionRecord> {
    const rawName = data.name || data.fullName || '';
    const name = sanitizeText(rawName);
    const email = data.email.trim().toLowerCase();
    const category = (data.category || data.intent || 'general inquiry').trim();
    const message = data.message ? sanitizeText(data.message) : null;

    const id = `sub-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const reference_id = generateReferenceId('INQ');

    const record = submissionsRepository.create({
      id,
      reference_id,
      name,
      email,
      category,
      message,
      metadata: data.majorOrAffiliation ? JSON.stringify({ majorOrAffiliation: sanitizeText(data.majorOrAffiliation) }) : null,
      status: 'Unread',
      admin_notes: null,
      reviewed_by: null,
      reviewed_at: null,
    });

    // Fire decoupled notification hook
    notificationHooks.dispatch('contact.submitted', {
      id: record.id,
      reference_id: record.reference_id,
      category: record.category,
      name: record.name,
      maskedEmail: NotificationHookService.maskEmail(record.email),
      timestamp: record.created_at,
    });

    return record;
  }

  public async reviewInquiry(
    idOrRef: string,
    params: {
      status?: InquiryStatus;
      adminNotes?: string | null;
    },
    adminContext?: any,
    req?: Request
  ): Promise<SubmissionRecord> {
    const existing = submissionsRepository.findByIdOrRef(idOrRef);
    if (!existing) {
      throw new AppError(404, `Inquiry not found: ${idOrRef}`, undefined, 'INQUIRY_NOT_FOUND');
    }

    const updated = submissionsRepository.updateAdminReview(existing.id, {
      status: params.status,
      adminNotes: params.adminNotes,
      reviewedBy: adminContext?.adminName || 'admin',
    });

    if (!updated) {
      throw new AppError(500, 'Failed to update inquiry review', undefined, 'INTERNAL_SERVER_ERROR');
    }

    auditService.log(
      {
        adminId: adminContext?.adminId,
        adminName: adminContext?.adminName,
        adminRole: adminContext?.adminRole,
        action: 'INQUIRY_REVIEWED',
        entityType: 'INQUIRY',
        entityId: updated.id,
        beforeJson: existing,
        afterJson: updated,
        details: {
          referenceId: updated.reference_id,
          name: updated.name,
          oldStatus: existing.status,
          newStatus: updated.status,
          adminNotes: updated.admin_notes,
        },
      },
      req
    );

    return updated;
  }

  public async updateStatus(id: string, status: SubmissionRecord['status']): Promise<SubmissionRecord | null> {
    return submissionsRepository.updateStatus(id, status);
  }

  public async deleteSubmission(id: string): Promise<boolean> {
    return submissionsRepository.deleteById(id);
  }
}

export const submissionsService = new SubmissionsService();
