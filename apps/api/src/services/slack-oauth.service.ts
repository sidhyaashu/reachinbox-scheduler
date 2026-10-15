import { SlackIntegrationRepository } from '@reachinbox/database';
import { SlackIntegration, NotFoundError, AppError } from '@reachinbox/shared';
import { config } from '../config.js';

export class SlackOAuthService {
  constructor(
    private readonly slackRepo: SlackIntegrationRepository = new SlackIntegrationRepository()
  ) {}

  getSlackAuthorizeUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: config.SLACK_CLIENT_ID,
      scope: 'chat:write,incoming-webhook',
      redirect_uri: config.SLACK_REDIRECT_URI,
      state: userId,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async handleSlackCallback(code: string, userId: string): Promise<SlackIntegration> {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.SLACK_CLIENT_ID,
        client_secret: config.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: config.SLACK_REDIRECT_URI,
      }),
    });

    const data = (await response.json()) as any;
    if (!data.ok) {
      throw new AppError(`Slack OAuth exchange failed: ${data.error || 'Unknown error'}`, 400, 'SLACK_OAUTH_FAILED');
    }

    const teamId = data.team?.id || 'unknown-team';
    const teamName = data.team?.name || 'Slack Team';
    const accessToken = data.access_token || '';
    const channelId = data.incoming_webhook?.channel_id || null;
    const channelName = data.incoming_webhook?.channel || null;
    const webhookUrl = data.incoming_webhook?.url || null;

    const integration = await this.slackRepo.upsertIntegration(
      userId,
      teamId,
      teamName,
      accessToken,
      channelId,
      channelName,
      webhookUrl
    );

    return integration;
  }

  async getSlackStatus(userId: string): Promise<{
    connected: boolean;
    teamName?: string;
    channelName?: string;
  }> {
    const integration = await this.slackRepo.findByUserId(userId);
    if (!integration) {
      return { connected: false };
    }

    return {
      connected: true,
      teamName: integration.teamName,
      channelName: integration.channelName || undefined,
    };
  }

  async disconnectSlack(userId: string): Promise<void> {
    const deleted = await this.slackRepo.deleteByUserId(userId);
    if (!deleted) {
      throw new NotFoundError('Slack integration for user', userId);
    }
  }

  async sendTestMessage(userId: string): Promise<void> {
    const integration = await this.slackRepo.findByUserId(userId);
    if (!integration) {
      throw new NotFoundError('Slack integration not found. Please connect Slack first.');
    }

    const testText = '👋 *ReachInbox Integration Verified!*\nYour Slack workspace is successfully connected to receive instant rate-limit alerts.';

    if (integration.webhookUrl) {
      const res = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText }),
      });
      if (!res.ok) {
        throw new AppError('Failed to send test message via Slack webhook', 502, 'SLACK_WEBHOOK_ERROR');
      }
    } else if (integration.accessToken && integration.channelId) {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${integration.accessToken}`,
        },
        body: JSON.stringify({
          channel: integration.channelId,
          text: testText,
        }),
      });
      const data = (await res.json()) as any;
      if (!data.ok) {
        throw new AppError(`Failed to send test message to Slack channel: ${data.error}`, 502, 'SLACK_API_ERROR');
      }
    }
  }
}
