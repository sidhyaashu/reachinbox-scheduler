import type { PoolClient } from 'pg';
import { query, withTransaction } from '../pool.js';
import type { OutboxEvent } from '@reachinbox/shared';

export class OutboxRepository {
  /**
   * Fetches pending outbox events using FOR UPDATE SKIP LOCKED
   * to prevent duplicate dispatches when multiple scheduler instances run.
   */
  async fetchPendingEvents(
    limit: number = 100,
    client?: PoolClient
  ): Promise<OutboxEvent[]> {
    const sql = `
      SELECT
        id,
        aggregate_type AS "aggregateType",
        aggregate_id AS "aggregateId",
        event_type AS "eventType",
        payload,
        status,
        retry_count AS "retryCount",
        dispatched_at AS "dispatchedAt",
        created_at AS "createdAt"
      FROM outbox_events
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED;
    `;

    if (client) {
      const res = await client.query<OutboxEvent>(sql, [limit]);
      return res.rows;
    }

    return withTransaction(async (txClient) => {
      const res = await txClient.query<OutboxEvent>(sql, [limit]);
      return res.rows;
    });
  }

  async markDispatched(id: string, client?: PoolClient): Promise<void> {
    const sql = `
      UPDATE outbox_events
      SET
        status = 'DISPATCHED',
        dispatched_at = NOW()
      WHERE id = $1;
    `;
    if (client) {
      await client.query(sql, [id]);
    } else {
      await query(sql, [id]);
    }
  }

  async markFailed(id: string, client?: PoolClient): Promise<void> {
    const sql = `
      UPDATE outbox_events
      SET
        status = 'FAILED',
        retry_count = retry_count + 1
      WHERE id = $1;
    `;
    if (client) {
      await client.query(sql, [id]);
    } else {
      await query(sql, [id]);
    }
  }

  /**
   * Recovers any outbox events that might have been left pending.
   */
  async getPendingCount(): Promise<number> {
    const res = await query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM outbox_events
      WHERE status = 'PENDING';
    `);
    return res.rows[0]?.count || 0;
  }
}
