import { fetchFileContent, fetchRepoTree, getValidAccessToken, TokenRefreshError, type TreeNode } from './github';
import { embedText } from './ai';
import {
  deleteChunksForRepository,
  insertCodeChunk,
} from '../models/codeChunk';
import { ensureEmbeddingIndex } from '../config/schema';
import { findUserById } from '../models/user';

const TARGET_LINES = 400;
const OVERLAP_LINES = 40;
const MAX_FILE_BYTES = 1_500_000;

// Directories that are almost never useful to index.
const IGNORED_DIR_RE =
  /(^|\/)(node_modules|\.git|dist|build|\.next|coverage|__pycache__|\.venv|venv|vendor|Pods|\.cache|target|out)(\/|$)/;

const IGNORED_FILE_NAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'composer.lock',
  'cargo.lock',
  'poetry.lock',
  'gemfile.lock',
  'go.sum',
  'deno.lock',
]);

function shouldSkip(path: string, size?: number): boolean {
  if (IGNORED_DIR_RE.test(path)) return true;
  const name = path.split('/').pop() ?? path;
  const lower = name.toLowerCase();
  if (IGNORED_FILE_NAMES.has(lower)) return true;
  if (/\.lock$/i.test(lower)) return true;
  if (/\.min\.(js|css)$/i.test(lower)) return true;
  if (size !== undefined && size > MAX_FILE_BYTES) return true;
  return false;
}

function isBinary(content: string): boolean {
  return content.includes('\u0000');
}

interface RawChunk {
  filePath: string;
  content: string;
  index: number;
}

// Splits a file into ~400-line chunks with a small overlap so context survives
// chunk boundaries.
export function chunkFile(filePath: string, text: string): RawChunk[] {
  const lines = text.split('\n');
  if (lines.length === 0) return [];

  const chunks: RawChunk[] = [];
  let index = 0;
  const step = TARGET_LINES - OVERLAP_LINES;

  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(start + TARGET_LINES, lines.length);
    chunks.push({
      filePath,
      content: lines.slice(start, end).join('\n'),
      index,
    });
    index += 1;
    if (end === lines.length) break;
  }

  return chunks;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const current = next;
      next += 1;
      await worker(items[current]);
    }
  });
  await Promise.all(runners);
}

export interface IndexingProgress {
  processed: number;
  total: number;
  chunkCount: number;
}

export type IndexingProgressListener = (progress: IndexingProgress) => void | Promise<void>;

// Executes the full indexing pipeline for a repo inside a background worker:
// resolve the user's GitHub token, replace any previous embeddings for the
// repo, fetch the tree, then chunk + embed every file. Progress is reported
// through `onProgress` after each file so the caller can persist it (e.g. via
// BullMQ job.updateProgress) for the polling status endpoint.
//
// This never runs inside a request handler — only the worker process calls it,
// so heavy chunking/embedding never blocks the API server.
export async function runIndexing(
  userId: number,
  fullName: string,
  branch: string,
  onProgress: IndexingProgressListener,
): Promise<void> {
  const user = await findUserById(userId);
  if (!user) {
    throw new TokenRefreshError('User not found; re-authentication is required.');
  }
  const { accessToken } = await getValidAccessToken(user);

  // Fresh re-index replaces the previous embeddings for this repo.
  await deleteChunksForRepository(fullName);

  const [owner, repoName] = fullName.split('/');

  const tree = await fetchRepoTree(accessToken, owner, repoName, branch);
  const fileNodes = tree.filter(
    (node: TreeNode) => node.type === 'blob' && !shouldSkip(node.path, node.size),
  );

  let processed = 0;
  let chunkCount = 0;

  await runWithConcurrency(fileNodes, 3, async (node) => {
    let text = '';
    try {
      const result = await fetchFileContent(
        accessToken,
        owner,
        repoName,
        node.path,
        branch,
      );
      text = result.content;
    } catch {
      // Skip files that cannot be fetched (404, moved, …).
    }

    if (text && !isBinary(text)) {
      const chunks = chunkFile(node.path, text);
      for (const chunk of chunks) {
        const embedding = await embedText(chunk.content);
        await insertCodeChunk({
          repositoryId: fullName,
          filePath: chunk.filePath,
          content: chunk.content,
          embedding,
          chunkIndex: chunk.index,
        });
        chunkCount += 1;
      }
    }

    processed += 1;
    await onProgress({ processed, total: fileNodes.length, chunkCount });
  });

  // Enables fast similarity search now that rows exist (pgvector cannot build
  // an ivfflat index on an empty table).
  await ensureEmbeddingIndex();
}