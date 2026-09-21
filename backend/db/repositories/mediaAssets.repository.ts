import { BaseRepository } from './base.repository.ts';

export type MediaCategory = 'member' | 'project' | 'event' | 'gallery' | 'branding' | 'general';
export type MediaUsageStatus = 'USED' | 'UNUSED' | 'UNKNOWN';

export interface MediaReference {
  type: 'member' | 'project' | 'event' | 'branding';
  id: string;
  label: string;
  url?: string;
}

export interface MediaAssetRecord {
  id: string;
  storage_key: string;
  cloudinary_public_id?: string | null;
  secure_url?: string | null;
  public_url?: string | null;
  resource_type?: string | null;
  folder?: string | null;
  original_filename?: string | null;
  filename: string;
  mime_type: string;
  file_size: number;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  category?: MediaCategory | string;
  alt_text?: string | null;
  uploaded_by?: string | null;
  metadata: string | null; // JSON string
  created_at: string;
  updated_at?: string | null;
}

export interface EnrichedAdminMediaAsset extends MediaAssetRecord {
  url: string;
  usage_status: MediaUsageStatus;
  references: MediaReference[];
}

export interface MediaFacets {
  total: number;
  used: number;
  unused: number;
  unknown: number;
  totalBytes: number;
  byCategory: Record<string, number>;
}

export interface MediaQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  format?: string;
  usage?: string;
  sort?: string;
}

export class MediaAssetsRepository extends BaseRepository<MediaAssetRecord> {
  constructor() {
    super('media_assets');
  }

  public findAll(): MediaAssetRecord[] {
    const stmt = this.db.prepare('SELECT * FROM media_assets ORDER BY created_at DESC');
    return stmt.all() as unknown as MediaAssetRecord[];
  }

  public findById(id: string): MediaAssetRecord | null {
    const stmt = this.db.prepare('SELECT * FROM media_assets WHERE id = ?');
    const row = stmt.get(id);
    return (row as unknown as MediaAssetRecord) || null;
  }

  public findByStorageKey(storageKey: string): MediaAssetRecord | null {
    const stmt = this.db.prepare('SELECT * FROM media_assets WHERE storage_key = ? OR cloudinary_public_id = ?');
    const row = stmt.get(storageKey, storageKey);
    return (row as unknown as MediaAssetRecord) || null;
  }

  public findByCloudinaryPublicId(cloudinaryPublicId: string): MediaAssetRecord | null {
    const stmt = this.db.prepare('SELECT * FROM media_assets WHERE cloudinary_public_id = ? OR storage_key = ?');
    const row = stmt.get(cloudinaryPublicId, cloudinaryPublicId);
    return (row as unknown as MediaAssetRecord) || null;
  }

  public create(data: Omit<MediaAssetRecord, 'created_at'>): MediaAssetRecord {
    const now = new Date().toISOString();
    const storageKey = data.storage_key || data.cloudinary_public_id || `asset_${Date.now()}`;
    const cloudinaryPublicId = data.cloudinary_public_id || data.storage_key || storageKey;
    const secureUrl = data.secure_url || data.public_url || null;
    const originalFilename = data.original_filename || data.filename;
    const bytes = data.bytes !== undefined ? data.bytes : (data.file_size || 0);
    const fileSize = data.file_size !== undefined ? data.file_size : bytes;
    const resourceType = data.resource_type || 'image';
    const folder = data.folder || 'nexus';
    const category = data.category || 'general';
    const altText = data.alt_text || null;
    const uploadedBy = data.uploaded_by || null;

    const record: MediaAssetRecord = {
      ...data,
      storage_key: storageKey,
      cloudinary_public_id: cloudinaryPublicId,
      secure_url: secureUrl,
      original_filename: originalFilename,
      bytes,
      file_size: fileSize,
      resource_type: resourceType,
      folder,
      category,
      alt_text: altText,
      uploaded_by: uploadedBy,
      created_at: now,
      updated_at: data.updated_at || now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO media_assets (
        id, storage_key, cloudinary_public_id, secure_url, resource_type, folder,
        original_filename, filename, mime_type, file_size, width, height, bytes, format,
        category, alt_text, uploaded_by, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.storage_key,
      record.cloudinary_public_id || null,
      record.secure_url || null,
      record.resource_type || 'image',
      record.folder || 'nexus',
      record.original_filename || null,
      record.filename,
      record.mime_type,
      record.file_size,
      record.width || null,
      record.height || null,
      record.bytes || null,
      record.format || null,
      record.category || 'general',
      record.alt_text || null,
      record.uploaded_by || null,
      record.metadata,
      record.created_at,
      record.updated_at || record.created_at
    );

    return record;
  }

  /**
   * Determine live entity references and usage state for a given media asset.
   * Checks members, projects, events, and site branding.
   */
  public getAssetUsage(assetOrId: MediaAssetRecord | string): {
    status: MediaUsageStatus;
    references: MediaReference[];
  } {
    const asset = typeof assetOrId === 'string' ? this.findById(assetOrId) : assetOrId;
    if (!asset) {
      return { status: 'UNKNOWN', references: [] };
    }

    const references: MediaReference[] = [];
    const publicId = asset.cloudinary_public_id || '';
    const secureUrl = asset.secure_url || '';
    const storageKey = asset.storage_key || '';

    // 1. Check members (including E-ID card avatars)
    const memberStmt = this.db.prepare(`
      SELECT id, unique_id, name, slug
      FROM members
      WHERE (profile_image_public_id IS NOT NULL AND profile_image_public_id != '' AND (profile_image_public_id = ? OR profile_image_public_id = ?))
         OR (profile_image_url IS NOT NULL AND profile_image_url != '' AND (profile_image_url = ? OR profile_image_url = ?))
         OR (photo_url IS NOT NULL AND photo_url != '' AND (photo_url = ? OR photo_url = ?))
    `);
    const members = memberStmt.all(
      publicId, storageKey,
      secureUrl, storageKey,
      secureUrl, storageKey
    ) as Array<{ id: string; unique_id: string; name: string; slug: string }>;

    for (const m of members) {
      references.push({
        type: 'member',
        id: m.id,
        label: `${m.name} (${m.unique_id || m.slug})`,
        url: `/admin/members?search=${encodeURIComponent(m.unique_id || m.name)}`,
      });
    }

    // 2. Check projects
    const projectStmt = this.db.prepare(`
      SELECT id, slug, title
      FROM projects
      WHERE (cover_image_public_id IS NOT NULL AND cover_image_public_id != '' AND (cover_image_public_id = ? OR cover_image_public_id = ?))
         OR (cover_image_url IS NOT NULL AND cover_image_url != '' AND (cover_image_url = ? OR cover_image_url = ?))
         OR (cover_image IS NOT NULL AND cover_image != '' AND (cover_image = ? OR cover_image = ?))
    `);
    const projects = projectStmt.all(
      publicId, storageKey,
      secureUrl, storageKey,
      secureUrl, storageKey
    ) as Array<{ id: string; slug: string; title: string }>;

    for (const p of projects) {
      references.push({
        type: 'project',
        id: p.id,
        label: `Project: ${p.title}`,
        url: `/admin/projects?search=${encodeURIComponent(p.slug || p.title)}`,
      });
    }

    // 3. Check events
    const eventStmt = this.db.prepare(`
      SELECT id, slug, title
      FROM events
      WHERE (cover_image_public_id IS NOT NULL AND cover_image_public_id != '' AND (cover_image_public_id = ? OR cover_image_public_id = ?))
         OR (cover_image_url IS NOT NULL AND cover_image_url != '' AND (cover_image_url = ? OR cover_image_url = ?))
         OR (cover_image IS NOT NULL AND cover_image != '' AND (cover_image = ? OR cover_image = ?))
    `);
    const events = eventStmt.all(
      publicId, storageKey,
      secureUrl, storageKey,
      secureUrl, storageKey
    ) as Array<{ id: string; slug: string; title: string }>;

    for (const e of events) {
      references.push({
        type: 'event',
        id: e.id,
        label: `Event: ${e.title}`,
        url: `/admin/events?search=${encodeURIComponent(e.slug || e.title)}`,
      });
    }

    // 4. Check site_settings (for branding logos)
    try {
      const settingStmt = this.db.prepare(`
        SELECT key, value
        FROM site_settings
        WHERE (value IS NOT NULL AND value != '' AND (value = ? OR value = ?))
      `);
      const settings = settingStmt.all(secureUrl, publicId) as Array<{ key: string; value: string }>;
      for (const s of settings) {
        references.push({
          type: 'branding',
          id: s.key,
          label: `Site Setting: ${s.key}`,
          url: '/admin/settings',
        });
      }
    } catch {}

    // Evaluate usage status
    let status: MediaUsageStatus = 'UNUSED';
    if (references.length > 0) {
      status = 'USED';
    } else if (asset.category === 'gallery' || asset.category === 'branding') {
      status = 'UNKNOWN';
    } else {
      status = 'UNUSED';
    }

    return { status, references };
  }

  /**
   * Backward-compatible pagination method used by legacy media test suite
   */
  public findPaginated(options: { page?: number; limit?: number; search?: string } = {}): {
    items: MediaAssetRecord[];
    total: number;
  } {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = ' WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.search) {
      whereClause += ' AND (LOWER(filename) LIKE LOWER(?) OR LOWER(storage_key) LIKE LOWER(?) OR LOWER(cloudinary_public_id) LIKE LOWER(?) OR LOWER(mime_type) LIKE LOWER(?))';
      const q = `%${options.search}%`;
      params.push(q, q, q, q);
    }

    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM media_assets${whereClause}`);
    const countRow = countStmt.get(...params) as { count: number };
    const total = countRow.count;

    const query = `
      SELECT * FROM media_assets
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const items = this.db.prepare(query).all(...params, limit, offset) as unknown as MediaAssetRecord[];
    return { items, total };
  }

  /**
   * Advanced multi-filter pagination for the Admin Media Library
   */
  public findPaginatedMedia(options: MediaQueryParams = {}): {
    items: EnrichedAdminMediaAsset[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 24));

    let whereClause = ' WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.search && options.search.trim().length > 0) {
      const q = `%${options.search.trim()}%`;
      whereClause += ` AND (
        LOWER(filename) LIKE LOWER(?) OR
        LOWER(original_filename) LIKE LOWER(?) OR
        LOWER(cloudinary_public_id) LIKE LOWER(?) OR
        LOWER(alt_text) LIKE LOWER(?)
      )`;
      params.push(q, q, q, q);
    }

    if (options.category && options.category !== 'all') {
      whereClause += ' AND LOWER(category) = LOWER(?)';
      params.push(options.category);
    }

    if (options.format && options.format !== 'all') {
      whereClause += ' AND (LOWER(format) = LOWER(?) OR LOWER(mime_type) LIKE ?)';
      params.push(options.format, `%${options.format}%`);
    }

    // Sort order validation
    let orderBy = 'ORDER BY created_at DESC';
    switch (options.sort) {
      case 'created_asc':
        orderBy = 'ORDER BY created_at ASC';
        break;
      case 'size_desc':
        orderBy = 'ORDER BY file_size DESC';
        break;
      case 'size_asc':
        orderBy = 'ORDER BY file_size ASC';
        break;
      case 'name_asc':
        orderBy = 'ORDER BY filename ASC';
        break;
      case 'name_desc':
        orderBy = 'ORDER BY filename DESC';
        break;
      default:
        orderBy = 'ORDER BY created_at DESC';
        break;
    }

    // Fetch all candidates matching DB filters to evaluate usage filter if requested
    const allMatching = this.db.prepare(`SELECT * FROM media_assets ${whereClause} ${orderBy}`).all(...params) as unknown as MediaAssetRecord[];

    const enriched: EnrichedAdminMediaAsset[] = allMatching.map((asset) => {
      const usage = this.getAssetUsage(asset);
      return {
        ...asset,
        url: asset.secure_url || `/api/media/file/${asset.storage_key}`,
        usage_status: usage.status,
        references: usage.references,
      };
    });

    // Filter by usage if specified
    const filtered = options.usage && options.usage !== 'all'
      ? enriched.filter((a) => a.usage_status.toLowerCase() === options.usage!.toLowerCase())
      : enriched;

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const items = filtered.slice(offset, offset + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Aggregate facet metrics for the Media Library dashboard banner
   */
  public getMediaFacets(): MediaFacets {
    const all = this.findAll();
    let usedCount = 0;
    let unusedCount = 0;
    let unknownCount = 0;
    let totalBytes = 0;
    const byCategory: Record<string, number> = {
      member: 0,
      project: 0,
      event: 0,
      gallery: 0,
      branding: 0,
      general: 0,
    };

    for (const asset of all) {
      totalBytes += asset.file_size || asset.bytes || 0;
      const cat = (asset.category || 'general').toLowerCase();
      byCategory[cat] = (byCategory[cat] || 0) + 1;

      const usage = this.getAssetUsage(asset);
      if (usage.status === 'USED') usedCount++;
      else if (usage.status === 'UNUSED') unusedCount++;
      else unknownCount++;
    }

    return {
      total: all.length,
      used: usedCount,
      unused: unusedCount,
      unknown: unknownCount,
      totalBytes,
      byCategory,
    };
  }

  public update(id: string, data: Partial<MediaAssetRecord>): MediaAssetRecord | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updated: MediaAssetRecord = {
      ...existing,
      ...data,
      id,
      updated_at: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE media_assets SET
        storage_key = ?, cloudinary_public_id = ?, secure_url = ?, resource_type = ?,
        folder = ?, original_filename = ?, filename = ?, mime_type = ?, file_size = ?,
        width = ?, height = ?, bytes = ?, format = ?, category = ?, alt_text = ?,
        uploaded_by = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.storage_key,
      updated.cloudinary_public_id || null,
      updated.secure_url || null,
      updated.resource_type || null,
      updated.folder || null,
      updated.original_filename || null,
      updated.filename,
      updated.mime_type,
      updated.file_size,
      updated.width || null,
      updated.height || null,
      updated.bytes || null,
      updated.format || null,
      updated.category || 'general',
      updated.alt_text || null,
      updated.uploaded_by || null,
      updated.metadata,
      updated.updated_at || new Date().toISOString(),
      id
    );
    return updated;
  }

  public deleteAsset(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM media_assets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

export const mediaAssetsRepository = new MediaAssetsRepository();
export const mediaRepository = mediaAssetsRepository;
