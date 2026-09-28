import { Request, Response, NextFunction } from 'express';
import { eventsService } from './events.service.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { apiSuccess, parsePaginationParams, createPaginationMeta } from '../../utils/apiResponse.ts';

export class EventsController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = parsePaginationParams(req.query as Record<string, unknown>, 10);
      // Public boundary clamping: public endpoints strictly prohibit querying draft, archived, or cancelled events
      const rawStatus = (req.query.status as string | undefined)?.trim();
      let status: string | undefined = undefined;
      if (rawStatus) {
        const lower = rawStatus.toLowerCase();
        if (lower !== 'draft' && lower !== 'archived' && lower !== 'cancelled') {
          status = rawStatus;
        }
      }
      const type = req.query.type as string | undefined;
      const year = req.query.year as string | undefined;
      const featured = req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined;

      const { items, total } = await eventsService.getPaginatedEvents({
        page,
        limit,
        offset,
        status,
        type,
        year,
        featured,
      });

      const meta = createPaginationMeta(page, limit, total);
      res.json(apiSuccess(items, meta));
    } catch (err) {
      next(err);
    }
  }

  public async upcoming(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await eventsService.getUpcomingEvents();
      res.json(apiSuccess(items, { count: items.length }));
    } catch (err) {
      next(err);
    }
  }

  public async past(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await eventsService.getPastEvents();
      res.json(apiSuccess(items, { count: items.length }));
    } catch (err) {
      next(err);
    }
  }

  public async featured(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await eventsService.getFeaturedEvents();
      res.json(apiSuccess(items, { count: items.length }));
    } catch (err) {
      next(err);
    }
  }

  public async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const event = await eventsService.getEventBySlug(slug);
      if (!event) {
        throw new AppError(404, `Event not found with slug: ${slug}`, undefined, 'EVENT_NOT_FOUND');
      }
      res.json(apiSuccess(event));
    } catch (err) {
      next(err);
    }
  }
}

export const eventsController = new EventsController();
