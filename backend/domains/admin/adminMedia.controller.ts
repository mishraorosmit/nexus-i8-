import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import {
  mediaAssetsRepository,
  type MediaAssetRecord,
  type MediaCategory,
} from '../../db/repositories/mediaAssets.repository.ts';
import { mediaService } from '../../services/media.service.ts';
import { cloudinaryService } from '../../services/cloudinary.service.ts';
import { auditService } from '../../services/audit.service.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { apiSuccess, createPaginationMeta } from '../../utils/apiResponse.ts';
import { storageProvider } from '../../storage/index.ts';
import { validateMediaUpload } from '../../utils/mimeSniffer.ts';
import { getDatabase } from '../../db/connection.ts';
import { memoryCache } from '../../utils/cache.ts';

const ALLOWED_CATEGORIES: string[] = [
  'member',
  'project',
  'event',
  'gallery',
  'branding',
  'general',
  'resources',
  'archive',
  'members',
  'projects',
  'events',
];

function normalizeCategory(cat?: string): MediaCategory {
  if (!cat) return 'general';
  const lower = cat.toLowerCase().trim();
  if (lower === 'members' || lower === 'member') return 'member';
  if (lower === 'projects' || lower === 'project') return 'project';
  if (lower === 'events' || lower === 'event') return 'event';
  if (lower === 'gallery') return 'gallery';
  if (lower === 'branding') return 'branding';
  if (lower === 'resources' || lower === 'archive') return lower as any;
  return 'general';
}

function extractUploadPayload(req: Request): {
  buffer: Buffer;
  filename: string;
  category: MediaCategory;
  rawCategory: string;
  altText?: string;
} {
  let buffer: Buffer;
  let filename: string;
  let category: MediaCategory = 'general';
  let rawCategory: string = 'general';
  let altText: string | undefined;

  if (req.is('application/json')) {
    const { content, filename: fname, category: cat, alt_text, altText: aText } = req.body;
    if (!content || typeof content !== 'string') {
      throw new AppError(400, 'Content (base64) is required', undefined, 'INVALID_PAYLOAD');
    }
    if (!fname || typeof fname !== 'string') {
      throw new AppError(400, 'Filename is required', undefined, 'INVALID_FILENAME');
    }

    const base64Data = content.includes(';base64,') ? content.split(';base64,')[1] : content;
    buffer = Buffer.from(base64Data, 'base64');
    filename = fname;
    if (cat) {
      rawCategory = cat;
      category = normalizeCategory(cat);
    }
    altText = alt_text || aText;
  } else if (Buffer.isBuffer(req.body)) {
    buffer = req.body;
    filename = (req.headers['x-filename'] as string) || `upload_${Date.now()}.png`;
    const catHeader = req.headers['x-category'] as string;
    if (catHeader) {
      rawCategory = catHeader;
      category = normalizeCategory(catHeader);
    }
    altText = req.headers['x-alt-text'] as string;
  } else {
    throw new AppError(
      400,
      'Unsupported upload format. Use application/json with base64 content or raw binary payload.',
      undefined,
      'UNSUPPORTED_MEDIA_TYPE'
    );
  }

  return { buffer, filename, category, rawCategory, altText };
}

export class AdminMediaController {
  /**
   * Search, filter, and paginate media assets with live usage statuses & telemetry facets
   */
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(100, parseInt(req.query.limit as string, 10) || 24);
      const search = req.query.search as string | undefined;
      const category = req.query.category as string | undefined;
      const format = req.query.format as string | undefined;
      const usage = req.query.usage as string | undefined;
      const sort = req.query.sort as string | undefined;

      const result = mediaAssetsRepository.findPaginatedMedia({
        page,
        limit,
        search,
        category,
        format,
        usage,
        sort,
      });

      const facets = mediaAssetsRepository.getMediaFacets();
      const meta = createPaginationMeta(result.page, result.limit, result.total);

      res.status(200).json(
        apiSuccess(result.items, {
          ...meta,
          facets,
        })
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve single media asset with complete metadata and active usage references
   */
  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const asset = mediaAssetsRepository.findById(id);
      if (!asset) {
        throw new AppError(404, `Media asset with ID '${id}' was not found`, undefined, 'MEDIA_NOT_FOUND');
      }

      const usage = mediaAssetsRepository.getAssetUsage(asset);
      const responseData = {
        ...asset,
        url: asset.secure_url || storageProvider.getUrl(asset.storage_key),
        usage_status: usage.status,
        references: usage.references,
        metadata: asset.metadata ? JSON.parse(asset.metadata) : {},
      };

      res.status(200).json(apiSuccess(responseData));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve live usage references for a media asset
   */
  public async getUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const asset = mediaAssetsRepository.findById(id);
      if (!asset) {
        throw new AppError(404, `Media asset with ID '${id}' was not found`, undefined, 'MEDIA_NOT_FOUND');
      }

      const usage = mediaAssetsRepository.getAssetUsage(asset);
      res.status(200).json(apiSuccess(usage));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload binary or base64 media asset to Cloudinary with metadata recorded in SQLite
   */
  public async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { buffer, filename, category, rawCategory, altText } = extractUploadPayload(req);

      // Validate MIME & magic bytes (enforcing appropriate category limit and allowed types)
      const snifferCategory =
        rawCategory === 'resources'
          ? 'resources'
          : rawCategory === 'archive'
            ? 'archive'
            : category === 'member'
              ? 'members'
              : category === 'project'
                ? 'projects'
                : category === 'event'
                  ? 'events'
                  : 'projects';
      const validation = validateMediaUpload(buffer, filename, snifferCategory as any);

      if (!validation.valid || !validation.detectedMime) {
        throw new AppError(
          validation.code === 'FILE_TOO_LARGE' ? 413 : 400,
          validation.error || 'Invalid file payload',
          undefined,
          validation.code || 'INVALID_FILE'
        );
      }

      const bufferToUpload = validation.sanitizedBuffer || buffer;
      const detectedMime = validation.detectedMime;
      const checksum = crypto.createHash('sha256').update(bufferToUpload).digest('hex');

      // Extract image dimensions & format via Sharp
      let width: number | null = null;
      let height: number | null = null;
      let format: string | null = null;

      if (detectedMime.startsWith('image/') && detectedMime !== 'image/svg+xml') {
        try {
          const image = sharp(bufferToUpload);
          const imgMeta = await image.metadata();
          width = imgMeta.width || null;
          height = imgMeta.height || null;
          format = imgMeta.format || null;
        } catch {
          // Sharp extraction bypass for raw formats
        }
      }

      // Generate local storage key
      const ext = path.extname(filename).toLowerCase();
      const cleanBase = path
        .basename(filename, ext)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 40) || 'asset';
      const rand = crypto.randomBytes(4).toString('hex');
      const timestamp = Date.now();
      const storageKey = `${category}/${new Date().getFullYear()}/${cleanBase}_${timestamp}_${rand}${ext}`;

      // Save to local storage provider
      try {
        await storageProvider.save(storageKey, bufferToUpload, detectedMime);
      } catch {
        // non-blocking
      }

      // Upload to Cloudinary if configured or mock mode is active
      let cloudinaryPublicId: string | null = null;
      let secureUrl: string | null = null;

      if (cloudinaryService.isReady()) {
        const uploadResult = await cloudinaryService.uploadMediaAsset({
          buffer: bufferToUpload,
          filename,
          category,
        });
        cloudinaryPublicId = uploadResult.publicId;
        secureUrl = uploadResult.secureUrl;
        if (!width && uploadResult.width) width = uploadResult.width;
        if (!height && uploadResult.height) height = uploadResult.height;
        if (!format && uploadResult.format) format = uploadResult.format;
      }

      const assetId = `med-${Date.now()}-${rand}`;
      const now = new Date().toISOString();

      const metaJson = {
        checksum,
        category,
        originalFilename: filename,
        width,
        height,
        format,
      };

      const record = mediaAssetsRepository.create({
        id: assetId,
        storage_key: storageKey,
        cloudinary_public_id: cloudinaryPublicId,
        secure_url: secureUrl || storageProvider.getUrl(storageKey),
        resource_type: 'image',
        folder: `nexus/${category}`,
        original_filename: filename,
        filename,
        mime_type: detectedMime,
        file_size: bufferToUpload.length,
        bytes: bufferToUpload.length,
        width: width || null,
        height: height || null,
        format: format || null,
        category,
        alt_text: altText || null,
        uploaded_by: req.admin?.name || req.admin?.email || 'Administrator',
        metadata: JSON.stringify(metaJson),
        updated_at: now,
      });

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'MEDIA_UPLOADED',
          entityType: 'MEDIA',
          entityId: record.id,
          afterJson: record,
          details: {
            filename: record.filename,
            category: record.category,
            publicId: record.cloudinary_public_id,
            bytes: record.file_size,
          },
        },
        req
      );

      const usage = mediaAssetsRepository.getAssetUsage(record);
      const enriched = {
        ...record,
        url: storageProvider.getUrl(record.storage_key),
        secure_url: record.secure_url || storageProvider.getUrl(record.storage_key),
        parsedMetadata: metaJson,
        usage_status: usage.status,
        references: usage.references,
      };

      res.status(201).json(apiSuccess(enriched, { message: 'Media asset uploaded and registered successfully' }));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update metadata (alt text, category, filename) of existing media asset
   */
  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const asset = mediaAssetsRepository.findById(id);
      if (!asset) {
        throw new AppError(404, `Media asset with ID '${id}' was not found`, undefined, 'MEDIA_NOT_FOUND');
      }

      const updates: Partial<MediaAssetRecord> = {};
      if (req.body.filename !== undefined) {
        updates.filename = String(req.body.filename).trim();
      }
      if (req.body.alt_text !== undefined || req.body.altText !== undefined) {
        updates.alt_text = String(req.body.alt_text || req.body.altText || '').trim() || null;
      }
      if (req.body.category !== undefined) {
        const cat = String(req.body.category).toLowerCase() as MediaCategory;
        if (ALLOWED_CATEGORIES.includes(cat)) {
          updates.category = cat;
        }
      }
      if (req.body.metadata !== undefined) {
        updates.metadata = typeof req.body.metadata === 'object' ? JSON.stringify(req.body.metadata) : String(req.body.metadata);
      }

      const updated = mediaAssetsRepository.update(id, updates);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'MEDIA_UPDATED',
          entityType: 'MEDIA',
          entityId: id,
          beforeJson: asset,
          afterJson: updated || undefined,
          details: { updatedFields: Object.keys(updates) },
        },
        req
      );

      const usage = mediaAssetsRepository.getAssetUsage(updated || asset);
      const responseData = {
        ...(updated || asset),
        url: updated?.secure_url || storageProvider.getUrl(updated?.storage_key || ''),
        usage_status: usage.status,
        references: usage.references,
      };

      res.status(200).json(apiSuccess(responseData, { message: 'Media metadata updated successfully' }));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Safe replacement of an existing media asset.
   * Cascade-updates any referencing members, projects, or events before destroying old asset.
   */
  public async replace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const existing = mediaAssetsRepository.findById(id);
      if (!existing) {
        throw new AppError(404, `Media asset with ID '${id}' was not found`, undefined, 'MEDIA_NOT_FOUND');
      }

      let buffer: Buffer;
      let filename: string;

      if (req.is('application/json')) {
        const { content, filename: fname } = req.body;
        if (!content || typeof content !== 'string') {
          throw new AppError(400, 'Content (base64) is required', undefined, 'INVALID_PAYLOAD');
        }
        const base64Data = content.includes(';base64,') ? content.split(';base64,')[1] : content;
        buffer = Buffer.from(base64Data, 'base64');
        filename = fname || existing.filename;
      } else if (Buffer.isBuffer(req.body)) {
        buffer = req.body;
        filename = (req.headers['x-filename'] as string) || existing.filename;
      } else {
        throw new AppError(400, 'Invalid request format. Send JSON or raw binary', undefined, 'INVALID_PAYLOAD');
      }

      const category = (existing.category as MediaCategory) || 'general';
      const snifferCategory = category === 'member' ? 'members' : category === 'project' ? 'projects' : category === 'event' ? 'events' : 'projects';

      const validation = validateMediaUpload(buffer, filename, snifferCategory);
      if (!validation.valid || !validation.detectedMime) {
        throw new AppError(
          validation.code === 'FILE_TOO_LARGE' ? 413 : 400,
          validation.error || 'Invalid replacement file',
          undefined,
          validation.code || 'INVALID_FILE'
        );
      }

      const bufferToUpload = validation.sanitizedBuffer || buffer;
      const detectedMime = validation.detectedMime;
      const oldPublicId = existing.cloudinary_public_id;
      const oldSecureUrl = existing.secure_url;
      const oldStorageKey = existing.storage_key;

      // Extract image dimensions via Sharp
      let width: number | null = null;
      let height: number | null = null;
      let format: string | null = null;

      if (detectedMime.startsWith('image/') && detectedMime !== 'image/svg+xml') {
        try {
          const image = sharp(bufferToUpload);
          const imgMeta = await image.metadata();
          width = imgMeta.width || null;
          height = imgMeta.height || null;
          format = imgMeta.format || null;
        } catch {}
      }

      // 1. Upload new asset to Cloudinary if ready
      let newPublicId: string | null = oldPublicId;
      let newSecureUrl: string | null = oldSecureUrl;

      if (cloudinaryService.isReady()) {
        const uploadResult = await cloudinaryService.uploadMediaAsset({
          buffer: bufferToUpload,
          filename,
          category,
        });
        newPublicId = uploadResult.publicId;
        newSecureUrl = uploadResult.secureUrl;
        if (!width && uploadResult.width) width = uploadResult.width;
        if (!height && uploadResult.height) height = uploadResult.height;
        if (!format && uploadResult.format) format = uploadResult.format;
      }

      const now = new Date().toISOString();
      const db = getDatabase();

      // 2. Commit SQLite updates inside transaction
      let affectedEntitiesCount = 0;
      try {
        db.exec('BEGIN TRANSACTION;');

        // Update media_assets record
        mediaAssetsRepository.update(id, {
          cloudinary_public_id: newPublicId,
          secure_url: newSecureUrl || storageProvider.getUrl(existing.storage_key),
          filename,
          original_filename: filename,
          mime_type: detectedMime,
          file_size: bufferToUpload.length,
          bytes: bufferToUpload.length,
          width: width || null,
          height: height || null,
          format: format || null,
          updated_at: now,
        });

        // Reassign members referencing old image
        if (newSecureUrl && (oldPublicId || oldSecureUrl || oldStorageKey)) {
          const updateMembersStmt = db.prepare(`
            UPDATE members
            SET profile_image_url = ?, profile_image_public_id = ?, photo_url = ?, updated_at = ?
            WHERE (profile_image_public_id IS NOT NULL AND (profile_image_public_id = ? OR profile_image_public_id = ?))
               OR (profile_image_url IS NOT NULL AND (profile_image_url = ? OR profile_image_url = ?))
               OR (photo_url IS NOT NULL AND (photo_url = ? OR photo_url = ?))
          `);
          const memRes = updateMembersStmt.run(
            newSecureUrl, newPublicId, newSecureUrl, now,
            oldPublicId || '', oldStorageKey || '',
            oldSecureUrl || '', oldStorageKey || '',
            oldSecureUrl || '', oldStorageKey || ''
          );
          affectedEntitiesCount += Number(memRes.changes);

          // Reassign projects referencing old image
          const updateProjectsStmt = db.prepare(`
            UPDATE projects
            SET cover_image_url = ?, cover_image_public_id = ?, cover_image = ?, updated_at = ?
            WHERE (cover_image_public_id IS NOT NULL AND (cover_image_public_id = ? OR cover_image_public_id = ?))
               OR (cover_image_url IS NOT NULL AND (cover_image_url = ? OR cover_image_url = ?))
               OR (cover_image IS NOT NULL AND (cover_image = ? OR cover_image = ?))
          `);
          const prjRes = updateProjectsStmt.run(
            newSecureUrl, newPublicId, newSecureUrl, now,
            oldPublicId || '', oldStorageKey || '',
            oldSecureUrl || '', oldStorageKey || '',
            oldSecureUrl || '', oldStorageKey || ''
          );
          affectedEntitiesCount += Number(prjRes.changes);

          // Reassign events referencing old image
          const updateEventsStmt = db.prepare(`
            UPDATE events
            SET cover_image_url = ?, cover_image_public_id = ?, cover_image = ?, updated_at = ?
            WHERE (cover_image_public_id IS NOT NULL AND (cover_image_public_id = ? OR cover_image_public_id = ?))
               OR (cover_image_url IS NOT NULL AND (cover_image_url = ? OR cover_image_url = ?))
               OR (cover_image IS NOT NULL AND (cover_image = ? OR cover_image = ?))
          `);
          const evtRes = updateEventsStmt.run(
            newSecureUrl, newPublicId, newSecureUrl, now,
            oldPublicId || '', oldStorageKey || '',
            oldSecureUrl || '', oldStorageKey || '',
            oldSecureUrl || '', oldStorageKey || ''
          );
          affectedEntitiesCount += Number(evtRes.changes);
        }

        db.exec('COMMIT;');
      } catch (dbErr) {
        db.exec('ROLLBACK;');
        // Clean up newly uploaded asset on DB failure
        if (newPublicId && newPublicId !== oldPublicId) {
          try {
            await cloudinaryService.destroyImage(newPublicId);
          } catch {}
        }
        throw new AppError(500, 'Database transaction failed during asset replacement', undefined, 'DATABASE_ERROR');
      }

      // 3. Local storage update
      try {
        await storageProvider.save(existing.storage_key, bufferToUpload, detectedMime);
      } catch {}

      // 4. Safe cleanup: Destroy old Cloudinary asset only AFTER SQLite update succeeds
      if (oldPublicId && newPublicId && oldPublicId !== newPublicId) {
        try {
          await cloudinaryService.destroyImage(oldPublicId);
        } catch (cleanupErr) {
          console.warn(`[Cloudinary] Note: Failed to destroy replaced asset "${oldPublicId}":`, cleanupErr);
        }
      }

      // Invalidate memory caches
      memoryCache.invalidate('members');
      memoryCache.invalidate('projects');
      memoryCache.invalidate('events');
      memoryCache.invalidate('eid');

      const updated = mediaAssetsRepository.findById(id)!;
      const usage = mediaAssetsRepository.getAssetUsage(updated);

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'MEDIA_REPLACED',
          entityType: 'MEDIA',
          entityId: id,
          beforeJson: existing,
          afterJson: updated,
          details: {
            filename: updated.filename,
            newPublicId,
            oldPublicId,
            reassignedEntitiesCount: affectedEntitiesCount,
          },
        },
        req
      );

      if (affectedEntitiesCount > 0) {
        auditService.log(
          {
            adminId: req.admin?.adminId,
            adminName: req.admin?.name,
            adminRole: req.admin?.role,
            action: 'MEDIA_REASSIGNED',
            entityType: 'MEDIA',
            entityId: id,
            details: {
              reassignedCount: affectedEntitiesCount,
              newSecureUrl,
            },
          },
          req
        );
      }

      res.status(200).json(
        apiSuccess(
          {
            ...updated,
            url: storageProvider.getUrl(existing.storage_key),
            secure_url: updated.secure_url || storageProvider.getUrl(existing.storage_key),
            usage_status: usage.status,
            references: usage.references,
          },
          { message: 'Media asset safely replaced and references updated' }
        )
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reference-protected deletion: strictly blocks deletion if referenced by any active entity.
   */
  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const asset = mediaAssetsRepository.findById(id);
      if (!asset) {
        throw new AppError(404, `Media asset with ID '${id}' was not found`, undefined, 'MEDIA_NOT_FOUND');
      }

      // Check live usage across members, projects, and events
      const usage = mediaAssetsRepository.getAssetUsage(asset);
      if (usage.status === 'USED' || usage.references.length > 0) {
        throw new AppError(
          400,
          `Cannot delete media asset: It is currently in use by ${usage.references.length} active NEXUS entity record(s).`,
          { references: usage.references },
          'CANNOT_DELETE_REFERENCED_ASSET'
        );
      }

      // Safe deletion: remove from SQLite first
      mediaAssetsRepository.deleteAsset(id);

      // Clean up Cloudinary asset if public ID present
      if (asset.cloudinary_public_id) {
        try {
          await cloudinaryService.destroyImage(asset.cloudinary_public_id);
        } catch (destroyErr) {
          console.warn(`[Cloudinary] Asset destroy warning for "${asset.cloudinary_public_id}":`, destroyErr);
        }
      }

      // Backward-compatible local storage cleanup
      try {
        await storageProvider.delete(asset.storage_key);
      } catch {}

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'MEDIA_DELETED',
          entityType: 'MEDIA',
          entityId: id,
          beforeJson: asset,
          details: {
            filename: asset.filename,
            publicId: asset.cloudinary_public_id,
            category: asset.category,
          },
        },
        req
      );

      res.status(200).json(apiSuccess({ deleted: true, id }, { message: 'Media asset deleted successfully' }));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Legacy orphan discovery method for test:media suite
   */
  public async getOrphans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orphans = mediaService.getOrphans();
      res.status(200).json(
        apiSuccess(orphans, {
          totalOrphans: orphans.length,
        })
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Legacy orphan cleanup method for test:media suite
   */
  public async cleanupOrphans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await mediaService.cleanupOrphans();

      auditService.log(
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          action: 'CLEANUP_ORPHANS',
          entityType: 'MEDIA',
          entityId: 'batch',
          details: { purgedCount: result.purgedCount, purgedKeys: result.purgedKeys },
        },
        req
      );

      res.status(200).json(
        apiSuccess(result, {
          message: `Orphan cleanup complete. ${result.purgedCount} asset(s) removed.`,
        })
      );
    } catch (err) {
      next(err);
    }
  }
}

export const adminMediaController = new AdminMediaController();
