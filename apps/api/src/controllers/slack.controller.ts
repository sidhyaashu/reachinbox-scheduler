import { Request, Response, NextFunction } from 'express';
import { SlackOAuthService } from '../services/slack-oauth.service.js';

export class SlackController {
  constructor(private readonly slackService: SlackOAuthService = new SlackOAuthService()) {}

  authorize = (req: Request, res: Response): void => {
    const userId = req.user!.id;
    const authUrl = this.slackService.getSlackAuthorizeUrl(userId);
    res.redirect(authUrl);
  };

  callback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = req.query.code as string;
      const userId = (req.query.state as string) || req.user?.id;

      if (!code || !userId) {
        res.status(400).json({ success: false, error: { code: 'INVALID_CALLBACK', message: 'Missing code or user state' } });
        return;
      }

      await this.slackService.handleSlackCallback(code, userId);

      // Redirect back to frontend
      const frontendUrl = process.env.WEB_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard?slack=connected`);
    } catch (err) {
      next(err);
    }
  };

  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const status = await this.slackService.getSlackStatus(userId);
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  };

  disconnect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      await this.slackService.disconnectSlack(userId);
      res.status(200).json({
        success: true,
        data: { message: 'Slack disconnected successfully' },
      });
    } catch (err) {
      next(err);
    }
  };

  testAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      await this.slackService.sendTestMessage(userId);
      res.status(200).json({
        success: true,
        data: { message: 'Slack test alert sent successfully' },
      });
    } catch (err) {
      next(err);
    }
  };
}
