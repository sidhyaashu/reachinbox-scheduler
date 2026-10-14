import { Request, Response, NextFunction } from 'express';
import { EmailService } from '../services/email.service.js';
import { ScheduleEmailOutput, BatchScheduleEmailOutput, EmailQueryParams } from '@reachinbox/shared';

export class EmailController {
  constructor(private readonly emailService: EmailService = new EmailService()) {}

  schedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      // Allow Idempotency-Key from header or body
      const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
      const input: ScheduleEmailOutput = {
        ...req.body,
        idempotencyKey: idempotencyKey || undefined,
      };

      const result = await this.emailService.scheduleEmail(userId, input);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  batchSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const input: BatchScheduleEmailOutput = req.body;
      const result = await this.emailService.batchScheduleEmails(userId, input);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  getScheduled = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const queryParams = req.query as unknown as EmailQueryParams;
      const result = await this.emailService.getScheduledEmails(userId, queryParams);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getSent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const queryParams = req.query as unknown as EmailQueryParams;
      const result = await this.emailService.getSentEmails(userId, queryParams);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const rawId = req.params.id;
      const emailId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!emailId || typeof emailId !== 'string') {
        res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Email ID required' } });
        return;
      }
      await this.emailService.cancelEmail(userId, emailId);
      res.status(200).json({
        success: true,
        data: { message: `Email ${emailId} successfully cancelled` },
      });
    } catch (err) {
      next(err);
    }
  };
}
