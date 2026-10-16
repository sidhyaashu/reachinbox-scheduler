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
    it('GET /auth/google redirects to Google accounts OAuth URL with gmail.send scope', async () => {
      const res = await request(app).get('/auth/google');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(res.headers.location).toContain('client_id=');
      expect(res.headers.location).toContain('response_type=code');
      expect(decodeURIComponent(res.headers.location)).toContain('https://www.googleapis.com/auth/gmail.send');
    });

    it('GET /auth/me returns current authenticated user context', async () => {
      vi.spyOn(AuthService.prototype, 'getCurrentUser').mockResolvedValueOnce({
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'user@reachinbox.ai',
          name: 'ReachInbox User',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        defaultSenderId: 'sender-123',
      });

      const res = await request(app)
        .get('/auth/me')
        .set('x-user-id', '00000000-0000-0000-0000-000000000001');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('user@reachinbox.ai');
    });

    it('GET /auth/me returns 401 when unauthenticated without cookie or header', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /auth/google/callback redirects to login page when error parameter received', async () => {
      const res = await request(app)
        .get('/auth/google/callback')
        .query({ error: 'access_denied', error_description: 'User denied consent' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=access_denied');
      expect(res.headers.location).toContain('error_description=');
    });

    it('GET /auth/google/callback redirects to login page when code is missing', async () => {
      const res = await request(app).get('/auth/google/callback');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=missing_code');
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
    it('returns 401 when accessing Slack integration unauthenticated', async () => {
      const res = await request(app).get('/integrations/slack/status');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /integrations/slack/authorize redirects to Slack OAuth authorize URL', async () => {
      const res = await request(app)
        .get('/integrations/slack/authorize')
        .set('x-user-id', 'test-user-id');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://slack.com/oauth/v2/authorize');
      expect(res.headers.location).toContain('client_id=');
      expect(res.headers.location).toContain('scope=chat%3Awrite%2Cincoming-webhook');
    });

    it('GET /integrations/slack/status returns connected: false when no integration exists', async () => {
      vi.spyOn(SlackOAuthService.prototype, 'getSlackStatus').mockResolvedValueOnce({
        connected: false,
      });

      const res = await request(app)
        .get('/integrations/slack/status')
        .set('x-user-id', 'test-user-id');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connected).toBe(false);
    });
  });
});
