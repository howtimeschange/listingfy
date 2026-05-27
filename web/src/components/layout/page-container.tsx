import { forwardRef, type ComponentPropsWithoutRef } from "react"
import { cn } from "@/lib/utils"

type PageContainerProps = ComponentPropsWithoutRef<"div">

export const PageContainer = forwardRef<HTMLDivElement, PageContainerProps>(function PageContainer(
  { children, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "min-w-0 flex-1 overflow-auto px-4 py-6 md:px-8 md:py-8",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
})
