import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { ServerPagination } from "@/components/server-pagination"
import { ImportDialog } from "@/components/import-dialog"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { readSpreadsheetWorkbook, type SpreadsheetRow } from "@/lib/spreadsheet"

interface ProductArchiveDraftRow {
  id: number
  draft_no: string
  spu_code: string
  title: string | null
  tenant_name: string
  merchant_id: string
  trade_path: string | null
  status: string
  blocker_count: number
  warning_count: number
  sku_count: number
  created_product_id: string | null
  updated_at: string
}

interface DraftListResponse {
  items: ProductArchiveDraftRow[]
  pagination: { total: number; limit: number; offset: number }
}

interface DraftBatchJob {
  id: string
  status: "queued" | "running" | "completed"
  total_count: number
  completed_count: number
  failed_count: number
  items?: Array<{
    spu_code: string
    status: "queued" | "running" | "completed" | "failed"
    error?: string | null
  }>
}

interface SourceImportResponse {
  inputRowCount: number
  insertedRowCount: number
  missingMdmSpuCodes?: string[]
  skippedExistingDraftCount?: number
  syncJob?: DraftBatchJob | null
}

type SourceImportType = "launch_plan" | "copywriting"

type BatchDraftAction = "validate" | "check_duplicate" | "submit_preview"

const statusLabels: Record<string, string> = {
  draft: "草稿",
  missing_fields: "缺字段",
  manual_review: "待人工判断",
  ready: "可创建",
  duplicate_found: "已存在",
  update_pending: "待更新策略",
  submitting: "创建中",
  created: "已创建",
  readback_verified: "回读通过",
  readback_mismatch: "回读不一致",
  failed: "失败",
}

function statusClass(status: string) {
  if (["ready", "created", "readback_verified"].includes(status)) return "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
  if (["missing_fields", "manual_review", "readback_mismatch"].includes(status)) return "border-[#f4ddb3] bg-[#fff8e8] text-[#c37d0d]"
  if (["failed", "duplicate_found"].includes(status)) return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  return "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
}

function useDrafts(query: string, status: string, pagination: { limit: number; offset: number }) {
  return useQuery<DraftListResponse>({
    queryKey: ["product-archive-drafts", query, status, pagination],
    queryFn: () =>
      api.get<DraftListResponse>(`/product-archive-drafts?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&limit=${pagination.limit}&offset=${pagination.offset}`),
  })
}

export default function ProductArchiveDraftsPage() {
  const queryClient = useQueryClient()
  const { addTask, getTaskByJobId, openTaskCenter } = useAsyncTasks()
  const [searchText, setSearchText] = useState("")
  const [status, setStatus] = useState("all")
  const [spuCode, setSpuCode] = useState("")
  const [batchCodes, setBatchCodes] = useState("")
  const [mdmBatchDialogOpen, setMdmBatchDialogOpen] = useState(false)
  const [mdmSyncDialogOpen, setMdmSyncDialogOpen] = useState(false)
  const [batchJobId, setBatchJobId] = useState<string | null>(null)
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(new Set())
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const debouncedQuery = useDebounce(searchText, 300)
  const drafts = useDrafts(debouncedQuery, status, pagination)
  const { data: batchJob } = useQuery<DraftBatchJob>({
    queryKey: ["product-archive-draft-batch-job", batchJobId],
    queryFn: () => api.get<DraftBatchJob>(`/product-archive-drafts/batch-jobs/${batchJobId}`),
    enabled: Boolean(batchJobId),
    refetchInterval: (query) => {
      const job = query.state.data
      return job && job.status !== "completed" ? 1500 : false
    },
    refetchOnWindowFocus: false,
  })

  const summary = useMemo(() => {
    const items = drafts.data?.items ?? []
    return {
      total: drafts.data?.pagination.total ?? 0,
      blockers: items.reduce((sum, item) => sum + Number(item.blocker_count ?? 0), 0),
      warnings: items.reduce((sum, item) => sum + Number(item.warning_count ?? 0), 0),
    }
  }, [drafts.data])

  const visibleItems = useMemo(() => drafts.data?.items ?? [], [drafts.data?.items])
  const selectedDrafts = useMemo(
    () => visibleItems.filter((item) => selectedDraftIds.has(item.id)),
    [selectedDraftIds, visibleItems],
  )

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedDraftIds.has(item.id))
  const trackedTask = getTaskByJobId(batchJobId)
  const trackedJob = (trackedTask?.job ?? batchJob) as DraftBatchJob | null | undefined
  const trackedJobProgress = trackedJob?.total_count
    ? Math.round(((trackedJob.completed_count + trackedJob.failed_count) / trackedJob.total_count) * 100)
    : 0
  const failedJobItems = trackedJob?.items?.filter((item) => item.status === "failed") ?? []

  const syncMdmAndCreateBatch = useMutation({
    mutationFn: (codes: string) =>
      api.post<DraftBatchJob>("/product-archive-drafts/mdm-batch", { codes }),
    onSuccess: (result) => {
      addTask({
        job: result as AsyncTaskJob,
        type: "product_archive_mdm_draft",
        title: "同步 MDM 并生成深绘草稿",
        description: `手动提交 ${formatNumber(result.total_count)} 个款号`,
      })
      setBatchJobId(result.id)
      setMdmSyncDialogOpen(true)
      setMdmBatchDialogOpen(false)
      setBatchCodes("")
      toast.success("MDM 同步并生成草稿任务已加入队列")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
  })

  const importSource = useMutation({
    mutationFn: async ({ sourceType, file }: { sourceType: SourceImportType; file: File }) => {
      const sheets = await readSpreadsheetWorkbook(file)
      let insertedRowCount = 0
      let inputRowCount = 0
      let autoSyncedCount = 0
      let skippedExistingDraftCount = 0
      const syncJobs: DraftBatchJob[] = []
      for (const sheet of sheets) {
        const result = await api.post<SourceImportResponse>("/product-archive-drafts/source-imports", {
          sourceType,
          fileName: file.name,
          sheetName: sheet.name,
          rows: sheet.rows as SpreadsheetRow[],
          autoSyncMissingMdm: sourceType === "launch_plan",
        })
        inputRowCount += result.inputRowCount
        insertedRowCount += result.insertedRowCount
        autoSyncedCount += result.missingMdmSpuCodes?.length ?? 0
        skippedExistingDraftCount += result.skippedExistingDraftCount ?? 0
        if (result.syncJob) syncJobs.push(result.syncJob)
      }
      return { inputRowCount, insertedRowCount, sheetCount: sheets.length, autoSyncedCount, skippedExistingDraftCount, syncJobs }
    },
    onSuccess: (result) => {
      if (result.syncJobs.length > 0) {
        for (const syncJob of result.syncJobs) {
          addTask({
            job: syncJob as AsyncTaskJob,
            type: "product_archive_mdm_draft",
            title: "上市计划表自动同步 MDM",
            description: `待同步 ${formatNumber(syncJob.total_count)} 个款号，已跳过已有草稿 ${formatNumber(result.skippedExistingDraftCount)} 个`,
          })
        }
        const latestSyncJob = result.syncJobs[result.syncJobs.length - 1]
        setBatchJobId(latestSyncJob.id)
        setMdmSyncDialogOpen(true)
      }
      const syncText = result.autoSyncedCount > 0
        ? `，自动同步 ${formatNumber(result.autoSyncedCount)} 个未建档款号`
        : ""
      toast.success(`导入完成：${formatNumber(result.insertedRowCount)} / ${formatNumber(result.inputRowCount)} 行，${formatNumber(result.sheetCount)} 个页签${syncText}`)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
  })

  const batchDraftAction = useMutation({
    mutationFn: async ({ action, draftIds }: { action: BatchDraftAction; draftIds: number[] }) => {
      for (const draftId of draftIds) {
        if (action === "validate") {
          await api.post<unknown>(`/product-archive-drafts/${draftId}/validate`)
        } else if (action === "check_duplicate") {
          await api.post<unknown>(`/product-archive-drafts/${draftId}/check-duplicate`)
        } else {
          await api.post<unknown>(`/product-archive-drafts/${draftId}/submit`, { dryRun: true })
        }
      }
      return { action, count: draftIds.length }
    },
    onSuccess: (result) => {
      const label = result.action === "validate" ? "校验" : result.action === "check_duplicate" ? "查重" : "提交预览"
      toast.success(`已完成 ${formatNumber(result.count)} 个草稿的${label}`)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
  })

  const batchJobActive = batchJob
    ? batchJob.status !== "completed"
    : syncMdmAndCreateBatch.isPending

  useEffect(() => {
    if (trackedJob?.status !== "completed") return
    void queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
  }, [trackedJob?.status, queryClient])

  function toggleDraft(draftId: number, checked: boolean | "indeterminate") {
    setSelectedDraftIds((current) => {
      const next = new Set(current)
      if (checked === true) next.add(draftId)
      else next.delete(draftId)
      return next
    })
  }

  function toggleAllVisible(checked: boolean | "indeterminate") {
    setSelectedDraftIds((current) => {
      const next = new Set(current)
      for (const item of visibleItems) {
        if (checked === true) next.add(item.id)
        else next.delete(item.id)
      }
      return next
    })
  }

  function runBatchAction(action: BatchDraftAction) {
    if (selectedDrafts.length === 0) {
      toast.info("请先选择草稿")
      return
    }
    batchDraftAction.mutate({ action, draftIds: selectedDrafts.map((item) => item.id) })
  }

  async function importSourceFile(sourceType: SourceImportType, file: File) {
    await importSource.mutateAsync({ sourceType, file })
  }

  return (
    <>
    <CompactListPage>
      <CompactListHeader
        title="深绘建档草稿"
        description="先同步 MDM 款号，再导入上市计划表和标准文案表，最后按深绘类目模板完成字段填充、校验和提交预览。"
        summary={`共 ${formatNumber(summary.total)} 个草稿`}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedDrafts.length === 0 || batchDraftAction.isPending}
              onClick={() => runBatchAction("validate")}
            >
              <ShieldCheck className="size-4" />
              批量校验{selectedDrafts.length ? ` ${selectedDrafts.length}` : ""}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedDrafts.length === 0 || batchDraftAction.isPending}
              onClick={() => runBatchAction("check_duplicate")}
            >
              <Search className="size-4" />
              批量查重{selectedDrafts.length ? ` ${selectedDrafts.length}` : ""}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedDrafts.length === 0 || batchDraftAction.isPending}
              onClick={() => runBatchAction("submit_preview")}
            >
              <CheckCircle2 className="size-4" />
              批量提交预览{selectedDrafts.length ? ` ${selectedDrafts.length}` : ""}
            </Button>
          </>
        }
      />

      <CompactListCard>
        <CompactListCardHeader>
          <CompactListToolbar>
            <div className="min-w-0">
              <CardTitle className="text-base">草稿列表</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                阻断 {formatNumber(summary.blockers)} 项，警告 {formatNumber(summary.warnings)} 项
                {batchJob ? `，批量任务 ${formatNumber(batchJob.completed_count + batchJob.failed_count)} / ${formatNumber(batchJob.total_count)}` : ""}
              </p>
            </div>
            <CompactListControls>
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value)
                    setPagination((current) => ({ ...current, offset: 0 }))
                  }}
                  placeholder="搜索款号、标题、类目"
                  className="pl-8"
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value)
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={spuCode}
                onChange={(event) => setSpuCode(event.target.value)}
                placeholder="输入款号，可批量粘贴"
                className="w-[180px]"
              />
              <Dialog open={mdmBatchDialogOpen} onOpenChange={setMdmBatchDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    disabled={batchJobActive}
                    onClick={() => setBatchCodes((current) => current || spuCode.trim())}
                  >
                    {syncMdmAndCreateBatch.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    同步 MDM 并生成草稿
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>同步 MDM 并生成草稿</DialogTitle>
                    <DialogDescription>
                      按款号批量拉取 MDM 同款数据，落库后生成深绘建档草稿。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-2">
                    <label htmlFor="mdm-batch-codes" className="text-sm font-medium">
                      款号列表
                    </label>
                    <Textarea
                      id="mdm-batch-codes"
                      value={batchCodes}
                      onChange={(event) => setBatchCodes(event.target.value)}
                      placeholder={"SPU001\nSPU002\nSPU003"}
                      className="min-h-40 font-mono text-sm"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMdmBatchDialogOpen(false)}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      disabled={!batchCodes.trim() || syncMdmAndCreateBatch.isPending}
                      onClick={() => syncMdmAndCreateBatch.mutate(batchCodes)}
                    >
                      {syncMdmAndCreateBatch.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      开始同步
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <ImportDialog
                title="导入上市计划表"
                description="兼容上市计划表的错位表头和官方发布类目、上市时间等字段，用于批量填充草稿。"
                trigger={<Button type="button" variant="outline" size="sm" disabled={importSource.isPending}>导入上市计划表</Button>}
                onImport={(file) => importSourceFile("launch_plan", file)}
              />
              <ImportDialog
                title="导入标准文案表"
                description="兼容标准文案表多页签，提取搜索标题、内容平台标题、FAB、面料成分等文案字段。"
                trigger={<Button type="button" variant="outline" size="sm" disabled={importSource.isPending}>导入标准文案表</Button>}
                onImport={(file) => importSourceFile("copywriting", file)}
              />
            </CompactListControls>
          </CompactListToolbar>
        </CompactListCardHeader>
        <CompactListCardContent>
          <CompactListTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="选择全部草稿"
                      checked={allVisibleSelected}
                      onCheckedChange={toggleAllVisible}
                    />
                  </TableHead>
                  <TableHead>款号</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>租户/商户</TableHead>
                  <TableHead>类目</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>问题</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>productId</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drafts.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`选择草稿 ${item.spu_code}`}
                        checked={selectedDraftIds.has(item.id)}
                        onCheckedChange={(checked) => toggleDraft(item.id, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link to={`/product-archive-drafts/${item.id}`} className="font-medium text-primary hover:underline">
                        {item.spu_code}
                      </Link>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{item.draft_no}</div>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">{item.title || "未命名"}</TableCell>
                    <TableCell>
                      <div>{item.tenant_name}</div>
                      <div className="text-xs text-muted-foreground">{item.merchant_id}</div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{item.trade_path || "待确认"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass(item.status)}>
                        {statusLabels[item.status] ?? item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-[#d45656]">{item.blocker_count}</span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      <span className="text-[#c37d0d]">{item.warning_count}</span>
                    </TableCell>
                    <TableCell>{formatNumber(item.sku_count)}</TableCell>
                    <TableCell>{item.created_product_id || "-"}</TableCell>
                    <TableCell>{formatDateTime(item.updated_at)}</TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/product-archive-drafts/${item.id}`}>
                          进入
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CompactListTableFrame>
          <ServerPagination
            pagination={drafts.data?.pagination}
            onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
            isLoading={drafts.isFetching}
          />
        </CompactListCardContent>
      </CompactListCard>
    </CompactListPage>
    <Dialog open={mdmSyncDialogOpen} onOpenChange={setMdmSyncDialogOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>MDM 同步进度</DialogTitle>
          <DialogDescription>
            正在按未建档款号同步 MDM 并生成深绘建档草稿，关闭弹窗后可从左上角异步任务继续查看。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>
                已处理 {formatNumber((trackedJob?.completed_count ?? 0) + (trackedJob?.failed_count ?? 0))} / {formatNumber(trackedJob?.total_count ?? 0)}
              </span>
              <span>{trackedJobProgress}%</span>
            </div>
            <Progress value={trackedJobProgress} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-md bg-background px-3 py-2">成功 {formatNumber(trackedJob?.completed_count ?? 0)}</div>
              <div className="rounded-md bg-background px-3 py-2">失败 {formatNumber(trackedJob?.failed_count ?? 0)}</div>
              <div className="rounded-md bg-background px-3 py-2">总数 {formatNumber(trackedJob?.total_count ?? 0)}</div>
            </div>
          </div>
          {failedJobItems.length > 0 ? (
            <div className="rounded-lg border border-[#f1cccc] bg-[#fff8f8] p-3">
              <div className="mb-2 text-sm font-medium text-[#d45656]">失败原因</div>
              <div className="max-h-52 overflow-auto rounded-md border bg-background">
                {failedJobItems.map((item) => (
                  <div key={item.spu_code} className="grid grid-cols-[160px_1fr] gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                    <span className="font-mono">{item.spu_code}</span>
                    <span className="text-muted-foreground">{item.error || "未知失败原因"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              暂无失败款号。
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setMdmSyncDialogOpen(false)}>
            最小化到任务中心
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMdmSyncDialogOpen(false)
              openTaskCenter()
            }}
          >
            查看任务中心
          </Button>
          <Button type="button" onClick={() => setMdmSyncDialogOpen(false)}>
            {trackedJob?.status === "completed" ? "关闭" : "后台处理"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
