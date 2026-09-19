import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "repopilot-theme"

export function getStoredTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "light"
  return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light"
}

export function applyTheme(theme: "dark" | "light"): void {
  const root = document.documentElement
  if (theme === "dark") {
    root.dataset.theme = "dark"
  } else {
    delete root.dataset.theme
  }
}

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => getStoredTheme() === "dark")

  useEffect(() => {
    applyTheme(isDark ? "dark" : "light")
    try {
      window.localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light")
    } catch {
      // Storage unavailable (e.g. private mode) — the theme still applies.
    }
  }, [isDark])

  const toggleDark = useCallback(() => {
    setIsDark((prev) => !prev)
  }, [])

  return { isDark, toggleDark }
}