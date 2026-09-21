import { Request, Response, NextFunction } from 'express';
import { auditService } from '../../services/audit.service.ts';
import { apiSuccess, createPaginationMeta } from '../../utils/apiResponse.ts';

export class AdminAuditLogsController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const action = req.query.action as string | undefined;
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const adminId = req.query.adminId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const search = req.query.search as string | undefined;

      const { items, total } = auditService.getPaginated({
        page,
        limit,
        action,
        entityType,
        entityId,
        adminId,
        startDate,
        endDate,
        search,
      });

      const safeParseJson = (val: string | null | undefined) => {
        if (!val) return null;
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      };

      const enriched = items.map((log) => ({
        ...log,
        details: safeParseJson(log.details),
        before_json: safeParseJson(log.before_json),
        after_json: safeParseJson(log.after_json),
        admin_context: safeParseJson(log.admin_context),
      }));

      const meta = createPaginationMeta(page, limit, total);
      res.status(200).json(apiSuccess(enriched, {
        ...meta,
        total,
        hasNext: meta.hasNextPage,
        hasPrev: meta.hasPrevPage,
      }));
    } catch (err) {
      next(err);
    }
  }
}

export const adminAuditLogsController = new AdminAuditLogsController();
