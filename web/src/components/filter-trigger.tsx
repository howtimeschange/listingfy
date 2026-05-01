import { ChevronDown, Filter } from "lucide-react"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FilterTriggerProps extends Omit<ComponentProps<typeof Button>, "variant"> {
  active?: boolean
}

export function FilterTrigger({ children, active, className, ...props }: FilterTriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "border-border bg-background pr-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-foreground/25",
        active && "border-[var(--brand)] bg-[var(--brand-light)] text-foreground ring-2 ring-[var(--brand)]/20",
        className,
      )}
      {...props}
    >
      <Filter className="size-4 text-muted-foreground" />
      <span>{children}</span>
      <ChevronDown className="size-4 text-muted-foreground" />
    </Button>
  )
}
