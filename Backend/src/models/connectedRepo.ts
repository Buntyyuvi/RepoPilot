import { query } from "../config/database";
import type { RepoSummary } from "../services/github";

interface ConnectedRepoRow {
  id: number;
  user_id: number;
  owner: string;
  repo_name: string;
  full_name: string;
  description: string | null;
  is_private: boolean;
  language: string | null;
  stargazers_count: number;
  updated_at: Date | null;
  html_url: string | null;
  default_branch: string;
  created_at: Date;
}

function toRepoSummary(row: ConnectedRepoRow): RepoSummary {
  return {
    id: row.id,
    name: row.repo_name,
    fullName: row.full_name,
    description: row.description,
    private: row.is_private,
    language: row.language,
    stargazersCount: row.stargazers_count,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : '',
    htmlUrl: row.html_url ?? `https://github.com/${row.full_name}`,
    defaultBranch: row.default_branch
  };
}

// Records (or refreshes) a repo the user connected via URL. On conflict we
// refresh the metadata snapshot but keep the original connection timestamp.
export async function upsertConnectedRepo(
  userId: number,
  repo: RepoSummary
): Promise<void> {
  const parts = repo.fullName.split('/');
  const owner = parts[0] ?? repo.fullName;
  const repoName = parts[1] ?? repo.fullName;

  await query(
    `INSERT INTO connected_repos
       (user_id, owner, repo_name, full_name, description, is_private, language,
        stargazers_count, updated_at, html_url, default_branch)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id, full_name) DO UPDATE SET
       owner = EXCLUDED.owner,
       repo_name = EXCLUDED.repo_name,
       description = EXCLUDED.description,
       is_private = EXCLUDED.is_private,
       language = EXCLUDED.language,
       stargazers_count = EXCLUDED.stargazers_count,
       updated_at = EXCLUDED.updated_at,
       html_url = EXCLUDED.html_url,
       default_branch = EXCLUDED.default_branch`,
    [
      userId,
      owner,
      repoName,
      repo.fullName,
      repo.description,
      repo.private,
      repo.language,
      repo.stargazersCount,
      repo.updatedAt,
      repo.htmlUrl,
      repo.defaultBranch
    ]
  );
}

export async function listConnectedRepos(userId: number): Promise<RepoSummary[]> {
  const result = await query<ConnectedRepoRow>(
    `SELECT *
     FROM connected_repos
     WHERE user_id = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC`,
    [userId]
  );
  return result.rows.map(toRepoSummary);
}

export async function deleteConnectedRepo(
  userId: number,
  fullName: string
): Promise<void> {
  await query(
    `DELETE FROM connected_repos WHERE user_id = $1 AND full_name = $2`,
    [userId, fullName]
  );
}