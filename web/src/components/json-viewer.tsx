import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface JsonViewerProps {
  data: unknown
  label?: string
  defaultOpen?: boolean
  className?: string
}

export function JsonViewer({
  data,
  label = "JSON",
  defaultOpen = false,
  className,
}: JsonViewerProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-full justify-start gap-1 rounded-none px-3"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          className={cn(
            "size-3.5 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="font-mono text-xs font-medium uppercase tracking-[0.6px]">
          {label}
        </span>
      </Button>
      {open && (
        <pre className="max-h-[400px] overflow-auto border-t bg-muted/50 p-4 font-mono text-xs leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
