import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  fileIconFor,
  formatBytes,
  type TreeEntry,
} from "@/lib/fileTree"

interface FileTreeNodeProps {
  entry: TreeEntry
  depth: number
  collapsed: Set<string>
  selectedPath: string | null
  onToggleDir: (path: string) => void
  onSelectFile: (path: string) => void
  showSizes?: boolean
}

export function FileTreeNode({
  entry,
  depth,
  collapsed,
  selectedPath,
  onToggleDir,
  onSelectFile,
  showSizes = false,
}: FileTreeNodeProps) {
  const pad = depth * 14

  if (entry.type === "tree") {
    const isCollapsed = collapsed.has(entry.path)
    return (
      <div>
        <button
          onClick={() => onToggleDir(entry.path)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-100 transition-colors min-w-0"
          style={{ paddingLeft: 4 + pad }}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          )}
          {isCollapsed ? (
            <Folder className="w-4 h-4 text-sky-500 shrink-0" />
          ) : (
            <FolderOpen className="w-4 h-4 text-sky-500 shrink-0" />
          )}
          <span className="truncate">{entry.name}</span>
          {entry.children && entry.children.length > 0 && (
            <span className="ml-auto text-[10px] text-gray-400 font-medium shrink-0">
              {entry.children.length}
            </span>
          )}
        </button>
        {!isCollapsed && entry.children && entry.children.length > 0 && (
          <div>
            {entry.children.map((child) => (
              <FileTreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                collapsed={collapsed}
                selectedPath={selectedPath}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                showSizes={showSizes}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const { Icon, className: iconColor } = fileIconFor(entry.path)
  const isSelected = selectedPath === entry.path
  return (
    <button
      onClick={() => onSelectFile(entry.path)}
      className={cn(
        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors min-w-0",
        isSelected
          ? "bg-gray-100 text-gray-900 font-semibold"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
      style={{ paddingLeft: 22 + pad }}
    >
      <Icon className={cn("w-4 h-4 shrink-0", iconColor)} />
      <span className="truncate">{entry.name}</span>
      {showSizes && entry.size !== undefined && (
        <span className="ml-auto text-[10px] text-gray-400 font-medium shrink-0">
          {formatBytes(entry.size)}
        </span>
      )}
    </button>
  )
}