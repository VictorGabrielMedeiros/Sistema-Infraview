import { Menu, Network } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"

interface AppHeaderProps {
  onMenuOpen: () => void
  title?: string
}

export function AppHeader({ onMenuOpen, title = "InfraView" }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-3 sm:px-6 backdrop-blur-md transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuOpen}
          className="rounded-xl border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-850 dark:hover:text-white"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile Logo & Title */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-sm shadow-blue-500/20">
            <Network className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
              InfraView
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {title}
            </span>
          </div>
        </div>

        {/* Desktop Title & Breadcrumb */}
        <div className="hidden lg:flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Plataforma
          </span>
          <span className="text-xs text-slate-300 dark:text-slate-700">/</span>
          <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Status Pill */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium text-emerald-700 shadow-xs dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>Rede Monitorada</span>
        </div>

        {/* Theme Toggle Button */}
        <ThemeToggle />
      </div>
    </header>
  )
}
