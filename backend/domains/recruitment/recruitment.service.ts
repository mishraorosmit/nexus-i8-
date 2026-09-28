import crypto from 'node:crypto';
import {
  recruitmentRepository,
  type RecruitmentRecord,
  type RecruitmentStatus,
} from '../../db/repositories/recruitment.repository.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { sanitizeText } from '../../middleware/spamProtection.ts';
import { notificationHooks, NotificationHookService } from '../../services/notificationHook.service.ts';
import { generateReferenceId } from '../../utils/referenceId.ts';
import { membersAdminService, type CreateMemberInput } from '../../services/members.service.ts';
import { auditService } from '../../services/audit.service.ts';
import { getDatabase, runTransaction } from '../../db/connection.ts';
import type { Request } from 'express';

export const ALLOWED_RECRUITMENT_DOMAINS = [
  'Software & Systems',
  'Hardware & Robotics',
  'Design & Creative Media',
  'Research & AI',
  'General Core',
];

export const VALID_RECRUITMENT_TRANSITIONS: Record<RecruitmentStatus, RecruitmentStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN'],
  UNDER_REVIEW: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: ['WITHDRAWN'],
  REJECTED: [],
  WITHDRAWN: [],
};

export interface CreateRecruitmentDto {
  name: string;
  email: string;
  phone?: string;
  department?: string;
  year_of_study?: string;
  selected_domain: string;
  interests?: string[];
  portfolio_url?: string;
  github_url?: string;
  linkedin_url?: string;
  message?: string;
  consent: boolean;
}

export class RecruitmentService {
  public async submitApplication(dto: CreateRecruitmentDto): Promise<RecruitmentRecord> {
    // 1. Validation: Name
    const name = sanitizeText(dto.name || '');
    if (!name || name.length < 2 || name.length > 100) {
      throw new AppError(400, 'Name must be between 2 and 100 characters', undefined, 'INVALID_NAME');
    }

    // 2. Validation: Email
    const email = (dto.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new AppError(400, 'A valid email address is required', undefined, 'INVALID_EMAIL');
    }

    // 3. Validation: Consent
    if (dto.consent !== true) {
      throw new AppError(400, 'Consent to store and process your application is required', undefined, 'CONSENT_REQUIRED');
    }

    // 4. Validation: Selected Domain
    const domainMatch = ALLOWED_RECRUITMENT_DOMAINS.find(
      (d) => d.toLowerCase() === (dto.selected_domain || '').trim().toLowerCase()
    );
    if (!domainMatch) {
      throw new AppError(
        400,
        `Selected domain must be one of: ${ALLOWED_RECRUITMENT_DOMAINS.join(', ')}`,
        undefined,
        'INVALID_DOMAIN'
      );
    }

    // 5. Validation: URLs (if provided)
    const validateUrl = (url: string | undefined, fieldName: string) => {
      if (!url) return null;
      const trimmed = url.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        throw new AppError(400, `${fieldName} must be a valid HTTP or HTTPS URL`, undefined, 'INVALID_URL');
      }
      return trimmed;
    };

    const portfolioUrl = validateUrl(dto.portfolio_url, 'portfolio_url');
    const githubUrl = validateUrl(dto.github_url, 'github_url');
    const linkedinUrl = validateUrl(dto.linkedin_url, 'linkedin_url');

    // 6. Duplicate Check (Active submission within last 30 days)
    const recent = recruitmentRepository.findRecentActiveByEmail(email, 30);
    if (recent) {
      throw new AppError(
        409,
        'An active recruitment application has already been submitted for this email address within the last 30 days.',
        undefined,
        'DUPLICATE_APPLICATION'
      );
    }

    // 7. Store record
    const id = `rec-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const reference_id = generateReferenceId('APP');
    const interestsJson = JSON.stringify(
      Array.isArray(dto.interests)
        ? dto.interests.map((i) => sanitizeText(String(i))).filter(Boolean)
        : []
    );

    const record = recruitmentRepository.create({
      id,
      reference_id,
      name,
      email,
      phone: dto.phone ? sanitizeText(dto.phone).substring(0, 30) : null,
      department: dto.department ? sanitizeText(dto.department).substring(0, 100) : null,
      year_of_study: dto.year_of_study ? sanitizeText(dto.year_of_study).substring(0, 50) : null,
      selected_domain: domainMatch,
      interests: interestsJson,
      portfolio_url: portfolioUrl,
      github_url: githubUrl,
      linkedin_url: linkedinUrl,
      message: dto.message ? sanitizeText(dto.message).substring(0, 4000) : null,
      consent: 1,
      status: 'SUBMITTED',
      status_notes: null,
      admin_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      converted_member_id: null,
    });

    // 8. Fire decoupled notification hook
    notificationHooks.dispatch('recruitment.submitted', {
      id: record.id,
      reference_id: record.reference_id,
      name: record.name,
      maskedEmail: NotificationHookService.maskEmail(record.email),
      domain: record.selected_domain,
      timestamp: record.created_at,
    });

    return record;
  }

  public async getApplications(filter?: {
    status?: string;
    domain?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: RecruitmentRecord[]; total: number }> {
    return recruitmentRepository.findAll(filter);
  }

  public async getApplicationById(idOrRef: string): Promise<RecruitmentRecord | null> {
    return recruitmentRepository.findByIdOrRef(idOrRef);
  }

  public getFacets() {
    return recruitmentRepository.getFacets();
  }

  public async reviewApplication(
    idOrRef: string,
    params: {
      status?: RecruitmentStatus;
      adminNotes?: string | null;
    },
    adminContext?: any,
    req?: Request
  ): Promise<RecruitmentRecord> {
    const existing = recruitmentRepository.findByIdOrRef(idOrRef);
    if (!existing) {
      throw new AppError(404, `Recruitment application not found: ${idOrRef}`, undefined, 'APPLICATION_NOT_FOUND');
    }

    if (params.status && params.status !== existing.status) {
      const allowed = VALID_RECRUITMENT_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(params.status)) {
        throw new AppError(
          400,
          `Cannot transition application status from ${existing.status} to ${params.status}. Allowed transitions: ${allowed.join(', ') || 'None (Terminal status)'}`,
          undefined,
          'INVALID_STATUS_TRANSITION'
        );
      }
    }

    const updated = recruitmentRepository.updateAdminReview(existing.id, {
      status: params.status,
      adminNotes: params.adminNotes,
      reviewedBy: adminContext?.adminName || 'admin',
    });

    if (!updated) {
      throw new AppError(500, 'Failed to update recruitment review', undefined, 'INTERNAL_SERVER_ERROR');
    }

    const action = updated.status === 'REJECTED'
      ? 'APPLICATION_REJECTED'
      : updated.status === 'ACCEPTED'
      ? 'APPLICATION_ACCEPTED'
      : 'APPLICATION_REVIEWED';

    auditService.log(
      {
        adminId: adminContext?.adminId,
        adminName: adminContext?.adminName,
        adminRole: adminContext?.adminRole,
        action,
        entityType: 'APPLICATION',
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

  public async convertToMember(
    idOrRef: string,
    memberOverrides?: Partial<CreateMemberInput>,
    adminContext?: any,
    req?: Request
  ): Promise<{ application: RecruitmentRecord; member: any }> {
    const application = recruitmentRepository.findByIdOrRef(idOrRef);
    if (!application) {
      throw new AppError(404, `Recruitment application not found: ${idOrRef}`, undefined, 'APPLICATION_NOT_FOUND');
    }

    if (application.converted_member_id) {
      throw new AppError(
        400,
        `Application ${application.reference_id || application.id} has already been converted to member (ID: ${application.converted_member_id})`,
        undefined,
        'ALREADY_CONVERTED'
      );
    }

    let parsedSkills: string[] = [];
    try {
      if (application.interests) {
        parsedSkills = JSON.parse(application.interests);
      }
    } catch {
      parsedSkills = [];
    }

    const memberInput: CreateMemberInput = {
      name: application.name,
      email: application.email,
      role: memberOverrides?.role || 'Core Contributor',
      department: memberOverrides?.department || application.department || 'Engineering',
      domain: memberOverrides?.domain || application.selected_domain,
      bio: memberOverrides?.bio || application.message || null,
      skills: memberOverrides?.skills || parsedSkills,
      status: 'ACTIVE',
      socialLinks: JSON.stringify({
        github: application.github_url || null,
        linkedin: application.linkedin_url || null,
        portfolio: application.portfolio_url || null,
      }),
      uniqueId: memberOverrides?.uniqueId || null,
      slug: memberOverrides?.slug || null,
      clearanceLevel: memberOverrides?.clearanceLevel || 'LVL-01 // OPERATIVE',
    };

    // Execute member creation and application review update atomically inside a transaction
    const { newMember, updatedApp } = runTransaction(() => {
      const created = membersAdminService.createMember(memberInput, adminContext);
      const app = recruitmentRepository.updateAdminReview(application.id, {
        status: 'ACCEPTED',
        adminNotes: memberOverrides?.bio ? `Converted to member ${created.unique_id}` : application.admin_notes,
        reviewedBy: adminContext?.adminName || 'admin',
        convertedMemberId: created.id,
      });
      return { newMember: created, updatedApp: app };
    });

    auditService.log(
      {
        adminId: adminContext?.adminId,
        adminName: adminContext?.adminName,
        adminRole: adminContext?.adminRole,
        action: 'APPLICATION_ACCEPTED',
        entityType: 'APPLICATION',
        entityId: application.id,
        beforeJson: application,
        afterJson: updatedApp,
        details: {
          referenceId: application.reference_id,
          memberId: newMember.id,
          uniqueId: newMember.unique_id,
          name: newMember.name,
        },
      },
      req
    );

    return { application: updatedApp!, member: newMember };
  }

  public async updateStatus(
    id: string,
    newStatus: RecruitmentStatus,
    statusNotes?: string | null
  ): Promise<RecruitmentRecord> {
    const existing = recruitmentRepository.findById(id);
    if (!existing) {
      throw new AppError(404, `Recruitment application not found: ${id}`, undefined, 'RECRUITMENT_NOT_FOUND');
    }

    // State machine validation
    const allowed = VALID_RECRUITMENT_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        400,
        `Cannot transition application status from ${existing.status} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'None (Terminal status)'}`,
        undefined,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = recruitmentRepository.updateStatus(id, newStatus, statusNotes);
    if (!updated) {
      throw new AppError(500, 'Failed to update recruitment status', undefined, 'INTERNAL_SERVER_ERROR');
    }

    notificationHooks.dispatch('recruitment.status_changed', {
      id: updated.id,
      oldStatus: existing.status,
      newStatus: updated.status,
      timestamp: updated.updated_at,
    });

    return updated;
  }
}

export const recruitmentService = new RecruitmentService();
