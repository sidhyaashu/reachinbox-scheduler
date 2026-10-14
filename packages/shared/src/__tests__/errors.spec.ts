import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  RateLimitExceededError,
  ConflictError,
} from '../errors/app-error.js';

describe('Shared Application Errors', () => {
  it('correctly constructs ValidationError with 400 status', () => {
    const error = new ValidationError('Invalid email format', [{ field: 'recipient' }]);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid email format');
    expect(error.details).toEqual([{ field: 'recipient' }]);
    expect(error.isOperational).toBe(true);
  });

  it('correctly constructs NotFoundError with 404 status and resource info', () => {
    const error = new NotFoundError('Email', 'email-123');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain("Email with id 'email-123' not found");
  });

  it('correctly constructs RateLimitExceededError with retry duration', () => {
    const error = new RateLimitExceededError('Sender limit reached', 3600);
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.retryAfterSeconds).toBe(3600);
  });

  it('correctly constructs UnauthorizedError and ConflictError', () => {
    const unauth = new UnauthorizedError();
    expect(unauth.statusCode).toBe(401);
    expect(unauth.code).toBe('UNAUTHORIZED');

    const conflict = new ConflictError('Idempotency key collision');
    expect(conflict.statusCode).toBe(409);
    expect(conflict.code).toBe('CONFLICT');
  });
});
