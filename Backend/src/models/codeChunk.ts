import { query } from "../config/database";

export interface CodeChunkInput {
  repositoryId: string;
  filePath: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
}

export interface CodeChunkSource {
  filePath: string;
  chunkIndex: number;
}

// Inserts a single chunk with its embedding vector.
export async function insertCodeChunk(chunk: CodeChunkInput): Promise<void> {
  const embedding = `[${chunk.embedding.join(',')}]`;
  await query(
    `INSERT INTO code_chunks (repository_id, file_path, content, embedding, chunk_index)
     VALUES ($1, $2, $3, $4::vector, $5)`,
    [chunk.repositoryId, chunk.filePath, chunk.content, embedding, chunk.chunkIndex],
  );
}

// Removes every chunk for a repository so a re-index replaces the old data.
export async function deleteChunksForRepository(repositoryId: string): Promise<void> {
  await query(`DELETE FROM code_chunks WHERE repository_id = $1`, [repositoryId]);
}

export async function countChunksForRepository(repositoryId: string): Promise<number> {
  const result = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM code_chunks WHERE repository_id = $1`,
    [repositoryId],
  );
  return result.rows[0]?.count ?? 0;
}

export interface SearchResult {
  content: string;
  filePath: string;
  chunkIndex: number;
}

// Returns the distinct indexed file paths for a repository, which powers the
// file-scoped chat picker (only chunks that actually exist can be searched).
export async function listIndexedFiles(repositoryId: string): Promise<string[]> {
  const result = await query<{ file_path: string }>(
    `SELECT DISTINCT file_path
     FROM code_chunks
     WHERE repository_id = $1
     ORDER BY file_path`,
    [repositoryId],
  );
  return result.rows.map((row) => row.file_path);
}

// Cosine distance (<=>) against the question embedding, returning the most
// relevant chunks for a given repository. When `filePath` is provided, the
// search is restricted to chunks of that single file.
export async function searchCodeChunks(
  repositoryId: string,
  embedding: number[],
  limit = 8,
  filePath?: string,
): Promise<SearchResult[]> {
  const embeddingLiteral = `[${embedding.join(',')}]`;
  const result = await query<{ content: string; file_path: string; chunk_index: number }>(
    `SELECT content, file_path, chunk_index
     FROM code_chunks
     WHERE repository_id = $1${filePath ? ` AND file_path = $4` : ''}
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    filePath
      ? [repositoryId, embeddingLiteral, limit, filePath]
      : [repositoryId, embeddingLiteral, limit],
  );
  return result.rows.map((row) => ({
    content: row.content,
    filePath: row.file_path,
    chunkIndex: row.chunk_index,
  }));
}