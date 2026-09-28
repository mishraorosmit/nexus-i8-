import { Request, Response, NextFunction } from 'express';
import { projectsService } from './projects.service.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { apiSuccess, parsePaginationParams, createPaginationMeta } from '../../utils/apiResponse.ts';

export class ProjectsController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = parsePaginationParams(req.query as Record<string, unknown>, 12);
      const category = req.query.category as string | undefined;
      // Public boundary clamping: public endpoints strictly prohibit querying draft or archived projects
      const rawStatus = (req.query.status as string | undefined)?.trim();
      let status: string | undefined = undefined;
      if (rawStatus) {
        const lower = rawStatus.toLowerCase();
        if (lower !== 'draft' && lower !== 'archived') {
          status = rawStatus;
        }
      }
      const technology = req.query.technology as string | undefined;
      const search = req.query.q as string | undefined;
      const featured = req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined;

      const { items, total } = await projectsService.getPaginatedProjects({
        page,
        limit,
        offset,
        category,
        status,
        technology,
        featured,
        search,
      });

      const meta = createPaginationMeta(page, limit, total);
      res.json(apiSuccess(items, meta));
    } catch (err) {
      next(err);
    }
  }

  public async featured(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await projectsService.getFeaturedProjects();
      res.json(apiSuccess(items, { count: items.length }));
    } catch (err) {
      next(err);
    }
  }

  public async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const project = await projectsService.getProjectBySlug(slug);
      if (!project) {
        throw new AppError(404, `Project not found with slug: ${slug}`, undefined, 'PROJECT_NOT_FOUND');
      }
      res.json(apiSuccess(project));
    } catch (err) {
      next(err);
    }
  }

  public async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const members = await projectsService.getProjectMembers(slug);
      if (members === null) {
        throw new AppError(404, `Project not found with slug: ${slug}`, undefined, 'PROJECT_NOT_FOUND');
      }
      res.json(apiSuccess(members, { count: members.length }));
    } catch (err) {
      next(err);
    }
  }

  public async getRelatedEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const events = await projectsService.getProjectRelatedEvents(slug);
      if (events === null) {
        throw new AppError(404, `Project not found with slug: ${slug}`, undefined, 'PROJECT_NOT_FOUND');
      }
      res.json(apiSuccess(events, { count: events.length }));
    } catch (err) {
      next(err);
    }
  }
}

export const projectsController = new ProjectsController();
