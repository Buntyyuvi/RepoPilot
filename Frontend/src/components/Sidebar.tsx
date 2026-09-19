import {
  LayoutGrid,
  GitFork,
  MessageSquareText,
  Upload,
  Settings,
  Sparkles,
  ChevronRight,
  LogOut,
  UserCheck,
  PanelLeftClose,
  X
} from "lucide-react"
import { useMediaQuery } from "@/lib/useMediaQuery"
import { Logo } from "./Logo"
import { cn } from "@/lib/utils"
import type { AppUser } from "@/lib/api"

export type NavTab = "dashboard" | "repositories" | "chat" | "upload" | "settings"

interface SidebarProps {
  activeTab: NavTab
  setActiveTab: (tab: NavTab) => void
  isAuthenticated: boolean
  user: AppUser | null
  onLogout: () => void
  onConnectRepo: () => void
  collapsed: boolean
  onToggleSidebar: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({
  activeTab,
  setActiveTab,
  isAuthenticated,
  user,
  onLogout,
  onConnectRepo,
  collapsed,
  onToggleSidebar,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "repositories", label: "Repositories", icon: GitFork },
    { id: "chat", label: "Chat", icon: MessageSquareText },
    { id: "upload", label: "Upload Project", icon: Upload },
    { id: "settings", label: "Settings", icon: Settings },
  ] as const

  return (
    <aside
      className={cn(
        "h-screen flex flex-col justify-between overflow-hidden border-r bg-white/90 backdrop-blur-md transition-[width,transform] duration-300",
        isDesktop
          ? cn(
              "sticky top-0 z-30 shrink-0",
              collapsed ? "w-0 border-transparent p-0" : "w-64 border-gray-200/70 p-6"
            )
          : cn(
              "fixed left-0 top-0 z-40 w-64 border-gray-200/70 p-6",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )
      )}
    >
      <div className="space-y-8">
        {/* Logo Header */}
        <div className="px-2 pt-1 flex items-center justify-between">
          <Logo />
          {isDesktop ? (
            <button
              onClick={onToggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onMobileClose}
              title="Close menu"
              aria-label="Close menu"
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as NavTab)}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 font-medium group text-left",
                  isActive
                    ? "bg-gray-100/90 text-gray-900 font-semibold shadow-2xs"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/80"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors duration-200",
                    isActive ? "text-gray-900" : "text-gray-400 group-hover:text-gray-700"
                  )}
                />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Sidebar Footer Box / User Profile */}
      <div className="space-y-4 pt-4 border-t border-gray-100">
        {isAuthenticated && user ? (
          <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-9 h-9 rounded-full border border-gray-200 bg-gray-200 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center shrink-0 border border-gray-300">
                  {user.displayName
                    .split(" ")
                    .map((part) => part.charAt(0))
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "GH"}
                </div>
              )}
              <div className="truncate">
                <p className="text-xs font-bold text-gray-900 truncate flex items-center gap-1">
                  {user.displayName}
                  <UserCheck className="w-3 h-3 text-emerald-600 inline shrink-0" />
                </p>
                <p className="text-[11px] text-gray-500 truncate">@{user.username}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Log out"
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={onConnectRepo}
            className="p-4 bg-white border border-gray-200/80 rounded-2xl shadow-xs space-y-3 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100/90 flex items-center justify-center text-gray-700 group-hover:bg-black group-hover:text-white transition-colors">
              <Sparkles className="w-4 h-4" />
            </div>

            <div>
              <h4 className="font-bold text-gray-900 text-sm tracking-tight flex items-center justify-between">
                Your code, understood.
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </h4>
              <p className="text-xs text-gray-500 leading-snug mt-1 font-normal">
                Connect a repository to start building your AI workspace.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
