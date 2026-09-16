import { cn } from "@/lib/utils"
import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge"
import { TONE_CLASSES, type StatusToneClass } from "@/lib/constants"

interface StatusBadgeProps {
  label: string
  tone: StatusToneClass
  className?: string
}

export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  const status: Record<StatusToneClass, AnimatedBadgeStatus> = { draft: "neutral", pending: "info", processing: "loading", warning: "warning", error: "danger", success: "success" }
  return (
    <AnimatedBadge
      status={status[tone]} size="sm" pulse={false} animateIcon={false} showIcon={tone === "processing"}
      className={cn("text-xs font-normal", TONE_CLASSES[tone], className)}
    >
      {label}
    </AnimatedBadge>
  )
}
