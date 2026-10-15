import { SlackIntegrationRepository } from '@reachinbox/database';
import { getSharedRedis } from '@reachinbox/queue';

export class AlertService {
  constructor(
    private readonly slackRepo: SlackIntegrationRepository = new SlackIntegrationRepository(),
    private readonly redis = getSharedRedis()
  ) {}

  /**
   * Sends an alert to Slack when a sender hits their hourly rate limit.
   * Safe and non-blocking: Never throws an error that could disrupt email processing.
   */
  async notifyRateLimitHit(params: {
    userId: string;
    senderEmail: string;
    senderId: string;
    hourlyLimit: number;
    nextWindowDate: Date;
  }): Promise<void> {
    try {
      // 1. Rate-limit alert deduplication: only 1 Slack alert per sender per hour window
      const hourKey = params.nextWindowDate.toISOString().substring(0, 13);
      const alertDedupeKey = `slack_alert_sent:${params.senderId}:${hourKey}`;
      const alreadySent = await this.redis.get(alertDedupeKey);
      if (alreadySent) {
        return; // Alert already dispatched for this hour window
      }

      // 2. Check if user connected Slack
      const integration = await this.slackRepo.findByUserId(params.userId);
      if (!integration) {
        console.log(`[AlertService] Sender ${params.senderEmail} hit rate limit. (Slack not connected, skipping alert)`);
        return;
      }

      const messageText = `🚨 *ReachInbox Rate Limit Alert*\n• *Sender:* ${params.senderEmail}\n• *Quota:* Reached ${params.hourlyLimit} emails/hour\n• *Status:* Subsequent emails deferred to ${params.nextWindowDate.toUTCString()}\n• *Note:* Zero jobs dropped. Resilience guaranteed.`;

      // 3. Send via Webhook URL or Slack Chat API
      if (integration.webhookUrl) {
        await fetch(integration.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: messageText }),
        });
      } else if (integration.accessToken && integration.channelId) {
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${integration.accessToken}`,
          },
          body: JSON.stringify({
            channel: integration.channelId,
            text: messageText,
          }),
        });
      }

      // 4. Mark alert as sent for this hour
      await this.redis.set(alertDedupeKey, 'true', 'EX', 3600);
      console.log(`[AlertService] Successfully sent Slack alert for sender ${params.senderEmail}`);
    } catch (err: any) {
      // Never crash email worker if Slack alert fails
      console.error('[AlertService] Failed to send Slack alert:', err.message);
    }
  }
}
