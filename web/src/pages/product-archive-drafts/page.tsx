import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, CircleHelp, Download, FileSpreadsheet, FileText, Loader2, PackagePlus, RefreshCw, Search, Send, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
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
import { QueryErrorState } from "@/components/query-error-state"
import { ConfirmDialog } from "@/components/confirm-dialog"

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
  image_count: number
  thumbnail_image_url: string | null
  thumbnail_file_name: string | null
  asset_package_image_count: number
  hangtag_upload_count: number
  washlabel_upload_count: number
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
  sizeChartImport?: WorkflowImportSummary | null
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

interface HangtagWashlabelOcrTargetField {
  fieldId: number
  fieldName: string
  fieldKey: string
  label: string
  valueText: string
  currentValueText: string
  sourceType: string
  sourceRef: string
  confidence: "high" | "medium" | "low" | string
  evidenceText: string
  willApply: boolean
  skippedReason: string | null
}

interface HangtagWashlabelOcrPreviewItem {
  fileName: string
  fileType: string
  sourceKind: string
  status: "ready" | "all_skipped" | "unmatched" | "ocr_failed" | "no_style_code" | "no_fields" | "no_target_fields"
  error: string | null
  detectedSpuCode: string | null
  pageCount: number
  matchedDraft: {
    id: number
    spuCode: string
    title: string | null
    status: string
  } | null
  extractedFields: Array<{
    key: string
    label: string
    value: string
    confidence: string
    evidenceText: string
    pageNumber: number | null
  }>
  targetFields: HangtagWashlabelOcrTargetField[]
  warnings: string[]
}

type HangtagWashlabelOcrExtractedField = HangtagWashlabelOcrPreviewItem["extractedFields"][number]

interface HangtagWashlabelOcrPreviewResponse {
  overwriteExisting: boolean
  provider?: {
    kind: string
    usedKinds?: string[]
    lang: string
    pdfRenderer: string
  }
  scmSupplement?: {
    files: Array<{
      fileName: string
      sheetCount: number
      documentCount: number
    }>
  }
  referenceImages?: {
    fileCount: number
  }
  summary: {
    fileCount: number
    matchedCount: number
    readyCount: number
    unmatchedCount: number
    failedCount: number
    extractedFieldCount: number
    writableFieldCount: number
    skippedFieldCount: number
    warningCount: number
  }
  items: HangtagWashlabelOcrPreviewItem[]
}

interface HangtagWashlabelOcrApplyResponse {
  summary: {
    appliedDraftCount: number
    appliedFieldCount: number
    skippedCount: number
  }
  referenceImageImport?: ProductArchiveDraftImageImportResponse | null
}

interface ProductArchiveDraftImageImportResponse {
  ok: boolean
  summary: {
    fileCount: number
    importedCount: number
    matchedDraftCount: number
    skippedCount: number
    sourceType?: string
  }
  items: Array<{
    fileName: string
    spuCode?: string
    draftId?: number
    ok: boolean
    status: "imported" | "skipped" | string
    reason?: string
  }>
}

const PRODUCT_ARCHIVE_DRAFT_GUIDE_STORAGE_KEY = "listingify.product_archive_draft_guide_seen.v1"

function hasSeenProductArchiveDraftGuide() {
  if (typeof window === "undefined") return true
  try {
    return window.localStorage.getItem(PRODUCT_ARCHIVE_DRAFT_GUIDE_STORAGE_KEY) === "seen"
  } catch {
    return false
  }
}

function markProductArchiveDraftGuideSeen() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PRODUCT_ARCHIVE_DRAFT_GUIDE_STORAGE_KEY, "seen")
  } catch {
    // The guide is non-critical; storage failures should not interrupt draft operations.
  }
}

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

const ocrStatusLabels: Record<HangtagWashlabelOcrPreviewItem["status"], string> = {
  ready: "可写入",
  all_skipped: "已识别但跳过",
  unmatched: "未匹配草稿",
  ocr_failed: "识别失败",
  no_style_code: "缺少款号",
  no_fields: "未识别字段",
  no_target_fields: "无对应字段",
}

function ocrStatusClass(status: HangtagWashlabelOcrPreviewItem["status"]) {
  if (status === "ready") return "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
  if (status === "all_skipped" || status === "no_target_fields" || status === "no_fields") return "border-[#f4ddb3] bg-[#fff8e8] text-[#c37d0d]"
  return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
}

function confidenceLabel(value: string) {
  if (value === "high") return "高"
  if (value === "medium") return "中"
  if (value === "low") return "低"
  return value || "-"
}

function asyncJobProgress(job?: AsyncTaskJob | null) {
  if (!job?.total_count) return 0
  const progress = Math.round(((job.completed_count + job.failed_count) / job.total_count) * 100)
  if (job.status !== "completed") return Math.min(99, progress)
  return progress
}

function numberResultValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function recordResultValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function hangtagWashlabelOcrJobSummary(job?: AsyncTaskJob | null) {
  const result = recordResultValue(job?.result)
  const applySummary = recordResultValue(result?.applySummary)
  if (!applySummary) return null
  const previewSummary = recordResultValue(result?.previewSummary)
  const imageImportSummary = recordResultValue(result?.imageImportSummary)
  return {
    appliedDraftCount: numberResultValue(applySummary.appliedDraftCount),
    appliedFieldCount: numberResultValue(applySummary.appliedFieldCount),
    skippedCount: numberResultValue(applySummary.skippedCount),
    matchedCount: numberResultValue(previewSummary?.matchedCount),
    writableFieldCount: numberResultValue(previewSummary?.writableFieldCount),
    importedImageCount: numberResultValue(imageImportSummary?.importedCount),
    overwriteExisting: result?.overwriteExisting === true,
  }
}

function isCollapsedOcrCaptureField(field: HangtagWashlabelOcrExtractedField) {
  return field.key === "rawText" || /截取/.test(field.label) || field.value.length > 96
}

function buildHangtagWashlabelOcrForm(files: File[], scmSupplementFile: File | null, overwriteExisting: boolean, referenceImageFiles: File[] = []) {
  const form = new FormData()
  for (const file of files) {
    form.append("files", file)
    form.append("filePaths", uploadDisplayName(file))
  }
  for (const file of referenceImageFiles) {
    form.append("referenceImages", file)
    form.append("filePaths", uploadDisplayName(file))
  }
  if (scmSupplementFile) {
    form.append("scmSupplementFile", scmSupplementFile)
    form.append("filePaths", uploadDisplayName(scmSupplementFile))
  }
  if (referenceImageFiles.length > 0) form.append("assetPackage", "true")
  form.append("overwriteExisting", overwriteExisting ? "true" : "false")
  return form
}

function OcrExtractedFieldLine({ field }: { field: HangtagWashlabelOcrExtractedField }) {
  const [expanded, setExpanded] = useState(false)
  const collapsible = isCollapsedOcrCaptureField(field)
  return (
    <div className="min-w-0 rounded-md bg-muted/30 px-2 py-1.5 text-xs">
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-medium">{field.label}</span>
        <span className="text-muted-foreground">· {confidenceLabel(field.confidence)}</span>
      </div>
      <div className={`mt-1 whitespace-pre-wrap break-words text-foreground ${collapsible && !expanded ? "line-clamp-2" : ""}`}>
        {field.value}
      </div>
      {collapsible ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="mt-1 h-6 px-1.5 text-muted-foreground"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {expanded ? "收起" : "展开"}
        </Button>
      ) : null}
    </div>
  )
}

function uploadDisplayName(file: File) {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return relativePath || file.name
}

function uploadBaseName(file: File) {
  return uploadDisplayName(file).split("/").pop() ?? file.name
}

function uploadExtension(file: File) {
  return uploadBaseName(file).split(".").pop()?.toLowerCase() ?? ""
}

function isHiddenUploadFile(file: File) {
  const name = uploadBaseName(file)
  return name === ".DS_Store" || name.startsWith("~$")
}

function isScmSupplementUploadFile(file: File) {
  return ["xlsx", "xlsm"].includes(uploadExtension(file))
}

function isSpuReferenceImageUploadFile(file: File) {
  return ["jpg", "jpeg", "png", "webp"].includes(uploadExtension(file))
}

function isHangtagWashlabelEvidenceUploadFile(file: File) {
  const name = uploadBaseName(file)
  const extension = uploadExtension(file)
  if (extension === "pdf") return true
  if (!["jpg", "jpeg", "png"].includes(extension)) return false
  return /(吊牌|合格证|hangtag|tag|洗唛|洗标|水洗|wash)/i.test(name)
}

function splitHangtagWashlabelUploads(files: File[]) {
  const ocrFiles: File[] = []
  const referenceImageFiles: File[] = []
  let scmSupplementFile: File | null = null
  let skippedCount = 0
  for (const file of files) {
    if (isHiddenUploadFile(file)) {
      skippedCount += 1
      continue
    }
    if (isHangtagWashlabelEvidenceUploadFile(file)) {
      ocrFiles.push(file)
      continue
    }
    if (isSpuReferenceImageUploadFile(file)) {
      referenceImageFiles.push(file)
      continue
    }
    if (isScmSupplementUploadFile(file) && !scmSupplementFile) {
      scmSupplementFile = file
      continue
    }
    skippedCount += 1
  }
  return { ocrFiles, referenceImageFiles, scmSupplementFile, skippedCount }
}

function buildSpuImageImportForm(files: File[], sourceType?: string) {
  const form = new FormData()
  for (const file of files) {
    form.append("files", file)
    form.append("filePaths", uploadDisplayName(file))
  }
  if (sourceType) form.append("sourceType", sourceType)
  return form
}

function DraftThumbnail({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-muted text-[11px] text-muted-foreground">
        无图
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={label}
      title={label}
      className="h-14 w-14 rounded-md border bg-muted object-cover"
      loading="eager"
      onError={() => setFailed(true)}
    />
  )
}

interface ProductArchiveDraftGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ProductArchiveDraftGuideDialog({ open, onOpenChange }: ProductArchiveDraftGuideDialogProps) {
  const workflowSteps = [
    {
      title: "准备来源文件",
      body: "先准备标准文案表。上市计划用于匹配深绘类目，尺码表、吊牌/洗唛/平铺图可在后续按款号批量补充。",
    },
    {
      title: "开始商品建档",
      body: "点击列表右侧的开始商品建档，上传标准文案表和上市计划表。系统会导入来源数据、同步缺失 MDM，并生成或刷新草稿。",
    },
    {
      title: "补充识别资料",
      body: "导入吊牌/洗唛/平铺图后可提交后台识别，识别完成会自动回填空字段；平铺图和模拍图会作为 AI 判断款式、版型、材质观感的参考。",
    },
    {
      title: "处理草稿详情",
      body: "进入草稿后确认深绘类目，检查字段填充。AI 推荐补齐只会基于 MDM、来源表、已填草稿字段、OCR 和参考图做保守判断。",
    },
    {
      title: "校验并发布",
      body: "先执行批量发布预检，系统会依次校验、查重并生成提交预览。确认没有阻断问题后，选择草稿批量发布到深绘并等待回读校验。",
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>深绘建档草稿使用指南</DialogTitle>
          <DialogDescription>
            按下面顺序处理，能把来源导入、MDM 同步、类目确认、AI 补齐、校验查重和深绘发布串成一条稳定流程。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-md border border-[#b9f4d8] bg-[#f2fff8] px-3 py-2 text-sm text-[#08794f]">
            推荐路径：标准文案表建草稿 → 上市计划匹配类目 → 吊牌/洗唛/平铺图补证据 → 详情页确认字段 → 批量发布预检和发布。
          </div>
          <div className="rounded-md border border-[#cfe8ff] bg-[#f6fbff] px-3 py-2 text-sm leading-6 text-[#0f5c8c]">
            尺码表、吊牌/洗唛/平铺图可以通过抓虾自动化抓取；需要采集工具时前往{" "}
            <a
              href="https://crawshrimp.com/download"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4 hover:text-[#083f63]"
            >
              crawshrimp.com/download
            </a>{" "}
            下载。
          </div>
          <div className="grid gap-2">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="grid grid-cols-[2rem_1fr] gap-3 rounded-md border bg-background px-3 py-2.5">
                <div className="flex size-8 items-center justify-center rounded-full bg-[#d4fae8] text-sm font-semibold text-[#0fa76e]">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{step.title}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
            文件按款号关联：目录名或文件名里包含 12 位款号即可匹配。涉及执行标准、成分、材质等强证据字段时，没有可信来源就保留缺失，避免猜错后发布失败。
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface StartProductArchiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  copywritingFile: File | null
  onCopywritingFileChange: (file: File | null) => void
  launchPlanFile: File | null
  onLaunchPlanFileChange: (file: File | null) => void
  sizeChartFile: File | null
  onSizeChartFileChange: (file: File | null) => void
  skipLaunchPlan: boolean
  onSkipLaunchPlanChange: (checked: boolean) => void
  workflowResult: ProductArchiveWorkflowResponse | null
  isPending: boolean
  canWrite: boolean
  onSubmit: () => void
}

function StartProductArchiveDialog({
  open,
  onOpenChange,
  copywritingFile,
  onCopywritingFileChange,
  launchPlanFile,
  onLaunchPlanFileChange,
  sizeChartFile,
  onSizeChartFileChange,
  skipLaunchPlan,
  onSkipLaunchPlanChange,
  workflowResult,
  isPending,
  canWrite,
  onSubmit,
}: StartProductArchiveDialogProps) {
  const missingLaunchPlanSpuCodes = workflowResult?.missingLaunchPlanSpuCodes ?? []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" disabled={!canWrite}>
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
                <span className="text-sm text-muted-foreground">可重复上传，同款号按最新表覆盖</span>
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

          <section className="rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">3. 导入尺码表模板</Badge>
                <span className="text-sm text-muted-foreground">支持 PLM 导出的宽表/长表，按款号自动补齐深绘尺码表。</span>
              </div>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3 text-sm hover:bg-muted/40">
              <span className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <span className="truncate">{sizeChartFile?.name ?? "选择 PLM 尺码表 .xlsx / .csv"}</span>
              </span>
              <Input
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(event) => onSizeChartFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!canWrite || isPending || (!copywritingFile && !launchPlanFile)}
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

interface HangtagWashlabelImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: File[]
  onFilesChange: (files: File[]) => void
  referenceImageFiles: File[]
  onReferenceImageFilesChange: (files: File[]) => void
  scmSupplementFile: File | null
  onScmSupplementFileChange: (file: File | null) => void
  overwriteExisting: boolean
  onOverwriteExistingChange: (checked: boolean) => void
  preview: HangtagWashlabelOcrPreviewResponse | null
  job: AsyncTaskJob | null
  isPreviewing: boolean
  isApplying: boolean
  isSubmittingJob: boolean
  canWrite: boolean
  onPreview: () => void
  onApply: () => void
  onSubmitJob: () => void
}

function HangtagWashlabelImportDialog({
  open,
  onOpenChange,
  files,
  onFilesChange,
  referenceImageFiles,
  onReferenceImageFilesChange,
  scmSupplementFile,
  onScmSupplementFileChange,
  overwriteExisting,
  onOverwriteExistingChange,
  preview,
  job,
  isPreviewing,
  isApplying,
  isSubmittingJob,
  canWrite,
  onPreview,
  onApply,
  onSubmitJob,
}: HangtagWashlabelImportDialogProps) {
  const writableFieldCount = preview?.summary.writableFieldCount ?? 0
  const hasUploadInput = files.length > 0 || referenceImageFiles.length > 0 || Boolean(scmSupplementFile)
  const jobRunning = Boolean(job && job.status !== "completed")
  const jobProgress = asyncJobProgress(job)
  const jobSummary = hangtagWashlabelOcrJobSummary(job)
  const onFolderSelection = (selectedFiles: File[]) => {
    const split = splitHangtagWashlabelUploads(selectedFiles)
    onFilesChange(split.ocrFiles)
    onReferenceImageFilesChange(split.referenceImageFiles)
    onScmSupplementFileChange(split.scmSupplementFile)
    if (split.skippedCount > 0) {
      toast.warning(`已忽略 ${formatNumber(split.skippedCount)} 个非吊牌/洗唛/平铺图/SCM 结果文件`)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!canWrite}>
          <FileText className="size-4" />
          导入吊牌/洗唛/平铺图
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>导入吊牌/洗唛/平铺图</DialogTitle>
          <DialogDescription>
            批量上传抓虾图包、PDF 吊牌、JPG/PNG 洗唛、平铺图和 SCM 下载结果表，确认后写入匹配草稿并关联参考图。
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[68vh] gap-4 overflow-auto pr-1">
          <section className="rounded-lg border p-4">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3 text-sm hover:bg-muted/40">
              <span className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <span className="truncate">
                  {hasUploadInput
                    ? `已选择图包：OCR ${formatNumber(files.length)} 个，参考图 ${formatNumber(referenceImageFiles.length)} 张${scmSupplementFile ? "，含 SCM 表" : ""}`
                    : "选择图包目录"}
                </span>
              </span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(event) => onFolderSelection(Array.from(event.target.files ?? []))}
                {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              />
            </label>
            {files.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {files.slice(0, 12).map((file) => (
                  <Badge key={`${uploadDisplayName(file)}-${file.size}`} variant="secondary" className="max-w-[260px] truncate">
                    {uploadDisplayName(file)}
                  </Badge>
                ))}
                {files.length > 12 ? <Badge variant="outline">+{formatNumber(files.length - 12)}</Badge> : null}
              </div>
            ) : null}
            {referenceImageFiles.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-[#cfe8ff] bg-[#f6fbff] text-[#0f5c8c]">
                  平铺/模拍参考图 {formatNumber(referenceImageFiles.length)} 张
                </Badge>
                {referenceImageFiles.slice(0, 8).map((file) => (
                  <Badge key={`${uploadDisplayName(file)}-${file.size}`} variant="secondary" className="max-w-[260px] truncate">
                    {uploadDisplayName(file)}
                  </Badge>
                ))}
                {referenceImageFiles.length > 8 ? <Badge variant="outline">+{formatNumber(referenceImageFiles.length - 8)}</Badge> : null}
              </div>
            ) : null}
            {scmSupplementFile ? (
              <div className="mt-3">
                <Badge variant="outline" className="max-w-[360px] truncate">
                  SCM补充：{uploadDisplayName(scmSupplementFile)}
                </Badge>
              </div>
            ) : null}
            <label className="mt-3 flex items-center gap-2 text-sm">
              <Checkbox
                checked={overwriteExisting}
                onCheckedChange={(checked) => onOverwriteExistingChange(checked === true)}
              />
              覆盖已有字段值
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              默认只补空字段；SCM 结果表里的中文成分会作为明文字段补充，平铺图会进入 AI 多模态参考，带“有模拍”后缀的图片会用于判断模特实拍。
            </p>
          </section>

          {job ? (
            <section className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <div className="font-medium">后台识别任务</div>
                <Badge variant="outline" className={job.status === "completed" ? "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]" : "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"}>
                  {job.status === "completed" ? "已完成" : "识别中"}
                </Badge>
              </div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>已处理 {formatNumber((job.completed_count ?? 0) + (job.failed_count ?? 0))} / {formatNumber(job.total_count ?? 0)}</span>
                <span>{jobProgress}%</span>
              </div>
              <Progress value={jobProgress} />
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-md bg-muted/40 px-2 py-1">成功 {formatNumber(job.completed_count ?? 0)}</div>
                <div className="rounded-md bg-muted/40 px-2 py-1">失败 {formatNumber(job.failed_count ?? 0)}</div>
                <div className="rounded-md bg-muted/40 px-2 py-1">总数 {formatNumber(job.total_count ?? 0)}</div>
              </div>
              {jobSummary ? (
                <div className="mt-3 rounded-md border border-[#b9f4d8] bg-[#f2fff8] px-3 py-2 text-xs text-[#0f7f58]">
                  已自动{jobSummary.overwriteExisting ? "按覆盖模式写入" : "填充空字段"} {formatNumber(jobSummary.appliedFieldCount)} 个，
                  匹配草稿 {formatNumber(jobSummary.appliedDraftCount || jobSummary.matchedCount)} 个，
                  参考图 {formatNumber(jobSummary.importedImageCount)} 张，
                  跳过 {formatNumber(jobSummary.skippedCount)} 个。
                </div>
              ) : null}
              {job.current_item ? (
                <p className="mt-2 truncate text-xs text-muted-foreground">当前：{job.current_item.spu_code}</p>
              ) : null}
            </section>
          ) : null}

          {preview ? (
            <section className="rounded-lg border p-4">
              <div className="mb-3 grid gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-md bg-muted/40 px-3 py-2">文件 {formatNumber(preview.summary.fileCount)}</div>
                <div className="rounded-md bg-muted/40 px-3 py-2">匹配草稿 {formatNumber(preview.summary.matchedCount)}</div>
                <div className="rounded-md bg-muted/40 px-3 py-2">可写字段 {formatNumber(preview.summary.writableFieldCount)}</div>
                <div className="rounded-md bg-muted/40 px-3 py-2">参考图 {formatNumber(preview.referenceImages?.fileCount ?? 0)}</div>
              </div>
              <div className="overflow-hidden rounded-md border">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[20%]">文件</TableHead>
                      <TableHead className="w-[17%]">款号/草稿</TableHead>
                      <TableHead className="w-[11%]">状态</TableHead>
                      <TableHead className="w-[32%]">识别字段</TableHead>
                      <TableHead className="w-[20%]">写入字段</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.items.map((item, itemIndex) => (
                      <TableRow key={`${item.fileName}-${itemIndex}`}>
                        <TableCell className="align-top whitespace-normal">
                          <div className="break-words font-medium">{item.fileName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.fileType || "-"} · {item.sourceKind || "-"} · {formatNumber(item.pageCount)} 页
                          </div>
                          {item.error ? <div className="mt-1 text-xs text-[#d45656]">{item.error}</div> : null}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <div className="font-mono text-sm">{item.detectedSpuCode || "-"}</div>
                          <div className="mt-1 break-words text-xs text-muted-foreground">
                            {item.matchedDraft ? `${item.matchedDraft.title || "未命名"} · ${statusLabels[item.matchedDraft.status] ?? item.matchedDraft.status}` : "未匹配"}
                          </div>
                          {item.warnings.length > 0 ? (
                            <div className="mt-1 break-words text-xs text-[#c37d0d]">{item.warnings.slice(0, 2).join("；")}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <Badge variant="outline" className={ocrStatusClass(item.status)}>
                            {ocrStatusLabels[item.status] ?? item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <div className="grid gap-1">
                            {item.extractedFields.slice(0, 6).map((field, fieldIndex) => (
                              <OcrExtractedFieldLine key={`${field.key}-${fieldIndex}`} field={field} />
                            ))}
                            {item.extractedFields.length === 0 ? <span className="text-xs text-muted-foreground">无</span> : null}
                            {item.extractedFields.length > 6 ? <span className="text-xs text-muted-foreground">+{formatNumber(item.extractedFields.length - 6)} 项</span> : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <div className="grid gap-1">
                            {item.targetFields.slice(0, 6).map((field) => (
                              <div key={`${field.fieldId}-${field.fieldKey}`} className="min-w-0 rounded-md bg-muted/30 px-2 py-1.5 text-xs">
                                <span className="font-medium">{field.fieldName}</span>
                                <span className={field.willApply ? "ml-1 text-[#0fa76e]" : "ml-1 text-muted-foreground"}>
                                  {field.willApply ? "写入" : field.skippedReason || "跳过"}
                                </span>
                              </div>
                            ))}
                            {item.targetFields.length === 0 ? <span className="text-xs text-muted-foreground">无可写字段</span> : null}
                            {item.targetFields.length > 6 ? <span className="text-xs text-muted-foreground">+{formatNumber(item.targetFields.length - 6)} 项</span> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.provider ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  OCR：{preview.provider.kind} · {preview.provider.lang} · PDF {preview.provider.pdfRenderer}
                  {preview.scmSupplement?.files.length ? ` · SCM补充 ${formatNumber(preview.scmSupplement.files.reduce((sum, file) => sum + file.documentCount, 0))} 条` : ""}
                  {preview.referenceImages?.fileCount ? ` · 参考图 ${formatNumber(preview.referenceImages.fileCount)} 张待关联` : ""}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canWrite || isPreviewing || isApplying || isSubmittingJob || jobRunning || !hasUploadInput}
            onClick={onPreview}
          >
            {isPreviewing ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            识别预览
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canWrite || isPreviewing || isApplying || isSubmittingJob || jobRunning || !preview || writableFieldCount === 0}
            onClick={onApply}
          >
            {isApplying ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            确认写入草稿
          </Button>
          <Button
            type="button"
            disabled={!canWrite || isPreviewing || isApplying || isSubmittingJob || jobRunning || !hasUploadInput}
            onClick={onSubmitJob}
          >
            {isSubmittingJob ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            提交后台识别
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProductArchiveDraftsPage() {
  const { hasPermission } = useAuth()
  const canWrite = hasPermission("PRODUCT_ARCHIVE_DRAFT_WRITE")
  const canSubmit = hasPermission("PRODUCT_ARCHIVE_DRAFT_SUBMIT")
  const queryClient = useQueryClient()
  const { tasks, addTask, getTaskByJobId, openTaskCenter } = useAsyncTasks()
  const refreshedOcrJobIds = useRef<Set<string>>(new Set())
  const refreshedAiFillJobIds = useRef<Set<string>>(new Set())
  const refreshedPrecheckJobIds = useRef<Set<string>>(new Set())
  const refreshedPublishJobIds = useRef<Set<string>>(new Set())
  const [searchText, setSearchText] = useState("")
  const [multiLineSearchOpen, setMultiLineSearchOpen] = useState(false)
  const [multiLineSpuCodes, setMultiLineSpuCodes] = useState("")
  const [appliedMultiLineSpuCodes, setAppliedMultiLineSpuCodes] = useState("")
  const [status, setStatus] = useState("all")
  const [mdmDialogOpen, setMdmDialogOpen] = useState(false)
  const [mdmCodes, setMdmCodes] = useState("")
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false)
  const [workflowProgressDialogOpen, setWorkflowProgressDialogOpen] = useState(false)
  const [guideDialogOpen, setGuideDialogOpen] = useState(() => !hasSeenProductArchiveDraftGuide())
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false)
  const [ocrFiles, setOcrFiles] = useState<File[]>([])
  const [ocrReferenceImageFiles, setOcrReferenceImageFiles] = useState<File[]>([])
  const [ocrScmSupplementFile, setOcrScmSupplementFile] = useState<File | null>(null)
  const [ocrOverwriteExisting, setOcrOverwriteExisting] = useState(false)
  const [ocrPreview, setOcrPreview] = useState<HangtagWashlabelOcrPreviewResponse | null>(null)
  const [ocrJobId, setOcrJobId] = useState<string | null>(null)
  const [copywritingFile, setCopywritingFile] = useState<File | null>(null)
  const [launchPlanFile, setLaunchPlanFile] = useState<File | null>(null)
  const [sizeChartFile, setSizeChartFile] = useState<File | null>(null)
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
  const trackedOcrJob = (getTaskByJobId(ocrJobId)?.job ?? null) as AsyncTaskJob | null
  const trackedJobProgress = trackedJob?.total_count
    ? Math.round(((trackedJob.completed_count + trackedJob.failed_count) / trackedJob.total_count) * 100)
    : 0
  const failedJobItems = trackedJob?.items?.filter((item) => item.status === "failed") ?? []
  const appliedMultiLineCount = multiLineCodeCount(appliedMultiLineSpuCodes)

  function handleGuideDialogOpenChange(open: boolean) {
    setGuideDialogOpen(open)
    if (!open) {
      markProductArchiveDraftGuideSeen()
    }
  }

  useEffect(() => {
    const completedOcrTasks = tasks.filter((task) => (
      task.type === "product_archive_hangtag_washlabel_ocr"
      && task.job?.status === "completed"
      && !refreshedOcrJobIds.current.has(task.id)
    ))
    if (completedOcrTasks.length === 0) return
    for (const task of completedOcrTasks) refreshedOcrJobIds.current.add(task.id)
    queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
  }, [queryClient, tasks])

  useEffect(() => {
    const completedAiFillTasks = tasks.filter((task) => (
      task.type === "product_archive_ai_fill"
      && task.job?.status === "completed"
      && !refreshedAiFillJobIds.current.has(task.id)
    ))
    if (completedAiFillTasks.length === 0) return
    for (const task of completedAiFillTasks) refreshedAiFillJobIds.current.add(task.id)
    queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
  }, [queryClient, tasks])

  useEffect(() => {
    const completedPrecheckTasks = tasks.filter((task) => (
      task.type === "product_archive_publish_precheck"
      && task.job?.status === "completed"
      && !refreshedPrecheckJobIds.current.has(task.id)
    ))
    if (completedPrecheckTasks.length === 0) return
    for (const task of completedPrecheckTasks) refreshedPrecheckJobIds.current.add(task.id)
    queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
  }, [queryClient, tasks])

  useEffect(() => {
    const completedPublishTasks = tasks.filter((task) => (
      task.type === "product_archive_publish"
      && task.job?.status === "completed"
      && !refreshedPublishJobIds.current.has(task.id)
    ))
    if (completedPublishTasks.length === 0) return
    for (const task of completedPublishTasks) refreshedPublishJobIds.current.add(task.id)
    queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
  }, [queryClient, tasks])

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

  const importSizeChart = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      form.append("sourceType", "size_chart")
      return api.postForm<SourceImportUploadResponse>("/product-archive-drafts/size-chart/import", form)
    },
    onSuccess: (result) => {
      toast.success(`导入尺码表完成：${formatNumber(result.insertedRowCount)} / ${formatNumber(result.inputRowCount)} 行，已刷新对应草稿`)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "导入尺码表失败")
    },
  })

  const previewHangtagWashlabelOcr = useMutation({
    mutationFn: async () => {
      const form = buildHangtagWashlabelOcrForm(ocrFiles, ocrScmSupplementFile, ocrOverwriteExisting, ocrReferenceImageFiles)
      return api.postForm<HangtagWashlabelOcrPreviewResponse>("/product-archive-drafts/hangtag-washlabel-ocr/preview", form)
    },
    onSuccess: (result) => {
      setOcrPreview(result)
      if (result.summary.writableFieldCount > 0) {
        toast.success(`识别完成：可写入 ${formatNumber(result.summary.writableFieldCount)} 个字段`)
      } else if (result.summary.failedCount > 0) {
        toast.error("OCR 识别失败，请查看文件行里的错误原因")
      } else {
        toast.warning("已识别文件，但没有可写入字段")
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "吊牌/洗唛/平铺图识别失败")
    },
  })

  const submitHangtagWashlabelOcrJob = useMutation({
    mutationFn: async () => {
      const form = buildHangtagWashlabelOcrForm(ocrFiles, ocrScmSupplementFile, ocrOverwriteExisting, ocrReferenceImageFiles)
      return api.postForm<AsyncTaskJob>("/product-archive-drafts/hangtag-washlabel-ocr/jobs", form)
    },
    onSuccess: (job) => {
      addTask({
        job,
        type: "product_archive_hangtag_washlabel_ocr",
        title: "吊牌/洗唛/平铺图后台识别",
        description: `待识别并写入 ${formatNumber(Math.max(0, (job.total_count ?? 1) - 1))} 个上传项`,
        endpoint: `/product-archive-drafts/hangtag-washlabel-ocr/jobs/${job.id}`,
      })
      setOcrJobId(job.id)
      setOcrPreview(null)
      setOcrFiles([])
      setOcrReferenceImageFiles([])
      setOcrScmSupplementFile(null)
      toast.success("吊牌/洗唛/平铺图后台识别任务已提交")
      openTaskCenter()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "提交吊牌/洗唛/平铺图后台识别失败")
    },
  })

  const applyHangtagWashlabelOcr = useMutation({
    mutationFn: async () => {
      const applyResult = await api.post<HangtagWashlabelOcrApplyResponse>("/product-archive-drafts/hangtag-washlabel-ocr/apply", {
        items: ocrPreview?.items ?? [],
        overwriteExisting: ocrOverwriteExisting,
      })
      const imageImport = ocrReferenceImageFiles.length > 0
        ? await api.postForm<ProductArchiveDraftImageImportResponse>(
            "/product-archive-drafts/images/import",
            buildSpuImageImportForm(ocrReferenceImageFiles, "crawshrimp_asset_package"),
          )
        : null
      return {
        ...applyResult,
        referenceImageImport: imageImport,
      }
    },
    onSuccess: (result) => {
      const imageCount = result.referenceImageImport?.summary.importedCount ?? 0
      toast.success(`已写入 ${formatNumber(result.summary.appliedDraftCount)} 个草稿、${formatNumber(result.summary.appliedFieldCount)} 个字段${imageCount ? `，关联参考图 ${formatNumber(imageCount)} 张` : ""}`)
      setOcrDialogOpen(false)
      setOcrFiles([])
      setOcrReferenceImageFiles([])
      setOcrScmSupplementFile(null)
      setOcrPreview(null)
      setOcrOverwriteExisting(false)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "写入吊牌/洗唛/平铺图字段失败")
    },
  })

  const startProductArchiveWorkflow = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append("skipLaunchPlan", skipLaunchPlan ? "true" : "false")
      if (copywritingFile) form.append("copywritingFile", copywritingFile)
      if (launchPlanFile) form.append("launchPlanFile", launchPlanFile)
      if (sizeChartFile) form.append("sizeChartFile", sizeChartFile)
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
      setSizeChartFile(null)
      setSkipLaunchPlan(false)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
  })

  const batchAiFillFields = useMutation({
    mutationFn: async (draftIds: number[]) => api.post<AsyncTaskJob>("/product-archive-drafts/ai-fill-jobs", {
      draftIds,
    }),
    onSuccess: (job) => {
      addTask({
        job,
        type: "product_archive_ai_fill",
        title: "批量 AI 填充字段",
        description: `待补齐 ${formatNumber(job.total_count)} 个深绘建档草稿的空字段`,
        endpoint: `/product-archive-drafts/ai-fill-jobs/${job.id}`,
      })
      toast.success("已加入任务中心：批量 AI 填充字段")
      openTaskCenter()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "提交批量 AI 填充失败")
    },
  })

  const batchPublishPrecheck = useMutation({
    mutationFn: async (draftIds: number[]) => api.post<AsyncTaskJob>("/product-archive-drafts/precheck-jobs", {
      draftIds,
    }),
    onSuccess: (job) => {
      addTask({
        job,
        type: "product_archive_publish_precheck",
        title: "批量发布预检",
        description: `待预检 ${formatNumber(job.total_count)} 个深绘建档草稿，按校验、查重、提交预览串行执行`,
        endpoint: `/product-archive-drafts/precheck-jobs/${job.id}`,
      })
      toast.success("已加入任务中心：批量发布预检")
      openTaskCenter()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "提交批量发布预检失败")
    },
  })

  const batchPublishToDeepdraw = useMutation({
    mutationFn: async (draftIds: number[]) => api.post<AsyncTaskJob>("/product-archive-drafts/publish-jobs", {
      draftIds,
    }),
    onSuccess: (job) => {
      addTask({
        job,
        type: "product_archive_publish",
        title: "批量发布到深绘",
        description: `待逐条发布 ${formatNumber(job.total_count)} 个深绘建档草稿，接口繁忙会自动延迟重试`,
        endpoint: `/product-archive-drafts/publish-jobs/${job.id}`,
      })
      setPublishDialogOpen(false)
      setSelectedDraftIds(new Set())
      toast.success("已加入任务中心：批量发布到深绘")
      openTaskCenter()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "提交批量发布任务失败")
    },
  })

  const deleteDraft = useMutation({
    mutationFn: (draftId: number) => api.delete<{ ok: boolean }>(`/product-archive-drafts/${draftId}`),
    onSuccess: async (_, draftId) => {
      toast.success("建档草稿已删除")
      setSelectedDraftIds((current) => {
        const next = new Set(current)
        next.delete(draftId)
        return next
      })
      if ((drafts.data?.items.length ?? 0) <= 1 && pagination.offset > 0) {
        setPagination((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))
      }
      await queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "删除建档草稿失败")
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

  function runBatchPublishPrecheck() {
    if (selectedDrafts.length === 0) {
      toast.info("请先选择草稿")
      return
    }
    batchPublishPrecheck.mutate(selectedDrafts.map((item) => item.id))
  }

  function runBatchAiFill() {
    if (selectedDrafts.length === 0) {
      toast.info("请先选择草稿")
      return
    }
    batchAiFillFields.mutate(selectedDrafts.map((item) => item.id))
  }

  function runBatchPublishToDeepdraw() {
    if (selectedDrafts.length === 0) {
      toast.info("请先选择草稿")
      return
    }
    batchPublishToDeepdraw.mutate(selectedDrafts.map((item) => item.id))
  }

  function refreshDraftList() {
    void (async () => {
      const [result] = await Promise.all([
        drafts.refetch(),
        queryClient.invalidateQueries({ queryKey: ["product-archive-draft-batch-job"] }),
      ])
      if (result.error) {
        toast.error(result.error instanceof Error ? result.error.message : "刷新列表失败")
        return
      }
      toast.success("已刷新深绘建档草稿列表")
    })()
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
              className="border-[#ff6b76]/45 bg-[#fff7f8] text-[#d93d4a] hover:bg-[#ffecee] hover:text-[#be2f3b]"
              onClick={() => setGuideDialogOpen(true)}
            >
              <CircleHelp className="size-4" />
              使用指南
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={drafts.isFetching}
              onClick={refreshDraftList}
            >
              {drafts.isFetching ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              刷新列表
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canWrite || selectedDrafts.length === 0 || batchAiFillFields.isPending}
              onClick={runBatchAiFill}
            >
              {batchAiFillFields.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              批量 AI 填充字段{selectedDrafts.length ? ` ${selectedDrafts.length}` : ""}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canSubmit || selectedDrafts.length === 0 || batchPublishPrecheck.isPending}
              onClick={runBatchPublishPrecheck}
            >
              {batchPublishPrecheck.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              批量发布预检{selectedDrafts.length ? ` ${selectedDrafts.length}` : ""}
            </Button>
            <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canSubmit || selectedDrafts.length === 0 || batchPublishToDeepdraw.isPending}
                >
                  {batchPublishToDeepdraw.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  批量发布到深绘{selectedDrafts.length ? ` ${selectedDrafts.length}` : ""}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>批量发布到深绘</DialogTitle>
                  <DialogDescription>
                    将对已选择的 {formatNumber(selectedDrafts.length)} 个草稿提交后台发布任务。系统会逐个查重、提交并回读校验；接口繁忙会自动延迟重试，单款失败不会中断整批。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setPublishDialogOpen(false)}>
                    取消
                  </Button>
                  <Button
                    type="button"
                    disabled={!canSubmit || selectedDrafts.length === 0 || batchPublishToDeepdraw.isPending}
                    onClick={runBatchPublishToDeepdraw}
                  >
                    {batchPublishToDeepdraw.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    提交后台发布任务
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <ProductArchiveDraftGuideDialog
        open={guideDialogOpen}
        onOpenChange={handleGuideDialogOpenChange}
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
                  <Button type="button" variant="outline" size="sm" disabled={!canWrite || syncMdmAndCreateBatch.isPending}>
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
                      disabled={!canWrite || syncMdmAndCreateBatch.isPending || !mdmCodes.trim()}
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
                  <Button type="button" variant="outline" size="sm" disabled={!canWrite || importCopywriting.isPending}>
                    {importCopywriting.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                    导入标准文案表
                  </Button>
                }
                onImport={async (file) => {
                  await importCopywriting.mutateAsync(file)
                }}
              />
              <ImportDialog
                title="导入尺码表"
                description="导入 PLM 导出的宽表/长表模板后，会按款号刷新已有深绘建档草稿的尺码表字段。"
                trigger={
                  <Button type="button" variant="outline" size="sm" disabled={!canWrite || importSizeChart.isPending}>
                    {importSizeChart.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                    导入尺码表
                  </Button>
                }
                onImport={async (file) => {
                  await importSizeChart.mutateAsync(file)
                }}
              />
              <HangtagWashlabelImportDialog
                open={ocrDialogOpen}
                onOpenChange={(open) => {
                  setOcrDialogOpen(open)
                  if (!open) return
                  setOcrPreview(null)
                  setOcrJobId(null)
                }}
                files={ocrFiles}
                onFilesChange={(files) => {
                  setOcrFiles(files)
                  setOcrPreview(null)
                  setOcrJobId(null)
                }}
                referenceImageFiles={ocrReferenceImageFiles}
                onReferenceImageFilesChange={(files) => {
                  setOcrReferenceImageFiles(files)
                  setOcrPreview(null)
                  setOcrJobId(null)
                }}
                scmSupplementFile={ocrScmSupplementFile}
                onScmSupplementFileChange={(file) => {
                  setOcrScmSupplementFile(file)
                  setOcrPreview(null)
                  setOcrJobId(null)
                }}
                overwriteExisting={ocrOverwriteExisting}
                onOverwriteExistingChange={(checked) => {
                  setOcrOverwriteExisting(checked)
                  setOcrPreview(null)
                  setOcrJobId(null)
                }}
                preview={ocrPreview}
                job={trackedOcrJob}
                isPreviewing={previewHangtagWashlabelOcr.isPending}
                isApplying={applyHangtagWashlabelOcr.isPending}
                isSubmittingJob={submitHangtagWashlabelOcrJob.isPending}
                canWrite={canWrite}
                onPreview={() => previewHangtagWashlabelOcr.mutate()}
                onApply={() => applyHangtagWashlabelOcr.mutate()}
                onSubmitJob={() => submitHangtagWashlabelOcrJob.mutate()}
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
                sizeChartFile={sizeChartFile}
                onSizeChartFileChange={setSizeChartFile}
                skipLaunchPlan={skipLaunchPlan}
                onSkipLaunchPlanChange={setSkipLaunchPlan}
                workflowResult={workflowResult}
                isPending={startProductArchiveWorkflow.isPending}
                canWrite={canWrite}
                onSubmit={() => startProductArchiveWorkflow.mutate()}
              />
            </CompactListControls>
          </CompactListToolbar>
        </CompactListCardHeader>
        <CompactListCardContent>
          {drafts.isError ? (
            <QueryErrorState message={drafts.error instanceof Error ? drafts.error.message : undefined} onRetry={() => void drafts.refetch()} />
          ) : null}
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
                  <TableHead>图片</TableHead>
                  <TableHead>款号</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>租户/商户</TableHead>
                  <TableHead>类目</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>问题</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>图包资料</TableHead>
                  <TableHead>productId</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="w-[132px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drafts.data?.items ?? []).map((item) => {
                  const isDeletingDraft = deleteDraft.isPending && deleteDraft.variables === item.id
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          aria-label={`选择草稿 ${item.spu_code}`}
                          checked={selectedDraftIds.has(item.id)}
                          onCheckedChange={(checked) => toggleDraft(item.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <DraftThumbnail
                          src={item.thumbnail_image_url}
                          label={item.thumbnail_file_name ?? item.spu_code}
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
                      <TableCell>
                        <div>{formatNumber(item.image_count ?? 0)} 张</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant={item.hangtag_upload_count > 0 ? "secondary" : "outline"} className="text-[11px] font-normal">
                            吊牌{item.hangtag_upload_count > 0 ? "已传" : "未传"}
                          </Badge>
                          <Badge variant={item.washlabel_upload_count > 0 ? "secondary" : "outline"} className="text-[11px] font-normal">
                            洗唛{item.washlabel_upload_count > 0 ? "已传" : "未传"}
                          </Badge>
                          <Badge variant={item.asset_package_image_count > 0 ? "secondary" : "outline"} className="text-[11px] font-normal">
                            平铺图{item.asset_package_image_count > 0 ? "已传" : "未传"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{item.created_product_id || "-"}</TableCell>
                      <TableCell>{formatDateTime(item.updated_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/product-archive-drafts/${item.id}`}>
                              进入
                            </Link>
                          </Button>
                          <ConfirmDialog
                            title="删除深绘建档草稿"
                            description={`将删除款号 ${item.spu_code} 的本地建档草稿、字段、SKU、校验问题、提交日志和已导入参考图；不会删除深绘后台已经存在或已生成的商品。`}
                            confirmLabel="删除"
                            variant="destructive"
                            onConfirm={() => deleteDraft.mutate(item.id)}
                            trigger={(
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={!canWrite || item.status === "submitting" || deleteDraft.isPending}
                                aria-label={`删除草稿 ${item.spu_code}`}
                              >
                                {isDeletingDraft ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                删除
                              </Button>
                            )}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
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
            正在按未建档款号同步 MDM 并生成深绘建档草稿，关闭弹窗后可从任务中心继续查看。
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
