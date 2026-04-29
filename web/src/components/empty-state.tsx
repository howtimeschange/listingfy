import { Inbox, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  message?: string
  className?: string
  children?: React.ReactNode
  icon?: LucideIcon
}

export function EmptyState({
  message = "暂无数据",
  className,
  children,
  icon: Icon = Inbox,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-muted-foreground",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border bg-[var(--brand-light)] text-[var(--brand-deep)]">
        <Icon className="size-5" />
      </div>
      <p className="text-sm">{message}</p>
      {children}
    </div>
  )
}
