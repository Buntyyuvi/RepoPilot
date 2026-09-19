import { query } from "../config/database";
import type { GitHubUser } from "../types";

export interface UserRecord {
  id: number;
  github_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  access_token: string;
  refresh_token: string | null;
  access_token_expires_at: Date | null;
  refresh_token_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function findUserByGithubId(
  githubId: string,
): Promise<UserRecord | null> {
  const result = await query<UserRecord>(
    "SELECT * FROM users WHERE github_id = $1",
    [githubId],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const result = await query<UserRecord>(
    "SELECT * FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}

export async function upsertGitHubUser(user: GitHubUser): Promise<UserRecord> {
  const result = await query<UserRecord>(
    `INSERT INTO users (github_id, username, display_name, avatar_url, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (github_id) DO UPDATE SET
       username = EXCLUDED.username,
       display_name = EXCLUDED.display_name,
       avatar_url = EXCLUDED.avatar_url,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       access_token_expires_at = EXCLUDED.access_token_expires_at,
       refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
       updated_at = now()
     RETURNING *`,
    [
      user.id,
      user.username,
      user.displayName,
      user.avatarUrl ?? null,
      user.accessToken,
      user.refreshToken ?? null,
      user.accessTokenExpiresAt ?? null,
      user.refreshTokenExpiresAt ?? null,
    ],
  );
  return result.rows[0];
}

export interface UserTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
}

export async function updateUserTokens(
  id: number,
  tokens: UserTokens,
): Promise<void> {
  await query(
    `UPDATE users
       SET access_token = $1,
           refresh_token = $2,
           access_token_expires_at = $3,
           refresh_token_expires_at = $4,
           updated_at = now()
     WHERE id = $5`,
    [
      tokens.accessToken,
      tokens.refreshToken,
      tokens.accessTokenExpiresAt,
      tokens.refreshTokenExpiresAt,
      id,
    ],
  );
}

export function toSessionUser(record: UserRecord): {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
} {
  return {
    id: record.id,
    username: record.username,
    displayName: record.display_name,
    avatarUrl: record.avatar_url ?? undefined,
  };
}