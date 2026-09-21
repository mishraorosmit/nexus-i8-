import { membersRepository, MemberRecord } from '../../db/repositories/members.repository.ts';

export interface PublicMemberDto {
  id: string;
  publicId: string;
  slug?: string;
  uniqueId?: string | null;
  name: string;
  displayName?: string | null;
  role: string;
  department?: string;
  domain: string | null;
  bio: string | null;
  photoUrl: string | null;
  imageUrl?: string | null;
  imagePosition: string | null;
  socials: Record<string, string> | null;
  status: 'active' | 'alumni' | 'inactive' | 'ACTIVE' | 'ALUMNI' | 'INACTIVE';
  joinedDate: string | null;
  createdAt: string;
}

export function formatPublicMember(record: MemberRecord): PublicMemberDto {
  let socials: Record<string, string> | null = null;
  if (record.social_links) {
    try {
      socials = JSON.parse(record.social_links);
    } catch {
      socials = null;
    }
  }

  const photo = record.profile_image_url || record.photo_url || null;

  return {
    id: record.unique_id || record.public_id,
    publicId: record.public_id,
    slug: record.slug || record.public_id,
    uniqueId: record.unique_id || null,
    name: record.name,
    displayName: record.display_name || record.name,
    role: record.role,
    department: record.department || 'Engineering',
    domain: record.domain,
    bio: record.bio,
    photoUrl: photo,
    imageUrl: photo,
    imagePosition: record.image_position,
    socials,
    status: record.status,
    joinedDate: record.joined_date,
    createdAt: record.created_at,
  };
}

export class MembersService {
  public async getPaginatedMembers(options: {
    page: number;
    limit: number;
    offset: number;
    role?: string;
    domain?: string;
    search?: string;
    status?: string;
  }): Promise<{ items: PublicMemberDto[]; total: number }> {
    const { items, total } = membersRepository.findPaginated({
      status: options.status || 'active',
      role: options.role,
      domain: options.domain,
      search: options.search,
      offset: options.offset,
      limit: options.limit,
    });

    return {
      items: items.map(formatPublicMember),
      total,
    };
  }

  public async getMemberByPublicId(identifier: string): Promise<PublicMemberDto | null> {
    const record = membersRepository.findByIdentifier(identifier);
    return record ? formatPublicMember(record) : null;
  }

  public async getMemberByUniqueId(uniqueId: string): Promise<PublicMemberDto | null> {
    const record = membersRepository.findByUniqueId(uniqueId);
    return record ? formatPublicMember(record) : null;
  }
}

export const membersService = new MembersService();

