import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  message?: string
  className?: string
  children?: React.ReactNode
}

export function EmptyState({
  message = "暂无数据",
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-muted-foreground",
        className,
      )}
    >
      <Inbox className="size-10 mb-3" />
      <p className="text-sm">{message}</p>
      {children}
    </div>
  )
}
