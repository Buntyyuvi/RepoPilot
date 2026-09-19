import { useEffect, useRef, useState } from "react"
import {
  GitFork,
  MessageSquareText,
  Sparkles,
  FileCode2,
  Cpu,
  ArrowUpRight,
  Zap,
  FolderGit2,
  Loader2,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatStars, formatUpdatedAt } from "@/lib/format"
import { ApiError, fetchConnectedRepos, getIndexStatus, type Repo } from "@/lib/api"

interface DashboardViewProps {
  onNavigate: (tab: any) => void
  onOpenRepo: (fullName: string, defaultBranch?: string) => void
  onAuthExpired?: (error?: unknown) => void
}

export function DashboardView({ onNavigate, onOpenRepo, onAuthExpired }: DashboardViewProps) {
  const [connectedRepos, setConnectedRepos] = useState<Repo[]>([])
  const [isLoadingConnected, setIsLoadingConnected] = useState(true)
  const [indexChunks, setIndexChunks] = useState<Record<string, number>>({})

  const onAuthExpiredRef = useRef(onAuthExpired)
  useEffect(() => {
    onAuthExpiredRef.current = onAuthExpired
  }, [onAuthExpired])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const repos = await fetchConnectedRepos()
        if (cancelled) return
        setConnectedRepos(repos)

        // Fetch the real indexing status for each connected repo (one shot, no polling).
        const statuses = await Promise.all(
          repos.map(async (repo) => {
            try {
              const status = await getIndexStatus(repo.fullName)
              return [repo.fullName, status.indexedChunks] as const
            } catch (error) {
              if (error instanceof ApiError && error.status === 401) {
                onAuthExpiredRef.current?.(error)
              }
              return [repo.fullName, 0] as const
            }
          })
        )
        if (cancelled) return
        setIndexChunks(Object.fromEntries(statuses))
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

  const modeStatsLoading = isLoadingConnected
  const totalChunks = Object.values(indexChunks).reduce((sum, n) => sum + n, 0)

  const stats = [
    {
      title: "Indexed Repos",
      value: isLoadingConnected ? "…" : String(connectedRepos.length),
      change: "Connected to your workspace",
      icon: FolderGit2,
      color: "text-blue-600",
    },
    {
      title: "Codebase Vectors",
      value: modeStatsLoading ? "…" : totalChunks.toLocaleString(),
      change: "Across indexed repos",
      icon: Cpu,
      color: "text-purple-600",
    },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Welcome Banner */}
      <div className="dashboard-hero bg-gradient-to-r from-gray-900 via-black to-gray-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-emerald-300 border border-white/10 backdrop-blur-md">
            <Zap className="w-3.5 h-3.5" />
            <span>AI Code Assistant Ready</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Understand any codebase instantly
          </h1>
          <p className="text-gray-300 text-sm leading-relaxed">
            Search functions, visualize complex dependency graphs, and refactor code across all your GitHub repositories with zero setup.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Button
              onClick={() => onNavigate("chat")}
              className="bg-white text-black hover:bg-gray-100 font-semibold rounded-xl"
            >
              <MessageSquareText className="w-4 h-4 mr-2" />
              Ask AI About Code
            </Button>
            <Button
              onClick={() => onNavigate("repositories")}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 font-semibold rounded-xl bg-transparent"
            >
              <GitFork className="w-4 h-4 mr-2" />
              Explore Dependency Map
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {stat.title}
                  </span>
                  <div className="p-2 rounded-xl bg-gray-100">
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 font-medium mt-2">
                  {stat.change}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Grid: Recent Repos + Feature Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Active Repositories */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Active Repositories</CardTitle>
                <CardDescription>Repositories analyzed with deep semantic AST indexing</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("repositories")}
                className="rounded-lg"
              >
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingConnected ? (
                <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-xs font-medium">Loading active repositories…</p>
                </div>
              ) : connectedRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500 gap-3">
                  <FolderGit2 className="w-6 h-6 text-gray-300" />
                  <p className="text-xs font-medium text-gray-500">
                    No repositories connected yet — connect one to get started.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => onNavigate("upload")}
                    className="rounded-lg text-xs"
                  >
                    Connect a Repository
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {connectedRepos.map((repo) => {
                    const chunks = indexChunks[repo.fullName]
                    const isIndexed = (chunks ?? 0) > 0
                    return (
                      <div
                        key={repo.fullName}
                        className="py-4 flex items-center justify-between hover:bg-gray-50/60 rounded-xl px-3 transition-colors cursor-pointer"
                        onClick={() => onOpenRepo(repo.fullName, repo.defaultBranch)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-xl bg-gray-100 text-gray-800">
                            <FileCode2 className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                              <span className="truncate">{repo.fullName}</span>
                              {repo.language && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium shrink-0">
                                  {repo.language}
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {repo.stargazersCount > 0 &&
                                <>⭐ {formatStars(repo.stargazersCount)} stars • </>}
                              Synced {formatUpdatedAt(repo.updatedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={
                              isIndexed
                                ? "text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200/60"
                            }
                          >
                            {chunks === undefined ? "Checking…" : isIndexed ? "Indexed" : "Not indexed"}
                          </span>
                          <ArrowUpRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Quick Tools */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Quick AI Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => onNavigate("chat")}
                className="w-full text-left p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-gray-900">Explain Architecture</div>
                  <div className="text-[11px] text-gray-500">Generate visual component tree</div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate("chat")}
                className="w-full text-left p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-gray-900">Security & Dead Code Audit</div>
                  <div className="text-[11px] text-gray-500">Scan for unused exports & vulnerabilities</div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate("upload")}
                className="w-full text-left p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-gray-900">Import GitHub Repo</div>
                  <div className="text-[11px] text-gray-500">Connect private or public repository</div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}