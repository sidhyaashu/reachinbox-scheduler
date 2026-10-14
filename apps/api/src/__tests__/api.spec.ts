import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { EmailService } from '../services/email.service.js';
import { ConflictError, NotFoundError } from '@reachinbox/shared';

describe('Email API Endpoints', () => {
  let app: any;
  let mockEmailService: any;

  beforeEach(() => {
    mockEmailService = {
      scheduleEmail: vi.fn(),
      batchScheduleEmails: vi.fn(),
      getScheduledEmails: vi.fn(),
      getSentEmails: vi.fn(),
      cancelEmail: vi.fn(),
    };
    app = createApp();
  });

  describe('GET /health/live', () => {
    it('returns 200 with UP status', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('POST /api/v1/emails/schedule', () => {
    it('rejects invalid recipient with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/emails/schedule')
        .send({
          senderId: '123e4567-e89b-12d3-a456-426614174000',
          recipient: 'not-valid-email',
          subject: 'Cold outreach test',
          body: 'Hello lead',
          scheduledAt: new Date(Date.now() + 60000).toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
    });

    it('rejects missing subject or body with 400', async () => {
      const res = await request(app)
        .post('/api/v1/emails/schedule')
        .send({
          senderId: '123e4567-e89b-12d3-a456-426614174000',
          recipient: 'lead@reachinbox.ai',
          scheduledAt: new Date(Date.now() + 60000).toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Error Handling & 404', () => {
    it('returns 404 for non-existent route', async () => {
      const res = await request(app).get('/api/v1/unknown-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
