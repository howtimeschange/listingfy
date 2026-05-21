import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface ServerPaginationState {
  total: number
  limit: number
  offset: number
}

interface ServerPaginationProps {
  pagination?: ServerPaginationState
  onLimitChange: (limit: number) => void
  onOffsetChange: (offset: number) => void
  pageSizeOptions?: number[]
  className?: string
}

export function ServerPagination({
  pagination,
  onLimitChange,
  onOffsetChange,
  pageSizeOptions = [10, 20, 50, 100, 200],
  className,
}: ServerPaginationProps) {
  if (!pagination) return null

  const total = Number(pagination.total ?? 0)
  const limit = Math.max(1, Number(pagination.limit ?? pageSizeOptions[0]))
  const offset = Math.max(0, Number(pagination.offset ?? 0))
  const currentPage = total === 0 ? 0 : Math.floor(offset / limit) + 1
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const canPrevious = offset > 0
  const canNext = offset + limit < total

  function setLimit(value: string) {
    onLimitChange(Number(value))
    onOffsetChange(0)
  }

  return (
    <div className={cn("mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="text-sm text-muted-foreground tabular-nums">
        共 {formatNumber(total)} 条，当前第 {currentPage || 1} / {pageCount} 页
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">每页数量</span>
          <Select value={String(limit)} onValueChange={setLimit}>
            <SelectTrigger className="h-8 w-[88px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => onOffsetChange(0)}
            disabled={!canPrevious}
            aria-label="第一页"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            disabled={!canPrevious}
          >
            <ChevronLeft className="mr-1 size-4" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onOffsetChange(offset + limit)}
            disabled={!canNext}
          >
            下一页
            <ChevronRight className="ml-1 size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => onOffsetChange((pageCount - 1) * limit)}
            disabled={!canNext}
            aria-label="最后一页"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
