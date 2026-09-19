import { useEffect, useRef, useState } from "react"
import {
  FolderGit2,
  Globe,
  Lock,
  Star,
  Settings,
  Plus,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  Clock,
  ChevronRight,
  X,
  Star as StarIcon,
  Loader2,
  GitFork,
  MessageSquare
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { apiFetch, ApiError, connectRepo, type Repo } from "@/lib/api"

interface RepositoriesViewProps {
  onSelectRepo: (repoName: string, defaultBranch?: string) => void
  onNavigateSettings?: () => void
  onAuthExpired?: (error?: unknown) => void
  onChatRepo?: (fullName: string) => void
  searchQuery?: string
}

type FilterKey = "all" | "public" | "private" | "starred"

function formatUpdatedAt(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function formatStars(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return String(count)
}

export function RepositoriesView({
  onSelectRepo,
  onNavigateSettings,
  onAuthExpired,
  onChatRepo,
  searchQuery = "",
}: RepositoriesViewProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [repoUrlInput, setRepoUrlInput] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const [repos, setRepos] = useState<Repo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set())
  const [reloadKey, setReloadKey] = useState(0)

  // Keep the latest callback in a ref so an inline prop doesn't re-trigger loads.
  const onAuthExpiredRef = useRef(onAuthExpired)
  useEffect(() => {
    onAuthExpiredRef.current = onAuthExpired
  }, [onAuthExpired])

  useEffect(() => {
    let cancelled = false

    const loadRepos = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const data = await apiFetch<{ repos: Repo[] }>("/repos")
        if (cancelled) return
        setRepos(data.repos ?? [])
      } catch (error) {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          // Session or GitHub token expired.
          onAuthExpiredRef.current?.(error)
          return
        }
        setLoadError("Failed to load repositories. Please try again.")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadRepos()

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const toggleStar = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const openAddModal = () => {
    setIsAddModalOpen(true)
    setImportError(null)
  }

  const handleImport = async () => {
    const url = repoUrlInput.trim()
    if (!url) {
      setImportError("Paste a GitHub repository URL.")
      return
    }

    setIsImporting(true)
    setImportError(null)
    try {
      await connectRepo(url)
      setRepoUrlInput("")
      setIsAddModalOpen(false)
      setReloadKey((k) => k + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpiredRef.current?.(error)
        return
      }
      if (error instanceof ApiError && error.status === 400) {
        setImportError("That doesn't look like a valid GitHub repository URL.")
      } else if (error instanceof ApiError && error.status === 404) {
        setImportError("Repository not found or not accessible. Check the URL and try again.")
      } else {
        setImportError("Failed to import the repository. Please try again.")
      }
    } finally {
      setIsImporting(false)
    }
  }

  // Filter repositories based on sub-sidebar filter and search
  const filteredRepos = repos.filter((repo) => {
    if (activeFilter === "public" && repo.private) return false
    if (activeFilter === "private" && !repo.private) return false
    if (activeFilter === "starred" && !starredIds.has(repo.id)) return false

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesName = repo.name.toLowerCase().includes(q)
      const matchesDesc = (repo.description ?? "").toLowerCase().includes(q)
      const matchesLang = (repo.language ?? "").toLowerCase().includes(q)
      const matchesFullName = repo.fullName.toLowerCase().includes(q)
      if (!matchesName && !matchesDesc && !matchesLang && !matchesFullName) {
        return false
      }
    }

    return true
  })

  const publicCount = repos.filter((r) => !r.private).length

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full animate-in fade-in duration-300">
      {/* Left Sub-Sidebar (Repositories Navigation & Storage Widget) */}
      <div className="w-full lg:w-56 shrink-0 space-y-8">
        {/* Section 1: REPOSITORIES */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold text-gray-400 tracking-wider uppercase px-2">
            Repositories
          </h4>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveFilter("all")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors",
                activeFilter === "all"
                  ? "bg-gray-100/90 text-gray-900"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-2.5">
                <FolderGit2 className="w-4 h-4 text-gray-500" />
                <span>All Repos</span>
              </div>
              <span className="text-[11px] text-gray-400 font-medium">{repos.length}</span>
            </button>

            <button
              onClick={() => setActiveFilter("public")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                activeFilter === "public"
                  ? "bg-gray-100/90 text-gray-900 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Globe className="w-4 h-4 text-gray-500" />
              <span>Public</span>
            </button>

            <button
              onClick={() => setActiveFilter("private")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                activeFilter === "private"
                  ? "bg-gray-100/90 text-gray-900 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Lock className="w-4 h-4 text-gray-500" />
              <span>Private</span>
            </button>

            <button
              onClick={() => setActiveFilter("starred")}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                activeFilter === "starred"
                  ? "bg-gray-100/90 text-gray-900 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Star className="w-4 h-4 text-gray-500" />
              <span>Starred</span>
              <span className="ml-auto text-[11px] text-gray-400 font-medium">{starredIds.size}</span>
            </button>
          </nav>
        </div>

        {/* Section 2: WORKSPACE */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold text-gray-400 tracking-wider uppercase px-2">
            Workspace
          </h4>
          <nav className="space-y-1">
            <button
              onClick={onNavigateSettings}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4 text-gray-500" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Bottom Storage Usage Widget */}
        <div className="p-4 bg-gray-50/90 border border-gray-200/70 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-gray-900">
            <span>Repositories</span>
            <span className="text-gray-500 font-normal">{repos.length}</span>
          </div>
          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-black h-1.5 rounded-full w-[68%]" />
          </div>
          <p className="text-[11px] text-gray-500">
            {publicCount} public · {repos.length - publicCount} private
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <span>Workspace</span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-900 font-semibold">Repositories</span>
        </div>

        {/* Title Header & Add Repository Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Your repositories
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-normal mt-0.5">
              Connect, index, and search your team's codebase.
            </p>
          </div>

          <Button
            onClick={openAddModal}
            className="bg-black hover:bg-gray-900 text-white rounded-xl h-11 px-5 font-semibold text-xs shadow-md shrink-0 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Repository via URL</span>
          </Button>
        </div>

        {/* Filter Controls Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200/80 text-xs font-bold text-gray-700 flex items-center justify-center">
              {filteredRepos.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-gray-200 text-xs text-gray-700 h-9 font-medium"
            >
              <Filter className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              Filter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-gray-200 text-xs text-gray-700 h-9 font-medium"
            >
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              Recently updated
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <p className="text-sm font-medium">Loading your repositories...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && loadError && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <GitFork className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-red-600">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-gray-200 text-xs text-gray-700 h-9 font-medium"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !loadError && filteredRepos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
              <FolderGit2 className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">
              {searchQuery || activeFilter !== "all"
                ? "No repositories match your current filters."
                : "No repositories found."}
            </p>
          </div>
        )}

        {/* 2-Column Repository Cards Grid */}
        {!isLoading && !loadError && filteredRepos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredRepos.map((repo) => (
              <Card
                key={repo.id}
                onClick={() => onSelectRepo(repo.fullName, repo.defaultBranch)}
                className="bg-white/95 border border-gray-200/80 hover:border-gray-300 rounded-2xl shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between"
              >
                <CardContent className="p-6 space-y-4">
                  {/* Top Row: Icon + Name + Dots */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200/60 flex items-center justify-center text-gray-800 shrink-0">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4"
                        >
                          <circle cx="18" cy="6" r="2.5" />
                          <circle cx="6" cy="18" r="2.5" />
                          <circle cx="12" cy="12" r="2" />
                          <path d="M6 15.5V8a2 2 0 0 1 2-2h7.5" />
                          <path d="M12 10v.5" />
                          <path d="M10 14l2-2 4 4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-base group-hover:text-black tracking-tight truncate">
                          {repo.name}
                        </h3>
                        <p className="text-[11px] text-gray-400 font-medium truncate">
                          {repo.fullName}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-gray-600 font-normal leading-relaxed min-h-[36px]">
                    {repo.description || "No description available."}
                  </p>

                  {/* Metadata: Language + Updated */}
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-1 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-black inline-block" />
                      {repo.language || "Unknown"}
                    </span>
                    <span className="flex items-center gap-1 text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      Updated {formatUpdatedAt(repo.updatedAt)}
                    </span>
                  </div>

                  {/* Status Badge & Star Favorite Toggle */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[11px] font-semibold px-3 py-1 rounded-full text-white inline-block bg-black"
                        )}
                      >
                        {repo.private ? "Private" : "Public"}
                      </span>
                      {repo.stargazersCount > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
                          <StarIcon className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          {formatStars(repo.stargazersCount)}
                        </span>
                      )}
                    </div>

                    {/* Actions: Chat + Star Favorite Toggle */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onChatRepo?.(repo.fullName)
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-black hover:text-white text-xs font-semibold text-gray-700 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Chat
                      </button>
                      <button
                        onClick={(e) => toggleStar(repo.id, e)}
                        className="p-1.5 text-gray-400 hover:text-amber-400 transition-colors"
                      >
                        <Star
                          className={cn(
                            "w-4 h-4",
                            starredIds.has(repo.id) ? "text-amber-400 fill-amber-400" : ""
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Repository Modal */}
      {isAddModalOpen && (
        <div className="overlay-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">Add Repository</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-900">Repository URL</label>
                <input 
                  type="text" 
                  value={repoUrlInput}
                  onChange={(e) => setRepoUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleImport()}
                  placeholder="https://github.com/username/repo" 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                />
                <p className="text-xs text-gray-500">Enter a public or authorized private repository URL.</p>
                {importError && (
                  <p className="text-xs font-medium text-red-600">{importError}</p>
                )}
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="rounded-xl h-10 border-gray-200 font-semibold"
                  disabled={isImporting}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={isImporting}
                  className="bg-black hover:bg-gray-900 text-white rounded-xl h-10 shadow-sm font-semibold px-5"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    "Import Repository"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}