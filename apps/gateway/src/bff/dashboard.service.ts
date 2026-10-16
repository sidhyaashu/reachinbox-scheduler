import {
  EmailRepository,
  SenderRepository,
  UserRepository,
  SlackIntegrationRepository,
} from '@reachinbox/database';
import { getEmailQueue } from '@reachinbox/queue';

export class DashboardBffService {
  constructor(
    private readonly emailRepo: EmailRepository = new EmailRepository(),
    private readonly senderRepo: SenderRepository = new SenderRepository(),
    private readonly userRepo: UserRepository = new UserRepository(),
    private readonly slackRepo: SlackIntegrationRepository = new SlackIntegrationRepository()
  ) {}

  async getDashboardSummary(userId: string) {
    const queue = getEmailQueue();

    // Execute queries in parallel for high performance
    const [
      user,
      sender,
      scheduled,
      sent,
      slack,
      queueCounts,
    ] = await Promise.all([
      this.userRepo.findById(userId),
      this.senderRepo.findDefaultOrFirstByUserId(userId),
      this.emailRepo.findScheduled(userId, { page: 1, limit: 10 }),
      this.emailRepo.findSent(userId, { page: 1, limit: 10 }),
      this.slackRepo.findByUserId(userId),
      queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused').catch(() => ({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      })),
    ]);

    return {
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          }
        : null,
      sender: sender
        ? {
            id: sender.id,
            email: sender.email,
            name: sender.name,
            hourlyLimit: sender.hourlyLimit,
            minDelaySeconds: sender.minDelaySeconds,
            authType: sender.authType || 'smtp',
            smtpHost: sender.smtpHost,
            smtpPort: sender.smtpPort,
            smtpUser: sender.smtpUser,
            hasCustomSmtp: Boolean(sender.smtpUser && sender.smtpPass && sender.smtpHost !== 'smtp.ethereal.email'),
          }
        : null,
      stats: {
        totalScheduled: scheduled.total,
        totalSent: sent.total,
      },
      scheduledEmails: scheduled.items,
      sentEmails: sent.items,
      slackIntegration: {
        connected: Boolean(slack),
        teamName: slack?.teamName,
        channelName: slack?.channelName,
      },
      queueMetrics: queueCounts,
    };
  }
}
