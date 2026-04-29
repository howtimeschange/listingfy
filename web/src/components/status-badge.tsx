import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { TONE_CLASSES, type StatusToneClass } from "@/lib/constants"

interface StatusBadgeProps {
  label: string
  tone: StatusToneClass
  className?: string
}

export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-normal", TONE_CLASSES[tone], className)}
    >
      {label}
    </Badge>
  )
}
