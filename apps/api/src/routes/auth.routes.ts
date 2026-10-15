import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export function createAuthRouter(controller: AuthController = new AuthController()): Router {
  const router = Router();

  // Public Google OAuth initiation & callback
  router.get('/google', controller.googleRedirect);
  router.get('/google/callback', controller.googleCallback);

  // Authenticated user endpoints
  router.get('/me', authMiddleware, controller.me);
  router.post('/logout', controller.logout);

  return router;
}
