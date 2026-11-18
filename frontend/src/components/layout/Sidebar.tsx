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
  Radio,
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
      {/* Mobile Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-200 ease-in-out",
          "border-slate-800/80 bg-slate-950 text-slate-100 shadow-xl lg:shadow-none",
          "w-72 max-w-[85vw] lg:static lg:z-auto lg:max-w-none lg:shrink-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-64"
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            "shrink-0 border-b border-slate-800/80",
            collapsed
              ? "flex flex-col items-center gap-2 px-2 py-3.5"
              : "flex items-center justify-between px-4 py-4"
          )}
        >
          <div className={cn("flex min-w-0 items-center gap-3", collapsed && "lg:justify-center")}>
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 shadow-md shadow-blue-500/20">
              <Network className="h-5 w-5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-base font-bold tracking-tight text-white">
                    InfraView
                  </h1>
                  <span className="rounded-md bg-blue-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-blue-400 border border-blue-500/30">
                    PRO
                  </span>
                </div>
                <p className="truncate text-xs text-slate-400 font-medium">Network Intelligence</p>
              </div>
            )}
          </div>

          {/* Toggle Collapsed Desktop */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100",
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

          {/* Close Mobile */}
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-900 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-2.5 lg:p-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-150",
                  collapsed
                    ? "justify-center px-2 py-3 lg:py-2.5"
                    : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25 font-semibold"
                    : "text-slate-400 hover:bg-slate-900/90 hover:text-slate-100"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Platform Status Card (Desktop when not collapsed) */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-850">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 shadow-inner">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-200">Varredor Ativo</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-tight">
                NetBIOS, LLDP, ARP, Ping e SNMP operando em tempo real.
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
