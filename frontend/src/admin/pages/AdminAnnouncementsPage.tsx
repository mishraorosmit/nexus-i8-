/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Megaphone,
  Plus,
  Search,
  Eye,
  Edit,
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Calendar,
  ArrowUpDown,
  Filter,
  Trash2,
  Loader2,
  Check,
  Sparkles,
  AlertTriangle,
  Archive,
  Send,
  FileText,
  Copy,
  ExternalLink,
  Flame,
} from 'lucide-react';
import {
  AdminAnnouncement,
  AdminAnnouncementFacets,
  AnnouncementStatus,
  AnnouncementPriority,
} from '../types.ts';
import {
  adminGetAnnouncements,
  adminCreateAnnouncement,
  adminUpdateAnnouncement,
  adminPublishAnnouncement,
  adminUnpublishAnnouncement,
  adminArchiveAnnouncement,
  adminDeleteAnnouncement,
} from '../api.ts';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const AdminAnnouncementsPage: React.FC = () => {
  // -------------------------------------------------------------
  // State: Listing, Filters, Telemetry
  // -------------------------------------------------------------
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [facets, setFacets] = useState<AdminAnnouncementFacets>({
    total: 0,
    published: 0,
    draft: 0,
    archived: 0,
    urgent: 0,
    expired: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('updated_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Slide-over Drawer State (Create / Edit)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AdminAnnouncement | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    summary: '',
    body: '',
    priority: 'Normal' as AnnouncementPriority,
    status: 'draft' as AnnouncementStatus,
    hasExpiry: false,
    expiresAt: '',
  });
  const [isAutoSlug, setIsAutoSlug] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Preview Modal
  const [previewAnnouncement, setPreviewAnnouncement] = useState<AdminAnnouncement | null>(null);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<AdminAnnouncement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminGetAnnouncements({
        page,
        limit,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search: search.trim() || undefined,
        sort: sortField,
        order: sortOrder,
      });

      if (res.success) {
        setAnnouncements(res.data);
        if (res.meta) {
          setTotal(res.meta.total);
          if (res.meta.facets) {
            setFacets(res.meta.facets);
          }
        }
      } else {
        setError(res.error || 'Failed to load announcements.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error fetching announcements.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, priorityFilter, search, sortField, sortOrder]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Toast message auto-dismiss
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  // -------------------------------------------------------------
  // Drawer Actions
  // -------------------------------------------------------------
  const openCreateDrawer = () => {
    setEditingAnnouncement(null);
    setFormData({
      title: '',
      slug: '',
      summary: '',
      body: '',
      priority: 'Normal',
      status: 'draft',
      hasExpiry: false,
      expiresAt: '',
    });
    setIsAutoSlug(true);
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (ann: AdminAnnouncement) => {
    setEditingAnnouncement(ann);
    setFormData({
      title: ann.title,
      slug: ann.slug || ann.id,
      summary: ann.summary,
      body: ann.body,
      priority: ann.priority,
      status: ann.publish_status,
      hasExpiry: Boolean(ann.expires_at),
      expiresAt: ann.expires_at ? new Date(ann.expires_at).toISOString().slice(0, 16) : '',
    });
    setIsAutoSlug(false);
    setFormError(null);
    setDrawerOpen(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({
      ...prev,
      title: val,
      slug: isAutoSlug ? slugify(val) : prev.slug,
    }));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsAutoSlug(false);
    setFormData((prev) => ({ ...prev, slug: slugify(e.target.value) }));
  };

  const setExpiryPreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 0, 0);
    setFormData((prev) => ({
      ...prev,
      hasExpiry: true,
      expiresAt: d.toISOString().slice(0, 16),
    }));
  };

  const handleSaveAnnouncement = async (overrideStatus?: AnnouncementStatus) => {
    setFormError(null);
    if (!formData.title.trim()) {
      setFormError('Announcement title is required.');
      return;
    }
    if (!formData.summary.trim()) {
      setFormError('Announcement summary is required.');
      return;
    }

    let calculatedExpiresAt: string | null = null;
    if (formData.hasExpiry && formData.expiresAt) {
      const expDate = new Date(formData.expiresAt);
      if (isNaN(expDate.getTime())) {
        setFormError('Invalid expiration date format.');
        return;
      }
      if (expDate.getTime() <= Date.now()) {
        setFormError('Expiration date must be in the future.');
        return;
      }
      calculatedExpiresAt = expDate.toISOString();
    }

    setIsSubmitting(true);
    const targetStatus = overrideStatus || formData.status;

    try {
      if (editingAnnouncement) {
        // Update
        const res = await adminUpdateAnnouncement(
          editingAnnouncement.id,
          {
            title: formData.title.trim(),
            slug: formData.slug.trim() || undefined,
            summary: formData.summary.trim(),
            body: (formData.body || formData.summary).trim(),
            priority: formData.priority,
            status: targetStatus,
            expiresAt: calculatedExpiresAt,
          },
          editingAnnouncement.updated_at
        );

        if (res.success) {
          setSuccessMessage(`Announcement "${formData.title}" updated successfully.`);
          setDrawerOpen(false);
          fetchAnnouncements();
        } else {
          setFormError(res.error || 'Failed to update announcement.');
        }
      } else {
        // Create
        const res = await adminCreateAnnouncement({
          title: formData.title.trim(),
          slug: formData.slug.trim() || undefined,
          summary: formData.summary.trim(),
          body: (formData.body || formData.summary).trim(),
          priority: formData.priority,
          status: targetStatus,
          expiresAt: calculatedExpiresAt,
        });

        if (res.success) {
          setSuccessMessage(`Announcement created and marked as ${targetStatus}.`);
          setDrawerOpen(false);
          fetchAnnouncements();
        } else {
          setFormError(res.error || 'Failed to create announcement.');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'Unexpected communication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Quick State Transitions
  // -------------------------------------------------------------
  const handlePublish = async (ann: AdminAnnouncement) => {
    try {
      const res = await adminPublishAnnouncement(ann.id);
      if (res.success) {
        setSuccessMessage(`Announcement "${ann.title}" is now published.`);
        fetchAnnouncements();
      } else {
        setError(res.error || 'Failed to publish.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error publishing announcement.');
    }
  };

  const handleUnpublish = async (ann: AdminAnnouncement) => {
    try {
      const res = await adminUnpublishAnnouncement(ann.id);
      if (res.success) {
        setSuccessMessage(`Announcement "${ann.title}" moved back to draft.`);
        fetchAnnouncements();
      } else {
        setError(res.error || 'Failed to unpublish.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error unpublishing announcement.');
    }
  };

  const handleArchive = async (ann: AdminAnnouncement) => {
    try {
      const res = await adminArchiveAnnouncement(ann.id);
      if (res.success) {
        setSuccessMessage(`Announcement "${ann.title}" has been archived.`);
        fetchAnnouncements();
      } else {
        setError(res.error || 'Failed to archive.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error archiving announcement.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await adminDeleteAnnouncement(deleteTarget.id);
      if (res.success) {
        setSuccessMessage(`Announcement "${deleteTarget.title}" deleted.`);
        setDeleteTarget(null);
        fetchAnnouncements();
      } else {
        setError(res.error || 'Failed to delete announcement.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error deleting announcement.');
    } finally {
      setIsDeleting(false);
    }
  };

  const copySlug = (slug: string, id: string) => {
    navigator.clipboard.writeText(slug);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Expiration helper
  const getExpirationStatus = (expiresAt: string | null) => {
    if (!expiresAt) return { label: 'No Expiry', color: 'text-neutral-500' };
    const exp = new Date(expiresAt).getTime();
    const now = Date.now();
    const diffHours = (exp - now) / (1000 * 60 * 60);

    if (diffHours <= 0) {
      return { label: 'Expired', color: 'text-red-400 font-semibold bg-red-950/40 px-2 py-0.5 rounded border border-red-800/60' };
    }
    if (diffHours <= 48) {
      return { label: `Expires in ${Math.ceil(diffHours)}h`, color: 'text-amber-400 font-semibold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60' };
    }
    const days = Math.ceil(diffHours / 24);
    return { label: `Expires in ${days}d`, color: 'text-neutral-400' };
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>Announcements & Public Notices</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                  Phase 18
                </span>
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Targeted content management for bulletins, recruitment schedules, and operational alerts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchAnnouncements}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh announcement roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white shadow-sm shadow-orange-950/40 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Announcement</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-emerald-200 text-xs flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/50 border border-red-800/60 text-red-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Telemetry Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Total Notices</div>
          <div className="text-xl font-bold text-white font-mono mt-1">{facets.total}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">All lifecycle states</div>
        </div>

        <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Published</span>
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">{facets.published}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Live on public website</div>
        </div>

        <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">Drafts</div>
          <div className="text-xl font-bold text-amber-400 font-mono mt-1">{facets.draft}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Unpublished WIP</div>
        </div>

        <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Archived</div>
          <div className="text-xl font-bold text-neutral-400 font-mono mt-1">{facets.archived}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Historical records</div>
        </div>

        <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-mono text-red-400 uppercase tracking-wider flex items-center gap-1">
            <Flame className="w-3 h-3 text-red-400" />
            <span>Urgent</span>
          </div>
          <div className="text-xl font-bold text-red-400 font-mono mt-1">{facets.urgent}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">High priority beacon</div>
        </div>

        <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-mono text-rose-400 uppercase tracking-wider">Past Expiry</div>
          <div className="text-xl font-bold text-rose-400 font-mono mt-1">{facets.expired}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Auto-hidden from public</div>
        </div>
      </div>

      {/* 3. Control & Filter Bar */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 bg-neutral-950/80 rounded-lg border border-neutral-800/80 overflow-x-auto">
          {[
            { id: 'all', label: 'All Notices', count: facets.total },
            { id: 'published', label: 'Published', count: facets.published },
            { id: 'draft', label: 'Drafts', count: facets.draft },
            { id: 'archived', label: 'Archived', count: facets.archived },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-neutral-800 text-white shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] font-mono opacity-70 px-1 py-0.2 rounded bg-neutral-900">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search, Priority & Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="Normal">Normal</option>
            <option value="Urgent">Urgent</option>
          </select>

          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, summary, slug..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-orange-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <select
            value={`${sortField}_${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('_');
              setSortField(field);
              setSortOrder(order as 'ASC' | 'DESC');
            }}
            className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="updated_at_DESC">Recently Updated</option>
            <option value="created_at_DESC">Newest Created</option>
            <option value="published_at_DESC">Recently Published</option>
            <option value="expires_at_ASC">Expiring Soonest</option>
            <option value="title_ASC">Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* 4. Announcements Roster Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading && announcements.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            <span className="text-xs font-mono">Loading announcements from SQLite...</span>
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Megaphone className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-neutral-300">No Announcements Found</div>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              {search || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No announcements match the active query filters. Try resetting your search or filter criteria.'
                : 'No announcements have been created yet. Click "New Announcement" to compose the first public bulletin.'}
            </p>
            <button
              type="button"
              onClick={openCreateDrawer}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Announcement</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/60 border-b border-neutral-800 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-medium">Status & Priority</th>
                  <th className="py-3 px-4 font-medium">Title & Slug</th>
                  <th className="py-3 px-4 font-medium">Summary</th>
                  <th className="py-3 px-4 font-medium">Publication Date</th>
                  <th className="py-3 px-4 font-medium">Expiry</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {announcements.map((ann) => {
                  const expiryInfo = getExpirationStatus(ann.expires_at);

                  return (
                    <tr key={ann.id} className="hover:bg-neutral-850/40 transition-colors group">
                      {/* Status & Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                              ann.publish_status === 'published'
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                : ann.publish_status === 'draft'
                                ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                ann.publish_status === 'published'
                                  ? 'bg-emerald-400'
                                  : ann.publish_status === 'draft'
                                  ? 'bg-amber-400'
                                  : 'bg-neutral-500'
                              }`}
                            />
                            {ann.publish_status.toUpperCase()}
                          </span>

                          {ann.priority === 'Urgent' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/60 text-red-400 border border-red-800/60">
                              <Flame className="w-2.5 h-2.5 text-red-400" />
                              URGENT
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Title & Slug */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-white truncate group-hover:text-orange-400 transition-colors">
                          {ann.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono mt-0.5">
                          <span className="truncate">/{ann.slug}</span>
                          <button
                            type="button"
                            onClick={() => copySlug(ann.slug, ann.id)}
                            className="text-neutral-500 hover:text-neutral-300 transition-colors p-0.5"
                            title="Copy slug to clipboard"
                          >
                            {copiedId === ann.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Summary */}
                      <td className="py-3.5 px-4 text-neutral-400 max-w-sm">
                        <p className="line-clamp-2 leading-relaxed text-[11.5px]">{ann.summary}</p>
                      </td>

                      {/* Publication Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-neutral-400 font-mono text-[11px]">
                        {ann.published_at ? (
                          <div>
                            <div>{new Date(ann.published_at).toLocaleDateString()}</div>
                            <div className="text-neutral-500 text-[10px]">
                              {new Date(ann.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>

                      {/* Expiry */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[11px]">
                        <span className={expiryInfo.color}>{expiryInfo.label}</span>
                        {ann.expires_at && (
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            {new Date(ann.expires_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewAnnouncement(ann)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Preview Public Rendering"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditDrawer(ann)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Edit Announcement"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {ann.publish_status !== 'published' ? (
                            <button
                              type="button"
                              onClick={() => handlePublish(ann)}
                              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-colors cursor-pointer"
                              title="Publish Immediately"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUnpublish(ann)}
                              className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 transition-colors cursor-pointer"
                              title="Move back to Draft"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {ann.publish_status !== 'archived' && (
                            <button
                              type="button"
                              onClick={() => handleArchive(ann)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                              title="Archive Announcement"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(ann)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {total > limit && (
          <div className="py-3 px-4 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
            <span>
              Showing {Math.min((page - 1) * limit + 1, total)} to {Math.min(page * limit, total)} of {total} items
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono px-2">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Slide-over Drawer (Create / Edit) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-neutral-900 border-l border-neutral-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  <Megaphone className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-white">
                  {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body Form */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-300">
                  Announcement Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spring 2027 Cohort Applications Open"
                  value={formData.title}
                  onChange={handleTitleChange}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>

              {/* Slug Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-neutral-300">
                    URL Slug <span className="text-red-400">*</span>
                  </label>
                  <span className="text-[10px] text-neutral-500 font-mono">Lowercase alphanumeric & hyphens</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500 font-mono">/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={handleSlugChange}
                    placeholder="spring-2027-cohort-applications-open"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 font-mono placeholder:text-neutral-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Priority & Status Controls */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-300">Priority Level</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value as AnnouncementPriority }))}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="Normal">Normal (Standard Bulletin)</option>
                    <option value="Urgent">Urgent (High-Priority Alert)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-300">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as AnnouncementStatus }))}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="draft">Draft (Private WIP)</option>
                    <option value="published">Published (Live Public)</option>
                    <option value="archived">Archived (Historical)</option>
                  </select>
                </div>
              </div>

              {/* Summary Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-neutral-300">
                    Summary / Headline <span className="text-red-400">*</span>
                  </label>
                  <span className="text-[10px] text-neutral-500">Rendered in the slim public banner</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="Concise overview of the bulletin..."
                  value={formData.summary}
                  onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 resize-none leading-relaxed"
                />
              </div>

              {/* Detailed Body Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-neutral-300">Full Announcement Body</label>
                  <span className="text-[10px] text-neutral-500">Rendered in the detailed modal</span>
                </div>
                <textarea
                  rows={6}
                  placeholder="Detailed guidelines, deadlines, room locations, or requirements..."
                  value={formData.body}
                  onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 resize-y leading-relaxed font-mono text-[11px]"
                />
              </div>

              {/* Expiration Settings */}
              <div className="p-3.5 rounded-lg bg-neutral-950/80 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-neutral-200">Scheduled Expiration</span>
                    <p className="text-[11px] text-neutral-500">Automatically hide bulletin from public when reached</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasExpiry}
                      onChange={(e) => setFormData((prev) => ({ ...prev, hasExpiry: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-600" />
                  </label>
                </div>

                {formData.hasExpiry && (
                  <div className="space-y-2 pt-1 border-t border-neutral-850">
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData((prev) => ({ ...prev, expiresAt: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-orange-500 font-mono"
                    />
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-neutral-500">Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => setExpiryPreset(7)}
                        className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 cursor-pointer"
                      >
                        +7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpiryPreset(14)}
                        className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 cursor-pointer"
                      >
                        +14 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpiryPreset(30)}
                        className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 cursor-pointer"
                      >
                        +30 Days
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSaveAnnouncement('draft')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSaveAnnouncement('published')}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Publish Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Public Preview Modal */}
      {previewAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                <Eye className="w-4 h-4 text-orange-400" />
                <span>Simulated Student / Public View</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAnnouncement(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Public Banner Simulator */}
            <div className="p-4 bg-neutral-950 border-b border-neutral-850">
              <div className="text-[10px] font-mono uppercase text-neutral-500 mb-1.5">Top Banner Simulation:</div>
              <div className="p-2.5 rounded-xl bg-orange-950/30 border border-orange-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
                  {previewAnnouncement.priority === 'Urgent' && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-600 text-white shrink-0">
                      URGENT
                    </span>
                  )}
                  <span className="text-xs font-medium text-neutral-200 truncate">
                    {previewAnnouncement.title}: {previewAnnouncement.summary}
                  </span>
                </div>
                <span className="text-[11px] text-orange-400 underline font-medium shrink-0">Read More →</span>
              </div>
            </div>

            {/* Modal Detail Simulator */}
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-800 text-neutral-300">
                  NEXUS OFFICIAL BULLETIN
                </span>
                {previewAnnouncement.priority === 'Urgent' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/80 text-red-400 border border-red-800/60">
                    URGENT PRIORITY
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-white tracking-tight">{previewAnnouncement.title}</h3>

              <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-3">
                <span>
                  Published:{' '}
                  {previewAnnouncement.published_at
                    ? new Date(previewAnnouncement.published_at).toLocaleDateString()
                    : 'Unpublished Draft'}
                </span>
                {previewAnnouncement.expires_at && (
                  <span>Expires: {new Date(previewAnnouncement.expires_at).toLocaleDateString()}</span>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 leading-relaxed font-sans">
                {previewAnnouncement.body || previewAnnouncement.summary}
              </div>
            </div>

            <div className="p-3 border-t border-neutral-800 bg-neutral-950/60 text-right">
              <button
                type="button"
                onClick={() => setPreviewAnnouncement(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 rounded-xl bg-red-950/60 border border-red-800/60">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Delete Announcement</h3>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-white">"{deleteTarget.title}"</span>?
              This record will be permanently removed from SQLite and an audit log event will be recorded.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Announcement</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
