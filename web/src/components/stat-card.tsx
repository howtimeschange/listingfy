import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  description?: string
  className?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("py-5", className)}>
      <CardContent className="px-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium uppercase tracking-[0.65px] text-muted-foreground">
            {title}
          </p>
          {Icon && <Icon className="size-4 text-[var(--brand-deep)]" />}
        </div>
        <p className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.24px] tabular-nums">
          {value}
        </p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
