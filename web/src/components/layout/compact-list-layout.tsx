import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageContainer } from "@/components/layout/page-container"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type DivProps = ComponentPropsWithoutRef<"div">

interface CompactListPageProps extends DivProps {
  relaxed?: boolean
}

interface CompactListHeaderProps extends DivProps {
  title: string
  description?: string
  summary?: ReactNode
  actions?: ReactNode
}

interface CompactListFilterPopoverProps {
  children: ReactNode
  label?: string
  className?: string
}

export function CompactListPage({ className, relaxed = false, ...props }: CompactListPageProps) {
  return (
    <PageContainer
      className={cn(
        relaxed ? "compact-list-page-relaxed" : "compact-list-page",
        className,
      )}
      {...props}
    />
  )
}

export function CompactListHeader({
  title,
  description,
  summary,
  actions,
  className,
  ...props
}: CompactListHeaderProps) {
  return (
    <section
      className={cn(
        "shrink-0 rounded-2xl border bg-card px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:px-5",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-3 min-[980px]:flex-row min-[980px]:items-center min-[980px]:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold leading-7 text-foreground">{title}</h1>
            {summary ? (
              <Badge variant="secondary" className="max-w-full font-normal">
                {summary}
              </Badge>
            ) : null}
          </div>
          {description ? (
            <p className="compact-list-header-description mt-1 hidden text-xs leading-5 text-muted-foreground min-[1180px]:block">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function CompactListCard({ className, ...props }: ComponentPropsWithoutRef<typeof Card>) {
  return <Card className={cn("min-h-0 flex-1 gap-0 overflow-hidden py-0", className)} {...props} />
}

export function CompactListCardHeader({ className, ...props }: ComponentPropsWithoutRef<typeof CardHeader>) {
  return <CardHeader className={cn("shrink-0 border-b px-4 py-3 md:px-5", className)} {...props} />
}

export function CompactListCardContent({ className, ...props }: ComponentPropsWithoutRef<typeof CardContent>) {
  return <CardContent className={cn("flex min-h-0 flex-1 flex-col px-4 pb-0 pt-3 md:px-5", className)} {...props} />
}

export function CompactListToolbar({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 min-[980px]:flex-row min-[980px]:items-center min-[980px]:justify-between",
        className,
      )}
      {...props}
    />
  )
}

export function CompactListSummary({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export function CompactListControls({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-2 min-[980px]:justify-end", className)}
      {...props}
    />
  )
}

export function CompactListInlineFilters({ className, ...props }: DivProps) {
  return <div className={cn("compact-list-inline-filters flex flex-wrap items-center gap-2", className)} {...props} />
}

export function CompactListFilterPopover({
  children,
  label = "筛选",
  className,
}: CompactListFilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn("compact-list-filter-popover", className)}>
          <Settings2 className="size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-3">
        <div className="grid gap-2">{children}</div>
      </PopoverContent>
    </Popover>
  )
}

export function CompactListTableFrame({ className, ...props }: DivProps) {
  return <div className={cn("min-h-0 flex-1 overflow-auto rounded-md border", className)} {...props} />
}
