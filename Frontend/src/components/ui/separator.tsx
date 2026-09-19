import * as React from "react"
import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    orientation?: "horizontal" | "vertical"
    label?: string
  }
>(({ className, orientation = "horizontal", label, ...props }, ref) => {
  if (label) {
    return (
      <div className="relative flex items-center justify-center my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200/80" />
        </div>
        <div className="relative bg-white px-4 text-xs font-semibold tracking-wider text-gray-400 uppercase">
          {label}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(
        "shrink-0 bg-gray-200/80",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
})
Separator.displayName = "Separator"

export { Separator }
