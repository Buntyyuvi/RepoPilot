import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "black" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]"

    const variants = {
      default: "bg-gray-900 text-white shadow hover:bg-gray-800",
      black:
        "bg-black text-white shadow-lg hover:bg-gray-900 hover:shadow-xl border border-gray-800 group relative overflow-hidden",
      outline:
        "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm",
      secondary:
        "bg-gray-100 text-gray-900 hover:bg-gray-200/80 shadow-xs",
      ghost: "hover:bg-gray-100 hover:text-gray-900 text-gray-600",
      link: "text-gray-900 underline-offset-4 hover:underline",
    }

    const sizes = {
      default: "h-11 px-5 py-2.5",
      sm: "h-9 rounded-md px-3 text-xs",
      lg: "h-12 rounded-xl px-8 text-base",
      icon: "h-10 w-10",
    }

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
