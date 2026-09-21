import { Request, Response, NextFunction } from 'express';
import { apiSuccess } from '../../utils/apiResponse.ts';

export class AuthController {
  public async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(
        apiSuccess(
          {
            deprecated: true,
            message: 'The /api/auth endpoints are legacy placeholders. Please use /api/admin/auth/me for authenticated administrative session verification.',
            canonicalEndpoint: '/api/admin/auth/me',
          }
        )
      );
    } catch (err) {
      next(err);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(410).json({
        data: null,
        meta: null,
        error: {
          code: 'ENDPOINT_DEPRECATED',
          message: 'The /api/auth/login endpoint has been deprecated. Please authenticate via the authoritative One-Password endpoint at /api/admin/auth/login.',
          canonicalEndpoint: '/api/admin/auth/login',
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
