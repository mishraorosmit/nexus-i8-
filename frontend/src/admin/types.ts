/**
 * Types for NEXUS Admin Portal
 */

export type AdminRoute =
  | '/admin'
  | '/admin/login'
  | '/admin/members'
  | '/admin/projects'
  | '/admin/media'
  | '/admin/audit'
  | '/admin/settings';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'content_admin';
  status: 'active' | 'inactive' | 'suspended';
  last_login_at: string | null;
  created_at: string;
}

export interface AdminSession {
  sessionId: string;
  expiresAt: string;
}

export interface AdminAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AdminUser | null;
  role: string | null;
  permissions: string[];
  session: AdminSession | null;
  error: string | null;
}

export interface NavItemConfig {
  id: string;
  label: string;
  path: AdminRoute;
  isReserved: boolean;
  description: string;
  apiEndpoint: string;
}

export interface SystemOverviewStats {
  members: number;
  projects: number;
  events: number;
  media: number;
  announcements: number;
  dbStatus: string;
  storageStatus: string;
  uptime: number;
}

export interface AdminDashboardData {
  members: {
    total: number;
    active: number;
    inactive: number;
    alumni: number;
  };
  projects?: {
    total: number;
  };
}

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'ALUMNI' | 'active' | 'inactive' | 'alumni';

export interface AdminMember {
  id: string;
  public_id: string;
  slug: string;
  unique_id: string | null;
  name: string;
  display_name?: string | null;
  email: string | null;
  role: string;
  domain: string | null;
  department?: string | null;
  bio: string | null;
  photo_url: string | null;
  profile_image_url?: string | null;
  profile_image_public_id?: string | null;
  image_position?: string | null;
  social_links?: Record<string, string> | string | null;
  status: MemberStatus;
  joined_date: string | null;
  joined_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMemberInput {
  name: string;
  displayName?: string;
  email?: string;
  role: string;
  domain?: string;
  department?: string;
  bio?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALUMNI';
  uniqueId?: string;
  slug?: string;
  joinedAt?: string;
  photoUrl?: string;
}

export interface UpdateMemberInput {
  name?: string;
  displayName?: string;
  email?: string;
  role?: string;
  domain?: string;
  department?: string;
  bio?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALUMNI';
  slug?: string;
  joinedAt?: string;
  photoUrl?: string;
  expectedUpdatedAt?: string;
}

export interface AdminMemberQueryParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  q?: string;
  status?: string;
  role?: string;
  domain?: string;
  department?: string;
  sort?: string;
}

export interface AdminMemberFilterFacets {
  roles: string[];
  domains: string[];
  departments: string[];
  statuses: string[];
}

export type AuditLogAction =
  | 'MEMBER_CREATED'
  | 'MEMBER_UPDATED'
  | 'MEMBER_STATUS_CHANGED'
  | 'MEMBER_DELETED'
  | 'IMAGE_UPLOADED'
  | 'IMAGE_REPLACED'
  | 'IMAGE_REMOVED'
  | 'BULK_IMPORT'
  | 'SETTINGS_CHANGED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGED'
  | string;

export interface AuditLogAdminContext {
  adminId?: string | null;
  adminName?: string;
  adminRole?: string;
  actor?: string;
  [key: string]: unknown;
}

export interface AuditLogItem {
  id: string;
  admin_id: string | null;
  admin_name: string | null;
  admin_role: string | null;
  action: AuditLogAction;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  admin_context: AuditLogAdminContext | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface AuditLogPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AuditLogResponse {
  success: boolean;
  data: AuditLogItem[];
  meta: AuditLogPaginationMeta;
}

export type AdminSettingCategory = 'general' | 'identity' | 'operations';
export type AdminSettingType = 'string' | 'boolean' | 'number' | 'json';

export interface AdminSettingSchemaItem {
  key: string;
  label: string;
  category: AdminSettingCategory;
  description: string;
  type: AdminSettingType;
  defaultValue: any;
}

export type AdminSettingsMap = Record<string, any>;

export interface AdminSettingsData {
  settings: AdminSettingsMap;
  schema: AdminSettingSchemaItem[];
}

export type ProjectStatus = 'Draft' | 'Published' | 'Archived' | 'Active' | 'Completed' | 'Incubating';

export interface AdminProjectMember {
  project_id?: string;
  member_id: string;
  public_id?: string;
  slug?: string;
  unique_id?: string;
  name: string;
  role: string | null;
  photo_url?: string | null;
  profile_image_url?: string | null;
}

export interface AdminProject {
  id: string;
  slug: string;
  project_number: string | null;
  title: string;
  category: string;
  year: string;
  short_description: string;
  full_description: string;
  disciplines: string;
  status: ProjectStatus | string;
  featured: boolean;
  technologies: string[];
  deliverables: string[];
  cover_image: string | null;
  cover_image_url?: string | null;
  cover_image_public_id?: string | null;
  demo_url: string | null;
  live_url?: string | null;
  repository_url: string | null;
  documentation_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  published_at?: string | null;
  members?: AdminProjectMember[];
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  title: string;
  slug?: string;
  projectNumber?: string;
  category: string;
  year?: string;
  shortDescription: string;
  fullDescription?: string;
  disciplines?: string;
  status?: ProjectStatus | string;
  featured?: boolean;
  technologies?: string[];
  deliverables?: string[];
  coverImageUrl?: string;
  coverImage?: string;
  liveUrl?: string;
  demoUrl?: string;
  repositoryUrl?: string;
  documentationUrl?: string;
  startDate?: string;
  endDate?: string;
  members?: Array<{ memberId: string; role?: string }>;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  expected_updated_at?: string;
}

export interface AdminProjectQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  featured?: boolean;
  search?: string;
  sort?: string;
}

export type MediaCategory = 'member' | 'project' | 'event' | 'gallery' | 'branding' | 'general';
export type MediaUsageStatus = 'USED' | 'UNUSED' | 'UNKNOWN';

export interface MediaReferenceItem {
  type: 'member' | 'project' | 'event' | 'branding';
  id: string;
  label: string;
  url?: string;
}

export interface AdminMediaAsset {
  id: string;
  storage_key: string;
  cloudinary_public_id?: string | null;
  secure_url?: string | null;
  url: string;
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
  category: MediaCategory | string;
  alt_text?: string | null;
  uploaded_by?: string | null;
  usage_status: MediaUsageStatus;
  references: MediaReferenceItem[];
  created_at: string;
  updated_at?: string | null;
}

export interface AdminMediaQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  format?: string;
  usage?: string;
  sort?: string;
}

export interface AdminMediaFacets {
  total: number;
  used: number;
  unused: number;
  unknown: number;
  totalBytes: number;
  byCategory: Record<string, number>;
}

