import { Router, Request, Response } from 'express';
import { Job } from 'bullmq';
import { ensureAuthenticated } from '../middleware/ensureAuth';
import {
  fetchFileContent,
  fetchRepoTree,
  fetchUserRepos,
  getValidAccessToken,
  TokenRefreshError,
  type RepoSummary
} from '../services/github';
import { indexQueue } from '../queue/indexQueue';
import { embedText, generateGroundedAnswer, AIError } from '../services/ai';
import { countChunksForRepository, listIndexedFiles, searchCodeChunks } from '../models/codeChunk';
import {
  deleteConnectedRepo,
  listConnectedRepos,
  upsertConnectedRepo
} from '../models/connectedRepo';
import { Octokit } from '@octokit/rest';
import { findUserById } from '../models/user';
import {
  deleteChatMessages,
  insertChatMessage,
  listChatMessages
} from '../models/chatMessage';

const router = Router();

// Every route here requires a logged-in session.
router.use(ensureAuthenticated);

// Resolves the current user and hands requests a valid (possibly refreshed)
// GitHub access token. Throws TokenRefreshError when re-auth is required.
async function getAccessToken(userId: number): Promise<string> {
  const user = await findUserById(userId);
  if (!user) {
    throw new TokenRefreshError('User not found; re-authentication is required.');
  }
  const { accessToken } = await getValidAccessToken(user);
  return accessToken;
}

// Fetches a repo's GitHub metadata and persists it as a connected repo for the
// user. Shared by URL validation and by the index-start route, so that any repo
// a user indexes surfaces as an active repository on the dashboard.
async function persistRepoMetadata(
  userId: number,
  accessToken: string,
  owner: string,
  repo: string,
  fallbackUrl?: string
): Promise<RepoSummary> {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.repos.get({ owner, repo });

  const summary: RepoSummary = {
    id: data.id,
    name: data.name,
    fullName: data.full_name ?? `${owner}/${repo}`,
    description: data.description,
    private: data.private === true,
    language: data.language,
    stargazersCount: data.stargazers_count ?? 0,
    updatedAt: data.updated_at ?? '',
    htmlUrl: data.html_url ?? fallbackUrl ?? `https://github.com/${owner}/${repo}`,
    defaultBranch: data.default_branch ?? 'main'
  };

  await upsertConnectedRepo(userId, summary);
  return summary;
}

// List the authenticated user's repositories. GitHub-accessible repos are
// fetched live, then merged with the repos the user explicitly connected via
// URL (this is what surfaces public repos they don't own).
router.get('/repos', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as { id: number }).id;
    const accessToken = await getAccessToken(userId);

    const [githubRepos, connectedRepos] = await Promise.all([
      fetchUserRepos(accessToken),
      listConnectedRepos(userId)
    ]);

    // Prefer live GitHub data when the repo appears in both sources; fall back
    // to the persisted snapshot for connected repos we can't list from GitHub.
    const byFullName = new Map<string, RepoSummary>();
    for (const repo of githubRepos) {
      byFullName.set(repo.fullName, repo);
    }
    for (const repo of connectedRepos) {
      if (!byFullName.has(repo.fullName)) {
        byFullName.set(repo.fullName, repo);
      }
    }

    const repos = [...byFullName.values()].sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );

    res.json({ repos });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    console.error('Failed to list repos:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Validates a GitHub repository URL, fetches its metadata, and persists it as
// a connected repo for the user. Returns the full RepoSummary shape.
router.post('/repos/validate', async (req: Request, res: Response) => {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

    if (!rawUrl) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!/^https?:\/\/github\.com\/[^/]+\/[^/]+$/.test(rawUrl)) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL' });
    }

    const parts = rawUrl.replace(/\/$/, '').split('/');
    const owner = parts[parts.length - 2];
    const repo = parts[parts.length - 1];

    const userId = (req.user as { id: number }).id;
    const accessToken = await getAccessToken(userId);

    const summary = await persistRepoMetadata(userId, accessToken, owner, repo, rawUrl);

    res.json({ repo: summary });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    res.status(404).json({ error: 'Repository not found or not accessible' });
  }
});

// The authenticated user's explicitly connected repositories (persisted).
router.get('/repos/connected', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as { id: number }).id;
    const repos = await listConnectedRepos(userId);
    res.json({ repos });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    console.error('Failed to list connected repos:', error);
    res.status(500).json({ error: 'Failed to list connected repositories' });
  }
});

// Un-connects a repo that was added via URL (GitHub-accessible repos stay in
// the list because they are fetched live).
router.delete('/repos/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const fullName = `${String(req.params.owner)}/${String(req.params.repo)}`;
    const userId = (req.user as { id: number }).id;
    await deleteConnectedRepo(userId, fullName);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    console.error('Failed to remove connected repo:', error);
    res.status(500).json({ error: 'Failed to remove connected repository' });
  }
});

// Fetch the entire file/folder structure of a repo's branch (Git Trees API).
router.get('/repos/:owner/:repo/tree', async (req: Request, res: Response) => {
  try {
    const owner = String(req.params.owner);
    const repo = String(req.params.repo);
    const branchParam = req.query.branch;
    const requestedBranch =
      typeof branchParam === 'string' && branchParam ? branchParam : 'main';

    const userId = (req.user as { id: number }).id;
    const accessToken = await getAccessToken(userId);

    let branch = requestedBranch;
    let tree;
    try {
      tree = await fetchRepoTree(accessToken, owner, repo, branch);
    } catch (error) {
      // The default branch might be 'master' rather than 'main' — retry once.
      if (branch === 'main') {
        branch = 'master';
        tree = await fetchRepoTree(accessToken, owner, repo, branch);
      } else {
        throw error;
      }
    }

    res.json({ tree, branch });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    console.error('Failed to fetch repo tree:', error);
    res.status(404).json({ error: 'Repository or branch not found' });
  }
});

// Fetch individual file contents lazily for the code viewer.
router.get('/repos/:owner/:repo/content', async (req: Request, res: Response) => {
  try {
    const owner = String(req.params.owner);
    const repo = String(req.params.repo);
    const pathParam = req.query.path;
    const path = typeof pathParam === 'string' && pathParam ? pathParam : '';
    const branchParam = req.query.branch;
    const branch =
      typeof branchParam === 'string' && branchParam ? branchParam : 'main';

    if (!path) {
      return res.status(400).json({ error: 'path is required' });
    }

    const userId = (req.user as { id: number }).id;
    const accessToken = await getAccessToken(userId);
    const file = await fetchFileContent(accessToken, owner, repo, path, branch);

    res.json({ file });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    console.error('Failed to fetch file content:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

// Kick off a background indexing job: chunk + embed every file in the repo.
router.post('/repos/:owner/:repo/index', async (req: Request, res: Response) => {
  try {
    const owner = String(req.params.owner);
    const repo = String(req.params.repo);
    const fullName = `${owner}/${repo}`;
    const branchParam = req.query.branch;
    const branch =
      typeof branchParam === 'string' && branchParam ? branchParam : 'main';

    const userId = (req.user as { id: number }).id;
    const accessToken = await getAccessToken(userId);

    // Register the repo as "connected"/active so it shows up on the dashboard.
    // Indexing must not depend on this persisting (e.g. a repo deleted or
    // renamed mid-flight), so failures are logged and ignored.
    try {
      await persistRepoMetadata(userId, accessToken, owner, repo);
    } catch (error) {
      console.error('Failed to persist repo metadata during indexing:', error);
    }

    // One in-flight job per repo: a fixed jobId means re-adding while the
    // previous job is still waiting/running just reuses it.
    const existing = await Job.fromId(indexQueue, fullName);
    if (existing) {
      const state = await existing.getState();
      if (['waiting', 'delayed', 'active', 'paused'].includes(state)) {
        const progress = (existing.progress ?? {}) as {
          processed?: number;
          total?: number;
          chunkCount?: number;
        };
        return res.status(202).json({
          job: {
            status: 'running',
            total: progress.total ?? 0,
            processed: progress.processed ?? 0,
            chunkCount: progress.chunkCount ?? 0,
          }
        });
      }
    }

    try {
      await indexQueue.add(
        'index',
        { userId, fullName, branch },
        { jobId: fullName }
      );
    } catch (error) {
      console.error('Failed to enqueue indexing job:', error);
      return res
        .status(503)
        .json({ error: 'Indexing service is unavailable. Please try again shortly.' });
    }

    // Respond instantly — the chunking/embedding happens in the worker process.
    res.status(202).json({
      job: { status: 'running', total: 0, processed: 0, chunkCount: 0 }
    });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    console.error('Failed to start indexing:', error);
    res.status(500).json({ error: 'Failed to start indexing' });
  }
});

// Polling endpoint for indexing progress + how many chunks exist today. Each
// repo has at most one job (jobId = fullName); completed/failed jobs are kept
// so the frontend reliably observes the terminal state via this endpoint.
router.get('/repos/:owner/:repo/index/status', async (req: Request, res: Response) => {
  try {
    const fullName = `${String(req.params.owner)}/${String(req.params.repo)}`;
    const queueJob = await Job.fromId(indexQueue, fullName);
    const indexedChunks = await countChunksForRepository(fullName);

    let job: {
      status: 'running' | 'done' | 'error';
      total: number;
      processed: number;
      chunkCount: number;
      error: string | null;
    } | null = null;

    if (queueJob) {
      const state = await queueJob.getState();
      const progress = (queueJob.progress ?? {}) as {
        processed?: number;
        total?: number;
        chunkCount?: number;
      };
      job = {
        status: state === 'completed' ? 'done' : state === 'failed' ? 'error' : 'running',
        total: progress.total ?? 0,
        processed: progress.processed ?? 0,
        chunkCount: progress.chunkCount ?? 0,
        error:
          state === 'failed'
            ? (queueJob.failedReason ?? 'Indexing failed.')
            : null
      };
    }

    res.json({ job, indexedChunks });
  } catch (error) {
    console.error('Failed to get index status:', error);
    res.status(500).json({ error: 'Failed to get index status' });
  }
});

// List the distinct indexed file paths for a repo — powers the file-scoped
// chat picker.
router.get('/repos/:owner/:repo/files', async (req: Request, res: Response) => {
  try {
    const fullName = `${String(req.params.owner)}/${String(req.params.repo)}`;
    const files = await listIndexedFiles(fullName);
    res.json({ files });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    console.error('Failed to list indexed files:', error);
    res.status(500).json({ error: 'Failed to list indexed files' });
  }
});

// Grounded Q&A: embed the question, find the most relevant chunks, and let
// Gemini answer using only those chunks. When a filePath is provided, only
// chunks belonging to that file are searched.
router.post('/repos/:owner/:repo/chat', async (req: Request, res: Response) => {
  try {
    const owner = String(req.params.owner);
    const repo = String(req.params.repo);
    const fullName = `${owner}/${repo}`;
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const filePath =
      typeof req.body?.filePath === 'string' && req.body.filePath.trim()
        ? req.body.filePath.trim()
        : undefined;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const userId = (req.user as { id: number }).id;

    // Persist the user's question first so it survives even if answering fails.
    await insertChatMessage(userId, fullName, 'user', message, filePath);

    const questionVector = await embedText(message);
    const matches = await searchCodeChunks(fullName, questionVector, 8, filePath);

    if (matches.length === 0) {
      if (filePath) {
        return res.status(404).json({
          error: 'The selected file is not indexed. Pick a different file or re-index the repo.',
          code: 'FILE_NOT_INDEXED'
        });
      }
      return res.status(409).json({
        error: 'This repository has not been indexed yet. Index it first.'
      });
    }

    const answer = await generateGroundedAnswer(
      message,
      matches.map((m) => ({ filePath: m.filePath, content: m.content }))
    );

    const sources = matches.map((m) => ({ filePath: m.filePath, chunkIndex: m.chunkIndex }));
    await insertChatMessage(userId, fullName, 'ai', answer, null, sources);

    res.json({ answer, sources });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    if (error instanceof AIError && error.status === 429) {
      return res.status(429).json({
        error: 'Gemini rate limit reached. Please try again in a moment.'
      });
    }
    console.error('Chat request failed:', error);
    res.status(500).json({ error: 'Failed to generate an answer' });
  }
});

// The persisted conversation thread for a repo, oldest first.
router.get('/repos/:owner/:repo/chat/history', async (req: Request, res: Response) => {
  try {
    const fullName = `${String(req.params.owner)}/${String(req.params.repo)}`;
    const userId = (req.user as { id: number }).id;
    const messages = await listChatMessages(userId, fullName);
    res.json({ messages });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    console.error('Failed to load chat history:', error);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

// Wipes the persisted thread for a repo (used by "Reset Chat").
router.delete('/repos/:owner/:repo/chat', async (req: Request, res: Response) => {
  try {
    const fullName = `${String(req.params.owner)}/${String(req.params.repo)}`;
    const userId = (req.user as { id: number }).id;
    await deleteChatMessages(userId, fullName);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof TokenRefreshError) {
      return res.status(401).json({
        error: 'Your GitHub session expired. Please sign in again.',
        code: 'GITHUB_TOKEN_REFRESH_FAILED'
      });
    }
    console.error('Failed to reset chat history:', error);
    res.status(500).json({ error: 'Failed to reset chat history' });
  }
});

export default router;