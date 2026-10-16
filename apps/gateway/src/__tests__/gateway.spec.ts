import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { DashboardBffService } from '../bff/dashboard.service.js';

describe('API Gateway & BFF Service', () => {
  let app: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createApp();
  });

  describe('Gateway Health Checks & Request ID', () => {
    it('GET /health/live returns 200 with service name and generates X-Request-ID', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toBe('gateway');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('BFF Dashboard Aggregation Endpoint', () => {
    it('GET /api/v1/dashboard/summary returns consolidated metrics and data', async () => {
      vi.spyOn(DashboardBffService.prototype, 'getDashboardSummary').mockResolvedValueOnce({
        user: {
          id: 'user-1',
          email: 'founder@outbox.ai',
          name: 'Founder',
          avatarUrl: 'https://avatar.com/1',
        },
        sender: {
          id: 'sender-1',
          email: 'sender@outbox.ai',
          name: 'Default Sender',
          hourlyLimit: 200,
          minDelaySeconds: 2,
        },
        stats: {
          totalScheduled: 5,
          totalSent: 12,
        },
        scheduledEmails: [],
        sentEmails: [],
        slackIntegration: {
          connected: true,
          teamName: 'Outbox Team',
          channelName: '#cold-outreach',
        },
        queueMetrics: {
          waiting: 2,
          active: 1,
          completed: 10,
          failed: 0,
          delayed: 3,
          paused: 0,
        },
      });

      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('x-user-id', 'user-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.user.email).toBe('founder@outbox.ai');
      expect(data.stats.totalScheduled).toBe(5);
      expect(data.stats.totalSent).toBe(12);
      expect(data.slackIntegration.connected).toBe(true);
      expect(data.queueMetrics.delayed).toBe(3);
    });

    it('GET /api/v1/dashboard/summary returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/dashboard/summary');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});

