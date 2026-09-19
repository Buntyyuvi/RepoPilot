import { useEffect, useRef, useState } from "react"
import {
  Upload,
  FolderGit2,
  ArrowRight,
  GitBranch,
  Loader2,
  Check,
  Star,
  Clock,
  Trash2,
  AlertTriangle,
  MessageSquare,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatStars, formatUpdatedAt } from "@/lib/format"
import {
  ApiError,
  connectRepo,
  fetchConnectedRepos,
  getIndexStatus,
  removeConnectedRepo,
  startIndexing,
  type Repo,
} from "@/lib/api"

interface UploadViewProps {
  onOpenRepo?: (fullName: string, defaultBranch?: string) => void
  onAuthExpired?: (error?: unknown) => void
  onChatRepo?: (fullName: string) => void
}

interface RepoIndexState {
  status: "idle" | "running" | "done"
  progress: number
  chunks: number
  stale?: boolean
}

// If a job has been "running" with zero files processed for this long, the
// worker process is probably not online — surface that instead of a spinner.
const INDEX_STALE_MS = 30_000

export function UploadView({ onOpenRepo, onAuthExpired, onChatRepo }: UploadViewProps) {
  const [repoUrl, setRepoUrl] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const [connectedRepos, setConnectedRepos] = useState<Repo[]>([])
  const [isLoadingConnected, setIsLoadingConnected] = useState(true)
  const [indexState, setIndexState] = useState<Record<string, RepoIndexState>>({})

  const onAuthExpiredRef = useRef(onAuthExpired)
  useEffect(() => {
    onAuthExpiredRef.current = onAuthExpired
  }, [onAuthExpired])

  // Load previously persisted connections so the section survives a refresh.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const repos = await fetchConnectedRepos()
        if (!cancelled) setConnectedRepos(repos)
      } catch (error) {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          onAuthExpiredRef.current?.(error)
          return
        }
      } finally {
        if (!cancelled) setIsLoadingConnected(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleConnect = async () => {
    const url = repoUrl.trim()
    if (!url) {
      setConnectError("Paste a GitHub repository URL first.")
      return
    }

    setIsConnecting(true)
    setConnectError(null)
    try {
      const repo = await connectRepo(url)
      setConnectedRepos((prev) => {
        const exists = prev.some((r) => r.fullName === repo.fullName)
        return exists
          ? prev.map((r) => (r.fullName === repo.fullName ? repo : r))
          : [repo, ...prev]
      })
      setRepoUrl("")
      handleIndex(repo.fullName, repo.defaultBranch)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpiredRef.current?.(error)
        return
      }
      if (error instanceof ApiError && error.status === 400) {
        setConnectError("That doesn't look like a valid GitHub repository URL.")
      } else if (error instanceof ApiError && error.status === 404) {
        setConnectError("Repository not found or not accessible. Check the URL and try again.")
      } else {
        setConnectError("Failed to connect the repository. Please try again.")
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const handleIndex = async (fullName: string, branch: string) => {
    if (indexState[fullName]?.status === "running") return
    setIndexState((prev) => ({
      ...prev,
      [fullName]: { status: "running", progress: 0, chunks: 0 },
    }))

    try {
      await startIndexing(fullName, branch)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpiredRef.current?.(error)
        return
      }
      setIndexState((prev) => ({
        ...prev,
        [fullName]: { status: "idle", progress: 0, chunks: 0 },
      }))
      return
    }

    let cancelled = false
    const pollStartedAt = Date.now()
    const poll = async () => {
      while (!cancelled) {
        try {
          const status = await getIndexStatus(fullName)
          if (cancelled) return
          if (status.job?.status === "error") {
            setIndexState((prev) => ({
              ...prev,
              [fullName]: { status: "idle", progress: 0, chunks: 0 },
            }))
            return
          }
          const progress =
            status.job && status.job.total > 0
              ? Math.min(100, Math.round((status.job.processed / status.job.total) * 100))
              : 0
          if (status.job?.status === "done") {
            setIndexState((prev) => ({
              ...prev,
              [fullName]: { status: "done", progress: 100, chunks: status.indexedChunks },
            }))
            return
          }
          // A job that has been waiting/running with zero processed files for a
          // while usually means the worker process is not online.
          const stale =
            Date.now() - pollStartedAt > INDEX_STALE_MS &&
            (!status.job || (status.job.total === 0 && status.job.processed === 0))
          setIndexState((prev) => ({
            ...prev,
            [fullName]: {
              status: "running",
              progress,
              chunks: status.indexedChunks,
              stale,
            },
          }))
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            onAuthExpiredRef.current?.(error)
            return
          }
          if (!cancelled) {
            setIndexState((prev) => ({
              ...prev,
              [fullName]: { status: "idle", progress: 0, chunks: 0 },
            }))
          }
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 1200))
      }
    }

    void poll()
  }

  const handleRemove = async (fullName: string) => {
    try {
      await removeConnectedRepo(fullName)
      setConnectedRepos((prev) => prev.filter((r) => r.fullName !== fullName))
      setIndexState((prev) => {
        const next = { ...prev }
        delete next[fullName]
        return next
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpiredRef.current?.(error)
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Upload & Connect Project
        </h1>
        <p className="text-sm text-gray-500">
          Index a GitHub repository or drop a local project zip folder
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-gray-900" />
            Option 1: Connect GitHub Repository
          </CardTitle>
          <CardDescription>
            Enter any public or authorized private repository URL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              placeholder="e.g. https://github.com/facebook/react"
              className="min-w-0 flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
            />
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !repoUrl.trim()}
              className="bg-black hover:bg-gray-900 text-white rounded-xl shrink-0"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting
                </>
              ) : (
                <>
                  Connect <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>

          {connectError && (
            <p className="text-xs font-medium text-red-600">{connectError}</p>
          )}
          <p className="text-xs text-gray-400">
            Indexing starts automatically after connecting — you can chat with the repo once it's done.
          </p>
        </CardContent>
      </Card>

      {/* Connected Repositories — shows the repos fetched from pasted URLs. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Connected Repositories</CardTitle>
            <CardDescription>
              Repos you've connected via the URL above
            </CardDescription>
          </div>
          {connectedRepos.length > 0 && (
            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full shrink-0">
              {connectedRepos.length}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoadingConnected ? (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p className="text-xs font-medium">Loading connected repositories…</p>
            </div>
          ) : connectedRepos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500 gap-2">
              <FolderGit2 className="w-6 h-6 text-gray-300" />
              <p className="text-xs font-medium text-gray-500">
                No repositories connected yet — paste a URL above.
              </p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto pr-1 -mr-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              {connectedRepos.map((repo) => {
                const st = indexState[repo.fullName]
                return (
                  <Card
                    key={repo.fullName}
                    className="bg-white/95 border border-gray-200/80 rounded-2xl shadow-2xs hover:shadow-md transition-all duration-200"
                  >
                    <CardContent className="p-5 space-y-3">
                      {/* Top row: icon + name + remove */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200/60 flex items-center justify-center text-gray-800 shrink-0">
                            <FolderGit2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 text-sm truncate">
                              {repo.name}
                            </h3>
                            <p className="text-[11px] text-gray-400 font-medium truncate">
                              {repo.fullName}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(repo.fullName)}
                          title="Remove connection"
                          className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-gray-600 font-normal leading-relaxed min-h-[30px]">
                        {repo.description || "No description available."}
                      </p>

                      {/* Metadata: language + updated */}
                      <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-black inline-block" />
                          {repo.language || "Unknown"}
                        </span>
                        <span className="flex items-center gap-1 text-gray-400">
                          <Clock className="w-3.5 h-3.5" />
                          Updated {formatUpdatedAt(repo.updatedAt)}
                        </span>
                      </div>

                      {/* Footer: badges + actions */}
                      <div className="flex flex-wrap items-center justify-between pt-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white",
                              repo.private ? "bg-amber-500" : "bg-black"
                            )}
                          >
                            {repo.private ? "Private" : "Public"}
                          </span>
                          {repo.stargazersCount > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-500 font-medium shrink-0">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              {formatStars(repo.stargazersCount)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleIndex(repo.fullName, repo.defaultBranch)}
                            title={
                              st?.status === "done"
                                ? `Indexed · ${st.chunks} chunks`
                                : "Index this repository for AI chat"
                            }
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                              st?.status === "done"
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "bg-gray-100 hover:bg-black hover:text-white text-gray-700"
                            )}
                          >
                            {st?.status === "running" ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {st.progress}%
                              </>
                            ) : st?.status === "done" ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Indexed
                              </>
                            ) : (
                              <>
                                <GitBranch className="w-3.5 h-3.5" />
                                Index
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => onChatRepo?.(repo.fullName)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-black hover:text-white text-xs font-semibold text-gray-700 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Chat
                          </button>
                          <button
                            onClick={() => onOpenRepo?.(repo.fullName, repo.defaultBranch)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            Open
                          </button>
                        </div>
                      </div>
                      {st?.status === "running" && st?.stale && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <div className="text-xs leading-relaxed text-amber-800">
                            <p className="font-semibold">Indexing is stuck — the worker process may be offline.</p>
                            <p className="mt-0.5 text-amber-700">
                              Start it with{" "}
                              <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[11px]">
                                cd Backend &amp;&amp; npm run dev:worker
                              </code>
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-gray-900" />
            Option 2: Drag & Drop Zip / Folder
          </CardTitle>
          <CardDescription>
            Upload a local project directly from your computer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-200 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-50 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 shadow-2xs flex items-center justify-center text-gray-700">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Click to browse or drag codebase zip here
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supports .zip, .tar.gz (max 250MB)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}