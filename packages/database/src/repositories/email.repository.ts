import type { PoolClient } from 'pg';
import { query, withTransaction } from '../pool.js';
import type { EmailRecord, EmailStatusType, EmailQueryParams } from '@reachinbox/shared';

export interface CreateEmailParams {
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  idempotencyKey?: string | null;
  attachments?: any[] | null;
}

export class EmailRepository {
  /**
   * Transactionally creates an email record and its corresponding outbox event.
   */
  async createEmailWithOutbox(
    params: CreateEmailParams,
    existingClient?: PoolClient
  ): Promise<EmailRecord> {
    const execute = async (client: PoolClient): Promise<EmailRecord> => {
      // 1. Insert email
      const emailInsertSql = `
        INSERT INTO emails (
          user_id, sender_id, recipient, subject, body,
          status, scheduled_at, idempotency_key, attempts, attachments
        )
        VALUES ($1, $2, $3, $4, $5, 'SCHEDULED', $6, $7, 0, $8)
        RETURNING
          id, user_id AS "userId", sender_id AS "senderId", recipient, subject,
          body, status, scheduled_at AS "scheduledAt", sent_at AS "sentAt",
          ethereal_message_url AS "etherealMessageUrl", idempotency_key AS "idempotencyKey",
          attempts, last_error AS "lastError", attachments, created_at AS "createdAt", updated_at AS "updatedAt";
      `;

      const emailResult = await client.query<EmailRecord>(emailInsertSql, [
        params.userId,
        params.senderId,
        params.recipient,
        params.subject,
        params.body,
        params.scheduledAt,
        params.idempotencyKey || null,
        params.attachments ? JSON.stringify(params.attachments) : null,
      ]);

      const email = emailResult.rows[0];
      if (!email) {
        throw new Error('[EmailRepository] Failed to insert email record.');
      }

      // 2. Insert transactional outbox event
      const outboxInsertSql = `
        INSERT INTO outbox_events (
          aggregate_type, aggregate_id, event_type, payload, status
        )
        VALUES ('EMAIL', $1, 'EMAIL_SCHEDULED', $2, 'PENDING');
      `;

      const outboxPayload = {
        emailId: email.id,
        userId: email.userId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        scheduledAt: email.scheduledAt.toISOString(),
        attachments: email.attachments,
      };

      await client.query(outboxInsertSql, [email.id, JSON.stringify(outboxPayload)]);

      return email;
    };

    if (existingClient) {
      return execute(existingClient);
    }
    return withTransaction(execute);
  }

  /**
   * Transactionally creates a batch of emails and outbox events.
   */
  async createBatchEmailsWithOutbox(
    batch: CreateEmailParams[]
  ): Promise<EmailRecord[]> {
    return withTransaction(async (client) => {
      const records: EmailRecord[] = [];
      for (const params of batch) {
        const record = await this.createEmailWithOutbox(params, client);
        records.push(record);
      }
      return records;
    });
  }

  async findById(id: string): Promise<EmailRecord | null> {
    const sql = `
      SELECT
        id, user_id AS "userId", sender_id AS "senderId", recipient, subject,
        body, status, scheduled_at AS "scheduledAt", sent_at AS "sentAt",
        ethereal_message_url AS "etherealMessageUrl", idempotency_key AS "idempotencyKey",
        attempts, last_error AS "lastError", attachments, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM emails
      WHERE id = $1;
    `;
    const res = await query<EmailRecord>(sql, [id]);
    return res.rows[0] || null;
  }

  async findByIdempotencyKey(key: string): Promise<EmailRecord | null> {
    const sql = `
      SELECT
        id, user_id AS "userId", sender_id AS "senderId", recipient, subject,
        body, status, scheduled_at AS "scheduledAt", sent_at AS "sentAt",
        ethereal_message_url AS "etherealMessageUrl", idempotency_key AS "idempotencyKey",
        attempts, last_error AS "lastError", attachments, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM emails
      WHERE idempotency_key = $1;
    `;
    const res = await query<EmailRecord>(sql, [key]);
    return res.rows[0] || null;
  }

  async findScheduled(
    userId: string,
    params: Partial<EmailQueryParams>
  ): Promise<{ items: EmailRecord[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM emails
      WHERE user_id = $1 AND status IN ('SCHEDULED', 'QUEUED', 'PROCESSING', 'DEFERRED');
    `;

    const sql = `
      SELECT
        id, user_id AS "userId", sender_id AS "senderId", recipient, subject,
        body, status, scheduled_at AS "scheduledAt", sent_at AS "sentAt",
        ethereal_message_url AS "etherealMessageUrl", idempotency_key AS "idempotencyKey",
        attempts, last_error AS "lastError", attachments, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM emails
      WHERE user_id = $1 AND status IN ('SCHEDULED', 'QUEUED', 'PROCESSING', 'DEFERRED')
      ORDER BY scheduled_at ASC
      LIMIT $2 OFFSET $3;
    `;

    const [countRes, res] = await Promise.all([
      query<{ count: number }>(countSql, [userId]),
      query<EmailRecord>(sql, [userId, limit, offset]),
    ]);

    const total = countRes.rows[0]?.count || 0;
    return { items: res.rows, total };
  }

  async findSent(
    userId: string,
    params: Partial<EmailQueryParams>
  ): Promise<{ items: EmailRecord[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM emails
      WHERE user_id = $1 AND status IN ('SENT', 'FAILED');
    `;

    const sql = `
      SELECT
        id, user_id AS "userId", sender_id AS "senderId", recipient, subject,
        body, status, scheduled_at AS "scheduledAt", sent_at AS "sentAt",
        ethereal_message_url AS "etherealMessageUrl", idempotency_key AS "idempotencyKey",
        attempts, last_error AS "lastError", attachments, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM emails
      WHERE user_id = $1 AND status IN ('SENT', 'FAILED')
      ORDER BY COALESCE(sent_at, updated_at) DESC
      LIMIT $2 OFFSET $3;
    `;

    const [countRes, res] = await Promise.all([
      query<{ count: number }>(countSql, [userId]),
      query<EmailRecord>(sql, [userId, limit, offset]),
    ]);

    const total = countRes.rows[0]?.count || 0;
    return { items: res.rows, total };
  }

  async updateStatus(
    id: string,
    fromStatuses: EmailStatusType[],
    toStatus: EmailStatusType,
    meta?: {
      sentAt?: Date | null;
      etherealMessageUrl?: string | null;
      lastError?: string | null;
      incrementAttempts?: boolean;
    }
  ): Promise<EmailRecord | null> {
    const params: any[] = [toStatus, id, fromStatuses];
    let paramIndex = 4;
    let extraSets = '';

    if (meta?.incrementAttempts) {
      extraSets += ', attempts = attempts + 1';
    }
    if (meta?.sentAt !== undefined) {
      extraSets += `, sent_at = $${paramIndex++}`;
      params.push(meta.sentAt);
    }
    if (meta?.etherealMessageUrl !== undefined) {
      extraSets += `, ethereal_message_url = $${paramIndex++}`;
      params.push(meta.etherealMessageUrl);
    }
    if (meta?.lastError !== undefined) {
      extraSets += `, last_error = $${paramIndex++}`;
      params.push(meta.lastError);
    }

    const sql = `
      UPDATE emails
      SET
        status = $1,
        updated_at = NOW()
        ${extraSets}
      WHERE id = $2 AND status = ANY($3::varchar[])
      RETURNING
        id, user_id AS "userId", sender_id AS "senderId", recipient, subject,
        body, status, scheduled_at AS "scheduledAt", sent_at AS "sentAt",
        ethereal_message_url AS "etherealMessageUrl", idempotency_key AS "idempotencyKey",
        attempts, last_error AS "lastError", attachments, created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const res = await query<EmailRecord>(sql, params);
    return res.rows[0] || null;
  }

  async cancelEmail(id: string, userId: string): Promise<boolean> {
    const sql = `
      UPDATE emails
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status IN ('SCHEDULED', 'QUEUED', 'DEFERRED', 'PROCESSING');
    `;
    const res = await query(sql, [id, userId]);
    return (res.rowCount ?? 0) > 0;
  }

  async deleteEmail(id: string, userId: string): Promise<boolean> {
    await query(`DELETE FROM outbox_events WHERE aggregate_id = $1`, [id]).catch(() => null);
    const sql = `DELETE FROM emails WHERE id = $1 AND user_id = $2;`;
    const res = await query(sql, [id, userId]);
    return (res.rowCount ?? 0) > 0;
  }
}
