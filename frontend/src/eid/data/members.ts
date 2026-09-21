import { TeamMember } from '../types';
import membersData from './members.json';
import { resolveImageUrl } from '../../data/cloudinaryMap.ts';

/**
 * Normalizes any raw JSON object or string into a fully compliant TeamMember object.
 * This enables users to pass data simply via a JSON file, API, or query string,
 * immediately outputting the high-fidelity suspended ID card for that person.
 */
export function normalizeMemberJson(input: unknown): TeamMember {
  let raw: Record<string, any> = {};

  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      raw = { name: input };
    }
  } else if (typeof input === 'object' && input !== null) {
    raw = input as Record<string, any>;
  }

  const name = String(raw.name || raw.fullName || 'OPERATIVE').toUpperCase().trim();
  const slug = String(
    raw.slug ||
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ||
      'operative'
  );

  const id = String(raw.uniqueId || raw.id || 'NX-999').toUpperCase();

  const domainStr = Array.isArray(raw.domain)
    ? raw.domain.join(' // ')
    : raw.domain
    ? String(raw.domain)
    : '';

  const designation = String(
    raw.role || raw.designation || raw.title || domainStr || 'SYSTEMS ARCHITECT'
  ).toUpperCase();

  const corePillar = String(
    raw.corePillar || domainStr || raw.group || designation
  ).toUpperCase();

  const departmentRaw = String(raw.department || raw.group || '').toUpperCase();
  const department: TeamMember['department'] =
    departmentRaw.includes('DESIGN') || departmentRaw.includes('CREATIVE')
      ? 'DESIGN'
      : departmentRaw.includes('RESEARCH') || departmentRaw.includes('IDEATION')
      ? 'RESEARCH'
      : 'ENGINEERING';

  const rawPhoto = String(
    raw.photo ||
      raw.image ||
      raw.avatar ||
      '/images/team/orosmit-mishra.webp'
  );
  const photo = resolveImageUrl(rawPhoto);

  const specialWord = String(
    raw.specialWord || raw.keyword || raw.word || 'VISIONARY'
  ).toUpperCase().trim();

  const quote = String(
    raw.quote ||
      raw.bio ||
      raw.whyNexus ||
      raw.message ||
      'Structure is communication. When negative space and physical hierarchy lock into place, clarity becomes visceral.'
  );

  const clearanceLevel = String(raw.clearanceLevel || 'LVL-04 // SPEC');
  const nodeLocation = String(raw.nodeLocation || raw.location || 'NODE 01 // GLOBAL');
  const frequency = String(raw.frequency || '108.40 MHz');
  const securityZone = String(raw.securityZone || 'SEC // ALPHA');
  const badgeIssue = String(raw.badgeIssue || '2026.Q1');
  const qrUrl = String(raw.qrUrl || raw.url || (raw.uniqueId ? `/memberID/${slug}/${raw.uniqueId}` : `/memberID/${slug}`));

  const rawPositioning = raw.positioning || {};
  const positioning = {
    strapHeight: typeof rawPositioning.strapHeight === 'number' ? rawPositioning.strapHeight : 80,
    rotation: typeof rawPositioning.rotation === 'number' ? rawPositioning.rotation : 0,
    offsetY: typeof rawPositioning.offsetY === 'number' ? rawPositioning.offsetY : 0,
    delay: typeof rawPositioning.delay === 'number' ? rawPositioning.delay : 0.1,
    row: rawPositioning.row === 'bottom' ? ('bottom' as const) : ('top' as const),
    slotIndex: typeof rawPositioning.slotIndex === 'number' ? rawPositioning.slotIndex : 1,
  };

  const skills = Array.isArray(raw.skills)
    ? raw.skills.map(String)
    : Array.isArray(raw.domain)
    ? raw.domain.map(String)
    : ['Systems Architecture', 'Tactile Interface'];

  const socials = typeof raw.socials === 'object' && raw.socials !== null ? raw.socials : {};

  return {
    id,
    slug,
    name,
    designation,
    role: designation,
    department,
    corePillar,
    clearanceLevel,
    photo,
    image: photo,
    bio: quote,
    shortBio: quote,
    message: quote,
    whyNexus: quote,
    specialWord,
    quote,
    focus: String(raw.focus || raw.currentFocus || designation),
    currentFocus: String(raw.currentFocus || raw.focus || designation),
    funFact: String(raw.funFact || 'Pioneering tactile design engineering.'),
    qrUrl,
    nodeLocation,
    frequency,
    securityZone,
    badgeIssue,
    skills,
    socials,
    positioning,
  };
}

/**
 * The canonical 26 team members loaded directly from JSON data as fallback / offline cache.
 */
export const teamMembers: TeamMember[] = (membersData as any[]).map(normalizeMemberJson);

/**
 * Returns canonical route for a member
 */
export function getMemberRoute(member: TeamMember): string {
  return `/memberID/${member.slug}/${member.id}`;
}

/**
 * Helper to look up a member by slug, ID, or name part
 */
export function getMemberBySlug(slug: string): TeamMember | undefined {
  if (!slug) return undefined;
  const clean = slug.toLowerCase().trim();

  // 1. Direct slug match
  const directMatch = teamMembers.find((m) => m.slug.toLowerCase() === clean);
  if (directMatch) return directMatch;

  // 2. ID match ("nx-026", "nx026", "026", "24", "nx-001", "001", "1")
  const idMatch = teamMembers.find((m) => {
    const rawId = m.id.toLowerCase();
    const strippedId = rawId.replace('-', '');
    const numOnly = rawId.replace('nx-', '');
    const parsedNum = parseInt(numOnly, 10).toString();
    return (
      rawId === clean ||
      strippedId === clean ||
      numOnly === clean ||
      parsedNum === clean ||
      clean === `member-${numOnly}` ||
      clean === `member-${parsedNum}`
    );
  });
  if (idMatch) return idMatch;

  // 3. Designation or name part match
  return teamMembers.find((m) => {
    const desigSlug = m.designation.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const nameParts = m.name.toLowerCase().split(' ');
    return (
      desigSlug.includes(clean) ||
      clean.includes(desigSlug) ||
      nameParts.some((part) => part === clean)
    );
  });
}

/**
 * Export a member object to formatted JSON string
 */
export function exportMemberAsJson(member: TeamMember): string {
  return JSON.stringify(member, null, 2);
}

/**
 * Generates a full shareable deep link URL for a member's badge
 */
export function getMemberShareUrl(member: TeamMember): string {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  return `${origin}/memberID/${member.slug}/${member.id}`;
}
