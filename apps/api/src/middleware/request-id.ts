import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerId = req.headers['x-request-id'];
  const requestId = (typeof headerId === 'string' && headerId.trim().length > 0)
    ? headerId
    : crypto.randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
