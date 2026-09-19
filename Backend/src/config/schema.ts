import { query } from "./database";

export async function initializeSchema(): Promise<void> {
  // pgvector extension ships with the docker image and is enabled by
  // docker/postgres/init-extension.sql, but ensure it exists here too so the
  // app also works against any plain Postgres (e.g. a hosted Supabase).
  await query(`CREATE EXTENSION IF NOT EXISTS vector;`);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      github_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      access_token_expires_at TIMESTAMPTZ,
      refresh_token_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Keeps already-created databases in sync (CREATE TABLE IF NOT EXISTS
  // will not add columns to an existing table).
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;`);

  // Semantic search index for the RAG pipeline.
  await query(`
    CREATE TABLE IF NOT EXISTS code_chunks (
      id BIGSERIAL PRIMARY KEY,
      repository_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding vector(768),
      chunk_index INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Repositories a user explicitly connected via URL. GitHub is still the
  // source of truth for repos the user can access, but this table also lets us
  // surface public repos they don't own (e.g. facebook/react) which would never
  // appear in the GitHub "your repos" list.
  await query(`
    CREATE TABLE IF NOT EXISTS connected_repos (
      id BIGSERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      description TEXT,
      is_private BOOLEAN NOT NULL DEFAULT false,
      language TEXT,
      stargazers_count INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ,
      html_url TEXT,
      default_branch TEXT NOT NULL DEFAULT 'main',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, full_name)
    );
  `);

  // Chat history: one implicit conversation thread per (user, repo).
  await query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      repository_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
      content TEXT NOT NULL,
      scope_path TEXT,
      sources JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS chat_messages_user_repo_idx
      ON chat_messages (user_id, repository_id, created_at);
  `);

  // pgvector cannot build an ivfflat index on an empty table, so it is created
  // lazily after the first indexing run (see services/indexing.ts). If rows
  // already exist, create it here.
  const countResult = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM code_chunks`
  );
  if (Number(countResult.rows[0]?.count ?? 0) > 0) {
    await query(`
      CREATE INDEX IF NOT EXISTS code_chunks_embedding_idx
        ON code_chunks USING ivfflat (embedding vector_cosine_ops);
    `);
  }
}

// Creates the similarity-search index once enough rows exist.
export async function ensureEmbeddingIndex(): Promise<void> {
  await query(`
    CREATE INDEX IF NOT EXISTS code_chunks_embedding_idx
      ON code_chunks USING ivfflat (embedding vector_cosine_ops);
  `);
}