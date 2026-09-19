import { useState } from "react"
import {
  FolderGit2,
  User,
  History,
  ShieldCheck,
  CheckCircle2,
  Circle,
  Lock,
  Loader2,
  Check
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface PermissionsCardProps {
  onAuthorize: (grantedPermissionIds: string[]) => void
  userHandle?: string
}

export function PermissionsCard({
  onAuthorize,
  userHandle,
}: PermissionsCardProps) {
  const [permissions, setPermissions] = useState([
    {
      id: "read_repos",
      title: "Read repositories",
      description: "View repository names, files, and metadata.",
      icon: FolderGit2,
      required: true,
      granted: true,
    },
    {
      id: "read_profile",
      title: "Read user profile",
      description: "Identify your GitHub account and preferences.",
      icon: User,
      required: true,
      granted: true,
    },
    {
      id: "read_history",
      title: "Read commit history",
      description: "Understand changes and improve AI-generated insights.",
      icon: History,
      required: false,
      granted: true,
    },
  ])

  const [isAuthorizing, setIsAuthorizing] = useState(false)

  const togglePermission = (id: string) => {
    setPermissions((prev) =>
      prev.map((item) =>
        item.id === id && !item.required ? { ...item, granted: !item.granted } : item
      )
    )
  }

  const activeScopesCount = permissions.filter((p) => p.granted).length
  const handleInitials = userHandle
    ? userHandle
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase())
        .slice(0, 2)
        .join("")
    : "GH"

  const handleAuthorizeClick = () => {
    setIsAuthorizing(true)
    // Short pause for visible feedback before the browser leaves for GitHub.
    setTimeout(() => {
      setIsAuthorizing(false)
      const grantedIds = permissions.filter((p) => p.granted).map((p) => p.id)
      onAuthorize(grantedIds)
    }, 600)
  }

  return (
    <Card className="w-full max-w-[540px] bg-white/95 backdrop-blur-xl border border-gray-200/80 shadow-2xl shadow-gray-950/5 rounded-3xl overflow-hidden z-10 animate-in fade-in duration-300">
      <CardContent className="p-8 sm:p-10 flex flex-col items-center">
        {/* User Avatar with Checkmark Badge */}
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-200/80 flex items-center justify-center text-gray-500 font-bold text-xl shadow-inner">
            <span className="text-gray-400">{handleInitials}</span>
          </div>
          <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center ring-2 ring-white shadow-xs">
            <Check className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Signed-in user text */}
        <p className="text-xs font-medium text-gray-500 mb-1">
          {userHandle ? (
            <>
              Signed in as <span className="font-bold text-gray-900">@{userHandle}</span>
            </>
          ) : (
            <span>Your GitHub account</span>
          )}
        </p>

        {/* Title & Description */}
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight text-center mb-2">
          Grant Repository Access
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 text-center leading-relaxed mb-8 max-w-md font-normal">
          IndexAI needs permission to read your public and private repositories to build a secure AI-powered index of your codebase.
        </p>

        {/* Requested permissions Header & Scope Badge */}
        <div className="w-full flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-bold text-gray-900">Requested permissions</h3>
          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full border border-gray-200/60">
            {activeScopesCount} {activeScopesCount === 1 ? "scope" : "scopes"}
          </span>
        </div>

        {/* Permission List Items */}
        <div className="w-full space-y-3 mb-6">
          {permissions.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.id}
                onClick={() => togglePermission(item.id)}
                className={`p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between group select-none ${
                  item.granted
                    ? "bg-gray-50/90 border-gray-200 shadow-2xs cursor-pointer hover:bg-gray-100/70"
                    : "bg-white border-gray-100 text-gray-400 cursor-pointer hover:bg-gray-50/50"
                } ${item.required ? "cursor-default" : ""}`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      item.granted
                        ? "bg-gray-200/70 text-gray-800"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-bold transition-colors ${
                        item.granted ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {item.title}
                      {item.required && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-white border border-gray-200/70 rounded-full px-2 py-0.5">
                          Required
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-500 font-normal mt-0.5 leading-snug">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Right Status Checkmark Icon */}
                <div className="shrink-0 ml-3">
                  {item.granted ? (
                    <CheckCircle2 className="w-5 h-5 text-gray-900 fill-gray-900 stroke-white" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Security Info Box */}
        <div className="w-full p-4 rounded-2xl bg-gray-50/80 border border-gray-200/60 flex items-start gap-3 mb-6">
          <ShieldCheck className="w-4 h-4 text-gray-700 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 font-normal leading-relaxed">
            Your code is encrypted in transit and at rest. You can revoke access anytime from your GitHub settings.
          </p>
        </div>

        {/* Primary Action Lock Button */}
        <Button
          variant="black"
          onClick={handleAuthorizeClick}
          disabled={isAuthorizing || activeScopesCount === 0}
          className="w-full h-12 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-black hover:bg-gray-900 text-white shadow-md hover:shadow-lg transition-all duration-200"
        >
          {isAuthorizing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
              <span>Redirecting to GitHub...</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 text-gray-300" />
              <span className="font-semibold tracking-wide">
                Authorize & Continue ({activeScopesCount} {activeScopesCount === 1 ? "scope" : "scopes"})
              </span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}