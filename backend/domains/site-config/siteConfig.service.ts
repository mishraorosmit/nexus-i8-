import { settingsService } from '../../services/settings.service.ts';
import { siteSettingsRepository, SiteSettingRecord } from '../../db/repositories/siteSettings.repository.ts';

export class SiteConfigService {
  public async getConfig(): Promise<Record<string, unknown>> {
    return settingsService.getPublicSettings();
  }

  public async getSetting(key: string): Promise<SiteSettingRecord | null> {
    return siteSettingsRepository.get(key);
  }

  public async updateConfig(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = settingsService.updateSettings(data);
    return result.settings;
  }
}

export const siteConfigService = new SiteConfigService();
