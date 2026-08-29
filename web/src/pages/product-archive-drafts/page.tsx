import { useEffect, useMemo, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, ChevronUp, CircleHelp, Download, ExternalLink, FileSpreadsheet, FileText, ListTree, Loader2, Maximize2, PackagePlus, RefreshCw, Save, Search, Send, ShieldCheck, Sparkles, Trash2, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
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

const OCR_UPLOAD_MB = 1024 * 1024
const OCR_PREVIEW_MAX_FILES = 40
const OCR_PREVIEW_MAX_BYTES = 128 * OCR_UPLOAD_MB
const OCR_BACKGROUND_BATCH_MAX_FILES = 160
const OCR_BACKGROUND_BATCH_MAX_BYTES = 512 * OCR_UPLOAD_MB
const OCR_MAX_EVIDENCE_FILE_BYTES = 50 * OCR_UPLOAD_MB
const OCR_MAX_REFERENCE_IMAGE_BYTES = 20 * OCR_UPLOAD_MB

interface ProductArchiveDraftRow {
  id: number
  draft_no: string
  spu_code: string
  title: string | null
  tenant_name: string
  merchant_id: string
  trade_id: string | null
  trade_path: string | null
  status: string
  blocker_count: number
  warning_count: number
  sku_count: number
  image_count: number
  thumbnail_image_url: string | null
  thumbnail_preview_url: string | null
  thumbnail_full_url: string | null
  thumbnail_file_name: string | null
  asset_package_image_count: number
  hangtag_upload_count: number
  washlabel_upload_count: number
  created_product_id: string | null
  updated_at: string
  image_previews?: ProductArchiveDraftImagePreviewGroups
}

type DraftAssetKind = "reference" | "hangtag" | "washlabel"

interface ProductArchiveDraftImagePreview {
  id: number | string
  draft_id?: number
  kind?: DraftAssetKind
  asset_kind?: string | null
  label: string
  file_name?: string | null
  original_file_name?: string | null
  mime_type?: string | null
  width?: number | null
  height?: number | null
  preview_url: string | null
  full_url?: string | null
  thumbnail_url?: string | null
}

type ProductArchiveDraftImagePreviewGroups = Record<DraftAssetKind, ProductArchiveDraftImagePreview[]>

interface Draft {
  id: number
  draft_no: string
  spu_code: string
  tenant_name: string
  merchant_id: string
  trade_id: string | null
  trade_path: string | null
  title: string | null
  status: string
  validation_summary_json: { blocker_count?: number; warning_count?: number; validated_at?: string }
  updated_at: string
}

interface DraftField {
  id: number
  field_name: string
  updated_at: string
  source_type: string
  value_text: string | null
  value_json?: unknown
  field_type?: string | null
  required: boolean
  blocking: boolean
  manual_override: boolean
  validation_status: string
  validation_message: string | null
  options_json?: unknown
}

interface DraftIssue {
  id: number
  severity: string
  issue_type: string
  field_name: string | null
  sku_code: string | null
  message: string
  resolved_at: string | null
}

interface TradeSelectionDecision {
  status: "auto_applied" | "pending_confirmation" | "manual_selection_required" | "human_confirmed" | "human_adjusted"
  confidence: "high" | "medium" | "none"
  recommendedTrade: { tradeId: string; tradePath: string } | null
  appliedTrade: { tradeId: string; tradePath: string } | null
  reason: string
}

interface LaunchPlanReferenceField {
  key: string
  label: string
  value: string
}

interface LaunchPlanReference {
  matched: boolean
  fields: LaunchPlanReferenceField[]
}

interface DraftDetail {
  draft: Draft
  tradeSelectionDecision: TradeSelectionDecision
  launchPlanReference?: LaunchPlanReference
  fields: DraftField[]
  issues: DraftIssue[]
  images?: ProductArchiveDraftImagePreview[]
}

interface DraftFieldPatchRequest {
  draftId: number
  expectedDraftUpdatedAt: string
  fields: Array<{
    id: number
    fieldName: string
    expectedUpdatedAt: string
    valueText: string
  }>
}

interface TradeRow {
  trade_id: string
  trade_name: string
  trade_path: string | null
}

interface TradeListResponse {
  items: TradeRow[]
}

interface FieldOption {
  label: string
  value: string
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

function formatUploadBytes(bytes: number) {
  if (bytes >= OCR_UPLOAD_MB) return `${(bytes / OCR_UPLOAD_MB).toFixed(bytes >= 10 * OCR_UPLOAD_MB ? 0 : 1)}MB`
  return `${Math.max(1, Math.ceil(bytes / 1024))}KB`
}

type OcrUploadEntry = {
  kind: "ocr" | "reference" | "supplement"
  file: File
}

function hangtagWashlabelUploadEntries(files: File[], scmSupplementFile: File | null, referenceImageFiles: File[]) {
  return [
    ...files.map((file) => ({ kind: "ocr" as const, file })),
    ...(scmSupplementFile ? [{ kind: "supplement" as const, file: scmSupplementFile }] : []),
    ...referenceImageFiles.map((file) => ({ kind: "reference" as const, file })),
  ]
}

function hangtagWashlabelUploadSummary(files: File[], scmSupplementFile: File | null, referenceImageFiles: File[]) {
  const entries = hangtagWashlabelUploadEntries(files, scmSupplementFile, referenceImageFiles)
  return {
    count: entries.length,
    bytes: entries.reduce((sum, entry) => sum + Number(entry.file.size || 0), 0),
  }
}

function assertHangtagWashlabelClientLimits(files: File[], scmSupplementFile: File | null, referenceImageFiles: File[]) {
  const oversizedEvidence = [...files, ...(scmSupplementFile ? [scmSupplementFile] : [])]
    .find((file) => Number(file.size || 0) > OCR_MAX_EVIDENCE_FILE_BYTES)
  if (oversizedEvidence) {
    throw new Error(`${uploadDisplayName(oversizedEvidence)} 超过 ${formatUploadBytes(OCR_MAX_EVIDENCE_FILE_BYTES)}，请压缩后再上传`)
  }
  const oversizedReference = referenceImageFiles.find((file) => Number(file.size || 0) > OCR_MAX_REFERENCE_IMAGE_BYTES)
  if (oversizedReference) {
    throw new Error(`${uploadDisplayName(oversizedReference)} 超过 ${formatUploadBytes(OCR_MAX_REFERENCE_IMAGE_BYTES)}，请压缩后再上传`)
  }
}

function assertHangtagWashlabelPreviewLimits(files: File[], scmSupplementFile: File | null, referenceImageFiles: File[]) {
  assertHangtagWashlabelClientLimits(files, scmSupplementFile, referenceImageFiles)
  const summary = hangtagWashlabelUploadSummary(files, scmSupplementFile, referenceImageFiles)
  if (summary.count > OCR_PREVIEW_MAX_FILES || summary.bytes > OCR_PREVIEW_MAX_BYTES) {
    throw new Error(`当前图包 ${formatNumber(summary.count)} 个 / ${formatUploadBytes(summary.bytes)}，超过预览上限，请提交后台识别`)
  }
}

function splitHangtagWashlabelBackgroundBatches(files: File[], scmSupplementFile: File | null, referenceImageFiles: File[]) {
  assertHangtagWashlabelClientLimits(files, scmSupplementFile, referenceImageFiles)
  const batches: OcrUploadEntry[][] = []
  let current: OcrUploadEntry[] = []
  let currentBytes = 0
  for (const entry of hangtagWashlabelUploadEntries(files, scmSupplementFile, referenceImageFiles)) {
    const entryBytes = Number(entry.file.size || 0)
    const exceedsCount = current.length >= OCR_BACKGROUND_BATCH_MAX_FILES
    const exceedsBytes = currentBytes > 0 && currentBytes + entryBytes > OCR_BACKGROUND_BATCH_MAX_BYTES
    if (current.length > 0 && (exceedsCount || exceedsBytes)) {
      batches.push(current)
      current = []
      currentBytes = 0
    }
    current.push(entry)
    currentBytes += entryBytes
  }
  if (current.length > 0) batches.push(current)
  return batches.map((batch) => ({
    files: batch.filter((entry) => entry.kind === "ocr").map((entry) => entry.file),
    scmSupplementFile: batch.find((entry) => entry.kind === "supplement")?.file ?? null,
    referenceImageFiles: batch.filter((entry) => entry.kind === "reference").map((entry) => entry.file),
  }))
}

function estimateHangtagWashlabelBackgroundBatchCount(files: File[], scmSupplementFile: File | null, referenceImageFiles: File[]) {
  const entries = hangtagWashlabelUploadEntries(files, scmSupplementFile, referenceImageFiles)
  if (entries.length === 0) return 0
  let count = 1
  let currentCount = 0
  let currentBytes = 0
  for (const entry of entries) {
    const entryBytes = Number(entry.file.size || 0)
    if (currentCount > 0 && (currentCount >= OCR_BACKGROUND_BATCH_MAX_FILES || currentBytes + entryBytes > OCR_BACKGROUND_BATCH_MAX_BYTES)) {
      count += 1
      currentCount = 0
      currentBytes = 0
    }
    currentCount += 1
    currentBytes += entryBytes
  }
  return count
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
  const stem = name.replace(/\.[^.]+$/, "")
  return /(吊牌|合格证|hangtag|tag|洗唛|洗标|水洗|wash)/i.test(name)
    || /^yq(?:[-_ ]?\d+|\s*\(\d+\))?$/i.test(stem)
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

function textValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function recordValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  return {}
}

function parseOptionList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["options", "values", "items", "list"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[]
    }
  }
  return []
}

function stringOptionValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function fieldOptionText(option: unknown, keys: string[]) {
  if (!option || typeof option !== "object") return stringOptionValue(option)
  const record = option as Record<string, unknown>
  for (const key of keys) {
    const value = stringOptionValue(record[key])
    if (value) return value
  }
  return stringOptionValue(record.value) || stringOptionValue(record.label) || stringOptionValue(record.name)
}

function fieldOptionCanonicalValue(option: unknown) {
  if (!option || typeof option !== "object") return stringOptionValue(option)
  return fieldOptionText(option, [
    "attrValueName",
    "attr_value_name",
    "label",
    "name",
    "text",
    "optionName",
    "option_name",
    "title",
  ]) || fieldOptionText(option, [
    "value",
    "optionValue",
    "option_value",
    "code",
    "key",
    "id",
    "attrValueId",
    "attr_value_id",
  ])
}

function isPrimitiveOptionToken(option: unknown) {
  return option == null || typeof option !== "object"
}

function looksLikeDeepdrawOptionIdToken(option: unknown) {
  return /^\d{4,}$/.test(stringOptionValue(option))
}

function hasReadableOptionText(option: unknown) {
  const text = stringOptionValue(option)
  return Boolean(text && !looksLikeDeepdrawOptionIdToken(text) && /[A-Za-z\u4e00-\u9fff]/.test(text))
}

function primitiveOptionTokenIsPairedId(options: unknown[], index: number) {
  const option = options[index]
  if (!isPrimitiveOptionToken(option) || !looksLikeDeepdrawOptionIdToken(option)) return false
  const readablePeerCount = options.filter((candidate) => isPrimitiveOptionToken(candidate) && hasReadableOptionText(candidate)).length
  if (readablePeerCount < 2 && !(options.length === 2 && readablePeerCount === 1)) return false
  return [
    options[index - 1],
    options[index + 1],
  ].some((candidate) => isPrimitiveOptionToken(candidate) && hasReadableOptionText(candidate))
}

function visibleFieldOptionValue(option: unknown, options: unknown[], index: number) {
  if (primitiveOptionTokenIsPairedId(options, index)) return ""
  return fieldOptionCanonicalValue(option).replace(/\s*[（(]\s*\d{4,}\s*[）)]\s*$/g, "").trim()
}

function fieldOptions(field: DraftField): FieldOption[] {
  const rawOptions = parseOptionList(field.options_json)
  const options = rawOptions
    .map((option, index) => {
      const value = visibleFieldOptionValue(option, rawOptions, index)
      if (!value) return null
      return { value, label: value }
    })
    .filter(Boolean) as FieldOption[]
  return Array.from(new Map(options.map((option) => [option.value, option])).values())
}

function compactFieldKey(value: string) {
  return value.replace(/\s+/g, "").replace(/[()（）]/g, "").toLowerCase()
}

function deepdrawFieldType(field: DraftField) {
  return String(field.field_type ?? "").trim().toUpperCase()
}

const MULTI_CHOICE_FIELD_TYPES = new Set(["MULTI_CHOICE", "MULTIPLE_CHOICE", "MULTI_SELECT", "CHECKBOX"])

function isChoiceFieldType(field: DraftField) {
  const type = deepdrawFieldType(field)
  if (fieldOptions(field).length > 0) return true
  if (["SINGLE_CHOICE", "SINGLE_SELECT", "SELECT", "RADIO", "ENUM"].includes(type)) return true
  if (MULTI_CHOICE_FIELD_TYPES.has(type)) return true
  return false
}

function splitMultiFieldValue(value: string) {
  return value.split(/[;；]/).map((part) => part.trim()).filter(Boolean)
}

function isMultiChoiceFieldType(field: DraftField, value = "") {
  const type = deepdrawFieldType(field)
  const key = compactFieldKey(field.field_name)
  const hasOptions = fieldOptions(field).length > 0
  return MULTI_CHOICE_FIELD_TYPES.has(type)
    || (hasOptions && type === "MULTI_TEXT")
    || (hasOptions && key.includes("多选"))
    || (hasOptions && splitMultiFieldValue(value).length > 1)
}

function isLongTextFieldType(field: DraftField) {
  return ["TEXTAREA", "LONG_TEXT", "RICH_TEXT", "MULTI_TEXT"].includes(deepdrawFieldType(field))
}

function isProductArchiveSizeChartField(field: DraftField) {
  if (!compactFieldKey(field.field_name).includes("尺码表")) return false
  const fieldType = deepdrawFieldType(field)
  return fieldType === "MULTI_TEXT" || !fieldType
}

function multiFieldOptionValue(value: string, options: FieldOption[]) {
  if (options.some((option) => option.value === value)) return value
  const aliases = value.split(/[,，]/).map((part) => part.trim()).filter(Boolean)
  return options.find((option) => aliases.includes(option.value))?.value ?? ""
}

function addMultiFieldValue(value: string, optionValue: string, options: FieldOption[]) {
  const values = splitMultiFieldValue(value)
  if (values.some((item) => item === optionValue || multiFieldOptionValue(item, options) === optionValue)) return value
  return [...values, optionValue].join(";")
}

function removeMultiFieldValue(value: string, optionValue: string, options: FieldOption[]) {
  const nextValues = splitMultiFieldValue(value).filter((item) => (
    item !== optionValue && multiFieldOptionValue(item, options) !== optionValue
  ))
  return nextValues.join(";")
}

function clearInvalidMultiFieldValue(value: string, rawValue: string) {
  const nextValues = splitMultiFieldValue(value).filter((item) => item !== rawValue)
  return Array.from(new Set(nextValues)).join(";")
}

function previewImageLabel(image: ProductArchiveDraftImagePreview) {
  return textValue(image.label)
    || textValue(image.original_file_name)
    || textValue(image.file_name)
    || `图片 ${image.id}`
}

function isPreviewPdf(image: ProductArchiveDraftImagePreview) {
  const mimeType = textValue(image.mime_type).toLowerCase()
  const fileName = `${textValue(image.file_name)} ${textValue(image.original_file_name)} ${previewImageLabel(image)}`.toLowerCase()
  return mimeType === "application/pdf" || /\.pdf(?:\s|$)/.test(fileName)
}

function previewImageMeta(image: ProductArchiveDraftImagePreview) {
  const parts = []
  if (image.width && image.height) parts.push(`${image.width} × ${image.height}`)
  else if (isPreviewPdf(image)) parts.push("PDF")
  if (textValue(image.mime_type) && !isPreviewPdf(image)) parts.push(textValue(image.mime_type))
  return parts.join(" · ")
}

function previewableImages(images: ProductArchiveDraftImagePreview[]) {
  return images.filter((image) => Boolean(image.preview_url))
}

function previewImageIdentityText(image: ProductArchiveDraftImagePreview) {
  return `${textValue(image.label)} ${textValue(image.original_file_name)} ${textValue(image.file_name)}`.toLowerCase()
}

function isFlatReferenceImage(image: ProductArchiveDraftImagePreview) {
  const assetKind = textValue(image.asset_kind).toLowerCase()
  if (assetKind === "flat_image") return true
  if (assetKind === "model_image") return false
  return !/(有模拍|模拍|model)/i.test(previewImageIdentityText(image))
}

function HoverImagePreview({
  images,
  children,
  align = "center",
  side = "right",
  previewSize = "compact",
  previewLayerClassName = "z-40",
}: {
  images: ProductArchiveDraftImagePreview[]
  children: (props: {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => void
    onPointerLeave: () => void
    onFocus: (event: FocusEvent<HTMLElement>) => void
    onBlur: () => void
  }) => ReactNode
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
  previewSize?: "compact" | "large"
  previewLayerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const availableImages = previewableImages(images)
  const visibleImages = availableImages.slice(0, 4)
  const largePreview = previewSize === "large"
  const previewWidth = largePreview ? (visibleImages.length > 1 ? 344 : 176) : (visibleImages.length > 1 ? 248 : 128)
  const previewHeight = largePreview ? (visibleImages.length > 2 ? 392 : 200) : (visibleImages.length > 2 ? 296 : 152)
  const imageBoxClassName = largePreview ? "size-40" : "size-28"
  const labelClassName = largePreview ? "max-w-40" : "max-w-28"
  const updatePosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const gap = 8
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    let left = rect.right + gap
    let top = rect.top
    if (side === "left") left = rect.left - previewWidth - gap
    if (side === "top" || side === "bottom") {
      left = rect.left + rect.width / 2 - previewWidth / 2
      top = side === "top" ? rect.top - previewHeight - gap : rect.bottom + gap
    } else if (align === "center") {
      top = rect.top + rect.height / 2 - previewHeight / 2
    } else if (align === "end") {
      top = rect.bottom - previewHeight
    }
    left = Math.min(Math.max(8, left), Math.max(8, viewportWidth - previewWidth - 8))
    top = Math.min(Math.max(8, top), Math.max(8, viewportHeight - previewHeight - 8))
    setPosition({ left, top })
  }
  const triggerProps = {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      updatePosition(event.currentTarget)
      setOpen(true)
    },
    onPointerLeave: () => setOpen(false),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      updatePosition(event.currentTarget)
      setOpen(true)
    },
    onBlur: () => setOpen(false),
  }

  if (availableImages.length === 0) return <>{children(triggerProps)}</>

  return (
    <>
      {children(triggerProps)}
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className={cn("pointer-events-none fixed w-auto rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg", previewLayerClassName)}
              style={{ left: position.left, top: position.top }}
            >
              <div className={cn("grid gap-2", visibleImages.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                {visibleImages.map((image) => (
                  <div key={image.id} className="min-w-0">
                    <div className={cn("flex items-center justify-center overflow-hidden rounded-md border bg-muted/30", imageBoxClassName)}>
                      {isPreviewPdf(image) ? (
                        <div className="grid gap-1 text-center text-xs text-muted-foreground">
                          <FileText className="mx-auto size-7" />
                          PDF
                        </div>
                      ) : (
                        <img
                          src={image.thumbnail_url || image.preview_url || ""}
                          alt={previewImageLabel(image)}
                          className="h-full w-full object-contain"
                          loading="eager"
                        />
                      )}
                    </div>
                    <div className={cn("mt-1 truncate text-[11px] text-muted-foreground", labelClassName)}>
                      {previewImageLabel(image)}
                    </div>
                  </div>
                ))}
              </div>
              {availableImages.length > visibleImages.length ? (
                <div className="mt-2 text-xs text-muted-foreground">还有 {formatNumber(availableImages.length - visibleImages.length)} 张</div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

interface ImagePreviewDialogTarget {
  title: string
  description?: string
  images: ProductArchiveDraftImagePreview[]
  initialImageId?: number | string
}

function ImagePreviewDialog({
  target,
  onClose,
}: {
  target: ImagePreviewDialogTarget | null
  onClose: () => void
}) {
  const availableImages = previewableImages(target?.images ?? [])
  const initialId = target?.initialImageId ?? availableImages[0]?.id
  const [activeImageId, setActiveImageId] = useState<number | string | undefined>(initialId)
  const activeImage = availableImages.find((image) => image.id === activeImageId)
    ?? availableImages.find((image) => image.id === initialId)
    ?? availableImages[0]
  const activeLabel = activeImage ? previewImageLabel(activeImage) : ""
  const activeIsPdf = activeImage ? isPreviewPdf(activeImage) : false

  return (
    <Dialog modal={false} open={Boolean(target)} onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      {target ? (
        <DialogContent
          showOverlay={false}
          className="z-[95] max-h-[calc(100vh-2rem)] w-[min(96vw,1040px)] max-w-none overflow-hidden sm:max-w-[min(96vw,1040px)]"
        >
          <DialogHeader>
            <DialogTitle className="truncate">{target.title}</DialogTitle>
            <DialogDescription className="truncate">
              {target.description || activeLabel || "图片预览"}
            </DialogDescription>
          </DialogHeader>
          {activeImage ? (
            <div className="grid min-h-0 gap-3">
              <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                {activeIsPdf ? (
                  <iframe
                    src={activeImage.preview_url || activeImage.full_url || ""}
                    title={activeLabel}
                    className="h-[min(72vh,720px)] min-h-[420px] w-full min-w-0 bg-background"
                  />
                ) : (
                  <img
                    src={activeImage.preview_url || activeImage.full_url || ""}
                    alt={activeLabel}
                    className="block h-auto max-h-[min(72vh,720px)] max-w-full object-contain"
                  />
                )}
              </div>
              {availableImages.length > 1 ? (
                <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                  {availableImages.map((image) => {
                    const selected = image.id === activeImage.id
                    return (
                      <button
                        key={image.id}
                        type="button"
                        className={cn(
                          "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring",
                          selected && "border-[#18e299] ring-2 ring-[#18e299]/50",
                        )}
                        onClick={() => setActiveImageId(image.id)}
                        aria-label={`查看${previewImageLabel(image)}`}
                      >
                        {isPreviewPdf(image) ? (
                          <FileText className="size-5 text-muted-foreground" />
                        ) : (
                          <img
                            src={image.thumbnail_url || image.preview_url || ""}
                            alt={previewImageLabel(image)}
                            className="h-full w-full object-cover"
                            loading="eager"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              暂无可预览图片
            </div>
          )}
          {activeImage?.preview_url || activeImage?.full_url ? (
            <DialogFooter>
              <div className="mr-auto truncate text-xs text-muted-foreground">
                {activeLabel}{previewImageMeta(activeImage) ? ` · ${previewImageMeta(activeImage)}` : ""}
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={activeImage.full_url || activeImage.preview_url || ""} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  打开原文件
                </a>
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function DraftThumbnail({
  item,
  onPreview,
}: {
  item: ProductArchiveDraftRow
  onPreview: (target: ImagePreviewDialogTarget) => void
}) {
  const [failedImageId, setFailedImageId] = useState<number | string | null>(null)
  const image = draftListDisplayImage(item)
  const label = image ? previewImageLabel(image) : item.spu_code
  const failed = image ? failedImageId === image.id : false
  const thumbnailUrl = image?.thumbnail_url
  if (!image || !thumbnailUrl || failed) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-muted text-[11px] text-muted-foreground">
        无图
      </div>
    )
  }
  return (
    <HoverImagePreview images={[image]} side="right" align="start">
      {(triggerProps) => (
        <button
          type="button"
          {...triggerProps}
          className="group relative block h-14 w-14 cursor-zoom-in overflow-hidden rounded-md border bg-muted transition-all hover:-translate-y-px hover:border-[#18d892] hover:shadow-[0_4px_14px_rgba(15,23,42,0.12)] focus:outline-none focus:ring-2 focus:ring-ring active:translate-y-0"
          onClick={() => onPreview({
            title: item.spu_code,
            description: label,
            images: [image],
            initialImageId: image.id,
          })}
          aria-label={`查看${label}`}
          title={label}
        >
          <img
            src={thumbnailUrl}
            alt={label}
            className="h-full w-full object-cover"
            loading="eager"
            onError={() => setFailedImageId(image.id)}
          />
          <span className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 className="size-3" />
          </span>
        </button>
      )}
    </HoverImagePreview>
  )
}

function draftImageGroups(item: ProductArchiveDraftRow): ProductArchiveDraftImagePreviewGroups {
  return item.image_previews ?? { reference: [], hangtag: [], washlabel: [] }
}

function draftThumbnailImage(item: ProductArchiveDraftRow): ProductArchiveDraftImagePreview | null {
  const label = item.thumbnail_file_name ?? item.spu_code
  return item.thumbnail_full_url || item.thumbnail_image_url
    ? {
        id: `thumbnail-${item.id}`,
        label,
        preview_url: item.thumbnail_preview_url ?? item.thumbnail_full_url ?? item.thumbnail_image_url,
        full_url: item.thumbnail_full_url,
        thumbnail_url: item.thumbnail_image_url,
      }
    : null
}

function draftListDisplayImage(item: ProductArchiveDraftRow | null): ProductArchiveDraftImagePreview | null {
  if (!item) return null
  const referenceImages = previewableImages(draftImageGroups(item).reference)
  return referenceImages.find(isFlatReferenceImage) ?? referenceImages[0] ?? draftThumbnailImage(item)
}

function previewImageKind(image: ProductArchiveDraftImagePreview): DraftAssetKind {
  if (image.kind === "hangtag" || image.kind === "washlabel" || image.kind === "reference") return image.kind
  const name = `${textValue(image.label)} ${textValue(image.original_file_name)} ${textValue(image.file_name)}`.toLowerCase()
  if (/(洗唛|洗标|水洗|wash)/i.test(name)) return "washlabel"
  if (/(吊牌|合格证|hangtag|(?:^|[_\-\s])tag(?:[_\-\s.]|$))/i.test(name)) return "hangtag"
  return "reference"
}

function groupPreviewImages(images: ProductArchiveDraftImagePreview[]): ProductArchiveDraftImagePreviewGroups {
  return images.reduce<ProductArchiveDraftImagePreviewGroups>((groups, image) => {
    groups[previewImageKind(image)].push(image)
    return groups
  }, { reference: [], hangtag: [], washlabel: [] })
}

function draftAssetUploaded(item: ProductArchiveDraftRow, kind: DraftAssetKind) {
  const groups = draftImageGroups(item)
  if (groups[kind].length > 0) return true
  if (kind === "reference") return !item.image_previews && item.asset_package_image_count > 0
  if (kind === "hangtag") return item.hangtag_upload_count > 0
  return item.washlabel_upload_count > 0
}

function AssetPreviewBadge({
  label,
  uploaded,
  images,
  onPreview,
}: {
  label: string
  uploaded: boolean
  images: ProductArchiveDraftImagePreview[]
  onPreview: () => void
}) {
  const availableImages = previewableImages(images)
  const badge = (triggerProps: {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => void
    onPointerLeave: () => void
    onFocus: (event: FocusEvent<HTMLElement>) => void
    onBlur: () => void
  }) => (
    <button
      type="button"
      {...triggerProps}
      className={cn(
        "inline-flex h-6 max-w-[96px] items-center rounded-full border px-2 text-[11px] font-medium leading-none shadow-[0_1px_4px_rgba(15,23,42,0.06)] transition-all focus:outline-none focus:ring-2 focus:ring-ring active:translate-y-px",
        uploaded
          ? "border-[#9decc9] bg-white text-[#08794f] hover:border-[#18d892] hover:bg-[#f2fff8] hover:text-[#086b49]"
          : "border-[#e2e8f0] bg-white text-muted-foreground hover:border-[#cbd5e1] hover:bg-[#f8fafc]",
        availableImages.length > 0 ? "cursor-zoom-in" : "cursor-default",
      )}
      onClick={() => {
        if (availableImages.length > 0) onPreview()
      }}
      title={availableImages.length > 0 ? "点击查看图片" : "暂无图片预览"}
    >
      <span className="truncate">{label}{uploaded ? "已传" : "未传"}</span>
    </button>
  )

  return (
    <HoverImagePreview images={availableImages} side="left" align="start">
      {badge}
    </HoverImagePreview>
  )
}

function AssetPackageCell({
  item,
  onPreview,
}: {
  item: ProductArchiveDraftRow
  onPreview: (target: ImagePreviewDialogTarget) => void
}) {
  const groups = draftImageGroups(item)
  const openGroupPreview = (kind: DraftAssetKind, label: string) => {
    const images = previewableImages(groups[kind])
    if (images.length === 0) return
    onPreview({
      title: `${item.spu_code} · ${label}`,
      description: `${label}图片 ${formatNumber(images.length)} 张`,
      images,
      initialImageId: images[0]?.id,
    })
  }
  return (
    <div>
      <div>{formatNumber(item.image_count ?? 0)} 张</div>
      <div className="mt-1 flex flex-wrap gap-1">
        <AssetPreviewBadge
          label="吊牌"
          uploaded={draftAssetUploaded(item, "hangtag")}
          images={groups.hangtag}
          onPreview={() => openGroupPreview("hangtag", "吊牌")}
        />
        <AssetPreviewBadge
          label="洗唛"
          uploaded={draftAssetUploaded(item, "washlabel")}
          images={groups.washlabel}
          onPreview={() => openGroupPreview("washlabel", "洗唛")}
        />
        <AssetPreviewBadge
          label="平铺图"
          uploaded={draftAssetUploaded(item, "reference")}
          images={groups.reference}
          onPreview={() => openGroupPreview("reference", "平铺图")}
        />
      </div>
    </div>
  )
}

function draftMainPreviewImage(item: ProductArchiveDraftRow | null): ProductArchiveDraftImagePreview | null {
  return draftListDisplayImage(item)
}

function EvidenceImageTile({
  image,
  compact = false,
  onPreview,
}: {
  image: ProductArchiveDraftImagePreview
  compact?: boolean
  onPreview?: () => void
}) {
  const label = previewImageLabel(image)
  return (
    <HoverImagePreview
      images={[image]}
      side="right"
      align="center"
      previewSize="large"
      previewLayerClassName="z-[90]"
    >
      {(triggerProps) => (
        <button
          type="button"
          {...triggerProps}
          className={cn(
            "group relative flex shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-md border bg-background shadow-sm outline-none transition-all hover:-translate-y-px hover:border-[#18d892] hover:shadow-[0_4px_14px_rgba(15,23,42,0.12)] focus:ring-2 focus:ring-ring",
            compact ? "size-14" : "h-32 w-full",
          )}
          onClick={onPreview}
          title={label}
          aria-label={`查看${label}`}
        >
          {isPreviewPdf(image) ? (
            <div className="grid gap-1 text-center text-xs text-muted-foreground">
              <FileText className="mx-auto size-6" />
              PDF
            </div>
          ) : (
            <img
              src={image.thumbnail_url || image.preview_url || ""}
              alt={label}
              className="h-full w-full object-contain"
              loading="eager"
            />
          )}
          <span className="pointer-events-none absolute bottom-0 left-0 right-0 truncate bg-background/85 px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
            {label}
          </span>
        </button>
      )}
    </HoverImagePreview>
  )
}

function EvidenceImageGroup({
  title,
  images,
  onPreview,
}: {
  title: string
  images: ProductArchiveDraftImagePreview[]
  onPreview: (image: ProductArchiveDraftImagePreview) => void
}) {
  const availableImages = previewableImages(images)
  return (
    <section className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-muted-foreground">{formatNumber(availableImages.length)} 张</span>
      </div>
      {availableImages.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {availableImages.map((image) => (
            <EvidenceImageTile
              key={image.id}
              image={image}
              compact
              onPreview={() => onPreview(image)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          暂无图片
        </div>
      )}
    </section>
  )
}

function QuickFieldEvidencePanel({
  draft,
  detailImages,
  onPreview,
}: {
  draft: ProductArchiveDraftRow | null
  detailImages?: ProductArchiveDraftImagePreview[]
  onPreview: (target: ImagePreviewDialogTarget) => void
}) {
  const mainImage = draftMainPreviewImage(draft)
  const groups = detailImages ? groupPreviewImages(detailImages) : draft ? draftImageGroups(draft) : { reference: [], hangtag: [], washlabel: [] }
  const openEvidencePreview = (title: string, images: ProductArchiveDraftImagePreview[], image: ProductArchiveDraftImagePreview) => {
    const availableImages = previewableImages(images)
    if (availableImages.length === 0) return
    onPreview({
      title: draft ? `${draft.spu_code} · ${title}` : title,
      description: `${title}图片 ${formatNumber(availableImages.length)} 张`,
      images: availableImages,
      initialImageId: image.id,
    })
  }
  return (
    <aside
      className="flex h-full min-h-[220px] max-h-[34vh] min-w-0 flex-col overflow-hidden rounded-lg border bg-muted/20 p-3 lg:min-h-0 lg:max-h-full"
      data-testid="quick-field-evidence-panel"
    >
      <div className="mb-3 shrink-0">
        <div className="text-sm font-semibold">填字段参考图</div>
        <div className="mt-1 text-xs text-muted-foreground">鼠标移入缩略图查看放大预览</div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]"
        data-testid="quick-field-evidence-scroll"
      >
        <div className="grid gap-4">
          <section>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">商品主图</span>
              <span className="text-muted-foreground">{mainImage ? "1 张" : "0 张"}</span>
            </div>
            {mainImage ? (
              <EvidenceImageTile
                image={mainImage}
                onPreview={() => openEvidencePreview("商品主图", [mainImage], mainImage)}
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-md border border-dashed bg-background/70 text-xs text-muted-foreground">
                暂无主图
              </div>
            )}
          </section>
          <EvidenceImageGroup
            title="吊牌"
            images={groups.hangtag}
            onPreview={(image) => openEvidencePreview("吊牌", groups.hangtag, image)}
          />
          <EvidenceImageGroup
            title="洗唛"
            images={groups.washlabel}
            onPreview={(image) => openEvidencePreview("洗唛", groups.washlabel, image)}
          />
          <EvidenceImageGroup
            title="平铺图"
            images={groups.reference}
            onPreview={(image) => openEvidencePreview("平铺图", groups.reference, image)}
          />
        </div>
      </div>
    </aside>
  )
}

function tradeSelectionTitle(status: TradeSelectionDecision["status"]) {
  if (status === "auto_applied") return "已自动应用推荐类目"
  if (status === "pending_confirmation") return "已自动应用，待人工确认"
  if (status === "manual_selection_required") return "需要人工选择"
  if (status === "human_confirmed") return "人工已确认"
  return "人工已调整"
}

function tradeSelectionConfidenceLabel(confidence: TradeSelectionDecision["confidence"]) {
  if (confidence === "high") return "高置信度"
  if (confidence === "medium") return "中置信度"
  return "无自动匹配置信度"
}

function tradeSelectionClass(status: TradeSelectionDecision["status"]) {
  if (status === "auto_applied" || status === "human_confirmed") {
    return "border-[#b9f4d8] bg-[#f2fcf7]"
  }
  if (status === "pending_confirmation") return "border-[#f4ddb3] bg-[#fffaf0]"
  if (status === "manual_selection_required") return "border-[#f1cccc] bg-[#fff6f6]"
  return "border-[#d7e5fb] bg-[#f4f8ff]"
}

function issueSeverityLabel(severity: string) {
  if (severity === "blocker") return "阻断"
  if (severity === "warning") return "警告"
  return severity || "提示"
}

function issueSeverityClass(severity: string) {
  if (severity === "blocker") return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  if (severity === "warning") return "border-[#f4ddb3] bg-[#fff8e8] text-[#c37d0d]"
  return "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
}

function issueSummaryText(issues: DraftIssue[]) {
  return Array.from(new Set(issues.map((issue) => issue.message).filter(Boolean))).join("；")
}

function SingleChoiceFieldEditor({
  field,
  value,
  options,
  onChange,
  disabled = false,
}: {
  field: DraftField
  value: string
  options: FieldOption[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-8 min-w-[220px] max-w-[360px] justify-between px-3 font-normal"
          disabled={disabled}
        >
          <span className={cn("min-w-0 truncate", !selectedOption && "text-muted-foreground")}>
            {selectedOption ? selectedOption.label : "选择字段值"}
          </span>
          <Search className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-4rem))] p-0">
        <Command>
          <CommandInput placeholder={`搜索${field.field_name}选项`} />
          <CommandList className="max-h-80">
            <CommandEmpty>没有匹配的选项</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const selected = option.value === value
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      if (disabled) return
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className="gap-2"
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {selected ? <CheckMini /> : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function MultiChoiceFieldEditor({
  field,
  value,
  options,
  onChange,
  disabled = false,
}: {
  field: DraftField
  value: string
  options: FieldOption[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selectedValues = splitMultiFieldValue(value)
  const selectedOptionValues = new Set(
    selectedValues
      .map((item) => multiFieldOptionValue(item, options))
      .filter(Boolean),
  )
  const selectedTags = selectedValues.map((item) => {
    const optionValue = multiFieldOptionValue(item, options)
    const option = optionValue ? options.find((candidate) => candidate.value === optionValue) : null
    return {
      rawValue: item,
      optionValue,
      label: option && item === option.value ? option.label : item,
      valid: Boolean(option),
    }
  })
  const availableOptions = options.filter((option) => !selectedOptionValues.has(option.value))

  return (
    <div className="min-w-[260px] max-w-[420px] space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full justify-between px-3 font-normal"
            disabled={disabled}
          >
            <span className="truncate">
              {selectedTags.length ? `已选 ${formatNumber(selectedTags.length)} 项，继续添加` : "添加选项"}
            </span>
            <Search className="ml-2 size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(420px,calc(100vw-4rem))] p-0">
          <Command>
            <CommandInput placeholder={`搜索${field.field_name}选项`} />
            <CommandList className="max-h-72">
              <CommandEmpty>{availableOptions.length ? "没有匹配的选项" : "没有可添加的选项"}</CommandEmpty>
              <CommandGroup>
                {availableOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      if (!disabled) onChange(addMultiFieldValue(value, option.value, options))
                    }}
                    className="gap-2"
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="flex items-center justify-between border-t px-3 py-2">
              <span className="text-xs text-muted-foreground">当前已选 {formatNumber(selectedTags.length)} 项</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} disabled={disabled || selectedTags.length === 0}>
                清空
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedTags.length > 0 ? (
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-md border bg-background p-2">
          {selectedTags.map((tag) => (
            <Badge
              key={`${tag.rawValue}\u0000${tag.optionValue}`}
              variant="outline"
              className={cn(
                "max-w-full gap-1 rounded-md border-[#5bdca8] bg-[#dff8ed] px-2 py-1 font-medium text-[#0b7f56] shadow-sm",
                !tag.valid && "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]",
              )}
            >
              <span className="max-w-[300px] truncate">{tag.valid ? tag.label : `${tag.label}（不在模板）`}</span>
              <button
                type="button"
                className={cn(
                  "rounded-sm text-[#0b7f56]/70 hover:text-[#075f42] focus:outline-none focus:ring-2 focus:ring-ring",
                  !tag.valid && "text-[#d45656]/70 hover:text-[#b63f3f]",
                )}
                onClick={() => onChange(tag.optionValue
                  ? removeMultiFieldValue(value, tag.optionValue, options)
                  : clearInvalidMultiFieldValue(value, tag.rawValue))}
                disabled={disabled}
                aria-label={`移除${tag.label}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">未选择</div>
      )}
    </div>
  )
}

function DraftFieldEditor({
  field,
  value,
  canWrite,
  onChange,
  onOpenDetail,
}: {
  field: DraftField
  value: string
  canWrite: boolean
  onChange: (value: string) => void
  onOpenDetail: () => void
}) {
  const options = fieldOptions(field)
  const isSizeChartField = isProductArchiveSizeChartField(field)
  const isChoiceField = isChoiceFieldType(field)
  const isMultiChoiceField = isMultiChoiceFieldType(field, value)
  if (isSizeChartField) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={onOpenDetail}>
        <ExternalLink className="size-4" />
        进入详情配置尺码表
      </Button>
    )
  }
  if (isChoiceField && isMultiChoiceField && options.length > 0) {
    return (
      <MultiChoiceFieldEditor
        field={field}
        value={value}
        options={options}
        disabled={!canWrite}
        onChange={onChange}
      />
    )
  }
  if (isChoiceField && options.length > 0) {
    return (
      <SingleChoiceFieldEditor
        field={field}
        value={value}
        options={options}
        disabled={!canWrite}
        onChange={onChange}
      />
    )
  }
  if (isLongTextFieldType(field)) {
    return (
      <Textarea
        value={value}
        disabled={!canWrite}
        onChange={(event) => onChange(event.target.value)}
        placeholder="填写目标值"
        className="min-h-20 min-w-[260px]"
      />
    )
  }
  return (
    <Input
      value={value}
      disabled={!canWrite}
      onChange={(event) => onChange(event.target.value)}
      placeholder="填写目标值"
      className="h-8"
    />
  )
}

function CheckMini() {
  return <span className="ml-1 size-1.5 shrink-0 rounded-full bg-[#0fa76e]" aria-hidden="true" />
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
  const uploadSummary = hangtagWashlabelUploadSummary(files, scmSupplementFile, referenceImageFiles)
  const previewTooLarge = uploadSummary.count > OCR_PREVIEW_MAX_FILES || uploadSummary.bytes > OCR_PREVIEW_MAX_BYTES
  const backgroundBatchCount = estimateHangtagWashlabelBackgroundBatchCount(files, scmSupplementFile, referenceImageFiles)
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
            {hasUploadInput ? (
              <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${previewTooLarge ? "border-[#f3d7a1] bg-[#fff8eb] text-[#8a5a0a]" : "border-[#d7e5fb] bg-[#f6fbff] text-[#245f9f]"}`}>
                已选择 {formatNumber(uploadSummary.count)} 个文件 / {formatUploadBytes(uploadSummary.bytes)}
                {backgroundBatchCount > 1 ? `，后台识别将拆分为 ${formatNumber(backgroundBatchCount)} 个任务` : ""}
                {previewTooLarge ? `；超过预览上限 ${formatNumber(OCR_PREVIEW_MAX_FILES)} 个 / ${formatUploadBytes(OCR_PREVIEW_MAX_BYTES)}` : ""}
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
            disabled={!canWrite || isPreviewing || isApplying || isSubmittingJob || jobRunning || !hasUploadInput || previewTooLarge}
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
  const fieldEditorDraftIdRef = useRef<number | null>(null)
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
  const [imagePreviewTarget, setImagePreviewTarget] = useState<ImagePreviewDialogTarget | null>(null)
  const [tradeEditorDraft, setTradeEditorDraft] = useState<ProductArchiveDraftRow | null>(null)
  const [fieldEditorDraft, setFieldEditorDraft] = useState<ProductArchiveDraftRow | null>(null)
  const [tradeSearch, setTradeSearch] = useState("")
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const [quickFieldValues, setQuickFieldValues] = useState<Record<number, string>>({})
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const debouncedQuery = useDebounce(searchText, 300)
  const debouncedTradeSearch = useDebounce(tradeSearch, 250)
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
  const activeDetailDraft = tradeEditorDraft ?? fieldEditorDraft
  const activeDetailDraftId = activeDetailDraft?.id
  const activeDraftDetail = useQuery<DraftDetail>({
    queryKey: ["product-archive-drafts", activeDetailDraftId],
    enabled: Boolean(activeDetailDraftId),
    queryFn: () => api.get<DraftDetail>(`/product-archive-drafts/${activeDetailDraftId}`),
  })
  const activeTradeTenantName = activeDraftDetail.data?.draft.tenant_name ?? tradeEditorDraft?.tenant_name ?? ""
  const trades = useQuery<TradeListResponse>({
    queryKey: ["deepdraw-metadata-trades", activeTradeTenantName, debouncedTradeSearch],
    enabled: Boolean(tradeEditorDraft && activeTradeTenantName),
    queryFn: () =>
      api.get<TradeListResponse>(`/deepdraw-metadata/trades?q=${encodeURIComponent(debouncedTradeSearch)}&tenantName=${encodeURIComponent(activeTradeTenantName)}`),
  })
  const selectedTrade = useMemo(() => {
    return (trades.data?.items ?? []).find((trade) => trade.trade_id === selectedTradeId) ?? null
  }, [selectedTradeId, trades.data?.items])

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
  const unresolvedQuickIssues = useMemo(() => {
    return (activeDraftDetail.data?.issues ?? []).filter((issue) => !issue.resolved_at && issue.severity === "blocker" && Boolean(issue.field_name))
  }, [activeDraftDetail.data?.issues])
  const quickFieldIssueMap = useMemo(() => {
    const map = new Map<string, DraftIssue[]>()
    for (const issue of unresolvedQuickIssues) {
      if (!issue.field_name) continue
      const issues = map.get(issue.field_name) ?? []
      issues.push(issue)
      map.set(issue.field_name, issues)
    }
    return map
  }, [unresolvedQuickIssues])
  const quickRequiredBlockerFields = useMemo(() => {
    return (activeDraftDetail.data?.fields ?? []).filter((field) => (
      field.required
      && field.blocking
      && quickFieldIssueMap.has(field.field_name)
    ))
  }, [activeDraftDetail.data?.fields, quickFieldIssueMap])
  const quickChangedFields = useMemo(() => {
    const currentFields = new Map((activeDraftDetail.data?.fields ?? []).map((field) => [field.id, field]))
    return Object.entries(quickFieldValues)
      .filter(([id, value]) => value !== (currentFields.get(Number(id))?.value_text ?? ""))
      .flatMap(([id, valueText]) => {
        const field = currentFields.get(Number(id))
        if (!field) return []
        return [{
          id: field.id,
          fieldName: field.field_name,
          expectedUpdatedAt: field.updated_at,
          valueText,
        }]
      })
  }, [activeDraftDetail.data?.fields, quickFieldValues])

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
      assertHangtagWashlabelPreviewLimits(ocrFiles, ocrScmSupplementFile, ocrReferenceImageFiles)
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

  function addHangtagWashlabelOcrTask(job: AsyncTaskJob, index: number, total: number) {
    addTask({
      job,
      type: "product_archive_hangtag_washlabel_ocr",
      title: total > 1 ? `吊牌/洗唛/平铺图后台识别 ${index + 1}/${total}` : "吊牌/洗唛/平铺图后台识别",
      description: `待识别并写入 ${formatNumber(Math.max(0, (job.total_count ?? 1) - 1))} 个上传项`,
      endpoint: `/product-archive-drafts/hangtag-washlabel-ocr/jobs/${job.id}`,
    })
  }

  const submitHangtagWashlabelOcrJob = useMutation({
    mutationFn: async () => {
      const batches = splitHangtagWashlabelBackgroundBatches(ocrFiles, ocrScmSupplementFile, ocrReferenceImageFiles)
      const jobs: AsyncTaskJob[] = []
      for (const [index, batch] of batches.entries()) {
        const form = buildHangtagWashlabelOcrForm(batch.files, batch.scmSupplementFile, ocrOverwriteExisting, batch.referenceImageFiles)
        const job = await api.postForm<AsyncTaskJob>("/product-archive-drafts/hangtag-washlabel-ocr/jobs", form)
        jobs.push(job)
        addHangtagWashlabelOcrTask(job, index, batches.length)
      }
      return jobs
    },
    onSuccess: (jobs) => {
      setOcrJobId(jobs.at(-1)?.id ?? null)
      setOcrPreview(null)
      setOcrFiles([])
      setOcrReferenceImageFiles([])
      setOcrScmSupplementFile(null)
      toast.success(jobs.length > 1
        ? `吊牌/洗唛/平铺图后台识别已拆分为 ${formatNumber(jobs.length)} 个任务`
        : "吊牌/洗唛/平铺图后台识别任务已提交")
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

  const applyTradeFromList = useMutation({
    mutationFn: () => {
      if (!tradeEditorDraft?.id) throw new Error("请选择要编辑的草稿")
      return api.patch<DraftDetail>(`/product-archive-drafts/${tradeEditorDraft.id}/trade`, {
        tradeId: selectedTrade?.trade_id ?? selectedTradeId,
        tradePath: selectedTrade?.trade_path,
      })
    },
    onSuccess: (result) => {
      toast.success("已应用类目并生成字段")
      queryClient.setQueryData(["product-archive-drafts", result.draft.id], result)
      setTradeEditorDraft(null)
      setSelectedTradeId(null)
      setTradeSearch("")
      setQuickFieldValues({})
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "应用类目失败")
    },
  })

  const saveQuickFields = useMutation({
    mutationFn: (request: DraftFieldPatchRequest) => api.patch<DraftDetail>(
      `/product-archive-drafts/${request.draftId}/fields`,
      {
        expectedDraftUpdatedAt: request.expectedDraftUpdatedAt,
        fields: request.fields,
      },
    ),
    onSuccess: (result, request) => {
      toast.success("字段已保存并重新校验")
      queryClient.setQueryData(["product-archive-drafts", result.draft.id], result)
      if (fieldEditorDraftIdRef.current === request.draftId) {
        setQuickFieldValues((current) => {
          const next = { ...current }
          for (const field of request.fields) {
            if (current[field.id] === field.valueText) delete next[field.id]
          }
          return next
        })
      }
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "保存字段失败")
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

  function openTradeEditor(item: ProductArchiveDraftRow) {
    fieldEditorDraftIdRef.current = null
    setFieldEditorDraft(null)
    setQuickFieldValues({})
    setTradeSearch("")
    setSelectedTradeId(item.trade_id)
    setTradeEditorDraft(item)
  }

  function openFieldEditor(item: ProductArchiveDraftRow) {
    setTradeEditorDraft(null)
    setTradeSearch("")
    setSelectedTradeId(null)
    setQuickFieldValues({})
    fieldEditorDraftIdRef.current = item.id
    setFieldEditorDraft(item)
  }

  function closeFieldEditor() {
    fieldEditorDraftIdRef.current = null
    setFieldEditorDraft(null)
  }

  function saveQuickFieldChanges() {
    if (!fieldEditorDraft?.id || !activeDraftDetail.data?.draft.updated_at) {
      toast.error("草稿详情尚未加载完成，请稍后重试")
      return
    }
    saveQuickFields.mutate({
      draftId: fieldEditorDraft.id,
      expectedDraftUpdatedAt: activeDraftDetail.data.draft.updated_at,
      fields: quickChangedFields,
    })
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

      <ImagePreviewDialog
        target={imagePreviewTarget}
        onClose={() => setImagePreviewTarget(null)}
      />

      <Dialog
        open={Boolean(tradeEditorDraft)}
        onOpenChange={(open) => {
          if (open) return
          setTradeEditorDraft(null)
          setSelectedTradeId(null)
          setTradeSearch("")
        }}
      >
        <DialogContent className="grid h-[min(92dvh,900px)] max-h-[calc(100dvh-2rem)] w-[min(96vw,1040px)] max-w-none grid-rows-[auto_auto_auto_minmax(220px,1fr)_auto] overflow-hidden sm:max-w-[min(96vw,1040px)]">
          <DialogHeader>
            <DialogTitle>选择深绘类目</DialogTitle>
            <DialogDescription>
              {tradeEditorDraft ? `${tradeEditorDraft.spu_code} · ${tradeEditorDraft.title || "未命名"}` : "从已同步的深绘类目主数据中选择模板。"}
            </DialogDescription>
          </DialogHeader>
          {activeDraftDetail.isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载草稿类目上下文
            </div>
          ) : activeDraftDetail.isError ? (
            <div className="rounded-lg border border-[#f1cccc] bg-[#fff8f8] px-3 py-4 text-sm text-[#d45656]">
              {activeDraftDetail.error instanceof Error ? activeDraftDetail.error.message : "草稿详情加载失败"}
            </div>
          ) : (
            <div className="grid max-h-[min(38dvh,360px)] min-h-0 gap-3 overflow-y-auto pr-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] [scrollbar-gutter:stable]">
              {activeDraftDetail.data?.tradeSelectionDecision ? (
                <div className={cn("rounded-lg border p-3", tradeSelectionClass(activeDraftDetail.data.tradeSelectionDecision.status))}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">系统选择结论</div>
                      <div className="mt-0.5 text-sm font-medium">{tradeSelectionTitle(activeDraftDetail.data.tradeSelectionDecision.status)}</div>
                    </div>
                    <Badge variant="outline">{tradeSelectionConfidenceLabel(activeDraftDetail.data.tradeSelectionDecision.confidence)}</Badge>
                  </div>
                  <div className="mt-2 text-sm leading-5 text-muted-foreground">{activeDraftDetail.data.tradeSelectionDecision.reason}</div>
                  <div className="mt-2 text-xs">
                    推荐：{activeDraftDetail.data.tradeSelectionDecision.recommendedTrade?.tradePath || "暂无唯一推荐"}
                    {activeDraftDetail.data.tradeSelectionDecision.recommendedTrade ? ` · ${activeDraftDetail.data.tradeSelectionDecision.recommendedTrade.tradeId}` : ""}
                  </div>
                </div>
              ) : null}
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">上市计划表类目参考</div>
                  <Badge variant={activeDraftDetail.data?.launchPlanReference?.matched ? "secondary" : "outline"}>
                    {activeDraftDetail.data?.launchPlanReference?.matched ? "已匹配上市计划表" : "未匹配上市计划表"}
                  </Badge>
                </div>
                {activeDraftDetail.data?.launchPlanReference?.matched ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {activeDraftDetail.data.launchPlanReference.fields.map((field) => (
                      <div key={field.key} className="rounded-md border bg-background px-3 py-2">
                        <div className="text-xs text-muted-foreground">{field.label}</div>
                        <div className="mt-1 break-words text-sm leading-5">{field.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-dashed bg-background px-3 py-2 text-sm text-muted-foreground">
                    未匹配上市计划表
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={tradeSearch}
              onChange={(event) => setTradeSearch(event.target.value)}
              placeholder="搜索类目名称、路径或 tradeId"
              className="pl-9"
            />
          </div>
          <ScrollArea className="min-h-0 overflow-hidden rounded-lg border">
            <div className="divide-y">
              {(trades.data?.items ?? []).map((trade) => {
                const selected = selectedTradeId === trade.trade_id
                return (
                  <button
                    key={trade.trade_id}
                    type="button"
                    className={cn("grid w-full gap-1 px-4 py-3 text-left text-sm hover:bg-muted", selected && "bg-[#d4fae8]")}
                    onClick={() => setSelectedTradeId(trade.trade_id)}
                  >
                    <span className="font-medium">{trade.trade_name || trade.trade_id}</span>
                    <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
                      <span className="truncate">{trade.trade_path || "未维护路径"}</span>
                      <span>· {trade.trade_id}</span>
                      {selected ? <CheckMini /> : null}
                    </span>
                  </button>
                )
              })}
              {!trades.isFetching && (trades.data?.items ?? []).length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  未找到类目，请先到“深绘类目字段”同步主数据。
                </div>
              ) : null}
              {trades.isFetching ? (
                <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在加载类目
                </div>
              ) : null}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTradeEditorDraft(null)}>
              取消
            </Button>
            <Button
              type="button"
              disabled={!canWrite || !selectedTradeId || applyTradeFromList.isPending}
              onClick={() => applyTradeFromList.mutate()}
            >
              {applyTradeFromList.isPending ? <Loader2 className="size-4 animate-spin" /> : <ListTree className="size-4" />}
              应用类目并生成字段
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(fieldEditorDraft)}
        onOpenChange={(open) => {
          if (open) return
          closeFieldEditor()
          setQuickFieldValues({})
        }}
      >
        <DialogContent
          className="grid max-h-[86vh] w-[min(96vw,1180px)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-[min(96vw,1180px)]"
          onEscapeKeyDown={(event) => {
            if (imagePreviewTarget) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (imagePreviewTarget) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (imagePreviewTarget) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>快速填充阻断必填字段</DialogTitle>
            <DialogDescription>
              {fieldEditorDraft ? `${fieldEditorDraft.spu_code} · ${fieldEditorDraft.trade_path || "待确认类目"}` : "只显示当前有阻断问题的必填字段。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid h-full min-h-0 overflow-hidden gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <QuickFieldEvidencePanel
              draft={fieldEditorDraft}
              detailImages={activeDraftDetail.data?.images}
              onPreview={setImagePreviewTarget}
            />
            <ScrollArea className="min-h-0 rounded-lg border">
              {activeDraftDetail.isLoading ? (
                <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在加载字段
                </div>
              ) : activeDraftDetail.isError ? (
                <div className="px-4 py-8 text-sm text-[#d45656]">
                  {activeDraftDetail.error instanceof Error ? activeDraftDetail.error.message : "字段加载失败"}
                </div>
              ) : quickRequiredBlockerFields.length > 0 ? (
                <Table className="w-max min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>字段名</TableHead>
                      <TableHead>当前值</TableHead>
                      <TableHead>问题原因</TableHead>
                      <TableHead>填充</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quickRequiredBlockerFields.map((field) => {
                      const value = quickFieldValues[field.id] ?? field.value_text ?? ""
                      const fieldIssues = quickFieldIssueMap.get(field.field_name) ?? []
                      return (
                        <TableRow key={field.id} className="border-l-4 border-l-[#d45656] bg-[#fff8f8] hover:bg-[#fff8f8]">
                          <TableCell className="min-w-[150px] whitespace-normal align-top">
                            <div className="font-medium text-[#d45656]">{field.field_name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{field.source_type || "manual"}</div>
                          </TableCell>
                          <TableCell className="max-w-[180px] whitespace-normal align-top text-sm">
                            {isProductArchiveSizeChartField(field) && recordValue(field.value_json).title
                              ? "已生成表格"
                              : field.value_text || "-"}
                          </TableCell>
                          <TableCell className="max-w-[240px] whitespace-normal align-top">
                            <div className="flex flex-wrap items-center gap-2 text-sm text-[#d45656]">
                              <Badge variant="outline" className={issueSeverityClass("blocker")}>
                                {issueSeverityLabel("blocker")}
                              </Badge>
                              <span>{issueSummaryText(fieldIssues)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[260px] align-top">
                            <DraftFieldEditor
                              field={field}
                              value={value}
                              canWrite={canWrite}
                              onChange={(nextValue) => setQuickFieldValues((current) => ({ ...current, [field.id]: nextValue }))}
                              onOpenDetail={() => window.open(`/product-archive-drafts/${fieldEditorDraft?.id}`, "_blank", "noopener,noreferrer")}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  当前没有必填且阻断的问题字段。若阻断来自“待确认类目”或 SKU 数据，请先处理对应入口。
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeFieldEditor}>
              关闭
            </Button>
            <Button
              type="button"
              disabled={!canWrite || quickChangedFields.length === 0 || saveQuickFields.isPending}
              onClick={saveQuickFieldChanges}
            >
              {saveQuickFields.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              保存字段
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Table className="min-w-[1560px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="选择全部草稿"
                      checked={allVisibleSelected}
                      onCheckedChange={toggleAllVisible}
                    />
                  </TableHead>
                  <TableHead className="w-20">图片</TableHead>
                  <TableHead className="w-40">款号</TableHead>
                  <TableHead className="w-48">标题</TableHead>
                  <TableHead className="w-32">租户/商户</TableHead>
                  <TableHead className="w-56">类目</TableHead>
                  <TableHead className="w-24">状态</TableHead>
                  <TableHead className="w-24">问题字段</TableHead>
                  <TableHead className="w-32">图包资料</TableHead>
                  <TableHead className="w-16">SKU</TableHead>
                  <TableHead className="w-28">productId</TableHead>
                  <TableHead className="w-36">更新时间</TableHead>
                  <TableHead className="w-32">操作</TableHead>
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
                          item={item}
                          onPreview={setImagePreviewTarget}
                        />
                      </TableCell>
                      <TableCell>
                        <Link to={`/product-archive-drafts/${item.id}`} className="font-medium text-primary hover:underline">
                          {item.spu_code}
                        </Link>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{item.draft_no}</div>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="line-clamp-2 break-words leading-5">
                          {item.title || "未命名"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{item.tenant_name}</div>
                        <div className="text-xs text-muted-foreground">{item.merchant_id}</div>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className={cn(
                            "group inline-flex h-9 w-full min-w-0 cursor-pointer items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-left text-sm font-semibold shadow-[0_1px_6px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(15,23,42,0.12)] focus:outline-none focus:ring-2 focus:ring-ring active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55",
                            item.trade_path
                              ? "border-[#9decc9] text-[#10231b] hover:border-[#18d892] hover:bg-[#f2fff8] hover:text-[#08794f]"
                              : "border-[#ffd58a] text-[#9a6400] hover:border-[#f2a900] hover:bg-[#fff9e8]",
                          )}
                          disabled={!canWrite}
                          onClick={() => openTradeEditor(item)}
                          title={item.trade_path || "待确认"}
                        >
                          <span className="min-w-0 flex-1 truncate">{item.trade_path || "待确认"}</span>
                          <ChevronRight className="size-3.5 shrink-0 text-[#0fa76e] transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(item.status)}>
                          {statusLabels[item.status] ?? item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.blocker_count > 0 ? (
                          <button
                            type="button"
                            className="group inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#ffcaca] bg-white px-2.5 py-1 text-sm font-semibold shadow-[0_1px_6px_rgba(212,86,86,0.12)] transition-all hover:-translate-y-px hover:border-[#ff9b9b] hover:bg-[#fff7f7] hover:shadow-[0_4px_14px_rgba(212,86,86,0.16)] focus:outline-none focus:ring-2 focus:ring-ring active:translate-y-px"
                            onClick={() => openFieldEditor(item)}
                            title="快速填充阻断必填字段"
                          >
                            <span className="text-[#d45656]">{item.blocker_count}</span>
                            <span className="mx-1 text-muted-foreground">/</span>
                            <span className="text-[#c37d0d]">{item.warning_count}</span>
                            <ChevronRight className="ml-1 size-3.5 shrink-0 text-[#d45656] transition-transform group-hover:translate-x-0.5" />
                          </button>
                        ) : (
                          <span className="inline-flex h-9 cursor-default items-center rounded-lg border border-[#f2e5cc] bg-white/70 px-2.5 py-1 text-sm font-semibold text-muted-foreground">
                            <span>{item.blocker_count}</span>
                            <span className="mx-1">/</span>
                            <span className={item.warning_count > 0 ? "text-[#c37d0d]" : undefined}>{item.warning_count}</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <AssetPackageCell item={item} onPreview={setImagePreviewTarget} />
                      </TableCell>
                      <TableCell>{formatNumber(item.sku_count)}</TableCell>
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
