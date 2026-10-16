import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export function createAuthRouter(controller: AuthController = new AuthController()): Router {
  const router = Router();

  // Public Google OAuth initiation & callback
  router.get('/google', controller.googleRedirect);
  router.get('/google/callback', controller.googleCallback);

  // Demo / local evaluation login without Google credentials
  router.post('/demo-login', controller.demoLogin);
  router.get('/demo-login', controller.demoLoginRedirect);

  // Authenticated user endpoints
  router.get('/me', authMiddleware, controller.me);
  router.post('/logout', controller.logout);
  router.post('/google/disconnect', authMiddleware, controller.disconnectGoogle);
  router.post('/smtp/save', authMiddleware, controller.saveSmtp);
  router.post('/smtp/disconnect', authMiddleware, controller.disconnectSmtp);

  return router;
}
