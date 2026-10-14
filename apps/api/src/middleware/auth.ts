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

export const DEFAULT_DEV_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@reachinbox.ai',
  name: 'ReachInbox Demo User',
};

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Check session cookie
    const sessionToken = req.cookies?.reachinbox_session;
    if (sessionToken) {
      const session = await sessionRepo.findByTokenHash(sessionToken);
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
      const user = await userRepo.findById(forwardedUserId);
      if (user) {
        req.user = { id: user.id, email: user.email, name: user.name };
        return next();
      }
      // If header given but user doesn't exist yet, attach minimum context in dev
      if (process.env.NODE_ENV !== 'production') {
        req.user = {
          id: forwardedUserId,
          email: (req.headers['x-user-email'] as string) || 'developer@reachinbox.ai',
          name: (req.headers['x-user-name'] as string) || 'Developer',
        };
        return next();
      }
    }

    // 3. In non-production, fall back to default demo user for seamless local development
    if (process.env.NODE_ENV !== 'production') {
      req.user = DEFAULT_DEV_USER;
      return next();
    }

    throw new UnauthorizedError('Authentication required. Please sign in with Google.');
  } catch (err) {
    next(err);
  }
}
