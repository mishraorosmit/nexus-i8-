import { Request, Response, NextFunction } from 'express';
import { membersRepository, type MemberRecord } from '../../db/repositories/members.repository.ts';
import { membersService } from '../../services/members.service.ts';
import { auditService } from '../../services/audit.service.ts';
import { cloudinaryService } from '../../services/cloudinary.service.ts';
import { validateMediaUpload } from '../../utils/mimeSniffer.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { apiSuccess, createPaginationMeta } from '../../utils/apiResponse.ts';

function parseMultipartFile(buffer: Buffer, boundary: string): { buffer: Buffer; filename: string } | null {
  const boundaryBytes = Buffer.from(`--${boundary}`);
  let startIdx = buffer.indexOf(boundaryBytes);
  if (startIdx === -1) return null;

  startIdx += boundaryBytes.length;
  const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), startIdx);
  if (headerEnd === -1) return null;

  const headerStr = buffer.subarray(startIdx, headerEnd).toString('utf-8');
  const filenameMatch = headerStr.match(/filename="([^"]+)"/i) || headerStr.match(/filename=([^\s;]+)/i);
  const filename = filenameMatch ? filenameMatch[1] : 'profile.png';

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
    const filename = req.body.filename || req.body.fileName || 'profile.png';
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
    const filename = (req.headers['x-filename'] as string) || 'profile.png';
    return { buffer: req.body, filename };
  }

  throw new AppError(
    400,
    'Unsupported media format. Please provide image as multipart/form-data, application/json (base64), or binary stream.',
    undefined,
    'UNSUPPORTED_MEDIA_TYPE'
  );
}

export class AdminMembersController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const pageSize = parseInt((req.query.pageSize || req.query.limit) as string, 10) || 25;
      const status = req.query.status as string | undefined;
      const role = req.query.role as string | undefined;
      const domain = req.query.domain as string | undefined;
      const department = req.query.department as string | undefined;
      const search = (req.query.q || req.query.search) as string | undefined;
      const sort = req.query.sort as string | undefined;

      const result = membersRepository.findAllAdmin({
        page,
        pageSize,
        status,
        role,
        domain,
        department,
        search,
        sort,
      });

      const enriched = result.items.map((m) => ({
        ...m,
        social_links: m.social_links ? JSON.parse(m.social_links) : {},
      }));

      const facets = membersRepository.getFilterFacets();

      const meta = {
        page: result.page,
        limit: result.limit,
        pageSize: result.limit,
        totalItems: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
        sort: result.sort,
        filters: {
          status: status || 'all',
          role: role || null,
          domain: domain || null,
          department: department || null,
          q: search || null,
        },
        facets,
      };

      res.status(200).json(apiSuccess(enriched, meta));
    } catch (err) {
      next(err);
    }
  }

  public async getFacets(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const facets = membersRepository.getFilterFacets();
      res.status(200).json(apiSuccess(facets, { maxPageSize: 100 }));
    } catch (err) {
      next(err);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const member = membersRepository.findById(id);
      if (!member) {
        throw new AppError(404, `Member with ID '${id}' was not found`, undefined, 'MEMBER_NOT_FOUND');
      }

      res.status(200).json(
        apiSuccess({
          ...member,
          social_links: member.social_links ? JSON.parse(member.social_links) : {},
        })
      );
    } catch (err) {
      next(err);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const member = membersService.createMember(
        {
          id: req.body.id,
          name: req.body.name,
          displayName: req.body.displayName || req.body.display_name,
          email: req.body.email,
          role: req.body.role,
          domain: req.body.domain,
          department: req.body.department,
          bio: req.body.bio,
          photoUrl: req.body.photoUrl || req.body.photo_url || req.body.profileImageUrl || req.body.profile_image_url,
          profileImageUrl: req.body.profileImageUrl || req.body.profile_image_url || req.body.photoUrl || req.body.photo_url,
          profileImagePublicId: req.body.profileImagePublicId || req.body.profile_image_public_id,
          imagePosition: req.body.imagePosition || req.body.image_position,
          socials: req.body.socials || req.body.social_links,
          status: req.body.status,
          uniqueId: req.body.uniqueId || req.body.unique_id,
          slug: req.body.slug || req.body.publicId || req.body.public_id,
          joinedAt: req.body.joinedAt || req.body.joined_at || req.body.joinedDate || req.body.joined_date,
        },
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          ipAddress: req.ip,
        }
      );

      res.status(201).json(apiSuccess(member, { message: 'Member created successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const expectedUpdatedAt = (req.headers['if-match'] as string | undefined) || req.body.expected_updated_at;

      const member = membersService.updateMember(
        id,
        {
          name: req.body.name,
          displayName: req.body.displayName !== undefined ? req.body.displayName : req.body.display_name,
          email: req.body.email,
          role: req.body.role,
          domain: req.body.domain,
          department: req.body.department,
          bio: req.body.bio,
          photoUrl:
            req.body.photoUrl !== undefined
              ? req.body.photoUrl
              : req.body.photo_url !== undefined
              ? req.body.photo_url
              : req.body.profileImageUrl !== undefined
              ? req.body.profileImageUrl
              : req.body.profile_image_url,
          profileImageUrl:
            req.body.profileImageUrl !== undefined
              ? req.body.profileImageUrl
              : req.body.profile_image_url !== undefined
              ? req.body.profile_image_url
              : req.body.photoUrl !== undefined
              ? req.body.photoUrl
              : req.body.photo_url,
          profileImagePublicId:
            req.body.profileImagePublicId !== undefined
              ? req.body.profileImagePublicId
              : req.body.profile_image_public_id,
          imagePosition: req.body.imagePosition !== undefined ? req.body.imagePosition : req.body.image_position,
          socials: req.body.socials !== undefined ? req.body.socials : req.body.social_links,
          status: req.body.status,
          uniqueId: req.body.uniqueId !== undefined ? req.body.uniqueId : req.body.unique_id,
          slug: req.body.slug !== undefined ? req.body.slug : req.body.publicId !== undefined ? req.body.publicId : req.body.public_id,
          joinedAt:
            req.body.joinedAt !== undefined
              ? req.body.joinedAt
              : req.body.joined_at !== undefined
              ? req.body.joined_at
              : req.body.joinedDate !== undefined
              ? req.body.joinedDate
              : req.body.joined_date,
          expectedUpdatedAt,
        },
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          ipAddress: req.ip,
        }
      );

      res.status(200).json(apiSuccess(member, { message: 'Member updated successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status || typeof status !== 'string') {
        throw new AppError(400, 'Status is required and must be a string', undefined, 'INVALID_STATUS');
      }

      const normalizedStatus = status.trim().toUpperCase();
      if (!['ACTIVE', 'INACTIVE', 'ALUMNI'].includes(normalizedStatus)) {
        throw new AppError(
          400,
          `Invalid status '${status}'. Allowed statuses are: ACTIVE, INACTIVE, ALUMNI.`,
          undefined,
          'INVALID_STATUS'
        );
      }

      const member = membersService.updateMember(
        id,
        { status: normalizedStatus as 'ACTIVE' | 'INACTIVE' | 'ALUMNI' },
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          ipAddress: req.ip,
        }
      );

      res.status(200).json(apiSuccess(member, { message: `Member status updated to ${normalizedStatus}` }));
    } catch (err) {
      next(err);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const member = membersRepository.findById(id);
      if (!member) {
        throw new AppError(404, `Member with ID '${id}' was not found`, undefined, 'MEMBER_NOT_FOUND');
      }

      membersService.deleteMember(id, {
        adminId: req.admin?.adminId,
        adminName: req.admin?.name,
        adminRole: req.admin?.role,
        ipAddress: req.ip,
      });

      res.status(200).json(apiSuccess({ deleted: true, id }, { message: 'Member deleted successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const member = membersRepository.findById(id);
      if (!member) {
        throw new AppError(404, `Member with ID '${id}' was not found`, undefined, 'MEMBER_NOT_FOUND');
      }

      const { buffer, filename } = extractUploadPayload(req);

      // Validate via mimeSniffer: enforces 5MB max, magic bytes sniffing for JPEG, PNG, WebP, denies executables
      const validation = validateMediaUpload(buffer, filename, 'members');
      if (!validation.valid || !validation.detectedMime) {
        throw new AppError(
          validation.code === 'FILE_TOO_LARGE' ? 413 : 400,
          validation.error || 'Invalid profile image format or size',
          undefined,
          validation.code || 'INVALID_FILE'
        );
      }

      const bufferToUpload = validation.sanitizedBuffer || buffer;
      const oldPublicId = member.profile_image_public_id;

      // Upload to Cloudinary
      const uploadResult = await cloudinaryService.uploadProfileImage({
        buffer: bufferToUpload,
        filename,
        memberIdentifier: member.slug || member.unique_id || member.id,
      });

      // Update SQLite database record
      try {
        const now = new Date().toISOString();
        membersRepository.update(member.id, {
          profile_image_url: uploadResult.secureUrl,
          profile_image_public_id: uploadResult.publicId,
          photo_url: uploadResult.secureUrl,
          updated_at: now,
        });
      } catch (dbErr) {
        // If DB write fails, clean up the newly uploaded Cloudinary asset to avoid orphaned media
        try {
          await cloudinaryService.destroyImage(uploadResult.publicId);
        } catch {
          // ignore secondary error
        }
        throw new AppError(500, 'Database error while saving profile image reference', undefined, 'DATABASE_ERROR');
      }

      // Safe replacement: Only destroy old Cloudinary asset AFTER SQLite write succeeds
      if (oldPublicId && oldPublicId !== uploadResult.publicId) {
        try {
          await cloudinaryService.destroyImage(oldPublicId);
        } catch (cleanupErr) {
          console.warn(`[Cloudinary] Failed to clean up replaced asset "${oldPublicId}":`, cleanupErr);
        }
      }

      const updated = membersRepository.findById(member.id);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: oldPublicId ? 'IMAGE_REPLACED' : 'IMAGE_UPLOADED',
          entityType: 'MEMBER',
          entityId: member.id,
          details: {
            memberId: member.id,
            name: member.name,
            publicId: uploadResult.publicId,
            url: uploadResult.secureUrl,
            format: uploadResult.format,
            bytes: uploadResult.bytes,
            previousPublicId: oldPublicId || null,
          },
          beforeJson: oldPublicId ? {
            profile_image_public_id: oldPublicId,
            profile_image_url: member.profile_image_url,
          } : null,
          afterJson: {
            profile_image_public_id: uploadResult.publicId,
            profile_image_url: uploadResult.secureUrl,
          },
        },
        req
      );

      res.status(200).json(
        apiSuccess(
          {
            ...updated,
            social_links: updated?.social_links ? JSON.parse(updated.social_links) : {},
          },
          {
            message: 'Profile image uploaded successfully',
            image: {
              url: uploadResult.secureUrl,
              publicId: uploadResult.publicId,
              format: uploadResult.format,
              bytes: uploadResult.bytes,
            },
          }
        )
      );
    } catch (err) {
      next(err);
    }
  }

  public async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const member = membersRepository.findById(id);
      if (!member) {
        throw new AppError(404, `Member with ID '${id}' was not found`, undefined, 'MEMBER_NOT_FOUND');
      }

      const oldPublicId = member.profile_image_public_id;
      const now = new Date().toISOString();

      // Clear image fields in SQLite
      membersRepository.update(member.id, {
        profile_image_url: null,
        profile_image_public_id: null,
        photo_url: null,
        updated_at: now,
      });

      // If asset existed on Cloudinary, destroy it safely
      if (oldPublicId) {
        try {
          await cloudinaryService.destroyImage(oldPublicId);
        } catch (delErr) {
          console.warn(`[Cloudinary] Failed to destroy asset "${oldPublicId}":`, delErr);
        }
      }

      const updated = membersRepository.findById(member.id);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'IMAGE_REMOVED',
          entityType: 'MEMBER',
          entityId: member.id,
          details: {
            memberId: member.id,
            name: member.name,
            destroyedPublicId: oldPublicId || null,
          },
          beforeJson: {
            profile_image_public_id: oldPublicId,
            profile_image_url: member.profile_image_url,
          },
          afterJson: {
            profile_image_public_id: null,
            profile_image_url: null,
          },
        },
        req
      );

      res.status(200).json(
        apiSuccess(
          {
            ...updated,
            social_links: updated?.social_links ? JSON.parse(updated.social_links) : {},
          },
          { message: 'Profile image removed successfully' }
        )
      );
    } catch (err) {
      next(err);
    }
  }
}

export const adminMembersController = new AdminMembersController();
