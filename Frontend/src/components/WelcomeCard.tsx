import { useState } from "react"
import { Lock, Search, GitFork, MessageSquareText, ArrowUpRight, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface WelcomeCardProps {
  onGithubLogin: () => void
  isLoading?: boolean
}

export function WelcomeCard({ onGithubLogin, isLoading = false }: WelcomeCardProps) {
  const [activeFeature, setActiveFeature] = useState<string | null>(null)
  const [localLoading, setLocalLoading] = useState(false)

  const handleLoginClick = () => {
    setLocalLoading(true)
    setTimeout(() => {
      setLocalLoading(false)
      onGithubLogin()
    }, 900)
  }

  const isButtonLoading = isLoading || localLoading

  return (
    <Card className="w-full max-w-[480px] bg-white/95 backdrop-blur-xl border border-gray-200/70 shadow-2xl shadow-gray-950/5 rounded-3xl overflow-hidden z-10">
      <CardContent className="p-8 sm:p-10 flex flex-col items-center text-center">
        {/* Top Logo Badge */}
        <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/10 mb-5 transition-transform hover:scale-105 duration-300">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-7 h-7"
          >
            <circle cx="18" cy="6" r="2.5" />
            <circle cx="6" cy="18" r="2.5" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 15.5V8a2 2 0 0 1 2-2h7.5" />
            <path d="M12 10v.5" />
            <path d="M10 14l2-2 4 4" />
          </svg>
        </div>

        {/* Heading & Subtitle */}
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
          Welcome to RepoMind AI
        </h2>
        <p className="text-sm text-gray-500 font-normal mb-8 leading-relaxed max-w-sm">
          Understand any codebase instantly with AI.
        </p>

        {/* Black Action Button with GitHub Integration */}
        <div className="w-full space-y-3">
          <Button
            variant="black"
            onClick={handleLoginClick}
            disabled={isButtonLoading}
            className="w-full h-12 rounded-xl text-sm font-medium flex items-center justify-between px-5 bg-black hover:bg-gray-900 text-white shadow-md hover:shadow-lg transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              {/* Official GitHub SVG Icon */}
              <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="font-semibold tracking-wide">Login with GitHub</span>
            </div>

            {isButtonLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
            ) : (
              <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
            )}
          </Button>

          {/* Security subtitle */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 font-normal">
            <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>We only access repositories you authorize</span>
          </div>
        </div>

        {/* Private By Design Divider */}
        <div className="w-full my-6">
          <Separator label="PRIVATE BY DESIGN" />
        </div>

        {/* 3 Feature Boxes */}
        <div className="grid grid-cols-3 gap-3 w-full mb-8">
          {/* Feature 1: Search smarter */}
          <div
            onClick={() => setActiveFeature(activeFeature === "search" ? null : "search")}
            className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-2 cursor-pointer select-none ${
              activeFeature === "search"
                ? "bg-gray-100 border-gray-300 shadow-xs"
                : "bg-gray-50/80 border-gray-100/90 hover:bg-gray-100/60 hover:border-gray-200"
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-white border border-gray-200/60 flex items-center justify-center text-gray-700 shadow-2xs">
              <Search className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-gray-700 leading-tight">
              Search smarter
            </span>
          </div>

          {/* Feature 2: Map dependencies */}
          <div
            onClick={() => setActiveFeature(activeFeature === "map" ? null : "map")}
            className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-2 cursor-pointer select-none ${
              activeFeature === "map"
                ? "bg-gray-100 border-gray-300 shadow-xs"
                : "bg-gray-50/80 border-gray-100/90 hover:bg-gray-100/60 hover:border-gray-200"
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-white border border-gray-200/60 flex items-center justify-center text-gray-700 shadow-2xs">
              <GitFork className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-gray-700 leading-tight">
              Map dependencies
            </span>
          </div>

          {/* Feature 3: Ask questions */}
          <div
            onClick={() => setActiveFeature(activeFeature === "chat" ? null : "chat")}
            className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-2 cursor-pointer select-none ${
              activeFeature === "chat"
                ? "bg-gray-100 border-gray-300 shadow-xs"
                : "bg-gray-50/80 border-gray-100/90 hover:bg-gray-100/60 hover:border-gray-200"
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-white border border-gray-200/60 flex items-center justify-center text-gray-700 shadow-2xs">
              <MessageSquareText className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-gray-700 leading-tight">
              Ask questions
            </span>
          </div>
        </div>

        {/* Terms & Privacy Disclaimer */}
        <p className="text-[12px] text-gray-400 font-normal leading-relaxed max-w-xs">
          By continuing, you agree to our{" "}
          <a href="#terms" className="text-gray-600 hover:text-gray-900 underline underline-offset-2">
            terms
          </a>{" "}
          and acknowledge our{" "}
          <a href="#privacy" className="text-gray-600 hover:text-gray-900 underline underline-offset-2">
            privacy policy
          </a>
          .
        </p>
      </CardContent>
    </Card>
  )
}
