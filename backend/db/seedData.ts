import { PROJECTS, TEAM_MEMBERS, GALLERY_ITEMS } from '../../frontend/src/data/nexusData.ts';
import type { TeamMember, Project, GalleryItem } from '../../frontend/src/types.ts';

export interface EventItem {
  id: string;
  title: string;
  type: 'Workshop' | 'Showcase' | 'OpenStudio' | 'Meeting';
  date: string;
  time: string;
  location: string;
  description: string;
  status: 'Upcoming' | 'Completed';
  rsvpUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  priority: 'Normal' | 'Urgent';
  active: boolean;
  publishedAt: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  category: 'Guide' | 'Schematic' | 'DesignSystem' | 'StarterKit';
  description: string;
  url: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteConfigItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  currentTerm: string;
  cohortYear: string;
  contactEmail: string;
  socials: {
    github: string;
    instagram?: string;
    linkedin?: string;
  };
  openSessions: {
    day: string;
    time: string;
    location: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  role: 'SuperAdmin' | 'Editor';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const SEED_PROJECTS: Project[] = PROJECTS;
export const SEED_MEMBERS: TeamMember[] = TEAM_MEMBERS;
export const SEED_ARCHIVE: GalleryItem[] = GALLERY_ITEMS;

export const SEED_EVENTS: EventItem[] = [
  {
    id: 'evt-001',
    title: 'NEXUS Studio Open Sprint: Hardware & Interface Lab',
    type: 'OpenStudio',
    date: 'OCT 24, 2026',
    time: '18:00 - 21:00',
    location: 'SOA Main Lab // Room 304',
    description: 'Hands-on exploration of sensory computing, micro-controllers, and digital layout tools.',
    status: 'Upcoming',
    rsvpUrl: 'https://nexus.campus/events/open-studio',
  },
  {
    id: 'evt-002',
    title: 'Algorithmic Visuals & Creative Code Showcase',
    type: 'Showcase',
    date: 'NOV 12, 2026',
    time: '17:30 - 20:30',
    location: 'Engineering Atrium',
    description: 'Public exhibition of projects built during the Autumn ideation cycle.',
    status: 'Upcoming',
  },
  {
    id: 'evt-003',
    title: 'Typographic Hierarchy & Editorial Web Workshop',
    type: 'Workshop',
    date: 'DEC 04, 2026',
    time: '16:00 - 18:30',
    location: 'Design Studio Lab 2',
    description: 'Practical deep dive into variable fonts, fluid typography, and CSS layout algorithms.',
    status: 'Upcoming',
  },
];

export const SEED_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann-001',
    title: 'Spring 2027 Cohort Applications Now Open',
    content: 'Student project leads, interface designers, and hardware tinkerers are invited to apply for open sprint teams.',
    priority: 'Normal',
    active: true,
    publishedAt: new Date().toISOString(),
  },
  {
    id: 'ann-002',
    title: 'Studio Open Hours: Tuesdays & Thursdays',
    content: 'The studio lab is accessible to all multidisciplinary student teams from 18:00 to 21:00.',
    priority: 'Normal',
    active: true,
    publishedAt: new Date().toISOString(),
  },
];

export const SEED_RESOURCES: ResourceItem[] = [
  {
    id: 'res-001',
    title: 'NEXUS Interface Tokens & Typography Primer',
    category: 'DesignSystem',
    description: 'Standardized design tokens, warm paper palettes, and editorial layout standards.',
    url: 'https://github.com/nexus-club/design-tokens',
    tags: ['Design System', 'Typography', 'Tokens'],
  },
  {
    id: 'res-002',
    title: 'Voxen MIDI Hardware Schematics & Firmware',
    category: 'Schematic',
    description: 'CAD models, PCB schematics, and Arduino C++ firmware for capacitive MIDI controllers.',
    url: 'https://github.com/nexus-club/voxen-midi',
    tags: ['Hardware', 'CAD', 'Firmware', 'C++'],
  },
  {
    id: 'res-003',
    title: 'Canvas & Shader Animation Starter Template',
    category: 'StarterKit',
    description: 'Minimal zero-dependency starter for high-performance interactive generative graphics.',
    url: 'https://github.com/nexus-club/algolog',
    tags: ['Canvas', 'TypeScript', 'Animation'],
  },
];

export const SEED_SITE_CONFIG: SiteConfigItem = {
  id: 'site-config-default',
  name: 'NEXUS',
  tagline: 'Student Innovation & Project Building Community',
  description: 'A student-led college community for ideation, collaboration, technology, creative production, and project building.',
  currentTerm: 'Autumn 2026 — Spring 2027',
  cohortYear: '2026/2027',
  contactEmail: 'contact@nexus.campus',
  socials: {
    github: 'https://github.com/nexushuborg',
    instagram: 'https://www.instagram.com/nexusfordev',
  },
  openSessions: {
    day: 'Tuesdays & Thursdays',
    time: '18:00 - 21:00',
    location: 'SOA Main Lab // Room 304',
  },
};

export const SEED_ADMIN_USERS: AdminUserItem[] = [
  {
    id: 'admin-001',
    email: 'admin@nexus.campus',
    role: 'SuperAdmin',
    isActive: true,
  },
];
