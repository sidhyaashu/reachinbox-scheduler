import { Request, Response, NextFunction } from 'express';
import { AppError } from '@reachinbox/shared';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id || 'unknown';

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId,
        details: err.details,
      },
    });
    return;
  }

  // Handle unexpected errors (avoid leaking internal details in production)
  console.error(`[UnhandledError] [${requestId}] ${err.name}: ${err.message}`, err.stack);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred. Please try again later.',
      requestId,
    },
  });
}
