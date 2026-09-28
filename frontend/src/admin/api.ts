/**
 * NEXUS Admin Portal API Service
 * Handles server-side session authentication with secure HttpOnly cookies.
 * No secrets or tokens are stored in localStorage or sessionStorage.
 */

import {
  AdminUser,
  AdminSession,
  SystemOverviewStats,
  AdminDashboardData,
  AdminMember,
  CreateMemberInput,
  UpdateMemberInput,
  AdminMemberQueryParams,
  AdminMemberFilterFacets,
  AuditLogItem,
  AuditLogFilters,
  AuditLogPaginationMeta,
  AdminSettingsData,
  AdminSettingsMap,
  AdminProject,
  AdminProjectMember,
  CreateProjectInput,
  UpdateProjectInput,
  AdminProjectQueryParams,
  ProjectStatus,
  AdminMediaAsset,
  AdminMediaQueryParams,
  AdminMediaFacets,
  MediaCategory,
} from './types.ts';

const API_BASE = '/api';

interface ApiResponse<T> {
  data: T | null;
  meta: any;
  error: {
    code: string;
    message: string;
    details?: any;
  } | null;
}

export async function adminLogin(password: string): Promise<{
  success: boolean;
  user?: AdminUser;
  expiresAt?: string;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });

    const body: ApiResponse<{ user: AdminUser; expiresAt: string }> = await res.json();

    if (!res.ok || body.error) {
      return {
        success: false,
        error: body.error?.message || 'Authentication failed. Please verify your password.',
        code: body.error?.code || 'AUTH_ERROR',
      };
    }

    return {
      success: true,
      user: body.data?.user,
      expiresAt: body.data?.expiresAt,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Cannot reach backend server. Please verify backend service on port 3001 is running.',
      code: 'NETWORK_ERROR',
    };
  }
}

export async function adminCheckSession(): Promise<{
  success: boolean;
  user?: AdminUser;
  role?: string;
  permissions?: string[];
  session?: AdminSession;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        error: 'Unauthenticated session',
      };
    }

    const body: ApiResponse<{
      user: AdminUser;
      role: string;
      permissions: string[];
      session: AdminSession;
    }> = await res.json();

    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        error: body.error?.message || 'Session verification failed',
      };
    }

    return {
      success: true,
      user: body.data.user,
      role: body.data.role,
      permissions: body.data.permissions,
      session: body.data.session,
    };
  } catch {
    return {
      success: false,
      error: 'Network error verifying session',
    };
  }
}

export async function adminLogout(): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/admin/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

export async function adminGetDashboardStats(): Promise<SystemOverviewStats> {
  try {
    // Probe health check for database and storage telemetry
    const healthRes = await fetch(`${API_BASE}/health`, { credentials: 'include' });
    const health = await healthRes.json().catch(() => ({}));

    // Probe counts across available admin domains
    const [membersRes, projectsRes, eventsRes, mediaRes, announcementsRes] = await Promise.allSettled([
      fetch(`${API_BASE}/admin/members?limit=1`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`${API_BASE}/admin/projects?limit=1`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`${API_BASE}/admin/events?limit=1`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`${API_BASE}/admin/media?limit=1`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`${API_BASE}/admin/announcements?limit=1`, { credentials: 'include' }).then((r) => r.json()),
    ]);

    const getCount = (settled: PromiseSettledResult<any>) => {
      if (settled.status === 'fulfilled' && settled.value?.meta?.totalItems !== undefined) {
        return settled.value.meta.totalItems;
      }
      return 0;
    };

    return {
      members: getCount(membersRes),
      projects: getCount(projectsRes),
      events: getCount(eventsRes),
      media: getCount(mediaRes),
      announcements: getCount(announcementsRes),
      dbStatus: health?.checks?.database || 'connected',
      storageStatus: health?.checks?.storage || 'operational',
      uptime: health?.uptime || 0,
    };
  } catch {
    return {
      members: 0,
      projects: 0,
      events: 0,
      media: 0,
      announcements: 0,
      dbStatus: 'unknown',
      storageStatus: 'unknown',
      uptime: 0,
    };
  }
}

export async function adminGetDashboardData(): Promise<{
  success: boolean;
  data: AdminDashboardData | null;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      method: 'GET',
      credentials: 'include',
    });

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        data: null,
        error: 'Authentication session expired or invalid.',
      };
    }

    const body: ApiResponse<AdminDashboardData> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to load dashboard metrics.',
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch {
    return {
      success: false,
      data: null,
      error: 'Cannot reach backend server. Please verify backend service on port 3001 is running.',
    };
  }
}

export async function adminGetMembers(params: AdminMemberQueryParams = {}): Promise<{
  success: boolean;
  data: AdminMember[];
  total: number;
  page: number;
  limit: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  sort: string;
  facets?: AdminMemberFilterFacets;
  error?: string;
}> {
  try {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    const size = params.pageSize || params.limit;
    if (size) query.set('pageSize', String(size));
    if (params.status && params.status !== 'all') query.set('status', params.status);
    const searchVal = params.q || params.search;
    if (searchVal && searchVal.trim()) query.set('q', searchVal.trim());
    if (params.role && params.role !== 'all') query.set('role', params.role);
    if (params.domain && params.domain !== 'all') query.set('domain', params.domain);
    if (params.department && params.department !== 'all') query.set('department', params.department);
    if (params.sort) query.set('sort', params.sort);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_BASE}/admin/members${queryString}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        data: [],
        total: 0,
        page: 1,
        limit: 25,
        pageSize: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        sort: 'updated_desc',
        error: 'Authentication session expired or invalid.',
      };
    }

    const body: ApiResponse<AdminMember[]> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: [],
        total: 0,
        page: 1,
        limit: 25,
        pageSize: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        sort: 'updated_desc',
        error: body.error?.message || 'Failed to fetch members list.',
      };
    }

    const meta = body.meta || {};
    const limit = meta.pageSize || meta.limit || 25;
    return {
      success: true,
      data: body.data,
      total: meta.totalItems !== undefined ? meta.totalItems : body.data.length,
      page: meta.page || 1,
      limit,
      pageSize: limit,
      totalPages: meta.totalPages || 1,
      hasNextPage: meta.hasNextPage !== undefined ? meta.hasNextPage : false,
      hasPrevPage: meta.hasPrevPage !== undefined ? meta.hasPrevPage : false,
      sort: meta.sort || 'updated_desc',
      facets: meta.facets,
    };
  } catch {
    return {
      success: false,
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      pageSize: 25,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
      sort: 'updated_desc',
      error: 'Cannot reach backend server. Please check your network connection.',
    };
  }
}

export async function adminGetMemberFacets(): Promise<{
  success: boolean;
  facets: AdminMemberFilterFacets | null;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/members/facets`, {
      method: 'GET',
      credentials: 'include',
    });
    const body: ApiResponse<AdminMemberFilterFacets> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        facets: null,
        error: body.error?.message || 'Failed to fetch filter facets.',
      };
    }
    return {
      success: true,
      facets: body.data,
    };
  } catch {
    return {
      success: false,
      facets: null,
      error: 'Network error fetching filter facets.',
    };
  }
}

export async function adminGetMember(id: string): Promise<{
  success: boolean;
  data: AdminMember | null;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/members/${encodeURIComponent(id)}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (res.status === 404) {
      return {
        success: false,
        data: null,
        error: 'Member record not found.',
      };
    }

    const body: ApiResponse<AdminMember> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to retrieve member details.',
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch {
    return {
      success: false,
      data: null,
      error: 'Cannot reach backend server.',
    };
  }
}

export async function adminCreateMember(payload: CreateMemberInput): Promise<{
  success: boolean;
  data: AdminMember | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const body: ApiResponse<AdminMember> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to create member.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch {
    return {
      success: false,
      data: null,
      error: 'Cannot reach backend server.',
    };
  }
}

export async function adminUpdateMember(
  id: string,
  payload: UpdateMemberInput
): Promise<{
  success: boolean;
  data: AdminMember | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/members/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const body: ApiResponse<AdminMember> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to update member.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch {
    return {
      success: false,
      data: null,
      error: 'Cannot reach backend server.',
    };
  }
}

export async function adminUpdateMemberStatus(
  id: string,
  status: 'ACTIVE' | 'INACTIVE' | 'ALUMNI'
): Promise<{
  success: boolean;
  data: AdminMember | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/members/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });

    const body: ApiResponse<AdminMember> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to update member status.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch {
    return {
      success: false,
      data: null,
      error: 'Cannot reach backend server.',
    };
  }
}

export async function adminUploadMemberImage(
  id: string,
  payload: File | { content: string; filename: string }
): Promise<{
  success: boolean;
  data: AdminMember | null;
  image?: { url: string; publicId: string; format: string; bytes: number };
  error?: string;
  code?: string;
}> {
  try {
    let headers: Record<string, string> = {};
    let body: BodyInit;

    if (payload instanceof File) {
      const formData = new FormData();
      formData.append('file', payload);
      body = formData;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }

    const res = await fetch(`${API_BASE}/admin/members/${encodeURIComponent(id)}/image`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body,
    });

    const resBody: ApiResponse<AdminMember> = await res.json();
    if (!res.ok || resBody.error || !resBody.data) {
      return {
        success: false,
        data: null,
        error: resBody.error?.message || 'Failed to upload profile image.',
        code: resBody.error?.code,
      };
    }

    return {
      success: true,
      data: resBody.data,
      image: resBody.meta?.image,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminDeleteMemberImage(id: string): Promise<{
  success: boolean;
  data: AdminMember | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/members/${encodeURIComponent(id)}/image`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const body: ApiResponse<AdminMember> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to remove profile image.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}


export function adminGetExportUrl(params: AdminMemberQueryParams & { format?: 'csv' | 'json' }): string {
  const query = new URLSearchParams();
  if (params.format) query.set('format', params.format);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.role) query.set('role', params.role);
  if (params.domain) query.set('domain', params.domain);
  if (params.department) query.set('department', params.department);
  if (params.q || params.search) query.set('q', params.q || params.search || '');
  if (params.sort) query.set('sort', params.sort);
  return `${API_BASE}/admin/members/export?${query.toString()}`;
}

export async function fetchAdminAuditLogs(params: AuditLogFilters = {}): Promise<{
  success: boolean;
  data: AuditLogItem[];
  meta: AuditLogPaginationMeta | null;
  error?: string;
  code?: string;
}> {
  try {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.action) query.set('action', params.action);
    if (params.entityType) query.set('entityType', params.entityType);
    if (params.entityId) query.set('entityId', params.entityId);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.search) query.set('search', params.search);

    const res = await fetch(`${API_BASE}/admin/audit-logs?${query.toString()}`, {
      credentials: 'include',
    });

    const body: ApiResponse<AuditLogItem[]> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: [],
        meta: null,
        error: body.error?.message || 'Failed to fetch audit logs.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
      meta: body.meta as AuditLogPaginationMeta,
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      meta: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function fetchAdminSettings(): Promise<{
  success: boolean;
  data: AdminSettingsData | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      credentials: 'include',
    });

    const body: ApiResponse<AdminSettingsData> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to fetch settings.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function updateAdminSettings(settings: AdminSettingsMap): Promise<{
  success: boolean;
  data: { updatedKeys: string[]; settings: AdminSettingsMap } | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ settings }),
    });

    const body: ApiResponse<{ updatedKeys: string[]; settings: AdminSettingsMap }> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to update settings.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

// =============================================================================
// PROJECT MANAGEMENT API METHODS (PHASE 15)
// =============================================================================

export async function adminGetProjects(params: AdminProjectQueryParams = {}): Promise<{
  success: boolean;
  data: AdminProject[];
  meta?: any;
  error?: string;
  code?: string;
}> {
  try {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.category && params.category !== 'all') query.set('category', params.category);
    if (params.featured !== undefined) query.set('featured', params.featured.toString());
    if (params.search) query.set('search', params.search);
    if (params.sort) query.set('sort', params.sort);

    const res = await fetch(`${API_BASE}/admin/projects?${query.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    const body: ApiResponse<AdminProject[]> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: [],
        error: body.error?.message || 'Failed to load projects list.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
      meta: body.meta,
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminGetProjectById(id: string): Promise<{
  success: boolean;
  data: AdminProject | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/projects/${id}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    const body: ApiResponse<AdminProject> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Project not found.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminCreateProject(input: CreateProjectInput): Promise<{
  success: boolean;
  data: AdminProject | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    const body: ApiResponse<AdminProject> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to create project.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminUpdateProject(id: string, input: UpdateProjectInput): Promise<{
  success: boolean;
  data: AdminProject | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    const body: ApiResponse<AdminProject> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to update project.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminUpdateProjectStatus(id: string, status: ProjectStatus | string): Promise<{
  success: boolean;
  data: AdminProject | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/projects/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });

    const body: ApiResponse<AdminProject> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to update project status.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminToggleProjectFeatured(id: string, featured?: boolean): Promise<{
  success: boolean;
  data: AdminProject | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/projects/${id}/featured`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ featured }),
    });

    const body: ApiResponse<AdminProject> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to toggle featured status.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminUploadProjectImage(
  id: string,
  payload: { filename: string; content: string }
): Promise<{
  success: boolean;
  data: AdminProject | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/projects/${id}/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const body: ApiResponse<AdminProject> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to upload cover image.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminDeleteProject(id: string): Promise<{
  success: boolean;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/projects/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const body: ApiResponse<{ deleted: boolean; id: string }> = await res.json();
    if (!res.ok || body.error) {
      return {
        success: false,
        error: body.error?.message || 'Failed to delete project.',
        code: body.error?.code,
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminAddProjectMember(
  id: string,
  memberId: string,
  role?: string
): Promise<{
  success: boolean;
  data: AdminProjectMember[];
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/projects/${id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ memberId, role }),
    });

    const body: ApiResponse<AdminProjectMember[]> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: [],
        error: body.error?.message || 'Failed to add member to project.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminRemoveProjectMember(
  id: string,
  memberId: string
): Promise<{
  success: boolean;
  data: AdminProjectMember[];
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/projects/${id}/members/${memberId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const body: ApiResponse<AdminProjectMember[]> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: [],
        error: body.error?.message || 'Failed to remove member from project.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminSyncProjectMembers(
  id: string,
  members: Array<{ memberId: string; role?: string }>
): Promise<{
  success: boolean;
  data: AdminProjectMember[];
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/projects/${id}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ members }),
    });

    const body: ApiResponse<AdminProjectMember[]> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: [],
        error: body.error?.message || 'Failed to sync project members.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

// ==========================================
// MEDIA MANAGEMENT API
// ==========================================

export async function adminGetMediaList(params: AdminMediaQueryParams = {}): Promise<{
  success: boolean;
  data: AdminMediaAsset[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    facets?: AdminMediaFacets;
  };
  error?: string;
  code?: string;
}> {
  try {
    const q = new URLSearchParams();
    if (params.page) q.set('page', params.page.toString());
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.search) q.set('search', params.search);
    if (params.category && params.category !== 'all') q.set('category', params.category);
    if (params.format && params.format !== 'all') q.set('format', params.format);
    if (params.usage && params.usage !== 'all') q.set('usage', params.usage);
    if (params.sort) q.set('sort', params.sort);

    const res = await fetch(`${API_BASE}/admin/media?${q.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });

    const body: ApiResponse<AdminMediaAsset[]> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: [],
        meta: { page: 1, limit: 24, total: 0, totalPages: 1 },
        error: body.error?.message || 'Failed to fetch media assets.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
      meta: {
        page: body.meta?.page || 1,
        limit: body.meta?.limit || 24,
        total: body.meta?.total || 0,
        totalPages: body.meta?.totalPages || 1,
        facets: body.meta?.facets,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      meta: { page: 1, limit: 24, total: 0, totalPages: 1 },
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminGetMediaById(id: string): Promise<{
  success: boolean;
  data: AdminMediaAsset | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/media/${encodeURIComponent(id)}`, {
      method: 'GET',
      credentials: 'include',
    });

    const body: ApiResponse<AdminMediaAsset> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Media asset not found.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminUploadMedia(
  fileOrBase64: File | { content: string; filename: string },
  category: string = 'general',
  altText?: string
): Promise<{
  success: boolean;
  data: AdminMediaAsset | null;
  error?: string;
  code?: string;
}> {
  try {
    let res: Response;

    if (fileOrBase64 instanceof File) {
      const buffer = await fileOrBase64.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      res = await fetch(`${API_BASE}/admin/media/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: fileOrBase64.name,
          category,
          alt_text: altText,
          content: `data:${fileOrBase64.type};base64,${base64}`,
        }),
      });
    } else {
      res = await fetch(`${API_BASE}/admin/media/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: fileOrBase64.filename,
          category,
          alt_text: altText,
          content: fileOrBase64.content,
        }),
      });
    }

    const body: ApiResponse<AdminMediaAsset> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to upload media asset.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminReplaceMedia(
  id: string,
  fileOrBase64: File | { content: string; filename: string }
): Promise<{
  success: boolean;
  data: AdminMediaAsset | null;
  error?: string;
  code?: string;
}> {
  try {
    let res: Response;

    if (fileOrBase64 instanceof File) {
      const buffer = await fileOrBase64.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      res = await fetch(`${API_BASE}/admin/media/${encodeURIComponent(id)}/replace`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: fileOrBase64.name,
          content: `data:${fileOrBase64.type};base64,${base64}`,
        }),
      });
    } else {
      res = await fetch(`${API_BASE}/admin/media/${encodeURIComponent(id)}/replace`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: fileOrBase64.filename,
          content: fileOrBase64.content,
        }),
      });
    }

    const body: ApiResponse<AdminMediaAsset> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to replace media asset.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminUpdateMedia(
  id: string,
  updates: { alt_text?: string; category?: string; filename?: string }
): Promise<{
  success: boolean;
  data: AdminMediaAsset | null;
  error?: string;
  code?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/media/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    const body: ApiResponse<AdminMediaAsset> = await res.json();
    if (!res.ok || body.error || !body.data) {
      return {
        success: false,
        data: null,
        error: body.error?.message || 'Failed to update media asset.',
        code: body.error?.code,
      };
    }

    return {
      success: true,
      data: body.data,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

export async function adminDeleteMedia(id: string): Promise<{
  success: boolean;
  error?: string;
  code?: string;
  references?: any[];
}> {
  try {
    const res = await fetch(`${API_BASE}/admin/media/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const body = await res.json();
    if (!res.ok || body.error) {
      return {
        success: false,
        error: body.error?.message || 'Failed to delete media asset.',
        code: body.error?.code,
        references: body.error?.details?.references,
      };
    }

    return {
      success: true,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Cannot reach backend server.',
    };
  }
}

