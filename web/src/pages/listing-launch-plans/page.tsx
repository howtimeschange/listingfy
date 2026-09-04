import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { useAsyncTasks, type AsyncTaskJob } from "@/lib/async-task-context"
import {
  CompactListCard,
  CompactListCardContent,
  CompactListCardHeader,
  CompactListControls,
  CompactListHeader,
  CompactListPage,
  CompactListTableFrame,
  CompactListToolbar,
} from "@/components/layout/compact-list-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const SpreadsheetImportDialog = lazy(() =>
  import("@/components/import-dialog").then((module) => ({ default: module.ImportDialog })),
)

interface ListingLaunchPlanRow {
  id: number
  import_no: string
  file_name: string | null
  sheet_name: string
  row_number: number
  spu_code: string
  skc_code: string | null
  product_season: string | null
  product_line: string | null
  scene: string | null
  attribute: string | null
  gender: string | null
  category_name: string | null
  subcategory_name: string | null
  color_name: string | null
  tag_price: number | null
  launch_date_text: string | null
  search_launch_date_text: string | null
  content_launch_date_text: string | null
  listing_channel: string | null
  official_category: string | null
  vip_category: string | null
  vip_style_category: string | null
  douyin_category: string | null
  imported_at: string
}

interface LaunchPlanRowsResponse {
  items: ListingLaunchPlanRow[]
  sheets: Array<{ sheet_name: string; count: number }>
  nextCursor: { afterSpuCode: string; afterRowId: number } | null
  pagination: { total: number; limit: number; offset: number }
}

interface LaunchPlanImportResult {
  import?: { id?: number; import_no?: string }
  inputRowCount: number
  insertedRowCount: number
  sheetCount: number
  sourceBatchIds: number[]
  refreshSummaries?: Array<{ refreshedDraftCount: number; autoAppliedTradeCount: number }>
  autoAppliedTradeCount?: number
}

interface LaunchPlanImportJob extends AsyncTaskJob {
  title?: string
  result?: LaunchPlanImportResult
  fileName?: string
  error?: string | null
}

function categoryText(row: ListingLaunchPlanRow) {
  return row.official_category || row.vip_category || row.douyin_category || "-"
}

function CursorPagination({
  total,
  limit,
  hasPrevious,
  hasNext,
  isLoading,
  onPrevious,
  onNext,
  onLimitChange,
}: {
  total: number
  limit: number
  hasPrevious: boolean
  hasNext: boolean
  isLoading: boolean
  onPrevious: () => void
  onNext: () => void
  onLimitChange: (limit: number) => void
}) {
  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground tabular-nums">
          共 {formatNumber(total)} 条，按款号游标翻页
          {isLoading ? (
            <span className="ml-2 inline-flex items-center gap-1 text-xs">
              <Loader2 className="size-3 animate-spin" />
              更新中
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
            <SelectTrigger className="h-8 w-[88px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100, 200].map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onPrevious} disabled={!hasPrevious}>
              <ChevronLeft className="mr-1 size-4" />
              上一页
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onNext} disabled={!hasNext}>
              下一页
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeferredSpreadsheetImportDialog({
  disabled,
  onImport,
}: {
  disabled: boolean
  onImport: (file: File) => void | Promise<void>
}) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const openPendingRef = useRef(false)

  if (!shouldLoad) {
    return (
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={() => {
          openPendingRef.current = true
          setShouldLoad(true)
        }}
      >
        <FileSpreadsheet className="size-4" />
        导入上市计划表
      </Button>
    )
  }

  return (
    <Suspense
      fallback={(
        <Button type="button" size="sm" disabled>
          <Loader2 className="size-4 animate-spin" />
          导入上市计划表
        </Button>
      )}
    >
      <SpreadsheetImportDialog
        title="导入上市计划表"
        description="服务端解析大体积 .xlsx / .csv，按模板表头匹配款号、款色、官方发布类目和上市时间；重复上传会覆盖同款号的生效明细。"
        trigger={
          <Button
            ref={(element) => {
              if (!element || !openPendingRef.current) return
              openPendingRef.current = false
              element.click()
            }}
            type="button"
            size="sm"
            disabled={disabled}
          >
            <FileSpreadsheet className="size-4" />
            导入上市计划表
          </Button>
        }
        onImport={onImport}
      />
    </Suspense>
  )
}

export default function ListingLaunchPlansPage() {
  const queryClient = useQueryClient()
  const { addTask, getTaskByJobId, openTaskCenter } = useAsyncTasks()
  const [searchText, setSearchText] = useState("")
  const [sheetName, setSheetName] = useState("all")
  const [pagination, setPagination] = useState<{ limit: number; afterSpuCode: string | null; afterRowId: number | null }>({
    limit: 50,
    afterSpuCode: null,
    afterRowId: null,
  })
  const [cursorStack, setCursorStack] = useState<Array<{ afterSpuCode: string | null; afterRowId: number | null }>>([])
  const [importJobId, setImportJobId] = useState<string | null>(null)
  const handledImportJobIdRef = useRef<string | null>(null)
  const debouncedQuery = useDebounce(searchText, 300)

  const rows = useQuery<LaunchPlanRowsResponse>({
    queryKey: ["listing-launch-plan-rows", debouncedQuery, sheetName, pagination],
    queryFn: () => {
      const cursorParams = pagination.afterSpuCode && pagination.afterRowId
        ? `&afterSpuCode=${encodeURIComponent(pagination.afterSpuCode)}&afterRowId=${pagination.afterRowId}`
        : ""
      return api.get<LaunchPlanRowsResponse>(
        `/listing-launch-plans/rows?q=${encodeURIComponent(debouncedQuery)}&sheetName=${encodeURIComponent(sheetName)}&limit=${pagination.limit}${cursorParams}`,
      )
    },
  })

  const importLaunchPlan = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      return api.postForm<LaunchPlanImportJob>("/listing-launch-plans/imports", form)
    },
    onSuccess: (job) => {
      addTask({
        job: job as AsyncTaskJob,
        type: "listing_launch_plan_import",
        title: "导入上市计划表",
        description: "后台解析文件、写入明细并刷新已有关联草稿",
        endpoint: `/listing-launch-plans/import-jobs/${job.id}`,
      })
      setImportJobId(job.id)
      handledImportJobIdRef.current = null
      openTaskCenter()
      toast.success("上市计划表导入任务已加入队列")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "导入上市计划表失败")
    },
  })

  const importJob = useQuery<LaunchPlanImportJob>({
    queryKey: ["listing-launch-plan-import-job", importJobId],
    queryFn: () => api.get<LaunchPlanImportJob>(`/listing-launch-plans/import-jobs/${importJobId}`),
    enabled: Boolean(importJobId),
    refetchInterval: (query) => {
      const job = query.state.data
      return job && job.status !== "completed" ? 1500 : false
    },
    refetchOnWindowFocus: false,
  })

  const trackedImportJob = (getTaskByJobId(importJobId)?.job ?? importJob.data) as LaunchPlanImportJob | null | undefined

  useEffect(() => {
    if (!trackedImportJob || trackedImportJob.status !== "completed") return
    if (handledImportJobIdRef.current === trackedImportJob.id) return
    handledImportJobIdRef.current = trackedImportJob.id
    if (trackedImportJob.failed_count > 0) {
      const message = trackedImportJob.error
        || trackedImportJob.items?.find((item) => item.status === "failed")?.error
        || "导入上市计划表失败"
      toast.error(message)
      return
    }
    const result = trackedImportJob.result
    const autoAppliedTradeCount = result?.autoAppliedTradeCount
      ?? (result?.refreshSummaries ?? []).reduce((sum, item) => sum + (item.autoAppliedTradeCount ?? 0), 0)
    toast.success(
      `导入上市计划表完成：${formatNumber(result?.insertedRowCount ?? 0)} / ${formatNumber(result?.inputRowCount ?? 0)} 行，${formatNumber(result?.sheetCount ?? 0)} 个页签，自动应用类目 ${formatNumber(autoAppliedTradeCount)} 个`,
    )
    queryClient.invalidateQueries({ queryKey: ["listing-launch-plan-rows"] })
  }, [queryClient, trackedImportJob])

  const summary = useMemo(() => {
    const total = rows.data?.pagination.total ?? 0
    const sheetCount = rows.data?.sheets.length ?? 0
    return `${formatNumber(total)} 行 / ${formatNumber(sheetCount)} 个页签`
  }, [rows.data])

  return (
    <CompactListPage>
      <CompactListHeader
        title="上市计划表"
        description="存放上市计划表导入后的结构化明细，供深绘建档草稿匹配类目、上市时间和商品基础字段；支持重复上传，同款号以最近一次导入为准。"
        summary={summary}
        actions={
          <DeferredSpreadsheetImportDialog
            disabled={importLaunchPlan.isPending}
            onImport={async (file) => {
              await importLaunchPlan.mutateAsync(file)
            }}
          />
        }
      />

      <CompactListCard>
        <CompactListCardHeader>
          <CompactListToolbar>
            <div className="min-w-0">
              <CardTitle className="text-base">计划明细</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                款号、款色、类目、上市时间和渠道来自导入模板。
              </p>
            </div>
            <CompactListControls>
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value)
                    setCursorStack([])
                    setPagination((current) => ({ ...current, afterSpuCode: null, afterRowId: null }))
                  }}
                  placeholder="搜索款号、款色、类目"
                  className="pl-8"
                />
              </div>
              <Select
                value={sheetName}
                onValueChange={(value) => {
                  setSheetName(value)
                  setCursorStack([])
                  setPagination((current) => ({ ...current, afterSpuCode: null, afterRowId: null }))
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部页签</SelectItem>
                  {(rows.data?.sheets ?? []).map((sheet) => (
                    <SelectItem key={sheet.sheet_name} value={sheet.sheet_name}>
                      {sheet.sheet_name} · {formatNumber(sheet.count)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CompactListControls>
          </CompactListToolbar>
        </CompactListCardHeader>
        <CompactListCardContent>
          <CompactListTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>款号</TableHead>
                  <TableHead>款色</TableHead>
                  <TableHead>页签/行</TableHead>
                  <TableHead>基础信息</TableHead>
                  <TableHead>官方发布类目</TableHead>
                  <TableHead>唯品/抖音</TableHead>
                  <TableHead>上市时间</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>导入时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.spu_code}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.product_season || "-"}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.skc_code || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{item.sheet_name}</Badge>
                      <div className="mt-1 text-xs text-muted-foreground">第 {formatNumber(item.row_number)} 行</div>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <div className="truncate">{[item.product_line, item.scene, item.attribute].filter(Boolean).join(" / ") || "-"}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {[item.gender, item.category_name, item.subcategory_name, item.color_name].filter(Boolean).join(" / ") || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{categoryText(item)}</TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate">{item.vip_category || item.vip_style_category || "-"}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{item.douyin_category || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <div>{item.launch_date_text || item.content_launch_date_text || "-"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.listing_channel || item.search_launch_date_text || "-"}</div>
                    </TableCell>
                    <TableCell>{item.tag_price == null ? "-" : formatNumber(item.tag_price)}</TableCell>
                    <TableCell>{formatDateTime(item.imported_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CompactListTableFrame>
          <CursorPagination
            total={rows.data?.pagination.total ?? 0}
            limit={pagination.limit}
            hasPrevious={cursorStack.length > 0}
            hasNext={Boolean(rows.data?.nextCursor)}
            isLoading={rows.isFetching}
            onPrevious={() => {
              const previous = cursorStack.at(-1)
              setCursorStack((current) => current.slice(0, -1))
              setPagination((current) => ({
                ...current,
                afterSpuCode: previous?.afterSpuCode ?? null,
                afterRowId: previous?.afterRowId ?? null,
              }))
            }}
            onNext={() => {
              if (!rows.data?.nextCursor) return
              setCursorStack((current) => [...current, {
                afterSpuCode: pagination.afterSpuCode,
                afterRowId: pagination.afterRowId,
              }])
              setPagination((current) => ({
                ...current,
                afterSpuCode: rows.data.nextCursor?.afterSpuCode ?? null,
                afterRowId: rows.data.nextCursor?.afterRowId ?? null,
              }))
            }}
            onLimitChange={(limit) => {
              setCursorStack([])
              setPagination({ limit, afterSpuCode: null, afterRowId: null })
            }}
          />
        </CompactListCardContent>
      </CompactListCard>
    </CompactListPage>
  )
}
