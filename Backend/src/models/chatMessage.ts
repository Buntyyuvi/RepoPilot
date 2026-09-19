import { query } from "../config/database";

export type ChatRole = "user" | "ai";

export interface ChatSource {
  filePath: string;
  chunkIndex: number;
}

export interface ChatMessageRow {
  id: string;
  role: ChatRole;
  content: string;
  scope_path: string | null;
  sources: ChatSource[] | null;
  created_at: Date;
}

export interface StoredChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  scopePath: string | null;
  sources: ChatSource[];
}

function toStoredMessage(row: ChatMessageRow): StoredChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    scopePath: row.scope_path,
    sources: row.sources ?? [],
  };
}

// Records one message in a (user, repo) conversation thread.
export async function insertChatMessage(
  userId: number,
  repositoryId: string,
  role: ChatRole,
  content: string,
  scopePath?: string | null,
  sources?: ChatSource[] | null,
): Promise<StoredChatMessage> {
  const result = await query<ChatMessageRow>(
    `INSERT INTO chat_messages (user_id, repository_id, role, content, scope_path, sources)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, role, content, scope_path, sources, created_at`,
    [
      userId,
      repositoryId,
      role,
      content,
      scopePath ?? null,
      sources && sources.length > 0 ? JSON.stringify(sources) : null,
    ],
  );
  return toStoredMessage(result.rows[0]);
}

// The full conversation thread for a repo, oldest first.
export async function listChatMessages(
  userId: number,
  repositoryId: string,
): Promise<StoredChatMessage[]> {
  const result = await query<ChatMessageRow>(
    `SELECT id, role, content, scope_path, sources, created_at
     FROM chat_messages
     WHERE user_id = $1 AND repository_id = $2
     ORDER BY created_at ASC, id ASC`,
    [userId, repositoryId],
  );
  return result.rows.map(toStoredMessage);
}

// Wipes the conversation thread for a repo (used by "Reset Chat").
export async function deleteChatMessages(
  userId: number,
  repositoryId: string,
): Promise<void> {
  await query(
    `DELETE FROM chat_messages WHERE user_id = $1 AND repository_id = $2`,
    [userId, repositoryId],
  );
}

// Wipes every conversation thread for a user (used by "Reset all chat
// history" in settings).
export async function deleteAllChatMessages(userId: number): Promise<void> {
  await query(`DELETE FROM chat_messages WHERE user_id = $1`, [userId]);
}