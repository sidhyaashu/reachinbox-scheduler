import { Redis } from 'ioredis';
import { getSharedRedis } from '@reachinbox/queue';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  msUntilNextHour?: number;
  nextHourDate?: Date;
}

export class WorkerRateLimiter {
  constructor(private readonly redis: Redis = getSharedRedis()) {}

  /**
   * Evaluates hourly sending quota for a given sender using atomic Redis counters.
   */
  async checkHourlyLimit(
    senderId: string,
    hourlyLimit: number
  ): Promise<RateLimitCheckResult> {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');
    const windowKey = `${year}${month}${day}${hour}`;

    const key = `rate_limit:${senderId}:${windowKey}`;

    // Atomic increment
    const currentCount = await this.redis.incr(key);
    if (currentCount === 1) {
      // 2-hour TTL to cover the current window safely
      await this.redis.expire(key, 7200);
    }

    if (currentCount > hourlyLimit) {
      // Calculate milliseconds until start of next UTC hour
      const nextHourDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours() + 1,
        0,
        0,
        0
      ));
      const msUntilNextHour = Math.max(1000, nextHourDate.getTime() - now.getTime());

      return {
        allowed: false,
        currentCount,
        limit: hourlyLimit,
        msUntilNextHour,
        nextHourDate,
      };
    }

    return {
      allowed: true,
      currentCount,
      limit: hourlyLimit,
    };
  }

  /**
   * Enforces minimum spacing delay (e.g. 2s) between consecutive sends for a sender.
   */
  async enforceInterSendDelay(
    senderId: string,
    minDelaySeconds: number
  ): Promise<number> {
    if (minDelaySeconds <= 0) return 0;

    const minDelayMs = minDelaySeconds * 1000;
    const key = `sender:${senderId}:last_sent`;

    const now = Date.now();
    const lastSentRaw = await this.redis.get(key);
    const lastSent = lastSentRaw ? parseInt(lastSentRaw, 10) : 0;

    const elapsed = now - lastSent;
    let waitMs = 0;

    if (elapsed < minDelayMs) {
      waitMs = minDelayMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    // Record this send timestamp in Redis
    await this.redis.set(key, Date.now(), 'EX', 3600);
    return waitMs;
  }
}
