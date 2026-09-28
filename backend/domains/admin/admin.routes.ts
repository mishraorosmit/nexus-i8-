import express, { Router } from 'express';
import { requireAdminSession, requireSuperAdmin } from '../../middleware/auth.ts';
import { adminAuthController } from './adminAuth.controller.ts';
import { adminUsersController } from './adminUsers.controller.ts';
import { adminProjectsController } from './adminProjects.controller.ts';
import { adminMembersController } from './adminMembers.controller.ts';
import { adminBulkMembersController } from './adminBulkMembers.controller.ts';
import { adminArchiveController } from './adminArchive.controller.ts';
import { adminResourcesController } from './adminResources.controller.ts';
import { adminMediaController } from './adminMedia.controller.ts';
import { adminSiteSettingsController } from './adminSiteSettings.controller.ts';
import { adminAuditLogsController } from './adminAuditLogs.controller.ts';
import { authRateLimiter } from '../../middleware/rateLimiter.ts';

const router = Router();

// ==========================================
// 1. AUTHENTICATION (Public login with brute-force rate limit)
// ==========================================
router.post('/auth/login', authRateLimiter, (req, res, next) => adminAuthController.login(req, res, next));

import { memoryCache } from '../../utils/cache.ts';

// ==========================================
// ALL SUBSEQUENT ROUTES REQUIRE AUTHENTICATION
// ==========================================
router.use(requireAdminSession);

// Automatically flush public domain cache on successful admin mutations
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const path = req.path;
        
        // Members & E-ID
        if (path.includes('members')) {
          memoryCache.invalidate('members');
          memoryCache.invalidate('eid');
        }
        
        // Projects
        if (path.includes('projects')) {
          memoryCache.invalidate('projects');
        }
        
        // Archive, Resources
        if (path.includes('archive')) memoryCache.invalidate('archive');
        if (path.includes('resources')) memoryCache.invalidate('resources');
        
        // Settings & Site Config
        if (path.includes('settings') || path.includes('site-config')) {
          memoryCache.invalidate('site-config');
        }
        
        // Media replacement cascades across all image consumers
        if (path.includes('media')) {
          if (path.includes('replace') || req.method === 'DELETE') {
            memoryCache.invalidate('members');
            memoryCache.invalidate('eid');
            memoryCache.invalidate('projects');
          }
        }
      }
    });
  }
  next();
});

import { adminDashboardController } from './adminDashboard.controller.ts';

router.post('/auth/logout', (req, res, next) => adminAuthController.logout(req, res, next));
router.get('/auth/me', (req, res, next) => adminAuthController.me(req, res, next));
router.get('/dashboard', (req, res, next) => adminDashboardController.getDashboard(req, res, next));

// ==========================================
// 2. ADMIN USERS (Super Admin Only)
// ==========================================
router.get('/users', requireSuperAdmin, (req, res, next) => adminUsersController.list(req, res, next));
router.post('/users', requireSuperAdmin, (req, res, next) => adminUsersController.create(req, res, next));
router.get('/users/:id', requireSuperAdmin, (req, res, next) => adminUsersController.getById(req, res, next));
router.patch('/users/:id', requireSuperAdmin, (req, res, next) => adminUsersController.update(req, res, next));
router.delete('/users/:id', requireSuperAdmin, (req, res, next) => adminUsersController.delete(req, res, next));

// ==========================================
// 3. SITE SETTINGS (Super Admin Only)
// ==========================================
router.get('/settings', requireSuperAdmin, (req, res, next) => adminSiteSettingsController.getSettings(req, res, next));
router.patch('/settings', requireSuperAdmin, (req, res, next) => adminSiteSettingsController.updateSettings(req, res, next));
router.put('/settings', requireSuperAdmin, (req, res, next) => adminSiteSettingsController.updateSettings(req, res, next));

router.get('/site-settings', requireSuperAdmin, (req, res, next) => adminSiteSettingsController.getSettings(req, res, next));
router.patch('/site-settings', requireSuperAdmin, (req, res, next) => adminSiteSettingsController.updateSettings(req, res, next));
router.put('/site-settings', requireSuperAdmin, (req, res, next) => adminSiteSettingsController.updateSettings(req, res, next));

// ==========================================
// 4. AUDIT LOGS (Super Admin Only)
// ==========================================
router.get('/audit-logs', requireSuperAdmin, (req, res, next) => adminAuditLogsController.list(req, res, next));

// ==========================================
// 5. PROJECTS MANAGEMENT
// ==========================================
router.get('/projects', (req, res, next) => adminProjectsController.list(req, res, next));
router.post('/projects', (req, res, next) => adminProjectsController.create(req, res, next));
router.get('/projects/:id', (req, res, next) => adminProjectsController.getById(req, res, next));
router.patch('/projects/:id', (req, res, next) => adminProjectsController.update(req, res, next));
router.put('/projects/:id', (req, res, next) => adminProjectsController.update(req, res, next));
router.patch('/projects/:id/status', (req, res, next) => adminProjectsController.updateStatus(req, res, next));
router.patch('/projects/:id/featured', (req, res, next) => adminProjectsController.toggleFeatured(req, res, next));
router.post(
  '/projects/:id/image',
  express.raw({ type: ['image/*', 'application/octet-stream', 'multipart/form-data'], limit: '10mb' }),
  (req, res, next) => adminProjectsController.uploadImage(req, res, next)
);
router.post('/projects/:id/members', (req, res, next) => adminProjectsController.addMember(req, res, next));
router.put('/projects/:id/members', (req, res, next) => adminProjectsController.syncMembers(req, res, next));
router.delete('/projects/:id/members/:memberId', (req, res, next) => adminProjectsController.removeMember(req, res, next));
router.delete('/projects/:id', requireSuperAdmin, (req, res, next) => adminProjectsController.delete(req, res, next));

// ==========================================
// 6. MEMBERS MANAGEMENT
// ==========================================
router.get('/members', (req, res, next) => adminMembersController.list(req, res, next));
router.get('/members/facets', (req, res, next) => adminMembersController.getFacets(req, res, next));
router.get('/members/export', (req, res, next) => adminBulkMembersController.export(req, res, next));
router.post('/members', (req, res, next) => adminMembersController.create(req, res, next));
router.get('/members/:id', (req, res, next) => adminMembersController.getById(req, res, next));
router.patch('/members/:id', (req, res, next) => adminMembersController.update(req, res, next));
router.put('/members/:id', (req, res, next) => adminMembersController.update(req, res, next));
router.patch('/members/:id/status', (req, res, next) => adminMembersController.updateStatus(req, res, next));
router.post(
  '/members/:id/image',
  express.raw({ limit: '10mb', type: ['image/*', 'application/octet-stream', 'multipart/form-data'] }),
  (req, res, next) => adminMembersController.uploadImage(req, res, next)
);
router.delete('/members/:id/image', (req, res, next) => adminMembersController.deleteImage(req, res, next));
router.delete('/members/:id', requireSuperAdmin, (req, res, next) => adminMembersController.delete(req, res, next));

// ==========================================
// 7. ARCHIVE MANAGEMENT
// ==========================================
router.get('/archive', (req, res, next) => adminArchiveController.list(req, res, next));
router.post('/archive', (req, res, next) => adminArchiveController.create(req, res, next));
router.get('/archive/:id', (req, res, next) => adminArchiveController.getById(req, res, next));
router.put('/archive/:id', (req, res, next) => adminArchiveController.update(req, res, next));
router.patch('/archive/:id/status', (req, res, next) => adminArchiveController.updateStatus(req, res, next));
router.delete('/archive/:id', requireSuperAdmin, (req, res, next) => adminArchiveController.delete(req, res, next));

// ==========================================
// 10. RESOURCES MANAGEMENT
// ==========================================
router.get('/resources', (req, res, next) => adminResourcesController.list(req, res, next));
router.post('/resources', (req, res, next) => adminResourcesController.create(req, res, next));
router.get('/resources/:id', (req, res, next) => adminResourcesController.getById(req, res, next));
router.put('/resources/:id', (req, res, next) => adminResourcesController.update(req, res, next));
router.patch('/resources/:id/status', (req, res, next) => adminResourcesController.updateStatus(req, res, next));
router.delete('/resources/:id', requireSuperAdmin, (req, res, next) => adminResourcesController.delete(req, res, next));

// ==========================================
// 11. MEDIA MANAGEMENT
// ==========================================
router.get('/media', (req, res, next) => adminMediaController.list(req, res, next));
router.post('/media/upload', (req, res, next) => adminMediaController.upload(req, res, next));
router.get('/media/orphans', (req, res, next) => adminMediaController.getOrphans(req, res, next));
router.post('/media/orphans/cleanup', requireSuperAdmin, (req, res, next) => adminMediaController.cleanupOrphans(req, res, next));
router.get('/media/:id', (req, res, next) => adminMediaController.getById(req, res, next));
router.get('/media/:id/usage', (req, res, next) => adminMediaController.getUsage(req, res, next));
router.put('/media/:id', (req, res, next) => adminMediaController.update(req, res, next));
router.patch('/media/:id', (req, res, next) => adminMediaController.update(req, res, next));
router.put('/media/:id/replace', (req, res, next) => adminMediaController.replace(req, res, next));
router.post('/media/:id/replace', (req, res, next) => adminMediaController.replace(req, res, next));
router.delete('/media/:id', requireSuperAdmin, (req, res, next) => adminMediaController.delete(req, res, next));

export default router;
