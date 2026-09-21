/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { bulkMembersService, ImportMode } from '../../services/bulkMembers.service.ts';
import { apiSuccess } from '../../utils/apiResponse.ts';
import { AppError } from '../../middleware/errorHandler.ts';

export class AdminBulkMembersController {
  /**
   * Preview a bulk member import (CSV or JSON).
   * Validates syntax, normalizes fields, checks duplicates & conflicts without modifying SQLite.
   */
  public async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, format, mode } = req.body;

      if (!content || typeof content !== 'string') {
        throw new AppError(400, 'Import content is required as a string payload.', undefined, 'MISSING_CONTENT');
      }

      const normalizedFormat = (format || 'csv').toLowerCase();
      if (normalizedFormat !== 'csv' && normalizedFormat !== 'json') {
        throw new AppError(400, "Format must be either 'csv' or 'json'.", undefined, 'INVALID_FORMAT');
      }

      const normalizedMode: ImportMode = mode ? (mode.toUpperCase() as ImportMode) : 'UPSERT';
      if (!['UPSERT', 'CREATE_ONLY', 'UPDATE_ONLY'].includes(normalizedMode)) {
        throw new AppError(
          400,
          "Invalid import mode. Supported modes: 'UPSERT', 'CREATE_ONLY', 'UPDATE_ONLY'.",
          undefined,
          'INVALID_MODE'
        );
      }

      const preview = bulkMembersService.previewImport({
        content,
        format: normalizedFormat as 'csv' | 'json',
        mode: normalizedMode,
      });

      res.status(200).json(apiSuccess(preview));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Commit a bulk member import inside an ACID database transaction.
   * Full re-parsing and re-validation guarantees zero client-side validation bypass.
   */
  public async commit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { content, format, mode } = req.body;

      if (!content || typeof content !== 'string') {
        throw new AppError(400, 'Import content is required as a string payload.', undefined, 'MISSING_CONTENT');
      }

      const normalizedFormat = (format || 'csv').toLowerCase();
      if (normalizedFormat !== 'csv' && normalizedFormat !== 'json') {
        throw new AppError(400, "Format must be either 'csv' or 'json'.", undefined, 'INVALID_FORMAT');
      }

      const normalizedMode: ImportMode = mode ? (mode.toUpperCase() as ImportMode) : 'UPSERT';
      if (!['UPSERT', 'CREATE_ONLY', 'UPDATE_ONLY'].includes(normalizedMode)) {
        throw new AppError(
          400,
          "Invalid import mode. Supported modes: 'UPSERT', 'CREATE_ONLY', 'UPDATE_ONLY'.",
          undefined,
          'INVALID_MODE'
        );
      }

      const result = bulkMembersService.commitImport(
        {
          content,
          format: normalizedFormat as 'csv' | 'json',
          mode: normalizedMode,
        },
        {
          adminId: req.admin?.adminId,
          adminName: req.admin?.name,
          adminRole: req.admin?.role,
          ipAddress: req.ip,
        }
      );

      res.status(200).json(
        apiSuccess(result, {
          message: `Successfully processed ${result.totalProcessed} members: ${result.createdCount} created, ${result.updatedCount} updated.`,
        })
      );
    } catch (err) {
      next(err);
    }
  }

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
