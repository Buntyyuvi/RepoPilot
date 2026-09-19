import { useEffect, useMemo, useRef, useState } from "react"
import {
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Loader2,
  FolderGit2,
  ChevronDown,
  Zap,
  Search,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  apiFetch,
  ApiError,
  askRepoQuestion,
  fetchChatHistory,
  fetchEngineStatus,
  fetchIndexedFiles,
  getIndexStatus,
  startIndexing,
  resetChatHistory,
  type ChatSource,
  type Repo,
} from "@/lib/api"
import { FileTreeNode } from "@/components/FileTree"
import { buildTreeFromPaths, fileIconFor } from "@/lib/fileTree"
import { cn } from "@/lib/utils"

interface ChatViewProps {
  onAuthExpired?: (error?: unknown) => void
  initialRepoFullName?: string | null
}

interface ChatMessage {
  id: string
  sender: "user" | "ai"
  text: string
  sources?: ChatSource[]
  scope?: string | null
}

type IndexState = "idle" | "running" | "done"

// If a job has been "running" with zero files processed for this long, the
// worker process is probably not online — surface that instead of a spinner.
const INDEX_STALE_MS = 30_000

function greeting(fullName: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sender: "ai",
    text: `Hi! Ask me anything about **${fullName}** and I'll ground my answer in the actual code. If the repo isn't indexed yet, click "Index now" first.`,
  }
}

export function ChatView({ onAuthExpired, initialRepoFullName }: ChatViewProps) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [selectedFullName, setSelectedFullName] = useState<string | null>(null)
  const [indexedChunks, setIndexedChunks] = useState<number | null>(null)
  const [indexState, setIndexState] = useState<IndexState>("idle")
  const [progress, setProgress] = useState(0)
  const [indexError, setIndexError] = useState<string | null>(null)
  const [indexStale, setIndexStale] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [indexedFiles, setIndexedFiles] = useState<string[] | null>(null)
  const [scopePath, setScopePath] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState("")
  const [pickerCollapsed, setPickerCollapsed] = useState<Set<string>>(new Set())

  const onAuthExpiredRef = useRef(onAuthExpired)
  useEffect(() => {
    onAuthExpiredRef.current = onAuthExpired
  }, [onAuthExpired])

  // Monotonic counter so a slow history fetch for a previously-selected repo
  // cannot overwrite the messages of the currently-selected one.
  const historyRequestId = useRef(0)

  // The server's active AI provider, used for the header label. Loaded once.
  const [engineProvider, setEngineProvider] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const engine = await fetchEngineStatus()
        if (!cancelled) setEngineProvider(engine.provider)
      } catch {
        // Non-fatal — the label falls back to a neutral value.
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const loadHistory = async (fullName: string) => {
    const requestId = ++historyRequestId.current
    try {
      const history = await fetchChatHistory(fullName)
      if (historyRequestId.current !== requestId) return
      if (history.length === 0) {
        setMessages([greeting(fullName)])
        return
      }
      setMessages(
        history.map((m) => ({
          id: m.id,
          sender: m.role,
          text: m.content,
          scope: m.scopePath,
          sources: m.sources?.length ? m.sources : undefined,
        })),
      )
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpiredRef.current?.(error)
        return
      }
      if (historyRequestId.current !== requestId) return
      setMessages([greeting(fullName)])
    }
  }

  const loadStatus = async (fullName: string) => {
    try {
      const status = await getIndexStatus(fullName)
      setIndexedChunks(status.indexedChunks)
      if (status.job?.status === "running") {
        setIndexState("running")
        setProgress(
          status.job.total > 0
            ? Math.min(100, Math.round((status.job.processed / status.job.total) * 100))
            : 0,
        )
      } else if (status.job?.status === "error") {
        setIndexError(status.job.error || "Indexing failed.")
        setIndexState("idle")
      } else {
        setIndexState(status.indexedChunks > 0 ? "done" : "idle")
      }
      if (status.job?.status !== "running") setIndexStale(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpiredRef.current?.(error)
        return
      }
      setIndexError("Failed to load indexing status.")
    }
  }

  // Load the user's repos and default to the first one (unless a specific
  // repo was requested from a repository card).
  useEffect(() => {
    let cancelled = false
    const target = initialRepoFullName ?? null

    const load = async () => {
      try {
        const data = await apiFetch<{ repos: Repo[] }>("/repos")
        if (cancelled) return
        setRepos(data.repos ?? [])
        const first = data.repos?.[0]
        if (!target && first) {
          setSelectedFullName(first.fullName)
          setMessages([])
          void loadHistory(first.fullName)
          void loadStatus(first.fullName)
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          onAuthExpiredRef.current?.()
          return
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Open the chat for a repo chosen from a repository card.
  useEffect(() => {
    if (!initialRepoFullName || initialRepoFullName === selectedFullName) return
    setSelectedFullName(initialRepoFullName)
    setIndexedChunks(null)
    setIndexState("idle")
    setProgress(0)
    setIndexError(null)
    setIndexStale(false)
    setMessages([])
    void loadHistory(initialRepoFullName)
    void loadStatus(initialRepoFullName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRepoFullName])

  // Poll indexing progress while a job is running.
  useEffect(() => {
    if (indexState !== "running" || !selectedFullName) return

    let cancelled = false
    const pollStartedAt = Date.now()
    const tick = async () => {
      try {
        const status = await getIndexStatus(selectedFullName)
        if (cancelled) return
        if (status.job) {
          setProgress(
            status.job.total > 0
              ? Math.min(100, Math.round((status.job.processed / status.job.total) * 100))
              : 0,
          )
          if (status.job.status === "error") {
            setIndexError(status.job.error || "Indexing failed.")
            setIndexState("idle")
            return
          }
          if (status.job.status === "done") {
            setIndexState("done")
            setIndexedChunks(status.indexedChunks)
            return
          }
          // A job stuck with zero processed files usually means the worker
          // process is not online.
          setIndexStale(
            Date.now() - pollStartedAt > INDEX_STALE_MS &&
              status.job.total === 0 &&
              status.job.processed === 0,
          )
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          onAuthExpiredRef.current?.(error)
          return
        }
        if (cancelled) return
        setIndexError("Failed to check indexing progress.")
        setIndexState("idle")
      }
    }

    void tick()
    const interval = setInterval(() => void tick(), 1200)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [indexState, selectedFullName])

  const handleSelectRepo = (fullName: string) => {
    if (fullName === selectedFullName) return
    setSelectedFullName(fullName)
    setIndexedChunks(null)
    setIndexState("idle")
    setProgress(0)
    setIndexError(null)
    setIndexStale(false)
    setMessages([])
    void loadHistory(fullName)
    void loadStatus(fullName)
  }

  // Load the indexed file list so questions can be scoped to a single file.
  useEffect(() => {
    if (!selectedFullName || (indexedChunks ?? 0) === 0) {
      setIndexedFiles(null)
      setScopePath(null)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const files = await fetchIndexedFiles(selectedFullName)
        if (!cancelled) setIndexedFiles(files)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          onAuthExpiredRef.current?.(error)
        }
      }
    }
    void load()

    return () => {
      cancelled = true
    }
  }, [selectedFullName, indexedChunks])

  const handleIndexNow = async () => {
    if (!selectedFullName) return
    setIndexError(null)
    setProgress(0)
    setIndexStale(false)
    try {
      await startIndexing(selectedFullName)
      setIndexState("running")
      void loadStatus(selectedFullName)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpiredRef.current?.(error)
        return
      }
      setIndexError("Failed to start indexing. Please try again.")
      setIndexState("idle")
    }
  }

  const handleSend = async (textToSend?: string) => {
    if (!selectedFullName || isTyping) return
    const query = (textToSend ?? input).trim()
    if (!query) return

    if (!textToSend) setInput("")
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: "user", text: query, scope: scopePath },
    ])
    setIsTyping(true)

    try {
      const result = await askRepoQuestion(
        selectedFullName,
        query,
        scopePath ?? undefined,
      )
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "ai",
          text: result.answer,
          sources: result.sources,
        },
      ])
    } catch (error) {
      let text = "Something went wrong while answering. Please try again."
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpiredRef.current?.(error)
        return
      }
      if (error instanceof ApiError && error.status === 409) {
        text =
          "This repository hasn't been indexed yet. Click \"Index now\" above to make it searchable, then ask again."
      } else if (error instanceof ApiError && error.status === 429) {
        text = "AI rate limit reached. Please wait a moment and try again."
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), sender: "ai", text },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleResetChat = async () => {
    if (!selectedFullName) return
    try {
      await resetChatHistory(selectedFullName)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpiredRef.current?.(error)
        return
      }
    }
    setMessages([greeting(selectedFullName)])
  }

  const copyText = (id: string, text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const showIndexCta = selectedFullName !== null && indexedChunks === 0 && indexState !== "running"
  const showIndexProgress = selectedFullName !== null && indexState === "running"
  const canScope = selectedFullName !== null && (indexedChunks ?? 0) > 0

  const pickerTree = useMemo(
    () => (indexedFiles ? buildTreeFromPaths(indexedFiles) : []),
    [indexedFiles],
  )
  const pickerMatches = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return null
    return indexedFiles?.filter((f) => f.toLowerCase().includes(q)) ?? null
  }, [indexedFiles, pickerQuery])

  const togglePickerDir = (path: string) => {
    setPickerCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const selectScope = (path: string | null) => {
    setScopePath(path)
    setPickerOpen(false)
    setPickerQuery("")
  }

  return (
    <div className="h-full min-h-0 w-full max-w-350 mx-auto flex flex-col gap-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-md">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-base">RepoMind Code AI Chat</h2>
<p className="text-xs text-gray-500">
                  {selectedFullName
                    ? `${indexedChunks ?? 0} chunks indexed · ${
                        engineProvider === "openrouter"
                          ? "OpenRouter"
                          : engineProvider === "gemini"
                            ? "Gemini"
                            : "AI"
                      }`
                    : "Pick a repository to begin"}
                </p>
          </div>
        </div>

        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <FolderGit2 className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedFullName ?? ""}
              onChange={(e) => handleSelectRepo(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-xl pl-8 pr-8 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 cursor-pointer w-full sm:w-60"
            >
              {repos.length === 0 && <option value="">No repositories</option>}
              {repos.map((repo) => (
                <option key={repo.id} value={repo.fullName}>
                  {repo.fullName}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleResetChat()}
            className="rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset Chat
          </Button>
        </div>
      </div>

      {/* Index banner */}
      {(showIndexCta || showIndexProgress) && (
        <div className="shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
          {showIndexProgress ? (
            <>
              <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Indexing {selectedFullName}…
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-amber-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {indexStale && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/70 bg-white/60 px-2.5 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed text-amber-800">
                    <span className="font-semibold">Indexing is stuck</span> — the worker process
                    may be offline. Start it with{" "}
                    <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[10.5px]">
                      cd Backend &amp;&amp; npm run dev:worker
                    </code>
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-amber-900 font-medium flex-1">
                This repository isn't indexed yet. Index it so answers are grounded in the
                actual code.
              </p>
              <Button
                size="sm"
                onClick={handleIndexNow}
                className="rounded-lg bg-black hover:bg-gray-900 text-white text-xs h-8 font-semibold shrink-0"
              >
                <Zap className="w-3.5 h-3.5 mr-1" /> Index now
              </Button>
            </div>
          )}
          {indexError && <p className="text-xs text-red-600 font-medium">{indexError}</p>}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain pr-1 sm:pr-3">
        <div className="mx-auto w-full max-w-5xl space-y-5 pb-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.sender === "ai" && (
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div
              className={`relative p-4 rounded-2xl max-w-[min(90%,52rem)] text-sm leading-relaxed ${
                msg.sender === "user"
                  ? "bg-black text-white rounded-br-none shadow-md"
                  : "bg-white border border-gray-200/80 text-gray-800 rounded-bl-none shadow-xs"
              }`}
            >
              <div
                className={cn(
                  "whitespace-pre-wrap font-sans",
                  msg.sender === "ai" && "pr-10"
                )}
              >
                {msg.text}
              </div>

              {msg.sender === "ai" && (
                <button
                  onClick={() => copyText(msg.id, msg.text)}
                  title={copiedId === msg.id ? "Copied" : "Copy response"}
                  aria-label="Copy response"
                  className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {copiedId === msg.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-medium text-xs">Copied</span>
                    </>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              {msg.scope && msg.sender === "user" && (
                <div className="mt-2 flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-white/60" />
                  <span className="text-[10px] font-medium text-white/70 truncate">
                    scoped to {msg.scope}
                  </span>
                </div>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-0.5">
                    Sources
                  </span>
                  {msg.sources.map((source) => (
                    <span
                      key={`${source.filePath}#${source.chunkIndex}`}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium max-w-55 truncate"
                      title={source.filePath}
                    >
                      {source.filePath}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {msg.sender === "user" && (
              <div className="w-8 h-8 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            <span>RepoMind is grounding an answer in the repository…</span>
          </div>
        )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 w-full max-w-5xl mx-auto space-y-3">
        {/* Scope picker */}
        {canScope && (
          <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Asking about
            </span>
            {scopePath ? (
              <button
                onClick={() => selectScope(null)}
                title="Remove file scope"
                className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full bg-gray-900 text-white text-[11px] font-semibold group"
              >
                <FileText className="w-3 h-3 shrink-0" />
                <span className="truncate">{scopePath}</span>
                <X className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100" />
              </button>
            ) : (
              <button
                onClick={() => setPickerOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-[11px] font-semibold transition-colors"
              >
                <FolderGit2 className="w-3 h-3" />
                Whole repository
                <ChevronDown
                  className={cn("w-3 h-3 transition-transform", pickerOpen && "rotate-180")}
                />
              </button>
            )}
          </div>

            {pickerOpen && (
              <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
              <div className="relative px-3 pt-2.5">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-4.5 top-5 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Find a file…"
                  className="w-full pl-7 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
                />
              </div>
                <div className="max-h-[min(18rem,35vh)] overflow-y-auto p-1.5">
                {pickerMatches !== null ? (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => selectScope(null)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <FolderGit2 className="w-4 h-4 text-gray-400 shrink-0" />
                      Whole repository
                    </button>
                    {pickerMatches.map((path) => {
                      const { Icon, className: iconColor } = fileIconFor(path)
                      return (
                        <button
                          key={path}
                          onClick={() => selectScope(path)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 transition-colors min-w-0"
                        >
                          <Icon className={cn("w-4 h-4 shrink-0", iconColor)} />
                          <span className="truncate">{path}</span>
                        </button>
                      )
                    })}
                    {pickerMatches.length === 0 && (
                      <p className="text-xs text-gray-400 font-medium px-2 py-6 text-center">
                        No indexed files match "{pickerQuery.trim()}"
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => selectScope(null)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <FolderGit2 className="w-4 h-4 text-gray-400 shrink-0" />
                      Whole repository
                    </button>
                    {pickerTree.map((entry) => (
                      <FileTreeNode
                        key={entry.path}
                        entry={entry}
                        depth={0}
                        collapsed={pickerCollapsed}
                        selectedPath={scopePath}
                        onToggleDir={togglePickerDir}
                        onSelectFile={selectScope}
                      />
                    ))}
                  </div>
                )}
                </div>
              </div>
          )}
          </div>
        )}

        {/* Input Box */}
        <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={
            selectedFullName
              ? `Ask anything about ${selectedFullName}...`
              : "Loading repositories..."
          }
          disabled={!selectedFullName}
          className="w-full pl-4 pr-12 py-3.5 bg-white border border-gray-300 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black shadow-sm transition-all disabled:opacity-60"
        />
        <Button
          onClick={() => handleSend()}
          size="icon"
          disabled={!selectedFullName}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-black hover:bg-gray-900 text-white w-9 h-9 disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
        </Button>
        </div>
      </div>
    </div>
  )
}

export default ChatView