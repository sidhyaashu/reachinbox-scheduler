import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { AuthService } from '../services/auth.service.js';
import { SlackOAuthService } from '../services/slack-oauth.service.js';

describe('Auth & Slack Integration Endpoints', () => {
  let app: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createApp();
  });

  describe('Google OAuth Endpoints', () => {
    it('GET /auth/google redirects to Google accounts OAuth URL', async () => {
      const res = await request(app).get('/auth/google');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(res.headers.location).toContain('client_id=');
      expect(res.headers.location).toContain('response_type=code');
    });

    it('GET /auth/me returns current authenticated user context', async () => {
      vi.spyOn(AuthService.prototype, 'getCurrentUser').mockResolvedValueOnce({
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'demo@reachinbox.ai',
          name: 'ReachInbox Demo User',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        defaultSenderId: 'sender-123',
      });

      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('demo@reachinbox.ai');
    });

    it('POST /auth/logout clears cookie and returns success', async () => {
      vi.spyOn(AuthService.prototype, 'logout').mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post('/auth/logout')
        .set('Cookie', ['reachinbox_session=sample-test-token']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Logged out successfully');
    });
  });

  describe('Slack OAuth Integration Endpoints', () => {
    it('GET /integrations/slack/authorize redirects to Slack OAuth authorize URL', async () => {
      const res = await request(app).get('/integrations/slack/authorize');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://slack.com/oauth/v2/authorize');
      expect(res.headers.location).toContain('client_id=');
      expect(res.headers.location).toContain('scope=chat%3Awrite%2Cincoming-webhook');
    });

    it('GET /integrations/slack/status returns connected: false when no integration exists', async () => {
      vi.spyOn(SlackOAuthService.prototype, 'getSlackStatus').mockResolvedValueOnce({
        connected: false,
      });

      const res = await request(app).get('/integrations/slack/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connected).toBe(false);
    });
  });
});
