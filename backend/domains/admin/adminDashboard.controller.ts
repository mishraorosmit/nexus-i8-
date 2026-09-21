import { Request, Response, NextFunction } from 'express';
import { adminDashboardService } from '../../services/adminDashboard.service.ts';
import { apiSuccess } from '../../utils/apiResponse.ts';

export class AdminDashboardController {
  public async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = adminDashboardService.getDashboardStats();
      res.status(200).json(apiSuccess(stats));
    } catch (err) {
      next(err);
    }
  }
}

export const adminDashboardController = new AdminDashboardController();
