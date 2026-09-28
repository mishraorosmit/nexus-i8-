/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { bulkMembersService } from '../../services/bulkMembers.service.ts';

export class AdminBulkMembersController {

  /**
   * Export members in CSV or JSON format with optional multi-field filters.
   * Defends against CSV formula injection.
   */
  public async export(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = (req.query.format as string) || 'csv';
      const status = req.query.status as string | undefined;
      const role = req.query.role as string | undefined;
      const domain = req.query.domain as string | undefined;
      const department = req.query.department as string | undefined;
      const search = (req.query.q || req.query.search) as string | undefined;
      const sort = req.query.sort as string | undefined;

      const exportResult = bulkMembersService.exportMembers({
        format: format as 'csv' | 'json',
        status,
        role,
        domain,
        department,
        search,
        sort,
      });

      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.status(200).send(exportResult.content);
    } catch (err) {
      next(err);
    }
  }
}

export const adminBulkMembersController = new AdminBulkMembersController();
