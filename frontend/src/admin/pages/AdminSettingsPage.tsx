import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { fetchAdminSettings, updateAdminSettings } from '../api.ts';
import { AdminSettingsMap, AdminSettingSchemaItem, AdminRoute } from '../types.ts';
import {
  Settings,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Building,
  CreditCard,
  Power,
  Share2,
  Clock,
  ExternalLink,
  Shield,
  HelpCircle,
} from 'lucide-react';

interface AdminSettingsPageProps {
  onNavigate: (route: AdminRoute) => void;
}

export const AdminSettingsPage: React.FC<AdminSettingsPageProps> = () => {
  const [initialSettings, setInitialSettings] = useState<AdminSettingsMap>({});
  const [currentSettings, setCurrentSettings] = useState<AdminSettingsMap>({});
  const [schema, setSchema] = useState<AdminSettingSchemaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const res = await fetchAdminSettings();

    if (res.success && res.data) {
      setInitialSettings(res.data.settings);
      setCurrentSettings(res.data.settings);
      setSchema(res.data.schema);
      setIsLoading(false);
    } else {
      setErrorMessage(res.error || 'Failed to load system settings from backend database.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Track modified keys
  const modifiedKeys = useMemo(() => {
    const changed: string[] = [];
    for (const key of Object.keys(currentSettings)) {
      const orig = initialSettings[key];
      const curr = currentSettings[key];
      if (JSON.stringify(orig) !== JSON.stringify(curr)) {
        changed.push(key);
      }
    }
    return changed;
  }, [initialSettings, currentSettings]);

  const hasChanges = modifiedKeys.length > 0;

  const handleFieldChange = (key: string, value: any) => {
    setCurrentSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    // Clear error on edit
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleNestedFieldChange = (parentKey: string, nestedKey: string, value: any) => {
    const parentObj = (currentSettings[parentKey] || {}) as Record<string, any>;
    const updated = {
      ...parentObj,
      [nestedKey]: value,
    };
    handleFieldChange(parentKey, updated);
  };

  const handleResetField = (key: string) => {
    const def = schema.find((s) => s.key === key);
    if (def) {
      handleFieldChange(key, def.defaultValue);
    }
  };

  const handleDiscardChanges = () => {
    setCurrentSettings(initialSettings);
    setFieldErrors({});
    setErrorMessage(null);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasChanges) return;

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setFieldErrors({});

    // Client-side quick check
    const newErrors: Record<string, string> = {};
    if (currentSettings.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(currentSettings.contact_email))) {
      newErrors.contact_email = 'Please enter a valid email address';
    }
    if (currentSettings.member_id_prefix && !/^[A-Z]{2,5}-$/.test(String(currentSettings.member_id_prefix))) {
      newErrors.member_id_prefix = 'Prefix must be 2-5 uppercase letters followed by a hyphen (e.g. NX-)';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setErrorMessage('Please resolve validation errors before saving.');
      setIsSaving(false);
      return;
    }

    // Build diff payload of changed keys only
    const payload: Record<string, any> = {};
    for (const key of modifiedKeys) {
      payload[key] = currentSettings[key];
    }

    const res = await updateAdminSettings(payload);

    if (res.success && res.data) {
      setInitialSettings(res.data.settings);
      setCurrentSettings(res.data.settings);
      setSuccessMessage(`Successfully updated ${res.data.updatedKeys.length} setting(s). All caches invalidated.`);
      setIsSaving(false);
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setErrorMessage(res.error || 'Failed to save settings to database.');
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-neutral-500 font-mono text-xs flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-indigo-500 rounded-full animate-spin" />
        <span>Loading authoritative settings from SQLite...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-indigo-400" />
            System & Organization Settings
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Authoritative runtime operational parameters, identity prefixing, and public branding backed by SQLite.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono bg-amber-950/60 text-amber-400 border border-amber-800/60 animate-pulse">
              {modifiedKeys.length} unsaved change{modifiedKeys.length > 1 ? 's' : ''}
            </span>
          )}

          {hasChanges && (
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={!hasChanges || isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: Organization & Public Branding */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-800 text-neutral-200 font-medium text-sm">
            <Building className="w-4 h-4 text-indigo-400" />
            <span>Organization & Public Branding</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* site_name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-300">
                  Organization Display Name
                </label>
                <button
                  type="button"
                  onClick={() => handleResetField('site_name')}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 font-mono"
                  title="Reset to default"
                >
                  Reset Default
                </button>
              </div>
              <input
                type="text"
                value={currentSettings.site_name || ''}
                onChange={(e) => handleFieldChange('site_name', e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. NEXUS"
              />
              <p className="text-[11px] text-neutral-500">
                Shown across website headers, document titles, and E-ID card badges.
              </p>
            </div>

            {/* contact_email */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-300">
                  Official Contact Email
                </label>
                <button
                  type="button"
                  onClick={() => handleResetField('contact_email')}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 font-mono"
                  title="Reset to default"
                >
                  Reset Default
                </button>
              </div>
              <input
                type="email"
                value={currentSettings.contact_email || ''}
                onChange={(e) => handleFieldChange('contact_email', e.target.value)}
                className={`w-full bg-neutral-950 border rounded px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none ${
                  fieldErrors.contact_email ? 'border-red-500' : 'border-neutral-800 focus:border-indigo-500'
                }`}
                placeholder="e.g. contact@nexus.campus"
              />
              {fieldErrors.contact_email ? (
                <p className="text-[11px] text-red-400">{fieldErrors.contact_email}</p>
              ) : (
                <p className="text-[11px] text-neutral-500">
                  Rendered on the public Contact page and official communications.
                </p>
              )}
            </div>

            {/* tagline */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-300">
                  Community Tagline
                </label>
                <button
                  type="button"
                  onClick={() => handleResetField('tagline')}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 font-mono"
                  title="Reset to default"
                >
                  Reset Default
                </button>
              </div>
              <input
                type="text"
                value={currentSettings.tagline || ''}
                onChange={(e) => handleFieldChange('tagline', e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. Student Innovation & Project Building Community"
              />
              <p className="text-[11px] text-neutral-500">
                Motto and mission summary displayed on hero sections and about cards.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: Member Directory & E-ID Identity */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-800 text-neutral-200 font-medium text-sm">
            <CreditCard className="w-4 h-4 text-sky-400" />
            <span>Member Directory & E-ID Identity</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* member_id_prefix */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-300">
                  Member ID Prefix
                </label>
                <button
                  type="button"
                  onClick={() => handleResetField('member_id_prefix')}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 font-mono"
                  title="Reset to default"
                >
                  Reset Default
                </button>
              </div>
              <input
                type="text"
                value={currentSettings.member_id_prefix || ''}
                onChange={(e) => handleFieldChange('member_id_prefix', e.target.value.toUpperCase())}
                className={`w-full bg-neutral-950 border rounded px-3 py-2 text-xs text-neutral-200 font-mono placeholder-neutral-500 focus:outline-none ${
                  fieldErrors.member_id_prefix ? 'border-red-500' : 'border-neutral-800 focus:border-indigo-500'
                }`}
                placeholder="e.g. NX-"
              />
              {fieldErrors.member_id_prefix ? (
                <p className="text-[11px] text-red-400">{fieldErrors.member_id_prefix}</p>
              ) : (
                <p className="text-[11px] text-neutral-500">
                  Prefix used when sequentially generating permanent IDs (e.g. <span className="font-mono">NX-030</span>).
                </p>
              )}
            </div>

            {/* public_identity_label */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-300">
                  Public Identity Label
                </label>
                <button
                  type="button"
                  onClick={() => handleResetField('public_identity_label')}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 font-mono"
                  title="Reset to default"
                >
                  Reset Default
                </button>
              </div>
              <input
                type="text"
                value={currentSettings.public_identity_label || ''}
                onChange={(e) => handleFieldChange('public_identity_label', e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. NEXUS // E-ID"
              />
              <p className="text-[11px] text-neutral-500">
                Classification header rendered at the top of digital member badges.
              </p>
            </div>

            {/* eid_base_url */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-300">
                  E-ID Canonical Base URL
                </label>
                <button
                  type="button"
                  onClick={() => handleResetField('eid_base_url')}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 font-mono"
                  title="Reset to default"
                >
                  Reset Default
                </button>
              </div>
              <input
                type="text"
                value={currentSettings.eid_base_url || ''}
                onChange={(e) => handleFieldChange('eid_base_url', e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. https://nexus.campus (Leave blank for relative origin URL)"
              />
              <p className="text-[11px] text-neutral-500">
                Optional absolute domain prepended to QR code verification links and card shares.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: Operations & Platform Availability */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-800 text-neutral-200 font-medium text-sm">
            <Power className="w-4 h-4 text-amber-400" />
            <span>Platform Availability & Operations</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Maintenance Mode</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    currentSettings.maintenance_mode
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}
                >
                  {currentSettings.maintenance_mode ? 'PAUSED' : 'OPERATIONAL'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                When enabled, public recruitment application submissions are paused with HTTP 503 and a maintenance status is published.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleFieldChange('maintenance_mode', !currentSettings.maintenance_mode)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                currentSettings.maintenance_mode ? 'bg-amber-600' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  currentSettings.maintenance_mode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* SECTION 4: Studio Schedule & Links */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-800 text-neutral-200 font-medium text-sm">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Studio Hours & Meeting Schedule</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Session Days</label>
              <input
                type="text"
                value={currentSettings.open_sessions?.day || ''}
                onChange={(e) => handleNestedFieldChange('open_sessions', 'day', e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. Tuesdays & Thursdays"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Session Hours</label>
              <input
                type="text"
                value={currentSettings.open_sessions?.time || ''}
                onChange={(e) => handleNestedFieldChange('open_sessions', 'time', e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. 18:00 - 21:00"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Location / Room</label>
              <input
                type="text"
                value={currentSettings.open_sessions?.location || ''}
                onChange={(e) => handleNestedFieldChange('open_sessions', 'location', e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. SOA Main Lab // Room 304"
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: Social Channels */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-800 text-neutral-200 font-medium text-sm">
            <Share2 className="w-4 h-4 text-purple-400" />
            <span>Community Social Handles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">GitHub Organization</label>
              <input
                type="text"
                value={currentSettings.socials?.github || ''}
                onChange={(e) => handleNestedFieldChange('socials', 'github', e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                placeholder="https://github.com/..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Instagram Handle</label>
              <input
                type="text"
                value={currentSettings.socials?.instagram || ''}
                onChange={(e) => handleNestedFieldChange('socials', 'instagram', e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                placeholder="https://www.instagram.com/..."
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
