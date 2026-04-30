import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
  className?: string
  compact?: boolean
  actionsClassName?: string
}

export function PageHeader({
  title,
  description,
  children,
  className,
  compact = false,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[24px] border bg-card px-6 shadow-[0_2px_4px_rgba(0,0,0,0.03)]",
        compact ? "py-6" : "py-8 md:px-8 md:py-10",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_50%_0%,rgba(24,226,153,0.20),transparent_68%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1
            className={cn(
              "font-semibold leading-[1.1] tracking-[-0.8px] text-foreground",
              compact ? "text-3xl" : "text-4xl md:text-[40px]",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-base leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {children ? (
          <div className={cn("flex min-w-0 max-w-full flex-wrap gap-2 lg:justify-end", actionsClassName)}>
            {children}
          </div>
        ) : null}
      </div>
    </section>
  )
}
