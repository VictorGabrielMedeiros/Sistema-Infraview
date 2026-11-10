import { Menu, Network } from "lucide-react"

interface AppHeaderProps {
  onMenuOpen: () => void
  title?: string
}

export function AppHeader({ onMenuOpen, title = "InfraView" }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <button
        type="button"
        onClick={onMenuOpen}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Network className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-slate-900">{title}</span>
      </div>

      <h1 className="hidden text-sm font-medium text-slate-600 lg:block">{title}</h1>
    </header>
  )
}
