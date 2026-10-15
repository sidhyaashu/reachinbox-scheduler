import { Request, Response, NextFunction } from 'express';
import { DashboardBffService } from './dashboard.service.js';

export class DashboardController {
  constructor(private readonly bffService: DashboardBffService = new DashboardBffService()) {}

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId =
        (req.headers['x-user-id'] as string) ||
        (req.query.userId as string) ||
        '00000000-0000-0000-0000-000000000001';

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
