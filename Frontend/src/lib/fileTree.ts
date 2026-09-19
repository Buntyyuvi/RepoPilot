import type { LucideIcon } from "lucide-react"
import {
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileJson,
  FileTerminal,
  FileText,
} from "lucide-react"
import type { TreeNode } from "@/lib/api"

export interface TreeEntry {
  path: string
  name: string
  type: "blob" | "tree"
  sha: string
  size?: number
  children?: TreeEntry[]
}

const LANGUAGE_LABELS: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  json: "JSON",
  md: "Markdown",
  mdx: "MDX",
  css: "CSS",
  scss: "SCSS",
  html: "HTML",
  htm: "HTML",
  py: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  kt: "Kotlin",
  swift: "Swift",
  rb: "Ruby",
  php: "PHP",
  c: "C",
  h: "C",
  cpp: "C++",
  cc: "C++",
  hpp: "C++",
  cs: "C#",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  ps1: "PowerShell",
  yml: "YAML",
  yaml: "YAML",
  toml: "TOML",
  xml: "XML",
  sql: "SQL",
  txt: "Text",
  lock: "Lockfile",
}

export function getLanguage(path: string): string {
  const name = path.split("/").pop() ?? path
  const lower = name.toLowerCase()
  if (lower === "dockerfile") return "Dockerfile"
  if (lower === ".gitignore") return "Git Ignore"
  if (lower === "makefile") return "Makefile"
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : ""
  return LANGUAGE_LABELS[ext] || LANGUAGE_LABELS[lower] || "Text"
}

export function fileIconFor(path: string): {
  Icon: LucideIcon
  className: string
} {
  const name = path.split("/").pop() ?? path
  const lower = name.toLowerCase()
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : ""

  if (
    lower === "dockerfile" ||
    ["sh", "bash", "zsh", "ps1", "bat", "cmd"].includes(ext)
  ) {
    return { Icon: FileTerminal, className: "text-emerald-600" }
  }
  if (
    [
      "ts",
      "tsx",
      "js",
      "jsx",
      "mjs",
      "cjs",
      "py",
      "go",
      "rs",
      "java",
      "c",
      "cc",
      "cpp",
      "h",
      "hpp",
      "cs",
      "rb",
      "php",
      "swift",
      "kt",
    ].includes(ext)
  ) {
    return { Icon: FileCode2, className: "text-blue-500" }
  }
  if (["json", "yaml", "yml", "toml", "xml", "lock"].includes(ext)) {
    return { Icon: FileJson, className: "text-amber-500" }
  }
  if (["md", "mdx", "rst"].includes(ext) || lower === "license" || lower === "readme") {
    return { Icon: FileText, className: "text-gray-400" }
  }
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "avif", "bmp"].includes(ext)) {
    return { Icon: FileImage, className: "text-violet-500" }
  }
  if (["zip", "tar", "gz", "tgz", "rar", "7z", "jar", "war"].includes(ext)) {
    return { Icon: FileArchive, className: "text-orange-500" }
  }
  return { Icon: File, className: "text-gray-400" }
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Nests a flat list (from the Trees API or from indexed paths) into a folder
// hierarchy (folders first, then files, alphabetical within each group).
export function buildTree(nodes: TreeNode[]): TreeEntry[] {
  const root: TreeEntry[] = []
  const dirIndex = new Map<string, TreeEntry>()

  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "tree" ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  for (const node of sorted) {
    if (!node.path) continue
    const parts = node.path.split("/")
    const entry: TreeEntry = {
      path: node.path,
      name: parts[parts.length - 1],
      type: node.type,
      sha: node.sha,
      size: node.size,
    }

    const parentPath = parts.slice(0, -1).join("/")
    const parent = parentPath ? dirIndex.get(parentPath) : null
    if (parent) {
      parent.children ??= []
      parent.children.push(entry)
    } else {
      root.push(entry)
    }

    if (node.type === "tree") {
      dirIndex.set(node.path, entry)
    }
  }

  return root
}

// Builds a folder hierarchy from a flat list of indexed file paths.
export function buildTreeFromPaths(paths: string[]): TreeEntry[] {
  const seen = new Set<string>()
  const nodes: TreeNode[] = []

  for (const path of paths) {
    if (!path || seen.has(path)) continue
    seen.add(path)
    nodes.push({ path, type: "blob", sha: "", size: undefined })

    const parts = path.split("/")
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join("/")
      if (!seen.has(dirPath)) {
        seen.add(dirPath)
        nodes.push({ path: dirPath, type: "tree", sha: "", size: undefined })
      }
    }
  }

  return buildTree(nodes)
}