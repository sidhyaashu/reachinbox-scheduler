import crypto from 'crypto';
import axios from 'axios';
import { UserRepository, SessionRepository, SenderRepository } from '@reachinbox/database';
import { User, UnauthorizedError } from '@reachinbox/shared';
import { config } from '../config.js';

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository = new UserRepository(),
    private readonly sessionRepo: SessionRepository = new SessionRepository(),
    private readonly senderRepo: SenderRepository = new SenderRepository()
  ) {}

  getGoogleAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      redirect_uri: config.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: state || crypto.randomBytes(16).toString('hex'),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(code: string): Promise<{ token: string; user: User }> {
    // 1. Exchange authorization code for tokens via Axios
    let tokenData: { access_token: string };
    try {
      const tokenResponse = await axios.post<{ access_token: string }>(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          code,
          client_id: config.GOOGLE_CLIENT_ID,
          client_secret: config.GOOGLE_CLIENT_SECRET,
          redirect_uri: config.GOOGLE_CALLBACK_URL,
          grant_type: 'authorization_code',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      tokenData = tokenResponse.data;
    } catch (err: any) {
      const errBody = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      throw new UnauthorizedError(`Failed to exchange Google OAuth code: ${errBody}`);
    }

    // 2. Fetch Google profile info via Axios
    let profile: {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    };
    try {
      const profileResponse = await axios.get<{
        sub: string;
        email: string;
        name: string;
        picture?: string;
      }>('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      profile = profileResponse.data;
    } catch {
      throw new UnauthorizedError('Failed to fetch user profile from Google');
    }

    // 3. Upsert user in PostgreSQL
    const user = await this.userRepo.upsertGoogleUser(
      profile.sub,
      profile.email,
      profile.name,
      profile.picture
    );

    // 4 & 5. Parallelize default sender provisioning and session creation
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await Promise.all([
      this.senderRepo.upsertDefaultSender(user.id, user.email, {
        name: `${user.name} (ReachInbox Mailbox)`,
        hourlyLimit: 200,
        minDelaySeconds: 2,
      }),
      this.sessionRepo.createSession(user.id, tokenHash, expiresAt),
    ]);

    return { token: rawToken, user };
  }

  async createDemoSession(email = 'alex.founder@reachinbox.ai', name = 'Alex Founder'): Promise<{ token: string; user: User }> {
    const demoGoogleId = `demo_${email}`;
    const user = await this.userRepo.upsertGoogleUser(
      demoGoogleId,
      email,
      name,
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await Promise.all([
      this.senderRepo.upsertDefaultSender(user.id, user.email, {
        name: `${user.name} (ReachInbox Mailbox)`,
        hourlyLimit: 200,
        minDelaySeconds: 2,
      }),
      this.sessionRepo.createSession(user.id, tokenHash, expiresAt),
    ]);

    return { token: rawToken, user };
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await this.sessionRepo.deleteSession(tokenHash);
  }

  async getCurrentUser(userId: string): Promise<{ user: User; defaultSenderId?: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const sender = await this.senderRepo.findDefaultOrFirstByUserId(userId);
    return {
      user,
      defaultSenderId: sender?.id,
    };
  }
}
