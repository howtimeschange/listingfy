import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Bot,
  Camera,
  ChevronRight,
  Download,
  FileClock,
  FileSpreadsheet,
  FolderTree,
  FolderUp,
  FilterX,
  ImageIcon,
  Images,
  Languages,
  Layers3,
  Loader2,
  Save,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Upload,
  MoreHorizontal,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { exportSpreadsheet, readSpreadsheetFile, type SpreadsheetRow } from "@/lib/spreadsheet"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { ImportDialog } from "@/components/import-dialog"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface AttributeOption {
  attribute_value_id: number
  attribute_value: string
  attribute_value_en: string | null
}

interface FillField {
  key: string
  label: string
  value: string | number | null
  source: string
  status: "READY" | "MISSING" | "NEEDS_AI" | "WARNING"
  confidence?: number | null
  note?: string | null
  options?: AttributeOption[]
  attribute_id?: number | null
  attribute_type?: number | null
  attribute_label?: number | null
  attribute_mode?: number | null
  attribute_status?: number | null
  attribute_input_num?: number | null
  render_kind?: "text" | "textarea" | "single_enum" | "multi_enum" | "enum_with_text" | "readonly"
}

interface FieldGroup {
  group: string
  fields: FillField[]
}

interface DimensionFieldGroup {
  dimension: "SPU" | "SKC" | "SKU"
  title: string
  description: string
  groups: FieldGroup[]
}

interface ImageRequirement {
  key: string
  requirement_key: string
  name: string
  level: "SPU" | "SKC" | "SKU"
  show: number | null
  required: number | null
  single: number | null
  image_type: string
  asset_types: string[]
  count_rule: string
  dimension_rule: string
  format_rule: string
  size_rule: string
  note: string | null
}

interface CategoryTreeItem {
  category_id: number
  product_type_id: number
  parent_category_id: number | null
  category_name: string
  root_category_id: number | null
  root_category_name: string | null
  level: number
  path: string
  last_category: number
  child_count?: number
}

interface SizeTable {
  id: number
  table_index: number
  field_name: string | null
  row_count: number
}

interface SizeTableRow {
  id: number
  table_index: number
  row_index: number
  size_name: string | null
  values_json: string
}

interface MappedSizeChart {
  template_key: string
  template_name: string
  source_table_id: number
  source_table_index: number
  source_field_name: string | null
  source_label: string
  target_label: string
  shein_attribute_id: number | null
  shein_attribute_name: string
  columns: string[]
  rows: SizeTableRow[]
  status: string
  note: string
}

interface SizeChartAttribute {
  attribute_id: number
  attribute_name: string
  attribute_name_en: string | null
  attribute_input_num: number | null
}

interface ManualSizeChartRow {
  sku_id: number
  sku_code: string
  size_name: string | null
  shein_size_value: string | null
  relate_sale_attribute_value_id: number | null
  values: Record<string, string | number | null>
}

interface SaleAttribute {
  attribute_id: number
  attribute_name: string
  attribute_name_en: string | null
  attribute_type: number | null
  attribute_label: number | null
  attribute_mode: number | null
  values: AttributeOption[]
}

interface ListingAsset {
  id: number
  skc_code: string | null
  source_type: string
  asset_type: string
  image_sort: number
  local_path: string | null
  source_url: string | null
  platform_url?: string | null
  width: number | null
  height: number | null
  file_size?: number | null
  status: string
  transform_status?: string | null
  transform_error?: string | null
  transformed_at?: string | null
  confirmed: number
  note: string | null
  raw_payload_json?: string | null
}

interface ImageCandidate {
  id: number
  source_kind: string | null
  place: string | null
  spu_code: string | null
  skc_code: string | null
  asset_type: string | null
  picture_type: string | null
  module_name: string | null
  normalized_url: string
  preview_url: string
  file_name: string | null
  width: number | null
  height: number | null
  file_size: number | null
  sort_no: number | null
  recommended_asset_type: string
  compliance: {
    compliant: boolean
    status: "PASS" | "WARN" | "FAIL"
    reasons: string[]
    file_size_limit_bytes: number | null
  }
}

interface ImageCandidateList {
  items: ImageCandidate[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
  source_places: Array<{
    source_place: string
    count: number
  }>
  requirement: ImageRequirement
}

interface ListingDetail {
  listing: {
    id: number
    platform: string
    spu_code: string
    title: string | null
    spu_name: string | null
    brand_name: string | null
    status: string
    validation_status: string
    completeness: number
    platform_category_id: number | null
    product_type_id: number | null
    platform_category_name: string | null
    platform_category_path: string | null
    latest_version_no: number | null
    blocker_count: number
    skc_count: number
    sku_count: number
    updated_at: string
  }
  readiness: {
    field_groups: FieldGroup[]
    dimension_field_groups: DimensionFieldGroup[]
    blocking_issues: string[]
    category: {
      category_name: string | null
      path: string | null
    }
  }
  dimension_field_groups: DimensionFieldGroup[]
  skcs: Array<{
    id: number
    skc_code: string
    color_name: string | null
    image_url: string | null
    color_attribute_payload_json: string
    selected_for_publish: number
    image_confirmed: number
  }>
 skus: Array<{
    id: number
    skc_code: string
    skc_image_url: string | null
    sku_code: string
    supplier_sku: string
    supplier_barcode: string | null
    size_name: string | null
    shein_size_value: string | null
    size_attribute_payload_json: string
    package_length_cm: number | null
    package_width_cm: number | null
    package_height_cm: number | null
    package_weight_g: number | null
    cost_price: number | null
    currency: string | null
    selected_for_publish: number
    price_confirmed?: number | null
    price_confirmed_at?: string | null
  }>
  assets: ListingAsset[]
  sale_attributes: SaleAttribute[]
  image_checklist: Array<{
    skc_code: string
    color_name: string | null
    selected_for_publish: boolean
    has_tmall_color_image: boolean
    imported_asset_count: number
    detail_asset_count: number
    confirmed: boolean
    status: string
    missing: string[]
    requirements: Array<{
      requirement_key: string
      name: string
      level: string
      required: boolean
      asset_count: number
      status: string
    }>
  }>
  image_requirements: ImageRequirement[]
  size_tables: SizeTable[]
  size_table_rows: SizeTableRow[]
  mapped_size_charts: MappedSizeChart[]
  size_chart_attributes: SizeChartAttribute[]
  manual_size_chart: {
    source: string | null
    updated_at: string | null
    rows: ManualSizeChartRow[]
  }
  validation_issues: Array<{
    id: number
    severity: string
    module: string
    field_key: string | null
    message: string
    suggestion: string | null
  }>
  versions: Array<{
    id: number
    version_no: number
    version_type: string
    status: string
    change_summary: string | null
    platform_version?: string | null
    error_code?: string | null
    error_message?: string | null
    created_at: string
    submitted_at?: string | null
  }>
  publish_tasks: Array<{
    id: number
    publish_version_id: number | null
    platform: string
    task_type: string
    status: string
    error_code: string | null
    error_message: string | null
    platform_trace_id: string | null
    platform_version: string | null
    created_at: string
    finished_at: string | null
  }>
  platform_identities: Array<{
    id: number
    local_type: string
    local_id: number
    platform_type: string
    platform_id: string
    platform_parent_id: string | null
    updated_at: string
  }>
}

type ValidationIssue = ListingDetail["validation_issues"][number]

type SkuCommercialDraft = {
  costPrice: string
  currency: string
  packageLengthCm: string
  packageWidthCm: string
  packageHeightCm: string
}

type SkuBatchFillDraft = SkuCommercialDraft & {
  packageWeightG: string
}

type ImageUploadParams = {
  files: File[]
  skcCode?: string | null
  requirement: ImageRequirement
}

type ImageUploadingState = {
  key: string
  current: number
  total: number
  fileName?: string | null
}

type ImageLibraryPickerState = {
  requirement: ImageRequirement
  skcCode?: string | null
} | null

const IMAGE_SOURCE_KIND_OPTIONS = [
  { value: "PICTURE", label: "商品图" },
  { value: "DETAIL_SCREENSHOT", label: "商详截图" },
  { value: "DETAIL_MODULE", label: "商详模块" },
]

const DEFAULT_IMAGE_SOURCE_PLACES = ["TMALL", "VIP"]

const statusClass: Record<FillField["status"], string> = {
  READY: "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]",
  WARNING: "border-[#f4ddb3] bg-[#fff8e8] text-[#b6720b]",
  MISSING: "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]",
  NEEDS_AI: "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]",
}

function useDraftDetail(listingId: string | undefined) {
  return useQuery<ListingDetail>({
    queryKey: ["pre-publish", "draft", listingId],
    queryFn: () => api.get(`/pre-publish/drafts/${listingId}`),
    enabled: Boolean(listingId),
  })
}

function useCategoryTree(parentCategoryId: number | null, search: string) {
  const query = search.trim()
    ? `/pre-publish/category-tree?q=${encodeURIComponent(search.trim())}&limit=80`
    : parentCategoryId == null
      ? "/pre-publish/category-tree?limit=80"
      : `/pre-publish/category-tree?parent_category_id=${parentCategoryId}&limit=200`
  return useQuery<{ items: CategoryTreeItem[] }>({
    queryKey: ["pre-publish", "categoryTree", parentCategoryId, search.trim()],
    queryFn: () => api.get(query),
  })
}

function useImageCandidates(
  listingId: string | undefined,
  picker: ImageLibraryPickerState,
  search: string,
  onlyCompliant: boolean,
  sourceKinds: string[],
  sourcePlaces: string[],
) {
  return useQuery<ImageCandidateList>({
    queryKey: [
      "pre-publish",
      "draft",
      listingId,
      "image-candidates",
      picker?.requirement.requirement_key,
      picker?.skcCode ?? "",
      search.trim(),
      onlyCompliant,
      sourceKinds.join(","),
      sourcePlaces.join(","),
    ],
    queryFn: () => {
      if (!picker) throw new Error("missing image picker state")
      const params = new URLSearchParams({
        requirement_key: picker.requirement.requirement_key,
        limit: "160",
        offset: "0",
      })
      if (picker.skcCode) params.set("skc_code", picker.skcCode)
      if (search.trim()) params.set("q", search.trim())
      if (onlyCompliant) params.set("only_compliant", "1")
      if (sourceKinds.length) params.set("source_kinds", sourceKinds.join(","))
      if (sourcePlaces.length) params.set("source_places", sourcePlaces.join(","))
      return api.get(`/pre-publish/drafts/${listingId}/image-candidates?${params.toString()}`)
    },
    enabled: Boolean(listingId && picker),
  })
}

function fieldBadge(field: FillField) {
  if (field.status === "NEEDS_AI") return "需要人工判断"
  if (field.status === "MISSING") return "缺失"
  return field.source
}

function isEditableField(field: FillField) {
  return !["category", "skc_code", "skc_image", "color", "size_conversion", "package_weight", "size_chart"].includes(field.key)
}

function isAiGeneratableField(field: FillField) {
  return field.key === "title_en" || field.key.startsWith("attr:")
}

function isPublishFocusedField(field: FillField) {
  if (["category", "title_cn", "title_en", "brand"].includes(field.key)) return true
  if (field.key.startsWith("attr:")) return true
  if (["skc_code", "skc_image", "color", "size_conversion", "supply_price", "package_weight", "size_chart"].includes(field.key)) return true
  return field.status === "MISSING" || field.status === "NEEDS_AI" || field.status === "WARNING"
}

function publishFocusedGroups(groups: FieldGroup[]) {
  return groups
    .map((group) => ({
      ...group,
      fields: group.fields.filter(isPublishFocusedField),
    }))
    .filter((group) => group.fields.length > 0)
}

const issueFieldAliases: Record<string, string[]> = {
  category: ["SHEIN 类目", "SHEIN OpenAPI 套装类目限制"],
  title_cn: ["中文标题"],
  title_en: ["英文标题"],
  brand: ["商品品牌", "品牌"],
  skc_code: ["SKC", "SKC 款色"],
  skc_image: ["SKC 图片"],
  color: ["颜色", "发布颜色"],
  size_conversion: ["尺寸", "尺码", "SHEIN 尺码"],
  supply_price: ["供货价(人民币)", "供货价"],
  package_weight: ["产品毛重/g", "毛重"],
  size_chart: ["尺码表"],
}

function normalizeIssueKey(value: unknown) {
  return String(value ?? "").trim()
}

function issueMatchesField(issue: ValidationIssue, field: FillField) {
  const key = normalizeIssueKey(issue.field_key)
  if (!key) return false
  if (key === field.key || key === field.label) return true
  return (issueFieldAliases[field.key] ?? []).includes(key)
}

function issuesByFieldKey(issues: ValidationIssue[], groups: FieldGroup[]) {
  const map = new Map<string, ValidationIssue[]>()
  for (const field of groups.flatMap((group) => group.fields)) {
    const matched = issues.filter((issue) => issueMatchesField(issue, field))
    if (matched.length > 0) map.set(field.key, matched)
  }
  return map
}

function issuesForKeys(issues: ValidationIssue[], keys: string[]) {
  const keySet = new Set(keys)
  return issues.filter((issue) => keySet.has(normalizeIssueKey(issue.field_key)))
}

function splitMultiEnumValue(value: string) {
  return value
    .split(/[、,，;；|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function sizeMatchTokens(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return []
  const tokens = new Set<string>([raw.toLowerCase()])
  const digits = raw.match(/\d+/)?.[0] ?? ""
  if (digits) {
    tokens.add(digits)
    tokens.add(digits.padStart(3, "0"))
  }
  if (raw.toLowerCase().endsWith("cm")) {
    const withoutCm = raw.replace(/cm$/i, "").trim()
    if (withoutCm) {
      tokens.add(withoutCm.toLowerCase())
      tokens.add(withoutCm.padStart(3, "0"))
    }
  }
  return Array.from(tokens)
}

function imageUploadKey(requirementKey: string, skcCode?: string | null) {
  return `${skcCode || "SPU"}:${requirementKey}`
}

function MultiEnumPicker({
  field,
  value,
  onChange,
}: {
  field: FillField
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const options = field.options ?? []
  const selected = new Set(splitMultiEnumValue(value))
  const selectedOptions = options.filter((option) => selected.has(option.attribute_value))
  const selectedLabels = selectedOptions.length
    ? selectedOptions.map(optionLabel)
    : splitMultiEnumValue(value)

  function toggleOption(option: AttributeOption) {
    const next = new Set(selected)
    if (next.has(option.attribute_value)) next.delete(option.attribute_value)
    else next.add(option.attribute_value)
    onChange(Array.from(next).join("、"))
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal"
          >
            <span className={cn("truncate", selectedLabels.length === 0 && "text-muted-foreground")}>
              {selectedLabels.length ? `已选 ${selectedLabels.length} 项：${selectedLabels.slice(0, 2).join("、")}` : "搜索并选择枚举值"}
            </span>
            <Search className="ml-2 size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(680px,calc(100vw-4rem))] p-0">
          <Command>
            <CommandInput placeholder={`搜索${field.label}枚举值`} />
            <CommandList className="max-h-80">
              <CommandEmpty>没有匹配的枚举值</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const checked = selected.has(option.attribute_value)
                  return (
                    <CommandItem
                      key={option.attribute_value_id}
                      value={optionLabel(option)}
                      onSelect={() => toggleOption(option)}
                      className="gap-3"
                    >
                      <Checkbox checked={checked} />
                      <span className="min-w-0 flex-1 truncate">{optionLabel(option)}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="flex items-center justify-between border-t p-2">
            <span className="text-xs text-muted-foreground">当前已选 {selectedLabels.length} 项</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              清空
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {selectedLabels.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedLabels.slice(0, 8).map((label) => (
            <Badge key={label} variant="outline" className="max-w-52 truncate">
              {label}
            </Badge>
          ))}
          {selectedLabels.length > 8 ? <Badge variant="outline">+{selectedLabels.length - 8}</Badge> : null}
        </div>
      ) : null}
    </div>
  )
}

function FieldValueEditor({
  field,
  value,
  onChange,
}: {
  field: FillField
  value: string
  onChange: (value: string) => void
}) {
  const options = field.options ?? []
  if (!isEditableField(field)) {
    return <p className="text-sm">{value || "-"}</p>
  }
  if (field.render_kind === "multi_enum" && options.length > 0) {
    return <MultiEnumPicker field={field} value={value} onChange={onChange} />
  }
  if ((field.render_kind === "single_enum" || field.render_kind === "enum_with_text") && options.length > 0) {
    const current = selectedOption(options, value)
    return (
      <div className="space-y-2">
        <Select value={current ? optionValue(current) : value} onValueChange={(next) => onChange(selectedOption(options, next)?.attribute_value ?? next)}>
          <SelectTrigger>
            <SelectValue placeholder="选择枚举值" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={`${field.key}-${option.attribute_value_id}`} value={optionValue(option)}>
                {optionLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.render_kind === "enum_with_text" ? (
          <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="枚举之外的补充值" />
        ) : null}
      </div>
    )
  }
  if (field.key === "title_en" || field.status === "NEEDS_AI" || field.status === "MISSING") {
    return <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={2} placeholder="填写字段值" />
  }
  return <Input value={value} onChange={(event) => onChange(event.target.value)} />
}

function toInputValue(value: unknown) {
  return value == null ? "" : String(value)
}

function parseValues(value: string) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function parsePayload(value: unknown) {
  if (!value || typeof value !== "string") return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function selectedOption(options: AttributeOption[] | undefined, value: string) {
  if (!options?.length) return null
  return options.find((option) => String(option.attribute_value_id) === value || option.attribute_value === value) ?? null
}

function optionValue(option: AttributeOption) {
  return String(option.attribute_value_id)
}

function optionLabel(option: AttributeOption) {
  return option.attribute_value_en ? `${option.attribute_value} / ${option.attribute_value_en}` : option.attribute_value
}

function assetSrc(asset: ListingAsset) {
  if (asset.source_url) return asset.source_url
  return `/api/pre-publish/assets/${asset.id}/file`
}

function formatDimensions(width?: number | null, height?: number | null) {
  if (!width || !height) return "尺寸未知"
  return `${width} x ${height}`
}

function formatBytes(value?: number | null) {
  if (!value) return "大小未知"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

function sourceKindLabel(value?: string | null) {
  switch (value) {
    case "PICTURE":
      return "商品图"
    case "DETAIL_SCREENSHOT":
      return "商详截图"
    case "DETAIL_MODULE":
      return "商详模块"
    case "IMAGE_LIBRARY":
      return "素材库"
    case "MANUAL_UPLOAD":
      return "人工上传"
    case "MANUAL_FOLDER_IMPORT":
      return "本地目录"
    case "SOURCE_FALLBACK":
      return "源图补齐"
    default:
      return value || "未知来源"
  }
}

function sourcePlaceLabel(value?: string | null) {
  const text = String(value ?? "").trim().toUpperCase()
  switch (text) {
    case "TMALL":
      return "TMALL 天猫"
    case "TAOBAO":
      return "TAOBAO 淘宝"
    case "JD":
      return "JD 京东"
    case "VIP":
      return "VIP 唯品会"
    case "PDD":
      return "PDD 拼多多"
    case "DOUYIN":
      return "抖音"
    case "KUAISHOU":
      return "快手"
    case "XIAOHONGSHU":
      return "小红书"
    case "ALIBABA":
      return "1688"
    default:
      return text || "未知平台"
  }
}

function assetRawPayload(asset: ListingAsset) {
  return parsePayload(asset.raw_payload_json)
}

function skcImageForSku(
  sku: ListingDetail["skus"][number],
  skcs: ListingDetail["skcs"],
  assets: ListingAsset[],
) {
  if (sku.skc_image_url) return sku.skc_image_url
  const skc = skcs.find((item) => item.skc_code === sku.skc_code)
  if (skc?.image_url) return skc.image_url
  const imported = assets.find((asset) =>
    asset.skc_code === sku.skc_code && ["MAIN", "COLOR_BLOCK", "COLOR"].includes(asset.asset_type),
  )
  return imported ? assetSrc(imported) : ""
}

function requirementStatusLabel(requirement: ImageRequirement, checklist?: ListingDetail["image_checklist"][number]) {
  const item = checklist?.requirements?.find((row) => row.requirement_key === requirement.requirement_key)
  if (!item) return requirement.required === 1 ? "待补齐" : "可选"
  if (item.status === "READY") return item.required ? "已满足" : "可选"
  return "缺失"
}

const IMAGE_ASSET_TYPE_OPTIONS = [
  "MAIN",
  "DETAIL",
  "DETAIL_BACK",
  "SQUARE",
  "COLOR_BLOCK",
  "COLOR",
]

function assetTypeLabel(value: string | null | undefined) {
  switch (value) {
    case "MAIN":
      return "主图"
    case "DETAIL":
      return "细节图"
    case "DETAIL_BACK":
      return "背面/细节图"
    case "SQUARE":
      return "方形图"
    case "COLOR_BLOCK":
      return "色块图"
    case "COLOR":
      return "颜色图"
    default:
      return value || "未分类"
  }
}

function assetMatchesImageRequirement(asset: ListingAsset, requirement: ImageRequirement) {
  return requirement.asset_types.includes(asset.asset_type)
}

function complianceClass(status: ImageCandidate["compliance"]["status"]) {
  if (status === "PASS") return "border-[#b9f4d8] bg-[#f4fff9] text-[#0f8a5f]"
  if (status === "WARN") return "border-[#f4ddb3] bg-[#fff8e8] text-[#8a5a08]"
  return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
}

function findPublishSizeMatch(
  localSize: unknown,
  publishSizeByToken: Map<string, { publishSize: string; localSize: string }>,
) {
  for (const token of sizeMatchTokens(localSize)) {
    const match = publishSizeByToken.get(token)
    if (match) return match
  }
  return null
}

function FieldGroupsTable({
  groups,
  manualValues,
  onChange,
  onEditCategory,
  onGenerateCategoryAi,
  categoryAiGenerating,
  onGenerateAi,
  generatingFieldKey,
  validationIssues,
}: {
  groups: FieldGroup[]
  manualValues: Record<string, string>
  onChange: (key: string, value: string) => void
  onEditCategory?: () => void
  onGenerateCategoryAi?: () => void
  categoryAiGenerating?: boolean
  onGenerateAi?: (field: FillField) => void
  generatingFieldKey?: string | null
  validationIssues?: Map<string, ValidationIssue[]>
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.group} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{group.group}</h3>
            <Badge variant="outline">上新需要关注</Badge>
          </div>
          <div className="overflow-hidden rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">字段</TableHead>
                  <TableHead>字段值</TableHead>
                  <TableHead className="w-[128px]">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.fields.map((field) => {
                  const generating = generatingFieldKey === field.key
                  const isCategoryField = field.key === "category"
                  const fieldIssues = validationIssues?.get(field.key) ?? []
                  const hasError = fieldIssues.some((issue) => issue.severity === "ERROR") || field.status === "MISSING"
                  return (
                    <TableRow
                      key={field.key}
                      className={cn(
                        hasError && "bg-[#fff1f1] hover:bg-[#fff1f1]",
                      )}
                    >
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <p className={cn("font-medium", hasError && "text-destructive")}>{field.label}</p>
                          {field.attribute_id ? (
                            <p className="font-mono text-[11px] text-muted-foreground">#{field.attribute_id}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 gap-2">
                          <div className="min-w-0 flex-1">
                            <FieldValueEditor
                              field={field}
                              value={manualValues[field.key] ?? toInputValue(field.value)}
                              onChange={(value) => onChange(field.key, value)}
                            />
                            {field.note ? <p className={cn("mt-1 text-xs text-muted-foreground", hasError && "text-destructive/80")}>{field.note}</p> : null}
                            {fieldIssues.length > 0 ? (
                              <div className="mt-2 space-y-1 text-xs text-destructive">
                                {fieldIssues.map((issue) => (
                                  <p key={issue.id}>
                                    {issue.message}
                                    {issue.suggestion ? `；${issue.suggestion}` : ""}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {onGenerateAi && isAiGeneratableField(field) ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              disabled={generating}
                              onClick={() => onGenerateAi(field)}
                            >
                              {generating ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}
                              AI 生成
                            </Button>
                          ) : null}
                          {onGenerateCategoryAi && isCategoryField ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              disabled={categoryAiGenerating}
                              onClick={onGenerateCategoryAi}
                            >
                              {categoryAiGenerating ? (
                                <Loader2 className="mr-1 size-3.5 animate-spin" />
                              ) : (
                                <Bot className="mr-1 size-3.5" />
                              )}
                              AI 转换类目
                            </Button>
                          ) : null}
                          {onEditCategory && isCategoryField ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={onEditCategory}
                            >
                              <FolderTree className="mr-1 size-3.5" />
                              修改类目
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <Badge variant="outline" className={statusClass[field.status]}>
                            {fieldBadge(field)}
                          </Badge>
                          {field.source && field.status !== "MISSING" ? (
                            <p className="truncate text-[11px] text-muted-foreground">{field.source}</p>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  )
}

function ImageRequirementTable({
  requirements,
  checklist,
  skcCode,
  onUpload,
  uploadingKey,
  uploadingState,
}: {
  requirements: ImageRequirement[]
  checklist?: ListingDetail["image_checklist"][number]
  skcCode?: string | null
  onUpload?: (params: ImageUploadParams) => void
  uploadingKey?: string | null
  uploadingState?: ImageUploadingState | null
}) {
  const visible = requirements.filter((requirement) => requirement.show !== 0)
  if (visible.length === 0) return <EmptyState icon={ImageIcon} message="当前类目未返回图片规则" />
  const canUpload = Boolean(onUpload)
  return (
    <div className="overflow-auto rounded border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>图片字段</TableHead>
            <TableHead>维度</TableHead>
            <TableHead>必填</TableHead>
            <TableHead>数量/类型</TableHead>
            <TableHead>尺寸</TableHead>
            <TableHead>当前状态</TableHead>
            {canUpload ? <TableHead className="w-[130px]">补齐</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((requirement) => {
            const status = requirementStatusLabel(requirement, checklist)
            const key = imageUploadKey(requirement.requirement_key, skcCode)
            const pending = uploadingKey === key
            const uploadBlocked = Boolean(uploadingKey)
            const progress = pending && uploadingState?.key === key ? uploadingState : null
            return (
              <TableRow key={requirement.requirement_key}>
                <TableCell className="font-medium">
                  <p>{requirement.name}</p>
                  {requirement.note ? <p className="mt-1 text-xs text-muted-foreground">{requirement.note}</p> : null}
                </TableCell>
                <TableCell>{requirement.level}</TableCell>
                <TableCell>{requirement.required === 1 ? "必填" : "可选/条件"}</TableCell>
                <TableCell>
                  <p>{requirement.count_rule}</p>
                  <p className="text-xs text-muted-foreground">{requirement.image_type}</p>
                </TableCell>
                <TableCell className="min-w-40 text-xs text-muted-foreground">{requirement.dimension_rule}</TableCell>
                <TableCell>
                  <Badge variant={status === "缺失" ? "destructive" : "outline"}>
                    {status}
                  </Badge>
                </TableCell>
                {canUpload ? (
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Label className={cn("cursor-pointer", uploadBlocked && "pointer-events-none opacity-60")}>
                        {pending ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <Upload className="mr-1 size-3" />
                        )}
                        {progress && progress.total > 1 ? `上传中 ${progress.current}/${progress.total}` : pending ? "上传中" : "上传补齐"}
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={uploadBlocked}
                          onChange={(event) => {
                            const files = Array.from(event.target.files ?? [])
                            event.currentTarget.value = ""
                            if (files.length === 0) return
                            onUpload?.({ files, skcCode, requirement })
                          }}
                        />
                      </Label>
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function DraftAssetCard({
  asset,
  onUpdate,
  onDelete,
  pending,
}: {
  asset: ListingAsset
  onUpdate: (assetId: number, values: { asset_type: string; image_sort: number; confirmed: number; note: string }) => void
  onDelete: (assetId: number) => void
  pending: boolean
}) {
  const [assetType, setAssetType] = useState(asset.asset_type)
  const [imageSort, setImageSort] = useState(String(asset.image_sort ?? 1))
  const [confirmed, setConfirmed] = useState(Number(asset.confirmed ?? 0) === 1)
  const [note, setNote] = useState(asset.note ?? "")
  const rawPayload = assetRawPayload(asset)

  // Keep the editable asset form aligned when the selected asset row changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setAssetType(asset.asset_type)
    setImageSort(String(asset.image_sort ?? 1))
    setConfirmed(Number(asset.confirmed ?? 0) === 1)
    setNote(asset.note ?? "")
  }, [asset])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="grid gap-3 rounded border bg-background p-2">
      <div className="grid gap-2 sm:grid-cols-[112px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded border bg-muted">
          <img
            src={assetSrc(asset)}
            alt={`${asset.skc_code || "SPU"} ${asset.asset_type}`}
            className="aspect-square h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{sourceKindLabel(asset.source_type)}</Badge>
            <Badge variant="outline">{assetTypeLabel(asset.asset_type)}</Badge>
            <Badge
              variant="outline"
              className={Number(asset.confirmed ?? 0) === 1
                ? "border-[#b9f4d8] bg-[#f4fff9] text-[#0f8a5f]"
                : "border-[#f4ddb3] bg-[#fff8e8] text-[#8a5a08]"}
            >
              {Number(asset.confirmed ?? 0) === 1 ? "已确认" : "待确认"}
            </Badge>
          </div>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <span>{formatDimensions(asset.width, asset.height)} · {formatBytes(asset.file_size)}</span>
            <span className="truncate">SKC：{asset.skc_code || "SPU"} · 排序 {asset.image_sort}</span>
            {rawPayload.product_asset_id ? <span>素材库 ID：{String(rawPayload.product_asset_id)}</span> : null}
            {asset.transform_error ? <span className="text-destructive">{asset.transform_error}</span> : null}
          </div>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-[160px_90px_minmax(0,1fr)_auto] md:items-end">
        <Label className="grid gap-1 text-xs text-muted-foreground">
          图片类型
          <Select value={assetType} onValueChange={setAssetType}>
            <SelectTrigger className="h-9 bg-white">
              <SelectValue placeholder="图片类型" />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_ASSET_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{assetTypeLabel(option)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Label>
        <Label className="grid gap-1 text-xs text-muted-foreground">
          排序
          <Input type="number" value={imageSort} onChange={(event) => setImageSort(event.target.value)} className="h-9" />
        </Label>
        <Label className="grid gap-1 text-xs text-muted-foreground">
          备注
          <Input value={note} onChange={(event) => setNote(event.target.value)} className="h-9" placeholder="图片说明" />
        </Label>
        <div className="flex items-center justify-end gap-2">
          <label className="flex items-center gap-2 whitespace-nowrap text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} />
            确认
          </label>
          <Button
            type="button"
            size="sm"
            onClick={() => onUpdate(asset.id, {
              asset_type: assetType,
              image_sort: Number(imageSort || asset.image_sort || 1),
              confirmed: confirmed ? 1 : 0,
              note,
            })}
            disabled={pending}
          >
            {pending ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Save className="mr-1 size-3" />}
            保存
          </Button>
          <ConfirmDialog
            title="删除草稿图片"
            description="只会从当前发布草稿移除这张图片，不会删除图片素材库或本地源文件。"
            confirmLabel="删除"
            variant="destructive"
            onConfirm={() => onDelete(asset.id)}
            trigger={(
              <Button type="button" size="icon" variant="outline" disabled={pending}>
                <Trash2 className="size-4" />
              </Button>
            )}
          />
        </div>
      </div>
    </div>
  )
}

function ImageRequirementManager({
  requirements,
  assets,
  checklist,
  skcCode,
  onUpload,
  uploadingKey,
  uploadingState,
  onOpenLibrary,
  onUpdateAsset,
  onDeleteAsset,
  pending,
}: {
  requirements: ImageRequirement[]
  assets: ListingAsset[]
  checklist?: ListingDetail["image_checklist"][number]
  skcCode?: string | null
  onUpload?: (params: ImageUploadParams) => void
  uploadingKey?: string | null
  uploadingState?: ImageUploadingState | null
  onOpenLibrary: (params: { requirement: ImageRequirement; skcCode?: string | null }) => void
  onUpdateAsset: (assetId: number, values: { asset_type: string; image_sort: number; confirmed: number; note: string }) => void
  onDeleteAsset: (assetId: number) => void
  pending: boolean
}) {
  const visible = requirements.filter((requirement) => requirement.show !== 0)
  if (visible.length === 0) return <EmptyState icon={ImageIcon} message="当前类目未返回图片规则" />
  return (
    <div className="space-y-3">
      {visible.map((requirement) => {
        const status = requirementStatusLabel(requirement, checklist)
        const matchedAssets = assets.filter((asset) => assetMatchesImageRequirement(asset, requirement))
        const key = imageUploadKey(requirement.requirement_key, skcCode)
        const uploading = uploadingKey === key
        const uploadBlocked = Boolean(uploadingKey)
        const progress = uploading && uploadingState?.key === key ? uploadingState : null
        return (
          <div key={`${skcCode || "SPU"}-${requirement.requirement_key}`} className="rounded border p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold">{requirement.name}</h4>
                  <Badge variant={status === "缺失" ? "destructive" : "outline"}>{status}</Badge>
                  <Badge variant="outline">{requirement.level}</Badge>
                  <Badge variant="outline">{requirement.required === 1 ? "必填" : "可选/条件"}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {requirement.count_rule} · {requirement.dimension_rule} · {requirement.size_rule}
                </p>
                {requirement.note ? <p className="mt-1 text-xs text-muted-foreground">{requirement.note}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenLibrary({ requirement, skcCode })}
                >
                  <Images className="mr-1 size-3" />
                  素材库选图
                </Button>
                {onUpload ? (
                  <Button asChild variant="outline" size="sm">
                    <Label className={cn("cursor-pointer", uploadBlocked && "pointer-events-none opacity-60")}>
                      {uploading ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Upload className="mr-1 size-3" />}
                      {progress && progress.total > 1 ? `上传中 ${progress.current}/${progress.total}` : uploading ? "上传中" : "本地上传"}
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadBlocked}
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? [])
                          event.currentTarget.value = ""
                          if (files.length === 0) return
                          onUpload({ files, skcCode, requirement })
                        }}
                      />
                    </Label>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-3">
              {matchedAssets.length ? (
                <div className="grid gap-3">
                  {matchedAssets.map((asset) => (
                    <DraftAssetCard
                      key={asset.id}
                      asset={asset}
                      onUpdate={onUpdateAsset}
                      onDelete={onDeleteAsset}
                      pending={pending}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                  当前字段还没有选择/上传图片。
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ImageLibraryPickerDialog({
  listingId,
  picker,
  onOpenChange,
  onSelect,
  pending,
}: {
  listingId: string | undefined
  picker: ImageLibraryPickerState
  onOpenChange: (open: boolean) => void
  onSelect: (asset: ImageCandidate) => void
  pending: boolean
}) {
  const [search, setSearch] = useState("")
  const [onlyCompliant, setOnlyCompliant] = useState(false)
  const [selectedSourceKinds, setSelectedSourceKinds] = useState<string[]>(["PICTURE"])
  const [selectedSourcePlaces, setSelectedSourcePlaces] = useState<string[]>(DEFAULT_IMAGE_SOURCE_PLACES)
  const { data, isLoading } = useImageCandidates(
    listingId,
    picker,
    search,
    onlyCompliant,
    selectedSourceKinds,
    selectedSourcePlaces,
  )
  const sourcePlaceOptions = data?.source_places?.length
    ? data.source_places.map((item) => ({ value: item.source_place, label: sourcePlaceLabel(item.source_place), count: item.count }))
    : DEFAULT_IMAGE_SOURCE_PLACES.map((place) => ({ value: place, label: sourcePlaceLabel(place), count: 0 }))

  const pickerResetKey = picker
    ? `${picker.requirement.requirement_key}:${picker.skcCode ?? ""}`
    : ""

  // Reset picker filters for each new image requirement/SKC target.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (picker) {
      setSearch("")
      setOnlyCompliant(false)
      setSelectedSourceKinds(["PICTURE"])
      setSelectedSourcePlaces(DEFAULT_IMAGE_SOURCE_PLACES)
    }
  }, [picker, pickerResetKey])
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleSourceKind(value: string) {
    setSelectedSourceKinds((current) => {
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
      return next.length ? next : ["PICTURE"]
    })
  }

  function toggleSourcePlace(value: string) {
    setSelectedSourcePlaces((current) => {
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
      return next.length ? next : DEFAULT_IMAGE_SOURCE_PLACES
    })
  }

  return (
    <Dialog open={Boolean(picker)} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100vh-48px)] w-[min(1680px,calc(100vw-72px))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden p-6 sm:max-w-[min(1680px,calc(100vw-72px))]">
        <DialogHeader className="pr-10">
          <DialogTitle>从图片素材库选择</DialogTitle>
          <DialogDescription>
            {picker ? `${picker.skcCode || "SPU"} · ${picker.requirement.name} · ${picker.requirement.dimension_rule}` : "选择当前草稿关联素材"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-3 overflow-hidden">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 overflow-x-auto rounded border bg-muted/30 px-3 py-2">
              <span className="shrink-0 text-xs font-medium text-muted-foreground">图片类型</span>
              {IMAGE_SOURCE_KIND_OPTIONS.map((option) => (
                <label key={option.value} className="flex shrink-0 items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
                  <Checkbox
                    checked={selectedSourceKinds.includes(option.value)}
                    onCheckedChange={() => toggleSourceKind(option.value)}
                  />
                  {option.label}
                </label>
              ))}
              <span className="shrink-0 text-xs text-muted-foreground">默认只看商品图；商详截图、商详模块需手动勾选。</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto rounded border bg-muted/30 px-3 py-2">
              <span className="shrink-0 text-xs font-medium text-muted-foreground">来源平台</span>
              {sourcePlaceOptions.map((option) => (
                <label key={option.value} className="flex shrink-0 items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
                  <Checkbox
                    checked={selectedSourcePlaces.includes(option.value)}
                    onCheckedChange={() => toggleSourcePlace(option.value)}
                  />
                  {option.label}
                  {option.count ? <span className="text-xs text-muted-foreground">{option.count}</span> : null}
                </label>
              ))}
              <span className="shrink-0 text-xs text-muted-foreground">默认勾选 TMALL 与 VIP 唯品会。</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-[560px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索文件名、图片类型、模块名"
                className="h-10 pl-9"
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={onlyCompliant ? "default" : "outline"}
                onClick={() => setOnlyCompliant(true)}
                className="h-10 whitespace-nowrap"
              >
                <FilterX className="mr-2 size-4" />
                一键剔除不符合尺寸/大小
              </Button>
              <Button type="button" variant="outline" onClick={() => setOnlyCompliant(false)} className="h-10 whitespace-nowrap">
                显示全部候选
              </Button>
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-390px)] min-h-[360px] rounded border">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">正在读取素材库...</div>
            ) : data?.items.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 p-4">
                {data.items.map((asset) => (
                  <div key={asset.id} className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
                    <div className="aspect-square bg-muted/70 p-2">
                      <img
                        src={asset.preview_url || asset.normalized_url}
                        alt={asset.file_name ?? asset.asset_type ?? "素材库图片"}
                        className="h-full w-full rounded object-contain"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{sourcePlaceLabel(asset.place)}</Badge>
                        <Badge variant="outline">{sourceKindLabel(asset.source_kind)}</Badge>
                        <Badge variant="outline">{assetTypeLabel(asset.recommended_asset_type)}</Badge>
                        <Badge variant="outline" className={complianceClass(asset.compliance.status)}>
                          {asset.compliance.status === "PASS" ? "符合" : asset.compliance.status === "WARN" ? "待确认" : "不符合"}
                        </Badge>
                      </div>
                      <div className="grid gap-1 text-xs text-muted-foreground">
                        <span>{formatDimensions(asset.width, asset.height)} · {formatBytes(asset.file_size)}</span>
                        <span className="truncate">{asset.skc_code || asset.module_name || asset.place || asset.file_name || `#${asset.id}`}</span>
                        {asset.compliance.reasons.length ? (
                          <span className={asset.compliance.status === "FAIL" ? "line-clamp-2 text-destructive" : "line-clamp-2"}>
                            {asset.compliance.reasons.join("；")}
                          </span>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        className="mt-auto w-full whitespace-nowrap"
                        size="sm"
                        onClick={() => onSelect(asset)}
                        disabled={pending}
                      >
                        {pending ? <Loader2 className="mr-1 size-3 animate-spin" /> : <ImageIcon className="mr-1 size-3" />}
                        选入草稿
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="当前款没有匹配的素材候选" icon={Images} />
            )}
          </ScrollArea>
        </div>
        <DialogFooter className="pt-1">
          <DialogClose asChild>
            <Button variant="outline">关闭</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SkuBatchFillBar({
  skus,
  selectedSkuIds,
  onApply,
}: {
  skus: ListingDetail["skus"]
  selectedSkuIds: Set<number>
  onApply: (skuIds: number[], values: SkuBatchFillDraft) => void
}) {
  const [draft, setDraft] = useState<SkuBatchFillDraft>({
    costPrice: "",
    currency: "CNY",
    packageWeightG: "",
    packageLengthCm: "",
    packageWidthCm: "",
    packageHeightCm: "",
  })
  const selectedIds = skus.filter((sku) => selectedSkuIds.has(sku.id)).map((sku) => sku.id)
  const allIds = skus.map((sku) => sku.id)
  const hasValue = Object.entries(draft).some(([key, value]) => key === "currency" ? value && value !== "CNY" : Boolean(value))

  function update(key: keyof SkuBatchFillDraft, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="rounded border bg-muted/30 p-3">
      <div className="grid gap-2 md:grid-cols-6">
        <Input type="number" value={draft.costPrice} onChange={(event) => update("costPrice", event.target.value)} placeholder="供货价" className="h-9" />
        <Input value={draft.currency} onChange={(event) => update("currency", event.target.value)} placeholder="币种" className="h-9" />
        <Input type="number" value={draft.packageWeightG} onChange={(event) => update("packageWeightG", event.target.value)} placeholder="SKU毛重/g" className="h-9" />
        <Input type="number" value={draft.packageLengthCm} onChange={(event) => update("packageLengthCm", event.target.value)} placeholder="包装长/cm" className="h-9" />
        <Input type="number" value={draft.packageWidthCm} onChange={(event) => update("packageWidthCm", event.target.value)} placeholder="包装宽/cm" className="h-9" />
        <Input type="number" value={draft.packageHeightCm} onChange={(event) => update("packageHeightCm", event.target.value)} placeholder="包装高/cm" className="h-9" />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>只填有值的字段；批量填充后仍需点击页面顶部“保存草稿”落库。</span>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!hasValue || selectedIds.length === 0} onClick={() => onApply(selectedIds, draft)}>
            填充已勾选尺码（{selectedIds.length}）
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!hasValue || allIds.length === 0} onClick={() => onApply(allIds, draft)}>
            填充当前 SKC 全部尺码
          </Button>
        </div>
      </div>
    </div>
  )
}

function CategoryTreeDialog({
  open,
  onOpenChange,
  currentCategory,
  onSelect,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentCategory: string | null
  onSelect: (category: CategoryTreeItem) => void
  pending: boolean
}) {
  const [parentCategoryId, setParentCategoryId] = useState<number | null>(null)
  const [path, setPath] = useState<CategoryTreeItem[]>([])
  const [search, setSearch] = useState("")
  const { data: categoryTree, isLoading } = useCategoryTree(parentCategoryId, search)
  const items = categoryTree?.items ?? []

  function enterCategory(item: CategoryTreeItem) {
    if (item.last_category === 1) {
      onSelect(item)
      return
    }
    setSearch("")
    setPath((prev) => [...prev, item])
    setParentCategoryId(item.category_id)
  }

  function jumpTo(index: number) {
    if (index < 0) {
      setPath([])
      setParentCategoryId(null)
      return
    }
    const nextPath = path.slice(0, index + 1)
    setPath(nextPath)
    setParentCategoryId(nextPath[nextPath.length - 1]?.category_id ?? null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="size-5" />
            类目树选择
          </DialogTitle>
          <DialogDescription>
            在弹窗里按多级类目逐层进入，选择 SHEIN 叶子类目后会刷新草稿字段、图片规则和尺码模板。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded border px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索 SHEIN 类目名称或路径"
              className="border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" className="rounded border px-2 py-1" onClick={() => jumpTo(-1)}>
              根类目
            </button>
            {path.map((item, index) => (
              <button
                key={`${item.category_id}-${index}`}
                type="button"
                className="inline-flex items-center gap-1 rounded border px-2 py-1"
                onClick={() => jumpTo(index)}
              >
                <ChevronRight className="size-3" />
                {item.category_name}
              </button>
            ))}
          </div>
          <div className="rounded border">
            <ScrollArea className="h-[430px]">
              <div className="divide-y">
                {isLoading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">加载类目树...</div>
                ) : items.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">没有匹配的 SHEIN 类目</div>
                ) : (
                  items.map((item) => (
                    <button
                      key={`${item.category_id}-${item.product_type_id}`}
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/60"
                      onClick={() => enterCategory(item)}
                      disabled={pending}
                    >
                      <FolderTree className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{item.category_name}</span>
                          <Badge variant={item.last_category === 1 ? "default" : "outline"}>
                            {item.last_category === 1 ? "叶子类目" : `${item.child_count ?? 0} 子类`}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{item.path}</p>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.category_id}/{item.product_type_id}
                      </span>
                      {item.last_category !== 1 ? <ChevronRight className="size-4 text-muted-foreground" /> : null}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          <p className="text-xs text-muted-foreground">当前类目：{currentCategory || "未选择"}</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">关闭</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function PrePublishDraftDetailPage() {
  const { listingId } = useParams()
  const queryClient = useQueryClient()
  const { data, isLoading } = useDraftDetail(listingId)
  const [manualValues, setManualValues] = useState<Record<string, string>>({})
  const [selectedSkcIds, setSelectedSkcIds] = useState<Set<number>>(new Set())
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<number>>(new Set())
  const [confirmedSkcIds, setConfirmedSkcIds] = useState<Set<number>>(new Set())
  const [skuSizeValues, setSkuSizeValues] = useState<Record<number, string>>({})
  const [skuWeightValues, setSkuWeightValues] = useState<Record<number, string>>({})
  const [skuCommercialValues, setSkuCommercialValues] = useState<Record<number, SkuCommercialDraft>>({})
  const [skcColorValues, setSkcColorValues] = useState<Record<number, string>>({})
  const [manualSizeChartValues, setManualSizeChartValues] = useState<Record<number, Record<string, string>>>({})
  const [folderPath, setFolderPath] = useState("/Users/xingyicheng/Downloads/20112210410530435")
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [imageImportDialogOpen, setImageImportDialogOpen] = useState(false)
  const [imageLibraryPicker, setImageLibraryPicker] = useState<ImageLibraryPickerState>(null)
  const [uploadingImageState, setUploadingImageState] = useState<ImageUploadingState | null>(null)
  const uploadingImageKey = uploadingImageState?.key ?? null

  const fields = useMemo(
    () => data?.readiness.field_groups.flatMap((group) => group.fields) ?? [],
    [data],
  )
  const colorAttribute = useMemo(
    () => data?.sale_attributes.find((attribute) => attribute.attribute_label === 1 && attribute.attribute_name.includes("颜色")),
    [data],
  )
  const sizeAttribute = useMemo(
    () => data?.sale_attributes.find((attribute) => attribute.attribute_name.includes("尺寸")),
    [data],
  )
  const skcGroups = useMemo(() => {
    if (!data) return []
    return data.skcs.map((skc) => ({
      skc,
      skus: data.skus.filter((sku) => sku.skc_code === skc.skc_code),
      assets: data.assets.filter((asset) => asset.skc_code === skc.skc_code),
    }))
  }, [data])
  const selectedSkuIdsBySkc = useMemo(() => {
    if (!data) return new Map<string, number[]>()
    const map = new Map<string, number[]>()
    for (const sku of data.skus) {
      if (!selectedSkuIds.has(sku.id)) continue
      map.set(sku.skc_code, [...(map.get(sku.skc_code) ?? []), sku.id])
    }
    return map
  }, [data, selectedSkuIds])
  const selectedPublishSizeByToken = useMemo(() => {
    const map = new Map<string, { publishSize: string; localSize: string }>()
    if (!data) return map
    for (const sku of data.skus) {
      if (!selectedSkuIds.has(sku.id)) continue
      const selected = selectedOption(sizeAttribute?.values, skuSizeValues[sku.id] ?? "")
      const publishSize = selected?.attribute_value ?? skuSizeValues[sku.id] ?? sku.shein_size_value ?? sku.size_name ?? ""
      const localSize = sku.size_name ?? publishSize
      for (const token of sizeMatchTokens(localSize)) {
        if (!map.has(token)) map.set(token, { publishSize, localSize })
      }
    }
    return map
  }, [data, selectedSkuIds, sizeAttribute?.values, skuSizeValues])
  const sizeChartAttributes = data?.size_chart_attributes ?? []
  const manualSizeChartRows = useMemo(() => {
    if (!data) return []
    return data.skus
      .filter((sku) => selectedSkuIds.has(sku.id))
      .map((sku) => {
        const sizePayload = parsePayload(sku.size_attribute_payload_json)
        const selected = selectedOption(sizeAttribute?.values, skuSizeValues[sku.id] ?? "")
        const publishSize = selected?.attribute_value ?? skuSizeValues[sku.id] ?? sku.shein_size_value ?? sku.size_name ?? ""
        return {
          sku,
          localSize: sku.size_name ?? publishSize,
          publishSize,
          relateSaleAttributeValueId: selected?.attribute_value_id ?? (Number(sizePayload.attribute_value_id ?? 0) || null),
        }
      })
  }, [data, selectedSkuIds, sizeAttribute?.values, skuSizeValues])
  const dimensionGroups = data?.dimension_field_groups ?? data?.readiness.dimension_field_groups ?? []
  const skcImageRequirements = data?.image_requirements.filter((requirement) => requirement.level === "SKC" && requirement.show !== 0) ?? []
  const spuImageRequirements = data?.image_requirements.filter((requirement) => requirement.level === "SPU" && requirement.show !== 0) ?? []
  const focusedFieldGroups = publishFocusedGroups(
    dimensionGroups.find((group) => group.dimension === "SPU")?.groups ?? data?.readiness.field_groups ?? [],
  )
  const fieldValidationIssues = issuesByFieldKey(data?.validation_issues ?? [], focusedFieldGroups)
  const imageValidationIssues = issuesForKeys(data?.validation_issues ?? [], ["SKC 图片", "skc_image"])
  const skuCommercialValidationIssues = issuesForKeys(data?.validation_issues ?? [], ["产品毛重/g", "package_weight"])
  const openApiSuitCategoryBlocked = Boolean(
    data?.listing.platform_category_name?.includes("套装")
    || data?.listing.platform_category_path?.includes("套装"),
  )

  // Seed local edit state from the loaded draft detail before the user edits it.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!data) return
    setManualValues(Object.fromEntries(fields.map((field) => [field.key, toInputValue(field.value)])))
    setSelectedSkcIds(new Set(data.skcs.filter((skc) => Number(skc.selected_for_publish ?? 1) === 1).map((skc) => skc.id)))
    setSelectedSkuIds(new Set(data.skus.filter((sku) => Number(sku.selected_for_publish ?? 1) === 1).map((sku) => sku.id)))
    setConfirmedSkcIds(new Set(data.skcs.filter((skc) => Number(skc.image_confirmed ?? 0) === 1).map((skc) => skc.id)))
    setSkuSizeValues(Object.fromEntries(data.skus.map((sku) => {
      const payload = parsePayload(sku.size_attribute_payload_json)
      return [sku.id, payload.attribute_value_id ? String(payload.attribute_value_id) : sku.shein_size_value || sku.size_name || ""]
    })))
    setSkuWeightValues(Object.fromEntries(data.skus.map((sku) => [sku.id, sku.package_weight_g == null ? "" : String(sku.package_weight_g)])))
    setSkuCommercialValues(Object.fromEntries(data.skus.map((sku) => [sku.id, {
      costPrice: sku.cost_price == null ? "" : String(sku.cost_price),
      currency: sku.currency || "CNY",
      packageLengthCm: sku.package_length_cm == null ? "" : String(sku.package_length_cm),
      packageWidthCm: sku.package_width_cm == null ? "" : String(sku.package_width_cm),
      packageHeightCm: sku.package_height_cm == null ? "" : String(sku.package_height_cm),
    }])))
    setSkcColorValues(Object.fromEntries(data.skcs.map((skc) => {
      const payload = parsePayload(skc.color_attribute_payload_json)
      return [skc.id, payload.attribute_value_id ? String(payload.attribute_value_id) : String(payload.attribute_value ?? "")]
    })))
    setManualSizeChartValues(Object.fromEntries((data.manual_size_chart?.rows ?? []).map((row) => [
      row.sku_id,
      Object.fromEntries(Object.entries(row.values ?? {}).map(([key, value]) => [key, toInputValue(value)])),
    ])))
  }, [data, fields])
  /* eslint-enable react-hooks/set-state-in-effect */

  function buildSaveDraftPayload() {
    return {
      fields: fields.map((field) => ({
        field_key: field.key,
        field_label: field.label,
        field_value: manualValues[field.key] ?? toInputValue(field.value),
        source: "MANUAL",
      })),
      selected_skc_ids: Array.from(selectedSkcIds),
      selected_sku_ids: Array.from(selectedSkuIds),
      sku_size_values: data?.skus.map((sku) => {
        const selected = selectedOption(sizeAttribute?.values, skuSizeValues[sku.id] ?? "")
        return {
          sku_id: sku.id,
          shein_size_value: selected?.attribute_value ?? skuSizeValues[sku.id] ?? sku.shein_size_value ?? sku.size_name ?? "",
          attribute_value_id: selected?.attribute_value_id ?? null,
          attribute_value: selected?.attribute_value ?? skuSizeValues[sku.id] ?? "",
        }
      }) ?? [],
      sku_weight_values: data?.skus.map((sku) => ({
        sku_id: sku.id,
        package_weight_g: Number(skuWeightValues[sku.id] ?? sku.package_weight_g ?? 0),
      })) ?? [],
      sku_commercial_values: data?.skus.map((sku) => {
        const commercial = skuCommercialValues[sku.id]
        return {
          sku_id: sku.id,
          cost_price: commercial?.costPrice ?? sku.cost_price ?? "",
          currency: commercial?.currency ?? sku.currency ?? "CNY",
          package_length_cm: commercial?.packageLengthCm ?? sku.package_length_cm ?? "",
          package_width_cm: commercial?.packageWidthCm ?? sku.package_width_cm ?? "",
          package_height_cm: commercial?.packageHeightCm ?? sku.package_height_cm ?? "",
        }
      }) ?? [],
      skc_color_values: data?.skcs.map((skc) => ({
        skc_id: skc.id,
        attribute_value_id: selectedOption(colorAttribute?.values, skcColorValues[skc.id] ?? "")?.attribute_value_id ?? null,
        attribute_value: selectedOption(colorAttribute?.values, skcColorValues[skc.id] ?? "")?.attribute_value ?? skcColorValues[skc.id] ?? "",
      })) ?? [],
      manual_size_chart_rows: sizeChartAttributes.length
        ? manualSizeChartRows.map(({ sku, localSize, publishSize, relateSaleAttributeValueId }) => ({
          sku_id: sku.id,
          sku_code: sku.sku_code,
          size_name: localSize,
          shein_size_value: publishSize,
          relate_sale_attribute_value_id: relateSaleAttributeValueId,
          values: manualSizeChartValues[sku.id] ?? {},
        }))
        : [],
      image_confirmed_skc_ids: Array.from(confirmedSkcIds),
    }
  }

  function updateSkuCommercialValue(skuId: number, key: keyof SkuCommercialDraft, value: string) {
    const emptyCommercial: SkuCommercialDraft = {
      costPrice: "",
      currency: "CNY",
      packageLengthCm: "",
      packageWidthCm: "",
      packageHeightCm: "",
    }
    setSkuCommercialValues((prev) => ({
      ...prev,
      [skuId]: {
        ...emptyCommercial,
        ...prev[skuId],
        [key]: value,
      },
    }))
  }

  function applySkuBatchFill(skuIds: number[], values: SkuBatchFillDraft) {
    if (skuIds.length === 0) return
    const idSet = new Set(skuIds)
    if (values.packageWeightG) {
      setSkuWeightValues((prev) => {
        const next = { ...prev }
        for (const skuId of idSet) next[skuId] = values.packageWeightG
        return next
      })
    }
    setSkuCommercialValues((prev) => {
      const next = { ...prev }
      for (const skuId of idSet) {
        const current = next[skuId] ?? {
          costPrice: "",
          currency: "CNY",
          packageLengthCm: "",
          packageWidthCm: "",
          packageHeightCm: "",
        }
        next[skuId] = {
          ...current,
          costPrice: values.costPrice || current.costPrice,
          currency: values.currency || current.currency,
          packageLengthCm: values.packageLengthCm || current.packageLengthCm,
          packageWidthCm: values.packageWidthCm || current.packageWidthCm,
          packageHeightCm: values.packageHeightCm || current.packageHeightCm,
        }
      }
      return next
    })
    toast.success(`已批量填充 ${skuIds.length} 个 SKU，保存草稿后生效`)
  }

  function updateManualSizeChartValue(skuId: number, attributeId: number, value: string) {
    setManualSizeChartValues((prev) => ({
      ...prev,
      [skuId]: {
        ...(prev[skuId] ?? {}),
        [String(attributeId)]: value,
      },
    }))
  }

  function manualSizeChartTemplateRows(): SpreadsheetRow[] {
    return manualSizeChartRows.map(({ sku, localSize, publishSize, relateSaleAttributeValueId }) => {
      const values = manualSizeChartValues[sku.id] ?? {}
      return {
        SKU编码: sku.sku_code,
        商品档案尺码: localSize,
        SHEIN发布尺码: publishSize,
        SHEIN尺码值ID: relateSaleAttributeValueId ?? "",
        ...Object.fromEntries(sizeChartAttributes.map((attribute) => [
          attribute.attribute_name,
          values[String(attribute.attribute_id)] ?? "",
        ])),
      }
    })
  }

  function downloadManualSizeChartTemplate() {
    const rows = manualSizeChartTemplateRows()
    if (rows.length === 0) {
      toast.error("请先勾选要发布的 SKU")
      return
    }
    exportSpreadsheet("SHEIN类目尺码表导入模板.xlsx", rows)
  }

  function spreadsheetText(row: SpreadsheetRow, keys: Array<string | null | undefined>) {
    for (const key of keys) {
      if (!key) continue
      const value = row[key]
      const text = String(value ?? "").trim()
      if (text) return text
    }
    return ""
  }

  async function importManualSizeChartTemplate(file: File) {
    const rows = await readSpreadsheetFile(file)
    let filled = 0
    setManualSizeChartValues((prev) => {
      const next = { ...prev }
      for (const row of rows) {
        const skuCode = spreadsheetText(row, ["SKU编码", "sku_code", "SKU"])
        const publishSize = spreadsheetText(row, ["SHEIN发布尺码", "发布尺码", "尺码"])
        const target = manualSizeChartRows.find(({ sku, publishSize: currentPublishSize, localSize }) =>
          sku.sku_code === skuCode || currentPublishSize === publishSize || localSize === publishSize,
        )
        if (!target) continue
        const values = { ...(next[target.sku.id] ?? {}) }
        let rowFilled = false
        for (const attribute of sizeChartAttributes) {
          const value = spreadsheetText(row, [
            attribute.attribute_name,
            attribute.attribute_name_en,
            String(attribute.attribute_id),
          ])
          if (!value) continue
          values[String(attribute.attribute_id)] = value
          rowFilled = true
        }
        if (rowFilled) {
          next[target.sku.id] = values
          filled += 1
        }
      }
      return next
    })
    toast.success(`导入填充 ${filled} 行尺码表，保存草稿后生效`)
  }

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      api.post(`/pre-publish/drafts/${listingId}/save`, buildSaveDraftPayload()),
    onSuccess: () => {
      toast.success("保存草稿成功，已生成新版本")
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
    },
    onError: () => toast.error("保存草稿失败"),
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/pre-publish/drafts/${listingId}/save`, buildSaveDraftPayload())
      return api.post(`/pre-publish/drafts/${listingId}/publish`, {
        confirm: true,
        skc_codes: skcGroups
          .filter((group) => selectedSkcIds.has(group.skc.id))
          .map((group) => group.skc.skc_code),
      })
    },
    onSuccess: () => {
      toast.success("已提交 SHEIN 发布，状态已回写")
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
      queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "SHEIN 发布失败"
      toast.error(message)
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
    },
  })

  const publishing = publishMutation.isPending || saveDraftMutation.isPending

  const aiEnrichMutation = useMutation({
    mutationFn: (mode: "all" | "attributes" | "category" | "title") =>
      api.post(`/pre-publish/drafts/${listingId}/ai-enrich`, { mode }),
    onSuccess: (_, mode) => {
      toast.success(
        mode === "category"
          ? "AI 转换类目完成"
          : mode === "title"
            ? "AI 翻译标题完成"
            : "AI 推荐补齐空字段完成",
      )
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
    },
    onError: () => toast.error("AI 处理失败"),
  })

  const aiFieldMutation = useMutation({
    mutationFn: (field: FillField) =>
      api.post<{ field?: { field_key: string; field_label: string; field_value: string } }>(
        `/pre-publish/drafts/${listingId}/ai-field`,
        { field_key: field.key },
      ),
    onSuccess: (result, field) => {
      const fieldValue = result.field?.field_value ?? ""
      if (fieldValue) {
        setManualValues((prev) => ({ ...prev, [field.key]: fieldValue }))
      }
      toast.success(`${field.label} 已 AI 生成`)
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "AI 生成字段失败"
      toast.error(message)
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: (category: CategoryTreeItem) =>
      api.patch(`/pre-publish/drafts/${listingId}/category`, {
        category_id: category.category_id,
        product_type_id: category.product_type_id,
      }),
    onSuccess: () => {
      toast.success("SHEIN 类目已更新，草稿字段已刷新")
      setCategoryDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
    },
    onError: () => toast.error("更新 SHEIN 类目失败"),
  })

  const convertOpenApiSingleItemMutation = useMutation({
    mutationFn: () => api.post<{
      category?: { category_name?: string }
      title_cn?: string
      title_en?: string
    }>(`/pre-publish/drafts/${listingId}/convert-openapi-single-item`, {}),
    onSuccess: (result) => {
      toast.success(`已转为 OpenAPI 单品发布：${result.category?.category_name ?? "非套装类目"}`)
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "转换 OpenAPI 单品发布失败"
      toast.error(message)
    },
  })

  const importImagesMutation = useMutation({
    mutationFn: () =>
      api.post<{ imported_count?: number }>(`/pre-publish/drafts/${listingId}/images/import-folder`, {
        folder_path: folderPath,
      }),
    onSuccess: (result: { imported_count?: number }) => {
      toast.success(`导入本地图片目录完成：${result.imported_count ?? 0} 张`)
      setImageImportDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
    },
    onError: () => toast.error("图片目录导入失败"),
  })

  const uploadImageMutation = useMutation({
    mutationFn: async ({ files, skcCode, requirement }: ImageUploadParams) => {
      if (files.length === 0) throw new Error("请选择要上传的图片")
      const key = imageUploadKey(requirement.requirement_key, skcCode)
      let lastResult: unknown = null
      for (const [index, file] of files.entries()) {
        setUploadingImageState({ key, current: index + 1, total: files.length, fileName: file.name })
        const form = new FormData()
        form.append("file", file)
        form.append("requirement_key", requirement.requirement_key)
        if (skcCode) form.append("skc_code", skcCode)
        const response = await fetch(`/api/pre-publish/drafts/${listingId}/images/upload`, {
          method: "POST",
          body: form,
        })
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { message?: string } | null
          const prefix = files.length > 1 ? `第 ${index + 1}/${files.length} 张 ${file.name}：` : ""
          throw new Error(`${prefix}${body?.message || "图片上传失败"}`)
        }
        lastResult = await response.json()
      }
      return { uploadedCount: files.length, lastResult }
    },
    onMutate: ({ files, skcCode, requirement }) => {
      setUploadingImageState({
        key: imageUploadKey(requirement.requirement_key, skcCode),
        current: files.length > 0 ? 1 : 0,
        total: files.length,
        fileName: files[0]?.name ?? null,
      })
    },
    onSuccess: ({ uploadedCount }) => {
      toast.success(
        uploadedCount > 1
          ? `已批量上传 ${uploadedCount} 张图片到草稿素材，发布前可继续确认`
          : "图片已上传到草稿素材，发布前可继续确认",
      )
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "图片上传失败"
      toast.error(message)
    },
    onSettled: () => {
      setUploadingImageState(null)
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
    },
  })

  const addLibraryImageMutation = useMutation({
    mutationFn: ({ asset, picker }: { asset: ImageCandidate; picker: NonNullable<ImageLibraryPickerState> }) =>
      api.post(`/pre-publish/drafts/${listingId}/images/from-library`, {
        asset_id: asset.id,
        skc_code: picker.skcCode ?? null,
        requirement_key: picker.requirement.requirement_key,
        asset_type: asset.recommended_asset_type,
      }),
    onSuccess: () => {
      toast.success("已从素材库选入草稿图片")
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "素材库选图失败"
      toast.error(message)
    },
  })

  const updateImageAssetMutation = useMutation({
    mutationFn: ({ assetId, values }: {
      assetId: number
      values: { asset_type: string; image_sort: number; confirmed: number; note: string }
    }) => api.patch(`/pre-publish/drafts/${listingId}/images/${assetId}`, values),
    onSuccess: () => {
      toast.success("草稿图片已更新")
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
    },
    onError: () => toast.error("更新草稿图片失败"),
  })

  const deleteImageAssetMutation = useMutation({
    mutationFn: (assetId: number) => api.delete(`/pre-publish/drafts/${listingId}/images/${assetId}`),
    onSuccess: () => {
      toast.success("草稿图片已删除")
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
    },
    onError: () => toast.error("删除草稿图片失败"),
  })

  const snapshotMutation = useMutation({
    mutationFn: () => api.post(`/pre-publish/drafts/${listingId}/versions`),
    onSuccess: () => {
      toast.success("版本快照已创建")
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
    },
  })

  function toggle(setter: (value: Set<number>) => void, current: Set<number>, id: number) {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  function toggleSkcSelection(group: { skc: ListingDetail["skcs"][number]; skus: ListingDetail["skus"] }) {
    const nextSkcs = new Set(selectedSkcIds)
    const nextSkus = new Set(selectedSkuIds)
    const shouldSelect = !nextSkcs.has(group.skc.id)
    if (shouldSelect) {
      nextSkcs.add(group.skc.id)
      group.skus.forEach((sku) => nextSkus.add(sku.id))
    } else {
      nextSkcs.delete(group.skc.id)
      group.skus.forEach((sku) => nextSkus.delete(sku.id))
    }
    setSelectedSkcIds(nextSkcs)
    setSelectedSkuIds(nextSkus)
  }

  function toggleSkuWithinSkc(group: { skc: ListingDetail["skcs"][number]; skus: ListingDetail["skus"] }, skuId: number) {
    const nextSkus = new Set(selectedSkuIds)
    if (nextSkus.has(skuId)) nextSkus.delete(skuId)
    else nextSkus.add(skuId)
    const selectedInGroup = group.skus.some((sku) => nextSkus.has(sku.id))
    const nextSkcs = new Set(selectedSkcIds)
    if (selectedInGroup) nextSkcs.add(group.skc.id)
    else nextSkcs.delete(group.skc.id)
    setSelectedSkuIds(nextSkus)
    setSelectedSkcIds(nextSkcs)
  }

  if (isLoading) {
    return <PageContainer><div className="py-16 text-center text-sm text-muted-foreground">加载草稿详情...</div></PageContainer>
  }

  if (!data) {
    return <PageContainer><EmptyState message="草稿不存在" /></PageContainer>
  }

  const spuDimension = dimensionGroups.find((group) => group.dimension === "SPU")
  const skcDimension = dimensionGroups.find((group) => group.dimension === "SKC")
  const skuDimension = dimensionGroups.find((group) => group.dimension === "SKU")

  return (
    <PageContainer className="space-y-5 px-4 py-4 md:px-6">
      <PageHeader
        compact
        title="上新填写工作台"
        description={`${data.listing.spu_code} · ${data.listing.title || data.readiness.field_groups.flatMap((group) => group.fields).find((field) => field.key === "title_cn")?.value || "发布草稿"}`}
        className="rounded-lg px-5 py-5"
        actionsClassName="lg:max-w-[760px] [&>button]:h-9 [&>button]:px-3 [&>a]:h-9 [&>a]:px-3"
      >
        <Button asChild variant="outline">
          <Link to="/pre-publish-validation">
            <ArrowLeft className="mr-2 size-4" />
            返回草稿箱
          </Link>
        </Button>
        <Button
          variant="outline"
          className="border-[#b9f4d8] bg-[#eafbf2] text-[#0b8f5a] hover:bg-[#d4fae8] hover:text-[#08764b]"
          onClick={() => aiEnrichMutation.mutate("all")}
          disabled={aiEnrichMutation.isPending}
        >
          {aiEnrichMutation.isPending && aiEnrichMutation.variables === "all" ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 size-4" />
          )}
          AI 推荐补齐空字段
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreHorizontal className="mr-2 size-4" />
              更多操作
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>草稿辅助操作</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => aiEnrichMutation.mutate("category")}
              disabled={aiEnrichMutation.isPending}
            >
              <Bot className="size-4" />
              AI 转换类目
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => aiEnrichMutation.mutate("title")}
              disabled={aiEnrichMutation.isPending}
            >
              <Languages className="size-4" />
              AI 翻译标题
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setCategoryDialogOpen(true)}>
              <FolderTree className="size-4" />
              类目树选择
            </DropdownMenuItem>
            {openApiSuitCategoryBlocked ? (
              <DropdownMenuItem
                onSelect={() => convertOpenApiSingleItemMutation.mutate()}
                disabled={convertOpenApiSingleItemMutation.isPending}
              >
                {convertOpenApiSingleItemMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Layers3 className="size-4" />
                )}
                转为 OpenAPI 单品发布
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={() => snapshotMutation.mutate()}
              disabled={snapshotMutation.isPending}
            >
              <FileClock className="size-4" />
              创建版本快照
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setImageImportDialogOpen(true)}>
              <FolderUp className="size-4" />
              导入图片目录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
          {saveDraftMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          保存草稿
        </Button>
        <ConfirmDialog
          title="发布到 SHEIN"
          description="系统会先整体保存当前草稿，再将已勾选的 SKC 和 SKU 发布尺码提交到 SHEIN 后台。"
          confirmLabel="发布到 SHEIN"
          variant="destructive"
          onConfirm={() => publishMutation.mutate()}
          trigger={(
            <Button disabled={publishing}>
              {publishing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              发布到 SHEIN
            </Button>
          )}
        />
      </PageHeader>

      <Dialog open={imageImportDialogOpen} onOpenChange={setImageImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入本地图片目录</DialogTitle>
            <DialogDescription>按文件名和目录名匹配 SKC；示例 20112210410530435 会匹配款色 30435。</DialogDescription>
          </DialogHeader>
          <Label className="grid gap-2">
            图片目录
            <Input value={folderPath} onChange={(event) => setFolderPath(event.target.value)} />
          </Label>
          <Button onClick={() => importImagesMutation.mutate()} disabled={importImagesMutation.isPending}>
            {importImagesMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            导入本地图片目录
          </Button>
        </DialogContent>
      </Dialog>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{data.listing.platform}</Badge>
                <Badge variant={data.listing.blocker_count > 0 ? "destructive" : "outline"}>
                  阻断项 {formatNumber(data.listing.blocker_count)}
                </Badge>
                <Badge variant="outline">{data.listing.skc_count} 款色 / {data.listing.sku_count} SKU</Badge>
              </div>
              <h2 className="mt-3 truncate text-lg font-semibold">{data.listing.title || data.listing.spu_code}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.listing.platform_category_name || data.readiness.category.category_name || "未匹配类目"}
              </p>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {data.listing.platform_category_path || data.readiness.category.path || "类目路径待同步"}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">字段完整度</p>
            <span className="text-2xl font-semibold tabular-nums">{data.listing.completeness}%</span>
          </div>
          <Progress value={data.listing.completeness} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            当前版本 v{data.listing.latest_version_no ?? 0} · 状态 {data.listing.validation_status}
          </p>
        </div>
      </section>

      <CategoryTreeDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        currentCategory={data.listing.platform_category_path || data.readiness.category.path}
        onSelect={(category) => updateCategoryMutation.mutate(category)}
        pending={updateCategoryMutation.isPending}
      />

      <ImageLibraryPickerDialog
        listingId={listingId}
        picker={imageLibraryPicker}
        onOpenChange={(open) => {
          if (!open) setImageLibraryPicker(null)
        }}
        onSelect={(asset) => {
          if (!imageLibraryPicker) return
          addLibraryImageMutation.mutate({ asset, picker: imageLibraryPicker })
        }}
        pending={addLibraryImageMutation.isPending}
      />

      {openApiSuitCategoryBlocked ? (
        <div className="rounded-lg border border-[#f4ddb3] bg-[#fff8e8] p-3 text-sm text-[#8a5a08]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="size-4" />
                OpenAPI 套装类目限制
              </div>
              <p className="mt-1 text-xs">SHEIN `publishOrEdit` 暂不支持套装商品结构，可转为非套装叶子类目后按主售单品发布。</p>
            </div>
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => convertOpenApiSingleItemMutation.mutate()}
              disabled={convertOpenApiSingleItemMutation.isPending}
            >
              {convertOpenApiSingleItemMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Layers3 className="mr-2 size-4" />
              )}
              转为 OpenAPI 单品发布
            </Button>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="listing" className="space-y-5">
        <TabsList className="w-fit">
          <TabsTrigger value="listing">上新填写</TabsTrigger>
          <TabsTrigger value="records">更多发布记录</TabsTrigger>
        </TabsList>

        <TabsContent value="listing" className="space-y-5">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>需要填写的字段</CardTitle>
              <p className="text-sm text-muted-foreground">
                {spuDimension?.description || "只保留类目要求、缺失项、标题、品牌、属性、图片和包装价格等上新必填信息。"}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldGroupsTable
                groups={focusedFieldGroups}
                manualValues={manualValues}
                onChange={(key, value) => setManualValues((prev) => ({ ...prev, [key]: value }))}
                onEditCategory={() => setCategoryDialogOpen(true)}
                onGenerateCategoryAi={() => aiEnrichMutation.mutate("category")}
                categoryAiGenerating={aiEnrichMutation.isPending && aiEnrichMutation.variables === "category"}
                onGenerateAi={(field) => aiFieldMutation.mutate(field)}
                generatingFieldKey={aiFieldMutation.isPending ? aiFieldMutation.variables?.key ?? null : null}
                validationIssues={fieldValidationIssues}
              />
              {spuImageRequirements.length ? (
                <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">SPU 图片规则</h3>
                </div>
                <ImageRequirementManager
                  requirements={spuImageRequirements}
                  assets={data.assets.filter((asset) => !asset.skc_code)}
                  onUpload={(params) => uploadImageMutation.mutate(params)}
                  uploadingKey={uploadingImageKey}
                  uploadingState={uploadingImageState}
                  onOpenLibrary={(params) => setImageLibraryPicker(params)}
                  onUpdateAsset={(assetId, values) => updateImageAssetMutation.mutate({ assetId, values })}
                  onDeleteAsset={(assetId) => deleteImageAssetMutation.mutate(assetId)}
                  pending={updateImageAssetMutation.isPending || deleteImageAssetMutation.isPending}
                />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>{skcDimension?.title ?? "SKC 款色维度"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">图片规则</h3>
                    <p className="mt-1 text-xs text-muted-foreground">按 SHEIN 类目要求约束每个 SKC 的主图、方形图和色块图。</p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <FolderUp className="mr-2 size-4" />
                        导入本地图片目录
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>导入本地图片目录</DialogTitle>
                        <DialogDescription>按文件名和目录名匹配 SKC；示例 20112210410530435 会匹配款色 30435。</DialogDescription>
                      </DialogHeader>
                      <Label className="grid gap-2">
                        图片目录
                        <Input value={folderPath} onChange={(event) => setFolderPath(event.target.value)} />
                      </Label>
                      <Button onClick={() => importImagesMutation.mutate()} disabled={importImagesMutation.isPending}>
                        {importImagesMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                        导入本地图片目录
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>
                <ImageRequirementTable requirements={skcImageRequirements} />
              </div>

              {skcGroups.map((group) => {
                const imageUrl = group.skus[0] ? skcImageForSku(group.skus[0], data.skcs, data.assets) : group.skc.image_url
                const colorPayload = parsePayload(group.skc.color_attribute_payload_json)
                const checklist = data.image_checklist.find((item) => item.skc_code === group.skc.skc_code)
                const selectedSizeCount = selectedSkuIdsBySkc.get(group.skc.skc_code)?.length ?? 0
                const allSkuSelected = group.skus.length > 0 && group.skus.every((sku) => selectedSkuIds.has(sku.id))
                return (
                  <div key={group.skc.id} className="rounded border p-4">
                    <div className="grid gap-4 lg:grid-cols-[150px_minmax(0,1fr)]">
                      <div>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={`${group.skc.skc_code} SKC 款色图`}
                            className="aspect-[3/4] w-full rounded border object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex aspect-[3/4] w-full items-center justify-center rounded border bg-muted text-muted-foreground">
                            <Camera className="size-5" />
                          </div>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">SKC 款色图优先取 TMALL COLOR_BLOCK / COLOR</p>
                      </div>
                      <div className="min-w-0 space-y-4">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium">
                              <Checkbox
                                checked={selectedSkcIds.has(group.skc.id)}
                                onCheckedChange={() => toggleSkcSelection(group)}
                              />
                              发布该 SKC
                            </label>
                            <p className="mt-2 font-mono text-sm">{group.skc.skc_code}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{group.skc.color_name || "-"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              颜色枚举 ID：{String(colorPayload.attribute_value_id ?? "待确认")}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">颜色枚举</Label>
                            <Select
                              value={skcColorValues[group.skc.id] ?? ""}
                              onValueChange={(value) =>
                                setSkcColorValues((prev) => ({ ...prev, [group.skc.id]: value }))
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="选择颜色枚举" />
                              </SelectTrigger>
                              <SelectContent>
                                {(colorAttribute?.values ?? []).map((option) => (
                                  <SelectItem key={option.attribute_value_id} value={optionValue(option)}>
                                    {optionLabel(option)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h4 className={cn("text-sm font-semibold", imageValidationIssues.length > 0 && "text-destructive")}>图片确认</h4>
                              <p className={cn("mt-1 text-xs text-muted-foreground", imageValidationIssues.length > 0 && "text-destructive/80")}>
                                TMALL 款色图 {checklist?.has_tmall_color_image ? "已满足" : "缺失"}，人工导入 {checklist?.imported_asset_count ?? 0} 张。
                              </p>
                              {imageValidationIssues.length > 0 ? (
                                <div className="mt-2 space-y-1 text-xs text-destructive">
                                  {imageValidationIssues.map((issue) => (
                                    <p key={issue.id}>
                                      {issue.message}
                                      {issue.suggestion ? `；${issue.suggestion}` : ""}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={confirmedSkcIds.has(group.skc.id)}
                                onCheckedChange={() => toggle(setConfirmedSkcIds, confirmedSkcIds, group.skc.id)}
                              />
                              图片已确认
                            </label>
                          </div>
                          <ImageRequirementManager
                            requirements={skcImageRequirements}
                            assets={group.assets}
                            checklist={checklist}
                            skcCode={group.skc.skc_code}
                            onUpload={(params) => uploadImageMutation.mutate(params)}
                            uploadingKey={uploadingImageKey}
                            uploadingState={uploadingImageState}
                            onOpenLibrary={(params) => setImageLibraryPicker(params)}
                            onUpdateAsset={(assetId, values) => updateImageAssetMutation.mutate({ assetId, values })}
                            onDeleteAsset={(assetId) => deleteImageAssetMutation.mutate(assetId)}
                            pending={updateImageAssetMutation.isPending || deleteImageAssetMutation.isPending}
                          />
                          {checklist?.missing?.length ? (
                            <p className="text-xs text-destructive">缺：{checklist.missing.join("、")}</p>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h4 className={cn("text-sm font-semibold", skuCommercialValidationIssues.length > 0 && "text-destructive")}>按 SKC 选择发布尺码</h4>
                              <p className={cn("mt-1 text-xs text-muted-foreground", skuCommercialValidationIssues.length > 0 && "text-destructive/80")}>SKU 作为尺码、条码、毛重的细化行；发布选择先按 SKC 聚合。</p>
                              {skuCommercialValidationIssues.length > 0 ? (
                                <div className="mt-2 space-y-1 text-xs text-destructive">
                                  {skuCommercialValidationIssues.map((issue) => (
                                    <p key={issue.id}>
                                      {issue.message}
                                      {issue.suggestion ? `；${issue.suggestion}` : ""}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox checked={allSkuSelected} onCheckedChange={() => toggleSkcSelection(group)} />
                              发布全部尺码（{selectedSizeCount}/{group.skus.length}）
                            </label>
                          </div>
                          <SkuBatchFillBar
                            skus={group.skus}
                            selectedSkuIds={selectedSkuIds}
                            onApply={applySkuBatchFill}
                          />
                          <div className="overflow-auto rounded border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">发布</TableHead>
                                  <TableHead className="min-w-24">SKC 款色图</TableHead>
                                  <TableHead className="min-w-48">MDM SKU</TableHead>
                                  <TableHead>商品档案尺码</TableHead>
                                      <TableHead className="min-w-40">SHEIN 发布尺码</TableHead>
                                      <TableHead className="min-w-28">供货价</TableHead>
                                      <TableHead className="min-w-24">价格确认</TableHead>
                                      <TableHead className="min-w-24">SKU 毛重/g</TableHead>
                                      <TableHead className="min-w-[270px]">包装长/宽/高 cm</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.skus.map((sku) => {
                                  const selectedSize = selectedOption(sizeAttribute?.values, skuSizeValues[sku.id] ?? "")
                                  const rowImage = skcImageForSku(sku, data.skcs, data.assets)
                                  const commercial = skuCommercialValues[sku.id] ?? {
                                    costPrice: sku.cost_price == null ? "" : String(sku.cost_price),
                                    currency: sku.currency || "CNY",
                                    packageLengthCm: sku.package_length_cm == null ? "" : String(sku.package_length_cm),
                                    packageWidthCm: sku.package_width_cm == null ? "" : String(sku.package_width_cm),
                                    packageHeightCm: sku.package_height_cm == null ? "" : String(sku.package_height_cm),
                                  }
                                  return (
                                    <TableRow key={sku.id}>
                                      <TableCell>
                                        <Checkbox
                                          checked={selectedSkuIds.has(sku.id)}
                                          onCheckedChange={() => toggleSkuWithinSkc(group, sku.id)}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        {rowImage ? (
                                          <img src={rowImage} alt={`${sku.sku_code} SKC 款色图`} className="h-14 w-11 rounded border object-cover" loading="lazy" referrerPolicy="no-referrer" />
                                        ) : (
                                          <div className="flex h-14 w-11 items-center justify-center rounded border bg-muted text-muted-foreground">
                                            <Camera className="size-4" />
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <p className="font-mono">{sku.sku_code}</p>
                                        {sku.supplier_barcode ? (
                                          <p className="text-xs text-muted-foreground">条码：{sku.supplier_barcode}</p>
                                        ) : null}
                                        {sku.supplier_sku && sku.supplier_sku !== sku.sku_code ? (
                                          <p className="text-xs text-muted-foreground">企业码：{sku.supplier_sku}</p>
                                        ) : null}
                                      </TableCell>
                                      <TableCell>{sku.size_name || "-"}</TableCell>
                                      <TableCell>
                                        <Select
                                          value={selectedSize ? optionValue(selectedSize) : skuSizeValues[sku.id] ?? ""}
                                          onValueChange={(value) =>
                                            setSkuSizeValues((prev) => ({ ...prev, [sku.id]: value }))
                                          }
                                        >
                                          <SelectTrigger className="min-w-32">
                                            <SelectValue placeholder="选择 SHEIN 尺码" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {(sizeAttribute?.values ?? []).map((option) => (
                                              <SelectItem key={option.attribute_value_id} value={optionValue(option)}>
                                                {optionLabel(option)}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Input
                                            type="number"
                                            value={commercial.costPrice}
                                            onChange={(event) => updateSkuCommercialValue(sku.id, "costPrice", event.target.value)}
                                            className="w-24"
                                            placeholder="供货价"
                                          />
                                          <Input
                                            value={commercial.currency}
                                            onChange={(event) => updateSkuCommercialValue(sku.id, "currency", event.target.value)}
                                            className="w-16"
                                          />
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge
                                          variant="outline"
                                          className={Number(sku.price_confirmed ?? 0) === 1
                                            ? "border-[#b9f4d8] bg-[#f4fff9] text-[#0f8a5f]"
                                            : "border-[#f4ddb3] bg-[#fff8e8] text-[#8a5a08]"}
                                        >
                                          {Number(sku.price_confirmed ?? 0) === 1 ? "已确认" : "保存后确认"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          value={skuWeightValues[sku.id] ?? ""}
                                          onChange={(event) =>
                                            setSkuWeightValues((prev) => ({ ...prev, [sku.id]: event.target.value }))
                                          }
                                          className="w-24"
                                          placeholder="必填"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <div className="grid grid-cols-3 gap-2">
                                          <Input
                                            type="number"
                                            value={commercial.packageLengthCm}
                                            onChange={(event) => updateSkuCommercialValue(sku.id, "packageLengthCm", event.target.value)}
                                            placeholder="长"
                                          />
                                          <Input
                                            type="number"
                                            value={commercial.packageWidthCm}
                                            onChange={(event) => updateSkuCommercialValue(sku.id, "packageWidthCm", event.target.value)}
                                            placeholder="宽"
                                          />
                                          <Input
                                            type="number"
                                            value={commercial.packageHeightCm}
                                            onChange={(event) => updateSkuCommercialValue(sku.id, "packageHeightCm", event.target.value)}
                                            placeholder="高"
                                          />
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>SHEIN 类目尺码表</CardTitle>
                <p className="text-sm text-muted-foreground">{skuDimension?.description}</p>
              </div>
              {(data.mapped_size_charts ?? []).length === 0 && sizeChartAttributes.length > 0 ? (
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={downloadManualSizeChartTemplate}>
                    <Download className="mr-2 size-4" />
                    下载模板
                  </Button>
                  <ImportDialog
                    title="导入尺码表"
                    description="按 SKU 编码或发布尺码匹配当前表格行。"
                    onImport={importManualSizeChartTemplate}
                    trigger={(
                      <Button variant="outline" size="sm">
                        <FileSpreadsheet className="mr-2 size-4" />
                        导入填充
                      </Button>
                    )}
                  />
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">尺码表</h3>
                {(data.mapped_size_charts ?? []).length === 0 ? (
                  sizeChartAttributes.length === 0 ? (
                    <EmptyState message="当前 SHEIN 类目暂无尺码表模板字段" />
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                        深绘暂未返回可映射到 SHEIN 类目模板的结构化尺码表，当前使用类目模板维护。
                      </div>
                      <div className="overflow-auto rounded border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-36">SHEIN 发布尺码</TableHead>
                              <TableHead className="min-w-44">SKU</TableHead>
                              {sizeChartAttributes.map((attribute) => (
                                <TableHead key={attribute.attribute_id} className="min-w-32">
                                  {attribute.attribute_name}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {manualSizeChartRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={sizeChartAttributes.length + 2} className="h-24 text-center text-sm text-muted-foreground">
                                  暂无已勾选发布 SKU
                                </TableCell>
                              </TableRow>
                            ) : (
                              manualSizeChartRows.map(({ sku, localSize, publishSize }) => (
                                <TableRow key={sku.id}>
                                  <TableCell>
                                    <p className="font-medium">{publishSize || "-"}</p>
                                    {localSize && localSize !== publishSize ? (
                                      <p className="text-xs text-muted-foreground">商品档案尺码：{localSize}</p>
                                    ) : null}
                                  </TableCell>
                                  <TableCell>
                                    <p className="font-mono text-xs">{sku.sku_code}</p>
                                    <p className="text-xs text-muted-foreground">{sku.skc_code}</p>
                                  </TableCell>
                                  {sizeChartAttributes.map((attribute) => (
                                    <TableCell key={attribute.attribute_id}>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={manualSizeChartValues[sku.id]?.[String(attribute.attribute_id)] ?? ""}
                                        onChange={(event) => updateManualSizeChartValue(sku.id, attribute.attribute_id, event.target.value)}
                                        placeholder={attribute.attribute_name}
                                        className="h-9 min-w-28"
                                      />
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )
                ) : (
                  data.mapped_size_charts.map((chart) => {
                    const rows = chart.rows
                    const publishedRows = rows.filter((row) => findPublishSizeMatch(row.size_name, selectedPublishSizeByToken))
                    const keys = chart.columns.length
                      ? chart.columns
                      : Array.from(new Set(rows.flatMap((row) => Object.keys(parseValues(row.values_json)))))
                    return (
                      <div key={chart.template_key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold">{chart.template_name}</h4>
                            <p className="mt-1 text-xs text-muted-foreground">
                              深绘来源表：{chart.source_field_name || `表 ${chart.source_table_index}`} → SHEIN 类目尺码模板
                            </p>
                          </div>
                          <Badge variant="outline">{publishedRows.length}/{rows.length} 发布尺码</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{chart.note}</p>
                        {publishedRows.length === 0 ? (
                          <div className="rounded border p-4 text-sm text-muted-foreground">
                            已勾选 SKU 的商品档案尺码暂未匹配到深绘尺码表行。
                          </div>
                        ) : (
                          <div className="overflow-auto rounded border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>SHEIN 发布尺码</TableHead>
                                  {keys.slice(0, 10).map((key) => <TableHead key={key}>{key}</TableHead>)}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {publishedRows.map((row) => {
                                  const values = parseValues(row.values_json)
                                  const match = findPublishSizeMatch(row.size_name, selectedPublishSizeByToken)
                                  return (
                                    <TableRow key={row.id}>
                                      <TableCell>
                                        <p className="font-medium">{match?.publishSize || row.size_name || "-"}</p>
                                        {match?.localSize && match.localSize !== match.publishSize ? (
                                          <p className="text-xs text-muted-foreground">商品档案尺码：{match.localSize}</p>
                                        ) : null}
                                      </TableCell>
                                      {keys.slice(0, 10).map((key) => (
                                        <TableCell key={key}>{toInputValue(values[key]) || "-"}</TableCell>
                                      ))}
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="records">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>更多发布记录</CardTitle>
              <p className="text-sm text-muted-foreground">版本历史、发布回显和 SHEIN 平台标识集中查看。</p>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">版本历史</h3>
                {data.versions.map((version) => (
                  <div key={version.id} className="rounded border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline">v{version.version_no}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(version.created_at)}</span>
                    </div>
                    <p className="mt-2 font-medium">{version.change_summary || version.version_type}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{version.status}</p>
                    {version.platform_version ? (
                      <p className="mt-1 text-xs text-muted-foreground">平台版本：{version.platform_version}</p>
                    ) : null}
                    {version.error_message ? (
                      <p className="mt-1 text-xs text-destructive">{version.error_code ? `${version.error_code} · ` : ""}{version.error_message}</p>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="space-y-3 text-sm">
                <h3 className="text-sm font-semibold">发布回显</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{data.listing.status}</Badge>
                  <Badge variant="outline">{data.listing.validation_status}</Badge>
                </div>
                {data.publish_tasks.length ? (
                  <div className="rounded border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline">{data.publish_tasks[0].status}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(data.publish_tasks[0].created_at)}</span>
                    </div>
                    {data.publish_tasks[0].platform_trace_id ? (
                      <p className="mt-2 text-xs text-muted-foreground">Trace：{data.publish_tasks[0].platform_trace_id}</p>
                    ) : null}
                    {data.publish_tasks[0].platform_version ? (
                      <p className="mt-1 text-xs text-muted-foreground">平台版本：{data.publish_tasks[0].platform_version}</p>
                    ) : null}
                    {data.publish_tasks[0].error_message ? (
                      <p className="mt-2 text-xs text-destructive">
                        {data.publish_tasks[0].error_code ? `${data.publish_tasks[0].error_code} · ` : ""}
                        {data.publish_tasks[0].error_message}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">还没有提交过 SHEIN 发布。</p>
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">SHEIN 平台标识</h3>
                {data.platform_identities.length ? (
                  data.platform_identities.slice(0, 8).map((identity) => (
                    <div key={identity.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-xs">
                      <span>{identity.platform_type}</span>
                      <span className="truncate font-mono">{identity.platform_id}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">暂无平台标识回写。</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
