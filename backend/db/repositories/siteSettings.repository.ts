import { getDatabase } from '../connection.ts';

export interface SiteSettingRecord {
  key: string;
  value: string; // JSON string or plain text
  description: string | null;
  value_type?: string;
  updated_at: string;
}

export class SiteSettingsRepository {
  private get db() {
    return getDatabase();
  }

  public get(key: string): SiteSettingRecord | null {
    const stmt = this.db.prepare('SELECT * FROM site_settings WHERE key = ?');
    const row = stmt.get(key);
    return (row as unknown as SiteSettingRecord) || null;
  }

  public getAll(): SiteSettingRecord[] {
    const stmt = this.db.prepare('SELECT * FROM site_settings ORDER BY key ASC');
    return stmt.all() as unknown as SiteSettingRecord[];
  }

  public set(key: string, value: string, description?: string, value_type?: string): SiteSettingRecord {
    const now = new Date().toISOString();
    const type = value_type || 'string';
    const stmt = this.db.prepare(`
      INSERT INTO site_settings (key, value, description, value_type, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        description = coalesce(excluded.description, site_settings.description),
        value_type = coalesce(excluded.value_type, site_settings.value_type),
        updated_at = excluded.updated_at
    `);
    stmt.run(key, value, description || null, type, now);

    return {
      key,
      value,
      description: description || null,
      value_type: type,
      updated_at: now,
    };
  }

  public delete(key: string): boolean {
    const stmt = this.db.prepare('DELETE FROM site_settings WHERE key = ?');
    const result = stmt.run(key);
    return Number(result.changes) > 0;
  }
}

export const siteSettingsRepository = new SiteSettingsRepository();
