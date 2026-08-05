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

function uploadDisplayName(file: File) {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return relativePath || file.name
}

function uploadExtension(file: File) {
  return uploadDisplayName(file).split(".").pop()?.toLowerCase() ?? ""
}

function isHiddenUploadFile(file: File) {
  const name = uploadDisplayName(file).split("/").pop() ?? file.name
  return name === ".DS_Store" || name.startsWith("~$")
}

function isOcrAssetUploadFile(file: File) {
  return ["pdf", "jpg", "jpeg", "png"].includes(uploadExtension(file))
}

function isScmSupplementUploadFile(file: File) {
  return ["xlsx", "xlsm"].includes(uploadExtension(file))
}

function splitHangtagWashlabelUploads(files: File[]) {
  const ocrFiles: File[] = []
  let scmSupplementFile: File | null = null
  let skippedCount = 0
  for (const file of files) {
    if (isHiddenUploadFile(file)) {
      skippedCount += 1
      continue
    }
    if (isOcrAssetUploadFile(file)) {
      ocrFiles.push(file)
      continue
    }
    if (isScmSupplementUploadFile(file) && !scmSupplementFile) {
      scmSupplementFile = file
      continue
    }
    skippedCount += 1
  }
  return { ocrFiles, scmSupplementFile, skippedCount }
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

interface HangtagWashlabelImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: File[]
  onFilesChange: (files: File[]) => void
  scmSupplementFile: File | null
  onScmSupplementFileChange: (file: File | null) => void
  overwriteExisting: boolean
  onOverwriteExistingChange: (checked: boolean) => void
  preview: HangtagWashlabelOcrPreviewResponse | null
  isPreviewing: boolean
  isApplying: boolean
  onPreview: () => void
  onApply: () => void
}

function HangtagWashlabelImportDialog({
  open,
  onOpenChange,
  files,
  onFilesChange,
  scmSupplementFile,
  onScmSupplementFileChange,
  overwriteExisting,
  onOverwriteExistingChange,
  preview,
  isPreviewing,
  isApplying,
  onPreview,
  onApply,
}: HangtagWashlabelImportDialogProps) {
  const writableFieldCount = preview?.summary.writableFieldCount ?? 0
  const hasUploadInput = files.length > 0 || Boolean(scmSupplementFile)
  const onFolderSelection = (selectedFiles: File[]) => {
    const split = splitHangtagWashlabelUploads(selectedFiles)
    onFilesChange(split.ocrFiles)
    onScmSupplementFileChange(split.scmSupplementFile)
    if (split.skippedCount > 0) {
      toast.warning(`已忽略 ${formatNumber(split.skippedCount)} 个非吊牌/洗唛/SCM 结果文件`)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FileText className="size-4" />
          导入吊牌/洗唛
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>导入吊牌/洗唛</DialogTitle>
          <DialogDescription>
            批量上传 PDF 吊牌、JPG/PNG 洗唛和 SCM 下载结果表，确认后写入匹配草稿。
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[68vh] gap-4 overflow-auto pr-1">
          <section className="rounded-lg border p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3 text-sm hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2">
                  <Upload className="size-4 text-muted-foreground" />
                  <span className="truncate">
                    {files.length > 0 ? `已选择 ${formatNumber(files.length)} 个文件` : "选择 PDF 吊牌 + JPG/PNG 洗唛文件"}
                  </span>
                </span>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={(event) => onFilesChange(Array.from(event.target.files ?? []).filter(isOcrAssetUploadFile))}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3 text-sm hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2">
                  <FileSpreadsheet className="size-4 text-muted-foreground" />
                  <span className="truncate">选择抓虾 SCM 导出目录</span>
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => onFolderSelection(Array.from(event.target.files ?? []))}
                  {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                />
              </label>
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3 text-sm hover:bg-muted/40">
              <span className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <span className="truncate">{scmSupplementFile ? uploadDisplayName(scmSupplementFile) : "选择 SCM洗唛吊牌下载结果 .xlsx"}</span>
              </span>
              <Input
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                onChange={(event) => onScmSupplementFileChange(event.target.files?.[0] ?? null)}
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
              默认只补空字段；SCM 结果表里的中文成分会作为明文字段补充，识别结果会保留来源证据。
            </p>
          </section>

          {preview ? (
            <section className="rounded-lg border p-4">
              <div className="mb-3 grid gap-2 text-sm sm:grid-cols-4">
                <div className="rounded-md bg-muted/40 px-3 py-2">文件 {formatNumber(preview.summary.fileCount)}</div>
                <div className="rounded-md bg-muted/40 px-3 py-2">匹配草稿 {formatNumber(preview.summary.matchedCount)}</div>
                <div className="rounded-md bg-muted/40 px-3 py-2">可写字段 {formatNumber(preview.summary.writableFieldCount)}</div>
                <div className="rounded-md bg-muted/40 px-3 py-2">跳过/警告 {formatNumber(preview.summary.skippedFieldCount + preview.summary.warningCount)}</div>
              </div>
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文件</TableHead>
                      <TableHead>款号/草稿</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>识别字段</TableHead>
                      <TableHead>写入字段</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.items.map((item) => (
                      <TableRow key={item.fileName}>
                        <TableCell className="min-w-[180px] max-w-[240px]">
                          <div className="truncate font-medium">{item.fileName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.fileType || "-"} · {item.sourceKind || "-"} · {formatNumber(item.pageCount)} 页
                          </div>
                          {item.error ? <div className="mt-1 text-xs text-[#d45656]">{item.error}</div> : null}
                        </TableCell>
                        <TableCell className="min-w-[150px]">
                          <div className="font-mono text-sm">{item.detectedSpuCode || "-"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.matchedDraft ? `${item.matchedDraft.title || "未命名"} · ${statusLabels[item.matchedDraft.status] ?? item.matchedDraft.status}` : "未匹配"}
                          </div>
                          {item.warnings.length > 0 ? (
                            <div className="mt-1 text-xs text-[#c37d0d]">{item.warnings.slice(0, 2).join("；")}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ocrStatusClass(item.status)}>
                            {ocrStatusLabels[item.status] ?? item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[220px] max-w-[320px]">
                          <div className="grid gap-1">
                            {item.extractedFields.slice(0, 6).map((field) => (
                              <div key={`${field.key}-${field.value}`} className="text-xs">
                                <span className="font-medium">{field.label}</span>
                                <span className="mx-1 text-muted-foreground">· {confidenceLabel(field.confidence)}</span>
                                <span className="break-words">{field.value}</span>
                              </div>
                            ))}
                            {item.extractedFields.length === 0 ? <span className="text-xs text-muted-foreground">无</span> : null}
                            {item.extractedFields.length > 6 ? <span className="text-xs text-muted-foreground">+{formatNumber(item.extractedFields.length - 6)} 项</span> : null}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[220px] max-w-[320px]">
                          <div className="grid gap-1">
                            {item.targetFields.slice(0, 6).map((field) => (
                              <div key={`${field.fieldId}-${field.fieldKey}`} className="text-xs">
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
            disabled={isPreviewing || isApplying || !hasUploadInput}
            onClick={onPreview}
          >
            {isPreviewing ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            识别预览
          </Button>
          <Button
            type="button"
            disabled={isPreviewing || isApplying || !preview || writableFieldCount === 0}
            onClick={onApply}
          >
            {isApplying ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            确认写入草稿
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
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false)
  const [ocrFiles, setOcrFiles] = useState<File[]>([])
  const [ocrScmSupplementFile, setOcrScmSupplementFile] = useState<File | null>(null)
  const [ocrOverwriteExisting, setOcrOverwriteExisting] = useState(false)
  const [ocrPreview, setOcrPreview] = useState<HangtagWashlabelOcrPreviewResponse | null>(null)
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
      const form = new FormData()
      for (const file of ocrFiles) {
        form.append("files", file)
        form.append("filePaths", uploadDisplayName(file))
      }
      if (ocrScmSupplementFile) {
        form.append("scmSupplementFile", ocrScmSupplementFile)
        form.append("filePaths", uploadDisplayName(ocrScmSupplementFile))
      }
      form.append("overwriteExisting", ocrOverwriteExisting ? "true" : "false")
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
      toast.error(error instanceof Error ? error.message : "吊牌/洗唛识别失败")
    },
  })

  const applyHangtagWashlabelOcr = useMutation({
    mutationFn: async () => api.post<HangtagWashlabelOcrApplyResponse>("/product-archive-drafts/hangtag-washlabel-ocr/apply", {
      items: ocrPreview?.items ?? [],
      overwriteExisting: ocrOverwriteExisting,
    }),
    onSuccess: (result) => {
      toast.success(`已写入 ${formatNumber(result.summary.appliedDraftCount)} 个草稿、${formatNumber(result.summary.appliedFieldCount)} 个字段`)
      setOcrDialogOpen(false)
      setOcrFiles([])
      setOcrScmSupplementFile(null)
      setOcrPreview(null)
      setOcrOverwriteExisting(false)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "写入吊牌/洗唛字段失败")
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
              <ImportDialog
                title="导入尺码表"
                description="导入 PLM 导出的宽表/长表模板后，会按款号刷新已有深绘建档草稿的尺码表字段。"
                trigger={
                  <Button type="button" variant="outline" size="sm" disabled={importSizeChart.isPending}>
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
                }}
                files={ocrFiles}
                onFilesChange={(files) => {
                  setOcrFiles(files)
                  setOcrPreview(null)
                }}
                scmSupplementFile={ocrScmSupplementFile}
                onScmSupplementFileChange={(file) => {
                  setOcrScmSupplementFile(file)
                  setOcrPreview(null)
                }}
                overwriteExisting={ocrOverwriteExisting}
                onOverwriteExistingChange={(checked) => {
                  setOcrOverwriteExisting(checked)
                  setOcrPreview(null)
                }}
                preview={ocrPreview}
                isPreviewing={previewHangtagWashlabelOcr.isPending}
                isApplying={applyHangtagWashlabelOcr.isPending}
                onPreview={() => previewHangtagWashlabelOcr.mutate()}
                onApply={() => applyHangtagWashlabelOcr.mutate()}
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
