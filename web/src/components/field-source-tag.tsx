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
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.6px]",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {FIELD_SOURCE_LABELS[source]}
    </span>
  )
}
