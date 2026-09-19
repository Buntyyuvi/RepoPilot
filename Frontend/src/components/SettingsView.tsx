import { useEffect, useRef, useState } from "react"
import {
  Cpu,
  ShieldCheck,
  User,
  LogOut,
  RefreshCw,
  Trash2,
  Loader2,
  Moon,
  Sun,
  Server,
  Database,
  AlertTriangle,
  Check,
  MessageSquareText,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"
import {
  ApiError,
  fetchEngineStatus,
  resetAllChatHistory,
  type AppUser,
  type EngineStatus,
} from "@/lib/api"

interface SettingsViewProps {
  user: AppUser | null
  onLogout: () => void
  onReconnectGithub: () => void
}

export function SettingsView({ user, onLogout, onReconnectGithub }: SettingsViewProps) {
  const { isDark, toggleDark } = useTheme()

  // Engine status (read-only from the server).
  const [engine, setEngine] = useState<EngineStatus | null>(null)
  const [engineLoading, setEngineLoading] = useState(true)
  const [engineError, setEngineError] = useState<string | null>(null)

  // Danger-zone feedback.
  const [resettingHistory, setResettingHistory] = useState(false)
  const [historyResetDone, setHistoryResetDone] = useState(false)
  const historyDoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (historyDoneTimer.current) clearTimeout(historyDoneTimer.current)
    }
  }, [])

  // Load the server's active AI engine on mount.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const status = await fetchEngineStatus()
        if (!cancelled) setEngine(status)
      } catch (error) {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          setEngineError("Not authenticated.")
        } else {
          setEngineError("No AI engine configured on the server.")
        }
      } finally {
        if (!cancelled) setEngineLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const handleResetAllHistory = async () => {
    if (
      !window.confirm(
        "This will permanently delete your chat history across every repository. Continue?",
      )
    )
      return

    setResettingHistory(true)
    setHistoryResetDone(false)
    try {
      await resetAllChatHistory()
      setHistoryResetDone(true)
      if (historyDoneTimer.current) clearTimeout(historyDoneTimer.current)
      historyDoneTimer.current = setTimeout(() => setHistoryResetDone(false), 3000)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onLogout()
        return
      }
      window.alert("Failed to reset chat history. Please try again.")
    } finally {
      setResettingHistory(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500">Account, engine info, and preferences</p>
      </div>

      {/* ---- Account ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-gray-900" />
            Account
          </CardTitle>
          <CardDescription>Your connected GitHub account</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-12 h-12 rounded-full border border-gray-200 bg-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center shrink-0 border border-gray-300">
                    {user.displayName
                      .split(" ")
                      .map((p) => p.charAt(0))
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "GH"}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-900">{user.displayName}</p>
                  <p className="text-xs text-gray-500">@{user.username}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReconnectGithub}
                  className="rounded-xl"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Reconnect GitHub
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLogout}
                  className="rounded-xl text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not authenticated.</p>
          )}
        </CardContent>
      </Card>

      {/* ---- Active AI Engine (read-only) ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cpu className="w-5 h-5 text-gray-900" />
            Active AI Engine
          </CardTitle>
          <CardDescription>
            The provider and model used by the server for chat and embeddings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {engineLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading engine status…
            </div>
          ) : engineError ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 font-medium space-y-1">
              <p className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                {engineError}
              </p>
              <p className="text-amber-600 font-normal">
                Set <code className="bg-amber-100 px-1 rounded text-amber-900">OPENAI_KEY</code> (OpenRouter) or{" "}
                <code className="bg-amber-100 px-1 rounded text-amber-900">GEMINI_KEY</code> (Google AI Studio) in{" "}
                <code className="bg-amber-100 px-1 rounded text-amber-900">Backend/.env</code>, then restart the server.
              </p>
            </div>
          ) : engine ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Provider</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      engine.provider === "openrouter" ? "bg-emerald-500" : "bg-blue-500",
                    )}
                  />
                  {engine.provider === "openrouter" ? "OpenRouter" : "Google Gemini"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Chat model</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded-lg text-gray-700">
                  {engine.chatModel}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-500">Embedding model</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded-lg text-gray-700">
                  {engine.embeddingModel}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                The active engine is determined by the server environment and cannot be changed from here.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ---- Appearance ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {isDark ? <Moon className="w-5 h-5 text-gray-900" /> : <Sun className="w-5 h-5 text-gray-900" />}
            Appearance
          </CardTitle>
          <CardDescription>Switch between light and dark mode</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={toggleDark}
            className="w-full flex items-center justify-between py-2 px-3 -mx-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
              {isDark ? (
                <Moon className="w-4 h-4 text-gray-500" />
              ) : (
                <Sun className="w-4 h-4 text-gray-500" />
              )}
              Dark mode
            </span>
            <span
              className={cn(
                "w-9 h-5 rounded-full transition-colors relative shadow-inner",
                isDark ? "bg-gray-900" : "bg-gray-200",
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                  isDark ? "left-[18px]" : "left-0.5",
                )}
              />
            </span>
          </button>
        </CardContent>
      </Card>

      {/* ---- Privacy & Data ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gray-900" />
            Privacy & Data
          </CardTitle>
          <CardDescription>How your data is handled</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-3 py-2 border-b border-gray-100">
            <Database className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <p>
              GitHub tokens, repository metadata, code chunks, embeddings, and your chat history are all stored
              in your own Postgres database — not ours.
            </p>
          </div>
          <div className="flex items-start gap-3 py-2 border-b border-gray-100">
            <Server className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <p>
              When you ask a question, the relevant code snippets are sent to the active AI provider
              (OpenRouter or Gemini) to generate an answer. No data is retained by the provider.
            </p>
          </div>
          <div className="flex items-start gap-3 py-2">
            <MessageSquareText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <p>
              Chat history is stored per repository and can be reset at any time from the Danger Zone below.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ---- Danger Zone ---- */}
      <Card className="border-red-200/80 shadow-red-100/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your stored data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 py-3 border-b border-red-100/60">
            <div>
              <p className="text-sm font-semibold text-gray-900">Reset all chat history</p>
              <p className="text-xs text-gray-500">
                Deletes your chat threads across every repository permanently.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleResetAllHistory()}
              disabled={resettingHistory}
              className="rounded-xl text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 shrink-0"
            >
              {resettingHistory ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Resetting…
                </>
              ) : historyResetDone ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Done
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Reset
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}