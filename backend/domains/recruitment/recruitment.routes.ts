import { Router } from 'express';
import { recruitmentController } from './recruitment.controller.ts';
import { submissionRateLimiter } from '../../middleware/rateLimiter.ts';
import { spamProtection } from '../../middleware/spamProtection.ts';
import { settingsService } from '../../services/settings.service.ts';

const router = Router();

// Public recruitment submission (subject to maintenance mode)
router.post(
  '/apply',
  (req, res, next) => {
    if (settingsService.getSetting<boolean>('maintenance_mode')) {
      res.status(503).json({
        data: null,
        meta: null,
        error: {
          code: 'MAINTENANCE_MODE',
          message: 'Recruitment submissions are temporarily paused for scheduled maintenance.',
        },
      });
      return;
    }
    next();
  },
  submissionRateLimiter,
  spamProtection,
  (req, res, next) => recruitmentController.apply(req, res, next)
);

export default router;
