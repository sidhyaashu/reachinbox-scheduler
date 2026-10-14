import { query } from '../pool.js';

export interface UserSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export class SessionRepository {
  async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<UserSession> {
    const sql = `
      INSERT INTO sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING
        id,
        user_id AS "userId",
        token_hash AS "tokenHash",
        expires_at AS "expiresAt",
        created_at AS "createdAt";
    `;

    const res = await query<UserSession>(sql, [userId, tokenHash, expiresAt]);
    const session = res.rows[0];
    if (!session) {
      throw new Error('[SessionRepository] Failed to create session.');
    }
    return session;
  }

  async findByTokenHash(tokenHash: string): Promise<UserSession | null> {
    const sql = `
      SELECT
        id,
        user_id AS "userId",
        token_hash AS "tokenHash",
        expires_at AS "expiresAt",
        created_at AS "createdAt"
      FROM sessions
      WHERE token_hash = $1 AND expires_at > NOW();
    `;

    const res = await query<UserSession>(sql, [tokenHash]);
    return res.rows[0] || null;
  }

  async deleteSession(tokenHash: string): Promise<boolean> {
    const sql = `
      DELETE FROM sessions
      WHERE token_hash = $1;
    `;
    const res = await query(sql, [tokenHash]);
    return (res.rowCount ?? 0) > 0;
  }
}
