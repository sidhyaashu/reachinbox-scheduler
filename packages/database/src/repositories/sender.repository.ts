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
        auth_type AS "authType",
        google_refresh_token AS "googleRefreshToken",
        google_access_token AS "googleAccessToken",
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
        auth_type AS "authType",
        google_refresh_token AS "googleRefreshToken",
        google_access_token AS "googleAccessToken",
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
        auth_type AS "authType",
        google_refresh_token AS "googleRefreshToken",
        google_access_token AS "googleAccessToken",
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
        smtp_secure, hourly_limit, min_delay_seconds, auth_type,
        google_refresh_token, google_access_token
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        auth_type AS "authType",
        google_refresh_token AS "googleRefreshToken",
        google_access_token AS "googleAccessToken",
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
      options?.authType || 'smtp',
      options?.googleRefreshToken || null,
      options?.googleAccessToken || null,
    ]);

    const sender = res.rows[0];
    if (!sender) {
      throw new Error('[SenderRepository] Failed to upsert default sender.');
    }
    return sender;
  }

  async linkGoogleOAuthSender(
    userId: string,
    email: string,
    name: string,
    refreshToken?: string | null,
    accessToken?: string | null
  ): Promise<Sender> {
    const existing = await this.findDefaultOrFirstByUserId(userId);
    if (existing) {
      const updateSql = `
        UPDATE senders
        SET
          auth_type = 'oauth2_google',
          email = $2,
          name = $3,
          google_refresh_token = COALESCE($4, google_refresh_token),
          google_access_token = COALESCE($5, google_access_token),
          updated_at = NOW()
        WHERE id = $1
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
          auth_type AS "authType",
          google_refresh_token AS "googleRefreshToken",
          google_access_token AS "googleAccessToken",
          created_at AS "createdAt",
          updated_at AS "updatedAt";
      `;
      const res = await query<Sender>(updateSql, [
        existing.id,
        email,
        name,
        refreshToken || null,
        accessToken || null,
      ]);
      return res.rows[0];
    }

    const insertSql = `
      INSERT INTO senders (
        user_id, email, name, auth_type, google_refresh_token, google_access_token,
        smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, hourly_limit, min_delay_seconds
      )
      VALUES ($1, $2, $3, 'oauth2_google', $4, $5, 'smtp.gmail.com', 465, $2, '', true, 200, 2)
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
        auth_type AS "authType",
        google_refresh_token AS "googleRefreshToken",
        google_access_token AS "googleAccessToken",
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;
    const res = await query<Sender>(insertSql, [
      userId,
      email,
      name,
      refreshToken || null,
      accessToken || null,
    ]);
    return res.rows[0];
  }
}
