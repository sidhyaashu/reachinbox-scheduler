import { Router } from 'express';
import { EmailController } from '../controllers/email.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  ScheduleEmailSchema,
  BatchScheduleEmailSchema,
  EmailQuerySchema,
  CancelEmailParamSchema,
} from '@reachinbox/shared';

export function createEmailRouter(controller: EmailController = new EmailController()): Router {
  const router = Router();

  // All email routes require authentication
  router.use(authMiddleware);

  router.post(
    '/schedule',
    validate({ body: ScheduleEmailSchema }),
    controller.schedule
  );

  router.post(
    '/batch-schedule',
    validate({ body: BatchScheduleEmailSchema }),
    controller.batchSchedule
  );

  router.get(
    '/scheduled',
    validate({ query: EmailQuerySchema }),
    controller.getScheduled
  );

  router.get(
    '/sent',
    validate({ query: EmailQuerySchema }),
    controller.getSent
  );

  router.post(
    '/:id/cancel',
    validate({ params: CancelEmailParamSchema }),
    controller.cancel
  );

  return router;
}
