import { query } from '../pool.js';
import type { Sender } from '@reachinbox/shared';

export class SenderRepository {
  async findById(id: string): Promise<Sender | null> {
    const sql = `
      SELECT
        id,
        user_id AS "userId",
        email,
        name,
        smtp_host AS "smtpHost",
        smtp_port AS "smtpPort",
        smtp_user AS "smtpUser",
        smtp_pass AS "smtpPass",
        smtp_secure AS "smtpSecure",
        hourly_limit AS "hourlyLimit",
        min_delay_seconds AS "minDelaySeconds",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM senders
      WHERE id = $1;
    `;
    const res = await query<Sender>(sql, [id]);
    return res.rows[0] || null;
  }

  async findByUserId(userId: string): Promise<Sender[]> {
    const sql = `
      SELECT
        id,
        user_id AS "userId",
        email,
        name,
        smtp_host AS "smtpHost",
        smtp_port AS "smtpPort",
        smtp_user AS "smtpUser",
        smtp_pass AS "smtpPass",
        smtp_secure AS "smtpSecure",
        hourly_limit AS "hourlyLimit",
        min_delay_seconds AS "minDelaySeconds",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM senders
      WHERE user_id = $1
      ORDER BY created_at ASC;
    `;
    const res = await query<Sender>(sql, [userId]);
    return res.rows;
  }

  async findDefaultOrFirstByUserId(userId: string): Promise<Sender | null> {
    const sql = `
      SELECT
        id,
        user_id AS "userId",
        email,
        name,
        smtp_host AS "smtpHost",
        smtp_port AS "smtpPort",
        smtp_user AS "smtpUser",
        smtp_pass AS "smtpPass",
        smtp_secure AS "smtpSecure",
        hourly_limit AS "hourlyLimit",
        min_delay_seconds AS "minDelaySeconds",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM senders
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT 1;
    `;
    const res = await query<Sender>(sql, [userId]);
    return res.rows[0] || null;
  }

  async upsertDefaultSender(
    userId: string,
    email: string,
    options?: Partial<Sender>
  ): Promise<Sender> {
    const existing = await this.findDefaultOrFirstByUserId(userId);
    if (existing) {
      return existing;
    }

    const sql = `
      INSERT INTO senders (
        user_id, email, name, smtp_host, smtp_port, smtp_user, smtp_pass,
        smtp_secure, hourly_limit, min_delay_seconds
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING
        id,
        user_id AS "userId",
        email,
        name,
        smtp_host AS "smtpHost",
        smtp_port AS "smtpPort",
        smtp_user AS "smtpUser",
        smtp_pass AS "smtpPass",
        smtp_secure AS "smtpSecure",
        hourly_limit AS "hourlyLimit",
        min_delay_seconds AS "minDelaySeconds",
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;

    const res = await query<Sender>(sql, [
      userId,
      email,
      options?.name || 'Default Sender',
      options?.smtpHost || 'smtp.ethereal.email',
      options?.smtpPort || 587,
      options?.smtpUser || '',
      options?.smtpPass || '',
      options?.smtpSecure || false,
      options?.hourlyLimit || 200,
      options?.minDelaySeconds || 2,
    ]);

    const sender = res.rows[0];
    if (!sender) {
      throw new Error('[SenderRepository] Failed to upsert default sender.');
    }
    return sender;
  }
}
