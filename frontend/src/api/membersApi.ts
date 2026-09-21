/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TeamMember } from '../types.ts';
import { TEAM_MEMBERS } from '../data/nexusData.ts';
import { resolveImageUrl } from '../data/cloudinaryMap.ts';

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

export interface PublicMembersApiResponse {
  data: PublicMemberDto[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  } | null;
  error: null;
}

/**
 * Maps a public member DTO from SQLite to the public website TeamMember schema.
 */
export function mapDtoToTeamMember(dto: PublicMemberDto): TeamMember {
  const roleUpper = (dto.role || '').toUpperCase();
  const deptUpper = (dto.department || '').toUpperCase();
  const domainUpper = (dto.domain || '').toUpperCase();

  // Derive squad / group
  let group: TeamMember['group'] = 'CORE MEMBERS';
  if (roleUpper.includes('COORDINATOR') || roleUpper.includes('MENTOR')) {
    group = 'COORDINATOR & MENTOR';
  } else if (roleUpper.includes('HEAD') || roleUpper.includes('VICE')) {
    group = 'HEADS';
  } else if (deptUpper === 'MANAGEMENT' || roleUpper.includes('MANAGEMENT') || domainUpper.includes('MANAGEMENT')) {
    group = 'MANAGEMENT';
  } else if (deptUpper === 'IDEATION' || roleUpper.includes('IDEATION') || domainUpper.includes('IDEATION')) {
    group = 'IDEATION';
  } else if (deptUpper === 'CONTENT' || roleUpper.includes('CONTENT') || domainUpper.includes('CONTENT')) {
    group = 'CONTENT';
  } else if (deptUpper === 'TECH' || deptUpper === 'ENGINEERING' || roleUpper.includes('TECH') || domainUpper.includes('ENGINEERING')) {
    group = 'TECH';
  } else if (deptUpper === 'DESIGN' || roleUpper.includes('DESIGN') || domainUpper.includes('DESIGN')) {
    group = 'DESIGN';
  }

  // Derive display year of study
  let yearOfStudy = 'Member // 2026';
  if (roleUpper.includes('COORDINATOR')) {
    yearOfStudy = 'Coordinator';
  } else if (roleUpper.includes('MENTOR')) {
    yearOfStudy = 'Mentor';
  } else if (roleUpper.includes('HEAD') || roleUpper.includes('VICE')) {
    yearOfStudy = 'Lead // 2026';
  } else if (group === 'MANAGEMENT') {
    yearOfStudy = 'Junior // 2027';
  } else if (dto.joinedDate) {
    const year = new Date(dto.joinedDate).getFullYear();
    yearOfStudy = !isNaN(year) ? `Class // ${year}` : 'Member // 2026';
  }

  // Canonical Cloudinary photo resolution
  const rawPhoto = dto.imageUrl || dto.photoUrl || '';
  const imageUrl = rawPhoto ? resolveImageUrl(rawPhoto) : undefined;

  return {
    id: dto.uniqueId || dto.publicId || dto.slug || dto.id,
    name: (dto.displayName || dto.name).toUpperCase(),
    role: dto.role,
    group,
    discipline: dto.domain || dto.department || 'Creative Technology & Studio Operations',
    yearOfStudy,
    bio: dto.bio || undefined,
    imageUrl,
    imagePosition: dto.imagePosition || 'center 20%',
    socials: dto.socials || undefined,
    githubUrl: dto.socials?.github,
    linkedinUrl: dto.socials?.linkedin,
  };
}

let cachedMembers: TeamMember[] | null = null;
let inFlightPromise: Promise<TeamMember[]> | null = null;

/**
 * Clears the in-memory cache, forcing the next fetch to query the live API.
 */
export function clearPublicMembersCache(): void {
  cachedMembers = null;
  inFlightPromise = null;
}

/**
 * Fetches all active members from the SQLite-backed public members API (/api/members?limit=100).
 * Implements deduplication and resilient fallback to bundled static data if network is unavailable.
 */
export async function fetchPublicMembers(forceRefresh = false): Promise<TeamMember[]> {
  if (!forceRefresh && cachedMembers) {
    return cachedMembers;
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch('/api/members?limit=100', {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Public members API responded with status ${response.status}`);
      }

      const json = (await response.json()) as PublicMembersApiResponse;
      if (!json || !Array.isArray(json.data) || json.data.length === 0) {
        throw new Error('Public members API returned empty or invalid data array');
      }

      // Map real SQLite records to TeamMember format
      const liveMembers = json.data.map(mapDtoToTeamMember);
      cachedMembers = liveMembers;
      return liveMembers;
    } catch (err) {
      console.warn('[PublicMembersApi] Failed to fetch live members from SQLite API; using fallback data:', err);
      // Fallback preserves 100% functionality if backend is unreachable during dev/tests
      return TEAM_MEMBERS;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}
