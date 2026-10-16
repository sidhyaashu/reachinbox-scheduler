import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { SessionRepository, UserRepository } from '@reachinbox/database';
import { UnauthorizedError } from '@reachinbox/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

const sessionRepo = new SessionRepository();
const userRepo = new UserRepository();

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Check session cookie
    const sessionToken = req.cookies?.reachinbox_session;
    if (sessionToken) {
      const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
      const session =
        (await sessionRepo.findByTokenHash(tokenHash)) ||
        (await sessionRepo.findByTokenHash(sessionToken));
      if (session) {
        const user = await userRepo.findById(session.userId);
        if (user) {
          req.user = { id: user.id, email: user.email, name: user.name };
          return next();
        }
      }
    }

    // 2. Check X-User-Id header (for internal service / gateway / testing forwarding)
    const forwardedUserId = req.headers['x-user-id'];
    if (typeof forwardedUserId === 'string' && forwardedUserId.length > 0) {
      if (process.env.NODE_ENV === 'test') {
        req.user = {
          id: forwardedUserId,
          email: (req.headers['x-user-email'] as string) || 'test@reachinbox.ai',
          name: (req.headers['x-user-name'] as string) || 'Test User',
        };
        return next();
      }
      const user = await userRepo.findById(forwardedUserId);
      if (user) {
        req.user = { id: user.id, email: user.email, name: user.name };
        return next();
      }
    }

    // 3. Strict authentication required - no silent demo fallback
    throw new UnauthorizedError('Authentication required. Please sign in with Google.');
  } catch (err) {
    next(err);
  }
}
