import { query } from '../pool.js';
import type { SlackIntegration } from '@reachinbox/shared';

export class SlackIntegrationRepository {
  async upsertIntegration(
    userId: string,
    teamId: string,
    teamName: string,
    accessToken: string,
    channelId?: string | null,
    channelName?: string | null,
    webhookUrl?: string | null
  ): Promise<SlackIntegration> {
    const sql = `
      INSERT INTO slack_integrations (
        user_id, team_id, team_name, access_token,
        channel_id, channel_name, webhook_url, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET
        team_id = EXCLUDED.team_id,
        team_name = EXCLUDED.team_name,
        access_token = EXCLUDED.access_token,
        channel_id = EXCLUDED.channel_id,
        channel_name = EXCLUDED.channel_name,
        webhook_url = EXCLUDED.webhook_url,
        updated_at = NOW()
      RETURNING
        id,
        user_id AS "userId",
        team_id AS "teamId",
        team_name AS "teamName",
        channel_id AS "channelId",
        channel_name AS "channelName",
        webhook_url AS "webhookUrl",
        access_token AS "accessToken",
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;

    const res = await query<SlackIntegration>(sql, [
      userId,
      teamId,
      teamName,
      accessToken,
      channelId || null,
      channelName || null,
      webhookUrl || null,
    ]);

    const integration = res.rows[0];
    if (!integration) {
      throw new Error('[SlackIntegrationRepository] Failed to upsert Slack integration.');
    }
    return integration;
  }

  async findByUserId(userId: string): Promise<SlackIntegration | null> {
    const sql = `
      SELECT
        id,
        user_id AS "userId",
        team_id AS "teamId",
        team_name AS "teamName",
        channel_id AS "channelId",
        channel_name AS "channelName",
        webhook_url AS "webhookUrl",
        access_token AS "accessToken",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM slack_integrations
      WHERE user_id = $1;
    `;
    const res = await query<SlackIntegration>(sql, [userId]);
    return res.rows[0] || null;
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const sql = `
      DELETE FROM slack_integrations
      WHERE user_id = $1;
    `;
    const res = await query(sql, [userId]);
    return (res.rowCount ?? 0) > 0;
  }
}
