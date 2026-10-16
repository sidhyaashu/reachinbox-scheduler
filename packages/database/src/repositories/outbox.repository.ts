import type { PoolClient } from 'pg';
import { query, withTransaction } from '../pool.js';
import type { OutboxEvent } from '@reachinbox/shared';

export class OutboxRepository {
  /**
   * Atomically selects and claims pending outbox events using FOR UPDATE SKIP LOCKED
   * and immediately transitions their status to 'PROCESSING' in a single CTE statement.
   * This guarantees that concurrent scheduler workers/replicas never select the same events,
   * even across multiple independent processes.
   */
  async fetchAndClaimPendingEvents(
    limit: number = 100,
    client?: PoolClient
  ): Promise<OutboxEvent[]> {
    const sql = `
      WITH claimed AS (
        SELECT id
        FROM outbox_events
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events o
      SET status = 'PROCESSING'
      FROM claimed c
      WHERE o.id = c.id
      RETURNING
        o.id,
        o.aggregate_type AS "aggregateType",
        o.aggregate_id AS "aggregateId",
        o.event_type AS "eventType",
        o.payload,
        o.status,
        o.retry_count AS "retryCount",
        o.dispatched_at AS "dispatchedAt",
        o.created_at AS "createdAt";
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

  /**
   * Compatibility alias for fetchAndClaimPendingEvents.
   */
  async fetchPendingEvents(
    limit: number = 100,
    client?: PoolClient
  ): Promise<OutboxEvent[]> {
    return this.fetchAndClaimPendingEvents(limit, client);
  }

  /**
   * Reconciles in-flight 'PROCESSING' events left over from an unexpected
   * server shutdown or restart, resetting them back to 'PENDING'.
   */
  async reconcileInFlightEvents(client?: PoolClient): Promise<number> {
    const sql = `
      UPDATE outbox_events
      SET status = 'PENDING'
      WHERE status = 'PROCESSING';
    `;
    if (client) {
      const res = await client.query(sql);
      return res.rowCount || 0;
    }
    const res = await query(sql);
    return res.rowCount || 0;
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
   * Recovers any outbox events that might have been left pending or in-flight.
   */
  async getPendingCount(): Promise<number> {
    const res = await query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM outbox_events
      WHERE status IN ('PENDING', 'PROCESSING');
    `);
    return res.rows[0]?.count || 0;
  }
}

