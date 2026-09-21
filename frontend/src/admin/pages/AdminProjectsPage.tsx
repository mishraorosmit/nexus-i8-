/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderGit2,
  Plus,
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
  Shield,
  Clock,
  Calendar,
  Layers,
  ArrowUpDown,
  Filter,
  RotateCcw,
  Upload,
  Trash2,
  Camera,
  Image as ImageIcon,
  Loader2,
  Star,
  Globe,
  Github,
  BookOpen,
  Users,
  Tag,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  AdminProject,
  AdminProjectMember,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectStatus,
  AdminMember,
} from '../types.ts';
import {
  adminGetProjects,
  adminGetProjectById,
  adminCreateProject,
  adminUpdateProject,
  adminUpdateProjectStatus,
  adminToggleProjectFeatured,
  adminUploadProjectImage,
  adminDeleteProject,
  adminGetMembers,
} from '../api.ts';

interface AdminProjectsPageProps {
  onNavigate?: (route: string) => void;
}

const CATEGORIES = [
  'Technology',
  'Creative Production',
  'Physical Computing',
  'Interactive Systems',
  'Community Tools',
  'Research & Software',
];

export const AdminProjectsPage: React.FC<AdminProjectsPageProps> = ({ onNavigate }) => {
  // --- Data State ---
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Filter State ---
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [featuredOnly, setFeaturedOnly] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<string>('updated_desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // --- Modal & Drawer States ---
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<AdminProject | null>(null);
  const [previewProject, setPreviewProject] = useState<AdminProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProject | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- All Members for Selector ---
  const [allMembers, setAllMembers] = useState<AdminMember[]>([]);

  // --- Form State ---
  const [formData, setFormData] = useState<CreateProjectInput>({
    title: '',
    slug: '',
    projectNumber: '',
    category: 'Technology',
    year: new Date().getFullYear().toString(),
    shortDescription: '',
    fullDescription: '',
    disciplines: 'TECH × COMMUNITY',
    status: 'Draft',
    featured: false,
    technologies: [],
    deliverables: [],
    coverImageUrl: '',
    liveUrl: '',
    repositoryUrl: '',
    documentationUrl: '',
    startDate: '',
    endDate: '',
    members: [],
  });

  const [tagInput, setTagInput] = useState('');
  const [deliverableInput, setDeliverableInput] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'content' | 'people' | 'links' | 'media'>('info');
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load Members for Picker
  useEffect(() => {
    adminGetMembers({ limit: 100, status: 'ACTIVE' }).then((res) => {
      if (res.success && res.data) {
        setAllMembers(res.data);
      }
    });
  }, []);

  // Fetch Projects List
  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminGetProjects({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        status: statusFilter,
        category: categoryFilter,
        featured: featuredOnly ? true : undefined,
        sort: sortOrder,
      });

      if (res.success && res.data) {
        setProjects(res.data);
        setTotalCount(res.meta?.total || res.data.length);
      } else {
        setError(res.error || 'Failed to fetch projects');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while fetching projects');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, statusFilter, categoryFilter, featuredOnly, sortOrder]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Handle Search Debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  // Open Create Drawer
  const handleOpenCreate = () => {
    setEditingProject(null);
    setFormData({
      title: '',
      slug: '',
      projectNumber: `NXS / ${String(totalCount + 1).padStart(3, '0')}`,
      category: 'Technology',
      year: new Date().getFullYear().toString(),
      shortDescription: '',
      fullDescription: '',
      disciplines: 'TECH × COMMUNITY',
      status: 'Draft',
      featured: false,
      technologies: ['TypeScript', 'React'],
      deliverables: ['Web Application'],
      coverImageUrl: '',
      liveUrl: '',
      repositoryUrl: '',
      documentationUrl: '',
      startDate: '',
      endDate: '',
      members: [],
    });
    setTagInput('');
    setDeliverableInput('');
    setActiveTab('info');
    setIsEditorOpen(true);
  };

  // Open Edit Drawer
  const handleOpenEdit = (project: AdminProject) => {
    setEditingProject(project);
    setFormData({
      title: project.title,
      slug: project.slug,
      projectNumber: project.project_number || '',
      category: project.category,
      year: project.year,
      shortDescription: project.short_description,
      fullDescription: project.full_description,
      disciplines: project.disciplines,
      status: project.status as ProjectStatus,
      featured: project.featured,
      technologies: Array.isArray(project.technologies) ? project.technologies : [],
      deliverables: Array.isArray(project.deliverables) ? project.deliverables : [],
      coverImageUrl: project.cover_image_url || project.cover_image || '',
      liveUrl: project.live_url || project.demo_url || '',
      repositoryUrl: project.repository_url || '',
      documentationUrl: project.documentation_url || '',
      startDate: project.start_date || '',
      endDate: project.end_date || '',
      members: (project.members || []).map((m) => ({
        memberId: m.member_id,
        role: m.role || 'Contributor',
      })),
    });
    setTagInput('');
    setDeliverableInput('');
    setActiveTab('info');
    setIsEditorOpen(true);
  };

  // Save Project (Create or Update)
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setToast({ message: 'Title is required', type: 'error' });
      return;
    }
    if (!formData.category.trim()) {
      setToast({ message: 'Category is required', type: 'error' });
      return;
    }
    if (!formData.shortDescription.trim()) {
      setToast({ message: 'Short description is required', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingProject) {
        const updatePayload: UpdateProjectInput = {
          ...formData,
          expected_updated_at: editingProject.updated_at,
        };
        const res = await adminUpdateProject(editingProject.id, updatePayload);
        if (res.success) {
          setToast({ message: `Project "${formData.title}" updated successfully`, type: 'success' });
          setIsEditorOpen(false);
          fetchProjects();
        } else {
          setToast({ message: res.error || 'Failed to update project', type: 'error' });
        }
      } else {
        const res = await adminCreateProject(formData);
        if (res.success) {
          setToast({ message: `Project "${formData.title}" created successfully`, type: 'success' });
          setIsEditorOpen(false);
          fetchProjects();
        } else {
          setToast({ message: res.error || 'Failed to create project', type: 'error' });
        }
      }
    } catch (err: any) {
      setToast({ message: err?.message || 'Error saving project', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Featured Status
  const handleToggleFeatured = async (project: AdminProject) => {
    const newFeatured = !project.featured;
    try {
      const res = await adminToggleProjectFeatured(project.id, newFeatured);
      if (res.success) {
        setProjects((prev) =>
          prev.map((p) => (p.id === project.id ? { ...p, featured: newFeatured } : p))
        );
        setToast({
          message: `Project ${newFeatured ? 'marked as Featured' : 'unfeatured'}`,
          type: 'success',
        });
      } else {
        setToast({ message: res.error || 'Failed to toggle featured status', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err?.message || 'Error updating featured status', type: 'error' });
    }
  };

  // Quick Status Transition
  const handleStatusChange = async (project: AdminProject, newStatus: ProjectStatus) => {
    try {
      const res = await adminUpdateProjectStatus(project.id, newStatus);
      if (res.success) {
        setProjects((prev) =>
          prev.map((p) => (p.id === project.id ? { ...p, status: newStatus } : p))
        );
        setToast({
          message: `Project status set to "${newStatus}"`,
          type: 'success',
        });
      } else {
        setToast({ message: res.error || 'Failed to update project status', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err?.message || 'Error updating status', type: 'error' });
    }
  };

  // Delete Project Confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await adminDeleteProject(deleteTarget.id);
      if (res.success) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setToast({ message: `Project "${deleteTarget.title}" deleted`, type: 'success' });
        setDeleteTarget(null);
      } else {
        setToast({ message: res.error || 'Failed to delete project', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err?.message || 'Error deleting project', type: 'error' });
    }
  };

  // Upload Cover Image
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        if (editingProject) {
          const res = await adminUploadProjectImage(editingProject.id, {
            filename: file.name,
            content: base64Data,
          });
          if (res.success && res.data) {
            setFormData((prev) => ({
              ...prev,
              coverImageUrl: res.data?.cover_image_url || res.data?.cover_image || '',
            }));
            setToast({ message: 'Cover image uploaded successfully', type: 'success' });
            fetchProjects();
          } else {
            setToast({ message: res.error || 'Failed to upload cover image', type: 'error' });
          }
        } else {
          // New unsaved project: set local preview data URL
          setFormData((prev) => ({ ...prev, coverImageUrl: base64Data }));
          setToast({ message: 'Image attached (will be saved with project)', type: 'success' });
        }
        setImageUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setToast({ message: err?.message || 'Error reading image file', type: 'error' });
      setImageUploading(false);
    }
  };

  // Tag helper
  const handleAddTag = () => {
    if (tagInput.trim() && !formData.technologies?.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        technologies: [...(prev.technologies || []), tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      technologies: (prev.technologies || []).filter((t) => t !== tagToRemove),
    }));
  };

  // Deliverable helper
  const handleAddDeliverable = () => {
    if (deliverableInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        deliverables: [...(prev.deliverables || []), deliverableInput.trim()],
      }));
      setDeliverableInput('');
    }
  };

  const handleRemoveDeliverable = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      deliverables: (prev.deliverables || []).filter((_, i) => i !== index),
    }));
  };

  // Member association helper
  const handleAddMemberToProject = (memberId: string) => {
    if (!formData.members?.some((m) => m.memberId === memberId)) {
      setFormData((prev) => ({
        ...prev,
        members: [...(prev.members || []), { memberId, role: 'Contributor' }],
      }));
    }
  };

  const handleUpdateMemberRole = (memberId: string, role: string) => {
    setFormData((prev) => ({
      ...prev,
      members: (prev.members || []).map((m) => (m.memberId === memberId ? { ...m, role } : m)),
    }));
  };

  const handleRemoveMemberFromProject = (memberId: string) => {
    setFormData((prev) => ({
      ...prev,
      members: (prev.members || []).filter((m) => m.memberId !== memberId),
    }));
  };

  // Metrics calculation
  const publishedCount = projects.filter((p) => p.status.toLowerCase() === 'published' || p.status.toLowerCase() === 'active').length;
  const draftCount = projects.filter((p) => p.status.toLowerCase() === 'draft').length;
  const archivedCount = projects.filter((p) => p.status.toLowerCase() === 'archived').length;
  const featuredCount = projects.filter((p) => p.featured).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-xs font-mono border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/90 border-red-500/50 text-red-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderGit2 className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">PROJECT PORTFOLIO</h1>
          </div>
          <p className="text-xs text-neutral-400">
            Create, publish, and curate student showcases, repository links, and team credits for the public website.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchProjects}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded border border-neutral-700 text-xs font-mono transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded text-xs font-mono transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Total Projects</div>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{totalCount}</div>
          </div>
          <FolderGit2 className="w-5 h-5 text-neutral-600" />
        </div>
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-500">Published</div>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{publishedCount}</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-500">Drafts</div>
            <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">{draftCount}</div>
          </div>
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-purple-400">Featured</div>
            <div className="text-lg font-bold text-purple-300 font-mono mt-0.5">{featuredCount}</div>
          </div>
          <Star className="w-5 h-5 text-purple-500 fill-purple-500/30" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-lg p-3 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by title, slug, summary, tags..."
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 font-mono"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded border border-neutral-800">
            {['all', 'Published', 'Draft', 'Archived'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  statusFilter.toLowerCase() === st.toLowerCase()
                    ? 'bg-neutral-800 text-white font-medium'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {st === 'all' ? 'All Status' : st}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-300 font-mono focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Featured Toggle */}
          <button
            type="button"
            onClick={() => {
              setFeaturedOnly(!featuredOnly);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono transition-colors ${
              featuredOnly
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${featuredOnly ? 'fill-purple-400 text-purple-400' : ''}`} />
            <span>Featured Only</span>
          </button>
        </div>
      </div>

      {/* Projects List Table */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-neutral-500 font-mono text-xs flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span>Loading project catalog...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 font-mono text-xs flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchProjects}
              className="mt-2 px-3 py-1 bg-neutral-800 text-white rounded text-xs"
            >
              Retry
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 font-mono text-xs flex flex-col items-center gap-3">
            <FolderGit2 className="w-8 h-8 text-neutral-700" />
            <span className="text-neutral-400 font-semibold">No projects found</span>
            <p className="text-[11px] text-neutral-600 max-w-sm">
              No projects matched your search criteria. Try adjusting filters or create a new project.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 px-3.5 py-1.5 bg-amber-500 text-neutral-950 font-semibold rounded text-xs"
            >
              Create First Project
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Category / Year</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4 text-center">Featured</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {projects.map((project) => {
                  const isPublished = project.status.toLowerCase() === 'published' || project.status.toLowerCase() === 'active';
                  const isDraft = project.status.toLowerCase() === 'draft';
                  const isArchived = project.status.toLowerCase() === 'archived';
                  const cover = project.cover_image_url || project.cover_image;

                  return (
                    <tr key={project.id} className="hover:bg-neutral-800/30 transition-colors">
                      {/* Project Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded bg-neutral-950 border border-neutral-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {cover ? (
                              <img src={cover} alt={project.title} className="w-full h-full object-cover" />
                            ) : (
                              <FolderGit2 className="w-5 h-5 text-neutral-600" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white tracking-wide">{project.title}</span>
                              {project.project_number && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                                  {project.project_number}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                              <span>/{project.slug}</span>
                              {project.repository_url && (
                                <a
                                  href={project.repository_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-neutral-400 hover:text-white"
                                  title="Repository URL"
                                >
                                  <Github className="w-3 h-3" />
                                </a>
                              )}
                              {project.live_url && (
                                <a
                                  href={project.live_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-400 hover:text-emerald-300"
                                  title="Live Demo"
                                >
                                  <Globe className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category & Year */}
                      <td className="py-3 px-4">
                        <div className="text-neutral-200">{project.category}</div>
                        <div className="text-[11px] text-neutral-500">{project.year} • {project.disciplines}</div>
                      </td>

                      {/* Team Members */}
                      <td className="py-3 px-4">
                        {project.members && project.members.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-2 overflow-hidden">
                              {project.members.slice(0, 3).map((m) => (
                                <div
                                  key={m.member_id}
                                  className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-900 overflow-hidden flex items-center justify-center text-[10px] text-neutral-300 font-bold"
                                  title={`${m.name} (${m.role || 'Contributor'})`}
                                >
                                  {m.photo_url || m.profile_image_url ? (
                                    <img src={m.photo_url || m.profile_image_url || ''} alt={m.name} className="w-full h-full object-cover" />
                                  ) : (
                                    m.name.charAt(0)
                                  )}
                                </div>
                              ))}
                            </div>
                            <span className="text-[11px] text-neutral-400">
                              {project.members.length} {project.members.length === 1 ? 'member' : 'members'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-600 italic">No assigned team</span>
                        )}
                      </td>

                      {/* Featured Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(project)}
                          className={`p-1.5 rounded transition-colors ${
                            project.featured
                              ? 'text-purple-400 bg-purple-950/40 hover:bg-purple-900/50'
                              : 'text-neutral-600 hover:text-neutral-400'
                          }`}
                          title={project.featured ? 'Unfeature' : 'Mark as Featured'}
                        >
                          <Star className={`w-4 h-4 ${project.featured ? 'fill-purple-400' : ''}`} />
                        </button>
                      </td>

                      {/* Status Pill & Quick Transition */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isPublished
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                                : isDraft
                                ? 'bg-amber-950/80 text-amber-400 border border-amber-500/40'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                            }`}
                          >
                            {project.status}
                          </span>

                          {/* Quick Actions */}
                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(project, 'Published')}
                              className="px-2 py-0.5 text-[10px] bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 rounded border border-emerald-700/50 transition-colors"
                              title="Publish this project"
                            >
                              Publish
                            </button>
                          )}
                          {isPublished && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(project, 'Draft')}
                              className="px-2 py-0.5 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition-colors"
                              title="Unpublish to Draft"
                            >
                              Unpublish
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewProject(project)}
                            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
                            title="Preview Project"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(project)}
                            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded transition-colors"
                            title="Edit Project"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(project)}
                            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 rounded transition-colors"
                            title="Delete Project"
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
      </div>

      {/* Editor Drawer Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl font-mono animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
              <div className="flex items-center gap-2.5">
                <FolderGit2 className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">
                  {editingProject ? `Edit Project: ${editingProject.title}` : 'Create New Project'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-neutral-800 px-6 bg-neutral-950/30 gap-4 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`py-2.5 border-b-2 font-medium transition-colors ${
                  activeTab === 'info'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                1. Identity & Classification
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('content')}
                className={`py-2.5 border-b-2 font-medium transition-colors ${
                  activeTab === 'content'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                2. Content & Tags
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('people')}
                className={`py-2.5 border-b-2 font-medium transition-colors ${
                  activeTab === 'people'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                3. Team Members ({formData.members?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('links')}
                className={`py-2.5 border-b-2 font-medium transition-colors ${
                  activeTab === 'links'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                4. Links & Timeline
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('media')}
                className={`py-2.5 border-b-2 font-medium transition-colors ${
                  activeTab === 'media'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                5. Cover Image
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveProject} className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Project Title *</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            title: val,
                            slug: editingProject ? prev.slug : val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                          }));
                        }}
                        placeholder="e.g. ALGOLAB"
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">URL Slug (Canonical identifier) *</label>
                      <input
                        type="text"
                        required
                        value={formData.slug}
                        onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') }))}
                        placeholder="e.g. algolab"
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Project Number</label>
                      <input
                        type="text"
                        value={formData.projectNumber || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, projectNumber: e.target.value }))}
                        placeholder="e.g. NXS / 001"
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Category *</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Year</label>
                      <input
                        type="text"
                        value={formData.year}
                        onChange={(e) => setFormData((prev) => ({ ...prev, year: e.target.value }))}
                        placeholder="e.g. 2026"
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Disciplines Taxonomy</label>
                      <input
                        type="text"
                        value={formData.disciplines}
                        onChange={(e) => setFormData((prev) => ({ ...prev, disciplines: e.target.value }))}
                        placeholder="e.g. TECH × EDUCATION"
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Publishing Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as ProjectStatus }))}
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="Draft">Draft (Internal only)</option>
                        <option value="Published">Published (Visible publicly)</option>
                        <option value="Archived">Archived (Internal historical archive)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.featured}
                        onChange={(e) => setFormData((prev) => ({ ...prev, featured: e.target.checked }))}
                        className="w-4 h-4 rounded bg-neutral-950 border-neutral-800 text-amber-500 focus:ring-0"
                      />
                      <span className="text-xs text-neutral-200">Showcase as Featured Project on Home Page</span>
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'content' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Short Description / Summary (1-2 sentences) *</label>
                    <textarea
                      required
                      rows={2}
                      value={formData.shortDescription}
                      onChange={(e) => setFormData((prev) => ({ ...prev, shortDescription: e.target.value }))}
                      placeholder="Concise overview presented on project list cards..."
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Detailed Narrative & Description</label>
                    <textarea
                      rows={5}
                      value={formData.fullDescription}
                      onChange={(e) => setFormData((prev) => ({ ...prev, fullDescription: e.target.value }))}
                      placeholder="Comprehensive project background, problem statement, and engineering solution..."
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Technologies Tags Input */}
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Technologies & Keywords</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder="e.g. TypeScript, Canvas API, LoRa Mesh..."
                        className="flex-1 px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs"
                      >
                        Add Tag
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(formData.technologies || []).map((t) => (
                        <span
                          key={t}
                          className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800/80 border border-neutral-700 rounded text-[11px] text-neutral-300"
                        >
                          <Tag className="w-3 h-3 text-neutral-500" />
                          <span>{t}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="hover:text-red-400 ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Deliverables List */}
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Key Deliverables & Artifacts</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={deliverableInput}
                        onChange={(e) => setDeliverableInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDeliverable();
                          }
                        }}
                        placeholder="e.g. Interactive Web Sandbox, Open CAD Schematics..."
                        className="flex-1 px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddDeliverable}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs"
                      >
                        Add Deliverable
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {(formData.deliverables || []).map((del, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-300"
                        >
                          <span>• {del}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDeliverable(idx)}
                            className="text-neutral-500 hover:text-red-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'people' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <span className="text-xs text-neutral-300 font-bold">Associated NEXUS Members</span>
                    <span className="text-[11px] text-neutral-500">Credits & student lead references</span>
                  </div>

                  {/* Add Member Dropdown */}
                  <div className="flex gap-2">
                    <select
                      id="member-select"
                      className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddMemberToProject(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        + Select member to add to project team...
                      </option>
                      {allMembers
                        .filter((m) => !formData.members?.some((pm) => pm.memberId === m.id))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.role} • {m.unique_id || m.public_id})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Selected Members Table */}
                  <div className="space-y-2">
                    {(formData.members || []).length === 0 ? (
                      <p className="text-xs text-neutral-600 italic py-4 text-center">
                        No members associated with this project yet.
                      </p>
                    ) : (
                      formData.members?.map((pm) => {
                        const memberInfo = allMembers.find((m) => m.id === pm.memberId);
                        return (
                          <div
                            key={pm.memberId}
                            className="flex items-center justify-between gap-3 p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden flex items-center justify-center text-xs font-bold text-neutral-300">
                                {memberInfo?.profile_image_url || memberInfo?.photo_url ? (
                                  <img
                                    src={memberInfo.profile_image_url || memberInfo.photo_url || ''}
                                    alt={memberInfo.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  memberInfo?.name?.charAt(0) || 'M'
                                )}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-white">
                                  {memberInfo?.name || pm.memberId}
                                </div>
                                <div className="text-[10px] text-neutral-500">
                                  {memberInfo?.department} • {memberInfo?.unique_id}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={pm.role || ''}
                                onChange={(e) => handleUpdateMemberRole(pm.memberId, e.target.value)}
                                placeholder="Role (e.g. Project Lead)"
                                className="px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-200 w-44 focus:outline-none focus:border-amber-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveMemberFromProject(pm.memberId)}
                                className="p-1 text-neutral-500 hover:text-red-400"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'links' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      <Github className="w-3.5 h-3.5 inline mr-1" />
                      Repository URL (GitHub / GitLab)
                    </label>
                    <input
                      type="url"
                      value={formData.repositoryUrl || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, repositoryUrl: e.target.value }))}
                      placeholder="https://github.com/nexus-club/algolab"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      <Globe className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                      Live Demo / Deployment URL
                    </label>
                    <input
                      type="url"
                      value={formData.liveUrl || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, liveUrl: e.target.value }))}
                      placeholder="https://algolab.nexus.campus"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      <BookOpen className="w-3.5 h-3.5 inline mr-1 text-blue-400" />
                      Documentation / Research Paper URL
                    </label>
                    <input
                      type="url"
                      value={formData.documentationUrl || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, documentationUrl: e.target.value }))}
                      placeholder="https://docs.nexus.campus/projects/algolab"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={formData.startDate || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">End / Completion Date</label>
                      <input
                        type="date"
                        value={formData.endDate || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'media' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Cover Image URL</label>
                    <input
                      type="text"
                      value={formData.coverImageUrl || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
                      placeholder="https://res.cloudinary.com/... or upload below"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="border-2 border-dashed border-neutral-800 rounded-xl p-6 text-center hover:border-neutral-700 transition-colors bg-neutral-950/40">
                    {formData.coverImageUrl ? (
                      <div className="space-y-3">
                        <div className="w-full max-w-sm mx-auto h-48 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950">
                          <img src={formData.coverImageUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={imageUploading}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs flex items-center gap-1.5"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Replace Cover</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, coverImageUrl: '' }))}
                            className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-300 rounded text-xs border border-red-800/50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <ImageIcon className="w-10 h-10 text-neutral-600 mx-auto" />
                        <div className="text-xs text-neutral-300 font-bold">Upload Cover Artwork</div>
                        <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                          Supports PNG, JPEG, and WebP up to 10MB. Automatically optimized via Cloudinary CDN pipeline.
                        </p>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={imageUploading}
                          className="mt-2 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded text-xs inline-flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Select Image File</span>
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileChange}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingProject ? 'Save Changes' : 'Create Project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {previewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-[#0C0C0C] border border-neutral-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl font-mono animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">PUBLIC WORKSPACE PREVIEW</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProject(null)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Card Body */}
            <div className="p-6 space-y-5">
              {/* Media Hero */}
              {(previewProject.cover_image_url || previewProject.cover_image) && (
                <div className="w-full h-52 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950">
                  <img
                    src={previewProject.cover_image_url || previewProject.cover_image || ''}
                    alt={previewProject.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-mono text-amber-400 font-bold tracking-wider">
                    {previewProject.project_number || 'NXS / 000'} • {previewProject.category}
                  </span>
                  <span className="text-[11px] text-neutral-500 font-mono">{previewProject.year}</span>
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">{previewProject.title}</h3>
                <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{previewProject.short_description}</p>
              </div>

              {previewProject.full_description && previewProject.full_description !== previewProject.short_description && (
                <div className="text-xs text-neutral-300 bg-neutral-950 p-3.5 rounded border border-neutral-800/80 leading-relaxed">
                  {previewProject.full_description}
                </div>
              )}

              {/* Tags */}
              {previewProject.technologies && previewProject.technologies.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {previewProject.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[10px] text-neutral-300 font-mono"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              {/* Team Members */}
              {previewProject.members && previewProject.members.length > 0 && (
                <div className="border-t border-neutral-800/80 pt-3">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2">Project Credits</div>
                  <div className="flex flex-wrap gap-2">
                    {previewProject.members.map((m) => (
                      <div
                        key={m.member_id}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-full text-xs text-neutral-300"
                      >
                        <Users className="w-3 h-3 text-neutral-500" />
                        <span>{m.name}</span>
                        {m.role && <span className="text-neutral-500 text-[10px]">({m.role})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* External Links */}
              <div className="flex items-center gap-3 pt-2 border-t border-neutral-800/80">
                {previewProject.repository_url && (
                  <a
                    href={previewProject.repository_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>Repository</span>
                  </a>
                )}
                {previewProject.live_url && (
                  <a
                    href={previewProject.live_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Live Showcase</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-md w-full p-6 space-y-4 font-mono shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-sm font-bold text-white">Delete Project Confirmation</h3>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">"{deleteTarget.title}"</strong>?
              This will remove the project record and its team member associations from the database.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs shadow-md"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProjectsPage;
