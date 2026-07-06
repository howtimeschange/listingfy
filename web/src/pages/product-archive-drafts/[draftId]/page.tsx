import { Fragment, useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, ListTree, Loader2, Pin, PinOff, RefreshCw, Save, Search, Send, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
  source_type: string
  value_text: string | null
  value_json?: unknown
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

interface DraftDetail {
  draft: Draft
  launchPlanReference?: LaunchPlanReference
  sizeChartSourceRows?: SizeChartSourceRow[]
  fields: DraftField[]
  skus: DraftSku[]
  issues: DraftIssue[]
  logs: DraftLog[]
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
  valueJson: Record<string, unknown>
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

function statusClass(status: string) {
  if (["ready", "created", "readback_verified"].includes(status)) return "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
  if (["missing_fields", "manual_review", "readback_mismatch"].includes(status)) return "border-[#f4ddb3] bg-[#fff8e8] text-[#c37d0d]"
  if (["failed", "duplicate_found"].includes(status)) return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  return "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
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
  const currentValue = field.value_text ?? ""
  const options = parseOptionList(field.options_json)
    .map((option) => {
      const value = fieldOptionText(option, ["value", "code", "id", "optionValue", "option_value", "key", "name", "label"])
      const label = fieldOptionText(option, ["label", "name", "text", "optionName", "option_name", "title", "value", "code"])
      if (!value && !label) return null
      return { value: value || label, label: label || value }
    })
    .filter(Boolean) as FieldOption[]
  const deduped = Array.from(new Map(options.map((option) => [option.value, option])).values())
  if (currentValue && !deduped.some((option) => option.value === currentValue)) {
    deduped.unshift({ value: currentValue, label: `${currentValue}（当前值）` })
  }
  return deduped
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

function sizeChartRows(valueJson: unknown) {
  const record = recordValue(valueJson)
  const titles = String(record.title ?? "").split(",").map((item) => item.trim()).filter(Boolean)
  const rows = Object.entries(record)
    .filter(([key]) => key !== "title")
    .map(([size, value]) => ({ size, values: String(value ?? "").split(",").map((item) => item.trim()) }))
  return { titles, rows }
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

function normalizedSizeChartValueJson(preview: SizeChartPreviewItem) {
  return sizeChartValueJson(preview, {})
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

export default function ProductArchiveDraftDetailPage() {
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
  const [tradeSearch, setTradeSearch] = useState("")
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const [activeIssueIndex, setActiveIssueIndex] = useState(0)
  const debouncedTradeSearch = useDebounce(tradeSearch, 250)

  const draft = detail.data?.draft
  const summary = draft?.validation_summary_json ?? {}
  const launchPlanReference = detail.data?.launchPlanReference ?? { matched: false, fields: [] }
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
    const currentFields = new Map((detail.data?.fields ?? []).map((field) => [field.id, field.value_text ?? ""]))
    return Object.entries(fieldValues)
      .filter(([id, value]) => value !== (currentFields.get(Number(id)) ?? ""))
      .map(([id, valueText]) => ({ id: Number(id), valueText }))
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
      .filter((field) => compactFieldKey(field.field_name).includes("尺码表"))
      .map((field) => {
        const valueJson = recommendationPreviews.get(field.field_name) ?? recordValue(field.value_json)
        const parsed = sizeChartRows(valueJson)
        return {
          fieldId: field.id,
          fieldName: field.field_name,
          valueJson,
          rows: parsed.rows,
          titles: parsed.titles,
        }
      })
  }, [detail.data?.fields, sizeChartRecommendation?.previews])
  const activeSizeChartMappings = sizeChartRecommendation?.mappings ?? []
  const sizeChartImportedMatrix = useMemo(() => (
    sizeChartSourceMatrix(detail.data?.sizeChartSourceRows ?? [])
  ), [detail.data?.sizeChartSourceRows])
  const sizeChartChangedFields = useMemo(() => {
    return sizeChartPreview
      .map((preview) => {
        const nextValueJson = sizeChartValueJson(preview, sizeChartCellValues)
        const currentValueJson = normalizedSizeChartValueJson(preview)
        if (JSON.stringify(nextValueJson) === JSON.stringify(currentValueJson)) return null
        return {
          id: preview.fieldId,
          valueText: "",
          valueJson: nextValueJson,
        }
      })
      .filter(Boolean) as Array<{ id: number; valueText: string; valueJson: Record<string, string> }>
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
    mutationFn: () =>
      api.patch<DraftDetail>(`/product-archive-drafts/${draftId}/fields`, { fields: changedFields }),
    onSuccess: () => {
      toast.success("字段已保存")
      setFieldValues({})
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const saveSizeChartValues = useMutation({
    mutationFn: () =>
      api.patch<DraftDetail>(`/product-archive-drafts/${draftId}/fields`, { fields: sizeChartChangedFields }),
    onSuccess: (result) => {
      toast.success("尺码表数值已保存")
      setSizeChartCellValues({})
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

  const validate = useMutation({
    mutationFn: async () => {
      if (changedFields.length > 0) {
        await saveFields.mutateAsync()
      }
      return api.post<unknown>(`/product-archive-drafts/${draftId}/validate`)
    },
    onSuccess: () => {
      toast.success("校验已完成")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const aiFill = useMutation({
    mutationFn: () => api.post<{ saved: Array<{ field_id: number }>; detail: DraftDetail }>(`/product-archive-drafts/${draftId}/ai-fill`),
    onSuccess: (result) => {
      setFieldValues({})
      queryClient.setQueryData(["product-archive-drafts", draftId], result.detail)
      toast.success(
        result.saved.length > 0
          ? `AI 已推荐补齐 ${formatNumber(result.saved.length)} 个字段`
          : "已刷新字段规则和 AI 推荐结果",
      )
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
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
    mutationFn: () => api.post<unknown>(`/product-archive-drafts/${draftId}/submit`, { dryRun: false }),
    onSuccess: () => {
      toast.success("已发布到深绘并完成回读校验")
      setPublishDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "发布到深绘失败")
    },
  })

  if (!draft) {
    return (
      <PageContainer>
        <PageHeader title="深绘建档草稿" description={detail.isLoading ? "正在加载草稿详情" : "草稿不存在"} />
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
        title={draft.title || draft.spu_code}
        description={`${draft.spu_code} / ${draft.tenant_name} / ${draft.trade_path || "待确认类目"}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/product-archive-drafts">
            <ArrowLeft className="size-4" />
            返回
          </Link>
        </Button>
        <Dialog
          open={tradeDialogOpen}
          onOpenChange={(open) => {
            setTradeDialogOpen(open)
            if (open) setSelectedTradeId(draft.trade_id)
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <ListTree className="size-4" />
              选择深绘类目
            </Button>
          </DialogTrigger>
          <DialogContent className="grid max-h-[82vh] grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>选择深绘类目</DialogTitle>
              <DialogDescription>
                从已同步的深绘类目主数据中选择模板，应用后会按类目字段重新生成草稿字段。
              </DialogDescription>
            </DialogHeader>
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
                disabled={!selectedTradeId || applyTrade.isPending}
                onClick={() => applyTrade.mutate()}
              >
                {applyTrade.isPending ? <Loader2 className="size-4 animate-spin" /> : <ListTree className="size-4" />}
                应用类目并生成字段
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button type="button" variant="outline" size="sm" onClick={() => validate.mutate()} disabled={validate.isPending || saveFields.isPending}>
          {validate.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
          重新校验
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => aiFill.mutate()} disabled={aiFill.isPending}>
          {aiFill.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          AI 推荐补齐空字段
        </Button>
        <Button type="button" size="sm" onClick={() => dryRunSubmit.mutate()} disabled={dryRunSubmit.isPending}>
          {dryRunSubmit.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          提交预览
        </Button>
        <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" disabled={publishSubmit.isPending}>
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
              <Button type="button" disabled={publishSubmit.isPending} onClick={() => publishSubmit.mutate()}>
                {publishSubmit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                确认发布到深绘
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

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

      <Tabs defaultValue="fields" className="min-h-0 min-w-0">
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
              <Card className="min-w-0 overflow-hidden">
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
                      disabled={changedFields.length === 0 || saveFields.isPending}
                      onClick={() => saveFields.mutate()}
                    >
                      {saveFields.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      保存字段
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => validate.mutate()} disabled={validate.isPending || saveFields.isPending}>
                      {validate.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
                      重新校验
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => aiFill.mutate()} disabled={aiFill.isPending}>
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
                  <Button type="button" className="mt-4" onClick={() => setTradeDialogOpen(true)}>
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
                              {field.value_text || "-"}
                            </TableCell>
                            <TableCell>{field.required ? "必填" : "可选"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={hasFieldIssue ? issueSeverityClass(topSeverity) : field.validation_status === "valid" ? statusClass("ready") : statusClass("manual_review")}>
                                {field.validation_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-[220px]">
                              {options.length > 0 ? (
                                <Select
                                  value={value}
                                  onValueChange={(nextValue) => setFieldValues((current) => ({ ...current, [field.id]: nextValue }))}
                                >
                                  <SelectTrigger className="h-8">
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
                              ) : (
                                <Input
                                  value={value}
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
                    disabled={recommendSizeChartMappings.isPending}
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
                        disabled={!activeSizeChartMappings.length}
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
                    disabled={!sizeChartRecommendation?.mappings.length || applySizeChartMappings.isPending || saveSizeChartMappings.isPending}
                    onClick={() => applySizeChartMappings.mutate()}
                  >
                    {applySizeChartMappings.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
                    应用到草稿
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sizeChartChangedFields.length === 0 || saveSizeChartValues.isPending}
                    onClick={() => saveSizeChartValues.mutate()}
                  >
                    {saveSizeChartValues.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    保存尺码表数值
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!sizeChartRecommendation?.mappings.length || applySizeChartMappings.isPending || saveSizeChartMappings.isPending}
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
                        <Badge variant="outline">{Object.keys(preview.valueJson).length > 0 ? "已生成" : "未生成"}</Badge>
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
                      <TableCell>{log.response_code || log.response_reason || "-"}</TableCell>
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
