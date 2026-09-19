import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "ghost"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"

  const variants = {
    default:
      "border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200/80",
    secondary:
      "border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    outline: "text-gray-600 border border-gray-200 bg-white",
    ghost: "text-gray-500 bg-transparent hover:bg-gray-100",
  }

  return (
    <div className={cn(base, variants[variant], className)} {...props} />
  )
}

export { Badge }
