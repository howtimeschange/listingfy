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
    <div className={cn("rounded border", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-1 h-8 rounded-none"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          className={cn(
            "size-3.5 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="text-xs font-medium">{label}</span>
      </Button>
      {open && (
        <pre className="overflow-auto bg-muted/50 p-3 text-xs leading-relaxed max-h-[400px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
