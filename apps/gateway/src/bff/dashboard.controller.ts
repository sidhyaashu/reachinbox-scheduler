import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { SessionRepository } from '@reachinbox/database';
import { DashboardBffService } from './dashboard.service.js';

export class DashboardController {
  constructor(
    private readonly bffService: DashboardBffService = new DashboardBffService(),
    private readonly sessionRepo: SessionRepository = new SessionRepository()
  ) {}

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let userId =
        (req.headers['x-user-id'] as string) ||
        (req.query.userId as string);

      if (!userId && req.cookies?.reachinbox_session) {
        const rawToken = req.cookies.reachinbox_session;
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const session =
          (await this.sessionRepo.findByTokenHash(tokenHash)) ||
          (await this.sessionRepo.findByTokenHash(rawToken));
        if (session) {
          userId = session.userId;
        }
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please sign in.',
          },
        });
        return;
      }

      const summary = await this.bffService.getDashboardSummary(userId);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  };
}
