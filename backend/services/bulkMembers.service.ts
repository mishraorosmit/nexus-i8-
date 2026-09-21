/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { membersRepository, MemberRecord, MemberFilterOptions } from '../db/repositories/members.repository.ts';
import { membersService } from './members.service.ts';
import { auditService } from './audit.service.ts';
import { memoryCache } from '../utils/cache.ts';
import { runTransaction } from '../db/connection.ts';
import { parseCsv, serializeCsv, CsvSyntaxError } from '../utils/csv.ts';
import { AppError } from '../middleware/errorHandler.ts';

export type ImportMode = 'CREATE_ONLY' | 'UPDATE_ONLY' | 'UPSERT';
export type RowClassification = 'NEW' | 'UPDATE' | 'DUPLICATE' | 'CONFLICT' | 'INVALID';

export interface RowError {
  field: string;
  message: string;
}

export interface NormalizedMemberRow {
  rowNumber: number;
  unique_id?: string | null;
  name: string;
  display_name?: string | null;
  email?: string | null;
  role: string;
  domain?: string | null;
  department?: string | null;
  bio?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ALUMNI';
  photo_url?: string | null;
  slug?: string | null;
  joined_at?: string | null;
}

export interface RowPreview {
  rowNumber: number;
  classification: RowClassification;
  uniqueId: string | null;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  status: string;
  errors: RowError[];
  warnings: string[];
  matchedMemberId?: string | null;
}

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newRecords: number;
  updates: number;
  duplicates: number;
  conflicts: number;
  mode: ImportMode;
  canCommit: boolean;
  rows: RowPreview[];
}

export interface ImportCommitResult {
  success: boolean;
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  mode: ImportMode;
  durationMs: number;
}

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_IMPORT_ROWS = 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNIQUE_ID_REGEX = /^NX-[0-9]{3,}$/;
const VALID_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'ALUMNI']);

export class BulkMembersService {
  /**
   * Parse raw content (CSV or JSON) into raw row dictionaries.
   */
  public parseInput(content: string, format: 'csv' | 'json'): Record<string, unknown>[] {
    if (!content || typeof content !== 'string') {
      throw new AppError(400, 'Import content is required and cannot be empty.', undefined, 'EMPTY_IMPORT_CONTENT');
    }

    if (Buffer.byteLength(content, 'utf8') > MAX_PAYLOAD_BYTES) {
      throw new AppError(413, 'Import file exceeds 5MB size limit.', undefined, 'FILE_TOO_LARGE');
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new AppError(400, 'Import file is empty.', undefined, 'EMPTY_FILE');
    }

    if (format === 'json') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        throw new AppError(400, 'Malformed JSON syntax in import payload.', undefined, 'INVALID_JSON_SYNTAX');
      }

      if (!Array.isArray(parsed)) {
        throw new AppError(400, 'JSON import must be a top-level array of member objects.', undefined, 'INVALID_JSON_STRUCTURE');
      }

      if (parsed.length === 0) {
        throw new AppError(400, 'JSON import array contains zero records.', undefined, 'EMPTY_IMPORT_ARRAY');
      }

      if (parsed.length > MAX_IMPORT_ROWS) {
        throw new AppError(400, `Import exceeds maximum limit of ${MAX_IMPORT_ROWS} rows. Found: ${parsed.length}`, undefined, 'ROW_LIMIT_EXCEEDED');
      }

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          throw new AppError(400, `Row ${i + 1} is not a valid JSON object.`, undefined, 'INVALID_ROW_STRUCTURE');
        }
      }

      return parsed as Record<string, unknown>[];
    }

    if (format === 'csv') {
      let parsedResult: { headers: string[]; rows: Record<string, string>[] };
      try {
        parsedResult = parseCsv(trimmed);
      } catch (err) {
        if (err instanceof CsvSyntaxError) {
          throw new AppError(400, err.message, undefined, 'CSV_SYNTAX_ERROR');
        }
        throw new AppError(400, 'Failed to parse CSV file.', undefined, 'CSV_PARSE_ERROR');
      }

      if (parsedResult.headers.length === 0 || parsedResult.rows.length === 0) {
        throw new AppError(400, 'CSV file must contain a header row and at least one data row.', undefined, 'EMPTY_CSV');
      }

      if (parsedResult.rows.length > MAX_IMPORT_ROWS) {
        throw new AppError(400, `Import exceeds maximum limit of ${MAX_IMPORT_ROWS} rows. Found: ${parsedResult.rows.length}`, undefined, 'ROW_LIMIT_EXCEEDED');
      }

      // Ensure required headers exist
      const hasName = parsedResult.headers.includes('name');
      const hasRole = parsedResult.headers.includes('role');
      if (!hasName || !hasRole) {
        throw new AppError(400, 'CSV header missing required columns: "Name" and "Role" are mandatory.', undefined, 'MISSING_REQUIRED_COLUMNS');
      }

      return parsedResult.rows;
    }

    throw new AppError(400, `Unsupported import format: '${format}'. Supported formats are 'csv' and 'json'.`, undefined, 'UNSUPPORTED_FORMAT');
  }

  /**
   * Normalize and validate a single row.
   */
  public normalizeAndValidateRow(raw: Record<string, unknown>, rowNumber: number): {
    normalized?: NormalizedMemberRow;
    errors: RowError[];
    warnings: string[];
  } {
    const errors: RowError[] = [];
    const warnings: string[] = [];

    // Extract raw string values
    const getStr = (key: string): string => {
      const val = raw[key];
      return val !== null && val !== undefined ? String(val).trim() : '';
    };

    const rawName = getStr('name') || getStr('member_name') || getStr('fullName');
    const rawRole = getStr('role') || getStr('designation') || getStr('title');
    const rawEmail = getStr('email') || getStr('email_address');
    const rawUniqueId = getStr('unique_id') || getStr('uniqueId') || getStr('id');
    const rawStatus = getStr('status') || getStr('member_status') || 'ACTIVE';
    const rawDepartment = getStr('department') || getStr('dept');
    const rawDomain = getStr('domain') || getStr('squad') || getStr('group');
    const rawBio = getStr('bio') || getStr('biography');
    const rawPhotoUrl = getStr('photo_url') || getStr('photoUrl') || getStr('image_url') || getStr('imageUrl');
    const rawJoinedAt = getStr('joined_at') || getStr('joinedAt') || getStr('joined_date') || getStr('joinedDate');
    const rawDisplayName = getStr('display_name') || getStr('displayName');
    const rawSlug = getStr('slug') || getStr('public_id') || getStr('publicId');

    // 1. Name Validation
    if (!rawName || rawName.length < 2) {
      errors.push({ field: 'name', message: 'Name is required and must be at least 2 characters.' });
    } else if (rawName.length > 255) {
      errors.push({ field: 'name', message: 'Name must not exceed 255 characters.' });
    }

    // 2. Role Validation
    if (!rawRole || rawRole.length < 2) {
      errors.push({ field: 'role', message: 'Role is required and must be at least 2 characters.' });
    } else if (rawRole.length > 255) {
      errors.push({ field: 'role', message: 'Role must not exceed 255 characters.' });
    }

    // 3. Status Validation
    const normalizedStatus = rawStatus.toUpperCase();
    if (!VALID_STATUSES.has(normalizedStatus)) {
      errors.push({
        field: 'status',
        message: `Invalid status '${rawStatus}'. Allowed values: ACTIVE, INACTIVE, ALUMNI.`,
      });
    }

    // 4. Email Validation
    let normalizedEmail: string | null = null;
    if (rawEmail) {
      const lower = rawEmail.toLowerCase();
      if (!EMAIL_REGEX.test(lower)) {
        errors.push({ field: 'email', message: `Invalid email address format: '${rawEmail}'.` });
      } else if (lower.length > 255) {
        errors.push({ field: 'email', message: 'Email must not exceed 255 characters.' });
      } else {
        normalizedEmail = lower;
      }
    }

    // 5. Unique ID Validation
    let normalizedUniqueId: string | null = null;
    if (rawUniqueId) {
      const upper = rawUniqueId.toUpperCase();
      if (!UNIQUE_ID_REGEX.test(upper)) {
        errors.push({
          field: 'unique_id',
          message: `Invalid unique ID '${rawUniqueId}'. Format must strictly follow 'NX-XXX' (e.g. NX-001).`,
        });
      } else {
        normalizedUniqueId = upper;
      }
    }

    // 6. Bio length validation
    if (rawBio && rawBio.length > 5000) {
      errors.push({ field: 'bio', message: 'Bio must not exceed 5000 characters.' });
    }

    // 7. Photo URL validation (prevent dangerous schemes)
    if (rawPhotoUrl) {
      const lowerUrl = rawPhotoUrl.toLowerCase();
      if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:text/html')) {
        errors.push({ field: 'photo_url', message: 'Dangerous or unsupported URL scheme in photo_url.' });
      } else if (rawPhotoUrl.length > 1000) {
        errors.push({ field: 'photo_url', message: 'photo_url must not exceed 1000 characters.' });
      }
    }

    // 8. Joined Date validation
    let normalizedJoinedAt: string | null = null;
    if (rawJoinedAt) {
      const parsedDate = new Date(rawJoinedAt);
      if (isNaN(parsedDate.getTime())) {
        errors.push({ field: 'joined_at', message: `Invalid date format: '${rawJoinedAt}'.` });
      } else {
        normalizedJoinedAt = parsedDate.toISOString().split('T')[0];
      }
    }

    if (!normalizedEmail) {
      warnings.push('No email specified; member cannot receive system notifications.');
    }

    if (errors.length > 0) {
      return { errors, warnings };
    }

    return {
      normalized: {
        rowNumber,
        unique_id: normalizedUniqueId,
        name: rawName,
        display_name: rawDisplayName || rawName,
        email: normalizedEmail,
        role: rawRole,
        domain: rawDomain || null,
        department: rawDepartment || 'Engineering',
        bio: rawBio || null,
        status: normalizedStatus as 'ACTIVE' | 'INACTIVE' | 'ALUMNI',
        photo_url: rawPhotoUrl || null,
        slug: rawSlug || null,
        joined_at: normalizedJoinedAt,
      },
      errors: [],
      warnings,
    };
  }

  /**
   * Preview import: parses, validates, detects duplicates/conflicts, returns structured report.
   */
  public previewImport(input: {
    content: string;
    format: 'csv' | 'json';
    mode?: ImportMode;
  }): ImportPreviewResult {
    const mode: ImportMode = input.mode || 'UPSERT';
    const rawRows = this.parseInput(input.content, input.format);

    const rowsPreview: RowPreview[] = [];
    const seenEmails = new Map<string, number>(); // email -> first rowNumber
    const seenUniqueIds = new Map<string, number>(); // unique_id -> first rowNumber

    let validRows = 0;
    let invalidRows = 0;
    let newRecords = 0;
    let updates = 0;
    let duplicates = 0;
    let conflicts = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 1;
      const raw = rawRows[i];

      const { normalized, errors, warnings } = this.normalizeAndValidateRow(raw, rowNumber);

      if (errors.length > 0 || !normalized) {
        invalidRows++;
        rowsPreview.push({
          rowNumber,
          classification: 'INVALID',
          uniqueId: (raw.unique_id || raw.uniqueId || null) as string | null,
          name: (raw.name || raw.memberName || `Row ${rowNumber}`) as string,
          email: (raw.email || null) as string | null,
          role: (raw.role || '-') as string,
          department: (raw.department || null) as string | null,
          status: (raw.status || 'ACTIVE') as string,
          errors,
          warnings,
        });
        continue;
      }

      // Duplicate detection within uploaded file
      if (normalized.email) {
        if (seenEmails.has(normalized.email)) {
          duplicates++;
          errors.push({
            field: 'email',
            message: `Duplicate email within upload: same email appeared on row ${seenEmails.get(normalized.email)}.`,
          });
          rowsPreview.push({
            rowNumber,
            classification: 'DUPLICATE',
            uniqueId: normalized.unique_id || null,
            name: normalized.name,
            email: normalized.email,
            role: normalized.role,
            department: normalized.department || null,
            status: normalized.status,
            errors,
            warnings,
          });
          continue;
        }
        seenEmails.set(normalized.email, rowNumber);
      }

      if (normalized.unique_id) {
        if (seenUniqueIds.has(normalized.unique_id)) {
          duplicates++;
          errors.push({
            field: 'unique_id',
            message: `Duplicate unique ID within upload: same ID appeared on row ${seenUniqueIds.get(normalized.unique_id)}.`,
          });
          rowsPreview.push({
            rowNumber,
            classification: 'DUPLICATE',
            uniqueId: normalized.unique_id,
            name: normalized.name,
            email: normalized.email,
            role: normalized.role,
            department: normalized.department || null,
            status: normalized.status,
            errors,
            warnings,
          });
          continue;
        }
        seenUniqueIds.set(normalized.unique_id, rowNumber);
      }

      // Conflict and identity matching against SQLite database
      let matchedMember: MemberRecord | null = null;
      let conflictReason: string | null = null;

      if (normalized.unique_id) {
        matchedMember = membersRepository.findByUniqueId(normalized.unique_id);
        if (matchedMember) {
          // If row provides an email, check if it collides with another member's email in DB
          if (normalized.email) {
            const memberWithEmail = membersRepository.findByEmail(normalized.email);
            if (memberWithEmail && memberWithEmail.id !== matchedMember.id) {
              conflictReason = `Email '${normalized.email}' belongs to a different member ('${memberWithEmail.name}', ${memberWithEmail.unique_id}).`;
            }
          }
        }
      } else if (normalized.email) {
        matchedMember = membersRepository.findByEmail(normalized.email);
      }

      // Apply mode constraints
      if (matchedMember) {
        if (conflictReason) {
          conflicts++;
          errors.push({ field: 'email', message: conflictReason });
          rowsPreview.push({
            rowNumber,
            classification: 'CONFLICT',
            uniqueId: normalized.unique_id || matchedMember.unique_id || null,
            name: normalized.name,
            email: normalized.email,
            role: normalized.role,
            department: normalized.department || null,
            status: normalized.status,
            errors,
            warnings,
            matchedMemberId: matchedMember.id,
          });
          continue;
        }

        if (mode === 'CREATE_ONLY') {
          conflicts++;
          errors.push({
            field: 'unique_id',
            message: `Member already exists in database ('${matchedMember.name}', ${matchedMember.unique_id}). Import mode is CREATE_ONLY.`,
          });
          rowsPreview.push({
            rowNumber,
            classification: 'CONFLICT',
            uniqueId: normalized.unique_id || matchedMember.unique_id || null,
            name: normalized.name,
            email: normalized.email,
            role: normalized.role,
            department: normalized.department || null,
            status: normalized.status,
            errors,
            warnings,
            matchedMemberId: matchedMember.id,
          });
          continue;
        }

        // Valid UPDATE
        updates++;
        validRows++;
        rowsPreview.push({
          rowNumber,
          classification: 'UPDATE',
          uniqueId: matchedMember.unique_id || null,
          name: normalized.name,
          email: normalized.email,
          role: normalized.role,
          department: normalized.department || null,
          status: normalized.status,
          errors: [],
          warnings,
          matchedMemberId: matchedMember.id,
        });
      } else {
        // Unmatched member (new)
        if (mode === 'UPDATE_ONLY') {
          conflicts++;
          errors.push({
            field: 'unique_id',
            message: `Member not found in database. Import mode is UPDATE_ONLY.`,
          });
          rowsPreview.push({
            rowNumber,
            classification: 'CONFLICT',
            uniqueId: normalized.unique_id || null,
            name: normalized.name,
            email: normalized.email,
            role: normalized.role,
            department: normalized.department || null,
            status: normalized.status,
            errors,
            warnings,
          });
          continue;
        }

        // If row specified a unique_id that doesn't exist, check if the email already belongs to someone
        if (normalized.email) {
          const emailCheck = membersRepository.findByEmail(normalized.email);
          if (emailCheck) {
            conflicts++;
            errors.push({
              field: 'email',
              message: `Email '${normalized.email}' is already assigned to member '${emailCheck.name}' (${emailCheck.unique_id}).`,
            });
            rowsPreview.push({
              rowNumber,
              classification: 'CONFLICT',
              uniqueId: normalized.unique_id || null,
              name: normalized.name,
              email: normalized.email,
              role: normalized.role,
              department: normalized.department || null,
              status: normalized.status,
              errors,
              warnings,
            });
            continue;
          }
        }

        // Valid NEW
        newRecords++;
        validRows++;
        rowsPreview.push({
          rowNumber,
          classification: 'NEW',
          uniqueId: normalized.unique_id || null,
          name: normalized.name,
          email: normalized.email,
          role: normalized.role,
          department: normalized.department || null,
          status: normalized.status,
          errors: [],
          warnings,
        });
      }
    }

    const canCommit = validRows > 0 && invalidRows === 0 && duplicates === 0 && conflicts === 0;

    return {
      totalRows: rawRows.length,
      validRows,
      invalidRows,
      newRecords,
      updates,
      duplicates,
      conflicts,
      mode,
      canCommit,
      rows: rowsPreview,
    };
  }

  /**
   * Commit import inside an ACID database transaction.
   * Full re-parse, re-validation, conflict checking, and atomic execution.
   */
  public commitImport(
    input: {
      content: string;
      format: 'csv' | 'json';
      mode?: ImportMode;
    },
    adminContext?: {
      adminId?: string | null;
      adminName?: string | null;
      adminRole?: string | null;
      ipAddress?: string | null;
    }
  ): ImportCommitResult {
    const startTime = Date.now();
    const mode: ImportMode = input.mode || 'UPSERT';

    // 1. Re-run preview validation to ensure zero bypass
    const preview = this.previewImport({
      content: input.content,
      format: input.format,
      mode,
    });

    if (!preview.canCommit) {
      const errorSample = preview.rows.find((r) => r.errors.length > 0)?.errors[0]?.message || 'Validation failed';
      throw new AppError(
        400,
        `Cannot commit import: File contains ${preview.invalidRows} invalid, ${preview.duplicates} duplicate, or ${preview.conflicts} conflicting rows. First error: ${errorSample}`,
        undefined,
        'IMPORT_VALIDATION_FAILED'
      );
    }

    const rawRows = this.parseInput(input.content, input.format);
    let createdCount = 0;
    let updatedCount = 0;

    // 2. Execute inside an ACID transaction with automatic rollback
    runTransaction((db) => {
      // Find current maximum sequential unique_id suffix to allocate new IDs sequentially
      let maxSuffix = 0;
      const allMembers = membersRepository.findAll({ status: 'all' });
      for (const m of allMembers) {
        if (m.unique_id && UNIQUE_ID_REGEX.test(m.unique_id)) {
          const num = parseInt(m.unique_id.replace(/^NX-/, ''), 10);
          if (!isNaN(num) && num > maxSuffix) {
            maxSuffix = num;
          }
        }
      }

      for (let i = 0; i < rawRows.length; i++) {
        const rowNumber = i + 1;
        const raw = rawRows[i];
        const { normalized } = this.normalizeAndValidateRow(raw, rowNumber);
        if (!normalized) {
          throw new AppError(400, `Unexpected invalid row at index ${rowNumber} during commit.`, undefined, 'COMMIT_ROW_INVALID');
        }

        // Match existing member
        let existing: MemberRecord | null = null;
        if (normalized.unique_id) {
          existing = membersRepository.findByUniqueId(normalized.unique_id);
        } else if (normalized.email) {
          existing = membersRepository.findByEmail(normalized.email);
        }

        if (existing) {
          // UPDATE
          const updateData: Partial<MemberRecord> = {
            name: normalized.name,
            display_name: normalized.display_name || normalized.name,
            role: normalized.role,
            domain: normalized.domain,
            department: normalized.department,
            bio: normalized.bio,
            status: normalized.status,
            photo_url: normalized.photo_url || existing.photo_url,
            profile_image_url: normalized.photo_url || existing.profile_image_url,
            updated_at: new Date().toISOString(),
          };

          if (normalized.email !== undefined) {
            updateData.email = normalized.email;
          }
          if (normalized.joined_at) {
            updateData.joined_date = normalized.joined_at;
            updateData.joined_at = normalized.joined_at;
          }

          membersRepository.update(existing.id, updateData);
          updatedCount++;
        } else {
          // NEW
          let uniqueId: string;
          if (normalized.unique_id) {
            uniqueId = normalized.unique_id;
          } else {
            maxSuffix++;
            uniqueId = `NX-${String(maxSuffix).padStart(3, '0')}`;
          }

          let slug = normalized.slug || membersService.slugify(normalized.name);
          if (!slug) {
            slug = uniqueId.toLowerCase();
          }

          // Ensure slug uniqueness
          let finalSlug = slug;
          let counter = 1;
          while (membersRepository.findBySlug(finalSlug)) {
            finalSlug = `${slug}-${counter}`;
            counter++;
          }

          const id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          const now = new Date().toISOString();
          const joinedDate = normalized.joined_at || now.split('T')[0];

          membersRepository.create({
            id,
            public_id: finalSlug,
            slug: finalSlug,
            unique_id: uniqueId,
            name: normalized.name,
            display_name: normalized.display_name || normalized.name,
            email: normalized.email || null,
            role: normalized.role,
            domain: normalized.domain || 'Engineering & Design',
            department: normalized.department || 'Engineering',
            bio: normalized.bio || null,
            photo_url: normalized.photo_url || null,
            profile_image_url: normalized.photo_url || null,
            profile_image_public_id: null,
            image_position: 'center 20%',
            social_links: null,
            status: normalized.status,
            clearance_level: 'LVL-03 // SPEC',
            special_word: 'VISIONARY',
            quote: null,
            node_location: 'SOA LAB 204 // BHUBANESWAR',
            frequency: '108.40 MHz',
            security_zone: 'SEC // ALPHA',
            badge_issue: '2026.Q1',
            skills: '[]',
            current_focus: null,
            fun_fact: null,
            joined_date: joinedDate,
            joined_at: joinedDate,
          });

          createdCount++;
        }
      }
    });

    // 3. Write audit log
    auditService.log({
      adminId: adminContext?.adminId || null,
      adminName: adminContext?.adminName || 'Admin',
      adminRole: adminContext?.adminRole || 'admin',
      action: 'BULK_IMPORT',
      entityType: 'MEMBER',
      entityId: 'batch',
      details: {
        totalProcessed: rawRows.length,
        createdCount,
        updatedCount,
        mode,
        format: input.format,
      },
      ipAddress: adminContext?.ipAddress || null,
      adminContext,
    });

    // 4. Invalidate memory caches
    memoryCache.invalidate('members');
    memoryCache.invalidate('eid');

    return {
      success: true,
      totalProcessed: rawRows.length,
      createdCount,
      updatedCount,
      mode,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Export members in CSV or JSON format using exact filter options.
   */
  public exportMembers(options: {
    format?: 'csv' | 'json';
    status?: string;
    role?: string;
    domain?: string;
    department?: string;
    search?: string;
    q?: string;
    sort?: string;
  }): { content: string; contentType: string; filename: string } {
    const format = (options.format || 'csv').toLowerCase();

    // Query members using repository's administrative filter engine
    const result = membersRepository.findAllAdmin({
      status: options.status,
      role: options.role,
      domain: options.domain,
      department: options.department,
      search: options.search || options.q,
      sort: options.sort || 'name_asc',
      limit: 1000,
      pageSize: 1000,
    });

    const dateStr = new Date().toISOString().split('T')[0];

    // Sanitized export items: exclude internal primary keys, password hashes, secrets
    const sanitizedItems = result.items.map((m) => ({
      unique_id: m.unique_id || '',
      name: m.name,
      display_name: m.display_name || '',
      email: m.email || '',
      role: m.role,
      domain: m.domain || '',
      department: m.department || '',
      bio: m.bio || '',
      status: m.status,
      photo_url: m.profile_image_url || m.photo_url || '',
      joined_at: m.joined_at || m.joined_date || '',
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));

    if (format === 'json') {
      return {
        content: JSON.stringify(sanitizedItems, null, 2),
        contentType: 'application/json; charset=utf-8',
        filename: `nexus-members-export-${dateStr}.json`,
      };
    }

    // CSV format with formula injection defense
    const columns = [
      { key: 'unique_id', label: 'Unique ID' },
      { key: 'name', label: 'Member Name' },
      { key: 'display_name', label: 'Display Name' },
      { key: 'email', label: 'Email Address' },
      { key: 'role', label: 'Role / Designation' },
      { key: 'domain', label: 'Domain' },
      { key: 'department', label: 'Department' },
      { key: 'bio', label: 'Bio' },
      { key: 'status', label: 'Status' },
      { key: 'photo_url', label: 'Photo URL' },
      { key: 'joined_at', label: 'Joined At' },
      { key: 'created_at', label: 'Created At' },
      { key: 'updated_at', label: 'Updated At' },
    ];

    const csvContent = '\uFEFF' + serializeCsv(columns, sanitizedItems, { sanitizeFormulas: true });

    return {
      content: csvContent,
      contentType: 'text/csv; charset=utf-8',
      filename: `nexus-members-export-${dateStr}.csv`,
    };
  }
}

export const bulkMembersService = new BulkMembersService();
