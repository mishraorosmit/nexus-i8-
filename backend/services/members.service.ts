import { membersRepository, type MemberRecord, type MemberFilterOptions } from '../db/repositories/members.repository.ts';
import { auditService } from './audit.service.ts';
import { settingsService } from './settings.service.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class MemberValidationError extends AppError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(400, message, undefined, code);
    this.name = 'MemberValidationError';
  }
}

export interface AdminContext {
  adminId?: string | null;
  adminName?: string | null;
  adminRole?: string | null;
  ipAddress?: string | null;
  [key: string]: unknown;
}

export interface CreateMemberInput {
  id?: string;
  name: string;
  displayName?: string | null;
  email?: string | null;
  role: string;
  domain?: string | null;
  department?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  profileImageUrl?: string | null;
  profileImagePublicId?: string | null;
  imagePosition?: string | null;
  socials?: Record<string, string> | string | null;
  socialLinks?: Record<string, string> | string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALUMNI' | 'active' | 'inactive' | 'alumni';
  uniqueId?: string | null;
  slug?: string | null;
  publicId?: string | null;
  clearanceLevel?: string | null;
  specialWord?: string | null;
  quote?: string | null;
  nodeLocation?: string | null;
  frequency?: string | null;
  securityZone?: string | null;
  badgeIssue?: string | null;
  skills?: string[] | string | null;
  currentFocus?: string | null;
  funFact?: string | null;
  joinedDate?: string | null;
  joinedAt?: string | null;
}

export interface UpdateMemberInput {
  name?: string;
  displayName?: string | null;
  email?: string | null;
  role?: string;
  domain?: string | null;
  department?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  profileImageUrl?: string | null;
  profileImagePublicId?: string | null;
  imagePosition?: string | null;
  socials?: Record<string, string> | string | null;
  socialLinks?: Record<string, string> | string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALUMNI' | 'active' | 'inactive' | 'alumni';
  uniqueId?: string | null;
  slug?: string | null;
  publicId?: string | null;
  clearanceLevel?: string | null;
  specialWord?: string | null;
  quote?: string | null;
  nodeLocation?: string | null;
  frequency?: string | null;
  securityZone?: string | null;
  badgeIssue?: string | null;
  skills?: string[] | string | null;
  currentFocus?: string | null;
  funFact?: string | null;
  joinedDate?: string | null;
  joinedAt?: string | null;
  expectedUpdatedAt?: string;
}

const UNIQUE_ID_REGEX = /^NX-[0-9]{3,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'ALUMNI']);

export class MembersAdminService {
  /**
   * Helper to generate the next sequential unique ID (e.g. NX-030).
   */
  public getNextUniqueId(): string {
    const prefix = settingsService.getSetting<string>('member_id_prefix') || 'NX-';
    const allMembers = membersRepository.findAll({ status: 'all' });
    let maxSuffix = 0;
    const prefixEscaped = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const dynamicRegex = new RegExp(`^${prefixEscaped}[0-9]{3,}$`);

    for (const m of allMembers) {
      if (m.unique_id && (UNIQUE_ID_REGEX.test(m.unique_id) || dynamicRegex.test(m.unique_id))) {
        const num = parseInt(m.unique_id.replace(new RegExp(`^(${prefixEscaped}|NX-)`), ''), 10);
        if (!isNaN(num) && num > maxSuffix) {
          maxSuffix = num;
        }
      }
    }

    const nextNum = maxSuffix + 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  /**
   * Slugify a string into URL-safe format.
   */
  public slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Create a new member with server-side validation and audit logging.
   */
  public createMember(input: CreateMemberInput, adminContext?: AdminContext): MemberRecord {
    // 1. Validate Name
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length < 2) {
      throw new MemberValidationError('Member name is required and must be at least 2 characters.', 'INVALID_NAME');
    }
    const name = input.name.trim();

    // 2. Validate Role
    if (!input.role || typeof input.role !== 'string' || input.role.trim().length < 2) {
      throw new MemberValidationError('Member role is required and must be at least 2 characters.', 'INVALID_ROLE');
    }
    const role = input.role.trim();

    // 3. Validate Status
    const rawStatus = (input.status || 'ACTIVE').toUpperCase();
    if (!VALID_STATUSES.has(rawStatus)) {
      throw new MemberValidationError(
        `Invalid status '${input.status}'. Allowed statuses are: ACTIVE, INACTIVE, ALUMNI.`,
        'INVALID_STATUS'
      );
    }
    const status = rawStatus as 'ACTIVE' | 'INACTIVE' | 'ALUMNI';

    // 4. Validate Email
    let email: string | null = null;
    if (input.email !== undefined && input.email !== null && input.email.trim() !== '') {
      const trimmedEmail = input.email.trim();
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        throw new MemberValidationError(`Invalid email address format: '${input.email}'`, 'INVALID_EMAIL');
      }
      const existingEmail = membersRepository.findByEmail(trimmedEmail);
      if (existingEmail) {
        throw new MemberValidationError(`A member with email '${trimmedEmail}' already exists.`, 'DUPLICATE_EMAIL');
      }
      email = trimmedEmail;
    }

    // 5. Validate & Resolve unique_id
    let uniqueId: string;
    if (input.uniqueId && input.uniqueId.trim()) {
      const trimmedId = input.uniqueId.trim().toUpperCase();
      const prefix = settingsService.getSetting<string>('member_id_prefix') || 'NX-';
      const prefixEscaped = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const dynamicRegex = new RegExp(`^(${prefixEscaped}|NX-)[0-9]{3,}$`);
      if (!UNIQUE_ID_REGEX.test(trimmedId) && !dynamicRegex.test(trimmedId)) {
        throw new MemberValidationError(
          `Invalid unique ID '${input.uniqueId}'. Format must strictly follow '${prefix}XXX' or 'NX-XXX'.`,
          'INVALID_UNIQUE_ID'
        );
      }
      const existingWithUniqueId = membersRepository.findByUniqueId(trimmedId);
      if (existingWithUniqueId) {
        throw new MemberValidationError(
          `Unique ID '${trimmedId}' is already assigned to member '${existingWithUniqueId.name}'.`,
          'DUPLICATE_UNIQUE_ID'
        );
      }
      uniqueId = trimmedId;
    } else {
      uniqueId = this.getNextUniqueId();
    }

    // 6. Validate & Resolve slug / public_id
    let slug: string;
    if (input.slug && input.slug.trim()) {
      slug = this.slugify(input.slug);
    } else if (input.publicId && input.publicId.trim()) {
      slug = this.slugify(input.publicId);
    } else {
      slug = this.slugify(name);
    }

    if (!slug) {
      slug = uniqueId.toLowerCase();
    }

    const existingWithSlug = membersRepository.findBySlug(slug);
    if (existingWithSlug) {
      throw new MemberValidationError(`A member with slug '${slug}' already exists.`, 'DUPLICATE_SLUG');
    }

    // 7. Format JSON fields
    let socialLinksStr: string | null = null;
    const rawSocials = input.socials || input.socialLinks;
    if (rawSocials) {
      if (typeof rawSocials === 'string') {
        try {
          JSON.parse(rawSocials);
          socialLinksStr = rawSocials;
        } catch {
          throw new MemberValidationError('social_links must be a valid JSON string or object.', 'INVALID_SOCIALS');
        }
      } else {
        socialLinksStr = JSON.stringify(rawSocials);
      }
    }

    let skillsStr: string | null = null;
    if (input.skills) {
      if (Array.isArray(input.skills)) {
        skillsStr = JSON.stringify(input.skills);
      } else if (typeof input.skills === 'string') {
        try {
          JSON.parse(input.skills);
          skillsStr = input.skills;
        } catch {
          skillsStr = JSON.stringify([input.skills]);
        }
      }
    }

    const id = input.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const photoUrl = input.profileImageUrl || input.photoUrl || null;
    const joinedDate = input.joinedAt || input.joinedDate || new Date().toISOString().split('T')[0];

    // 8. Insert into repository
    const created = membersRepository.create({
      id,
      public_id: slug,
      slug,
      unique_id: uniqueId,
      name,
      display_name: input.displayName ? input.displayName.trim() : name,
      email,
      role,
      domain: input.domain ? input.domain.trim() : 'Engineering & Design',
      department: input.department ? input.department.trim() : 'ENGINEERING',
      bio: input.bio ? input.bio.trim() : null,
      photo_url: photoUrl,
      profile_image_url: photoUrl,
      profile_image_public_id: input.profileImagePublicId || null,
      image_position: input.imagePosition || 'center 20%',
      social_links: socialLinksStr,
      status,
      clearance_level: input.clearanceLevel || 'LVL-03 // SPEC',
      special_word: input.specialWord || 'VISIONARY',
      quote: input.quote || null,
      node_location: input.nodeLocation || 'SOA LAB 204 // BHUBANESWAR',
      frequency: input.frequency || '108.40 MHz',
      security_zone: input.securityZone || 'SEC // ALPHA',
      badge_issue: input.badgeIssue || '2026.Q1',
      skills: skillsStr || '[]',
      current_focus: input.currentFocus || null,
      fun_fact: input.funFact || null,
      joined_date: joinedDate,
      joined_at: joinedDate,
    });

    // 9. Audit Logging
    auditService.log({
      adminId: adminContext?.adminId || null,
      adminName: adminContext?.adminName || 'Admin',
      adminRole: adminContext?.adminRole || 'admin',
      action: 'MEMBER_CREATED',
      entityType: 'MEMBER',
      entityId: created.id,
      details: { name: created.name, unique_id: created.unique_id, role: created.role },
      ipAddress: adminContext?.ipAddress || null,
      adminContext,
      afterJson: created,
    });

    return created;
  }

  /**
   * Update an existing member.
   * GUARANTEE: Never modifies or regenerates unique_id when name/email/role change!
   */
  public updateMember(id: string, input: UpdateMemberInput, adminContext?: AdminContext): MemberRecord {
    const existing = membersRepository.findById(id);
    if (!existing) {
      throw new MemberValidationError(`Member with ID '${id}' was not found.`, 'MEMBER_NOT_FOUND');
    }

    const updates: Partial<MemberRecord> = {};

    // 1. Update Name
    if (input.name !== undefined) {
      if (typeof input.name !== 'string' || input.name.trim().length < 2) {
        throw new MemberValidationError('Member name must be at least 2 characters.', 'INVALID_NAME');
      }
      updates.name = input.name.trim();
    }

    if (input.displayName !== undefined) {
      updates.display_name = input.displayName ? input.displayName.trim() : null;
    }

    // 2. Update Role
    if (input.role !== undefined) {
      if (typeof input.role !== 'string' || input.role.trim().length < 2) {
        throw new MemberValidationError('Member role must be at least 2 characters.', 'INVALID_ROLE');
      }
      updates.role = input.role.trim();
    }

    // 3. Update Status
    if (input.status !== undefined) {
      const rawStatus = input.status.toUpperCase();
      if (!VALID_STATUSES.has(rawStatus)) {
        throw new MemberValidationError(
          `Invalid status '${input.status}'. Allowed statuses are: ACTIVE, INACTIVE, ALUMNI.`,
          'INVALID_STATUS'
        );
      }
      updates.status = rawStatus as 'ACTIVE' | 'INACTIVE' | 'ALUMNI';
    }

    // 4. Update Email
    if (input.email !== undefined) {
      if (input.email !== null && input.email.trim() !== '') {
        const trimmedEmail = input.email.trim();
        if (!EMAIL_REGEX.test(trimmedEmail)) {
          throw new MemberValidationError(`Invalid email address format: '${input.email}'`, 'INVALID_EMAIL');
        }
        const existingEmail = membersRepository.findByEmail(trimmedEmail);
        if (existingEmail && existingEmail.id !== id) {
          throw new MemberValidationError(`A member with email '${trimmedEmail}' already exists.`, 'DUPLICATE_EMAIL');
        }
        updates.email = trimmedEmail;
      } else {
        updates.email = null;
      }
    }

    // 5. Stable unique_id preservation
    // CRITICAL: unique_id is NEVER auto-regenerated when name/email/role change!
    if (input.uniqueId !== undefined && input.uniqueId !== null) {
      const trimmedId = input.uniqueId.trim().toUpperCase();
      if (!UNIQUE_ID_REGEX.test(trimmedId)) {
        throw new MemberValidationError(
          `Invalid unique ID '${input.uniqueId}'. Format must strictly follow 'NX-XXX'.`,
          'INVALID_UNIQUE_ID'
        );
      }
      const existingWithUniqueId = membersRepository.findByUniqueId(trimmedId);
      if (existingWithUniqueId && existingWithUniqueId.id !== id) {
        throw new MemberValidationError(
          `Unique ID '${trimmedId}' is already assigned to member '${existingWithUniqueId.name}'.`,
          'DUPLICATE_UNIQUE_ID'
        );
      }
      updates.unique_id = trimmedId;
    }

    // 6. Update slug
    if (input.slug !== undefined || input.publicId !== undefined) {
      const rawSlug = input.slug || input.publicId;
      if (rawSlug && rawSlug.trim()) {
        const cleanSlug = this.slugify(rawSlug);
        const existingWithSlug = membersRepository.findBySlug(cleanSlug);
        if (existingWithSlug && existingWithSlug.id !== id) {
          throw new MemberValidationError(`A member with slug '${cleanSlug}' already exists.`, 'DUPLICATE_SLUG');
        }
        updates.slug = cleanSlug;
        updates.public_id = cleanSlug;
      }
    }

    // 7. JSON serialization
    const rawSocials = input.socials !== undefined ? input.socials : input.socialLinks;
    if (rawSocials !== undefined) {
      if (rawSocials === null) {
        updates.social_links = null;
      } else if (typeof rawSocials === 'string') {
        try {
          JSON.parse(rawSocials);
          updates.social_links = rawSocials;
        } catch {
          throw new MemberValidationError('social_links must be valid JSON.', 'INVALID_SOCIALS');
        }
      } else {
        updates.social_links = JSON.stringify(rawSocials);
      }
    }

    if (input.skills !== undefined) {
      if (input.skills === null) {
        updates.skills = '[]';
      } else if (Array.isArray(input.skills)) {
        updates.skills = JSON.stringify(input.skills);
      } else if (typeof input.skills === 'string') {
        try {
          JSON.parse(input.skills);
          updates.skills = input.skills;
        } catch {
          updates.skills = JSON.stringify([input.skills]);
        }
      }
    }

    // Direct string fields
    if (input.domain !== undefined) updates.domain = input.domain;
    if (input.department !== undefined) updates.department = input.department;
    if (input.bio !== undefined) updates.bio = input.bio;
    if (input.photoUrl !== undefined || input.profileImageUrl !== undefined) {
      const pUrl = input.profileImageUrl !== undefined ? input.profileImageUrl : input.photoUrl;
      updates.photo_url = pUrl;
      updates.profile_image_url = pUrl;
    }
    if (input.profileImagePublicId !== undefined) updates.profile_image_public_id = input.profileImagePublicId;
    if (input.imagePosition !== undefined) updates.image_position = input.imagePosition;
    if (input.clearanceLevel !== undefined) updates.clearance_level = input.clearanceLevel;
    if (input.specialWord !== undefined) updates.special_word = input.specialWord;
    if (input.quote !== undefined) updates.quote = input.quote;
    if (input.nodeLocation !== undefined) updates.node_location = input.nodeLocation;
    if (input.frequency !== undefined) updates.frequency = input.frequency;
    if (input.securityZone !== undefined) updates.security_zone = input.securityZone;
    if (input.badgeIssue !== undefined) updates.badge_issue = input.badgeIssue;
    if (input.currentFocus !== undefined) updates.current_focus = input.currentFocus;
    if (input.funFact !== undefined) updates.fun_fact = input.funFact;
    if (input.joinedDate !== undefined || input.joinedAt !== undefined) {
      const jDate = input.joinedAt !== undefined ? input.joinedAt : input.joinedDate;
      updates.joined_date = jDate;
      updates.joined_at = jDate;
    }

    // Concurrency check if expectedUpdatedAt provided
    if (input.expectedUpdatedAt && existing.updated_at !== input.expectedUpdatedAt) {
      throw new AppError(
        409,
        'Member was modified by another request. Please reload and try again.',
        undefined,
        'CONCURRENCY_CONFLICT'
      );
    }

    const updated = membersRepository.update(id, updates);
    if (!updated) {
      throw new MemberValidationError(`Failed to update member '${id}'.`, 'UPDATE_FAILED');
    }

    const isStatusOnlyChange = Object.keys(updates).length === 1 && 'status' in updates && existing.status !== updates.status;
    const action = isStatusOnlyChange ? 'MEMBER_STATUS_CHANGED' : 'MEMBER_UPDATED';

    // Audit Logging
    auditService.log({
      adminId: adminContext?.adminId || null,
      adminName: adminContext?.adminName || 'Admin',
      adminRole: adminContext?.adminRole || 'admin',
      action,
      entityType: 'MEMBER',
      entityId: updated.id,
      details: isStatusOnlyChange
        ? { previousStatus: existing.status, newStatus: updates.status, name: updated.name }
        : { updatedFields: Object.keys(updates) },
      ipAddress: adminContext?.ipAddress || null,
      adminContext,
      beforeJson: isStatusOnlyChange ? { status: existing.status } : existing,
      afterJson: isStatusOnlyChange ? { status: updates.status } : updated,
    });

    return updated;
  }

  public getMemberById(id: string): MemberRecord | null {
    return membersRepository.findById(id);
  }

  public getMemberByUniqueId(uniqueId: string): MemberRecord | null {
    return membersRepository.findByUniqueId(uniqueId);
  }

  public getMemberBySlug(slug: string): MemberRecord | null {
    return membersRepository.findBySlug(slug);
  }

  public listMembers(options?: MemberFilterOptions): { items: MemberRecord[]; total: number } {
    return membersRepository.findPaginated(options);
  }

  public deleteMember(id: string, adminContext?: AdminContext): boolean {
    const existing = membersRepository.findById(id);
    if (!existing) return false;

    const success = membersRepository.deleteMember(id);
    if (success) {
      auditService.log({
        adminId: adminContext?.adminId || null,
        adminName: adminContext?.adminName || 'Admin',
        adminRole: adminContext?.adminRole || 'admin',
        action: 'MEMBER_DELETED',
        entityType: 'MEMBER',
        entityId: id,
        details: { name: existing.name, unique_id: existing.unique_id },
        ipAddress: adminContext?.ipAddress || null,
        adminContext,
        beforeJson: existing,
      });
    }
    return success;
  }
}

export const membersService = new MembersAdminService();
export const memberService = membersService;
