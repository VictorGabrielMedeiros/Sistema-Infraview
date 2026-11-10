import { useEffect } from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  Activity,
  LayoutDashboard,
  Map,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Settings,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/topology", label: "Topologia", icon: Map },
  { to: "/devices", label: "Dispositivos", icon: Server },
  { to: "/discovery", label: "Descobertas", icon: Activity },
  { to: "/settings", label: "Configurações", icon: Settings },
]

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Sidebar({ mobileOpen, onMobileClose, collapsed, onToggleCollapsed }: SidebarProps) {
  const location = useLocation()

  useEffect(() => {
    onMobileClose()
  }, [location.pathname, onMobileClose])

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-950 text-slate-100 transition-all duration-200",
          "w-72 max-w-[85vw] lg:static lg:z-auto lg:max-w-none lg:shrink-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-64"
        )}
      >
        <div
          className={cn(
            "shrink-0 border-b border-slate-800",
            collapsed ? "flex flex-col items-center gap-2 px-2 py-3" : "flex items-center justify-between px-4 py-4"
          )}
        >
          <div className={cn("flex min-w-0 items-center gap-3", collapsed && "lg:justify-center")}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
              <Network className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight">InfraView</h1>
                <p className="truncate text-xs text-slate-400">Network Intelligence</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100",
              collapsed ? "hidden w-full justify-center lg:flex" : "hidden lg:flex"
            )}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2 lg:p-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  collapsed
                    ? "justify-center px-2 py-3 lg:py-2.5"
                    : "gap-3 px-3 py-3 lg:py-2.5",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
