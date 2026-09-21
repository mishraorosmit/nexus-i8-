import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Eye,
  Edit,
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Shield,
  Clock,
  Calendar,
  Mail,
  Briefcase,
  Layers,
  ArrowUpDown,
  Filter,
  RotateCcw,
  Upload,
  Trash2,
  Camera,
  Image as ImageIcon,
  Loader2,
  Download,
} from 'lucide-react';
import { BulkImportModal } from '../components/BulkImportModal.tsx';
import { ExportModal } from '../components/ExportModal.tsx';
import {
  AdminMember,
  CreateMemberInput,
  UpdateMemberInput,
  AdminMemberFilterFacets,
} from '../types.ts';
import {
  adminGetMembers,
  adminGetMember,
  adminCreateMember,
  adminUpdateMember,
  adminUpdateMemberStatus,
  adminGetMemberFacets,
  adminUploadMemberImage,
  adminDeleteMemberImage,
} from '../api.ts';

interface AdminMembersPageProps {
  onNavigate?: (route: string) => void;
}

// Helper to read initial state from browser URL
function getQueryParamsFromUrl() {
  if (typeof window === 'undefined') {
    return {
      q: '',
      status: 'all' as const,
      role: '',
      domain: '',
      department: '',
      sort: 'updated_desc',
      page: 1,
      pageSize: 25,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const rawStatus = (params.get('status') || 'all').trim();
  const validStatus = ['all', 'ACTIVE', 'INACTIVE', 'ALUMNI'].includes(rawStatus.toUpperCase())
    ? (rawStatus.toUpperCase() as 'all' | 'ACTIVE' | 'INACTIVE' | 'ALUMNI')
    : 'all';

  const validSorts = [
    'updated_desc',
    'name_asc',
    'name_desc',
    'newest',
    'oldest',
    'unique_id_asc',
    'unique_id_desc',
  ];
  const rawSort = params.get('sort') || 'updated_desc';
  const sort = validSorts.includes(rawSort) ? rawSort : 'updated_desc';

  const rawPageSize = parseInt(params.get('pageSize') || params.get('limit') || '25', 10);
  const pageSize = [25, 50, 100].includes(rawPageSize) ? rawPageSize : 25;

  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  return {
    q: params.get('q') || params.get('search') || '',
    status: validStatus,
    role: params.get('role') || '',
    domain: params.get('domain') || '',
    department: params.get('department') || '',
    sort,
    page,
    pageSize,
  };
}

export const AdminMembersPage: React.FC<AdminMembersPageProps> = () => {
  const initialUrlState = getQueryParamsFromUrl();

  // Search, Filter, Sort & Pagination State
  const [searchInput, setSearchInput] = useState(initialUrlState.q);
  const [searchQuery, setSearchQuery] = useState(initialUrlState.q);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'INACTIVE' | 'ALUMNI'>(initialUrlState.status);
  const [departmentFilter, setDepartmentFilter] = useState(initialUrlState.department);
  const [domainFilter, setDomainFilter] = useState(initialUrlState.domain);
  const [roleFilter, setRoleFilter] = useState(initialUrlState.role);
  const [sortKey, setSortKey] = useState(initialUrlState.sort);
  const [page, setPage] = useState(initialUrlState.page);
  const [pageSize, setPageSize] = useState(initialUrlState.pageSize);

  // Roster data state
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Facets
  const [facets, setFacets] = useState<AdminMemberFilterFacets>({
    roles: [],
    domains: [],
    departments: [],
    statuses: ['ACTIVE', 'INACTIVE', 'ALUMNI'],
  });

  // Stale request guard
  const latestRequestIdRef = useRef<number>(0);

  // Modal states
  const [viewMember, setViewMember] = useState<AdminMember | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateMemberInput>({
    name: '',
    displayName: '',
    email: '',
    role: '',
    domain: 'Engineering & Design',
    department: 'ENGINEERING',
    status: 'ACTIVE',
    uniqueId: '',
    slug: '',
    joinedAt: new Date().toISOString().split('T')[0],
    bio: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editMember, setEditMember] = useState<AdminMember | null>(null);
  const [editForm, setEditForm] = useState<UpdateMemberInput>({
    name: '',
    displayName: '',
    email: '',
    role: '',
    domain: '',
    department: '',
    status: 'ACTIVE',
    slug: '',
    joinedAt: '',
    bio: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [statusTarget, setStatusTarget] = useState<{
    member: AdminMember;
    nextStatus: 'ACTIVE' | 'INACTIVE' | 'ALUMNI';
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Bulk Import & Export Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Profile photo upload & management state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadImageError, setUploadImageError] = useState<string | null>(null);
  const [uploadImageSuccess, setUploadImageSuccess] = useState<string | null>(null);

  // Flash notification
  const [flashSuccess, setFlashSuccess] = useState<string | null>(null);
  const triggerFlash = (msg: string) => {
    setFlashSuccess(msg);
    setTimeout(() => setFlashSuccess(null), 4000);
  };

  // Debounce search query input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync state to Browser URL without page reloads
  const syncStateToUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const params = url.searchParams;

    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    } else {
      params.delete('q');
      params.delete('search');
    }

    if (statusFilter && statusFilter !== 'all') {
      params.set('status', statusFilter);
    } else {
      params.delete('status');
    }

    if (departmentFilter && departmentFilter !== 'all') {
      params.set('department', departmentFilter);
    } else {
      params.delete('department');
    }

    if (domainFilter && domainFilter !== 'all') {
      params.set('domain', domainFilter);
    } else {
      params.delete('domain');
    }

    if (roleFilter && roleFilter !== 'all') {
      params.set('role', roleFilter);
    } else {
      params.delete('role');
    }

    if (sortKey && sortKey !== 'updated_desc') {
      params.set('sort', sortKey);
    } else {
      params.delete('sort');
    }

    if (pageSize !== 25) {
      params.set('pageSize', String(pageSize));
    } else {
      params.delete('pageSize');
      params.delete('limit');
    }

    if (page > 1) {
      params.set('page', String(page));
    } else {
      params.delete('page');
    }

    const newSearch = params.toString() ? `?${params.toString()}` : '';
    const newPath = `${window.location.pathname}${newSearch}`;
    if (window.location.pathname + window.location.search !== newPath) {
      window.history.replaceState(null, '', newPath);
    }
  }, [searchQuery, statusFilter, departmentFilter, domainFilter, roleFilter, sortKey, page, pageSize]);

  // Listen for browser Back/Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const state = getQueryParamsFromUrl();
      setSearchInput(state.q);
      setSearchQuery(state.q);
      setStatusFilter(state.status);
      setDepartmentFilter(state.department);
      setDomainFilter(state.domain);
      setRoleFilter(state.role);
      setSortKey(state.sort);
      setPage(state.page);
      setPageSize(state.pageSize);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch roster backed by SQLite
  const loadMembers = useCallback(async () => {
    const currentRequestId = ++latestRequestIdRef.current;
    setIsLoading(true);
    setFetchError(null);

    syncStateToUrl();

    const result = await adminGetMembers({
      page,
      pageSize,
      status: statusFilter,
      q: searchQuery,
      department: departmentFilter,
      domain: domainFilter,
      role: roleFilter,
      sort: sortKey,
    });

    // Discard stale responses if newer requests were triggered
    if (currentRequestId !== latestRequestIdRef.current) return;

    if (result.success) {
      setMembers(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      if (result.facets) {
        setFacets(result.facets);
      }
    } else {
      setFetchError(result.error || 'Failed to load member records.');
    }
    setIsLoading(false);
  }, [
    page,
    pageSize,
    statusFilter,
    searchQuery,
    departmentFilter,
    domainFilter,
    roleFilter,
    sortKey,
    syncStateToUrl,
  ]);

  // Fetch facets on mount
  useEffect(() => {
    adminGetMemberFacets().then((res) => {
      if (res.success && res.facets) {
        setFacets(res.facets);
      }
    });
  }, []);

  // Trigger load on state changes
  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Filter change handlers that reset page to 1
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

  const handleStatusFilterChange = (status: 'all' | 'ACTIVE' | 'INACTIVE' | 'ALUMNI') => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDepartmentFilter(e.target.value);
    setPage(1);
  };

  const handleDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDomainFilter(e.target.value);
    setPage(1);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRoleFilter(e.target.value);
    setPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortKey(e.target.value);
    setPage(1);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value, 10) || 25;
    setPageSize(newSize);
    setPage(1);
  };

  // Reset all filters to default
  const handleClearAllFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setStatusFilter('all');
    setDepartmentFilter('');
    setDomainFilter('');
    setRoleFilter('');
    setSortKey('updated_desc');
    setPage(1);
    setPageSize(25);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    departmentFilter !== '' ||
    domainFilter !== '' ||
    roleFilter !== '' ||
    sortKey !== 'updated_desc';

  // View Details
  const handleOpenView = async (member: AdminMember) => {
    setViewMember(member);
    setIsViewModalOpen(true);
    const refreshed = await adminGetMember(member.id);
    if (refreshed.success && refreshed.data) {
      setViewMember(refreshed.data);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setCreateForm({
      name: '',
      displayName: '',
      email: '',
      role: '',
      domain: 'Engineering & Design',
      department: 'ENGINEERING',
      status: 'ACTIVE',
      uniqueId: '',
      slug: '',
      joinedAt: new Date().toISOString().split('T')[0],
      bio: '',
    });
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  // Submit Create Member
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError('Full Name is required.');
      return;
    }
    if (!createForm.role.trim()) {
      setCreateError('Role is required.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    const payload: CreateMemberInput = {
      name: createForm.name.trim(),
      displayName: createForm.displayName?.trim() || undefined,
      email: createForm.email?.trim() || undefined,
      role: createForm.role.trim(),
      domain: createForm.domain?.trim() || undefined,
      department: createForm.department?.trim() || undefined,
      status: createForm.status || 'ACTIVE',
      uniqueId: createForm.uniqueId?.trim() || undefined,
      slug: createForm.slug?.trim() || undefined,
      joinedAt: createForm.joinedAt?.trim() || undefined,
      bio: createForm.bio?.trim() || undefined,
    };

    const res = await adminCreateMember(payload);
    setIsCreating(false);

    if (res.success && res.data) {
      setIsCreateModalOpen(false);
      triggerFlash(`Member "${res.data.name}" (${res.data.unique_id}) created successfully.`);
      loadMembers();
    } else {
      setCreateError(res.error || 'Failed to create member record.');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (member: AdminMember) => {
    setEditMember(member);
    setEditForm({
      name: member.name || '',
      displayName: member.display_name || '',
      email: member.email || '',
      role: member.role || '',
      domain: member.domain || '',
      department: member.department || '',
      status: (member.status.toUpperCase() as 'ACTIVE' | 'INACTIVE' | 'ALUMNI') || 'ACTIVE',
      slug: member.slug || member.public_id || '',
      joinedAt: member.joined_at || member.joined_date || '',
      bio: member.bio || '',
      expectedUpdatedAt: member.updated_at,
    });
    setEditError(null);
    setUploadImageError(null);
    setUploadImageSuccess(null);
    setIsEditing(false);
  };

  // Upload or replace profile image
  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editMember) return;

    setUploadImageError(null);
    setUploadImageSuccess(null);

    // Client-side size guard (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadImageError('File size exceeds 5MB limit. Please choose a smaller image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Client-side MIME check
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      setUploadImageError('Unsupported file type. Only JPEG, PNG, and WebP images are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploadingImage(true);
    try {
      const res = await adminUploadMemberImage(editMember.id, file);
      if (!res.success || !res.data) {
        setUploadImageError(res.error || 'Failed to upload profile image.');
      } else {
        setUploadImageSuccess('Profile photo uploaded and optimized successfully.');
        setEditMember(res.data);
        setMembers((prev) => prev.map((m) => (m.id === res.data!.id ? res.data! : m)));
        if (viewMember && viewMember.id === res.data.id) {
          setViewMember(res.data);
        }
      }
    } catch (err: any) {
      setUploadImageError(err?.message || 'Network error during image upload.');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remove profile image
  const handleDeleteImage = async () => {
    if (!editMember) return;
    if (!window.confirm(`Are you sure you want to remove ${editMember.name}'s profile photo?`)) {
      return;
    }

    setUploadImageError(null);
    setUploadImageSuccess(null);
    setIsUploadingImage(true);
    try {
      const res = await adminDeleteMemberImage(editMember.id);
      if (!res.success || !res.data) {
        setUploadImageError(res.error || 'Failed to remove profile image.');
      } else {
        setUploadImageSuccess('Profile photo removed successfully.');
        setEditMember(res.data);
        setMembers((prev) => prev.map((m) => (m.id === res.data!.id ? res.data! : m)));
        if (viewMember && viewMember.id === res.data.id) {
          setViewMember(res.data);
        }
      }
    } catch (err: any) {
      setUploadImageError(err?.message || 'Network error during image removal.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Submit Edit Member
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    if (!editForm.name?.trim()) {
      setEditError('Full Name is required.');
      return;
    }
    if (!editForm.role?.trim()) {
      setEditError('Role is required.');
      return;
    }

    setIsEditing(true);
    setEditError(null);

    const payload: UpdateMemberInput = {
      name: editForm.name.trim(),
      displayName: editForm.displayName?.trim() || undefined,
      email: editForm.email !== undefined ? editForm.email.trim() : undefined,
      role: editForm.role.trim(),
      domain: editForm.domain?.trim() || undefined,
      department: editForm.department?.trim() || undefined,
      status: editForm.status,
      slug: editForm.slug?.trim() || undefined,
      joinedAt: editForm.joinedAt?.trim() || undefined,
      bio: editForm.bio?.trim() || undefined,
      expectedUpdatedAt: editMember.updated_at,
    };

    const res = await adminUpdateMember(editMember.id, payload);
    setIsEditing(false);

    if (res.success && res.data) {
      setEditMember(null);
      triggerFlash(`Member "${res.data.name}" updated successfully.`);
      loadMembers();
      if (viewMember && viewMember.id === res.data.id) {
        setViewMember(res.data);
      }
    } else {
      setEditError(res.error || 'Failed to update member record.');
    }
  };

  // Status Change Confirmation Dialog
  const handlePromptStatusChange = (member: AdminMember, nextStatus: 'ACTIVE' | 'INACTIVE' | 'ALUMNI') => {
    setStatusTarget({ member, nextStatus });
    setStatusError(null);
  };

  // Confirm Status Change
  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;
    setIsUpdatingStatus(true);
    setStatusError(null);

    const res = await adminUpdateMemberStatus(statusTarget.member.id, statusTarget.nextStatus);
    setIsUpdatingStatus(false);

    if (res.success && res.data) {
      const prevName = statusTarget.member.name;
      const newStatus = statusTarget.nextStatus;
      setStatusTarget(null);
      triggerFlash(`Member "${prevName}" is now marked as ${newStatus}.`);
      loadMembers();
      if (viewMember && viewMember.id === res.data.id) {
        setViewMember(res.data);
      }
    } else {
      setStatusError(res.error || 'Failed to update member status.');
    }
  };

  // Status badge styling helper
  const renderStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          ACTIVE
        </span>
      );
    }
    if (s === 'INACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          INACTIVE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
        ALUMNI
      </span>
    );
  };

  // Result range calculation
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(total, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Toast Flash Notification */}
      {flashSuccess && (
        <div className="flex items-center gap-3 p-3.5 bg-emerald-950/80 border border-emerald-800/60 rounded-lg text-emerald-200 text-xs font-mono shadow-lg transition-all animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{flashSuccess}</span>
          <button
            type="button"
            onClick={() => setFlashSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-neutral-100 tracking-tight">Member Management</h1>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                SQLite-backed member registry with server-side search, multi-field filtering, sorting & pagination.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadMembers}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800/80 text-xs font-mono transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-neutral-400' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800/80 text-xs font-mono transition-colors"
            title="Export members roster (CSV / JSON)"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export</span>
          </button>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800/80 text-xs font-mono transition-colors"
            title="Bulk import members from CSV or JSON"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Member</span>
          </button>
        </div>
      </div>

      {/* Primary Search & Status Filter Bar */}
      <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-4 space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, unique ID (NX-026), email, role, department..."
              value={searchInput}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-9 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="md:col-span-5 flex items-center justify-start md:justify-end gap-1 overflow-x-auto pb-1 md:pb-0">
            {(['all', 'ACTIVE', 'INACTIVE', 'ALUMNI'] as const).map((status) => {
              const isSelected = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusFilterChange(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent'
                  }`}
                >
                  {status === 'all' ? 'All Members' : status}
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filter Dropdowns & Sorting */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-neutral-800/80 text-xs font-mono">
          {/* Department Filter */}
          <div>
            <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Layers className="w-3 h-3 text-neutral-500" />
              <span>Department</span>
            </label>
            <select
              value={departmentFilter}
              onChange={handleDepartmentChange}
              className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 focus:outline-none focus:border-neutral-700 text-xs"
            >
              <option value="">All Departments</option>
              {facets.departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Domain Filter */}
          <div>
            <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-neutral-500" />
              <span>Domain</span>
            </label>
            <select
              value={domainFilter}
              onChange={handleDomainChange}
              className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 focus:outline-none focus:border-neutral-700 text-xs truncate"
            >
              <option value="">All Domains</option>
              {facets.domains.map((dom) => (
                <option key={dom} value={dom}>
                  {dom}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-neutral-500" />
              <span>Role</span>
            </label>
            <select
              value={roleFilter}
              onChange={handleRoleChange}
              className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 focus:outline-none focus:border-neutral-700 text-xs truncate"
            >
              <option value="">All Roles</option>
              {facets.roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Sorting Dropdown */}
          <div>
            <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-neutral-500" />
              <span>Sort By</span>
            </label>
            <select
              value={sortKey}
              onChange={handleSortChange}
              className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 focus:outline-none focus:border-neutral-700 text-xs"
            >
              <option value="updated_desc">Recently Updated</option>
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="unique_id_asc">Unique ID (Ascending)</option>
              <option value="unique_id_desc">Unique ID (Descending)</option>
              <option value="newest">Joined (Newest First)</option>
              <option value="oldest">Joined (Oldest First)</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Banner */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 text-xs font-mono">
            <div className="text-neutral-400 text-[11px] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Active filters applied. Showing matching SQLite records.</span>
            </div>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-emerald-400 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Fetch Error Alert */}
      {fetchError && (
        <div className="flex items-center justify-between p-3.5 bg-rose-950/40 border border-rose-800/50 rounded-lg text-rose-300 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={loadMembers}
            className="px-2.5 py-1 bg-rose-900/50 hover:bg-rose-900 text-rose-200 rounded border border-rose-700/50 text-[11px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Members Roster Table Container */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden relative">
        {/* Localized loading indicator bar */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-neutral-800 overflow-hidden z-20">
            <div className="h-full bg-emerald-500 animate-pulse w-full" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className={`w-full text-left border-collapse text-xs transition-opacity duration-150 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/70 text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Member</th>
                <th className="py-3 px-4 font-semibold">Unique ID</th>
                <th className="py-3 px-4 font-semibold">Role & Department</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Joined</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono">
              {members.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-6 h-6 text-neutral-600" />
                      <p className="text-neutral-300 font-sans text-sm">No members found</p>
                      <p className="text-xs text-neutral-500">
                        {hasActiveFilters
                          ? 'No member records match your current search and filter combination.'
                          : 'No member records exist in the SQLite database.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleClearAllFilters}
                          className="mt-2 text-xs text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset all filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-neutral-800/30 transition-colors group"
                  >
                    {/* Member Name & Email */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-200 font-semibold text-[11px] shrink-0 overflow-hidden">
                          {member.profile_image_url || member.photo_url ? (
                            <img
                              src={member.profile_image_url || member.photo_url || ''}
                              alt={member.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            member.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-sans font-medium text-neutral-100 truncate text-[13px]">
                            {member.name}
                          </div>
                          <div className="text-[11px] text-neutral-400 font-mono truncate">
                            {member.email || `${member.slug || member.public_id}@nexus.campus`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Unique ID & Slug */}
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-emerald-300 font-mono text-[11px] border border-neutral-700">
                          {member.unique_id || 'NX-???'}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate max-w-[120px]">
                        {member.slug || member.public_id}
                      </div>
                    </td>

                    {/* Role & Domain */}
                    <td className="py-3 px-4">
                      <div className="font-sans text-neutral-200 text-xs truncate max-w-[180px]">
                        {member.role}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono truncate max-w-[180px]">
                        {member.department || member.domain || 'ENGINEERING'}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">{renderStatusBadge(member.status)}</td>

                    {/* Joined Date */}
                    <td className="py-3 px-4 text-neutral-400 text-[11px]">
                      {member.joined_at || member.joined_date || 'N/A'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View */}
                        <button
                          type="button"
                          onClick={() => handleOpenView(member)}
                          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* E-ID Preview */}
                        <a
                          href={`/memberID/${member.slug || member.public_id}/${member.unique_id || 'NX-001'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 transition-colors"
                          title="Preview E-ID Card"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(member)}
                          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                          title="Edit Member"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Status Toggle Actions */}
                        {member.status.toUpperCase() === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => handlePromptStatusChange(member, 'INACTIVE')}
                            className="px-2 py-1 rounded text-[10px] font-mono text-neutral-400 hover:text-amber-400 hover:bg-amber-950/30 border border-transparent hover:border-amber-800/40 transition-colors"
                            title="Deactivate Member"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePromptStatusChange(member, 'ACTIVE')}
                            className="px-2 py-1 rounded text-[10px] font-mono text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 border border-transparent hover:border-emerald-800/40 transition-colors"
                            title="Reactivate Member"
                          >
                            Activate
                          </button>
                        )}
                        {member.status.toUpperCase() !== 'ALUMNI' && (
                          <button
                            type="button"
                            onClick={() => handlePromptStatusChange(member, 'ALUMNI')}
                            className="px-2 py-1 rounded text-[10px] font-mono text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/30 border border-transparent hover:border-indigo-800/40 transition-colors"
                            title="Mark as Alumni"
                          >
                            Alumni
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Controlled Pagination Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-neutral-800 bg-neutral-950/50 text-neutral-400 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div>
              Showing <span className="text-neutral-200 font-semibold">{startItem} - {endItem}</span> of{' '}
              <span className="text-neutral-200 font-semibold">{total}</span> members
            </div>

            {/* Controlled Page Size Selector */}
            <div className="flex items-center gap-1.5 border-l border-neutral-800 pl-3">
              <span className="text-[11px] text-neutral-500">Per page:</span>
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-[11px] text-neutral-300 focus:outline-none focus:border-neutral-700"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Page navigation buttons */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {/* First Page */}
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            {/* Prev Page */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] px-2 text-neutral-300 whitespace-nowrap">
              Page {page} of {Math.max(1, totalPages)}
            </span>

            {/* Next Page */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {/* Last Page */}
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. VIEW MEMBER DETAIL MODAL / DRAWER                      */}
      {/* ========================================================= */}
      {isViewModalOpen && viewMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/60">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-800 text-emerald-400 border border-neutral-700">
                  {viewMember.unique_id || 'NX-???'}
                </span>
                <h3 className="text-sm font-semibold text-neutral-100 font-sans truncate">
                  {viewMember.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Profile Card */}
              <div className="flex items-start gap-4 p-3.5 rounded-lg bg-neutral-950/40 border border-neutral-800/80">
                <div className="w-14 h-14 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 font-bold text-lg shrink-0 overflow-hidden">
                  {viewMember.profile_image_url || viewMember.photo_url ? (
                    <img
                      src={viewMember.profile_image_url || viewMember.photo_url || ''}
                      alt={viewMember.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    viewMember.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-semibold text-neutral-100 font-sans">
                    {viewMember.name}
                  </div>
                  <div className="text-neutral-400 font-mono flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{viewMember.email || 'No email specified'}</span>
                  </div>
                  <div className="pt-1">{renderStatusBadge(viewMember.status)}</div>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="p-3 bg-neutral-950/30 rounded-lg border border-neutral-800/60">
                  <div className="text-[10px] text-neutral-500 uppercase flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    <span>Role</span>
                  </div>
                  <div className="text-neutral-200 font-sans text-xs mt-1 font-medium">
                    {viewMember.role}
                  </div>
                </div>

                <div className="p-3 bg-neutral-950/30 rounded-lg border border-neutral-800/60">
                  <div className="text-[10px] text-neutral-500 uppercase flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>Department</span>
                  </div>
                  <div className="text-neutral-200 font-mono text-xs mt-1">
                    {viewMember.department || 'ENGINEERING'}
                  </div>
                </div>

                <div className="p-3 bg-neutral-950/30 rounded-lg border border-neutral-800/60">
                  <div className="text-[10px] text-neutral-500 uppercase flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>Unique ID</span>
                  </div>
                  <div className="text-emerald-400 font-mono text-xs mt-1 font-semibold">
                    {viewMember.unique_id || 'NX-???'}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">Permanent Identity</div>
                </div>

                <div className="p-3 bg-neutral-950/30 rounded-lg border border-neutral-800/60">
                  <div className="text-[10px] text-neutral-500 uppercase">URL Slug</div>
                  <div className="text-neutral-300 font-mono text-xs mt-1 truncate">
                    {viewMember.slug || viewMember.public_id}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">URL Safe Identifier</div>
                </div>

                <div className="p-3 bg-neutral-950/30 rounded-lg border border-neutral-800/60">
                  <div className="text-[10px] text-neutral-500 uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Joined Date</span>
                  </div>
                  <div className="text-neutral-300 font-mono text-xs mt-1">
                    {viewMember.joined_at || viewMember.joined_date || 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-neutral-950/30 rounded-lg border border-neutral-800/60">
                  <div className="text-[10px] text-neutral-500 uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Last Updated</span>
                  </div>
                  <div className="text-neutral-300 font-mono text-[11px] mt-1 truncate">
                    {new Date(viewMember.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Bio */}
              {viewMember.bio && (
                <div className="p-3 bg-neutral-950/30 rounded-lg border border-neutral-800/60 space-y-1">
                  <div className="text-[10px] text-neutral-500 font-mono uppercase">Biography</div>
                  <p className="text-neutral-300 font-sans leading-relaxed text-xs">
                    {viewMember.bio}
                  </p>
                </div>
              )}

              {/* Public E-ID Link Preview */}
              <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800 flex items-center justify-between text-neutral-400 font-mono text-[11px]">
                <div>
                  <div className="text-neutral-300 font-sans font-medium text-xs">
                    Public E-ID Identity
                  </div>
                  <div className="text-neutral-500 text-[10px]">
                    /memberID/{viewMember.slug || viewMember.public_id}/{viewMember.unique_id}
                  </div>
                </div>
                <a
                  href={`/memberID/${viewMember.slug || viewMember.public_id}/${viewMember.unique_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition-colors"
                >
                  <span>Open E-ID</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-neutral-800 bg-neutral-950/50">
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleOpenEdit(viewMember);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Record</span>
              </button>
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-mono transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CREATE MEMBER MODAL                                    */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <form onSubmit={handleCreateSubmit}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/60">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-neutral-100 font-sans">
                    Create New Member
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
                {createError && (
                  <div className="p-3 bg-rose-950/50 border border-rose-800/50 rounded-lg text-rose-300 font-mono text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-neutral-300 font-medium font-sans mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priyanshu Rout"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-neutral-300 font-medium font-sans mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. member@nexus.campus"
                    value={createForm.email || ''}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-neutral-300 font-medium font-sans mb-1">
                    Role <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Core Team Member / Developer"
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
                  />
                </div>

                {/* Domain & Department */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-300 font-medium font-sans mb-1">
                      Department
                    </label>
                    <select
                      value={createForm.department || 'ENGINEERING'}
                      onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-neutral-600 font-mono"
                    >
                      <option value="ENGINEERING">ENGINEERING</option>
                      <option value="DESIGN">DESIGN</option>
                      <option value="OPERATIONS">OPERATIONS</option>
                      <option value="RESEARCH">RESEARCH</option>
                      <option value="COMMUNITY">COMMUNITY</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-medium font-sans mb-1">
                      Status
                    </label>
                    <select
                      value={createForm.status || 'ACTIVE'}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'ALUMNI',
                        })
                      }
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-neutral-600 font-mono"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="ALUMNI">ALUMNI</option>
                    </select>
                  </div>
                </div>

                {/* Unique ID & Slug (Optional Custom Values) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-300 font-medium font-sans mb-1">
                      Unique ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Auto (e.g. NX-030)"
                      value={createForm.uniqueId || ''}
                      onChange={(e) => setCreateForm({ ...createForm, uniqueId: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
                    />
                    <span className="text-[10px] text-neutral-500 mt-0.5 block">
                      Leave blank for next sequential ID
                    </span>
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-medium font-sans mb-1">
                      Joined Date
                    </label>
                    <input
                      type="date"
                      value={createForm.joinedAt || ''}
                      onChange={(e) => setCreateForm({ ...createForm, joinedAt: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-neutral-600 font-mono"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-neutral-300 font-medium font-sans mb-1">
                    Biography (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short summary of background or responsibilities..."
                    value={createForm.bio || ''}
                    onChange={(e) => setCreateForm({ ...createForm, bio: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-800 bg-neutral-950/50">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isCreating}
                  className="px-3.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 text-xs font-mono transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isCreating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isCreating ? 'Creating...' : 'Create Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. EDIT MEMBER MODAL                                      */}
      {/* ========================================================= */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <form onSubmit={handleEditSubmit}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/60">
                <div className="flex items-center gap-2">
                  <Edit className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-neutral-100 font-sans">
                    Edit Member Record
                  </h3>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-emerald-300 font-mono text-[11px] border border-neutral-700">
                    {editMember.unique_id || 'NX-???'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditMember(null)}
                  className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
                {editError && (
                  <div className="p-3 bg-rose-950/50 border border-rose-800/50 rounded-lg text-rose-300 font-mono text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Permanent Identity Reminder */}
                <div className="p-2.5 bg-neutral-950/40 border border-neutral-800/80 rounded-lg flex items-center justify-between text-[11px] font-mono">
                  <div className="text-neutral-400">
                    Permanent Identity: <span className="text-emerald-300 font-semibold">{editMember.unique_id}</span>
                  </div>
                  <span className="text-[10px] text-neutral-500">Immutable</span>
                </div>

                {/* Profile Photo (Cloudinary Managed) */}
                <div className="p-3.5 bg-neutral-950/60 border border-neutral-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-neutral-300 font-medium font-sans text-xs flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Profile Photo</span>
                    </label>
                    <span className="text-[10px] text-neutral-500 font-mono">Cloudinary CDN (Max 5MB)</span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Avatar Preview */}
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shrink-0 flex items-center justify-center">
                      {editMember.profile_image_url || editMember.photo_url ? (
                        <img
                          src={editMember.profile_image_url || editMember.photo_url || ''}
                          alt={editMember.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-mono font-bold text-neutral-500 text-sm bg-neutral-900">
                          {editMember.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {isUploadingImage && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleImageFileSelect}
                          disabled={isUploadingImage}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingImage}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{editMember.profile_image_url || editMember.photo_url ? 'Replace Photo' : 'Upload Photo'}</span>
                        </button>

                        {(editMember.profile_image_url || editMember.photo_url) && (
                          <button
                            type="button"
                            onClick={handleDeleteImage}
                            disabled={isUploadingImage}
                            className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <div className="text-[10px] text-neutral-500 font-mono">
                        Allowed formats: JPEG, PNG, WebP • Auto-optimized
                      </div>
                    </div>
                  </div>

                  {uploadImageError && (
                    <div className="p-2.5 bg-rose-950/50 border border-rose-800/50 rounded-md text-rose-300 font-mono text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{uploadImageError}</span>
                    </div>
                  )}

                  {uploadImageSuccess && (
                    <div className="p-2.5 bg-emerald-950/50 border border-emerald-800/50 rounded-md text-emerald-300 font-mono text-[11px] flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{uploadImageSuccess}</span>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-neutral-300 font-medium font-sans mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-neutral-300 font-medium font-sans mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-neutral-300 font-medium font-sans mb-1">
                    Role <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.role || ''}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
                  />
                </div>

                {/* Department & Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-300 font-medium font-sans mb-1">
                      Department
                    </label>
                    <select
                      value={editForm.department || 'ENGINEERING'}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-neutral-600 font-mono"
                    >
                      <option value="ENGINEERING">ENGINEERING</option>
                      <option value="DESIGN">DESIGN</option>
                      <option value="OPERATIONS">OPERATIONS</option>
                      <option value="RESEARCH">RESEARCH</option>
                      <option value="COMMUNITY">COMMUNITY</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-medium font-sans mb-1">
                      Status
                    </label>
                    <select
                      value={editForm.status || 'ACTIVE'}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'ALUMNI',
                        })
                      }
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-neutral-600 font-mono"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="ALUMNI">ALUMNI</option>
                    </select>
                  </div>
                </div>

                {/* Slug & Joined Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-300 font-medium font-sans mb-1">
                      URL Slug
                    </label>
                    <input
                      type="text"
                      value={editForm.slug || ''}
                      onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-medium font-sans mb-1">
                      Joined Date
                    </label>
                    <input
                      type="date"
                      value={editForm.joinedAt || ''}
                      onChange={(e) => setEditForm({ ...editForm, joinedAt: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-neutral-600 font-mono"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-neutral-300 font-medium font-sans mb-1">
                    Biography
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.bio || ''}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-800 bg-neutral-950/50">
                <button
                  type="button"
                  onClick={() => setEditMember(null)}
                  disabled={isEditing}
                  className="px-3.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 text-xs font-mono transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isEditing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isEditing ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. STATUS CHANGE CONFIRMATION DIALOG                      */}
      {/* ========================================================= */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-950/60 flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-neutral-100 font-sans">
                Confirm Status Transition
              </h3>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3 text-xs">
              {statusError && (
                <div className="p-3 bg-rose-950/50 border border-rose-800/50 rounded-lg text-rose-300 font-mono text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{statusError}</span>
                </div>
              )}

              <p className="text-neutral-300 font-sans">
                Are you sure you want to change the status of member{' '}
                <span className="font-semibold text-neutral-100">
                  {statusTarget.member.name}
                </span>{' '}
                ({statusTarget.member.unique_id})?
              </p>

              <div className="p-3 bg-neutral-950/50 rounded-lg border border-neutral-800 flex items-center justify-between font-mono text-xs">
                <div>
                  <div className="text-[10px] text-neutral-500 uppercase">Current Status</div>
                  <div className="mt-0.5">{renderStatusBadge(statusTarget.member.status)}</div>
                </div>
                <span className="text-neutral-500">→</span>
                <div>
                  <div className="text-[10px] text-neutral-500 uppercase">New Status</div>
                  <div className="mt-0.5">{renderStatusBadge(statusTarget.nextStatus)}</div>
                </div>
              </div>

              <div className="p-2.5 bg-neutral-950/30 rounded border border-neutral-800/60 text-[11px] text-neutral-400 font-mono leading-relaxed">
                {statusTarget.nextStatus === 'ACTIVE' &&
                  'The member will be verified and active on public showcase rosters.'}
                {statusTarget.nextStatus === 'INACTIVE' &&
                  'The member remains securely stored in the SQLite database with their permanent ID, but will be marked inactive.'}
                {statusTarget.nextStatus === 'ALUMNI' &&
                  'The member remains in the database with alumni recognition.'}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-800 bg-neutral-950/50">
              <button
                type="button"
                onClick={() => setStatusTarget(null)}
                disabled={isUpdatingStatus}
                className="px-3.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 text-xs font-mono transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={isUpdatingStatus}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm disabled:opacity-50 transition-colors"
              >
                {isUpdatingStatus && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isUpdatingStatus ? 'Updating...' : 'Confirm Status Change'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={(res) => {
          setIsImportOpen(false);
          triggerFlash(`Successfully imported ${res.totalProcessed} members (${res.createdCount} created, ${res.updatedCount} updated).`);
          loadMembers();
        }}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        currentFilters={{
          status: statusFilter !== 'all' ? statusFilter : undefined,
          role: roleFilter || undefined,
          domain: domainFilter || undefined,
          department: departmentFilter || undefined,
          q: searchQuery || undefined,
          sort: sortKey,
        }}
        totalFiltered={total}
        totalAll={total}
      />
    </div>
  );
};
