import React, { createContext, useContext, useEffect, useState } from "react"

export type Theme = "light" | "dark" | "system"

interface ThemeContextType {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = "infraview-theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored
      }
    } catch {
      /* ignore */
    }
    return "system"
  })

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light"
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return theme
  })

  useEffect(() => {
    const root = document.documentElement

    const updateResolved = () => {
      let isDark = false
      if (theme === "system") {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      } else {
        isDark = theme === "dark"
      }

      setResolvedTheme(isDark ? "dark" : "light")

      if (isDark) {
        root.classList.add("dark")
        root.style.colorScheme = "dark"
      } else {
        root.classList.remove("dark")
        root.style.colorScheme = "light"
      }
    }

    updateResolved()

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => updateResolved()
      mediaQuery.addEventListener("change", handler)
      return () => mediaQuery.removeEventListener("change", handler)
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch {
      /* ignore */
    }
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
