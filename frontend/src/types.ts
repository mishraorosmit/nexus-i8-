/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppRoute = '/' | '/about' | '/projects' | '/gallery' | '/team' | '/contact';

export interface NavItem {
  label: string;
  href: AppRoute;
  description?: string;
}

export interface Project {
  id: string;
  projectNumber: string; // e.g. "NXS / 001"
  title: string;
  category: 'Technology' | 'Creative Production' | 'Physical Computing' | 'Interactive Systems' | 'Community Tools' | 'Research & Software';
  year: string;
  summary: string;
  description: string;
  disciplines: string; // e.g. "TECH × EDUCATION"
  status: 'Active' | 'Completed' | 'Incubating';
  leadStudents: string[];
  contributors?: Record<string, string[]>;
  tags: string[];
  deliverables?: string[];
  githubUrl?: string;
  demoUrl?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  group:
    | 'MANAGEMENT'
    | 'IDEATION'
    | 'CONTENT'
    | 'COORDINATOR & MENTOR'
    | 'CORE MEMBERS'
    | 'ADVISORS / MENTORS'
    | 'TECH'
    | 'DESIGN'
    | 'MEDIA'
    | 'PROJECTS'
    | 'CORE TEAM'
    | 'HEADS';
  discipline: string;
  yearOfStudy: string;
  bio?: string;
  imageUrl?: string;
  alternateImageUrl?: string;
  imagePosition?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  email?: string;
  socials?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    portfolio?: string;
  };
}

export interface GalleryItem {
  id: string;
  title: string;
  category: 'People' | 'Workshops' | 'Projects' | 'Events' | 'Prototyping' | 'Collaboration' | 'Presentations';
  eventDate: string;
  description: string;
  location?: string;
  caption: string;
  imageUrl?: string;
  author?: string;
  aspectRatio?: '16/9' | '4/3' | '1/1' | '3/2' | '21/9' | 'portrait';
}

export interface ProcessStep {
  stepNumber: string;
  title: string;
  description: string;
  subtitle: string;
  outcome: string;
}
