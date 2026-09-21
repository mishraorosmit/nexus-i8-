import { Router } from 'express';
import { siteConfigController } from './siteConfig.controller.ts';
import { requireAdminSession, requireSuperAdmin } from '../../middleware/auth.ts';
import { memoryCache } from '../../utils/cache.ts';

const router = Router();

router.get('/', (req, res, next) => siteConfigController.get(req, res, next));
router.put('/', requireAdminSession, requireSuperAdmin, (req, res, next) => {
  memoryCache.invalidate('site-config');
  siteConfigController.update(req, res, next);
});

export default router;
