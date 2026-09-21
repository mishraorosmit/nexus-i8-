import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../../services/settings.service.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { apiSuccess } from '../../utils/apiResponse.ts';

export class AdminSiteSettingsController {
  public async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = settingsService.getAllSettings();
      const schema = settingsService.getSettingsSchema();

      res.status(200).json(
        apiSuccess({
          settings,
          schema,
        })
      );
    } catch (err) {
      next(err);
    }
  }

  public async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawPayload = req.body.settings !== undefined ? req.body.settings : req.body;

      if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
        throw new AppError(400, 'Settings payload must be an object', undefined, 'INVALID_SETTINGS_PAYLOAD');
      }

      const adminContext = {
        adminId: req.admin?.adminId || null,
        adminName: req.admin?.name || 'Admin',
        adminRole: req.admin?.role || 'super_admin',
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || null,
        actor: 'authenticated-admin',
      };

      const result = settingsService.updateSettings(rawPayload, adminContext);

      res.status(200).json(
        apiSuccess(
          {
            updatedKeys: result.updatedKeys,
            settings: result.settings,
          },
          {
            message: `${result.updatedKeys.length} setting(s) updated successfully`,
          }
        )
      );
    } catch (err) {
      next(err);
    }
  }
}

export const adminSiteSettingsController = new AdminSiteSettingsController();
