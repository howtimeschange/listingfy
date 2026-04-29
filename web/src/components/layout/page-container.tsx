import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageContainerProps {
  children: ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 overflow-auto px-4 py-6 md:px-8 md:py-8",
        className,
      )}
    >
      {children}
    </div>
  )
}
