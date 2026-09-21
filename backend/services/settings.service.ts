import { siteSettingsRepository, SiteSettingRecord } from '../db/repositories/siteSettings.repository.ts';
import { auditService } from './audit.service.ts';
import { memoryCache } from '../utils/cache.ts';
import { AppError } from '../middleware/errorHandler.ts';

export type SettingType = 'string' | 'boolean' | 'number' | 'json';
export type SettingCategory = 'general' | 'identity' | 'operations';

export interface SettingDefinition<T = any> {
  key: string;
  label: string;
  category: SettingCategory;
  description: string;
  type: SettingType;
  defaultValue: T;
  isPublic: boolean;
  validate: (val: any) => { valid: boolean; error?: string; sanitized: T };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const ID_PREFIX_REGEX = /^[A-Z]{2,5}-$/;

export const SETTING_DEFINITIONS: Record<string, SettingDefinition> = {
  site_name: {
    key: 'site_name',
    label: 'Organization Display Name',
    category: 'general',
    description: 'Public community and organization title displayed across site navigation and cards.',
    type: 'string',
    defaultValue: 'NEXUS',
    isPublic: true,
    validate: (val: any) => {
      if (typeof val !== 'string') return { valid: false, error: 'site_name must be a text string', sanitized: 'NEXUS' };
      const cleaned = val.trim().replace(/[<>]/g, '');
      if (cleaned.length < 2 || cleaned.length > 50) {
        return { valid: false, error: 'site_name must be between 2 and 50 characters', sanitized: 'NEXUS' };
      }
      return { valid: true, sanitized: cleaned };
    },
  },

  site_title: {
    key: 'site_title',
    label: 'Site Title',
    category: 'general',
    description: 'Alternative title display for the platform.',
    type: 'string',
    defaultValue: 'NEXUS',
    isPublic: true,
    validate: (val: any) => {
      if (typeof val !== 'string') return { valid: false, error: 'site_title must be a text string', sanitized: 'NEXUS' };
      const cleaned = val.trim().replace(/[<>]/g, '');
      if (cleaned.length < 2 || cleaned.length > 50) {
        return { valid: false, error: 'site_title must be between 2 and 50 characters', sanitized: 'NEXUS' };
      }
      return { valid: true, sanitized: cleaned };
    },
  },

  tagline: {
    key: 'tagline',
    label: 'Hero & Community Tagline',
    category: 'general',
    description: 'High-level community motto displayed on hero and about sections.',
    type: 'string',
    defaultValue: 'Student Innovation & Project Building Community',
    isPublic: true,
    validate: (val: any) => {
      if (typeof val !== 'string') return { valid: false, error: 'tagline must be a text string', sanitized: 'Student Innovation & Project Building Community' };
      const cleaned = val.trim().replace(/[<>]/g, '');
      if (cleaned.length < 5 || cleaned.length > 150) {
        return { valid: false, error: 'tagline must be between 5 and 150 characters', sanitized: 'Student Innovation & Project Building Community' };
      }
      return { valid: true, sanitized: cleaned };
    },
  },

  contact_email: {
    key: 'contact_email',
    label: 'Official Contact Email',
    category: 'general',
    description: 'Primary contact email for inquiries, collaborations, and public communication.',
    type: 'string',
    defaultValue: 'contact@nexus.campus',
    isPublic: true,
    validate: (val: any) => {
      if (typeof val !== 'string') return { valid: false, error: 'contact_email must be an email string', sanitized: 'contact@nexus.campus' };
      const cleaned = val.trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleaned) || cleaned.length > 100) {
        return { valid: false, error: 'contact_email must be a valid email address (max 100 chars)', sanitized: 'contact@nexus.campus' };
      }
      return { valid: true, sanitized: cleaned };
    },
  },

  member_id_prefix: {
    key: 'member_id_prefix',
    label: 'Member ID Prefix',
    category: 'identity',
    description: 'Prefix used when auto-allocating permanent member unique IDs (e.g. NX-).',
    type: 'string',
    defaultValue: 'NX-',
    isPublic: false,
    validate: (val: any) => {
      if (typeof val !== 'string') return { valid: false, error: 'member_id_prefix must be a string', sanitized: 'NX-' };
      const cleaned = val.trim().toUpperCase();
      if (!ID_PREFIX_REGEX.test(cleaned)) {
        return { valid: false, error: 'member_id_prefix must be 2-5 uppercase letters followed by a hyphen (e.g. NX-)', sanitized: 'NX-' };
      }
      return { valid: true, sanitized: cleaned };
    },
  },

  public_identity_label: {
    key: 'public_identity_label',
    label: 'Public Identity Label',
    category: 'identity',
    description: 'Header and badge classification title rendered on public E-ID cards.',
    type: 'string',
    defaultValue: 'NEXUS // E-ID',
    isPublic: true,
    validate: (val: any) => {
      if (typeof val !== 'string') return { valid: false, error: 'public_identity_label must be a text string', sanitized: 'NEXUS // E-ID' };
      const cleaned = val.trim().replace(/[<>]/g, '');
      if (cleaned.length < 2 || cleaned.length > 40) {
        return { valid: false, error: 'public_identity_label must be between 2 and 40 characters', sanitized: 'NEXUS // E-ID' };
      }
      return { valid: true, sanitized: cleaned };
    },
  },

  eid_base_url: {
    key: 'eid_base_url',
    label: 'E-ID Public Canonical Base URL',
    category: 'identity',
    description: 'Base URL for public verification links and QR code targets (leave empty for relative URLs).',
    type: 'string',
    defaultValue: '',
    isPublic: true,
    validate: (val: any) => {
      if (val === null || val === undefined || val === '') {
        return { valid: true, sanitized: '' };
      }
      if (typeof val !== 'string') return { valid: false, error: 'eid_base_url must be a URL string or empty', sanitized: '' };
      const cleaned = val.trim().replace(/\/+$/, '');
      if (cleaned !== '' && !URL_REGEX.test(cleaned)) {
        return { valid: false, error: 'eid_base_url must be a valid HTTP or HTTPS URL (no trailing slash)', sanitized: '' };
      }
      if (cleaned.length > 200) {
        return { valid: false, error: 'eid_base_url cannot exceed 200 characters', sanitized: '' };
      }
      return { valid: true, sanitized: cleaned };
    },
  },

  maintenance_mode: {
    key: 'maintenance_mode',
    label: 'Maintenance Mode',
    category: 'operations',
    description: 'When enabled, public recruitment form submissions are paused and status notice is shown.',
    type: 'boolean',
    defaultValue: false,
    isPublic: true,
    validate: (val: any) => {
      if (typeof val === 'boolean') {
        return { valid: true, sanitized: val };
      }
      if (typeof val === 'string') {
        const lower = val.trim().toLowerCase();
        if (lower === 'true' || lower === '1') return { valid: true, sanitized: true };
        if (lower === 'false' || lower === '0') return { valid: true, sanitized: false };
      }
      return { valid: false, error: 'maintenance_mode must be true or false', sanitized: false };
    },
  },

  socials: {
    key: 'socials',
    label: 'Official Social Media Links',
    category: 'general',
    description: 'Official social media handles and community channels.',
    type: 'json',
    defaultValue: {
      github: 'https://github.com/nexushuborg',
      instagram: 'https://www.instagram.com/nexusfordev',
    },
    isPublic: true,
    validate: (val: any) => {
      let parsed = val;
      if (typeof val === 'string') {
        try {
          parsed = JSON.parse(val);
        } catch {
          return { valid: false, error: 'socials must be valid JSON', sanitized: SETTING_DEFINITIONS.socials.defaultValue };
        }
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, error: 'socials must be a JSON key-value object', sanitized: SETTING_DEFINITIONS.socials.defaultValue };
      }
      return { valid: true, sanitized: parsed };
    },
  },

  open_sessions: {
    key: 'open_sessions',
    label: 'Studio Open Hours & Location',
    category: 'operations',
    description: 'Meeting schedule and lab room information for collaborative open sessions.',
    type: 'json',
    defaultValue: {
      day: 'Tuesdays & Thursdays',
      time: '18:00 - 21:00',
      location: 'SOA Main Lab // Room 304',
    },
    isPublic: true,
    validate: (val: any) => {
      let parsed = val;
      if (typeof val === 'string') {
        try {
          parsed = JSON.parse(val);
        } catch {
          return { valid: false, error: 'open_sessions must be valid JSON', sanitized: SETTING_DEFINITIONS.open_sessions.defaultValue };
        }
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, error: 'open_sessions must be a JSON key-value object', sanitized: SETTING_DEFINITIONS.open_sessions.defaultValue };
      }
      return { valid: true, sanitized: parsed };
    },
  },
};

export class SettingsService {
  /**
   * Get a typed setting by key with schema validation and fallback default.
   */
  public getSetting<T = any>(key: string): T {
    const def = SETTING_DEFINITIONS[key];
    if (!def) {
      // Fallback for ad-hoc keys
      const row = siteSettingsRepository.get(key);
      if (!row) return undefined as unknown as T;
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value as unknown as T;
      }
    }

    const row = siteSettingsRepository.get(key);
    if (!row || row.value === undefined || row.value === null) {
      return def.defaultValue as T;
    }

    try {
      let parsedVal: any = row.value;
      if (def.type === 'boolean') {
        parsedVal = row.value === 'true' || row.value === '1';
      } else if (def.type === 'number') {
        parsedVal = Number(row.value);
      } else if (def.type === 'json') {
        parsedVal = JSON.parse(row.value);
      }
      const validation = def.validate(parsedVal);
      return (validation.valid ? validation.sanitized : def.defaultValue) as T;
    } catch {
      return def.defaultValue as T;
    }
  }

  /**
   * Get all defined settings with validated values and defaults.
   */
  public getAllSettings(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of Object.keys(SETTING_DEFINITIONS)) {
      result[key] = this.getSetting(key);
    }
    return result;
  }

  /**
   * Get all public settings for client consumption (excludes internal keys like member_id_prefix).
   */
  public getPublicSettings(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, def] of Object.entries(SETTING_DEFINITIONS)) {
      if (def.isPublic) {
        result[key] = this.getSetting(key);
      }
    }
    return result;
  }

  /**
   * Get setting schema definitions for frontend admin operations console.
   */
  public getSettingsSchema(): Array<{
    key: string;
    label: string;
    category: SettingCategory;
    description: string;
    type: SettingType;
    defaultValue: any;
  }> {
    return Object.values(SETTING_DEFINITIONS).map((def) => ({
      key: def.key,
      label: def.label,
      category: def.category,
      description: def.description,
      type: def.type,
      defaultValue: def.defaultValue,
    }));
  }

  /**
   * Validate and update settings atomically, recording audit logs and invalidating caches.
   */
  public updateSettings(
    updates: Record<string, any>,
    adminContext?: {
      adminId?: string | null;
      adminName?: string | null;
      adminRole?: string | null;
      ipAddress?: string | null;
      actor?: string;
    }
  ): { updatedKeys: string[]; settings: Record<string, any> } {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new AppError(400, 'Settings update payload must be an object', undefined, 'INVALID_PAYLOAD');
    }

    // 1. Pre-validate all keys to guarantee all-or-nothing consistency
    const validatedEntries: Array<{ key: string; def: SettingDefinition; sanitized: any; serialized: string }> = [];
    const errors: Record<string, string> = {};

    for (const [key, val] of Object.entries(updates)) {
      const def = SETTING_DEFINITIONS[key];
      if (!def) {
        throw new AppError(400, `Setting key '${key}' is not allowed or does not exist.`, undefined, 'INVALID_SETTING_KEY');
      }

      const res = def.validate(val);
      if (!res.valid) {
        errors[key] = res.error || `Invalid value for setting '${key}'`;
      } else {
        const serialized =
          def.type === 'json'
            ? JSON.stringify(res.sanitized)
            : def.type === 'boolean'
            ? String(res.sanitized)
            : String(res.sanitized);

        validatedEntries.push({
          key,
          def,
          sanitized: res.sanitized,
          serialized,
        });
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new AppError(400, 'Validation failed for one or more settings', errors, 'SETTINGS_VALIDATION_FAILED');
    }

    // 2. Snapshot previous values for audit logging
    const previousSettings: Record<string, any> = {};
    const newSettings: Record<string, any> = {};
    const updatedKeys: string[] = [];

    for (const entry of validatedEntries) {
      previousSettings[entry.key] = this.getSetting(entry.key);
      siteSettingsRepository.set(entry.key, entry.serialized, entry.def.description, entry.def.type);
      newSettings[entry.key] = entry.sanitized;
      updatedKeys.push(entry.key);
    }

    // 3. Invalidate dependent caches
    memoryCache.invalidate('site-config');
    memoryCache.invalidate('eid');

    // 4. Record audit log
    if (updatedKeys.length > 0) {
      auditService.log({
        adminId: adminContext?.adminId || null,
        adminName: adminContext?.adminName || 'Admin',
        adminRole: adminContext?.adminRole || 'admin',
        action: 'SETTINGS_CHANGED',
        entityType: 'SITE_SETTINGS',
        entityId: 'global',
        details: { updatedKeys },
        beforeJson: previousSettings,
        afterJson: newSettings,
        ipAddress: adminContext?.ipAddress || null,
        adminContext: {
          adminId: adminContext?.adminId || null,
          adminName: adminContext?.adminName || 'Admin',
          adminRole: adminContext?.adminRole || 'super_admin',
          actor: 'authenticated-admin',
        },
      });
    }

    return {
      updatedKeys,
      settings: this.getAllSettings(),
    };
  }
}

export const settingsService = new SettingsService();
