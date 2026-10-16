import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';

export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  googleRedirect = (req: Request, res: Response): void => {
    const returnTo = req.query.returnTo as string | undefined;
    const authUrl = this.authService.getGoogleAuthUrl(returnTo);
    res.redirect(authUrl);
  };

  googleCallback = async (req: Request, res: Response): Promise<void> => {
    const frontendUrl = process.env.WEB_URL || '';
    try {
      // 1. Detect if Google redirected with an error (e.g. user denied or closed consent)
      const errorParam = req.query.error as string | undefined;
      const errorDesc = req.query.error_description as string | undefined;
      if (errorParam) {
        const redirectUrl = `${frontendUrl}/?error=${encodeURIComponent(errorParam)}&error_description=${encodeURIComponent(
          errorDesc || 'Google sign-in was cancelled or denied.'
        )}`;
        res.redirect(redirectUrl);
        return;
      }

      const code = req.query.code as string;
      if (!code) {
        const redirectUrl = `${frontendUrl}/?error=missing_code&error_description=${encodeURIComponent(
          'No authorization code received from Google.'
        )}`;
        res.redirect(redirectUrl);
        return;
      }

      const { token } = await this.authService.handleGoogleCallback(code);

      // Set secure HTTP-only session cookie with root path
      res.cookie('reachinbox_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to frontend dashboard (web app)
      const state = req.query.state as string | undefined;
      const targetPath = state && state.startsWith('/') ? state : '/dashboard';
      res.redirect(frontendUrl ? `${frontendUrl}${targetPath}` : targetPath);
    } catch (err: any) {
      console.error('[AuthController] Google OAuth callback failed:', err.message);
      const errMsg = err.message || 'Google authentication could not be completed.';
      res.redirect(`${frontendUrl}/?error=oauth_failed&error_description=${encodeURIComponent(errMsg)}`);
    }
  };

  disconnectGoogle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      await this.authService.disconnectGoogle(userId);
      res.status(200).json({
        success: true,
        data: { message: 'Google account disconnected successfully' },
      });
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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
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
      const email = (req.body?.email as string)?.trim();
      if (!email) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Valid email address is required.' },
        });
        return;
      }
      const name = (req.body?.name as string)?.trim() || email.split('@')[0] || 'User';
      const { token, user } = await this.authService.createDemoSession(email, name);

      res.cookie('reachinbox_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        data: { user, message: 'Session created successfully' },
      });
    } catch (err) {
      next(err);
    }
  };

  demoLoginRedirect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = (req.query?.email as string)?.trim();
      const frontendUrl = process.env.WEB_URL || '';
      if (!email) {
        res.redirect(
          frontendUrl
            ? `${frontendUrl}/?error=invalid_request&error_description=${encodeURIComponent('Valid email address is required.')}`
            : '/?error=invalid_request'
        );
        return;
      }
      const name = (req.query?.name as string)?.trim() || email.split('@')[0] || 'User';
      const { token } = await this.authService.createDemoSession(email, name);

      res.cookie('reachinbox_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.redirect(frontendUrl ? `${frontendUrl}/dashboard` : '/dashboard');
    } catch (err) {
      next(err);
    }
  };

  saveSmtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const {
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpSecure,
        name,
        email,
        hourlyLimit,
        minDelaySeconds,
      } = req.body;

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'smtpHost, smtpPort, smtpUser, and smtpPass are required',
          },
        });
        return;
      }

      const sender = await this.authService.saveCustomSmtp(userId, {
        smtpHost,
        smtpPort: Number(smtpPort),
        smtpUser,
        smtpPass,
        smtpSecure: Boolean(smtpSecure),
        name,
        email: email || smtpUser,
        hourlyLimit: hourlyLimit ? Number(hourlyLimit) : undefined,
        minDelaySeconds: minDelaySeconds ? Number(minDelaySeconds) : undefined,
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Custom SMTP credentials saved successfully',
          sender: {
            id: sender.id,
            email: sender.email,
            name: sender.name,
            smtpHost: sender.smtpHost,
            smtpPort: sender.smtpPort,
            smtpUser: sender.smtpUser,
            hourlyLimit: sender.hourlyLimit,
            minDelaySeconds: sender.minDelaySeconds,
            authType: sender.authType,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  };

  disconnectSmtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      await this.authService.disconnectCustomSmtp(userId);
      res.status(200).json({
        success: true,
        data: { message: 'Custom SMTP disconnected. Reverted to Ethereal sandbox.' },
      });
    } catch (err) {
      next(err);
    }
  };
}
