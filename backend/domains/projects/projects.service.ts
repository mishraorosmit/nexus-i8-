import {
  projectsRepository,
  ProjectRecord,
  ProjectMemberSummary,
} from '../../db/repositories/projects.repository.ts';

export interface PublicProjectDto {
  id: string;
  slug: string;
  projectNumber: string | null;
  title: string;
  category: string;
  year: string;
  summary: string;
  description: string;
  disciplines: string;
  status: 'Active' | 'Completed' | 'Incubating' | 'Draft' | 'Published' | 'Archived' | string;
  featured: boolean;
  technologies: string[];
  deliverables: string[];
  coverImage: string | null;
  coverImageUrl?: string | null;
  demoUrl: string | null;
  liveUrl?: string | null;
  repositoryUrl: string | null;
  documentationUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  publishedAt?: string | null;
  members?: Array<{
    id: string;
    publicId: string;
    slug?: string;
    uniqueId?: string;
    name: string;
    role: string | null;
    photoUrl: string | null;
    profileImageUrl?: string | null;
  }>;
  relatedEvents?: Array<{
    id: string;
    title: string;
    date: string;
    type: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export function formatPublicProject(
  record: ProjectRecord,
  members?: ProjectMemberSummary[],
  relatedEvents?: Array<{ id: string; title: string; event_date: string; event_type: string }>
): PublicProjectDto {
  let tech: string[] = [];
  try {
    tech = JSON.parse(record.technologies || '[]');
  } catch {
    tech = [];
  }

  let deliverables: string[] = [];
  if (record.deliverables) {
    try {
      deliverables = JSON.parse(record.deliverables);
    } catch {
      deliverables = [];
    }
  }

  const cover = record.cover_image_url || record.cover_image || null;
  const live = record.live_url || record.demo_url || null;

  return {
    id: record.id,
    slug: record.slug,
    projectNumber: record.project_number,
    title: record.title,
    category: record.category,
    year: record.year,
    summary: record.short_description,
    description: record.full_description,
    disciplines: record.disciplines,
    status: record.status,
    featured: record.featured === 1,
    technologies: tech,
    deliverables,
    coverImage: cover,
    coverImageUrl: cover,
    demoUrl: live,
    liveUrl: live,
    repositoryUrl: record.repository_url,
    documentationUrl: record.documentation_url || null,
    startDate: record.start_date || null,
    endDate: record.end_date || null,
    publishedAt: record.published_at || null,
    ...(members
      ? {
          members: members.map((m) => ({
            id: m.member_id,
            publicId: m.public_id,
            slug: m.slug || m.public_id,
            uniqueId: m.unique_id,
            name: m.name,
            role: m.role,
            photoUrl: m.profile_image_url || m.photo_url,
            profileImageUrl: m.profile_image_url || m.photo_url,
          })),
        }
      : {}),
    ...(relatedEvents
      ? {
          relatedEvents: relatedEvents.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.event_date,
            type: e.event_type,
          })),
        }
      : {}),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export class ProjectsService {
  public async getPaginatedProjects(options: {
    page: number;
    limit: number;
    offset: number;
    category?: string;
    status?: string;
    technology?: string;
    featured?: boolean;
    search?: string;
  }): Promise<{ items: PublicProjectDto[]; total: number }> {
    const { items, total } = projectsRepository.findPaginated({
      category: options.category,
      status: options.status,
      technology: options.technology,
      featured: options.featured,
      search: options.search,
      offset: options.offset,
      limit: options.limit,
    });

    // Batch load members for all retrieved projects to prevent N+1 queries
    const projectIds = items.map((p) => p.id);
    const membersMap = projectsRepository.getMembersForProjects(projectIds);

    const dtoList = items.map((record) => {
      const members = membersMap.get(record.id) || [];
      return formatPublicProject(record, members);
    });

    return { items: dtoList, total };
  }

  public async getFeaturedProjects(): Promise<PublicProjectDto[]> {
    const records = projectsRepository.findFeatured();
    const projectIds = records.map((p) => p.id);
    const membersMap = projectsRepository.getMembersForProjects(projectIds);

    return records.map((record) => {
      const members = membersMap.get(record.id) || [];
      return formatPublicProject(record, members);
    });
  }

  public async getProjectBySlug(slug: string): Promise<PublicProjectDto | null> {
    const record = projectsRepository.findBySlug(slug);
    if (!record) return null;

    const status = (record.status || '').toLowerCase();
    if (status === 'draft' || status === 'archived') {
      return null;
    }

    const members = projectsRepository.getMembers(record.id);
    const relatedEvents = projectsRepository.getRelatedEvents(record.id);

    return formatPublicProject(record, members, relatedEvents);
  }

  public async getProjectMembers(slug: string) {
    const record = projectsRepository.findBySlug(slug);
    if (!record) return null;

    const status = (record.status || '').toLowerCase();
    if (status === 'draft' || status === 'archived') {
      return null;
    }

    return projectsRepository.getMembers(record.id).map((m) => ({
      id: m.member_id,
      publicId: m.public_id,
      name: m.name,
      role: m.role,
      photoUrl: m.photo_url,
    }));
  }

  public async getProjectRelatedEvents(slug: string) {
    const record = projectsRepository.findBySlug(slug);
    if (!record) return null;
    return projectsRepository.getRelatedEvents(record.id).map((e) => ({
      id: e.id,
      title: e.title,
      date: e.event_date,
      type: e.event_type,
    }));
  }
}

export const projectsService = new ProjectsService();
