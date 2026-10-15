import { Router } from 'express';
import { SearchController } from '../controllers/search.controller.js';

export function createSearchRouter(controller: SearchController = new SearchController()): Router {
  const router = Router();

  router.get('/', controller.search);
  router.post('/index', controller.indexDocument);
  router.post('/rebuild', controller.rebuildIndex);

  return router;
}
