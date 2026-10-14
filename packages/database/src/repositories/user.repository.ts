import { query } from '../pool.js';
import type { User } from '@reachinbox/shared';

export class UserRepository {
  async upsertGoogleUser(
    googleId: string,
    email: string,
    name: string,
    avatarUrl?: string | null
  ): Promise<User> {
    const sql = `
      INSERT INTO users (google_id, email, name, avatar_url, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (email) DO UPDATE
      SET
        google_id = COALESCE(users.google_id, EXCLUDED.google_id),
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
      RETURNING
        id,
        email,
        name,
        avatar_url AS "avatarUrl",
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;

    const res = await query<User>(sql, [googleId, email, name, avatarUrl || null]);
    const user = res.rows[0];
    if (!user) {
      throw new Error('[UserRepository] Failed to upsert Google user.');
    }
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const sql = `
      SELECT
        id,
        email,
        name,
        avatar_url AS "avatarUrl",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM users
      WHERE id = $1;
    `;
    const res = await query<User>(sql, [id]);
    return res.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT
        id,
        email,
        name,
        avatar_url AS "avatarUrl",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM users
      WHERE email = $1;
    `;
    const res = await query<User>(sql, [email]);
    return res.rows[0] || null;
  }
}
