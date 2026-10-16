import axios from 'axios';
import { SlackIntegrationRepository } from '@reachinbox/database';
import { getSharedRedis } from '@reachinbox/queue';

/**
 * Standard Alert Payload dispatched when rate limits or critical system thresholds are reached.
 */
export interface AlertPayload {
  userId: string;
  senderEmail: string;
  senderId: string;
  hourlyLimit: number;
  nextWindowDate: Date;
  level?: 'info' | 'warn' | 'error';
  metadata?: Record<string, unknown>;
}

/**
 * Pluggable Alert Provider Interface.
 * Implement this interface to add new alert destinations (e.g., Slack, Discord, PagerDuty, Webhooks, Loggers)
 * without modifying worker processor logic.
 */
export interface AlertProvider {
  readonly name: string;
  notify(payload: AlertPayload): Promise<void>;
}

/**
 * Slack Alert Provider (OAuth Bot Message / Incoming Webhook)
 */
export class SlackAlertProvider implements AlertProvider {
  readonly name = 'slack';

  constructor(
    private readonly slackRepo: SlackIntegrationRepository = new SlackIntegrationRepository()
  ) {}

  async notify(payload: AlertPayload): Promise<void> {
    const integration = await this.slackRepo.findByUserId(payload.userId);
    if (!integration) {
      console.log(`[SlackAlertProvider] Sender ${payload.senderEmail} hit rate limit. (Slack not connected, skipping alert)`);
      return;
    }

    const istFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(payload.nextWindowDate) + ' IST';

    const messageText = `🚨 *ReachInbox Rate Limit Alert*\n• *Sender:* ${payload.senderEmail}\n• *Quota:* Reached ${payload.hourlyLimit} emails/hour\n• *Status:* Subsequent emails deferred to *${istFormatted}*\n• *Note:* Zero jobs dropped. Resilience guaranteed.`;

    if (integration.webhookUrl) {
      await axios.post(
        integration.webhookUrl,
        { text: messageText },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
        }
      );
    } else if (integration.accessToken && integration.channelId) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: integration.channelId,
          text: messageText,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${integration.accessToken}`,
          },
          timeout: 5000,
        }
      );
    }
    console.log(`[SlackAlertProvider] Successfully dispatched Slack alert for sender ${payload.senderEmail}`);
  }
}

/**
 * Log Alert Provider (Structured Logging / Audit Trail)
 */
export class LogAlertProvider implements AlertProvider {
  readonly name = 'log';

  async notify(payload: AlertPayload): Promise<void> {
    console.warn(
      `[LogAlertProvider] [RATE_LIMIT_ALERT] sender=${payload.senderEmail} limit=${payload.hourlyLimit} nextWindow=${payload.nextWindowDate.toISOString()}`
    );
  }
}

/**
 * Generic Webhook Alert Provider (Can trigger Discord, PagerDuty, or custom backend endpoints)
 */
export class WebhookAlertProvider implements AlertProvider {
  readonly name = 'webhook';

  constructor(private readonly webhookUrl?: string) {}

  async notify(payload: AlertPayload): Promise<void> {
    const url = this.webhookUrl || process.env.GENERIC_ALERT_WEBHOOK_URL;
    if (!url) return;

    await axios.post(
      url,
      {
        event: 'rate_limit_exceeded',
        sender: payload.senderEmail,
        quota: payload.hourlyLimit,
        resumedAt: payload.nextWindowDate.toISOString(),
        timestamp: new Date().toISOString(),
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      }
    );
    console.log(`[WebhookAlertProvider] Dispatched alert to ${url}`);
  }
}

/**
 * Pluggable Alert Service & Dispatcher
 */
export class AlertService {
  private readonly providers: Map<string, AlertProvider> = new Map();

  constructor(
    slackRepo: SlackIntegrationRepository = new SlackIntegrationRepository(),
    private readonly redis = getSharedRedis(),
    customProviders: AlertProvider[] = []
  ) {
    // Register built-in default providers
    this.registerProvider(new SlackAlertProvider(slackRepo));
    this.registerProvider(new LogAlertProvider());
    this.registerProvider(new WebhookAlertProvider());

    // Register any custom providers passed at runtime
    for (const provider of customProviders) {
      this.registerProvider(provider);
    }
  }

  /**
   * Register a new alert provider plugin dynamically at runtime.
   */
  registerProvider(provider: AlertProvider): this {
    this.providers.set(provider.name, provider);
    return this;
  }

  /**
   * Remove a provider plugin by name.
   */
  unregisterProvider(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * Get all currently registered providers.
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Sends an alert across all registered providers when a sender hits their rate limit.
   * Atomic deduplication: Only 1 alert is dispatched per sender per hour window across all channels.
   * Safe and non-blocking: Never throws an error that could disrupt email processing.
   */
  async notifyRateLimitHit(params: AlertPayload): Promise<void> {
    try {
      // 1. Rate-limit alert deduplication: atomically acquire 1-hour window lock in Redis
      const hourKey = params.nextWindowDate.toISOString().substring(0, 13);
      const alertDedupeKey = `rate_limit_alert_sent:${params.senderId}:${hourKey}`;
      const acquired = await this.redis.set(alertDedupeKey, 'true', 'EX', 3600, 'NX');
      if (!acquired) {
        return; // Alert already dispatched for this hour window
      }

      // 2. Dispatch to all registered providers concurrently
      const dispatchPromises = Array.from(this.providers.values()).map(async (provider) => {
        try {
          await provider.notify(params);
        } catch (providerError: any) {
          console.error(`[AlertService] Provider '${provider.name}' failed:`, providerError.message);
        }
      });

      await Promise.allSettled(dispatchPromises);
    } catch (err: any) {
      console.error('[AlertService] Failed to dispatch alert:', err.message);
    }
  }
}
