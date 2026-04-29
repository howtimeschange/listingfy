import { cn } from "@/lib/utils"
import {
  FIELD_SOURCE_LABELS,
  FIELD_SOURCE_TONES,
  TONE_CLASSES,
  type FieldSource,
} from "@/lib/constants"

interface FieldSourceTagProps {
  source: FieldSource
  className?: string
}

export function FieldSourceTag({ source, className }: FieldSourceTagProps) {
  const tone = FIELD_SOURCE_TONES[source]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium border",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {FIELD_SOURCE_LABELS[source]}
    </span>
  )
}
