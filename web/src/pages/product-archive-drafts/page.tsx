import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Download, FileSpreadsheet, FileText, Loader2, PackagePlus, RefreshCw, Search, Send, ShieldCheck, Upload } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { ImportDialog } from "@/components/import-dialog"
import { ServerPagination } from "@/components/server-pagination"
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

interface WorkflowImportSummary {
  fileName: string
  inputRowCount: number
  insertedRowCount: number
  sheetCount?: number
  spuCodes?: string[]
}

interface ProductArchiveWorkflowResponse {
  status: "queued" | "needs_launch_plan"
  needsLaunchPlan: boolean
  message?: string
  candidateCodes?: string[]
  draftQueuedCount?: number
  skippedExistingDraftCount?: number
  missingLaunchPlanSpuCodes?: string[]
  syncJob?: DraftBatchJob | null
  copywritingImport?: WorkflowImportSummary | null
  launchPlanImport?: WorkflowImportSummary | null
  refreshSummaries?: Array<{
    scannedDraftCount: number
    refreshedDraftCount: number
    autoAppliedTradeCount: number
    skippedNoTradeMatchCount: number
  }>
}

interface SourceImportUploadResponse {
  sourceType: string
  inputRowCount: number
  insertedRowCount: number
  sheetCount: number
  missingMdmSpuCodes?: string[]
  skippedExistingDraftCount?: number
  syncJob?: DraftBatchJob | null
  syncJobs?: DraftBatchJob[]
}

type BatchDraftAction = "validate" | "check_duplicate" | "submit_preview" | "submit_publish"

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

function useDrafts(query: string, status: string, pagination: { limit: number; offset: number }, spuCodes: string) {
  return useQuery<DraftListResponse>({
    queryKey: ["product-archive-drafts", query, status, pagination, spuCodes],
    queryFn: () =>
      api.get<DraftListResponse>(`/product-archive-drafts?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&limit=${pagination.limit}&offset=${pagination.offset}${spuCodes.trim() ? `&spuCodes=${encodeURIComponent(spuCodes)}` : ""}`),
  })
}

function multiLineCodeCount(value: string) {
  return value.split(/[\s,，;；]+/).map((item) => item.trim()).filter(Boolean).length
}

interface StartProductArchiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  copywritingFile: File | null
  onCopywritingFileChange: (file: File | null) => void
  launchPlanFile: File | null
  onLaunchPlanFileChange: (file: File | null) => void
  skipLaunchPlan: boolean
  onSkipLaunchPlanChange: (checked: boolean) => void
  workflowResult: ProductArchiveWorkflowResponse | null
  isPending: boolean
  onSubmit: () => void
}

function StartProductArchiveDialog({
  open,
  onOpenChange,
  copywritingFile,
  onCopywritingFileChange,
  launchPlanFile,
  onLaunchPlanFileChange,
  skipLaunchPlan,
  onSkipLaunchPlanChange,
  workflowResult,
  isPending,
  onSubmit,
}: StartProductArchiveDialogProps) {
  const missingLaunchPlanSpuCodes = workflowResult?.missingLaunchPlanSpuCodes ?? []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <PackagePlus className="size-4" />
          开始商品建档
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>开始商品建档</DialogTitle>
          <DialogDescription>
            按标准文案表和上市计划表里的款号生成草稿，缺少 MDM 主数据时系统会自动同步。
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[68vh] gap-4 overflow-auto pr-1">
          <section className="rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">1. 导入标准文案表</Badge>
                <span className="text-sm text-muted-foreground">按表内款号自动匹配 MDM</span>
              </div>
              <Button asChild type="button" variant="outline" size="sm">
                <a href="/api/product-archive-drafts/templates/copywriting" download>
                  <Download className="size-4" />
                  下载标准文案模板
                </a>
              </Button>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3 text-sm hover:bg-muted/40">
              <span className="flex min-w-0 items-center gap-2">
                <Upload className="size-4 text-muted-foreground" />
                <span className="truncate">{copywritingFile?.name ?? "选择标准文案表 .xlsx / .csv"}</span>
              </span>
              <Input
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(event) => onCopywritingFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
          </section>

          <section className="rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">2. 匹配/导入上市计划</Badge>
                <span className="text-sm text-muted-foreground">已有上市计划可跳过上传</span>
              </div>
              <Button asChild type="button" variant="outline" size="sm">
                <a href="/api/product-archive-drafts/templates/launch-plan" download>
                  <Download className="size-4" />
                  下载上市计划模板
                </a>
              </Button>
            </div>
            <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3 text-sm hover:bg-muted/40">
              <span className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <span className="truncate">{launchPlanFile?.name ?? "选择上市计划表 .xlsx / .csv"}</span>
              </span>
              <Input
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(event) => onLaunchPlanFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={skipLaunchPlan}
                onCheckedChange={(checked) => onSkipLaunchPlanChange(checked === true)}
              />
              系统中已有上市计划，本次跳过上传
            </label>
            {missingLaunchPlanSpuCodes.length > 0 ? (
              <div className="mt-3 rounded-md border border-[#f4ddb3] bg-[#fff8e8] p-3 text-sm text-[#8a5d08]">
                <div className="font-medium">标准文案表中有 {formatNumber(missingLaunchPlanSpuCodes.length)} 个款号未匹配上市计划</div>
                <div className="mt-2 max-h-20 overflow-auto font-mono text-xs">
                  {missingLaunchPlanSpuCodes.slice(0, 80).join("\n")}
                </div>
              </div>
            ) : null}
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={isPending || (!copywritingFile && !launchPlanFile)}
            onClick={onSubmit}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
            生成建档草稿
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProductArchiveDraftsPage() {
  const queryClient = useQueryClient()
  const { addTask, getTaskByJobId, openTaskCenter } = useAsyncTasks()
  const [searchText, setSearchText] = useState("")
  const [multiLineSearchOpen, setMultiLineSearchOpen] = useState(false)
  const [multiLineSpuCodes, setMultiLineSpuCodes] = useState("")
  const [appliedMultiLineSpuCodes, setAppliedMultiLineSpuCodes] = useState("")
  const [status, setStatus] = useState("all")
  const [mdmDialogOpen, setMdmDialogOpen] = useState(false)
  const [mdmCodes, setMdmCodes] = useState("")
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false)
  const [workflowProgressDialogOpen, setWorkflowProgressDialogOpen] = useState(false)
  const [copywritingFile, setCopywritingFile] = useState<File | null>(null)
  const [launchPlanFile, setLaunchPlanFile] = useState<File | null>(null)
  const [skipLaunchPlan, setSkipLaunchPlan] = useState(false)
  const [workflowResult, setWorkflowResult] = useState<ProductArchiveWorkflowResponse | null>(null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [batchJobId, setBatchJobId] = useState<string | null>(null)
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(new Set())
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const debouncedQuery = useDebounce(searchText, 300)
  const drafts = useDrafts(debouncedQuery, status, pagination, appliedMultiLineSpuCodes)
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
  const appliedMultiLineCount = multiLineCodeCount(appliedMultiLineSpuCodes)

  const syncMdmAndCreateBatch = useMutation({
    mutationFn: () => api.post<DraftBatchJob>("/product-archive-drafts/mdm-batch", {
      codes: mdmCodes,
    }),
    onSuccess: (job) => {
      addTask({
        job: job as AsyncTaskJob,
        type: "product_archive_mdm_draft",
        title: "MDM 同步建档",
        description: `待同步并生成 ${formatNumber(job.total_count)} 个深绘建档草稿`,
      })
      setBatchJobId(job.id)
      setWorkflowProgressDialogOpen(true)
      setMdmDialogOpen(false)
      setMdmCodes("")
      toast.success("MDM 同步建档任务已加入队列")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "MDM 同步建档失败")
    },
  })

  const importCopywriting = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      form.append("sourceType", "copywriting")
      form.append("autoSyncMissingMdm", "true")
      return api.postForm<SourceImportUploadResponse>("/product-archive-drafts/source-imports/upload", form)
    },
    onSuccess: (result) => {
      const syncJobs = result.syncJobs?.length ? result.syncJobs : result.syncJob ? [result.syncJob] : []
      for (const job of syncJobs) {
        addTask({
          job: job as AsyncTaskJob,
          type: "product_archive_mdm_draft",
          title: "导入标准文案表",
          description: `补齐来源后待生成 ${formatNumber(job.total_count)} 个深绘建档草稿`,
        })
      }
      const latestJob = syncJobs.at(-1)
      if (latestJob) {
        setBatchJobId(latestJob.id)
        setWorkflowProgressDialogOpen(true)
      }
      toast.success(
        `导入标准文案表完成：${formatNumber(result.insertedRowCount)} / ${formatNumber(result.inputRowCount)} 行${latestJob ? "，缺失草稿已自动同步" : ""}`,
      )
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "导入标准文案表失败")
    },
  })

  const startProductArchiveWorkflow = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append("skipLaunchPlan", skipLaunchPlan ? "true" : "false")
      if (copywritingFile) form.append("copywritingFile", copywritingFile)
      if (launchPlanFile) form.append("launchPlanFile", launchPlanFile)
      return api.postForm<ProductArchiveWorkflowResponse>("/product-archive-drafts/workflow/start", form)
    },
    onSuccess: (result) => {
      setWorkflowResult(result)
      if (result.needsLaunchPlan) {
        toast.warning(result.message ?? "请上传上市计划表后继续建档")
        return
      }
      if (result.syncJob) {
        addTask({
          job: result.syncJob as AsyncTaskJob,
          type: "product_archive_mdm_draft",
          title: "开始商品建档",
          description: `待生成 ${formatNumber(result.syncJob.total_count)} 个深绘建档草稿`,
        })
        setBatchJobId(result.syncJob.id)
        setWorkflowProgressDialogOpen(true)
        toast.success("商品建档任务已加入队列")
      } else {
        toast.success("来源数据已导入，当前款号已有对应草稿")
      }
      setWorkflowDialogOpen(false)
      setCopywritingFile(null)
      setLaunchPlanFile(null)
      setSkipLaunchPlan(false)
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
        } else if (action === "submit_publish") {
          await api.post<unknown>(`/product-archive-drafts/${draftId}/submit`, { dryRun: false })
        } else {
          await api.post<unknown>(`/product-archive-drafts/${draftId}/submit`, { dryRun: true })
        }
      }
      return { action, count: draftIds.length }
    },
    onSuccess: (result) => {
      const label = result.action === "validate"
        ? "校验"
        : result.action === "check_duplicate"
          ? "查重"
          : result.action === "submit_publish"
            ? "发布到深绘"
            : "提交预览"
      toast.success(`已完成 ${formatNumber(result.count)} 个草稿的${label}`)
      if (result.action === "submit_publish") setSelectedDraftIds(new Set())
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "批量操作失败")
    },
  })

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

  return (
    <>
    <CompactListPage>
      <CompactListHeader
        title="深绘建档草稿"
        description="按标准文案表和上市计划表里的款号生成草稿，系统自动补齐缺失 MDM，再按深绘类目模板完成字段填充、校验和提交预览。"
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
            <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedDrafts.length === 0 || batchDraftAction.isPending}
                >
                  {batchDraftAction.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  批量发布到深绘{selectedDrafts.length ? ` ${selectedDrafts.length}` : ""}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>批量发布到深绘</DialogTitle>
                  <DialogDescription>
                    将对已选择的 {formatNumber(selectedDrafts.length)} 个草稿执行真实深绘建档。系统会逐个查重、提交并回读校验。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setPublishDialogOpen(false)}>
                    取消
                  </Button>
                  <Button
                    type="button"
                    disabled={selectedDrafts.length === 0 || batchDraftAction.isPending}
                    onClick={() => {
                      setPublishDialogOpen(false)
                      runBatchAction("submit_publish")
                    }}
                  >
                    {batchDraftAction.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    确认发布到深绘
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
              <Dialog open={multiLineSearchOpen} onOpenChange={setMultiLineSearchOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Search className="size-4" />
                    多行款号搜索{appliedMultiLineCount ? ` ${appliedMultiLineCount}` : ""}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>多行款号搜索</DialogTitle>
                    <DialogDescription>
                      一行一个款号，也支持从表格复制多行或用逗号分隔。
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={multiLineSpuCodes}
                    onChange={(event) => setMultiLineSpuCodes(event.target.value)}
                    placeholder={"208326105214\n209326133201"}
                    className="min-h-48 font-mono text-sm"
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMultiLineSpuCodes("")
                        setAppliedMultiLineSpuCodes("")
                        setPagination((current) => ({ ...current, offset: 0 }))
                        setMultiLineSearchOpen(false)
                      }}
                    >
                      清空
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setAppliedMultiLineSpuCodes(multiLineSpuCodes)
                        setPagination((current) => ({ ...current, offset: 0 }))
                        setMultiLineSearchOpen(false)
                      }}
                    >
                      应用搜索
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
              <Dialog open={mdmDialogOpen} onOpenChange={setMdmDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={syncMdmAndCreateBatch.isPending}>
                    {syncMdmAndCreateBatch.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    MDM 同步建档
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>MDM 同步建档</DialogTitle>
                    <DialogDescription>
                      粘贴需要同步 MDM 并生成深绘建档草稿的款号，支持多行复制。
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={mdmCodes}
                    onChange={(event) => setMdmCodes(event.target.value)}
                    placeholder={"208326105214\n209326133201"}
                    className="min-h-48 font-mono text-sm"
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setMdmDialogOpen(false)}>
                      取消
                    </Button>
                    <Button
                      type="button"
                      disabled={syncMdmAndCreateBatch.isPending || !mdmCodes.trim()}
                      onClick={() => syncMdmAndCreateBatch.mutate()}
                    >
                      {syncMdmAndCreateBatch.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      开始同步
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <ImportDialog
                title="导入标准文案表"
                description="导入后会刷新已有草稿字段；没有 MDM/草稿的款号会自动进入同步建档队列。"
                trigger={
                  <Button type="button" variant="outline" size="sm" disabled={importCopywriting.isPending}>
                    {importCopywriting.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                    导入标准文案表
                  </Button>
                }
                onImport={async (file) => {
                  await importCopywriting.mutateAsync(file)
                }}
              />
              <StartProductArchiveDialog
                open={workflowDialogOpen}
                onOpenChange={(open) => {
                  setWorkflowDialogOpen(open)
                  if (open) setWorkflowResult(null)
                }}
                copywritingFile={copywritingFile}
                onCopywritingFileChange={setCopywritingFile}
                launchPlanFile={launchPlanFile}
                onLaunchPlanFileChange={setLaunchPlanFile}
                skipLaunchPlan={skipLaunchPlan}
                onSkipLaunchPlanChange={setSkipLaunchPlan}
                workflowResult={workflowResult}
                isPending={startProductArchiveWorkflow.isPending}
                onSubmit={() => startProductArchiveWorkflow.mutate()}
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
    <Dialog open={workflowProgressDialogOpen} onOpenChange={setWorkflowProgressDialogOpen}>
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
          <Button type="button" variant="outline" onClick={() => setWorkflowProgressDialogOpen(false)}>
            最小化到任务中心
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setWorkflowProgressDialogOpen(false)
              openTaskCenter()
            }}
          >
            查看任务中心
          </Button>
          <Button type="button" onClick={() => setWorkflowProgressDialogOpen(false)}>
            {trackedJob?.status === "completed" ? "关闭" : "后台处理"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
