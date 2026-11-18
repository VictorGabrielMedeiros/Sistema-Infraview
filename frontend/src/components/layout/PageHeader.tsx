import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}

export function ResponsiveTable({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("overflow-x-auto -mx-4 sm:mx-0", className)}>
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">{children}</div>
    </div>
  )
}
