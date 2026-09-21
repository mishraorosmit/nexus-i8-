import { announcementsRepository, AnnouncementRecord } from '../../db/repositories/announcements.repository.ts';

export interface PublicAnnouncementDto {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  priority: 'Normal' | 'Urgent';
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function formatPublicAnnouncement(record: AnnouncementRecord): PublicAnnouncementDto {
  return {
    id: record.id,
    slug: record.slug || record.id,
    title: record.title,
    summary: record.summary,
    body: record.body,
    priority: record.priority,
    publishedAt: record.published_at,
    expiresAt: record.expires_at,
    createdAt: record.created_at,
  };
}

export class AnnouncementsService {
  public async getPublishedAnnouncements(options: {
    page: number;
    limit: number;
    offset: number;
  }): Promise<{ items: PublicAnnouncementDto[]; total: number }> {
    const { items, total } = announcementsRepository.findPublishedPaginated({
      offset: options.offset,
      limit: options.limit,
    });

    return {
      items: items.map(formatPublicAnnouncement),
      total,
    };
  }

  public async getPublishedAnnouncementById(identifier: string): Promise<PublicAnnouncementDto | null> {
    const record = announcementsRepository.findPublishedByIdOrSlug(identifier);
    return record ? formatPublicAnnouncement(record) : null;
  }
}

export const announcementsService = new AnnouncementsService();
