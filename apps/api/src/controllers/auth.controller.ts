import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';

export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  googleRedirect = (req: Request, res: Response): void => {
    const returnTo = req.query.returnTo as string | undefined;
    const authUrl = this.authService.getGoogleAuthUrl(returnTo);
    res.redirect(authUrl);
  };

  googleCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).json({ success: false, error: { code: 'MISSING_CODE', message: 'OAuth code missing' } });
        return;
      }

      const { token } = await this.authService.handleGoogleCallback(code);

      // Set secure HTTP-only session cookie
      res.cookie('reachinbox_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to frontend dashboard (web app)
      const frontendUrl = process.env.WEB_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard`);
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const data = await this.authService.getCurrentUser(userId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.reachinbox_session;
      if (token) {
        await this.authService.logout(token);
      }

      res.clearCookie('reachinbox_session', {
        httpOnly: true,
        sameSite: 'lax',
      });

      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (err) {
      next(err);
    }
  };

  demoLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = (req.body?.email as string) || 'alex.founder@reachinbox.ai';
      const name = (req.body?.name as string) || 'Alex Founder';
      const { token, user } = await this.authService.createDemoSession(email, name);

      res.cookie('reachinbox_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        data: { user, message: 'Demo session created successfully' },
      });
    } catch (err) {
      next(err);
    }
  };

  demoLoginRedirect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = (req.query?.email as string) || 'alex.founder@reachinbox.ai';
      const name = (req.query?.name as string) || 'Alex Founder';
      const { token } = await this.authService.createDemoSession(email, name);

      res.cookie('reachinbox_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const frontendUrl = process.env.WEB_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard`);
    } catch (err) {
      next(err);
    }
  };
}
