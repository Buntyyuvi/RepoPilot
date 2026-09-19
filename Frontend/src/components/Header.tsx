import { useEffect, useRef, useState } from "react"
import { Search, ChevronDown, Moon, Sun, UserCheck, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"
import type { AppUser } from "@/lib/api"

interface HeaderProps {
  searchQuery?: string
  onSearchChange?: (query: string) => void
  userInitials?: string
  user?: AppUser | null
  showSidebarToggle?: boolean
  onToggleSidebar?: () => void
}

export function Header({
  searchQuery = "",
  onSearchChange,
  userInitials = "",
  user,
  showSidebarToggle = false,
  onToggleSidebar,
}: HeaderProps) {
  const { isDark, toggleDark } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isOpen])

  return (
    <header className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5 border-b border-gray-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-20">
      {/* Left Title / Branding */}
      <div className="flex items-center gap-3 pl-0 lg:pl-5 min-w-0">
        {showSidebarToggle && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Open menu"
            aria-label="Open menu"
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors shrink-0"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shadow-xs shrink-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
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
          <h1 className="font-bold text-gray-900 text-sm leading-tight truncate">RepoPilot</h1>
          <p className="text-[11px] text-gray-500 font-medium hidden md:block">Repository intelligence</p>
        </div>
      </div>

      {/* Center Search Input with ⌘ K pill */}
      <div className="relative hidden md:block w-full max-w-md mx-4 min-w-0">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search repositories..."
          className="w-full pl-10 pr-12 py-2 bg-gray-50/80 border border-gray-200/80 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-gray-300 transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-200/60 border border-gray-300/50 text-[10px] font-mono text-gray-500 pointer-events-none select-none">
          <span>⌘</span>
          <span>K</span>
        </div>
      </div>

      {/* Right User Avatar Dropdown */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity py-1 px-1 rounded-lg"
        >
          <div className="w-8 h-8 rounded-full bg-black text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {userInitials}
          </div>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-gray-500 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+10px)] w-64 bg-white border border-gray-200/80 rounded-2xl shadow-xl shadow-gray-950/5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {user && (
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-black text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate flex items-center gap-1">
                    {user.displayName}
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">@{user.username}</p>
                </div>
              </div>
            )}

            <div className="p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={toggleDark}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
                  {isDark ? (
                    <Sun className="w-4 h-4 text-gray-500" />
                  ) : (
                    <Moon className="w-4 h-4 text-gray-500" />
                  )}
                  Dark Mode
                </span>
                <span
                  className={cn(
                    "w-9 h-5 rounded-full transition-colors relative shadow-inner",
                    isDark ? "bg-gray-900" : "bg-gray-200"
                  )}
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                      isDark ? "left-[18px]" : "left-0.5"
                    )}
                  />
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}