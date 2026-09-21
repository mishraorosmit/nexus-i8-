import { membersRepository, MemberRecord } from '../../db/repositories/members.repository.ts';
import { EidCardMemberDto, EidMemberStatus } from './eid.types.ts';
import { settingsService } from '../../services/settings.service.ts';

export function formatEidCardMember(record: MemberRecord): EidCardMemberDto {
  let socials: Record<string, string> | null = null;
  if (record.social_links) {
    try {
      socials = JSON.parse(record.social_links);
    } catch {
      socials = null;
    }
  }

  let skills: string[] = [];
  if (record.skills) {
    try {
      skills = JSON.parse(record.skills);
    } catch {
      skills = [];
    }
  }

  // Parse domain string into array
  let domainArray: string[] = [];
  if (record.domain) {
    if (record.domain.startsWith('[') && record.domain.endsWith(']')) {
      try {
        domainArray = JSON.parse(record.domain);
      } catch {
        domainArray = [record.domain];
      }
    } else {
      domainArray = record.domain.split(',').map((d) => d.trim()).filter(Boolean);
    }
  }

  // Normalize status
  const rawStatus = (record.status || 'ACTIVE').toUpperCase();
  const status: EidMemberStatus =
    rawStatus === 'INACTIVE' ? 'INACTIVE' : rawStatus === 'ALUMNI' ? 'ALUMNI' : 'ACTIVE';

  const uniqueId = record.unique_id || 'NX-000';
  const slug = record.slug || record.public_id;

  return {
    uniqueId,
    slug,
    name: record.name,
    displayName: record.display_name || record.name,
    role: record.role,
    department: record.department || 'Engineering',
    domain: domainArray,
    image: record.profile_image_url || record.photo_url || null,
    bio: record.bio || null,
    status,
    clearanceLevel: record.clearance_level || 'LVL-03 // SPEC',
    specialWord: record.special_word || 'VISIONARY',
    quote: record.quote || null,
    nodeLocation: record.node_location || 'SOA LAB 204 // BHUBANESWAR',
    frequency: record.frequency || '108.40 MHz',
    securityZone: record.security_zone || 'SEC // ALPHA',
    badgeIssue: record.badge_issue || '2026.Q1',
    skills,
    socials,
    qrUrl: (() => {
      const baseUrl = settingsService.getSetting<string>('eid_base_url') || '';
      const canonicalRoute = `/memberID/${slug}/${uniqueId}`;
      return baseUrl ? `${baseUrl}${canonicalRoute}` : canonicalRoute;
    })(),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export class EidService {
  public async getAllMembers(): Promise<{ items: EidCardMemberDto[]; total: number }> {
    const all = membersRepository.findAll({ status: 'all' });
    // Filter only records that have a unique_id or are active members
    const items = all.map(formatEidCardMember);
    return {
      items,
      total: items.length,
    };
  }

  public async getMemberByIdentifier(identifier: string): Promise<EidCardMemberDto | null> {
    const record = membersRepository.findByIdentifier(identifier);
    return record ? formatEidCardMember(record) : null;
  }

  public async getMemberBySlugAndUniqueId(slug: string, uniqueId: string): Promise<EidCardMemberDto | null> {
    const record = membersRepository.findBySlugAndUniqueId(slug, uniqueId);
    return record ? formatEidCardMember(record) : null;
  }
}

export const eidService = new EidService();
