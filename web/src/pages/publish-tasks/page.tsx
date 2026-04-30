import { useMemo, useState } from "react"
import { Link } from "react-router"
import { ArrowRight, RefreshCw, Search, Send } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { ServerPagination } from "@/components/server-pagination"
import type { ServerPaginationState } from "@/components/server-pagination"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface PublishTask {
  id: number
  listing_id: number
  publish_version_id: number | null
  platform: string
  task_type: string
  status: string
  attempt_count: number
  max_attempts: number
  platform_trace_id: string | null
  platform_version: string | null
  error_code: string | null
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  spu_code: string
  title: string | null
  listing_status: string
  validation_status: string
  platform_category_name: string | null
  account_name: string
  spu_name: string | null
  brand_name: string | null
  version_no: number | null
  version_status: string | null
  change_summary: string | null
  submitted_at: string | null
}

interface PublishTasksResponse {
  items: PublishTask[]
  summary: {
    total: number
    by_status: Record<string, number>
  }
  pagination: ServerPaginationState
}

interface PublishTaskFilters {
  platforms: Array<{ platform: string; count: number }>
  statuses: Array<{ status: string; count: number }>
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRM: "待确认",
  PUBLISHING: "发布中",
  PUBLISH_SUBMITTED: "已提交平台",
  PUBLISH_FAILED: "发布失败",
  SUBMITTED: "已提交",
  FAILED: "失败",
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

function statusClass(status: string) {
  if (status.includes("FAILED")) return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  if (status.includes("SUBMITTED")) return "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
  if (status.includes("PUBLISHING")) return "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
  return "border-[#e7dccd] bg-[#f7f2eb] text-[#7f684c]"
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function StatusFilterMenu({
  selected,
  options,
  onToggle,
}: {
  selected: string[]
  options: Array<{ status: string; count: number }>
  onToggle: (value: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {selected.length ? `任务状态 ${selected.length}` : "任务状态"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>任务状态</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.status}
            checked={selected.includes(item.status)}
            onCheckedChange={() => onToggle(item.status)}
          >
            {statusLabel(item.status)} ({formatNumber(item.count)})
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function usePublishTasks(params: {
  q: string
  statuses: string[]
  pagination: { limit: number; offset: number }
}) {
  return useQuery<PublishTasksResponse>({
    queryKey: ["publish-tasks", params],
    queryFn: () => {
      const search = new URLSearchParams({
        platform: "SHEIN",
        q: params.q,
        statuses: params.statuses.join(","),
      })
      return api.get(`/publish-tasks?${search.toString()}&limit=${params.pagination.limit}&offset=${params.pagination.offset}`)
    },
  })
}

function usePublishTaskFilters() {
  return useQuery<PublishTaskFilters>({
    queryKey: ["publish-tasks", "filters"],
    queryFn: () => api.get("/publish-tasks/filters"),
  })
}

export default function PublishTasksPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const { data, isLoading, refetch, isFetching } = usePublishTasks({
    q: search,
    statuses: statusFilter,
    pagination,
  })
  const { data: filters } = usePublishTaskFilters()
  const items = data?.items ?? []
  const statusSummary = useMemo(() => {
    const byStatus = data?.summary.by_status ?? {}
    return [
      `任务 ${formatNumber(data?.summary.total ?? data?.pagination.total ?? 0)}`,
      `已提交 ${formatNumber(byStatus.PUBLISH_SUBMITTED ?? 0)}`,
      `失败 ${formatNumber(byStatus.PUBLISH_FAILED ?? 0)}`,
      `发布中 ${formatNumber(byStatus.PUBLISHING ?? 0)}`,
    ].join(" / ")
  }, [data])

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="发布任务"
        description="提交平台后的任务监控中心，集中查看 SHEIN 回执、Trace ID、平台版本、失败原因和历史发布尝试。"
      >
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
          刷新
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-1">
              <CardTitle>任务列表</CardTitle>
              <p className="text-sm text-muted-foreground">{statusSummary}</p>
            </div>
            <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap xl:w-auto xl:justify-end">
              <div className="relative md:w-80">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPagination((current) => ({ ...current, offset: 0 }))
                  }}
                  placeholder="搜索款号、Trace ID、平台版本、错误信息"
                  className="pl-9"
                />
              </div>
              <StatusFilterMenu
                selected={statusFilter}
                options={filters?.statuses ?? []}
                onToggle={(value) => {
                  setStatusFilter((current) => toggleValue(current, value))
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>平台回执</TableHead>
                  <TableHead>失败信息</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      加载发布任务...
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-mono text-sm">#{item.id}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.platform} / v{item.version_no ?? "-"} / 第 {formatNumber(item.attempt_count)} 次
                          </div>
                          <div className="text-xs text-muted-foreground">{item.account_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Link
                            to={`/pre-publish-validation/${item.listing_id}`}
                            className="font-medium hover:text-[var(--brand-deep)] hover:underline"
                          >
                            {item.spu_code}
                          </Link>
                          <div className="max-w-[340px] truncate text-sm text-muted-foreground">
                            {item.title ?? item.spu_name ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.platform_category_name ?? "未选择类目"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(item.status)}>
                          {statusLabel(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div>平台版本：{item.platform_version ?? "—"}</div>
                          <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                            Trace：{item.platform_trace_id ?? "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[340px]">
                        {item.error_message ? (
                          <div className="space-y-1">
                            <Badge variant="outline" className="border-[#f1cccc] bg-[#fff1f1] text-[#d45656]">
                              {item.error_code ?? "ERROR"}
                            </Badge>
                            <p className="line-clamp-2 text-xs text-muted-foreground">{item.error_message}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>创建：{formatDateTime(item.created_at)}</div>
                        <div>完成：{formatDateTime(item.finished_at)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/publish-tasks/${item.id}`}>
                            查看详情
                            <ArrowRight className="ml-1 size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      暂无发布任务
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <ServerPagination
            pagination={data?.pagination}
            onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>发布任务的边界</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
          <div className="rounded border p-4">
            <Send className="mb-3 size-4 text-foreground" />
            <p className="font-medium text-foreground">草稿箱负责编辑</p>
            <p className="mt-1">字段补齐、图片确认、SKU/SKC 勾选、保存版本和发起发布仍在发布草稿页完成。</p>
          </div>
          <div className="rounded border p-4">
            <RefreshCw className="mb-3 size-4 text-foreground" />
            <p className="font-medium text-foreground">任务中心负责追踪</p>
            <p className="mt-1">提交后的状态、Trace ID、平台版本、失败原因、请求响应归档都在这里看。</p>
          </div>
          <div className="rounded border p-4">
            <ArrowRight className="mb-3 size-4 text-foreground" />
            <p className="font-medium text-foreground">失败回到草稿修正</p>
            <p className="mt-1">失败任务不直接编辑字段，定位问题后回到对应草稿生成新版本再重提。</p>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
