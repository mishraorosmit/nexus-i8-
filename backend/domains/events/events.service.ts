import { eventsRepository, EventRecord } from '../../db/repositories/events.repository.ts';

export interface PublicEventDto {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string;
  eventType: string;
  date: string;
  time: string;
  eventStart: string | null;
  eventEnd: string | null;
  venue: string;
  location: string;
  registrationUrl: string | null;
  registrationEnabled: boolean;
  registrationOpen: boolean;
  capacity: number | null;
  capacityRemaining: number | null;
  isFull: boolean;
  coverImage: string | null;
  coverImageUrl: string | null;
  featured: boolean;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function formatPublicEvent(record: EventRecord): PublicEventDto {
  const now = new Date().toISOString();
  const confirmed = record.confirmed_count || 0;
  const hasCapacity = typeof record.capacity === 'number' && record.capacity > 0;
  const isFull = hasCapacity && confirmed >= (record.capacity as number);
  const capacityRemaining = hasCapacity ? Math.max(0, (record.capacity as number) - confirmed) : null;

  const isWithinWindow =
    (!record.registration_start || now >= record.registration_start) &&
    (!record.registration_end || now <= record.registration_end);

  const registrationOpen =
    record.registration_enabled === 1 &&
    record.registration_status !== 'CLOSED' &&
    !isFull &&
    isWithinWindow &&
    record.status !== 'Completed' &&
    record.status !== 'Cancelled' &&
    record.status !== 'Draft' &&
    record.status !== 'Archived';

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    shortDescription: record.short_description || (record.description ? record.description.substring(0, 160) : null),
    description: record.description,
    eventType: record.event_type,
    date: record.event_date || (record.event_start ? record.event_start.split('T')[0] : ''),
    time: record.event_time || (record.event_start ? record.event_start.split('T')[1]?.substring(0, 5) : '18:00'),
    eventStart: record.event_start,
    eventEnd: record.event_end,
    venue: record.venue || record.location || 'SOA Lab',
    location: record.location || record.venue || 'SOA Lab',
    registrationUrl: record.registration_url,
    registrationEnabled: record.registration_enabled === 1,
    registrationOpen,
    capacity: record.capacity !== undefined ? record.capacity : null,
    capacityRemaining,
    isFull,
    coverImage: record.cover_image || record.cover_image_url,
    coverImageUrl: record.cover_image_url || record.cover_image,
    featured: record.featured === 1,
    status: record.status,
    publishedAt: record.published_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export class EventsService {
  public async getPaginatedEvents(options: {
    page: number;
    limit: number;
    offset: number;
    status?: string;
    type?: string;
    year?: string;
    featured?: boolean;
  }): Promise<{ items: PublicEventDto[]; total: number }> {
    const { items, total } = eventsRepository.findPaginated({
      status: options.status,
      event_type: options.type,
      year: options.year,
      featured: options.featured,
      offset: options.offset,
      limit: options.limit,
    });

    return {
      items: items.map(formatPublicEvent),
      total,
    };
  }

  public async getUpcomingEvents(): Promise<PublicEventDto[]> {
    const records = eventsRepository.findUpcoming();
    return records.map(formatPublicEvent);
  }

  public async getPastEvents(): Promise<PublicEventDto[]> {
    const records = eventsRepository.findPast();
    return records.map(formatPublicEvent);
  }

  public async getFeaturedEvents(): Promise<PublicEventDto[]> {
    const records = eventsRepository.findFeatured();
    return records.map(formatPublicEvent);
  }

  public async getEventBySlug(slug: string): Promise<PublicEventDto | null> {
    const record = eventsRepository.findBySlug(slug);
    if (!record) return null;
    // Strict isolation: drafts and archived events are NEVER exposed on public endpoint
    if (record.status.toLowerCase() === 'draft' || record.status.toLowerCase() === 'archived') {
      return null;
    }
    return formatPublicEvent(record);
  }
}

export const eventsService = new EventsService();
