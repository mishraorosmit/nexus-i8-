import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  AdminMediaAsset,
  AdminMediaFacets,
  MediaCategory,
  MediaUsageStatus,
  AdminRoute,
} from '../types.ts';
import {
  adminGetMediaList,
  adminUploadMedia,
  adminReplaceMedia,
  adminUpdateMedia,
  adminDeleteMedia,
} from '../api.ts';
import {
  Image as ImageIcon,
  Search,
  Filter,
  Upload,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Info,
  AlertTriangle,
  X,
  Layers,
  HardDrive,
  CheckCircle2,
  HelpCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileEdit,
  LayoutGrid,
  List as ListIcon,
  ShieldAlert,
} from 'lucide-react';

interface AdminMediaPageProps {
  onNavigate: (route: AdminRoute) => void;
}

const CATEGORIES: { id: MediaCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Categories' },
  { id: 'member', label: 'Members' },
  { id: 'project', label: 'Projects' },
  { id: 'event', label: 'Events' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'branding', label: 'Branding' },
  { id: 'general', label: 'General' },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  if (!iso) return 'Unknown';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const AdminMediaPage: React.FC<AdminMediaPageProps> = ({ onNavigate }) => {
  const uploadCategorySelectId = useId();
  const [assets, setAssets] = useState<AdminMediaAsset[]>([]);
  const [facets, setFacets] = useState<AdminMediaFacets | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination state
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUsage, setSelectedUsage] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_desc');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal states
  const [previewAsset, setPreviewAsset] = useState<AdminMediaAsset | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [replaceAsset, setReplaceAsset] = useState<AdminMediaAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminMediaAsset | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit metadata form inside preview modal
  const [editAltText, setEditAltText] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [isSavingMeta, setIsSavingMeta] = useState<boolean>(false);

  // Upload modal state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>('general');
  const [uploadAltText, setUploadAltText] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Replace modal state
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacePreviewUrl, setReplacePreviewUrl] = useState<string | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  // Fetch Media Assets
  const loadMedia = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const res = await adminGetMediaList({
      page,
      limit: 24,
      search: search.trim() || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      usage: selectedUsage !== 'all' ? selectedUsage : undefined,
      format: selectedFormat !== 'all' ? selectedFormat : undefined,
      sort: sortBy,
    });

    if (res.success) {
      setAssets(res.data);
      setPage(res.meta.page);
      setTotalPages(res.meta.totalPages);
      setTotalCount(res.meta.total);
      if (res.meta.facets) {
        setFacets(res.meta.facets);
      }
    } else {
      setError(res.error || 'Failed to load media assets');
    }
    setIsLoading(false);
  }, [page, search, selectedCategory, selectedUsage, selectedFormat, sortBy]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // Copy CDN URL with feedback
  const handleCopyUrl = (asset: AdminMediaAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = asset.secure_url || asset.url;
    if (!url) return;

    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Details Modal
  const openPreview = (asset: AdminMediaAsset) => {
    setPreviewAsset(asset);
    setEditAltText(asset.alt_text || '');
    setEditCategory(asset.category || 'general');
  };

  // Save inline metadata changes
  const handleSaveMetadata = async () => {
    if (!previewAsset) return;
    setIsSavingMeta(true);

    const res = await adminUpdateMedia(previewAsset.id, {
      alt_text: editAltText,
      category: editCategory,
    });

    if (res.success && res.data) {
      setPreviewAsset(res.data);
      setAssets((prev) => prev.map((a) => (a.id === res.data!.id ? res.data! : a)));
      loadMedia();
    } else {
      alert(res.error || 'Failed to update metadata');
    }
    setIsSavingMeta(false);
  };

  // Handle Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please choose a file to upload');
      return;
    }

    setActionLoading(true);
    setUploadError(null);

    const res = await adminUploadMedia(uploadFile, uploadCategory, uploadAltText.trim() || undefined);
    if (res.success) {
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadPreviewUrl(null);
      setUploadAltText('');
      loadMedia();
    } else {
      setUploadError(res.error || 'Failed to upload asset');
    }
    setActionLoading(false);
  };

  // Handle Replace
  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceAsset || !replaceFile) {
      setReplaceError('Please choose a new image file');
      return;
    }

    setActionLoading(true);
    setReplaceError(null);

    const res = await adminReplaceMedia(replaceAsset.id, replaceFile);
    if (res.success && res.data) {
      setReplaceAsset(null);
      setReplaceFile(null);
      setReplacePreviewUrl(null);
      if (previewAsset && previewAsset.id === res.data.id) {
        setPreviewAsset(res.data);
      }
      loadMedia();
    } else {
      setReplaceError(res.error || 'Failed to replace asset');
    }
    setActionLoading(false);
  };

  // Handle Safe Delete
  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);

    const res = await adminDeleteMedia(deleteTarget.id);
    if (res.success) {
      setDeleteTarget(null);
      if (previewAsset && previewAsset.id === deleteTarget.id) {
        setPreviewAsset(null);
      }
      loadMedia();
    } else {
      alert(res.error || 'Cannot delete asset');
    }
    setActionLoading(false);
  };

  const getUsageBadge = (status: MediaUsageStatus, count: number) => {
    switch (status) {
      case 'USED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            USED ({count})
          </span>
        );
      case 'UNUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-amber-950/60 border border-amber-500/40 text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            UNUSED
          </span>
        );
      case 'UNKNOWN':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-neutral-900 border border-neutral-700 text-neutral-400">
            <HelpCircle className="w-2.5 h-2.5" />
            UNKNOWN
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Telemetry Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white tracking-wide flex items-center gap-2">
                Media Library
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-normal">
                  Cloudinary CDN + SQLite Authoritative
                </span>
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Centralized media asset registry for NEXUS members, projects, events, and branding.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadMedia()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg text-xs font-mono transition-colors disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setUploadFile(null);
              setUploadPreviewUrl(null);
              setUploadError(null);
              setIsUploadOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-medium shadow-lg shadow-cyan-950/50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Media</span>
          </button>
        </div>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Total Assets</span>
            <Layers className="w-4 h-4 text-neutral-500" />
          </div>
          <p className="text-2xl font-mono font-semibold text-white mt-1">
            {facets?.total ?? totalCount}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Used Content</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-mono font-semibold text-emerald-400 mt-1">
            {facets?.used ?? 0}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Unused Media</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-mono font-semibold text-amber-400 mt-1">
            {facets?.unused ?? 0}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Total Volume</span>
            <HardDrive className="w-4 h-4 text-cyan-500" />
          </div>
          <p className="text-2xl font-mono font-semibold text-cyan-400 mt-1">
            {formatBytes(facets?.totalBytes ?? 0)}
          </p>
        </div>
      </div>

      {/* 2. Search & Filter Toolbar */}
      <div className="space-y-3 bg-neutral-900/40 p-3.5 rounded-xl border border-neutral-800/80">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by filename, public ID, alt text..."
              className="w-full pl-9 pr-8 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Usage dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedUsage}
              onChange={(e) => {
                setSelectedUsage(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Usage States</option>
              <option value="used">Used Only</option>
              <option value="unused">Unused Only</option>
              <option value="unknown">Unknown / Static</option>
            </select>

            <select
              value={selectedFormat}
              onChange={(e) => {
                setSelectedFormat(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Formats</option>
              <option value="webp">WebP</option>
              <option value="png">PNG</option>
              <option value="jpeg">JPEG / JPG</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="created_desc">Newest First</option>
              <option value="created_asc">Oldest First</option>
              <option value="size_desc">Largest Size</option>
              <option value="size_asc">Smallest Size</option>
              <option value="name_asc">Name (A-Z)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-neutral-950 p-1 rounded-lg border border-neutral-800">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                title="Table View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const count =
              cat.id === 'all'
                ? facets?.total ?? totalCount
                : facets?.byCategory?.[cat.id] ?? 0;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium'
                    : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400 border border-neutral-800/80'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-cyan-500/30 text-cyan-200' : 'bg-neutral-800 text-neutral-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Media Assets List / Grid */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-400 text-xs font-mono flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-neutral-500 font-mono text-xs gap-3">
          <div className="w-6 h-6 border-2 border-neutral-700 border-t-cyan-400 rounded-full animate-spin" />
          <span>Querying authoritative media metadata...</span>
        </div>
      ) : assets.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20 p-8">
          <ImageIcon className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-mono font-medium text-neutral-300">No media assets found</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            {search || selectedCategory !== 'all' || selectedUsage !== 'all'
              ? 'Try adjusting your search query or filters to discover assets.'
              : 'Upload images to start managing centralized assets in Cloudinary.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {assets.map((asset) => {
            const isCopied = copiedId === asset.id;
            const displayUrl = asset.secure_url || asset.url;

            return (
              <div
                key={asset.id}
                onClick={() => openPreview(asset)}
                className="group relative flex flex-col rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 transition-all hover:shadow-lg hover:shadow-cyan-950/20 cursor-pointer overflow-hidden"
              >
                {/* Thumbnail container with transparent grid backdrop */}
                <div className="relative aspect-square w-full bg-neutral-950 flex items-center justify-center overflow-hidden border-b border-neutral-800/80">
                  <div
                    className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:8px_8px]"
                  />
                  <img
                    src={displayUrl}
                    alt={asset.alt_text || asset.filename}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      // Graceful initials badge fallback
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />

                  {/* Badges on thumbnail */}
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-semibold bg-neutral-900/90 backdrop-blur-sm text-neutral-300 border border-neutral-700/60">
                      {asset.category}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2">
                    {getUsageBadge(asset.usage_status, asset.references?.length || 0)}
                  </div>

                  {/* Hover quick action overlay */}
                  <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleCopyUrl(asset, e)}
                      className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                      title="Copy CDN URL"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(asset);
                      }}
                      className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                      title="Inspect Details"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Card metadata */}
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-mono font-medium text-white truncate" title={asset.original_filename || asset.filename}>
                      {asset.original_filename || asset.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-neutral-500">
                      <span>{asset.format ? asset.format.toUpperCase() : 'IMG'}</span>
                      {asset.width && asset.height && <span>• {asset.width}×{asset.height}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/60 text-[10px] font-mono text-neutral-500">
                    <span>{formatBytes(asset.file_size || asset.bytes || 0)}</span>
                    <span>{formatDate(asset.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="rounded-xl border border-neutral-800 overflow-hidden bg-neutral-900/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Asset</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Format / Dimensions</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Usage State</th>
                  <th className="p-3">Uploaded</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/70">
                {assets.map((asset) => {
                  const isCopied = copiedId === asset.id;
                  const displayUrl = asset.secure_url || asset.url;

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => openPreview(asset)}
                      className="hover:bg-neutral-850/50 transition-colors cursor-pointer"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <img
                              src={displayUrl}
                              alt={asset.filename}
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate max-w-[200px]" title={asset.original_filename || asset.filename}>
                              {asset.original_filename || asset.filename}
                            </p>
                            <p className="text-[10px] text-neutral-500 truncate max-w-[220px]">
                              {asset.cloudinary_public_id || asset.storage_key}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-neutral-800 text-neutral-300">
                          {asset.category}
                        </span>
                      </td>

                      <td className="p-3 text-neutral-300">
                        {asset.format ? asset.format.toUpperCase() : 'UNKNOWN'}
                        {asset.width && asset.height && (
                          <span className="text-neutral-500 ml-1.5">
                            ({asset.width}×{asset.height})
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-neutral-400">
                        {formatBytes(asset.file_size || asset.bytes || 0)}
                      </td>

                      <td className="p-3">
                        {getUsageBadge(asset.usage_status, asset.references?.length || 0)}
                      </td>

                      <td className="p-3 text-neutral-500">
                        {formatDate(asset.created_at)}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleCopyUrl(asset, e)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                            title="Copy URL"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplaceAsset(asset);
                            }}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                            title="Replace Asset"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(asset);
                            }}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-950/60 hover:text-red-400 text-neutral-400 transition-colors"
                            title="Delete Asset"
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
        </div>
      )}

      {/* 4. Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-800 pt-4 text-xs font-mono text-neutral-400">
          <span>
            Showing page {page} of {totalPages} ({totalCount} total assets)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-800 text-neutral-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-800 text-neutral-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PREVIEW & METADATA DETAILS MODAL                                       */}
      {/* ========================================================================= */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/60">
              <div className="flex items-center gap-2.5">
                <ImageIcon className="w-5 h-5 text-cyan-400" />
                <span className="font-mono text-xs font-semibold text-white truncate max-w-md">
                  {previewAsset.original_filename || previewAsset.filename}
                </span>
                {getUsageBadge(previewAsset.usage_status, previewAsset.references?.length || 0)}
              </div>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Image Viewport */}
              <div className="relative w-full h-72 bg-neutral-950 rounded-xl border border-neutral-800/80 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                <img
                  src={previewAsset.secure_url || previewAsset.url}
                  alt={previewAsset.alt_text || previewAsset.filename}
                  className="max-h-full max-w-full object-contain p-4"
                />
              </div>

              {/* Referenced By Section */}
              <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-2">
                <h4 className="text-xs font-mono font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Live Entity Associations
                </h4>

                {previewAsset.references && previewAsset.references.length > 0 ? (
                  <div className="space-y-1.5 mt-2">
                    {previewAsset.references.map((ref, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                            {ref.type}
                          </span>
                          <span className="text-white font-medium">{ref.label}</span>
                        </div>

                        {ref.url && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewAsset(null);
                              onNavigate(ref.url as AdminRoute);
                            }}
                            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                          >
                            <span>View Entity</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : previewAsset.category === 'gallery' || previewAsset.category === 'branding' ? (
                  <p className="text-xs font-mono text-neutral-400 mt-1">
                    This asset belongs to the <strong>{previewAsset.category}</strong> namespace. It may be rendered dynamically across public frontend components or the interactive gallery.
                  </p>
                ) : (
                  <p className="text-xs font-mono text-amber-400/90 mt-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    This asset is currently <strong>UNUSED</strong> and not attached to any active member, project, or event record.
                  </p>
                )}
              </div>

              {/* Metadata Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 bg-neutral-950/40 border border-neutral-800/70 rounded-lg">
                  <span className="text-[10px] text-neutral-500 uppercase">Cloudinary Public ID</span>
                  <p className="text-neutral-200 mt-0.5 truncate" title={previewAsset.cloudinary_public_id || 'None'}>
                    {previewAsset.cloudinary_public_id || 'None'}
                  </p>
                </div>

                <div className="p-3 bg-neutral-950/40 border border-neutral-800/70 rounded-lg">
                  <span className="text-[10px] text-neutral-500 uppercase">Dimensions</span>
                  <p className="text-neutral-200 mt-0.5">
                    {previewAsset.width && previewAsset.height
                      ? `${previewAsset.width} × ${previewAsset.height} px`
                      : 'Not extracted'}
                  </p>
                </div>

                <div className="p-3 bg-neutral-950/40 border border-neutral-800/70 rounded-lg">
                  <span className="text-[10px] text-neutral-500 uppercase">File Size & Format</span>
                  <p className="text-neutral-200 mt-0.5">
                    {formatBytes(previewAsset.file_size || previewAsset.bytes || 0)} ({previewAsset.format?.toUpperCase() || 'IMG'})
                  </p>
                </div>

                <div className="p-3 bg-neutral-950/40 border border-neutral-800/70 rounded-lg">
                  <span className="text-[10px] text-neutral-500 uppercase">MIME Type</span>
                  <p className="text-neutral-200 mt-0.5 truncate">{previewAsset.mime_type}</p>
                </div>

                <div className="p-3 bg-neutral-950/40 border border-neutral-800/70 rounded-lg">
                  <span className="text-[10px] text-neutral-500 uppercase">Uploaded By</span>
                  <p className="text-neutral-200 mt-0.5 truncate">{previewAsset.uploaded_by || 'System'}</p>
                </div>

                <div className="p-3 bg-neutral-950/40 border border-neutral-800/70 rounded-lg">
                  <span className="text-[10px] text-neutral-500 uppercase">Registered Date</span>
                  <p className="text-neutral-200 mt-0.5">{formatDate(previewAsset.created_at)}</p>
                </div>
              </div>

              {/* Editable Metadata Form */}
              <div className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800/80 space-y-3">
                <h4 className="text-xs font-mono font-semibold text-neutral-300 uppercase tracking-wider">
                  Update Metadata
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                      Alt Text / Accessibility Description
                    </label>
                    <input
                      type="text"
                      value={editAltText}
                      onChange={(e) => setEditAltText(e.target.value)}
                      placeholder="e.g. Portrait photo of Manish Prakash"
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                      Category
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="member">Member</option>
                      <option value="project">Project</option>
                      <option value="event">Event</option>
                      <option value="gallery">Gallery</option>
                      <option value="branding">Branding</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSaveMetadata}
                    disabled={isSavingMeta}
                    className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-mono transition-colors disabled:opacity-50"
                  >
                    {isSavingMeta ? 'Saving Changes...' : 'Save Metadata'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-neutral-800 bg-neutral-950/60">
              <button
                type="button"
                onClick={() => handleCopyUrl(previewAsset)}
                className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg text-xs font-mono transition-colors"
              >
                {copiedId === previewAsset.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === previewAsset.id ? 'Copied CDN URL' : 'Copy CDN URL'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReplaceAsset(previewAsset);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-mono transition-colors"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>Replace Image</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(previewAsset)}
                  disabled={previewAsset.usage_status === 'USED'}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-950/40 hover:bg-red-950/70 border border-red-800/40 text-red-300 rounded-lg text-xs font-mono transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={previewAsset.usage_status === 'USED' ? 'Cannot delete an image currently referenced by active content' : 'Delete Asset'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Asset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. UPLOAD ASSET MODAL                                                     */}
      {/* ========================================================================= */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/60">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-xs font-semibold text-white">Upload New Asset</span>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-xs font-mono text-red-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* File Drop Area */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1.5">
                  Select Image File (JPEG, PNG, WebP — max 10MB)
                </label>
                <div className="border-2 border-dashed border-neutral-800 hover:border-cyan-500/50 rounded-xl p-6 text-center bg-neutral-950/50 transition-colors">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setUploadFile(file);
                      if (file) {
                        setUploadPreviewUrl(URL.createObjectURL(file));
                      } else {
                        setUploadPreviewUrl(null);
                      }
                    }}
                    className="hidden"
                    id="media-file-input"
                  />
                  <label htmlFor="media-file-input" className="cursor-pointer block">
                    {uploadPreviewUrl ? (
                      <div className="space-y-2">
                        <img
                          src={uploadPreviewUrl}
                          alt="Upload preview"
                          className="h-32 mx-auto object-contain rounded border border-neutral-800"
                        />
                        <p className="text-xs font-mono text-cyan-400 font-medium">
                          {uploadFile?.name} ({formatBytes(uploadFile?.size || 0)})
                        </p>
                        <p className="text-[10px] font-mono text-neutral-500">Click to change file</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <ImageIcon className="w-8 h-8 text-neutral-500 mx-auto" />
                        <p className="text-xs font-mono text-neutral-300">
                          Click to browse or drop an image here
                        </p>
                        <p className="text-[10px] font-mono text-neutral-500">
                          Automatic WebP conversion & server-side magic byte validation applied.
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={uploadCategorySelectId} className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                    Category Namespace
                  </label>
                  <select
                    id={uploadCategorySelectId}
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as MediaCategory)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="general">General</option>
                    <option value="member">Member</option>
                    <option value="project">Project</option>
                    <option value="event">Event</option>
                    <option value="gallery">Gallery</option>
                    <option value="branding">Branding</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                    Alt Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={uploadAltText}
                    onChange={(e) => setUploadAltText(e.target.value)}
                    placeholder="Accessibility label"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || actionLoading}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {actionLoading && <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                  <span>{actionLoading ? 'Uploading to Cloudinary...' : 'Upload Asset'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. SAFE REPLACEMENT MODAL                                                 */}
      {/* ========================================================================= */}
      {replaceAsset && (
        <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/60">
              <div className="flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-xs font-semibold text-white">Safe Asset Replacement</span>
              </div>
              <button
                type="button"
                onClick={() => setReplaceAsset(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReplaceSubmit} className="p-5 space-y-4">
              {replaceError && (
                <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-xs font-mono text-red-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{replaceError}</span>
                </div>
              )}

              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-xs font-mono text-cyan-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Automatic Cascade Update
                </p>
                <p className="text-[11px] text-neutral-400">
                  Replacing this asset will immediately update its appearance on all referencing pages (E-ID cards, projects, events). The old Cloudinary asset will only be destroyed after the database update succeeds.
                </p>
              </div>

              {/* File Input */}
              <div className="border-2 border-dashed border-neutral-800 hover:border-cyan-500/50 rounded-xl p-5 text-center bg-neutral-950/50 transition-colors">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setReplaceFile(file);
                    if (file) {
                      setReplacePreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                  className="hidden"
                  id="replace-file-input"
                />
                <label htmlFor="replace-file-input" className="cursor-pointer block">
                  {replacePreviewUrl ? (
                    <div className="space-y-2">
                      <img
                        src={replacePreviewUrl}
                        alt="New asset preview"
                        className="h-28 mx-auto object-contain rounded border border-neutral-800"
                      />
                      <p className="text-xs font-mono text-cyan-400 font-medium">
                        {replaceFile?.name} ({formatBytes(replaceFile?.size || 0)})
                      </p>
                      <p className="text-[10px] font-mono text-neutral-500">Click to choose another file</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload className="w-6 h-6 text-neutral-500 mx-auto" />
                      <p className="text-xs font-mono text-neutral-300">Choose new image replacement</p>
                      <p className="text-[10px] font-mono text-neutral-500">JPEG, PNG, WebP up to 10MB</p>
                    </div>
                  )}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setReplaceAsset(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!replaceFile || actionLoading}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {actionLoading && <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                  <span>{actionLoading ? 'Replacing...' : 'Commit Replacement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. SAFE DELETE CONFIRMATION MODAL                                         */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/40 text-red-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-sm font-mono font-semibold text-white">
                  Delete Media Asset?
                </h3>
                <p className="text-xs font-mono text-neutral-400 mt-1">
                  Target: <strong className="text-white">{deleteTarget.original_filename || deleteTarget.filename}</strong>
                </p>
              </div>

              {deleteTarget.usage_status === 'USED' ? (
                <div className="p-3.5 bg-red-950/40 border border-red-800/50 rounded-xl text-xs font-mono text-red-400 space-y-2">
                  <p className="font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Deletion Blocked: Asset Currently in Use
                  </p>
                  <p className="text-[11px] text-neutral-300">
                    This media asset is currently associated with {deleteTarget.references?.length || 0} active entity record(s). Deleting it would break live member dossiers, E-ID cards, or project showcases.
                  </p>
                </div>
              ) : (
                <p className="text-xs font-mono text-neutral-400">
                  This asset is unreferenced. Permanent deletion will remove its metadata from SQLite and permanently destroy the asset on Cloudinary.
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  disabled={deleteTarget.usage_status === 'USED' || actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-mono font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {actionLoading && <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                  <span>{actionLoading ? 'Deleting...' : 'Confirm Deletion'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
