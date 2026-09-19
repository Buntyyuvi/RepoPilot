export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

export interface AppUser {
  id: number
  username: string
  displayName: string
  avatarUrl?: string
}

export interface Repo {
  id: number
  name: string
  fullName: string
  description: string | null
  private: boolean
  language: string | null
  stargazersCount: number
  updatedAt: string
  htmlUrl: string
  defaultBranch: string
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export interface TreeNode {
  path: string
  type: "blob" | "tree"
  sha: string
  size?: number
}

export interface FileContent {
  content: string
  size: number
}

export async function fetchRepoTree(
  fullName: string,
  branch: string,
): Promise<{ tree: TreeNode[]; branch: string }> {
  const encoded = encodeURIComponent(branch)
  return apiFetch<{ tree: TreeNode[]; branch: string }>(
    `/repos/${fullName}/tree?branch=${encoded}`,
  )
}

export async function fetchFileContent(
  fullName: string,
  path: string,
  branch: string,
): Promise<{ file: FileContent }> {
  return apiFetch<{ file: FileContent }>(
    `/repos/${fullName}/content?path=${encodeURIComponent(path)}&branch=${encodeURIComponent(branch)}`,
  )
}

export interface IndexJob {
  status: "running" | "done" | "error"
  total: number
  processed: number
  chunkCount: number
  error?: string | null
}

export interface IndexStatusData {
  job: IndexJob | null
  indexedChunks: number
}

export async function startIndexing(
  fullName: string,
  branch = "main",
): Promise<{ job: IndexJob }> {
  return apiFetch<{ job: IndexJob }>(
    `/repos/${fullName}/index?branch=${encodeURIComponent(branch)}`,
    { method: "POST" },
  )
}

export async function getIndexStatus(fullName: string): Promise<IndexStatusData> {
  return apiFetch<IndexStatusData>(`/repos/${fullName}/index/status`)
}

// Validates a GitHub URL against the GitHub API and persists it as a connected
// repo for the current user. Returns the full repo metadata.
export async function connectRepo(url: string): Promise<Repo> {
  const data = await apiFetch<{ repo: Repo }>("/repos/validate", {
    method: "POST",
    body: JSON.stringify({ url }),
  })
  return data.repo
}

// Repos the user explicitly connected via URL (persisted on the backend).
export async function fetchConnectedRepos(): Promise<Repo[]> {
  const data = await apiFetch<{ repos: Repo[] }>("/repos/connected")
  return data.repos ?? []
}

export async function removeConnectedRepo(fullName: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/repos/${fullName}`, { method: "DELETE" })
}

export interface ChatSource {
  filePath: string
  chunkIndex: number
}

export interface ChatAnswer {
  answer: string
  sources: ChatSource[]
}

export interface ChatHistoryMessage {
  id: string
  role: "user" | "ai"
  content: string
  scopePath: string | null
  sources: ChatSource[]
}

export async function askRepoQuestion(
  fullName: string,
  message: string,
  filePath?: string,
): Promise<ChatAnswer> {
  return apiFetch<ChatAnswer>(`/repos/${fullName}/chat`, {
    method: "POST",
    body: JSON.stringify({ message, filePath }),
  })
}

// The persisted conversation thread for a repo, oldest first.
export async function fetchChatHistory(fullName: string): Promise<ChatHistoryMessage[]> {
  const data = await apiFetch<{ messages: ChatHistoryMessage[] }>(
    `/repos/${fullName}/chat/history`,
  )
  return data.messages ?? []
}

// Wipes the persisted thread for a repo (used by "Reset Chat").
export async function resetChatHistory(fullName: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/repos/${fullName}/chat`, { method: "DELETE" })
}

// Distinct indexed file paths for a repo — feeds the file-scoped chat picker.
export async function fetchIndexedFiles(fullName: string): Promise<string[]> {
  const data = await apiFetch<{ files: string[] }>(`/repos/${fullName}/files`)
  return data.files ?? []
}

export interface EngineStatus {
  provider: "openrouter" | "gemini"
  chatModel: string
  embeddingModel: string
}

// The AI engine the server is actually using (read-only, resolved from env).
export async function fetchEngineStatus(): Promise<EngineStatus> {
  const data = await apiFetch<{ engine: EngineStatus }>("/settings/engine")
  return data.engine
}

// Wipes the current user's chat history across every repository.
export async function resetAllChatHistory(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/settings/chat-history", { method: "DELETE" })
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    let code: string | undefined
    try {
      const body = (await response.json()) as { code?: string }
      code = body.code
    } catch {
      // Error body is not JSON — leave code undefined.
    }
    throw new ApiError(
      `API request to ${path} failed with status ${response.status}`,
      response.status,
      code,
    )
  }

  return response.json() as Promise<T>
}