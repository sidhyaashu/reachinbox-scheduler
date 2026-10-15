import { Router } from 'express';
import { DashboardController } from './dashboard.controller.js';

export function createDashboardRouter(controller: DashboardController = new DashboardController()): Router {
  const router = Router();

  router.get('/summary', controller.getSummary);

  return router;
}
