import { Router } from 'express';
import { SlackController } from '../controllers/slack.controller.js';
import { authMiddleware } from '../middleware/auth.js';

export function createSlackRouter(controller: SlackController = new SlackController()): Router {
  const router = Router();

  // Public callback from Slack OAuth redirect
  router.get('/callback', controller.callback);

  // Authenticated routes
  router.get('/authorize', authMiddleware, controller.authorize);
  router.get('/status', authMiddleware, controller.getStatus);
  router.post('/disconnect', authMiddleware, controller.disconnect);
  router.post('/test', authMiddleware, controller.testAlert);
  router.post('/test-alert', authMiddleware, controller.testAlert);
  router.post('/webhook', authMiddleware, controller.connectWebhook);

  return router;
}
