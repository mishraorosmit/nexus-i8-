import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { fetchAdminAuditLogs } from '../api.ts';
import {
  AuditLogItem,
  AuditLogFilters,
  AuditLogPaginationMeta,
  AdminRoute,
} from '../types.ts';
import {
  History,
  RefreshCw,
  Search,
  Filter,
  Clock,
  User,
  Shield,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Code,
  Copy,
  Check,
  X,
  AlertCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  Settings,
  Layers,
  Sparkles,
} from 'lucide-react';

interface AdminAuditPageProps {
  onNavigate: (route: AdminRoute) => void;
}

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MEMBER_CREATED: { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-800/60' },
  MEMBER_UPDATED: { bg: 'bg-sky-950/60', text: 'text-sky-400', border: 'border-sky-800/60' },
  MEMBER_STATUS_CHANGED: { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-800/60' },
  MEMBER_DELETED: { bg: 'bg-rose-950/60', text: 'text-rose-400', border: 'border-rose-800/60' },
  IMAGE_UPLOADED: { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-800/60' },
  IMAGE_REPLACED: { bg: 'bg-purple-950/60', text: 'text-purple-400', border: 'border-purple-800/60' },
  IMAGE_REMOVED: { bg: 'bg-rose-950/60', text: 'text-rose-400', border: 'border-rose-800/60' },
  BULK_IMPORT: { bg: 'bg-indigo-950/60', text: 'text-indigo-400', border: 'border-indigo-800/60' },
  SETTINGS_CHANGED: { bg: 'bg-cyan-950/60', text: 'text-cyan-400', border: 'border-cyan-800/60' },
  LOGIN_SUCCESS: { bg: 'bg-teal-950/60', text: 'text-teal-400', border: 'border-teal-800/60' },
  LOGIN_FAILED: { bg: 'bg-rose-950/60', text: 'text-rose-400', border: 'border-rose-800/60' },
  PASSWORD_CHANGED: { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-800/60' },
};

function formatActionBadge(action: string) {
  const conf = ACTION_COLORS[action] || {
    bg: 'bg-neutral-900',
    text: 'text-neutral-300',
    border: 'border-neutral-800',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${conf.bg} ${conf.text} ${conf.border}`}
    >
      {action}
    </span>
  );
}

function formatEntityTypeBadge(entityType: string) {
  let icon = <Layers className="w-3 h-3 mr-1" />;
  if (entityType.includes('member')) icon = <User className="w-3 h-3 mr-1" />;
  if (entityType.includes('image')) icon = <ImageIcon className="w-3 h-3 mr-1" />;
  if (entityType.includes('import')) icon = <FileSpreadsheet className="w-3 h-3 mr-1" />;
  if (entityType.includes('setting')) icon = <Settings className="w-3 h-3 mr-1" />;

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-900 text-neutral-300 border border-neutral-800">
      {icon}
      {entityType}
    </span>
  );
}

function formatDate(isoString: string) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

export const AdminAuditPage: React.FC<AdminAuditPageProps> = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [meta, setMeta] = useState<AuditLogPaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [entityIdFilter, setEntityIdFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Selected Log for Inspector Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');

  // Metrics summary
  const [metrics, setMetrics] = useState({
    totalLogs: 0,
    memberMutations: 0,
    mediaMutations: 0,
    bulkImports: 0,
  });

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const filterParams: AuditLogFilters = {
      page,
      limit,
      action: actionFilter || undefined,
      entityType: entityTypeFilter || undefined,
      entityId: entityIdFilter || undefined,
      search: searchQuery || undefined,
    };

    const res = await fetchAdminAuditLogs(filterParams);
    if (res.success && res.data) {
      setLogs(res.data);
      if (res.meta) {
        setMeta(res.meta);
      }
      setIsLoading(false);
    } else {
      setError(res.error || 'Failed to load audit logs.');
      setIsLoading(false);
    }
  }, [page, limit, actionFilter, entityTypeFilter, entityIdFilter, searchQuery]);

  // Load summary metrics once on mount or when refreshed
  const loadMetrics = useCallback(async () => {
    try {
      const [allRes, memberRes, mediaRes, bulkRes] = await Promise.all([
        fetchAdminAuditLogs({ limit: 1 }),
        fetchAdminAuditLogs({ entityType: 'member', limit: 1 }),
        fetchAdminAuditLogs({ entityType: 'member_image', limit: 1 }),
        fetchAdminAuditLogs({ action: 'BULK_IMPORT', limit: 1 }),
      ]);
      setMetrics({
        totalLogs: allRes.meta?.total || 0,
        memberMutations: memberRes.meta?.total || 0,
        mediaMutations: mediaRes.meta?.total || 0,
        bulkImports: bulkRes.meta?.total || 0,
      });
    } catch (e) {
      console.error('Failed to load audit metrics', e);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setActionFilter('');
    setEntityTypeFilter('');
    setEntityIdFilter('');
    setPage(1);
  };

  const handleCopyJson = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  // Diff comparison calculations
  const diffComparison = useMemo(() => {
    if (!selectedLog) return null;
    const before = (selectedLog.before_json || {}) as Record<string, any>;
    const after = (selectedLog.after_json || {}) as Record<string, any>;

    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return allKeys.map((key) => {
      const bVal = before[key];
      const aVal = after[key];
      const bStr = bVal !== undefined ? JSON.stringify(bVal) : undefined;
      const aStr = aVal !== undefined ? JSON.stringify(aVal) : undefined;
      const changed = bStr !== aStr;
      return {
        key,
        before: bVal,
        after: aVal,
        beforeFormatted: bStr ?? '— (null)',
        afterFormatted: aStr ?? '— (null)',
        isNew: bVal === undefined && aVal !== undefined,
        isRemoved: bVal !== undefined && aVal === undefined,
        isChanged: changed && bVal !== undefined && aVal !== undefined,
      };
    });
  }, [selectedLog]);

  return (
    <div className="space-y-6 max-w-7xl pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <History className="w-5 h-5 text-indigo-400" />
            Audit Ledger & Change Tracking
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Immutable administrative mutation ledger tracking WHO, WHAT, WHEN, TO WHICH ENTITY, BEFORE, AFTER, and RESULT.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              fetchLogs();
              loadMetrics();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-indigo-950/60 text-indigo-400 border border-indigo-800/60">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            Super Admin Context
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200 text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="font-mono text-[11px] uppercase tracking-wider">Total Recorded Logs</span>
            <History className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {metrics.totalLogs.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">Persistent in SQLite ledger</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="font-mono text-[11px] uppercase tracking-wider">Member Mutations</span>
            <User className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            {metrics.memberMutations.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">Create, update, status, delete</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="font-mono text-[11px] uppercase tracking-wider">Media Mutations</span>
            <ImageIcon className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-sky-400">
            {metrics.mediaMutations.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">Cloudinary avatar operations</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="font-mono text-[11px] uppercase tracking-wider">Bulk Import Batches</span>
            <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-indigo-400">
            {metrics.bulkImports.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">Transactional CSV/JSON syncs</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search keyword, actor, ID, details..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Actions</option>
              <option value="MEMBER_CREATED">MEMBER_CREATED</option>
              <option value="MEMBER_UPDATED">MEMBER_UPDATED</option>
              <option value="MEMBER_STATUS_CHANGED">MEMBER_STATUS_CHANGED</option>
              <option value="MEMBER_DELETED">MEMBER_DELETED</option>
              <option value="IMAGE_UPLOADED">IMAGE_UPLOADED</option>
              <option value="IMAGE_REPLACED">IMAGE_REPLACED</option>
              <option value="IMAGE_REMOVED">IMAGE_REMOVED</option>
              <option value="BULK_IMPORT">BULK_IMPORT</option>
              <option value="SETTINGS_CHANGED">SETTINGS_CHANGED</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="LOGIN_FAILED">LOGIN_FAILED</option>
              <option value="PASSWORD_CHANGED">PASSWORD_CHANGED</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <select
              value={entityTypeFilter}
              onChange={(e) => {
                setEntityTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Entity Types</option>
              <option value="member">member</option>
              <option value="member_image">member_image</option>
              <option value="bulk_import">bulk_import</option>
              <option value="site_settings">site_settings</option>
              <option value="auth">auth</option>
            </select>
          </div>

          {/* Entity ID Filter */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Entity ID (e.g. NX-001)"
              value={entityIdFilter}
              onChange={(e) => {
                setEntityIdFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            {(searchInput || actionFilter || entityTypeFilter || entityIdFilter) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs transition-colors shrink-0"
                title="Clear Filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-neutral-950/60 border-b border-neutral-800 text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="py-3 px-4">When (UTC)</th>
                <th className="py-3 px-4">Who (Actor)</th>
                <th className="py-3 px-4">What (Action)</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Summary & Diff</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500 font-mono">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-neutral-400" />
                    Loading audit ledger from database...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <History className="w-6 h-6 mx-auto mb-2 text-neutral-600" />
                    No audit records match the selected criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const hasDiff = log.before_json || log.after_json;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-neutral-800/40 transition-colors cursor-pointer"
                    >
                      {/* When */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-neutral-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{formatDate(log.created_at)}</span>
                        </div>
                      </td>

                      {/* Who */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 font-mono text-[10px]">
                            {log.admin_name ? log.admin_name[0].toUpperCase() : 'A'}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-200">
                              {log.admin_name || 'Admin'}
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono">
                              {log.admin_role || 'super_admin'}
                              {log.ip_address && ` • ${log.ip_address}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* What */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {formatActionBadge(log.action)}
                      </td>

                      {/* Entity */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono">
                        <div className="flex items-center gap-1.5">
                          {formatEntityTypeBadge(log.entity_type)}
                          <span className="text-[11px] text-indigo-400 font-semibold">
                            {log.entity_id}
                          </span>
                        </div>
                      </td>

                      {/* Summary */}
                      <td className="py-3 px-4 max-w-xs truncate text-neutral-400">
                        {log.details ? (
                          <span className="font-mono text-[11px] text-neutral-300">
                            {typeof log.details === 'object'
                              ? Object.entries(log.details)
                                  .filter(([k]) => !['password', 'secret', 'token'].includes(k))
                                  .slice(0, 3)
                                  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                                  .join(', ')
                              : String(log.details)}
                          </span>
                        ) : (
                          <span className="text-neutral-500 italic text-[11px]">No extra details</span>
                        )}
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            hasDiff
                              ? 'bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/60'
                              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{hasDiff ? 'View Diff' : 'Details'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-t border-neutral-800 bg-neutral-950/40 text-xs text-neutral-400 font-mono">
          <div className="flex items-center gap-3">
            <span>
              Showing {meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1} to{' '}
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} records
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-neutral-500">Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-xs text-neutral-300 focus:outline-none focus:border-indigo-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!meta.hasPrev || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 text-neutral-300">
              {meta.page} / {meta.totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => (meta.hasNext ? p + 1 : p))}
              disabled={!meta.hasNext || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Side-by-Side Diff Inspector Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {formatActionBadge(selectedLog.action)}
                  {formatEntityTypeBadge(selectedLog.entity_type)}
                  <span className="font-mono text-xs font-semibold text-indigo-300">
                    {selectedLog.entity_id}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-mono">
                  <span>Actor: {selectedLog.admin_name || 'Admin'}</span>
                  <span>•</span>
                  <span>{formatDate(selectedLog.created_at)}</span>
                  {selectedLog.ip_address && (
                    <>
                      <span>•</span>
                      <span>IP: {selectedLog.ip_address}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Visual vs Raw JSON toggle */}
                <div className="flex rounded-lg bg-neutral-950 border border-neutral-800 p-0.5 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setViewMode('visual')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      viewMode === 'visual'
                        ? 'bg-indigo-900/60 text-indigo-200 font-medium'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Visual Diff
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('raw')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      viewMode === 'raw'
                        ? 'bg-indigo-900/60 text-indigo-200 font-medium'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyJson(selectedLog)}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                  title="Copy Full Log Record JSON"
                >
                  {copiedRaw ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Event Details / Summary Banner */}
              {selectedLog.details && (
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 text-xs">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    Mutation Details & Result Context
                  </div>
                  <pre className="font-mono text-[11px] text-neutral-300 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {viewMode === 'visual' ? (
                <div>
                  {diffComparison && diffComparison.length > 0 ? (
                    <div className="border border-neutral-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-neutral-950/80 border-b border-neutral-800 text-[11px] uppercase text-neutral-400">
                          <tr>
                            <th className="py-2.5 px-3 w-1/4">Field / Key</th>
                            <th className="py-2.5 px-3 w-3/8 text-rose-300">Before Mutation</th>
                            <th className="py-2.5 px-3 w-3/8 text-emerald-300">After Mutation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/60">
                          {diffComparison.map((row) => (
                            <tr
                              key={row.key}
                              className={
                                row.isChanged
                                  ? 'bg-amber-950/15'
                                  : row.isNew
                                  ? 'bg-emerald-950/15'
                                  : row.isRemoved
                                  ? 'bg-rose-950/15'
                                  : ''
                              }
                            >
                              <td className="py-2 px-3 font-semibold text-neutral-300 align-top">
                                <span>{row.key}</span>
                                {row.isChanged && (
                                  <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-amber-950/60 text-amber-400 border border-amber-800/60 font-sans">
                                    MODIFIED
                                  </span>
                                )}
                                {row.isNew && (
                                  <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-sans">
                                    ADDED
                                  </span>
                                )}
                                {row.isRemoved && (
                                  <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-rose-950/60 text-rose-400 border border-rose-800/60 font-sans">
                                    REMOVED
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-neutral-400 break-all align-top">
                                <span className={row.isChanged || row.isRemoved ? 'text-rose-400 font-medium' : ''}>
                                  {row.beforeFormatted}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-neutral-400 break-all align-top">
                                <span className={row.isChanged || row.isNew ? 'text-emerald-400 font-medium' : ''}>
                                  {row.afterFormatted}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-lg">
                      No before/after diff snapshot was recorded for this event.
                    </div>
                  )}
                </div>
              ) : (
                /* Raw JSON side-by-side */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400 mb-2 flex items-center justify-between">
                      <span>Before State Snapshot</span>
                    </div>
                    <pre className="font-mono text-[11px] text-neutral-300 overflow-x-auto max-h-96 whitespace-pre-wrap">
                      {selectedLog.before_json
                        ? JSON.stringify(selectedLog.before_json, null, 2)
                        : 'null'}
                    </pre>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-2 flex items-center justify-between">
                      <span>After State Snapshot</span>
                    </div>
                    <pre className="font-mono text-[11px] text-neutral-300 overflow-x-auto max-h-96 whitespace-pre-wrap">
                      {selectedLog.after_json
                        ? JSON.stringify(selectedLog.after_json, null, 2)
                        : 'null'}
                    </pre>
                  </div>
                </div>
              )}

              {/* Admin Context Info */}
              {selectedLog.admin_context && (
                <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/60 text-[11px] font-mono text-neutral-400 flex flex-wrap gap-x-6 gap-y-1">
                  <span>Actor Context: {selectedLog.admin_context.actor || 'authenticated-admin'}</span>
                  <span>Role: {selectedLog.admin_context.adminRole || 'super_admin'}</span>
                  {selectedLog.admin_context.adminId && (
                    <span>Admin ID: {selectedLog.admin_context.adminId}</span>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
