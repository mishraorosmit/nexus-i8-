/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
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
  Clock,
  MapPin,
  Users,
  Tag,
  Upload,
  Trash2,
  Camera,
  Loader2,
  Check,
  Download,
  ToggleLeft,
  ToggleRight,
  Shield,
  RotateCcw,
} from 'lucide-react';
import {
  AdminEvent,
  AdminEventRegistration,
  CreateEventInput,
  UpdateEventInput,
  EventStatus,
  EventRegistrationStatus,
} from '../types.ts';
import {
  adminGetEvents,
  adminGetEventById,
  adminCreateEvent,
  adminUpdateEvent,
  adminUpdateEventStatus,
  adminToggleEventRegistration,
  adminUploadEventImage,
  adminDeleteEvent,
  adminGetEventRegistrations,
  adminUpdateEventRegistrationStatus,
} from '../api.ts';

interface AdminEventsPageProps {
  onNavigate?: (route: string) => void;
}

const EVENT_TYPES = ['Workshop', 'Showcase', 'OpenStudio', 'Meeting', 'Hackathon'];

function formatIsoForDisplay(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

function isoToDateTimeLocal(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function dateTimeLocalToIso(localStr?: string): string {
  if (!localStr) return '';
  try {
    const d = new Date(localStr);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  } catch {
    return '';
  }
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const AdminEventsPage: React.FC<AdminEventsPageProps> = () => {
  // --- Data State ---
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Filter State ---
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [registrationFilter, setRegistrationFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('start_asc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // --- Modal & Drawer States ---
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- Registration Management Modal State ---
  const [regModalEvent, setRegModalEvent] = useState<AdminEvent | null>(null);
  const [registrations, setRegistrations] = useState<AdminEventRegistration[]>([]);
  const [isRegLoading, setIsRegLoading] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState<string>('all');

  // --- Form State ---
  const [formData, setFormData] = useState<CreateEventInput>({
    title: '',
    slug: '',
    eventType: 'Workshop',
    shortDescription: '',
    description: '',
    location: 'SOA Main Lab // Room 204',
    venue: 'SOA Main Lab // Room 204',
    eventStart: '',
    eventEnd: '',
    registrationEnabled: true,
    registrationStart: '',
    registrationEnd: '',
    capacity: null,
    registrationUrl: '',
    coverImageUrl: '',
    featured: false,
    status: 'Draft',
  });

  const [formValidation, setFormValidation] = useState<{
    title?: string;
    slug?: string;
    schedule?: string;
    capacity?: string;
  }>({});

  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-clear toasts
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load events
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const res = await adminGetEvents({
      page,
      limit: pageSize,
      status: statusFilter,
      eventType: typeFilter,
      registrationState: registrationFilter,
      search: search.trim() || undefined,
      sort: sortOrder,
    });

    if (res.success && res.data) {
      setEvents(res.data);
      setTotalCount(res.meta?.total || res.data.length);
    } else {
      setError(res.error || 'Failed to load events.');
    }
    setIsLoading(false);
  }, [page, pageSize, statusFilter, typeFilter, registrationFilter, search, sortOrder]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Load Registrations for Selected Event
  const loadRegistrations = useCallback(async (eventId: string) => {
    setIsRegLoading(true);
    const res = await adminGetEventRegistrations(eventId, {
      status: regStatusFilter,
      search: regSearch.trim() || undefined,
      limit: 100,
    });
    if (res.success && res.data) {
      setRegistrations(res.data);
    } else {
      setToast({ message: res.error || 'Failed to load attendees', type: 'error' });
    }
    setIsRegLoading(false);
  }, [regStatusFilter, regSearch]);

  useEffect(() => {
    if (regModalEvent) {
      loadRegistrations(regModalEvent.id);
    }
  }, [regModalEvent, loadRegistrations]);

  // Open Editor for Create
  const handleOpenCreate = () => {
    setEditingEvent(null);
    setIsCustomSlug(false);
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setFormValidation({});

    const defaultStart = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    defaultStart.setHours(18, 0, 0, 0);
    const defaultEnd = new Date(defaultStart.getTime() + 3 * 3600 * 1000);

    setFormData({
      title: '',
      slug: '',
      eventType: 'Workshop',
      shortDescription: '',
      description: '',
      location: 'SOA Main Lab // Room 204',
      venue: 'SOA Main Lab // Room 204',
      eventStart: defaultStart.toISOString(),
      eventEnd: defaultEnd.toISOString(),
      registrationEnabled: true,
      registrationStart: new Date().toISOString(),
      registrationEnd: defaultStart.toISOString(),
      capacity: 40,
      registrationUrl: '',
      coverImageUrl: '',
      featured: false,
      status: 'Draft',
    });
    setIsEditorOpen(true);
  };

  // Open Editor for Edit
  const handleOpenEdit = async (event: AdminEvent) => {
    setEditingEvent(event);
    setIsCustomSlug(true);
    setSelectedImageFile(null);
    setImagePreviewUrl(event.cover_image_url || event.coverImageUrl || event.cover_image || null);
    setFormValidation({});

    setFormData({
      title: event.title,
      slug: event.slug,
      eventType: event.event_type || event.eventType || 'Workshop',
      shortDescription: event.short_description || event.shortDescription || '',
      description: event.description || '',
      location: event.location || event.venue || '',
      venue: event.venue || event.location || '',
      eventStart: event.event_start || event.eventStart || '',
      eventEnd: event.event_end || event.eventEnd || '',
      registrationEnabled: event.registration_enabled === 1 || event.registrationEnabled === true,
      registrationStart: event.registration_start || event.registrationStart || '',
      registrationEnd: event.registration_end || event.registrationEnd || '',
      capacity: event.capacity !== undefined ? event.capacity : null,
      registrationUrl: event.registration_url || event.registrationUrl || '',
      coverImageUrl: event.cover_image_url || event.coverImageUrl || event.cover_image || '',
      featured: event.featured === 1 || event.featured === true,
      status: event.status || 'Draft',
    });

    setIsEditorOpen(true);
  };

  // Handle Form Change
  const handleFieldChange = (field: keyof CreateEventInput, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'title' && !isCustomSlug) {
        updated.slug = generateSlug(value);
      }
      return updated;
    });

    if (formValidation[field as keyof typeof formValidation]) {
      setFormValidation((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle Image Selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setToast({ message: 'Invalid format. Only JPEG, PNG, and WebP are accepted.', type: 'error' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setToast({ message: 'File is too large. 10MB maximum limit.', type: 'error' });
      return;
    }

    setSelectedImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);
  };

  // Validate Form
  const validateForm = (): boolean => {
    const errors: typeof formValidation = {};

    if (!formData.title.trim()) {
      errors.title = 'Event title is required';
    }
    if (!formData.slug?.trim()) {
      errors.slug = 'Valid slug is required';
    }

    if (formData.eventStart && formData.eventEnd) {
      const s = new Date(formData.eventStart).getTime();
      const e = new Date(formData.eventEnd).getTime();
      if (e < s) {
        errors.schedule = 'Event end date must be after start date';
      }
    } else {
      errors.schedule = 'Both start and end dates are required';
    }

    if (formData.capacity !== null && formData.capacity !== undefined) {
      const cap = Number(formData.capacity);
      if (isNaN(cap) || cap < 0) {
        errors.capacity = 'Capacity must be 0 or greater';
      }
    }

    setFormValidation(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      let savedEventId = editingEvent?.id;

      if (editingEvent) {
        const updatePayload: UpdateEventInput = {
          ...formData,
          expected_updated_at: editingEvent.updated_at,
        };
        const res = await adminUpdateEvent(editingEvent.id, updatePayload);
        if (!res.success) {
          throw new Error(res.error || 'Failed to update event.');
        }
        savedEventId = res.data?.id || editingEvent.id;
        setToast({ message: 'Event updated successfully.', type: 'success' });
      } else {
        const res = await adminCreateEvent(formData);
        if (!res.success || !res.data) {
          throw new Error(res.error || 'Failed to create event.');
        }
        savedEventId = res.data.id;
        setToast({ message: 'Event created successfully.', type: 'success' });
      }

      // Upload Cover Image if file was selected
      if (selectedImageFile && savedEventId) {
        setIsUploadingImage(true);
        const imgRes = await adminUploadEventImage(savedEventId, selectedImageFile);
        if (!imgRes.success) {
          setToast({ message: `Event saved, but image upload failed: ${imgRes.error}`, type: 'error' });
        }
        setIsUploadingImage(false);
      }

      setIsEditorOpen(false);
      loadEvents();
    } catch (err: any) {
      setToast({ message: err?.message || 'Error saving event.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Status Transitions (Publish / Unpublish / Archive)
  const handleStatusChange = async (event: AdminEvent, newStatus: EventStatus) => {
    const res = await adminUpdateEventStatus(event.id, newStatus);
    if (res.success) {
      setToast({ message: `Event transitioned to '${newStatus}'.`, type: 'success' });
      loadEvents();
    } else {
      setToast({ message: res.error || 'Failed to change event status.', type: 'error' });
    }
  };

  // Toggle Registration Open / Closed
  const handleToggleRegistration = async (event: AdminEvent) => {
    const currentlyEnabled = event.registration_enabled === 1 || event.registrationEnabled === true;
    const res = await adminToggleEventRegistration(event.id, !currentlyEnabled);
    if (res.success) {
      setToast({
        message: `Registration ${!currentlyEnabled ? 'opened' : 'closed'} successfully.`,
        type: 'success',
      });
      loadEvents();
    } else {
      setToast({ message: res.error || 'Failed to toggle registration.', type: 'error' });
    }
  };

  // Delete Event
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    const res = await adminDeleteEvent(deleteTarget.id);
    if (res.success) {
      setToast({ message: `Event "${deleteTarget.title}" deleted.`, type: 'success' });
      setDeleteTarget(null);
      loadEvents();
    } else {
      setToast({ message: res.error || 'Failed to delete event.', type: 'error' });
    }
  };

  // Cancel Attendee Registration
  const handleCancelRegistration = async (regId: string) => {
    const res = await adminUpdateEventRegistrationStatus(regId, 'CANCELLED');
    if (res.success) {
      setToast({ message: 'Registration cancelled.', type: 'success' });
      if (regModalEvent) {
        loadRegistrations(regModalEvent.id);
        loadEvents();
      }
    } else {
      setToast({ message: res.error || 'Failed to cancel registration.', type: 'error' });
    }
  };

  // Export Attendees CSV
  const handleExportCsv = () => {
    if (!regModalEvent) return;
    const attendees = registrations;
    if (attendees.length === 0) {
      setToast({ message: 'No attendees to export.', type: 'error' });
      return;
    }

    const headers = ['Registration ID', 'Event', 'Name', 'Email', 'Phone', 'Department', 'Status', 'Registered At'];
    const rows = attendees.map((a) => [
      a.id,
      `"${regModalEvent.title.replace(/"/g, '""')}"`,
      `"${a.attendee_name.replace(/"/g, '""')}"`,
      `"${a.attendee_email.replace(/"/g, '""')}"`,
      `"${(a.attendee_phone || '').replace(/"/g, '""')}"`,
      `"${(a.department || a.organization || '').replace(/"/g, '""')}"`,
      a.status,
      a.registration_timestamp,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `event-${regModalEvent.slug}-attendees.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Metric aggregates
  const totalPublished = events.filter((e) => e.status === 'Published' || e.status === 'Upcoming').length;
  const totalDrafts = events.filter((e) => e.status === 'Draft').length;
  const totalArchived = events.filter((e) => e.status === 'Archived').length;
  const openRegistrations = events.filter((e) => e.registration_enabled === 1 && e.registration_status !== 'CLOSED').length;
  const totalAttendees = events.reduce((sum, e) => sum + (e.confirmed_count || e.confirmedCount || 0), 0);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans text-neutral-200">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded text-xs font-mono border shadow-lg transition-all ${
            toast.type === 'success'
              ? 'bg-neutral-900 border-emerald-500/40 text-emerald-300'
              : 'bg-neutral-900 border-rose-500/40 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-2 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[#F2613F]" />
            <h1 className="text-xl font-bold font-mono tracking-tight text-neutral-100">EVENT MANAGEMENT</h1>
            <span className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-400">
              {totalCount} Total
            </span>
          </div>
          <p className="text-xs text-neutral-400 font-mono mt-1">
            Workshops, public showcases, open studio sprints, and race-protected attendee registration lists.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadEvents}
            disabled={isLoading}
            className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded text-xs font-mono text-neutral-300 flex items-center gap-2 transition-colors cursor-pointer"
            title="Refresh event list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-neutral-400' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-[#F2613F] hover:bg-[#fa7353] text-white rounded text-xs font-mono font-semibold flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Event</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-neutral-900/60 border border-neutral-800/80 rounded flex flex-col">
          <span className="text-[11px] font-mono text-neutral-400 uppercase">Total Events</span>
          <span className="text-xl font-bold font-mono text-neutral-100 mt-1">{totalCount}</span>
        </div>
        <div className="p-3.5 bg-neutral-900/60 border border-neutral-800/80 rounded flex flex-col">
          <span className="text-[11px] font-mono text-emerald-400 uppercase">Published</span>
          <span className="text-xl font-bold font-mono text-emerald-300 mt-1">{totalPublished}</span>
        </div>
        <div className="p-3.5 bg-neutral-900/60 border border-neutral-800/80 rounded flex flex-col">
          <span className="text-[11px] font-mono text-neutral-400 uppercase">Drafts</span>
          <span className="text-xl font-bold font-mono text-neutral-300 mt-1">{totalDrafts}</span>
        </div>
        <div className="p-3.5 bg-neutral-900/60 border border-neutral-800/80 rounded flex flex-col">
          <span className="text-[11px] font-mono text-amber-400 uppercase">Archived</span>
          <span className="text-xl font-bold font-mono text-amber-300 mt-1">{totalArchived}</span>
        </div>
        <div className="p-3.5 bg-neutral-900/60 border border-neutral-800/80 rounded flex flex-col">
          <span className="text-[11px] font-mono text-[#F2613F] uppercase">Open Reg.</span>
          <span className="text-xl font-bold font-mono text-[#F2613F] mt-1">{openRegistrations}</span>
        </div>
        <div className="p-3.5 bg-neutral-900/60 border border-neutral-800/80 rounded flex flex-col">
          <span className="text-[11px] font-mono text-neutral-400 uppercase">Attendees</span>
          <span className="text-xl font-bold font-mono text-neutral-100 mt-1">{totalAttendees}</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, venue, or description..."
              className="w-full bg-neutral-950 border border-neutral-800 pl-9 pr-3 py-1.5 text-xs font-mono text-neutral-200 rounded focus:border-[#F2613F] focus:outline-none"
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

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 text-xs font-mono text-neutral-300 rounded focus:border-[#F2613F] focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Draft">Drafts</option>
              <option value="Published">Published</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-400">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 text-xs font-mono text-neutral-300 rounded focus:border-[#F2613F] focus:outline-none"
            >
              <option value="all">All Types</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Registration Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-neutral-400">Reg:</span>
            <select
              value={registrationFilter}
              onChange={(e) => {
                setRegistrationFilter(e.target.value);
                setPage(1);
              }}
              className="bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 text-xs font-mono text-neutral-300 rounded focus:border-[#F2613F] focus:outline-none"
            >
              <option value="all">All States</option>
              <option value="open">Open Only</option>
              <option value="closed">Closed Only</option>
              <option value="full">Capacity Full</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(search || statusFilter !== 'all' || typeFilter !== 'all' || registrationFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setTypeFilter('all');
                setRegistrationFilter('all');
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono rounded flex items-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs font-mono text-neutral-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
            <span>Loading events from SQLite...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-xs font-mono text-rose-400 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <span>{error}</span>
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-neutral-500">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
            <p>No events found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutral-950/80 border-b border-neutral-800 text-[11px] text-neutral-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Registration</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {events.map((event) => {
                  const isPublished = event.status === 'Published' || event.status === 'Upcoming';
                  const isArchived = event.status === 'Archived';
                  const isRegEnabled = event.registration_enabled === 1 || event.registrationEnabled === true;
                  const confirmed = event.confirmed_count || event.confirmedCount || 0;
                  const cap = event.capacity;
                  const isFull = typeof cap === 'number' && cap > 0 && confirmed >= cap;

                  return (
                    <tr key={event.id} className="hover:bg-neutral-800/30 transition-colors">
                      {/* Title & Slug */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {/* Image Thumbnail */}
                          <div className="w-10 h-10 rounded bg-neutral-950 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
                            {event.cover_image_url || event.coverImageUrl || event.cover_image ? (
                              <img
                                src={event.cover_image_url || event.coverImageUrl || event.cover_image || ''}
                                alt={event.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Calendar className="w-4 h-4 text-neutral-600" />
                            )}
                          </div>

                          <div>
                            <div className="font-semibold text-neutral-100 flex items-center gap-2">
                              <span>{event.title}</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-neutral-800 text-neutral-400 border border-neutral-700 rounded">
                                {event.event_type || event.eventType}
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                              /{event.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Schedule */}
                      <td className="py-3 px-4 text-neutral-300">
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-200">
                            {formatIsoForDisplay(event.event_start || event.eventStart || event.event_date)}
                          </span>
                          {event.event_end && (
                            <span className="text-[10px] text-neutral-500">
                              to {formatIsoForDisplay(event.event_end || event.eventEnd)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 text-neutral-300">
                        <span className="truncate block max-w-[160px]" title={event.location || event.venue || '—'}>
                          {event.location || event.venue || '—'}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold border ${
                            isPublished
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                              : isArchived
                              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                              : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                          }`}
                        >
                          {event.status}
                        </span>
                      </td>

                      {/* Registration State */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleRegistration(event)}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold border cursor-pointer hover:opacity-90 transition-opacity ${
                            !isRegEnabled || event.registration_status === 'CLOSED'
                              ? 'bg-neutral-950 border-neutral-800 text-neutral-500'
                              : isFull
                              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          }`}
                          title="Click to toggle registration state"
                        >
                          {!isRegEnabled || event.registration_status === 'CLOSED' ? (
                            <>
                              <ToggleLeft className="w-3 h-3 text-neutral-500" />
                              <span>Closed</span>
                            </>
                          ) : isFull ? (
                            <>
                              <AlertCircle className="w-3 h-3 text-amber-400" />
                              <span>Full</span>
                            </>
                          ) : (
                            <>
                              <ToggleRight className="w-3 h-3 text-emerald-400" />
                              <span>Open</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Capacity */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 w-28">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-neutral-200">{confirmed}</span>
                            <span className="text-neutral-500">
                              {typeof cap === 'number' && cap > 0 ? `/ ${cap}` : 'unlimited'}
                            </span>
                          </div>
                          {typeof cap === 'number' && cap > 0 && (
                            <div className="w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden border border-neutral-800">
                              <div
                                className={`h-full transition-all ${
                                  isFull ? 'bg-amber-500' : 'bg-[#F2613F]'
                                }`}
                                style={{ width: `${Math.min(100, (confirmed / cap) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Manage Registrations Modal Trigger */}
                          <button
                            type="button"
                            onClick={() => setRegModalEvent(event)}
                            className="p-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded transition-colors cursor-pointer"
                            title="View Registrations & Attendees"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Publish / Unpublish Toggle */}
                          {isPublished ? (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(event, 'Draft')}
                              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 rounded text-[10px] font-mono cursor-pointer"
                              title="Unpublish to Draft"
                            >
                              Unpublish
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(event, 'Published')}
                              className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/40 text-emerald-300 rounded text-[10px] font-mono font-semibold cursor-pointer"
                              title="Publish Event"
                            >
                              Publish
                            </button>
                          )}

                          {/* Edit Drawer Trigger */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(event)}
                            className="p-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded transition-colors cursor-pointer"
                            title="Edit Event Details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Trigger */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(event)}
                            className="p-1.5 bg-neutral-800/80 hover:bg-rose-950/80 hover:text-rose-300 text-neutral-400 rounded transition-colors cursor-pointer"
                            title="Delete Event"
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

        {/* Pagination Bar */}
        {totalCount > pageSize && (
          <div className="p-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-400">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span>
                Page {page} of {Math.ceil(totalCount / pageSize)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(totalCount / pageSize)}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. SLIDE-OVER EVENT EDITOR DRAWER                         */}
      {/* ========================================================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-neutral-900 border-l border-neutral-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold font-mono text-neutral-100">
                  {editingEvent ? 'EDIT EVENT' : 'CREATE NEW EVENT'}
                </h2>
                <p className="text-xs text-neutral-400 font-mono mt-0.5">
                  Configure event logistics, schedule window, imagery, and capacity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <form onSubmit={handleSaveEvent} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs font-mono">
              {/* Title & Slug */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    placeholder="e.g. Algorithmic Visuals & Creative Code Showcase"
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                  />
                  {formValidation.title && (
                    <p className="text-[11px] text-rose-400 mt-1">{formValidation.title}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-bold">
                      Slug *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomSlug(!isCustomSlug)}
                      className="text-[10px] text-[#F2613F] hover:underline cursor-pointer"
                    >
                      {isCustomSlug ? 'Auto-generate from Title' : 'Customize Slug'}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    disabled={!isCustomSlug}
                    value={formData.slug}
                    onChange={(e) => handleFieldChange('slug', e.target.value)}
                    placeholder="algorithmic-visuals-showcase"
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 rounded text-neutral-200 disabled:opacity-60 disabled:bg-neutral-900 focus:border-[#F2613F] focus:outline-none"
                  />
                  {formValidation.slug && (
                    <p className="text-[11px] text-rose-400 mt-1">{formValidation.slug}</p>
                  )}
                </div>
              </div>

              {/* Type, Location & Venue */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
                    Event Type
                  </label>
                  <select
                    value={formData.eventType}
                    onChange={(e) => handleFieldChange('eventType', e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
                    Location / Room
                  </label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => handleFieldChange('location', e.target.value)}
                    placeholder="e.g. Engineering Atrium // Lab 204"
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
                    Short Description (Summary)
                  </label>
                  <input
                    type="text"
                    value={formData.shortDescription || ''}
                    onChange={(e) => handleFieldChange('shortDescription', e.target.value)}
                    placeholder="Brief 1-line elevator pitch for previews..."
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
                    Full Description (Markdown supported)
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Detailed workshop agenda, requisites, and outcomes..."
                    className="w-full bg-neutral-950 border border-neutral-800 p-3 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Schedule Section */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded space-y-3">
                <div className="flex items-center gap-2 text-neutral-200 font-bold border-b border-neutral-800 pb-2">
                  <Clock className="w-4 h-4 text-[#F2613F]" />
                  <span>EVENT SCHEDULE (UTC ISO-8601)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Event Start Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={isoToDateTimeLocal(formData.eventStart)}
                      onChange={(e) => handleFieldChange('eventStart', dateTimeLocalToIso(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Event End Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={isoToDateTimeLocal(formData.eventEnd)}
                      onChange={(e) => handleFieldChange('eventEnd', dateTimeLocalToIso(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                    />
                  </div>
                </div>

                {formValidation.schedule && (
                  <p className="text-[11px] text-rose-400 font-semibold">{formValidation.schedule}</p>
                )}
              </div>

              {/* Registration Settings Section */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <div className="flex items-center gap-2 text-neutral-200 font-bold">
                    <Users className="w-4 h-4 text-[#F2613F]" />
                    <span>REGISTRATION & CAPACITY CONTROLS</span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.registrationEnabled)}
                      onChange={(e) => handleFieldChange('registrationEnabled', e.target.checked)}
                      className="rounded border-neutral-700 bg-neutral-900 text-[#F2613F] focus:ring-0"
                    />
                    <span className="text-[11px] text-neutral-300 font-medium">Enabled</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Max Capacity</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.capacity ?? ''}
                      onChange={(e) =>
                        handleFieldChange('capacity', e.target.value === '' ? null : parseInt(e.target.value, 10))
                      }
                      placeholder="Leave blank for unlimited"
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Opens (Optional)</label>
                    <input
                      type="datetime-local"
                      value={isoToDateTimeLocal(formData.registrationStart)}
                      onChange={(e) => handleFieldChange('registrationStart', dateTimeLocalToIso(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Closes (Optional)</label>
                    <input
                      type="datetime-local"
                      value={isoToDateTimeLocal(formData.registrationEnd)}
                      onChange={(e) => handleFieldChange('registrationEnd', dateTimeLocalToIso(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">
                    External RSVP URL (Fallback override)
                  </label>
                  <input
                    type="url"
                    value={formData.registrationUrl || ''}
                    onChange={(e) => handleFieldChange('registrationUrl', e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                  />
                </div>
              </div>

              {/* Media & Cover Image Section */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded space-y-3">
                <div className="flex items-center gap-2 text-neutral-200 font-bold border-b border-neutral-800 pb-2">
                  <Camera className="w-4 h-4 text-[#F2613F]" />
                  <span>EVENT POSTER / COVER IMAGE</span>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {imagePreviewUrl ? (
                      <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-6 h-6 text-neutral-600" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded flex items-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Select Poster Image</span>
                      </button>
                      {imagePreviewUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImageFile(null);
                            setImagePreviewUrl(null);
                            handleFieldChange('coverImageUrl', '');
                          }}
                          className="px-2 py-1.5 text-rose-400 hover:text-rose-300 text-xs cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500">
                      JPEG, PNG, WebP supported. Max 10MB. Sniffed via magic bytes and uploaded to Cloudinary.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status & Featured */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
                    Publication Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 rounded text-neutral-200 focus:border-[#F2613F] focus:outline-none"
                  >
                    <option value="Draft">Draft (Hidden from public)</option>
                    <option value="Published">Published (Public)</option>
                    <option value="Archived">Archived (Internal history)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.featured)}
                      onChange={(e) => handleFieldChange('featured', e.target.checked)}
                      className="rounded border-neutral-700 bg-neutral-950 text-[#F2613F] focus:ring-0"
                    />
                    <span className="text-xs text-neutral-300 font-medium">Highlight on Homepage</span>
                  </label>
                </div>
              </div>

              {/* Drawer Action Footer */}
              <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploadingImage}
                  className="px-5 py-2 bg-[#F2613F] hover:bg-[#fa7353] text-white rounded text-xs font-mono font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {(isSaving || isUploadingImage) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingEvent ? 'Save Changes' : 'Create Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. ATTENDEE & REGISTRATION MANAGEMENT MODAL               */}
      {/* ========================================================= */}
      {regModalEvent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#F2613F]" />
                  <h2 className="text-sm font-bold font-mono text-neutral-100">
                    REGISTRATIONS: {regModalEvent.title}
                  </h2>
                </div>
                <p className="text-xs text-neutral-400 font-mono mt-0.5">
                  {formatIsoForDisplay(regModalEvent.event_start || regModalEvent.eventStart)} •{' '}
                  {registrations.filter((r) => r.status === 'CONFIRMED').length} confirmed /{' '}
                  {regModalEvent.capacity ? `${regModalEvent.capacity} capacity` : 'unlimited capacity'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                  title="Export Attendee CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegModalEvent(null)}
                  className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Filter Bar */}
            <div className="p-3 bg-neutral-950 border-b border-neutral-800 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={regSearch}
                  onChange={(e) => setRegSearch(e.target.value)}
                  placeholder="Search attendees by name, email, department..."
                  className="w-full bg-neutral-900 border border-neutral-800 pl-9 pr-3 py-1.5 text-xs font-mono text-neutral-200 rounded focus:border-[#F2613F] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[11px] font-mono text-neutral-400">Status:</span>
                <select
                  value={regStatusFilter}
                  onChange={(e) => setRegStatusFilter(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-xs font-mono text-neutral-300 rounded focus:border-[#F2613F] focus:outline-none"
                >
                  <option value="all">All Registrations</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="ATTENDED">Attended</option>
                </select>
              </div>
            </div>

            {/* Registrations List */}
            <div className="p-4 overflow-y-auto flex-1">
              {isRegLoading ? (
                <div className="py-12 text-center text-xs font-mono text-neutral-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                  <span>Loading registration roster...</span>
                </div>
              ) : registrations.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-neutral-500">
                  <Users className="w-6 h-6 mx-auto mb-2 text-neutral-600" />
                  <p>No attendee registrations found.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead className="border-b border-neutral-800 text-[11px] text-neutral-400 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Attendee</th>
                      <th className="py-2.5 px-3">Department / College</th>
                      <th className="py-2.5 px-3">Registered At</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {registrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-neutral-800/30">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-200">{reg.attendee_name}</div>
                          <div className="text-[11px] text-neutral-500">{reg.attendee_email}</div>
                          {reg.attendee_phone && (
                            <div className="text-[10px] text-neutral-600">{reg.attendee_phone}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-300">
                          {reg.department || reg.organization || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400">
                          {formatIsoForDisplay(reg.registration_timestamp)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-semibold border ${
                              reg.status === 'CONFIRMED'
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                : reg.status === 'CANCELLED'
                                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                                : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                            }`}
                          >
                            {reg.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {reg.status === 'CONFIRMED' && (
                            <button
                              type="button"
                              onClick={() => handleCancelRegistration(reg.id)}
                              className="px-2 py-1 bg-neutral-800 hover:bg-rose-950/80 hover:text-rose-300 text-neutral-400 rounded text-[10px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-400">
              <span>{registrations.length} Total Registered Records</span>
              <button
                type="button"
                onClick={() => setRegModalEvent(null)}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. PERMANENT DELETE CONFIRMATION MODAL                    */}
      {/* ========================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 font-mono font-bold">
              <Shield className="w-5 h-5 text-rose-500" />
              <span>CONFIRM EVENT DELETION</span>
            </div>
            <p className="text-xs text-neutral-300 font-mono leading-relaxed">
              Are you sure you want to permanently delete event <strong>"{deleteTarget.title}"</strong>?
              All associated registrations and attendee links will be permanently cascaded. This action is audited and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded cursor-pointer shadow-sm"
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

export default AdminEventsPage;
