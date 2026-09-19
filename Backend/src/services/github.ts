import { Octokit } from '@octokit/rest';
import { updateUserTokens, type UserRecord } from '../models/user';
import { withRetry } from '../lib/retryWithBackoff';

const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
// Refresh slightly before the token actually dies to avoid racing against it.
const EXPIRY_BUFFER_MS = 60_000;

export interface RepoSummary {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stargazersCount: number;
  updatedAt: string;
  htmlUrl: string;
  defaultBranch: string;
}

// Thrown when the refresh token itself is expired/revoked, meaning the user
// has to re-authorize. Routes translate this into a 401 for the frontend. The
// optional status lets the retry helper distinguish a transient 429/5xx (which
// it retries) from a real auth failure (which it rethrows immediately).
export class TokenRefreshError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'TokenRefreshError';
    this.status = status;
  }
}

interface RefreshedTokenSet {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<RefreshedTokenSet> {
  console.log('[token-refresh] attempting GitHub token refresh (via refresh_token)');
  const data = await withRetry(async () => {
    const response = await fetch(GITHUB_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    const body: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_token_expires_in?: number;
      error?: string;
      error_description?: string;
    } = await response.json().catch(() => ({}));

    if (!response.ok || !body.access_token) {
      console.warn('[token-refresh] GitHub token refresh FAILED', {
        status: response.status,
        error: body.error ?? null,
        errorDescription: body.error_description ?? null
      });
      throw new TokenRefreshError(
        body.error_description || body.error || `Token refresh failed (${response.status})`,
        response.status
      );
    }

    return body as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_token_expires_in?: number;
    };
  });

  console.log('[token-refresh] GitHub token refresh succeeded', {
    expiresInSeconds: data.expires_in ?? null,
    refreshTokenExpiresInSeconds: data.refresh_token_expires_in ?? null
  });

  const now = Date.now();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    accessTokenExpiresAt: data.expires_in
      ? new Date(now + data.expires_in * 1000)
      : null,
    refreshTokenExpiresAt: data.refresh_token_expires_in
      ? new Date(now + data.refresh_token_expires_in * 1000)
      : null
  };
}

// Returns a usable access token for the given user, exchanging for a new one
// (and persisting it) when the stored token is expired or about to expire.
export async function getValidAccessToken(
  user: UserRecord
): Promise<{ accessToken: string }> {
  const expiresAt = user.access_token_expires_at;
  const now = Date.now();
  const msUntilExpiry = expiresAt ? expiresAt.getTime() - now : null;

  // Long-lived tokens (no expiry recorded) are used as-is.
  if (msUntilExpiry === null || msUntilExpiry > EXPIRY_BUFFER_MS) {
    return { accessToken: user.access_token };
  }

  console.log('[token-refresh] access token expiring/expired', {
    userId: user.id,
    msUntilExpiry,
    hasRefreshToken: Boolean(user.refresh_token)
  });

  if (!user.refresh_token) {
    throw new TokenRefreshError(
      'Access token expired and no refresh token is available; re-authentication is required.'
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new TokenRefreshError('GitHub OAuth credentials are not configured.');
  }

  const refreshed = await refreshAccessToken(user.refresh_token, clientId, clientSecret);

  await updateUserTokens(user.id, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
    refreshTokenExpiresAt: refreshed.refreshTokenExpiresAt
  });

  return { accessToken: refreshed.accessToken };
}

export async function fetchUserRepos(accessToken: string): Promise<RepoSummary[]> {
  return withRetry(async () => {
    const octokit = new Octokit({ auth: accessToken });

    const repos = await octokit.paginate(
      octokit.repos.listForAuthenticatedUser,
      {
        per_page: 100,
        sort: 'updated',
        affiliation: 'owner,collaborator,organization_member'
      }
    );

    return repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      language: repo.language,
      stargazersCount: repo.stargazers_count ?? 0,
      updatedAt: repo.updated_at ?? '',
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch ?? 'main'
    }));
  });
}

export interface TreeNode {
  path: string;
  type: 'blob' | 'tree'; // blob = file, tree = folder
  sha: string;
  size?: number;
}

// Fetches the ENTIRE file/folder structure of a repo at a given branch in a
// single recursive Git Trees API call.
export async function fetchRepoTree(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string
): Promise<TreeNode[]> {
  return withRetry(async () => {
    const octokit = new Octokit({ auth: accessToken });

    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });

    const { data: treeData } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: refData.object.sha,
      recursive: '1'
    });

    if (treeData.truncated) {
      console.warn(`Tree for ${owner}/${repo} was truncated — repo is very large`);
    }

    return treeData.tree
      .filter((item) => item.type === 'blob' || item.type === 'tree')
      .map((item) => ({
        path: item.path!,
        type: item.type as 'blob' | 'tree',
        sha: item.sha!,
        size: item.size
      }));
  });
}

// Fetches individual file contents lazily (only when the user opens a file).
// GitHub returns contents base64-encoded, so decode before returning.
export async function fetchFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<{ content: string; size: number }> {
  return withRetry(async () => {
    const octokit = new Octokit({ auth: accessToken });

    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref
    });

    if (Array.isArray(data) || data.type !== 'file') {
      throw new Error(`Path '${path}' does not point to a file`);
    }

    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, size: data.size ?? 0 };
  });
}