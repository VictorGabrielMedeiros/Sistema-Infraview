import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white/95 shadow-xs backdrop-blur-xs transition-colors duration-200",
        "dark:border-slate-800/90 dark:bg-slate-900/90 dark:shadow-black/20",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-5 sm:p-6", className)} {...props} />
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base sm:text-lg font-bold leading-none tracking-tight text-slate-900 dark:text-slate-100",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardContent }
