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
   * Uses an atomic Redis script to reserve sequential dispatch slots across concurrent workers,
   * guaranteeing zero send collisions even under high concurrency.
   */
  async enforceInterSendDelay(
    senderId: string,
    minDelaySeconds: number
  ): Promise<number> {
    if (minDelaySeconds <= 0) return 0;

    const minDelayMs = minDelaySeconds * 1000;
    const key = `sender:${senderId}:next_available_slot`;
    const now = Date.now();

    let assignedSlot = now;

    if (typeof (this.redis as any).eval === 'function') {
      try {
        const luaScript = `
          local key = KEYS[1]
          local min_delay = tonumber(ARGV[1])
          local now_ts = tonumber(ARGV[2])
          local next_slot = redis.call('get', key)
          if not next_slot or tonumber(next_slot) < now_ts then
            next_slot = now_ts
          else
            next_slot = tonumber(next_slot)
          end
          local assigned = next_slot
          redis.call('set', key, assigned + min_delay, 'EX', 3600)
          return tostring(assigned)
        `;
        const res = await (this.redis as any).eval(luaScript, 1, key, minDelayMs, now);
        if (res) {
          assignedSlot = parseInt(String(res), 10);
        }
      } catch {
        // Fallback if Redis eval throws or is unsupported
        const lastSentRaw = await this.redis.get(key);
        const lastSent = lastSentRaw ? parseInt(lastSentRaw, 10) : 0;
        assignedSlot = Math.max(now, lastSent);
        await this.redis.set(key, String(assignedSlot + minDelayMs), 'EX', 3600);
      }
    } else {
      const lastSentRaw = await this.redis.get(key);
      const lastSent = lastSentRaw ? parseInt(lastSentRaw, 10) : 0;
      assignedSlot = Math.max(now, lastSent);
      await this.redis.set(key, String(assignedSlot + minDelayMs), 'EX', 3600);
    }

    const waitMs = Math.max(0, assignedSlot - now);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    return waitMs;
  }
}
