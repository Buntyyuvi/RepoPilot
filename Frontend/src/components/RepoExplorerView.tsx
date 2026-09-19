import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  FileImage,
  Folder,
  FolderGit2,
  GitBranch,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  ApiError,
  fetchFileContent,
  fetchRepoTree,
  type FileContent,
  type TreeNode,
} from "@/lib/api"
import { FileTreeNode } from "@/components/FileTree"
import {
  buildTree,
  fileIconFor,
  formatBytes,
  getLanguage,
} from "@/lib/fileTree"

interface RepoExplorerViewProps {
  fullName: string
  defaultBranch?: string
  onBack: () => void
  onAuthExpired?: (error?: unknown) => void
}

export function RepoExplorerView({
  fullName,
  defaultBranch,
  onBack,
  onAuthExpired,
}: RepoExplorerViewProps) {
  const [branch, setBranch] = useState(defaultBranch ?? "main")
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<FileContent | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const onAuthExpiredRef = useRef(onAuthExpired)
  useEffect(() => {
    onAuthExpiredRef.current = onAuthExpired
  }, [onAuthExpired])

  useEffect(() => {
    let cancelled = false

    const loadTree = async () => {
      setTreeLoading(true)
      setTreeError(null)
      try {
        const data = await fetchRepoTree(fullName, branch)
        if (cancelled) return
        setNodes(data.tree ?? [])
        setBranch(data.branch ?? branch)
      } catch (error) {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          onAuthExpiredRef.current?.(error)
          return
        }
        setTreeError(
          "Failed to load the repository. Make sure you have access to it and try again."
        )
      } finally {
        if (!cancelled) setTreeLoading(false)
      }
    }

    void loadTree()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, reloadKey])

  useEffect(() => {
    if (!selectedPath) {
      setFileContent(null)
      setFileError(null)
      return
    }

    let cancelled = false
    const loadFile = async () => {
      setFileLoading(true)
      setFileError(null)
      try {
        const data = await fetchFileContent(fullName, selectedPath, branch)
        if (cancelled) return
        setFileContent(data.file)
      } catch (error) {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          onAuthExpiredRef.current?.(error)
          return
        }
        setFileError("Failed to load the file contents.")
      } finally {
        if (!cancelled) setFileLoading(false)
      }
    }

    void loadFile()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath, branch, fullName])

  // The backend returns either 404 (ref missing) or 422; when we are looking
  // at a repo whose default branch differs, the user still sees the tree.
  const tree = useMemo(() => buildTree(nodes), [nodes])
  const allDirPaths = useMemo(
    () => nodes.filter((n) => n.type === "tree").map((n) => n.path),
    [nodes]
  )

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return nodes.filter((n) => n.path.toLowerCase().includes(q))
  }, [nodes, searchQuery])

  const toggleDir = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => setCollapsed(new Set(allDirPaths))

  const selectFile = (path: string) => {
    setSelectedPath(path)
  }

  const copyContent = async () => {
    if (!fileContent) return
    try {
      await navigator.clipboard.writeText(fileContent.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — ignore.
    }
  }

  const isBinary = fileContent?.content.includes("\u0000") ?? false
  const fileLines = fileContent ? fileContent.content.split("\n") : []
  const githubBlobUrl = selectedPath
    ? `https://github.com/${fullName}/blob/${branch}/${selectedPath}`
    : null

  return (
    <div className="w-full animate-in fade-in duration-300 flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 font-medium min-w-0">
        <span>Workspace</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span>Repositories</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className="text-gray-900 font-semibold truncate min-w-0">{fullName}</span>
      </div>

      {/* Toolbar: back + repo identity + branch */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="rounded-xl border-gray-200 text-xs text-gray-600 h-9 font-semibold gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Repositories
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200/60 flex items-center justify-center text-gray-800 shrink-0">
            <FolderGit2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate leading-tight">
              {fullName}
            </h1>
            <p className="text-[11px] text-gray-400 font-medium">
              {nodes.length} items
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {treeLoading ? (
            <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-gray-100 text-xs font-medium text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
              <GitBranch className="w-3.5 h-3.5 text-gray-500" />
              {branch}
            </span>
          )}
        </div>
      </div>

      {/* Explorer panel */}
      <div className="bg-white/95 border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-300">
        {/* Tree toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a file or folder…"
              className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={expandAll}
              className="rounded-lg border-gray-200 text-[11px] text-gray-600 h-8 px-2.5 font-medium gap-1"
              title="Expand all folders"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Expand
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAll}
              className="rounded-lg border-gray-200 text-[11px] text-gray-600 h-8 px-2.5 font-medium gap-1"
              title="Collapse all folders"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Collapse
            </Button>
          </div>
        </div>

        {/* Split: tree + viewer */}
        <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-280px)] lg:min-h-[480px]">
          {/* File tree sidebar */}
          <aside className="w-full lg:w-72 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gray-50/40 overflow-y-auto p-2 max-h-72 lg:max-h-none">
            {treeLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p className="text-xs font-medium">Loading file tree…</p>
              </div>
            )}

            {!treeLoading && treeError && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                <p className="text-xs font-medium text-center px-4">{treeError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-gray-200 text-[11px] h-8 font-medium gap-1.5"
                  onClick={() => setReloadKey((k) => k + 1)}
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </Button>
              </div>
            )}

            {!treeLoading && !treeError && searchMatches !== null && (
              <div className="space-y-0.5 py-1">
                {searchMatches.length === 0 && (
                  <p className="text-xs text-gray-400 font-medium px-2 py-8 text-center">
                    No files match "{searchQuery.trim()}"
                  </p>
                )}
                {searchMatches.map((node) => {
                  if (node.type === "tree") {
                    return (
                      <div
                        key={node.path}
                        className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-gray-400"
                      >
                        <Folder className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="truncate">{node.path}</span>
                      </div>
                    )
                  }
                  const { Icon, className: iconColor } = fileIconFor(node.path)
                  return (
                    <button
                      key={node.path}
                      onClick={() => selectFile(node.path)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors min-w-0"
                    >
                      <Icon className={cn("w-4 h-4 shrink-0", iconColor)} />
                      <span className="truncate">{node.path}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {!treeLoading && !treeError && searchMatches === null && (
              <div>
                {tree.length === 0 && (
                  <p className="text-xs text-gray-400 font-medium px-2 py-8 text-center">
                    This repository has no files on "{branch}".
                  </p>
                )}
                {tree.map((entry) => (
                  <FileTreeNode
                    key={entry.path}
                    entry={entry}
                    depth={0}
                    collapsed={collapsed}
                    selectedPath={selectedPath}
                    onToggleDir={toggleDir}
                    onSelectFile={selectFile}
                    showSizes
                  />
                ))}
              </div>
            )}
          </aside>

          {/* Code viewer */}
          <section className="flex-1 flex flex-col overflow-hidden bg-white h-[50vh] lg:h-auto">
            {/* Viewer header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 shrink-0 min-w-0">
              {selectedPath && fileContent && !isBinary ? (
                <>
                  {(() => {
                    const { Icon, className: iconColor } = fileIconFor(selectedPath)
                    return <Icon className={cn("w-4 h-4 shrink-0", iconColor)} />
                  })()}
                  <span className="text-[13px] font-semibold text-gray-900 truncate">
                    {selectedPath}
                  </span>
                  <Badge variant="outline" className="shrink-0 hidden sm:inline-flex">
                    {getLanguage(selectedPath)}
                  </Badge>
                  <span className="text-[11px] text-gray-400 font-medium shrink-0 hidden md:inline">
                    {formatBytes(fileContent.size)} · {fileLines.length} lines
                  </span>
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {githubBlobUrl && (
                      <a
                        href={githubBlobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        View on GitHub
                      </a>
                    )}
                    <button
                      onClick={copyContent}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-[13px] text-gray-700 font-medium truncate">
                    {selectedPath ?? "Code viewer"}
                  </span>
                  {selectedPath && !fileContent && !fileError && !fileLoading && (
                    <span className="text-[11px] text-gray-400 shrink-0">
                      {isBinary ? "Binary file" : "Select a file to preview"}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {selectedPath && isBinary && (
                      <span className="text-[11px] text-gray-400 font-medium">
                        Binary file
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Viewer body */}
            <div className="flex-1 overflow-auto relative">
              {!selectedPath && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 p-6">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                    <FileCode2 className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">
                    Select a file to view its contents
                  </p>
                  <p className="text-xs text-gray-400 text-center max-w-xs">
                    The full repository structure is loaded at once — file contents
                    are fetched only when you open them.
                  </p>
                </div>
              )}

              {selectedPath && fileLoading && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 p-6">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="text-xs font-medium">Loading file…</p>
                </div>
              )}

              {selectedPath && !fileLoading && fileError && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 p-6">
                  <p className="text-sm font-medium">{fileError}</p>
                </div>
              )}

              {selectedPath && !fileLoading && !fileError && isBinary && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 p-6">
                  <FileImage className="w-8 h-8 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">
                    Binary file — preview not available
                  </p>
                  {githubBlobUrl && (
                    <a
                      href={githubBlobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Open on GitHub
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {selectedPath && !fileLoading && !fileError && !isBinary && fileContent && (
                <div className="font-mono text-[12.5px] leading-[1.6] min-w-max">
                  {fileLines.map((line, index) => (
                    <div key={index} className="flex hover:bg-gray-50">
                      <span className="sticky left-0 w-12 shrink-0 text-right pr-4 pl-3 py-px text-[11px] text-gray-300 bg-white select-none border-r border-gray-50">
                        {index + 1}
                      </span>
                      <pre className="flex-1 pr-6 whitespace-pre text-gray-800">
                        {line || " "}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default RepoExplorerView