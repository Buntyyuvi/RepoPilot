import { useEffect, useState } from "react"
import { PanelLeftOpen } from "lucide-react"
import { Sidebar, type NavTab } from "@/components/Sidebar"
import { Header } from "@/components/Header"
import { LandingPage } from "@/components/LandingPage"
import { PermissionsCard } from "@/components/PermissionsCard"
import { DashboardView } from "@/components/DashboardView"
import { RepositoriesView } from "@/components/RepositoriesView"
import { ChatView } from "@/components/ChatView"
import { UploadView } from "@/components/UploadView"
import { SettingsView } from "@/components/SettingsView"
import { RepoExplorerView } from "@/components/RepoExplorerView"
import { apiFetch, ApiError, API_URL, type AppUser } from "@/lib/api"
import { useIsDesktop } from "@/lib/useMediaQuery"

export type AuthStep = "welcome" | "permissions" | "authenticated"

// Each toggled permission maps to a real GitHub OAuth scope.
const PERMISSION_SCOPE_MAP: Record<string, string> = {
  read_repos: "repo",
  read_profile: "read:user",
  read_history: "repo",
}

type ExplorerTarget = {
  fullName: string
  defaultBranch?: string
}

type ChatTarget = {
  fullName: string
}

const SIDEBAR_STORAGE_KEY = "repopilot-sidebar-collapsed"

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard")
  const [authStep, setAuthStep] = useState<AuthStep>("welcome")
  const [searchQuery, setSearchQuery] = useState("")
  const [user, setUser] = useState<AppUser | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [explorer, setExplorer] = useState<ExplorerTarget | null>(null)
  const [chatTarget, setChatTarget] = useState<ChatTarget | null>(null)
  const [githubReconnect, setGithubReconnect] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
    } catch {
      return false
    }
  })
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const isDesktop = useIsDesktop()

  // The drawer only exists below lg; on desktop the sidebar is sticky.
  const isMobileSidebarVisible = !isDesktop && isMobileSidebarOpen

  // On mount, ask the backend whether a session already exists (e.g. after
  // the GitHub OAuth callback redirected back to the SPA, or on refresh).
  useEffect(() => {
    let cancelled = false

    const loadSession = async () => {
      try {
        const me = await apiFetch<AppUser>("/auth/me")
        if (cancelled) return
        setUser(me)
        setAuthStep("authenticated")
        setGithubReconnect(false)
      } catch {
        if (cancelled) return
        setUser(null)
        setAuthStep("welcome")
      } finally {
        if (!cancelled) setIsSessionLoading(false)
      }
    }

    void loadSession()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onMessageFromPopup = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== "github-auth-success") return

      setAuthStep("authenticated")
      setActiveTab("dashboard")

      try {
        const me = await apiFetch<AppUser>("/auth/me")
        setUser(me)
        setAuthStep("authenticated")
        setGithubReconnect(false)
      } catch {
        setUser(null)
        setAuthStep("welcome")
      }
    }

    window.addEventListener("message", onMessageFromPopup)
    return () => window.removeEventListener("message", onMessageFromPopup)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, isSidebarCollapsed ? "true" : "false")
    } catch {
      // Storage unavailable (e.g. private mode) — the state still applies.
    }
  }, [isSidebarCollapsed])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("githubAuth") === "success" && window.opener) {
      window.opener.postMessage({ type: "github-auth-success" }, window.location.origin)
      window.close()
    }
  }, [])

  const handleGithubLoginClick = () => {
    const popup = window.open(
      `${API_URL}/auth/github?scope=${encodeURIComponent("repo read:user")}`,
      "githubLogin",
      "width=520,height=720,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes"
    )

    if (!popup) {
      window.location.href = `${API_URL}/auth/github?scope=${encodeURIComponent("repo read:user")}`
      return
    }
  }

  const handleAuthorizePermissions = (grantedPermissionIds: string[]) => {
    // Step 2 -> Step 3: Build the union of the granted GitHub scopes and
    // redirect the browser into the real GitHub OAuth flow.
    const scopes = Array.from(
      new Set(
        grantedPermissionIds
          .map((id) => PERMISSION_SCOPE_MAP[id])
          .filter(Boolean)
      )
    )
    window.location.href = `${API_URL}/auth/github?scope=${encodeURIComponent(scopes.join(" "))}`
  }

  const handleLogout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" })
    } catch {
      // Ignore failures; clear local state regardless.
    }
    setUser(null)
    setAuthStep("welcome")
    setActiveTab("dashboard")
    setExplorer(null)
    setChatTarget(null)
    setIsMobileSidebarOpen(false)
  }

  // Called when the session (cookie) is truly gone — full logout.
  const handleAuthExpired = (error?: unknown) => {
    // A GitHub access-token failure is NOT a session failure: don't log the
    // user out, just prompt them to re-consent to GitHub.
    if (error instanceof ApiError && error.code === "GITHUB_TOKEN_REFRESH_FAILED") {
      setGithubReconnect(true)
      return
    }
setUser(null)
    setAuthStep("welcome")
    setActiveTab("dashboard")
    setExplorer(null)
    setChatTarget(null)
    setGithubReconnect(false)
    setIsMobileSidebarOpen(false)
  }

  // Re-run the GitHub OAuth flow without touching the existing session.
  const handleReconnectGithub = () => {
    window.location.href = `${API_URL}/auth/github/relink`
  }

  // Open the chat tab for a specific repo from a repository card.
  const handleOpenChat = (fullName: string) => {
    setExplorer(null)
    setChatTarget({ fullName })
    setActiveTab("chat")
  }

  // Open the repo explorer from a card in RepositoriesView.
  const handleOpenExplorer = (fullName: string, defaultBranch?: string) => {
    setExplorer({ fullName, defaultBranch })
    setActiveTab("repositories")
  }

  // Closing the explorer returns to the repositories list.
  const handleCloseExplorer = () => setExplorer(null)

  // Navigating via the sidebar leaves the repo explorer.
  const handleTabChange = (tab: NavTab) => {
    setExplorer(null)
    setActiveTab(tab)
    setIsMobileSidebarOpen(false)
  }

  const isAuthenticated = authStep === "authenticated"
  const userInitials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((part) => part.charAt(0))
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : ""

  if (isSessionLoading) {
    return (
      <div className="min-h-screen bg-slate-50/60 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center shadow-lg animate-pulse">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6"
          >
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="6" cy="18" r="2.5" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 15.5V8a2 2 0 0 1 2-2h7.5" />
            <path d="M12 10v.5" />
            <path d="M10 14l2-2 4 4" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">Loading your workspace...</p>
      </div>
    )
  }

  if (authStep === "welcome") {
    return <LandingPage onGithubLogin={handleGithubLoginClick} />
  }

  if (authStep === "permissions") {
    return (
      <div className="min-h-screen bg-slate-50/60 text-slate-900 flex items-center justify-center font-sans antialiased">
        <PermissionsCard
          userHandle={user?.username}
          onAuthorize={handleAuthorizePermissions}
        />
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50/60 text-slate-900 flex font-sans antialiased selection:bg-black selection:text-white">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isAuthenticated={isAuthenticated || authStep === "permissions"}
        user={user}
        onLogout={handleLogout}
        onConnectRepo={() => setAuthStep("welcome")}
        collapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        mobileOpen={isMobileSidebarVisible}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {isMobileSidebarVisible && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {isDesktop && isSidebarCollapsed && (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          title="Show sidebar"
          aria-label="Show sidebar"
          className="fixed left-4 top-4 z-40 p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 bg-white/90 border border-gray-200/70 backdrop-blur-md rounded-lg shadow-sm transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      <div className="h-screen flex-1 min-w-0 flex flex-col relative overflow-hidden">
        {githubReconnect && isAuthenticated && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-amber-900 font-medium flex-1">
              Your GitHub access expired. Reconnect to keep using your repositories and chat.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleReconnectGithub}
                className="bg-black hover:bg-gray-900 text-white text-xs font-semibold h-8 px-4 rounded-lg transition-colors"
              >
                Reconnect GitHub
              </button>
              <button
                onClick={() => setGithubReconnect(false)}
                className="text-amber-900/70 hover:text-amber-950 text-xs font-medium px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          userInitials={userInitials}
          user={user}
          showSidebarToggle={!isDesktop}
          onToggleSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <main className="flex-1 min-h-0 min-w-0 px-4 sm:px-6 md:px-10 py-5 md:py-6 flex flex-col relative z-10 justify-start overflow-y-auto">
          {explorer ? (
            <RepoExplorerView
              fullName={explorer.fullName}
              defaultBranch={explorer.defaultBranch}
              onBack={handleCloseExplorer}
              onAuthExpired={handleAuthExpired}
            />
          ) : (
            <>
              {activeTab === "dashboard" && (
                <DashboardView
                  onNavigate={handleTabChange}
                  onOpenRepo={handleOpenExplorer}
                  onAuthExpired={handleAuthExpired}
                />
              )}
              {activeTab === "repositories" && (
                <RepositoriesView
                  onSelectRepo={handleOpenExplorer}
                  onNavigateSettings={() => setActiveTab("settings")}
                  onAuthExpired={handleAuthExpired}
                  onChatRepo={handleOpenChat}
                  searchQuery={searchQuery}
                />
              )}
              {activeTab === "chat" && (
                <ChatView
                  onAuthExpired={handleAuthExpired}
                  initialRepoFullName={chatTarget?.fullName ?? null}
                />
              )}
              {activeTab === "upload" && (
                <UploadView
                  onOpenRepo={handleOpenExplorer}
                  onAuthExpired={handleAuthExpired}
                  onChatRepo={handleOpenChat}
                />
              )}
              {activeTab === "settings" && (
                <SettingsView
                  user={user}
                  onLogout={handleLogout}
                  onReconnectGithub={handleReconnectGithub}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default App