import { Request, Response, NextFunction } from 'express';
import { recruitmentService } from './recruitment.service.ts';
import { AppError } from '../../middleware/errorHandler.ts';

export class RecruitmentController {
  public async apply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const application = await recruitmentService.submitApplication({
        ...req.body,
        selected_domain: req.body.selected_domain || req.body.selectedDomain,
        portfolio_url: req.body.portfolio_url || req.body.portfolioUrl,
        github_url: req.body.github_url || req.body.githubUrl,
        linkedin_url: req.body.linkedin_url || req.body.linkedinUrl,
        interests: req.body.interests || req.body.skills,
      });
      res.status(201).json({
        data: {
          id: application.id,
          reference_id: application.reference_id,
          name: application.name,
          email: application.email,
          selected_domain: application.selected_domain,
          status: application.status,
          created_at: application.created_at,
          message: 'Your application has been received by NEXUS. Squad leads will review your portfolio and reach out.',
        },
        meta: null,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const { items, total } = await recruitmentService.getApplications({
        status,
        domain,
        search,
        page,
        limit,
      });

      const totalPages = Math.ceil(total / limit);

      res.json({
        data: items.map((item) => ({
          ...item,
          interests: JSON.parse(item.interests || '[]'),
        })),
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const application = await recruitmentService.getApplicationById(id);
      if (!application) {
        throw new AppError(404, `Recruitment application not found: ${id}`, undefined, 'RECRUITMENT_NOT_FOUND');
      }

      res.json({
        data: {
          ...application,
          interests: JSON.parse(application.interests || '[]'),
        },
        meta: null,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }

  public async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const { status, status_notes } = req.body;
      if (!status) {
        throw new AppError(400, 'Status is required', undefined, 'INVALID_STATUS');
      }

      const updated = await recruitmentService.updateStatus(id, status, status_notes);

      res.json({
        data: {
          ...updated,
          interests: JSON.parse(updated.interests || '[]'),
        },
        meta: null,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const recruitmentController = new RecruitmentController();
