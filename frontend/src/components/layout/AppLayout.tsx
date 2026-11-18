import { useCallback, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Toaster } from "sonner"
import { AppHeader } from "./AppHeader"
import { Sidebar } from "./Sidebar"
import { useTheme } from "@/lib/theme"

const STORAGE_KEY = "infraview-sidebar-collapsed"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/topology": "Topologia",
  "/devices": "Dispositivos",
  "/discovery": "Descobertas",
  "/settings": "Configurações",
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export function AppLayout() {
  const { resolvedTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const location = useLocation()

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-transparent text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          onMenuOpen={() => setMobileOpen(true)}
          title={PAGE_TITLES[location.pathname] ?? "InfraView"}
        />
        <main className="flex-1 overflow-auto p-3.5 sm:p-6">
          <Outlet />
        </main>
      </div>
      <Toaster
        theme={resolvedTheme}
        position="top-center"
        richColors
        closeButton
        className="sm:top-right"
      />
    </div>
  )
}
