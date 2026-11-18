import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200",
        "border-slate-200 bg-white text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-100",
        "dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800",
        className,
      )}
      title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      aria-label="Alternar tema claro e escuro"
    >
      <Sun
        className={cn(
          "h-4 w-4 transition-all duration-300",
          isDark
            ? "rotate-90 scale-0 opacity-0 absolute"
            : "rotate-0 scale-100 opacity-100 text-amber-500",
        )}
      />
      <Moon
        className={cn(
          "h-4 w-4 transition-all duration-300",
          isDark
            ? "rotate-0 scale-100 opacity-100 text-blue-400"
            : "-rotate-90 scale-0 opacity-0 absolute",
        )}
      />
    </button>
  )
}
