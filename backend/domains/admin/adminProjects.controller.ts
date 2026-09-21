/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { projectsRepository, type ProjectRecord } from '../../db/repositories/projects.repository.ts';
import { membersRepository } from '../../db/repositories/members.repository.ts';
import { auditService } from '../../services/audit.service.ts';
import { cloudinaryService } from '../../services/cloudinary.service.ts';
import { validateMediaUpload } from '../../utils/mimeSniffer.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { apiSuccess, createPaginationMeta } from '../../utils/apiResponse.ts';

// Helper to validate URL protocol (must be http:// or https://, rejects javascript:)
function isValidHttpUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  if (trimmed.length === 0) return true; // empty is allowed
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Multipart helper
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

export function formatAdminProject(project: ProjectRecord, members: any[] = [], relatedEvents: any[] = []) {
  let tech: string[] = [];
  try {
    tech = JSON.parse(project.technologies || '[]');
  } catch {
    tech = [];
  }

  let deliverables: string[] = [];
  if (project.deliverables) {
    try {
      deliverables = JSON.parse(project.deliverables);
    } catch {
      deliverables = [];
    }
  }

  return {
    ...project,
    featured: project.featured === 1,
    technologies: tech,
    deliverables,
    cover_image_url: project.cover_image_url || project.cover_image || null,
    live_url: project.live_url || project.demo_url || null,
    members,
    relatedEvents,
  };
}

export class AdminProjectsController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as string | undefined;
      const category = req.query.category as string | undefined;
      const search = (req.query.search || req.query.q) as string | undefined;
      const sort = req.query.sort as string | undefined;
      const featured = req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined;

      const { items, total } = projectsRepository.findAllAdmin({
        page,
        limit,
        status,
        category,
        featured,
        search,
        sort,
      });

      // Batch load members to prevent N+1 queries
      const projectIds = items.map((p) => p.id);
      const membersMap = projectsRepository.getMembersForProjects(projectIds);

      const enriched = items.map((p) => {
        let tech: string[] = [];
        try {
          tech = JSON.parse(p.technologies || '[]');
        } catch {
          tech = [];
        }

        let deliverables: string[] = [];
        if (p.deliverables) {
          try {
            deliverables = JSON.parse(p.deliverables);
          } catch {
            deliverables = [];
          }
        }

        return {
          ...p,
          featured: p.featured === 1,
          technologies: tech,
          deliverables,
          cover_image_url: p.cover_image_url || p.cover_image || null,
          live_url: p.live_url || p.demo_url || null,
          members: membersMap.get(p.id) || [],
        };
      });

      const meta = createPaginationMeta(page, limit, total);
      res.status(200).json(apiSuccess(enriched, meta));
    } catch (err) {
      next(err);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const project = projectsRepository.findById(id);
      if (!project) {
        throw new AppError(404, `Project with ID '${id}' was not found`, undefined, 'PROJECT_NOT_FOUND');
      }

      const members = projectsRepository.getMembers(id);
      const relatedEvents = projectsRepository.getRelatedEvents(id);

      let tech: string[] = [];
      try {
        tech = JSON.parse(project.technologies || '[]');
      } catch {
        tech = [];
      }

      let deliverables: string[] = [];
      if (project.deliverables) {
        try {
          deliverables = JSON.parse(project.deliverables);
        } catch {
          deliverables = [];
        }
      }

      res.status(200).json(
        apiSuccess({
          ...project,
          featured: project.featured === 1,
          technologies: tech,
          deliverables,
          cover_image_url: project.cover_image_url || project.cover_image || null,
          live_url: project.live_url || project.demo_url || null,
          members,
          relatedEvents,
        })
      );
    } catch (err) {
      next(err);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const title = req.body.title;
      const category = req.body.category;
      const shortDescription = req.body.shortDescription || req.body.short_description || req.body.summary || (title ? `${title} project overview` : '');
      const fullDescription = req.body.fullDescription || req.body.full_description || req.body.description || shortDescription;
      const slug = req.body.slug;
      const projectNumber = req.body.projectNumber || req.body.project_number;
      const year = req.body.year;
      const disciplines = req.body.disciplines;
      const status = req.body.status;
      const featured = req.body.featured;
      const technologies = req.body.technologies;
      const deliverables = req.body.deliverables;
      const coverImageUrl = req.body.coverImageUrl || req.body.cover_image_url || req.body.coverImage || req.body.cover_image;
      const liveUrl = req.body.liveUrl || req.body.live_url || req.body.demoUrl || req.body.demo_url;
      const repositoryUrl = req.body.repositoryUrl || req.body.repository_url;
      const documentationUrl = req.body.documentationUrl || req.body.documentation_url;
      const startDate = req.body.startDate || req.body.start_date;
      const endDate = req.body.endDate || req.body.end_date;
      const members = req.body.members;
      const id = req.body.id;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        throw new AppError(400, 'Title is required', undefined, 'VALIDATION_ERROR');
      }
      if (!category || typeof category !== 'string' || category.trim().length === 0) {
        throw new AppError(400, 'Category is required', undefined, 'VALIDATION_ERROR');
      }
      if (!shortDescription || typeof shortDescription !== 'string' || shortDescription.trim().length === 0) {
        throw new AppError(400, 'Short description / summary is required', undefined, 'VALIDATION_ERROR');
      }

      // Validate URL schemes
      const repo = repositoryUrl ? String(repositoryUrl).trim() : undefined;
      const live = liveUrl ? String(liveUrl).trim() : undefined;
      const docs = documentationUrl ? String(documentationUrl).trim() : undefined;

      if (repo && !isValidHttpUrl(repo)) {
        throw new AppError(400, 'Invalid repository URL. Must start with http:// or https://', undefined, 'VALIDATION_ERROR');
      }
      if (live && !isValidHttpUrl(live)) {
        throw new AppError(400, 'Invalid live_url URL format. Must start with http:// or https://', undefined, 'VALIDATION_ERROR');
      }
      if (docs && !isValidHttpUrl(docs)) {
        throw new AppError(400, 'Invalid documentation URL. Must start with http:// or https://', undefined, 'VALIDATION_ERROR');
      }

      const projectId = id || `prj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      
      let projectSlug = slug
        ? slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
        : title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

      if (!projectSlug || projectSlug.length === 0) {
        projectSlug = `project-${Date.now()}`;
      }

      // Check slug uniqueness
      const existingWithSlug = projectsRepository.findBySlug(projectSlug);
      if (existingWithSlug && existingWithSlug.id !== projectId) {
        if (slug) {
          throw new AppError(409, `A project with slug '${projectSlug}' already exists`, undefined, 'SLUG_CONFLICT');
        }
        projectSlug = `${projectSlug}-${Date.now().toString().slice(-4)}`;
      }

      const initialStatus = status || 'Draft';
      const now = new Date().toISOString();
      const publishedAt = initialStatus.toLowerCase() === 'published' ? now : null;
      const finalCoverUrl = coverImageUrl || null;

      const project = projectsRepository.createProject({
        id: projectId,
        slug: projectSlug,
        project_number: projectNumber || null,
        title: title.trim(),
        category: category.trim(),
        year: year || new Date().getFullYear().toString(),
        short_description: shortDescription.trim(),
        full_description: fullDescription ? fullDescription.trim() : shortDescription.trim(),
        disciplines: disciplines || category.trim(),
        status: initialStatus,
        featured: featured ? 1 : 0,
        technologies: JSON.stringify(Array.isArray(technologies) ? technologies : []),
        deliverables: deliverables ? JSON.stringify(deliverables) : null,
        cover_image: finalCoverUrl,
        cover_image_url: finalCoverUrl,
        cover_image_public_id: null,
        demo_url: live || null,
        live_url: live || null,
        repository_url: repo || null,
        documentation_url: docs || null,
        start_date: startDate || null,
        end_date: endDate || null,
        published_at: publishedAt,
        created_at: now,
        updated_at: now,
      });

      // Handle member associations if passed
      if (Array.isArray(members) && members.length > 0) {
        projectsRepository.setMembers(
          projectId,
          members.map((m: any) => ({
            memberId: m.memberId || m.id || m.member_id,
            role: m.role || 'Contributor',
          }))
        );
      }

      const created = projectsRepository.findById(projectId);
      const associatedMembers = projectsRepository.getMembers(projectId);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'PROJECT_CREATED',
          entityType: 'PROJECT',
          entityId: projectId,
          afterJson: created || project,
          details: { title: project.title, slug: projectSlug, status: initialStatus },
        },
        req
      );

      res.status(201).json(apiSuccess(formatAdminProject(created || project, associatedMembers), { message: 'Project created successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const expectedUpdatedAt = (req.headers['if-match'] as string | undefined) || req.body.expected_updated_at || req.body.expectedUpdatedAt;

      const existing = projectsRepository.findById(id);
      if (!existing) {
        throw new AppError(404, `Project with ID '${id}' was not found`, undefined, 'PROJECT_NOT_FOUND');
      }

      const updates: Partial<ProjectRecord> = {};

      if (req.body.title !== undefined) {
        if (typeof req.body.title !== 'string' || req.body.title.trim().length === 0) {
          throw new AppError(400, 'Title cannot be empty', undefined, 'VALIDATION_ERROR');
        }
        updates.title = req.body.title.trim();
      }

      if (req.body.slug !== undefined) {
        const cleanSlug = req.body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
        if (!cleanSlug || cleanSlug.length === 0) {
          throw new AppError(400, 'Slug cannot be empty', undefined, 'VALIDATION_ERROR');
        }
        const conflict = projectsRepository.findBySlug(cleanSlug);
        if (conflict && conflict.id !== id) {
          throw new AppError(409, `A project with slug '${cleanSlug}' already exists`, undefined, 'SLUG_CONFLICT');
        }
        updates.slug = cleanSlug;
      }

      const pNum = req.body.projectNumber !== undefined ? req.body.projectNumber : req.body.project_number;
      if (pNum !== undefined) updates.project_number = pNum;

      if (req.body.category !== undefined) updates.category = req.body.category.trim();
      if (req.body.year !== undefined) updates.year = req.body.year;

      const sDesc = req.body.shortDescription !== undefined ? req.body.shortDescription : (req.body.short_description !== undefined ? req.body.short_description : req.body.summary);
      if (sDesc !== undefined) updates.short_description = sDesc.trim();

      const fDesc = req.body.fullDescription !== undefined ? req.body.fullDescription : (req.body.full_description !== undefined ? req.body.full_description : req.body.description);
      if (fDesc !== undefined) updates.full_description = fDesc.trim();

      if (req.body.disciplines !== undefined) updates.disciplines = req.body.disciplines;
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.featured !== undefined) updates.featured = req.body.featured ? 1 : 0;

      if (req.body.technologies !== undefined) {
        updates.technologies = JSON.stringify(Array.isArray(req.body.technologies) ? req.body.technologies : []);
      }
      if (req.body.deliverables !== undefined) {
        updates.deliverables = JSON.stringify(req.body.deliverables);
      }

      const cImg = req.body.coverImageUrl !== undefined ? req.body.coverImageUrl : (req.body.cover_image_url !== undefined ? req.body.cover_image_url : (req.body.coverImage !== undefined ? req.body.coverImage : req.body.cover_image));
      if (cImg !== undefined) {
        updates.cover_image_url = cImg;
        updates.cover_image = cImg;
      }

      const lUrl = req.body.liveUrl !== undefined ? req.body.liveUrl : (req.body.live_url !== undefined ? req.body.live_url : (req.body.demoUrl !== undefined ? req.body.demoUrl : req.body.demo_url));
      if (lUrl !== undefined) {
        if (lUrl && !isValidHttpUrl(lUrl)) {
          throw new AppError(400, 'Invalid live/demo URL. Must start with http:// or https://', undefined, 'VALIDATION_ERROR');
        }
        updates.live_url = lUrl;
        updates.demo_url = lUrl;
      }

      const rUrl = req.body.repositoryUrl !== undefined ? req.body.repositoryUrl : req.body.repository_url;
      if (rUrl !== undefined) {
        if (rUrl && !isValidHttpUrl(rUrl)) {
          throw new AppError(400, 'Invalid repository URL. Must start with http:// or https://', undefined, 'VALIDATION_ERROR');
        }
        updates.repository_url = rUrl;
      }

      const dUrl = req.body.documentationUrl !== undefined ? req.body.documentationUrl : req.body.documentation_url;
      if (dUrl !== undefined) {
        if (dUrl && !isValidHttpUrl(dUrl)) {
          throw new AppError(400, 'Invalid documentation URL. Must start with http:// or https://', undefined, 'VALIDATION_ERROR');
        }
        updates.documentation_url = dUrl;
      }

      const sDate = req.body.startDate !== undefined ? req.body.startDate : req.body.start_date;
      if (sDate !== undefined) updates.start_date = sDate;

      const eDate = req.body.endDate !== undefined ? req.body.endDate : req.body.end_date;
      if (eDate !== undefined) updates.end_date = eDate;

      const result = projectsRepository.updateProject(id, updates, expectedUpdatedAt);

      if (result.conflict) {
        throw new AppError(
          409,
          'Conflict: This project was updated by another administrator. Please refresh and retry.',
          undefined,
          'CONCURRENCY_CONFLICT'
        );
      }

      // Handle member associations if passed
      if (Array.isArray(req.body.members)) {
        projectsRepository.setMembers(
          id,
          req.body.members.map((m: any) => ({
            memberId: m.memberId || m.id || m.member_id,
            role: m.role || 'Contributor',
          }))
        );
      }

      const updated = projectsRepository.findById(id);
      const members = projectsRepository.getMembers(id);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'PROJECT_UPDATED',
          entityType: 'PROJECT',
          entityId: id,
          beforeJson: existing,
          afterJson: updated || undefined,
          details: { updatedFields: Object.keys(updates) },
        },
        req
      );

      res.status(200).json(apiSuccess(formatAdminProject(updated || existing, members), { message: 'Project updated successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || typeof status !== 'string') {
        throw new AppError(400, "Status is required: 'Draft', 'Published', or 'Archived'", undefined, 'INVALID_STATUS');
      }

      const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      const validStatuses = ['Draft', 'Published', 'Archived', 'Active', 'Completed', 'Incubating'];

      if (!validStatuses.includes(normalizedStatus)) {
        throw new AppError(400, "Status must be one of: 'Draft', 'Published', 'Archived'", undefined, 'INVALID_STATUS');
      }

      // Archiving or un-archiving restriction
      if (normalizedStatus === 'Archived' && req.admin?.role !== 'super_admin') {
        throw new AppError(403, 'Forbidden: Only super_admin can archive content', undefined, 'INSUFFICIENT_PERMISSIONS');
      }

      const project = projectsRepository.findById(id);
      if (!project) {
        throw new AppError(404, `Project with ID '${id}' was not found`, undefined, 'PROJECT_NOT_FOUND');
      }

      const previousStatus = project.status;
      const updated = projectsRepository.updateStatus(id, normalizedStatus);

      let auditAction = 'PROJECT_STATUS_CHANGED';
      if (normalizedStatus === 'Published') auditAction = 'PROJECT_PUBLISHED';
      else if (normalizedStatus === 'Archived') auditAction = 'PROJECT_ARCHIVED';
      else if (normalizedStatus === 'Draft' && previousStatus === 'Published') auditAction = 'PROJECT_UNPUBLISHED';

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: auditAction,
          entityType: 'PROJECT',
          entityId: id,
          beforeJson: project,
          afterJson: updated || undefined,
          details: { previousStatus, newStatus: normalizedStatus },
        },
        req
      );

      res.status(200).json(apiSuccess(formatAdminProject(updated || project), { message: `Project transitioned to '${normalizedStatus}'` }));
    } catch (err) {
      next(err);
    }
  }

  public async toggleFeatured(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const project = projectsRepository.findById(id);
      if (!project) {
        throw new AppError(404, `Project with ID '${id}' was not found`, undefined, 'PROJECT_NOT_FOUND');
      }

      const newFeatured = req.body.featured !== undefined ? (req.body.featured ? 1 : 0) : (project.featured === 1 ? 0 : 1);
      const updated = projectsRepository.update(id, { featured: newFeatured });

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: newFeatured === 1 ? 'PROJECT_FEATURED' : 'PROJECT_UNFEATURED',
          entityType: 'PROJECT',
          entityId: id,
          beforeJson: project,
          afterJson: updated || undefined,
          details: { featured: newFeatured === 1 },
        },
        req
      );

      res.status(200).json(apiSuccess(formatAdminProject(updated || project), { message: `Project featured state set to ${newFeatured === 1}` }));
    } catch (err) {
      next(err);
    }
  }

  public async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const project = projectsRepository.findById(id);
      if (!project) {
        throw new AppError(404, `Project with ID '${id}' was not found`, undefined, 'PROJECT_NOT_FOUND');
      }

      const { buffer, filename } = extractUploadPayload(req);

      // Validate via mimeSniffer: enforces 5MB-10MB max, magic bytes sniffing for JPEG, PNG, WebP
      const validation = validateMediaUpload(buffer, filename, 'projects');
      if (!validation.valid || !validation.detectedMime) {
        throw new AppError(
          validation.code === 'FILE_TOO_LARGE' ? 413 : 400,
          validation.error || 'Invalid cover image format or size',
          undefined,
          validation.code || 'INVALID_FILE'
        );
      }

      const bufferToUpload = validation.sanitizedBuffer || buffer;
      const oldPublicId = project.cover_image_public_id;

      // Upload to Cloudinary
      const uploadResult = await cloudinaryService.uploadProfileImage({
        buffer: bufferToUpload,
        filename,
        memberIdentifier: `project-${project.slug || project.id}`,
      });

      // Update SQLite database record
      try {
        const now = new Date().toISOString();
        projectsRepository.update(project.id, {
          cover_image_url: uploadResult.secureUrl,
          cover_image_public_id: uploadResult.publicId,
          cover_image: uploadResult.secureUrl,
          updated_at: now,
        });
      } catch (dbErr) {
        // If DB write fails, clean up newly uploaded asset to prevent orphans
        try {
          await cloudinaryService.destroyImage(uploadResult.publicId);
        } catch {
          // ignore cleanup failure
        }
        throw new AppError(500, 'Database error while saving cover image reference', undefined, 'DATABASE_ERROR');
      }

      // Safe replacement: Only destroy old Cloudinary asset AFTER SQLite write succeeds
      if (oldPublicId && oldPublicId !== uploadResult.publicId) {
        try {
          await cloudinaryService.destroyImage(oldPublicId);
        } catch (cleanupErr) {
          console.warn(`[Cloudinary] Failed to clean up replaced asset "${oldPublicId}":`, cleanupErr);
        }
      }

      const updated = projectsRepository.findById(project.id);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'PROJECT_IMAGE_CHANGED',
          entityType: 'PROJECT',
          entityId: project.id,
          beforeJson: project,
          afterJson: updated || undefined,
          details: {
            secureUrl: uploadResult.secureUrl,
            publicId: uploadResult.publicId,
            format: uploadResult.format,
            bytes: uploadResult.bytes,
          },
        },
        req
      );

      res.status(200).json(apiSuccess(formatAdminProject(updated || project), { message: 'Project cover image uploaded successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const memberId = req.body.memberId || req.body.member_id || req.body.id;
      const role = req.body.role;

      if (!memberId) {
        throw new AppError(400, 'memberId is required', undefined, 'INVALID_MEMBER_ID');
      }

      const project = projectsRepository.findById(id);
      if (!project) {
        throw new AppError(404, `Project with ID '${id}' was not found`, undefined, 'PROJECT_NOT_FOUND');
      }

      const member = membersRepository.findById(memberId);
      if (!member) {
        throw new AppError(404, `Member with ID '${memberId}' was not found`, undefined, 'MEMBER_NOT_FOUND');
      }

      projectsRepository.addMember(id, memberId, role);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'PROJECT_MEMBERS_CHANGED',
          entityType: 'PROJECT',
          entityId: id,
          details: { action: 'ADD', memberId, memberName: member.name, role: role || 'Contributor' },
        },
        req
      );

      const members = projectsRepository.getMembers(id);
      res.status(200).json(apiSuccess(members, { message: 'Member added to project' }));
    } catch (err) {
      next(err);
    }
  }

  public async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, memberId } = req.params;

      const project = projectsRepository.findById(id);
      if (!project) {
        throw new AppError(404, `Project with ID '${id}' was not found`, undefined, 'PROJECT_NOT_FOUND');
      }

      projectsRepository.removeMember(id, memberId);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'PROJECT_MEMBERS_CHANGED',
          entityType: 'PROJECT',
          entityId: id,
          details: { action: 'REMOVE', memberId },
        },
        req
      );

      const members = projectsRepository.getMembers(id);
      res.status(200).json(apiSuccess(members, { message: 'Member removed from project' }));
    } catch (err) {
      next(err);
    }
  }

  public async syncMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { members } = req.body;

      if (!Array.isArray(members)) {
        throw new AppError(400, 'members array is required', undefined, 'INVALID_MEMBERS');
      }

      const project = projectsRepository.findById(id);
      if (!project) {
        throw new AppError(404, `Project with ID '${id}' was not found`, undefined, 'PROJECT_NOT_FOUND');
      }

      const mapped = members.map((m: any) => ({
        memberId: m.memberId || m.id || m.member_id,
        role: m.role || 'Contributor',
      }));

      projectsRepository.setMembers(id, mapped);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'PROJECT_MEMBERS_CHANGED',
          entityType: 'PROJECT',
          entityId: id,
          details: { action: 'SYNC', memberCount: mapped.length },
        },
        req
      );

      const updatedMembers = projectsRepository.getMembers(id);
      res.status(200).json(apiSuccess(updatedMembers, { message: 'Project members synchronized successfully' }));
    } catch (err) {
      next(err);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const project = projectsRepository.findById(id);
      if (!project) {
        throw new AppError(404, `Project with ID '${id}' was not found`, undefined, 'PROJECT_NOT_FOUND');
      }

      projectsRepository.deleteProject(id);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'PROJECT_DELETED',
          entityType: 'PROJECT',
          entityId: id,
          beforeJson: project,
          details: { title: project.title, slug: project.slug },
        },
        req
      );

      res.status(200).json(apiSuccess({ deleted: true, id }, { message: 'Project deleted successfully' }));
    } catch (err) {
      next(err);
    }
  }
}

export const adminProjectsController = new AdminProjectsController();
