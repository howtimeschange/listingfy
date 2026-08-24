import { Fragment, useMemo, useRef, useState, type ReactNode } from "react"
import { Link, useParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, ExternalLink, FileText, Images, ListTree, Loader2, Maximize2, Pin, PinOff, RefreshCw, Save, Search, Send, Sparkles, Trash2, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

interface Draft {
  id: number
  draft_no: string
  spu_code: string
  tenant_name: string
  merchant_id: string
  trade_id: string | null
  trade_path: string | null
  title: string | null
  retail_price: number | null
  status: string
  source_snapshot_json: unknown
  validation_summary_json: { blocker_count?: number; warning_count?: number; validated_at?: string }
  duplicate_result_json: unknown
  created_product_id: string | null
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

interface DraftSku {
  id: number
  skc_code: string | null
  sku_code: string
  barcode: string | null
  color_name: string | null
  size_name: string | null
  size_code?: string | null
  price: number | null
  seller_code: string | null
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

interface DraftLog {
  id: number
  operation: string
  http_status: number | null
  response_code: string | null
  response_reason: string | null
  request_id: string | null
  product_id: string | null
  created_at: string
}

interface DraftImage {
  id: number
  draft_id: number
  spu_code: string
  source_type: string
  source_ref: string | null
  file_name: string
  original_file_name: string | null
  mime_type: string | null
  file_size: number | null
  width: number | null
  height: number | null
  preview_url: string | null
  raw_payload_json?: unknown
  created_at: string
}

type DraftAssetKind = "reference" | "hangtag" | "washlabel"

type DraftAssetPreviewTarget = {
  image: DraftImage
  kind: DraftAssetKind
}

interface DraftDetail {
  draft: Draft
  tradeSelectionDecision: TradeSelectionDecision
  launchPlanReference?: LaunchPlanReference
  sizeChartMappings?: SizeChartMapping[]
  sizeChartSourceRows?: SizeChartSourceRow[]
  fields: DraftField[]
  skus: DraftSku[]
  issues: DraftIssue[]
  images?: DraftImage[]
  logs: DraftLog[]
}

interface DraftFieldPatch {
  id: number
  fieldName: string
  expectedUpdatedAt: string
  valueText: string
  valueJson?: Record<string, unknown>
}

interface DraftFieldPatchRequest {
  expectedDraftUpdatedAt: string
  fields: DraftFieldPatch[]
}

interface SizeChartFieldPatchRequest extends DraftFieldPatchRequest {
  cellValues: Record<string, string>
}

interface TradeSelectionDecision {
  status: "auto_applied" | "pending_confirmation" | "manual_selection_required" | "human_confirmed" | "human_adjusted"
  confidence: "high" | "medium" | "none"
  reasonCode: "unique_high_confidence" | "medium_confidence" | "source_category_conflict" | "missing_source_category" | "missing_platform_coverage" | "missing_size_template_coverage" | "missing_semantic_match" | "ambiguous_match" | "applied_trade_mismatch" | "legacy_backfill_confirmation_required" | "human_confirmed" | "human_adjusted"
  recommendedTrade: { tradeId: string; tradePath: string } | null
  appliedTrade: { tradeId: string; tradePath: string } | null
  matchedField: string | null
  matchedValue: string | null
  requiredPlatforms: string[]
  coveredPlatforms: string[]
  sourceConflict: boolean
  reason: string
  evaluatedAt: string
  confirmedAt: string | null
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

interface SizeChartSourceRow {
  spuCode: string
  measurementPoint: string
  size: string
  sizeValue: string
  sheetName?: string
  rowNumber?: number | null
  rowJson?: Record<string, unknown>
}

interface SizeChartMapping {
  fieldName: string
  targetField: string
  sourcePoint: string | null
  confidence: string
  source: string
  reason?: string
}

interface SizeChartPreviewItem {
  fieldId: number
  fieldName: string
  expectedUpdatedAt: string
  valueJson: Record<string, unknown>
  persistedValueJson: Record<string, unknown>
  rows: Array<{ size: string; values: string[] }>
  titles: string[]
}

interface SizeChartSourceMatrix {
  titles: string[]
  rows: Array<{ size: string; values: string[] }>
  rowCount: number
}

interface SizeChartRecommendationResponse {
  draftId: number
  source: string
  mappings: SizeChartMapping[]
  previews?: Array<{
    fieldName: string
    valueJson: Record<string, unknown>
    mappings: SizeChartMapping[]
    unmatchedTargets: string[]
  }>
}

interface SizeChartMappingSaveResponse {
  draftId: number
  saved: SizeChartMapping[]
  detail?: DraftDetail
}

function useDraftDetail(draftId: string | undefined) {
  return useQuery<DraftDetail>({
    queryKey: ["product-archive-drafts", draftId],
    enabled: Boolean(draftId),
    queryFn: () => api.get<DraftDetail>(`/product-archive-drafts/${draftId}`),
  })
}

function draftDetailFallbackDescription(detail: ReturnType<typeof useDraftDetail>) {
  if (detail.isLoading) return "正在加载草稿详情"
  if (detail.error instanceof ApiError && detail.error.status === 404) return "草稿不存在"
  if (detail.isError) {
    const message = detail.error instanceof Error ? detail.error.message : ""
    return message ? `草稿详情加载失败：${message}` : "草稿详情加载失败，请稍后重试"
  }
  return "草稿不存在"
}

function statusClass(status: string) {
  if (["ready", "created", "readback_verified"].includes(status)) return "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
  if (["missing_fields", "manual_review", "readback_mismatch"].includes(status)) return "border-[#f4ddb3] bg-[#fff8e8] text-[#c37d0d]"
  if (["failed", "duplicate_found"].includes(status)) return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  return "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
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

function fieldOptions(field: DraftField): FieldOption[] {
  const options = parseOptionList(field.options_json)
    .map((option) => {
      const value = fieldOptionText(option, ["value", "code", "id", "optionValue", "option_value", "key", "name", "label"])
      const label = fieldOptionText(option, ["label", "name", "text", "optionName", "option_name", "title", "value", "code"])
      if (!value && !label) return null
      return { value: value || label, label: label || value }
    })
    .filter(Boolean) as FieldOption[]
  return Array.from(new Map(options.map((option) => [option.value, option])).values())
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

function splitMultiFieldValue(value: string) {
  return value.split(/[;；]/).map((part) => part.trim()).filter(Boolean)
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

function uploadDisplayName(file: File) {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return relativePath || file.name
}

function uploadExtension(file: File) {
  return uploadDisplayName(file).split(".").pop()?.toLowerCase() ?? ""
}

function isDraftReferenceImageFile(file: File) {
  return ["jpg", "jpeg", "png", "webp"].includes(uploadExtension(file))
}

function buildDraftImageUploadForm(files: File[]) {
  const form = new FormData()
  for (const file of files) {
    form.append("files", file)
    form.append("filePaths", uploadDisplayName(file))
  }
  return form
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

function compactFieldKey(value: string) {
  return value.replace(/\s+/g, "").replace(/[()（）]/g, "").toLowerCase()
}

function isProductArchiveSizeChartField(field: DraftField) {
  if (!compactFieldKey(field.field_name).includes("尺码表")) return false
  const fieldType = String(field.field_type ?? "").toUpperCase()
  return fieldType === "MULTI_TEXT" || !fieldType
}

function deepdrawSizeValue(value: unknown) {
  const text = String(value ?? "").trim()
  if (!text) return ""
  if (/cm$/i.test(text)) return text
  const match = text.match(/^0*(\d{2,3})$/)
  return match ? `${Number(match[1])}cm` : text
}

const SIZE_CHART_METADATA_KEYS = new Set([
  "ai_fill",
  "aifill",
  "confidence",
  "fallback",
  "mappings",
  "reason",
  "source",
  "unmatchedtargets",
])

function sizeChartRows(valueJson: unknown) {
  const record = recordValue(valueJson)
  const titles = String(record.title ?? "").split(",").map((item) => item.trim()).filter(Boolean)
  const rows = Object.entries(record)
    .filter(([key, value]) => {
      const compactKey = compactFieldKey(key)
      return compactKey !== "title" && !SIZE_CHART_METADATA_KEYS.has(compactKey) && String(value ?? "").trim()
    })
    .map(([size, value]) => ({ size, values: String(value ?? "").split(",").map((item) => item.trim()) }))
  return { titles, rows }
}

function hasStructuredSizeChartValue(valueJson: unknown) {
  const parsed = sizeChartRows(valueJson)
  return parsed.titles.length > 0 && parsed.rows.length > 0
}

function sizeChartTemplateTitles(field: DraftField) {
  const titles = fieldOptions(field).map((option) => option.label || option.value).filter(Boolean)
  if (titles.length > 0) return titles
  return ["身高", "衣长", "胸围", "袖长"]
}

function defaultSizeChartValueJson(field: DraftField, skus: DraftSku[]) {
  const titles = sizeChartTemplateTitles(field)
  const sizes = Array.from(new Set(skus.flatMap((sku) => [
    deepdrawSizeValue(sku.size_name),
    deepdrawSizeValue(sku.size_code),
  ]).filter(Boolean)))
  if (!titles.length || !sizes.length) return {}
  const output: Record<string, string> = { title: titles.join(",") }
  for (const size of sizes) {
    const height = size.match(/^(\d+)/)?.[1] ?? "0"
    output[size] = titles.map((title) => (/身高/.test(title) ? height : "0")).join(",")
  }
  return output
}

function sizeChartCellKey(fieldName: string, size: string, title: string) {
  return [fieldName, size, title].join("\u0000")
}

function sizeChartCellValue(preview: SizeChartPreviewItem, size: string, title: string, index: number, edits: Record<string, string>) {
  const key = sizeChartCellKey(preview.fieldName, size, title)
  return edits[key] ?? preview.rows.find((row) => row.size === size)?.values[index] ?? "0"
}

function sizeChartValueJson(preview: SizeChartPreviewItem, edits: Record<string, string>) {
  const output: Record<string, string> = {
    title: preview.titles.join(","),
  }
  for (const row of preview.rows) {
    output[row.size] = preview.titles
      .map((title, index) => sizeChartCellValue(preview, row.size, title, index, edits) || "0")
      .join(",")
  }
  return output
}

function sortSizeLabels(values: string[]) {
  return [...values].sort((left, right) => {
    const leftNumber = Number(left.match(/\d+/)?.[0] ?? NaN)
    const rightNumber = Number(right.match(/\d+/)?.[0] ?? NaN)
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
      return leftNumber - rightNumber
    }
    return left.localeCompare(right, "zh-Hans-CN")
  })
}

function normalizeSizeLabel(value: string) {
  const text = String(value ?? "").trim().replace(/\/+$/, "")
  if (!text) return ""
  const match = text.match(/^0*(\d{2,3})(?:cm)?$/i)
  return match ? `${Number(match[1])}cm` : text
}

function sizeChartSourceMatrix(rows: SizeChartSourceRow[]): SizeChartSourceMatrix {
  const titles: string[] = []
  const sizes = new Set<string>()
  const valueLookup = new Map<string, string>()
  for (const row of rows) {
    const measurementPoint = row.measurementPoint.trim()
    const size = normalizeSizeLabel(row.size)
    const sizeValue = String(row.sizeValue ?? "").trim()
    if (!measurementPoint || !size) continue
    if (!titles.includes(measurementPoint)) titles.push(measurementPoint)
    sizes.add(size)
    const key = `${measurementPoint}\u0000${size}`
    if (!valueLookup.has(key) || (!valueLookup.get(key) && sizeValue)) {
      valueLookup.set(key, sizeValue)
    }
  }
  return {
    titles,
    rowCount: rows.length,
    rows: sortSizeLabels(Array.from(sizes)).map((size) => ({
      size,
      values: titles.map((title) => valueLookup.get(`${title}\u0000${size}`) ?? "-"),
    })),
  }
}

function mappingForSizeChartColumn(mappings: SizeChartMapping[], fieldName: string, targetField: string) {
  return mappings.find((mapping) => (
    mapping.fieldName === fieldName
    && compactFieldKey(mapping.targetField) === compactFieldKey(targetField)
  ))
}

function issueSummaryText(issues: DraftIssue[]) {
  return Array.from(new Set(issues.map((issue) => issue.message).filter(Boolean))).join("；")
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
    <div className="min-w-[280px] max-w-[420px] space-y-2">
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

function DraftImageUploadDialog({
  open,
  onOpenChange,
  files,
  onFilesChange,
  isPending,
  canWrite,
  onSubmit,
  trigger,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: File[]
  onFilesChange: (files: File[]) => void
  isPending: boolean
  canWrite: boolean
  onSubmit: () => void
  trigger: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>上传 SPU 参考图</DialogTitle>
          <DialogDescription>
            图片会绑定当前深绘建档草稿，供 AI 补齐字段时作为多模态参考。
          </DialogDescription>
        </DialogHeader>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed px-3 py-4 text-sm hover:bg-muted/40">
          <span className="flex min-w-0 items-center gap-2">
            <Upload className="size-4 text-muted-foreground" />
            <span className="truncate">{files.length ? `已选择 ${formatNumber(files.length)} 张图片` : "选择 JPG/PNG/WEBP 图片"}</span>
          </span>
          <Input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            className="hidden"
            onChange={(event) => onFilesChange(Array.from(event.target.files ?? []).filter(isDraftReferenceImageFile))}
          />
        </label>
        {files.length > 0 ? (
          <div className="flex max-h-32 flex-wrap gap-2 overflow-auto rounded-md border bg-muted/20 p-2">
            {files.map((file) => (
              <Badge key={`${uploadDisplayName(file)}-${file.size}`} variant="secondary" className="max-w-[240px] truncate">
                {uploadDisplayName(file)}
              </Badge>
            ))}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" disabled={!canWrite || isPending || files.length === 0} onClick={onSubmit}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Images className="size-4" />}
            上传并作为参考图
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function textValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function pathBaseName(value: unknown) {
  const text = textValue(value).replace(/\\/g, "/")
  return text.split("/").filter(Boolean).at(-1) ?? text
}

function draftImagePayload(image: DraftImage) {
  return recordValue(image.raw_payload_json)
}

function draftAssetName(image: DraftImage) {
  return image.original_file_name || image.source_ref || image.file_name || `附件 ${image.id}`
}

function draftAssetComparableName(image: DraftImage) {
  const payload = draftImagePayload(image)
  return [
    pathBaseName(image.original_file_name),
    pathBaseName(image.source_ref),
    pathBaseName(image.file_name),
    pathBaseName(payload.original_file_name),
    pathBaseName(payload.source_ref),
  ].filter(Boolean).join(" ")
}

function draftAssetKind(image: DraftImage): DraftAssetKind {
  const payloadKind = textValue(draftImagePayload(image).asset_kind).toLowerCase()
  if (payloadKind === "hangtag" || payloadKind === "washlabel") return payloadKind
  const name = draftAssetComparableName(image)
  if (/(洗唛|洗标|水洗|wash)/i.test(name)) return "washlabel"
  if (/(吊牌|合格证|hangtag|(?:^|[_\-\s])tag(?:[_\-\s.]|$))/i.test(name)) return "hangtag"
  return "reference"
}

function groupDraftAssets(images: DraftImage[]) {
  return images.reduce<{
    referenceImages: DraftImage[]
    hangtagImages: DraftImage[]
    washlabelImages: DraftImage[]
  }>((groups, image) => {
    const kind = draftAssetKind(image)
    if (kind === "hangtag") {
      groups.hangtagImages.push(image)
    } else if (kind === "washlabel") {
      groups.washlabelImages.push(image)
    } else {
      groups.referenceImages.push(image)
    }
    return groups
  }, { referenceImages: [], hangtagImages: [], washlabelImages: [] })
}

function isDraftPdfAsset(image: DraftImage) {
  return textValue(image.mime_type).toLowerCase() === "application/pdf"
    || pathBaseName(image.file_name).toLowerCase().endsWith(".pdf")
    || pathBaseName(image.original_file_name).toLowerCase().endsWith(".pdf")
    || pathBaseName(image.source_ref).toLowerCase().endsWith(".pdf")
}

function draftAssetTypeLabel(kind: DraftAssetKind) {
  if (kind === "hangtag") return "吊牌"
  if (kind === "washlabel") return "洗唛"
  return "SPU"
}

function draftAssetMetaText(image: DraftImage) {
  const parts = []
  if (image.width && image.height) {
    parts.push(`${image.width} × ${image.height}`)
  } else if (isDraftPdfAsset(image)) {
    parts.push("PDF")
  } else {
    parts.push("尺寸未知")
  }
  if (image.file_size) parts.push(`${formatNumber(Math.round(image.file_size / 1024))}KB`)
  return parts.join(" · ")
}

function DraftAssetThumbnail({ image, label }: { image: DraftImage; label: string }) {
  const [failed, setFailed] = useState(false)
  const src = image.preview_url
  if (isDraftPdfAsset(image)) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-sm bg-muted text-xs font-medium text-muted-foreground">
        <FileText className="size-8" />
        <span>PDF</span>
      </div>
    )
  }
  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-sm bg-muted text-xs text-muted-foreground">
        无预览
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={label}
      className="h-full w-full object-contain"
      loading="eager"
      onError={() => setFailed(true)}
    />
  )
}

function DraftAssetCard({
  image,
  kind,
  onPreview,
  onDelete,
  deletingImageId,
  canWrite,
  showDelete = false,
}: {
  image: DraftImage
  kind: DraftAssetKind
  onPreview: (target: DraftAssetPreviewTarget) => void
  onDelete?: (imageId: number) => void
  deletingImageId?: number | null
  canWrite?: boolean
  showDelete?: boolean
}) {
  const label = draftAssetName(image)
  const previewable = Boolean(image.preview_url)
  return (
    <div className="min-w-0 overflow-hidden rounded-md border bg-background">
      <button
        type="button"
        className={cn(
          "group relative block aspect-square w-full bg-muted/60 p-2 text-left focus:outline-none focus:ring-2 focus:ring-ring",
          previewable ? "cursor-zoom-in hover:bg-muted" : "cursor-default",
        )}
        disabled={!previewable}
        onClick={() => onPreview({ image, kind })}
        aria-label={`预览${label}`}
        title="查看原件"
      >
        <DraftAssetThumbnail image={image} label={label} />
        {previewable ? (
          <span className="absolute right-2 top-2 rounded-full bg-background/90 p-1 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 className="size-3.5" />
          </span>
        ) : null}
      </button>
      <div className="grid gap-1.5 p-2 text-xs">
        <div className="flex min-w-0 items-center gap-1.5">
          {kind === "reference" ? null : (
            <Badge variant="outline" className="h-5 shrink-0 rounded-md px-1.5 py-0 text-[10px]">
              {draftAssetTypeLabel(kind)}
            </Badge>
          )}
          <div className="truncate font-medium">{label}</div>
        </div>
        <div className="truncate text-muted-foreground">{draftAssetMetaText(image)}</div>
        {showDelete && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="w-fit text-muted-foreground hover:text-[#d45656]"
            disabled={!canWrite || deletingImageId === image.id}
            onClick={() => onDelete(image.id)}
          >
            {deletingImageId === image.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            删除
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function DraftReferenceImagesSection({
  images,
  uploadDialog,
  onPreview,
  onDelete,
  deletingImageId,
  canWrite,
}: {
  images: DraftImage[]
  uploadDialog: ReactNode
  onPreview: (target: DraftAssetPreviewTarget) => void
  onDelete: (imageId: number) => void
  deletingImageId: number | null
  canWrite: boolean
}) {
  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">SPU 参考图</h2>
          <p className="mt-1 text-xs text-muted-foreground">AI 推荐补齐字段时会读取最多 4 张参考图。</p>
        </div>
        {uploadDialog}
      </div>
      {images.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,156px))] justify-start gap-3">
          {images.map((image) => (
            <DraftAssetCard
              key={image.id}
              image={image}
              kind="reference"
              onPreview={onPreview}
              onDelete={onDelete}
              deletingImageId={deletingImageId}
              canWrite={canWrite}
              showDelete
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          暂无参考图
        </div>
      )}
    </section>
  )
}

function DraftEvidenceAssetsSection({
  hangtagImages,
  washlabelImages,
  onPreview,
}: {
  hangtagImages: DraftImage[]
  washlabelImages: DraftImage[]
  onPreview: (target: DraftAssetPreviewTarget) => void
}) {
  const assets = [
    ...hangtagImages.map((image) => ({ image, kind: "hangtag" as const })),
    ...washlabelImages.map((image) => ({ image, kind: "washlabel" as const })),
  ]
  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">吊牌/洗唛图</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            吊牌 {formatNumber(hangtagImages.length)} 个 · 洗唛 {formatNumber(washlabelImages.length)} 个
          </p>
        </div>
      </div>
      {assets.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,156px))] justify-start gap-3">
          {assets.map(({ image, kind }) => (
            <DraftAssetCard
              key={image.id}
              image={image}
              kind={kind}
              onPreview={onPreview}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          暂无吊牌/洗唛附件
        </div>
      )}
    </section>
  )
}

function DraftAssetPreviewDialog({
  target,
  onClose,
}: {
  target: DraftAssetPreviewTarget | null
  onClose: () => void
}) {
  const image = target?.image
  const label = image ? draftAssetName(image) : ""
  const source = image?.preview_url ?? ""
  const isPdf = image ? isDraftPdfAsset(image) : false
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      {target && image ? (
        <DialogContent className="max-h-[calc(100vh-2rem)] w-[min(96vw,1120px)] max-w-none overflow-hidden sm:max-w-[min(96vw,1120px)]">
          <DialogHeader>
            <DialogTitle className="truncate">{label}</DialogTitle>
            <DialogDescription>
              {draftAssetTypeLabel(target.kind)} · {draftAssetMetaText(image)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
            {isPdf ? (
              <iframe
                src={source}
                title={label}
                className="h-[min(72vh,760px)] min-h-[420px] w-full min-w-0 bg-background"
              />
            ) : (
              <img
                src={source}
                alt={label}
                className="block h-auto max-h-[min(72vh,760px)] max-w-full object-contain"
              />
            )}
          </div>
          {source ? (
            <DialogFooter>
              <Button asChild variant="outline" size="sm">
                <a href={source} target="_blank" rel="noreferrer">
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

export default function ProductArchiveDraftDetailPage() {
  const { hasPermission } = useAuth()
  const canWrite = hasPermission("PRODUCT_ARCHIVE_DRAFT_WRITE")
  const { draftId } = useParams()
  const queryClient = useQueryClient()
  const detail = useDraftDetail(draftId)
  const pageScrollRef = useRef<HTMLDivElement | null>(null)
  const validationLocatorRef = useRef<HTMLDivElement | null>(null)
  const fieldRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({})
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [sizeChartMappingDialogOpen, setSizeChartMappingDialogOpen] = useState(false)
  const [sizeChartSourceOpen, setSizeChartSourceOpen] = useState(false)
  const [sizeChartSourcePinned, setSizeChartSourcePinned] = useState(false)
  const [sizeChartRecommendation, setSizeChartRecommendation] = useState<SizeChartRecommendationResponse | null>(null)
  const [sizeChartCellValues, setSizeChartCellValues] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState("fields")
  const [tradeSearch, setTradeSearch] = useState("")
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const [activeIssueIndex, setActiveIssueIndex] = useState(0)
  const [imageUploadDialogOpen, setImageUploadDialogOpen] = useState(false)
  const [imageUploadFiles, setImageUploadFiles] = useState<File[]>([])
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null)
  const [previewTarget, setPreviewTarget] = useState<DraftAssetPreviewTarget | null>(null)
  const debouncedTradeSearch = useDebounce(tradeSearch, 250)

  const draft = detail.data?.draft
  const summary = draft?.validation_summary_json ?? {}
  const tradeSelectionDecision = detail.data?.tradeSelectionDecision
  const recommendationNeedsApply = Boolean(
    tradeSelectionDecision?.recommendedTrade
    && tradeSelectionDecision.recommendedTrade.tradeId !== tradeSelectionDecision.appliedTrade?.tradeId,
  )
  const launchPlanReference = detail.data?.launchPlanReference ?? { matched: false, fields: [] }
  const draftAssets = useMemo(() => groupDraftAssets(detail.data?.images ?? []), [detail.data?.images])
  const trades = useQuery<TradeListResponse>({
    queryKey: ["deepdraw-metadata-trades", draft?.tenant_name, debouncedTradeSearch],
    enabled: Boolean(draft && tradeDialogOpen),
    queryFn: () =>
      api.get<TradeListResponse>(`/deepdraw-metadata/trades?q=${encodeURIComponent(debouncedTradeSearch)}&tenantName=${encodeURIComponent(draft?.tenant_name ?? "")}`),
  })
  const selectedTrade = useMemo(() => {
    return (trades.data?.items ?? []).find((trade) => trade.trade_id === selectedTradeId) ?? null
  }, [selectedTradeId, trades.data?.items])
  const changedFields = useMemo(() => {
    const currentFields = new Map((detail.data?.fields ?? []).map((field) => [field.id, field]))
    return Object.entries(fieldValues)
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
  }, [detail.data?.fields, fieldValues])
  const unresolvedIssues = useMemo(() => {
    return (detail.data?.issues ?? []).filter((issue) => !issue.resolved_at)
  }, [detail.data?.issues])
  const unresolvedFieldIssues = useMemo(() => {
    return unresolvedIssues.filter((issue) => Boolean(issue.field_name))
  }, [unresolvedIssues])
  const fieldIssueMap = useMemo(() => {
    const map = new Map<string, DraftIssue[]>()
    for (const issue of unresolvedFieldIssues) {
      if (!issue.field_name) continue
      const issues = map.get(issue.field_name) ?? []
      issues.push(issue)
      map.set(issue.field_name, issues)
    }
    return map
  }, [unresolvedFieldIssues])
  const fieldIssueNames = useMemo(() => {
    const orderedNames: string[] = []
    const seen = new Set<string>()
    for (const field of detail.data?.fields ?? []) {
      if (!fieldIssueMap.has(field.field_name) || seen.has(field.field_name)) continue
      orderedNames.push(field.field_name)
      seen.add(field.field_name)
    }
    return orderedNames
  }, [detail.data?.fields, fieldIssueMap])
  const normalizedActiveIssueIndex = fieldIssueNames.length > 0
    ? Math.min(activeIssueIndex, fieldIssueNames.length - 1)
    : 0
  const activeIssueFieldName = fieldIssueNames[normalizedActiveIssueIndex] ?? ""
  const activeFieldIssues = activeIssueFieldName ? fieldIssueMap.get(activeIssueFieldName) ?? [] : []
  const hasValidationIssues = fieldIssueNames.length > 0
  const blockerIssueCount = unresolvedFieldIssues.filter((issue) => issue.severity === "blocker").length
  const warningIssueCount = unresolvedFieldIssues.filter((issue) => issue.severity === "warning").length
  const sizeChartPreview = useMemo<SizeChartPreviewItem[]>(() => {
    const recommendationPreviews = new Map((sizeChartRecommendation?.previews ?? []).map((preview) => [
      preview.fieldName,
      recordValue(preview.valueJson),
    ]))
    return (detail.data?.fields ?? [])
      .filter((field) => isProductArchiveSizeChartField(field))
      .map((field) => {
        const persistedValueJson = recordValue(field.value_json)
        const recommendedValueJson = recommendationPreviews.get(field.field_name)
        const valueJson = recommendedValueJson && Object.keys(recommendedValueJson).length > 0
          ? recommendedValueJson
          : hasStructuredSizeChartValue(persistedValueJson)
            ? persistedValueJson
            : defaultSizeChartValueJson(field, detail.data?.skus ?? [])
        const parsed = sizeChartRows(valueJson)
        return {
          fieldId: field.id,
          fieldName: field.field_name,
          expectedUpdatedAt: field.updated_at,
          valueJson,
          persistedValueJson,
          rows: parsed.rows,
          titles: parsed.titles,
        }
      })
  }, [detail.data?.fields, detail.data?.skus, sizeChartRecommendation?.previews])
  const activeSizeChartMappings = sizeChartRecommendation?.mappings ?? detail.data?.sizeChartMappings ?? []
  const sizeChartImportedMatrix = useMemo(() => (
    sizeChartSourceMatrix(detail.data?.sizeChartSourceRows ?? [])
  ), [detail.data?.sizeChartSourceRows])
  const sizeChartChangedFields = useMemo(() => {
    return sizeChartPreview
      .map((preview) => {
        const nextValueJson = sizeChartValueJson(preview, sizeChartCellValues)
        const currentValueJson = preview.persistedValueJson
        if (JSON.stringify(nextValueJson) === JSON.stringify(currentValueJson)) return null
        return {
          id: preview.fieldId,
          fieldName: preview.fieldName,
          expectedUpdatedAt: preview.expectedUpdatedAt,
          valueText: "",
          valueJson: nextValueJson,
        }
      })
      .filter(Boolean) as DraftFieldPatch[]
  }, [sizeChartCellValues, sizeChartPreview])
  const scrollToFieldIssue = (nextIndex: number) => {
    if (fieldIssueNames.length === 0) return
    const normalizedIndex = ((nextIndex % fieldIssueNames.length) + fieldIssueNames.length) % fieldIssueNames.length
    const fieldName = fieldIssueNames[normalizedIndex]
    const fieldRow = fieldRowRefs.current[fieldName]
    setActiveIssueIndex(normalizedIndex)
    if (!fieldRow) return
    window.requestAnimationFrame(() => {
      const scrollContainer = pageScrollRef.current
      const locatorHeight = validationLocatorRef.current?.offsetHeight ?? 96
      const rowOffset = locatorHeight + 12
      if (!scrollContainer) {
        fieldRow.scrollIntoView({ behavior: "smooth", block: "start" })
        return
      }
      const rowRect = fieldRow.getBoundingClientRect()
      const containerRect = scrollContainer.getBoundingClientRect()
      scrollContainer.scrollTo({
        top: scrollContainer.scrollTop + rowRect.top - containerRect.top - rowOffset,
        behavior: "smooth",
      })
    })
  }

  const saveFields = useMutation({
    mutationFn: (request: DraftFieldPatchRequest) =>
      api.patch<DraftDetail>(`/product-archive-drafts/${draftId}/fields`, request),
    onSuccess: (result, request) => {
      toast.success("字段已保存")
      setFieldValues((current) => {
        const next = { ...current }
        for (const field of request.fields) {
          if (current[field.id] === field.valueText) delete next[field.id]
        }
        return next
      })
      queryClient.setQueryData(["product-archive-drafts", draftId], result)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "保存字段失败")
    },
  })

  const saveSizeChartValues = useMutation({
    mutationFn: (request: SizeChartFieldPatchRequest) => api.patch<DraftDetail>(
      `/product-archive-drafts/${draftId}/fields`,
      {
        expectedDraftUpdatedAt: request.expectedDraftUpdatedAt,
        fields: request.fields,
      },
    ),
    onSuccess: (result, request) => {
      toast.success("尺码表数值已保存")
      setSizeChartCellValues((current) => {
        const next = { ...current }
        for (const [key, value] of Object.entries(request.cellValues)) {
          if (current[key] === value) delete next[key]
        }
        return next
      })
      queryClient.setQueryData(["product-archive-drafts", draftId], result)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "保存尺码表数值失败")
    },
  })

  const applyTrade = useMutation({
    mutationFn: () =>
      api.patch<DraftDetail>(`/product-archive-drafts/${draftId}/trade`, {
        tradeId: selectedTrade?.trade_id ?? selectedTradeId,
        tradePath: selectedTrade?.trade_path,
      }),
    onSuccess: () => {
      toast.success("已应用类目并生成字段")
      setTradeDialogOpen(false)
      setSelectedTradeId(null)
      setFieldValues({})
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const confirmRecommendedTrade = useMutation({
    mutationFn: () => api.patch<DraftDetail>(`/product-archive-drafts/${draftId}/trade/confirm`, {
      recommendedTradeId: tradeSelectionDecision?.recommendedTrade?.tradeId,
    }),
    onSuccess: (result) => {
      queryClient.setQueryData(["product-archive-drafts", draftId], result)
      toast.success("推荐类目已确认")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "确认推荐类目失败")
    },
  })

  const validate = useMutation({
    mutationFn: async () => {
      if (changedFields.length > 0) {
        if (!draft?.updated_at) throw new Error("草稿详情尚未加载完成，请稍后重试")
        await saveFields.mutateAsync({
          expectedDraftUpdatedAt: draft.updated_at,
          fields: changedFields,
        })
      }
      return api.post<unknown>(`/product-archive-drafts/${draftId}/validate`)
    },
    onSuccess: () => {
      toast.success("校验已完成")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const aiFill = useMutation({
    mutationFn: () => api.post<{
      saved: Array<{ field_id: number }>
      detail: DraftDetail
      warnings?: Array<{ message?: string }>
    }>(`/product-archive-drafts/${draftId}/ai-fill`),
    onSuccess: (result) => {
      setFieldValues({})
      queryClient.setQueryData(["product-archive-drafts", draftId], result.detail)
      const warningMessage = result.warnings?.[0]?.message
      if (warningMessage && result.saved.length === 0) {
        toast.warning(warningMessage)
      } else {
        toast.success(
          result.saved.length > 0
            ? `AI 已推荐补齐 ${formatNumber(result.saved.length)} 个字段`
            : "已刷新字段规则和 AI 推荐结果",
        )
        if (warningMessage) toast.warning(warningMessage)
      }
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const uploadDraftImages = useMutation({
    mutationFn: () => api.postForm<{ detail: DraftDetail; imported_count: number; skipped_count: number }>(
      `/product-archive-drafts/${draftId}/images`,
      buildDraftImageUploadForm(imageUploadFiles),
    ),
    onSuccess: (result) => {
      queryClient.setQueryData(["product-archive-drafts", draftId], result.detail)
      setImageUploadFiles([])
      setImageUploadDialogOpen(false)
      toast.success(`已上传 ${formatNumber(result.imported_count)} 张 SPU 参考图`)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "上传 SPU 参考图失败")
    },
  })

  const deleteDraftImage = useMutation({
    mutationFn: (imageId: number) => {
      setDeletingImageId(imageId)
      return api.delete<{ detail: DraftDetail }>(`/product-archive-drafts/${draftId}/images/${imageId}`)
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["product-archive-drafts", draftId], result.detail)
      toast.success("参考图已删除")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "删除参考图失败")
    },
    onSettled: () => setDeletingImageId(null),
  })

  const recommendSizeChartMappings = useMutation({
    mutationFn: () => api.post<SizeChartRecommendationResponse>(`/product-archive-drafts/${draftId}/size-chart/ai-recommend`),
    onSuccess: (result) => {
      setSizeChartRecommendation(result)
      toast.success(
        result.source === "ai"
          ? `AI 已推荐 ${formatNumber(result.mappings.length)} 条尺码映射`
          : "已生成规则兜底尺码映射建议",
      )
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "AI 推荐尺码映射失败")
    },
  })

  const saveSizeChartMappings = useMutation({
    mutationFn: () => api.post<SizeChartMappingSaveResponse>(`/product-archive-drafts/${draftId}/size-chart/mappings`, {
      mappings: sizeChartRecommendation?.mappings ?? [],
      applyToDraft: false,
    }),
    onSuccess: () => {
      toast.success("尺码表映射审核已保存")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "保存尺码表映射失败")
    },
  })

  const applySizeChartMappings = useMutation({
    mutationFn: () => api.post<SizeChartMappingSaveResponse>(`/product-archive-drafts/${draftId}/size-chart/mappings`, {
      mappings: sizeChartRecommendation?.mappings ?? [],
      applyToDraft: true,
    }),
    onSuccess: (result) => {
      if (result.detail) queryClient.setQueryData(["product-archive-drafts", draftId], result.detail)
      setSizeChartCellValues({})
      toast.success("尺码表映射已应用到草稿")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "应用尺码表映射失败")
    },
  })

  const dryRunSubmit = useMutation({
    mutationFn: () => api.post<unknown>(`/product-archive-drafts/${draftId}/submit`, { dryRun: true }),
    onSuccess: () => {
      toast.success("已生成提交预览")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const publishSubmit = useMutation({
    mutationFn: () => api.post<{
      status?: string
      duplicateFound?: boolean
      alreadySubmitting?: boolean
    }>(`/product-archive-drafts/${draftId}/submit`, { dryRun: false }),
    onSuccess: (result) => {
      if (result.status === "readback_verified") {
        toast.success("已发布到深绘并完成回读校验")
        setPublishDialogOpen(false)
      } else if (result.duplicateFound) {
        toast.warning("深绘已存在同货号商品，本次未重复创建")
      } else if (result.alreadySubmitting) {
        toast.warning("该草稿已有提交请求正在处理，请等待回读或先执行状态核对")
      } else {
        toast.error(`深绘已受理但回读未确认，当前状态：${result.status || "unknown"}`)
      }
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "发布到深绘失败")
    },
  })

  if (!draft) {
    return (
      <PageContainer>
        <PageHeader title="深绘建档草稿" description={draftDetailFallbackDescription(detail)} />
      </PageContainer>
    )
  }

  const draftSummaryItems = [
    { label: "状态", value: draft.status, detail: draft.trade_path || "待确认类目" },
    { label: "阻断问题", value: formatNumber(summary.blocker_count ?? 0) },
    { label: "警告", value: formatNumber(summary.warning_count ?? 0) },
    { label: "深绘 productId", value: draft.created_product_id || "-" },
    { label: "草稿编号", value: draft.draft_no },
    { label: "商户 ID", value: draft.merchant_id },
    { label: "吊牌价", value: draft.retail_price ?? "-" },
    { label: "字段数", value: formatNumber(detail.data?.fields.length ?? 0) },
    { label: "最近校验", value: summary.validated_at ? formatDateTime(summary.validated_at) : "-" },
    { label: "更新时间", value: formatDateTime(draft.updated_at) },
    { label: "深绘类目", value: draft.trade_path || "待确认类目" },
    { label: "款号", value: draft.spu_code },
  ]

  return (
    <PageContainer ref={pageScrollRef}>
        <PageHeader
          compact
          title={draft.title || draft.spu_code}
          description={`${draft.spu_code} / ${draft.tenant_name} / ${draft.trade_path || "待确认类目"}`}
          prefix={(
            <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 w-fit text-muted-foreground hover:text-foreground">
              <Link to="/product-archive-drafts">
                <ArrowLeft className="size-4" />
                返回草稿列表
              </Link>
            </Button>
          )}
        >
        <Dialog
          open={tradeDialogOpen}
          onOpenChange={(open) => {
            setTradeDialogOpen(open)
            if (open) setSelectedTradeId(draft.trade_id)
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={!canWrite}>
              <ListTree className="size-4" />
              选择深绘类目
            </Button>
          </DialogTrigger>
          <DialogContent className="grid max-h-[82vh] grid-rows-[auto_auto_auto_auto_minmax(0,1fr)_auto] sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>选择深绘类目</DialogTitle>
              <DialogDescription>
                从已同步的深绘类目主数据中选择模板，应用后会按类目字段重新生成草稿字段。
              </DialogDescription>
            </DialogHeader>
            {tradeSelectionDecision ? (
              <div className={cn("rounded-lg border p-3", tradeSelectionClass(tradeSelectionDecision.status))}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">系统选择结论</div>
                    <div className="mt-0.5 text-sm font-medium">{tradeSelectionTitle(tradeSelectionDecision.status)}</div>
                  </div>
                  <Badge variant="outline">{tradeSelectionConfidenceLabel(tradeSelectionDecision.confidence)}</Badge>
                </div>
                <div className="mt-2 text-sm leading-5 text-muted-foreground">{tradeSelectionDecision.reason}</div>
                <div className="mt-2 text-xs">
                  推荐：{tradeSelectionDecision.recommendedTrade?.tradePath || "暂无唯一推荐"}
                  {tradeSelectionDecision.recommendedTrade ? ` · ${tradeSelectionDecision.recommendedTrade.tradeId}` : ""}
                </div>
              </div>
            ) : null}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">上市计划表类目参考</div>
                <Badge variant={launchPlanReference.matched ? "secondary" : "outline"}>
                  {launchPlanReference.matched ? "已匹配上市计划表" : "未匹配上市计划表"}
                </Badge>
              </div>
              {launchPlanReference.matched ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {launchPlanReference.fields.map((field) => (
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
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={tradeSearch}
                onChange={(event) => setTradeSearch(event.target.value)}
                placeholder="搜索类目名称、路径或 tradeId"
                className="pl-9"
              />
            </div>
            <ScrollArea className="min-h-0 rounded-lg border">
              <div className="divide-y">
                {(trades.data?.items ?? []).map((trade) => {
                  const selected = selectedTradeId === trade.trade_id
                  return (
                    <button
                      key={trade.trade_id}
                      type="button"
                      className={`grid w-full gap-1 px-4 py-3 text-left text-sm hover:bg-muted ${selected ? "bg-[#d4fae8]" : ""}`}
                      onClick={() => setSelectedTradeId(trade.trade_id)}
                    >
                      <span className="font-medium">{trade.trade_name || trade.trade_id}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {trade.trade_path || "未维护路径"} · {trade.trade_id}
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
              <Button type="button" variant="outline" onClick={() => setTradeDialogOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={!canWrite || !selectedTradeId || applyTrade.isPending}
                onClick={() => applyTrade.mutate()}
              >
                {applyTrade.isPending ? <Loader2 className="size-4 animate-spin" /> : <ListTree className="size-4" />}
                应用类目并生成字段
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button type="button" variant="outline" size="sm" onClick={() => validate.mutate()} disabled={!canWrite || validate.isPending || saveFields.isPending}>
          {validate.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
          重新校验
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => aiFill.mutate()} disabled={!canWrite || aiFill.isPending}>
          {aiFill.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          AI 推荐补齐空字段
        </Button>
        <DraftImageUploadDialog
          open={imageUploadDialogOpen}
          onOpenChange={setImageUploadDialogOpen}
          files={imageUploadFiles}
          onFilesChange={setImageUploadFiles}
          isPending={uploadDraftImages.isPending}
          canWrite={canWrite}
          onSubmit={() => uploadDraftImages.mutate()}
          trigger={(
            <Button type="button" variant="outline" size="sm" disabled={!canWrite}>
              <Images className="size-4" />
              上传 SPU 图
            </Button>
          )}
        />
        <Button type="button" size="sm" onClick={() => dryRunSubmit.mutate()} disabled={!canWrite || dryRunSubmit.isPending}>
          {dryRunSubmit.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          提交预览
        </Button>
        <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" disabled={!canWrite || publishSubmit.isPending}>
              {publishSubmit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              确认发布到深绘
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>确认发布到深绘</DialogTitle>
              <DialogDescription>
                将对款号 {draft.spu_code} 执行真实深绘建档。系统会先查重，再提交并回读校验。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPublishDialogOpen(false)}>
                取消
              </Button>
              <Button type="button" disabled={!canWrite || publishSubmit.isPending} onClick={() => publishSubmit.mutate()}>
                {publishSubmit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                确认发布到深绘
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </PageHeader>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
        <DraftReferenceImagesSection
          images={draftAssets.referenceImages}
          deletingImageId={deletingImageId}
          canWrite={canWrite}
          onPreview={setPreviewTarget}
          onDelete={(imageId) => deleteDraftImage.mutate(imageId)}
          uploadDialog={(
            <Button type="button" variant="outline" size="sm" disabled={!canWrite} onClick={() => setImageUploadDialogOpen(true)}>
              <Images className="size-4" />
              上传参考图
            </Button>
          )}
        />
        <DraftEvidenceAssetsSection
          hangtagImages={draftAssets.hangtagImages}
          washlabelImages={draftAssets.washlabelImages}
          onPreview={setPreviewTarget}
        />
      </div>

      <DraftAssetPreviewDialog target={previewTarget} onClose={() => setPreviewTarget(null)} />

      {tradeSelectionDecision ? (
        <section
          data-trade-selection-decision={tradeSelectionDecision.status}
          className={cn("rounded-lg border p-4", tradeSelectionClass(tradeSelectionDecision.status))}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {tradeSelectionDecision.status === "manual_selection_required" || tradeSelectionDecision.status === "pending_confirmation" ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#c37d0d]" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#0fa76e]" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">深绘类目选择结论</div>
                <h2 className="mt-1 text-base font-semibold">{tradeSelectionTitle(tradeSelectionDecision.status)}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{tradeSelectionDecision.reason}</p>
              </div>
            </div>
            <Badge variant="outline">{tradeSelectionConfidenceLabel(tradeSelectionDecision.confidence)}</Badge>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border bg-background/80 px-3 py-2">
              <div className="text-xs text-muted-foreground">系统推荐类目</div>
              <div className="mt-1 break-words text-sm font-medium">
                {tradeSelectionDecision.recommendedTrade?.tradePath || "暂无唯一推荐"}
              </div>
              {tradeSelectionDecision.recommendedTrade ? (
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                  tradeId {tradeSelectionDecision.recommendedTrade.tradeId}
                </div>
              ) : null}
            </div>
            <div className="rounded-md border bg-background/80 px-3 py-2">
              <div className="text-xs text-muted-foreground">当前已应用类目</div>
              <div className="mt-1 break-words text-sm font-medium">
                {tradeSelectionDecision.appliedTrade?.tradePath || "尚未应用类目"}
              </div>
              {tradeSelectionDecision.appliedTrade ? (
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                  tradeId {tradeSelectionDecision.appliedTrade.tradeId}
                </div>
              ) : null}
            </div>
          </div>

          {tradeSelectionDecision.confirmedAt ? (
            <div className="mt-2 text-xs text-muted-foreground">
              人工处理时间：{formatDateTime(tradeSelectionDecision.confirmedAt)}
            </div>
          ) : null}

          {tradeSelectionDecision.status === "pending_confirmation" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
              disabled={!canWrite || !tradeSelectionDecision.recommendedTrade || confirmRecommendedTrade.isPending}
                onClick={() => confirmRecommendedTrade.mutate()}
              >
                {confirmRecommendedTrade.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {recommendationNeedsApply ? "应用并确认推荐类目" : "确认推荐类目"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canWrite}
                onClick={() => {
                  setSelectedTradeId(draft.trade_id)
                  setTradeDialogOpen(true)
                }}
              >
                <ListTree className="size-4" />
                重新选择
              </Button>
            </div>
          ) : null}

          {tradeSelectionDecision.status === "manual_selection_required" || tradeSelectionDecision.status === "human_adjusted" ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canWrite}
                onClick={() => {
                  setSelectedTradeId(draft.trade_id)
                  setTradeDialogOpen(true)
                }}
              >
                <ListTree className="size-4" />
                {tradeSelectionDecision.status === "manual_selection_required" ? "选择深绘类目" : "重新选择"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section data-draft-summary-table="true" className="overflow-hidden rounded-lg border bg-card/80 text-sm shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
        <div className="border-b px-4 py-2">
          <h2 className="text-sm font-semibold">草稿摘要</h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {draftSummaryItems.map((item) => (
            <div key={item.label} className="min-w-0 border-b border-r px-4 py-2.5">
              <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 truncate text-sm font-semibold text-foreground">{item.value}</dd>
              {"detail" in item && item.detail ? (
                <dd className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</dd>
              ) : null}
            </div>
          ))}
        </dl>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-0 min-w-0">
        <TabsList>
          <TabsTrigger value="fields" className={cn(fieldIssueNames.length > 0 && "pr-5")}>
            字段填充
            {fieldIssueNames.length > 0 ? (
              <span
                aria-label={`问题字段 ${formatNumber(fieldIssueNames.length)}`}
                className="absolute -right-2 -top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-[#d45656] px-1 text-[10px] font-semibold leading-none text-white shadow-[0_2px_6px_rgba(212,86,86,0.35)]"
              >
                {formatNumber(fieldIssueNames.length)}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="size-chart">尺码表配置</TabsTrigger>
          <TabsTrigger value="skus">SKU/颜色尺码</TabsTrigger>
          <TabsTrigger value="issues">校验问题</TabsTrigger>
          <TabsTrigger value="logs">提交记录</TabsTrigger>
          <TabsTrigger value="source">来源快照</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="min-w-0">
              <Card className="min-w-0 overflow-visible">
            <CardHeader>
              <div>
                <CardTitle>字段填充</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.trade_path || "待确认类目"}，字段来自深绘类目模板和字段规则。
                </p>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <div
                ref={validationLocatorRef}
                data-validation-locator-bar="true"
                className="sticky top-[-1.5rem] z-30 border-y bg-card/95 px-6 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)] backdrop-blur md:top-[-2rem]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {hasValidationIssues ? (
                        <AlertTriangle className="size-4 text-[#d45656]" />
                      ) : (
                        <CheckCircle2 className="size-4 text-[#0fa76e]" />
                      )}
                      字段校验定位
                    </span>
                    {hasValidationIssues ? (
                      <>
                        <Badge variant="outline" className={issueSeverityClass("blocker")}>
                          阻断 {formatNumber(blockerIssueCount)}
                        </Badge>
                        <Badge variant="outline" className={issueSeverityClass("warning")}>
                          警告 {formatNumber(warningIssueCount)}
                        </Badge>
                        <Badge variant="outline">
                          问题字段 {formatNumber(fieldIssueNames.length)}
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="outline" className="border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]">
                        所有字段校验通过
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canWrite || changedFields.length === 0 || saveFields.isPending}
                      onClick={() => {
                        if (!draft?.updated_at) return
                        saveFields.mutate({
                          expectedDraftUpdatedAt: draft.updated_at,
                          fields: changedFields,
                        })
                      }}
                    >
                      {saveFields.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      保存字段
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => validate.mutate()} disabled={!canWrite || validate.isPending || saveFields.isPending}>
                      {validate.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
                      重新校验
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => aiFill.mutate()} disabled={!canWrite || aiFill.isPending}>
                      {aiFill.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      AI 推荐补齐空字段
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={fieldIssueNames.length === 0}
                      onClick={() => scrollToFieldIssue(normalizedActiveIssueIndex - 1)}
                    >
                      <ChevronUp className="size-4" />
                      查找上一个
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={fieldIssueNames.length === 0}
                      onClick={() => scrollToFieldIssue(normalizedActiveIssueIndex + 1)}
                    >
                      <ChevronDown className="size-4" />
                      查找下一个
                    </Button>
                  </div>
                </div>
                {activeIssueFieldName ? (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      当前 {formatNumber(normalizedActiveIssueIndex + 1)} / {formatNumber(fieldIssueNames.length)}：{activeIssueFieldName}
                    </span>
                    <span className="mx-2 text-border">|</span>
                    {issueSummaryText(activeFieldIssues)}
                  </div>
                ) : (
                  <div className="mt-2 text-sm font-medium text-[#0fa76e]">所有字段校验通过</div>
                )}
              </div>
              {(detail.data?.fields.length ?? 0) === 0 ? (
                <div className="mx-6 mt-4 rounded-lg border border-dashed p-8 text-center">
                  <div className="text-sm font-medium">还没有字段模板</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    先选择深绘类目，系统会按该类目的字段模板生成可填字段。
                  </div>
                  <Button type="button" className="mt-4" disabled={!canWrite} onClick={() => setTradeDialogOpen(true)}>
                    <ListTree className="size-4" />
                    选择深绘类目
                  </Button>
                </div>
              ) : (
                <Table className="w-max min-w-full" containerClassName="px-6 pt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>字段名</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>目标值</TableHead>
                      <TableHead>必填</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.data?.fields.map((field) => {
                      const options = fieldOptions(field)
                      const value = fieldValues[field.id] ?? field.value_text ?? ""
                      const isSizeChartField = isProductArchiveSizeChartField(field)
                      const hasPersistedSizeChart = hasStructuredSizeChartValue(field.value_json)
                      const isChoiceField = isChoiceFieldType(field)
                      const isMultiChoiceField = isMultiChoiceFieldType(field, value)
                      const fieldIssues = fieldIssueMap.get(field.field_name) ?? []
                      const hasFieldIssue = fieldIssues.length > 0
                      const isActiveIssueField = activeIssueFieldName === field.field_name
                      const topSeverity = fieldIssues.some((issue) => issue.severity === "blocker")
                        ? "blocker"
                        : fieldIssues[0]?.severity ?? ""
                      const issueToneClass = topSeverity === "blocker" ? "text-[#d45656]" : "text-[#c37d0d]"
                      const issueBackgroundClass = topSeverity === "blocker" ? "bg-[#fff1f1] hover:bg-[#fff1f1]" : "bg-[#fff8e8] hover:bg-[#fff8e8]"
                      const issueBorderClass = topSeverity === "blocker" ? "border-l-[#d45656]" : "border-l-[#c37d0d]"
                      return (
                        <Fragment key={field.id}>
                          <TableRow
                            ref={(node) => {
                              if (hasFieldIssue) {
                                fieldRowRefs.current[field.field_name] = node
                              } else {
                                delete fieldRowRefs.current[field.field_name]
                              }
                            }}
                            data-field-issue={hasFieldIssue ? field.field_name : undefined}
                            data-active-field-issue={isActiveIssueField ? "true" : undefined}
                            className={cn(
                              "scroll-mt-40",
                              hasFieldIssue && "border-l-4",
                              hasFieldIssue && issueBorderClass,
                              hasFieldIssue && issueBackgroundClass,
                              isActiveIssueField && "ring-2 ring-inset ring-[#18e299]/80",
                            )}
                          >
                            <TableCell className="whitespace-normal align-top">
                              <span className={cn(hasFieldIssue && `font-medium ${issueToneClass}`)}>
                                {field.field_name}
                              </span>
                            </TableCell>
                            <TableCell>{field.source_type}</TableCell>
                            <TableCell className={cn("max-w-[280px] truncate", hasFieldIssue && issueToneClass)}>
                              {isSizeChartField ? (hasPersistedSizeChart ? "已生成表格" : "待配置") : field.value_text || "-"}
                            </TableCell>
                            <TableCell>{field.required ? "必填" : "可选"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={hasFieldIssue ? issueSeverityClass(topSeverity) : field.validation_status === "valid" ? statusClass("ready") : statusClass("manual_review")}>
                                {field.validation_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[220px]">
                              {isSizeChartField ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setActiveTab("size-chart")}
                                >
                                  <ClipboardCheck className="size-4" />
                                  配置尺码表
                                </Button>
                              ) : isChoiceField && isMultiChoiceField && options.length > 0 ? (
                                <MultiChoiceFieldEditor
                                  field={field}
                                  value={value}
                                  options={options}
                                  disabled={!canWrite}
                                  onChange={(nextValue) => setFieldValues((current) => ({ ...current, [field.id]: nextValue }))}
                                />
                              ) : isChoiceField && options.length > 0 ? (
                                <Select
                                  value={options.some((option) => option.value === value) ? value : ""}
                                  onValueChange={(nextValue) => setFieldValues((current) => ({ ...current, [field.id]: nextValue }))}
                                >
                                  <SelectTrigger className="h-8" disabled={!canWrite}>
                                    <SelectValue placeholder="选择字段值" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {options.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : isLongTextFieldType(field) ? (
                                <Textarea
                                  value={value}
                                  disabled={!canWrite}
                                  onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
                                  placeholder="填写目标值"
                                  className="min-h-20 min-w-[260px]"
                                />
                              ) : (
                                <Input
                                  value={value}
                                  disabled={!canWrite}
                                  onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
                                  placeholder="填写目标值"
                                  className="h-8"
                                />
                              )}
                            </TableCell>
                          </TableRow>
                          {hasFieldIssue ? (
                            <TableRow
                              data-field-issue-reason={field.field_name}
                              className={cn(
                                "border-l-4",
                                issueBorderClass,
                                issueBackgroundClass,
                                isActiveIssueField && "ring-2 ring-inset ring-[#18e299]/80",
                              )}
                            >
                              <TableCell colSpan={6} className="py-2 pl-5 pr-4 align-top">
                                <div className={cn("flex min-w-0 items-center gap-3 overflow-x-auto whitespace-nowrap text-sm leading-6", issueToneClass)}>
                                  <Badge variant="outline" className={issueSeverityClass(topSeverity)}>
                                    {issueSeverityLabel(topSeverity)}
                                  </Badge>
                                  <span className="font-medium">问题原因：</span>
                                  <span>{issueSummaryText(fieldIssues)}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="size-chart" className="min-w-0">
            <Card className="min-w-0 overflow-visible">
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle>尺码表配置</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    根据 PLM 尺码表模板生成深绘尺码表字段，数值可人工修正，映射关系可审核保存。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canWrite || recommendSizeChartMappings.isPending}
                    onClick={() => recommendSizeChartMappings.mutate()}
                  >
                    {recommendSizeChartMappings.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    AI 推荐尺码映射
                  </Button>
                  <Dialog open={sizeChartMappingDialogOpen} onOpenChange={setSizeChartMappingDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canWrite || !activeSizeChartMappings.length}
                      >
                        <ClipboardCheck className="size-4" />
                        查看全部映射
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="grid max-h-[82vh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-5xl">
                      <DialogHeader>
                        <DialogTitle>字段映射审核弹窗</DialogTitle>
                        <DialogDescription>
                          {activeSizeChartMappings.length > 0
                            ? `当前 ${formatNumber(activeSizeChartMappings.length)} 条映射建议`
                            : "暂无映射建议"}
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="min-h-0 rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>尺码表</TableHead>
                              <TableHead>深绘字段</TableHead>
                              <TableHead>PLM 测量点</TableHead>
                              <TableHead>置信度</TableHead>
                              <TableHead>来源</TableHead>
                              <TableHead>理由</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeSizeChartMappings.map((mapping, index) => (
                              <TableRow key={`${mapping.fieldName}-${mapping.targetField}-${index}`}>
                                <TableCell>{mapping.fieldName}</TableCell>
                                <TableCell>{mapping.targetField}</TableCell>
                                <TableCell>{mapping.sourcePoint || "待人工判断"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{mapping.confidence}</Badge>
                                </TableCell>
                                <TableCell>{mapping.source}</TableCell>
                                <TableCell className="max-w-[360px] whitespace-normal">{mapping.reason || "-"}</TableCell>
                              </TableRow>
                            ))}
                            {!activeSizeChartMappings.length ? (
                              <TableRow>
                                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                                  点击 AI 推荐尺码映射后查看待审核关系。
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setSizeChartMappingDialogOpen(false)}>
                          关闭
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canWrite || !sizeChartRecommendation?.mappings.length || applySizeChartMappings.isPending || saveSizeChartMappings.isPending}
                    onClick={() => applySizeChartMappings.mutate()}
                  >
                    {applySizeChartMappings.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
                    应用到草稿
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canWrite || sizeChartChangedFields.length === 0 || saveSizeChartValues.isPending}
                    onClick={() => {
                      if (!draft?.updated_at) return
                      saveSizeChartValues.mutate({
                        expectedDraftUpdatedAt: draft.updated_at,
                        fields: sizeChartChangedFields,
                        cellValues: { ...sizeChartCellValues },
                      })
                    }}
                  >
                    {saveSizeChartValues.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    保存尺码表数值
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canWrite || !sizeChartRecommendation?.mappings.length || applySizeChartMappings.isPending || saveSizeChartMappings.isPending}
                    onClick={() => saveSizeChartMappings.mutate()}
                  >
                    {saveSizeChartMappings.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    保存人工审核
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid min-w-0 gap-5 overflow-visible">
                <Collapsible
                  open={sizeChartSourceOpen}
                  onOpenChange={setSizeChartSourceOpen}
                  className={cn(
                    "min-w-0 overflow-hidden rounded-md border bg-card",
                    sizeChartSourcePinned && "sticky top-[-1.5rem] z-20 md:top-[-2rem] shadow-[0_8px_18px_rgba(15,23,42,0.08)]",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">PLM 导入字段对照</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        测量点 {formatNumber(sizeChartImportedMatrix.titles.length)} 项，尺码 {formatNumber(sizeChartImportedMatrix.rows.length)} 行，来源行 {formatNumber(sizeChartImportedMatrix.rowCount)} 条
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant={sizeChartSourcePinned ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setSizeChartSourcePinned((current) => {
                          const next = !current
                          if (next) setSizeChartSourceOpen(true)
                          return next
                        })}
                      >
                        {sizeChartSourcePinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                        {sizeChartSourcePinned ? "取消固定" : "固定在顶部"}
                      </Button>
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          {sizeChartSourceOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          {sizeChartSourceOpen ? "收起" : "展开"}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent>
                    {sizeChartImportedMatrix.rows.length > 0 ? (
                      <Table className="w-max min-w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">尺码</TableHead>
                            {sizeChartImportedMatrix.titles.map((title) => (
                              <TableHead key={title} className="min-w-[150px] normal-case tracking-normal">{title}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sizeChartImportedMatrix.rows.map((row) => (
                            <TableRow key={row.size}>
                              <TableCell className="font-mono">{row.size}</TableCell>
                              {sizeChartImportedMatrix.titles.map((title, index) => (
                                <TableCell key={`${row.size}-${title}`} className="font-mono">{row.values[index]}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="px-4 py-6 text-sm text-muted-foreground">当前草稿未关联 PLM 尺码表导入字段。</div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {sizeChartPreview.length > 0 ? (
                  sizeChartPreview.map((preview) => (
                    <div key={preview.fieldName} className="min-w-0 overflow-hidden rounded-md border">
                      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                        <div>
                          <div className="text-sm font-medium">{preview.fieldName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            表头 {formatNumber(preview.titles.length)} 项，尺码 {formatNumber(preview.rows.length)} 行
                          </div>
                        </div>
                        <Badge variant="outline">
                          {Object.keys(preview.persistedValueJson).length > 0
                            ? "已保存"
                            : Object.keys(preview.valueJson).length > 0
                              ? "待保存"
                              : "未生成"}
                        </Badge>
                      </div>
                      {preview.rows.length > 0 ? (
                        <Table className="w-max min-w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24 align-top">尺码</TableHead>
                              {preview.titles.map((title) => {
                                const mapping = mappingForSizeChartColumn(activeSizeChartMappings, preview.fieldName, title)
                                return (
                                  <TableHead key={title} className="min-w-[150px] align-top normal-case tracking-normal">
                                    <div className="text-xs font-semibold text-foreground">{title}</div>
                                    <div className="mt-1 flex min-h-8 flex-wrap items-center gap-1 text-[11px] leading-4 text-muted-foreground">
                                      <span className="max-w-[118px] truncate">
                                        {mapping?.sourcePoint || (mapping ? "待人工判断" : "未推荐")}
                                      </span>
                                      {mapping ? <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{mapping.confidence}</Badge> : null}
                                    </div>
                                  </TableHead>
                                )
                              })}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {preview.rows.map((row) => (
                              <TableRow key={row.size}>
                                <TableCell className="font-mono">{row.size}</TableCell>
                                {preview.titles.map((title, index) => {
                                  const key = sizeChartCellKey(preview.fieldName, row.size, title)
                                  const value = sizeChartCellValue(preview, row.size, title, index, sizeChartCellValues)
                                  return (
                                    <TableCell key={`${row.size}-${title}`} className="min-w-[150px]">
                                      <Input
                                        value={value}
                                        disabled={!canWrite}
                                        onChange={(event) => setSizeChartCellValues((current) => ({
                                          ...current,
                                          [key]: event.target.value,
                                        }))}
                                        className="h-8 w-28 font-mono"
                                        inputMode="decimal"
                                      />
                                    </TableCell>
                                  )
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="px-4 py-6 text-sm text-muted-foreground">当前字段还没有生成尺码表数据。</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    当前深绘类目没有尺码表字段，或还未同步该类目的字段模板。
                  </div>
                )}

              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skus" className="min-w-0">
            <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>SKU/颜色尺码</CardTitle>
            </CardHeader>
            <CardContent>
                  <Table className="w-max min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>SKC</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>颜色</TableHead>
                    <TableHead>尺码</TableHead>
                    <TableHead>条码</TableHead>
                    <TableHead>价格</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.data?.skus.map((sku) => (
                    <TableRow key={sku.id}>
                      <TableCell>{sku.skc_code}</TableCell>
                      <TableCell>{sku.sku_code}</TableCell>
                      <TableCell>{sku.color_name}</TableCell>
                      <TableCell>{sku.size_name}</TableCell>
                      <TableCell>{sku.barcode || sku.seller_code}</TableCell>
                      <TableCell>{sku.price ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="min-w-0">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>校验问题</CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="w-max min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>级别</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>字段/SKU</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.data?.issues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>{issue.severity}</TableCell>
                      <TableCell>{issue.issue_type}</TableCell>
                      <TableCell>{issue.field_name || issue.sku_code || "-"}</TableCell>
                      <TableCell>{issue.message}</TableCell>
                      <TableCell>{issue.resolved_at ? "已解决" : "未解决"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="min-w-0">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>提交记录</CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="w-max min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>操作</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>业务码</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>request id</TableHead>
                    <TableHead>productId</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.data?.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.operation}</TableCell>
                      <TableCell>{log.http_status ?? "-"}</TableCell>
                      <TableCell>{log.response_code || "-"}</TableCell>
                      <TableCell className="max-w-[420px] whitespace-normal break-words">
                        {log.response_reason || "-"}
                      </TableCell>
                      <TableCell>{log.request_id || "-"}</TableCell>
                      <TableCell>{log.product_id || "-"}</TableCell>
                      <TableCell>{formatDateTime(log.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="source" className="min-w-0">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>来源快照</CardTitle>
              <RefreshCw className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <pre className="max-h-[520px] overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify({
                  source: draft.source_snapshot_json,
                  duplicate: draft.duplicate_result_json,
                }, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
