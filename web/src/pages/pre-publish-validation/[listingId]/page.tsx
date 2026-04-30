import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Bot,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileClock,
  FolderTree,
  FolderUp,
  ImageIcon,
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
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/stat-card"
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
  asset_type: string
  image_sort: number
  local_path: string | null
  source_url: string | null
  status: string
  confirmed: number
  note: string | null
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

type SkuCommercialDraft = {
  costPrice: string
  currency: string
  packageLengthCm: string
  packageWidthCm: string
  packageHeightCm: string
}

type ImageUploadParams = {
  file: File
  skcCode?: string | null
  requirement: ImageRequirement
}

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

function fieldBadge(field: FillField) {
  if (field.status === "NEEDS_AI") return "需要人工判断"
  if (field.status === "MISSING") return "缺失"
  return field.source
}

function isEditableField(field: FillField) {
  return !["category", "skc_code", "skc_image", "color", "size_conversion", "package_weight", "size_chart"].includes(field.key)
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
}: {
  groups: FieldGroup[]
  manualValues: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.group} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{group.group}</h3>
            <Badge variant="outline">平台类目所需字段</Badge>
          </div>
          <div className="overflow-hidden rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[190px]">字段</TableHead>
                  <TableHead>字段值</TableHead>
                  <TableHead className="w-[150px]">来源</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.fields.map((field) => (
                  <TableRow key={field.key}>
                    <TableCell className="font-medium">{field.label}</TableCell>
                    <TableCell>
                      <FieldValueEditor
                        field={field}
                        value={manualValues[field.key] ?? toInputValue(field.value)}
                        onChange={(value) => onChange(field.key, value)}
                      />
                      {field.note ? <p className="mt-1 text-xs text-muted-foreground">{field.note}</p> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass[field.status]}>
                        {fieldBadge(field)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
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
}: {
  requirements: ImageRequirement[]
  checklist?: ListingDetail["image_checklist"][number]
  skcCode?: string | null
  onUpload?: (params: ImageUploadParams) => void
  uploadingKey?: string | null
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
                      <Label className={cn("cursor-pointer", pending && "pointer-events-none opacity-60")}>
                        {pending ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <Upload className="mr-1 size-3" />
                        )}
                        上传补齐
                        <Input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={pending}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.currentTarget.value = ""
                            if (!file) return
                            onUpload?.({ file, skcCode, requirement })
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
  const [folderPath, setFolderPath] = useState("/Users/xingyicheng/Downloads/20112210410530435")
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [imageImportDialogOpen, setImageImportDialogOpen] = useState(false)
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null)

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
  const dimensionGroups = data?.dimension_field_groups ?? data?.readiness.dimension_field_groups ?? []
  const skcImageRequirements = data?.image_requirements.filter((requirement) => requirement.level === "SKC" && requirement.show !== 0) ?? []
  const spuImageRequirements = data?.image_requirements.filter((requirement) => requirement.level === "SPU" && requirement.show !== 0) ?? []
  const openApiSuitCategoryBlocked = Boolean(
    data?.listing.platform_category_name?.includes("套装")
    || data?.listing.platform_category_path?.includes("套装"),
  )

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
  }, [data, fields])

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
    mutationFn: async ({ file, skcCode, requirement }: ImageUploadParams) => {
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
        throw new Error(body?.message || "图片上传失败")
      }
      return response.json()
    },
    onMutate: ({ skcCode, requirement }) => {
      setUploadingImageKey(imageUploadKey(requirement.requirement_key, skcCode))
    },
    onSuccess: () => {
      toast.success("图片已上传到草稿素材，发布前可继续确认")
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "draft", listingId] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "图片上传失败"
      toast.error(message)
    },
    onSettled: () => setUploadingImageKey(null),
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
    <PageContainer className="space-y-6">
      <PageHeader
        title={`${data.listing.spu_code} 发布草稿`}
        description="平台类目所需字段、字段填充情况、颜色尺码选择、尺码表、图片确认和版本历史都在这个单款详情页维护。"
        actionsClassName="lg:max-w-[560px] [&>button]:h-9 [&>button]:px-3 [&>a]:h-9 [&>a]:px-3"
      >
        <Button asChild variant="outline">
          <Link to="/pre-publish-validation">
            <ArrowLeft className="mr-2 size-4" />
            返回草稿箱
          </Link>
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
            <DropdownMenuItem
              onSelect={() => aiEnrichMutation.mutate("all")}
              disabled={aiEnrichMutation.isPending}
            >
              <Sparkles className="size-4" />
              AI 推荐补齐空字段
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

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="发布平台" value={data.listing.platform} />
        <StatCard title="字段完整度" value={`${data.listing.completeness}%`} icon={CheckCircle2} />
        <StatCard title="当前版本" value={`v${data.listing.latest_version_no ?? 0}`} icon={FileClock} />
        <StatCard title="阻断项" value={formatNumber(data.listing.blocker_count)} icon={ShieldAlert} />
      </div>

      <CategoryTreeDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        currentCategory={data.listing.platform_category_path || data.readiness.category.path}
        onSelect={(category) => updateCategoryMutation.mutate(category)}
        pending={updateCategoryMutation.isPending}
      />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>平台与类目</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">SHEIN 类目</p>
                <p className="mt-1 font-medium">{data.listing.platform_category_name || data.readiness.category.category_name || "未匹配类目"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{data.listing.platform_category_path || data.readiness.category.path}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border p-3">
                  <p className="text-xs text-muted-foreground">Category ID</p>
                  <p className="mt-1 font-mono">{data.listing.platform_category_id ?? "-"}</p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs text-muted-foreground">Product Type</p>
                  <p className="mt-1 font-mono">{data.listing.product_type_id ?? "-"}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full justify-start" onClick={() => setCategoryDialogOpen(true)}>
                <FolderTree className="mr-2 size-4" />
                类目树选择
              </Button>
              {openApiSuitCategoryBlocked ? (
                <div className="rounded border border-[#f4ddb3] bg-[#fff8e8] p-3 text-sm text-[#8a5a08]">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldAlert className="size-4" />
                    OpenAPI 套装类目限制
                  </div>
                  <p className="mt-1 text-xs">
                    SHEIN `publishOrEdit` 暂不支持套装商品结构。可转为非套装叶子类目后按主售单品发布，系统会同步清理标题里的 Set/套装语义。
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 w-full justify-start bg-white"
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
              ) : null}
              <div>
                <p className="text-xs text-muted-foreground">校验进度</p>
                <div className="mt-2 flex items-center gap-3">
                  <Progress value={data.listing.completeness} className="h-2" />
                  <span className="w-12 text-right text-xs tabular-nums">{data.listing.completeness}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>维度导航</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {dimensionGroups.map((group) => (
                <div key={group.dimension} className="rounded border p-3">
                  <div className="flex items-center gap-2">
                    <Layers3 className="size-4 text-muted-foreground" />
                    <p className="font-medium">{group.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>版本历史</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>发布回显</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
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
              {data.platform_identities.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">SHEIN 平台标识</p>
                  {data.platform_identities.slice(0, 8).map((identity) => (
                    <div key={identity.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-xs">
                      <span>{identity.platform_type}</span>
                      <span className="truncate font-mono">{identity.platform_id}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{spuDimension?.title ?? "SPU 款维度"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="rounded border p-4">
                  <p className="text-xs text-muted-foreground">款号 / 标题</p>
                  <p className="mt-1 font-mono text-sm">{data.listing.spu_code}</p>
                  <p className="mt-2 text-sm">{data.listing.title || data.readiness.field_groups.flatMap((group) => group.fields).find((field) => field.key === "title_cn")?.value || "-"}</p>
                </div>
                <div className="rounded border p-4">
                  <p className="text-xs text-muted-foreground">SPU 图片规则</p>
                  <p className="mt-1 text-sm">{spuImageRequirements.length} 个展示规则</p>
                  <p className="mt-1 text-xs text-muted-foreground">SPU 轮播图 / SPU 方形图 按类目配置显示，当前发布以 SKC 图片为主。</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">图片规则</h3>
                </div>
                <ImageRequirementTable
                  requirements={spuImageRequirements}
                  onUpload={(params) => uploadImageMutation.mutate(params)}
                  uploadingKey={uploadingImageKey}
                />
              </div>
              <FieldGroupsTable
                groups={spuDimension?.groups ?? data.readiness.field_groups}
                manualValues={manualValues}
                onChange={(key, value) => setManualValues((prev) => ({ ...prev, [key]: value }))}
              />
            </CardContent>
          </Card>

          <Card>
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
                              <h4 className="text-sm font-semibold">图片确认</h4>
                              <p className="mt-1 text-xs text-muted-foreground">
                                TMALL 款色图 {checklist?.has_tmall_color_image ? "已满足" : "缺失"}，人工导入 {checklist?.imported_asset_count ?? 0} 张。
                              </p>
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={confirmedSkcIds.has(group.skc.id)}
                                onCheckedChange={() => toggle(setConfirmedSkcIds, confirmedSkcIds, group.skc.id)}
                              />
                              图片已确认
                            </label>
                          </div>
                          <ImageRequirementTable
                            requirements={skcImageRequirements}
                            checklist={checklist}
                            skcCode={group.skc.skc_code}
                            onUpload={(params) => uploadImageMutation.mutate(params)}
                            uploadingKey={uploadingImageKey}
                          />
                          {checklist?.missing?.length ? (
                            <p className="text-xs text-destructive">缺：{checklist.missing.join("、")}</p>
                          ) : null}
                          {group.assets.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-3">
                              {group.assets.map((asset) => (
                                <div key={asset.id} className="rounded border p-2">
                                  <img src={assetSrc(asset)} alt={`${asset.skc_code || ""} ${asset.asset_type}`} className="h-32 w-full rounded object-cover" />
                                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                                    <span className="font-mono">{asset.skc_code || "-"}</span>
                                    <Badge variant="outline">{asset.asset_type}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h4 className="text-sm font-semibold">按 SKC 选择发布尺码</h4>
                              <p className="mt-1 text-xs text-muted-foreground">SKU 作为尺码、条码、毛重的细化行；发布选择先按 SKC 聚合。</p>
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox checked={allSkuSelected} onCheckedChange={() => toggleSkcSelection(group)} />
                              发布全部尺码（{selectedSizeCount}/{group.skus.length}）
                            </label>
                          </div>
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
            <CardHeader>
              <CardTitle>SHEIN 类目尺码表</CardTitle>
              <p className="text-sm text-muted-foreground">{skuDimension?.description}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">尺码表</h3>
                {(data.mapped_size_charts ?? []).length === 0 ? (
                  <EmptyState message="深绘暂未返回可映射到 SHEIN 类目模板的结构化尺码表" />
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

          <Card>
            <CardHeader>
              <CardTitle>校验阻断</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.validation_issues.length === 0 ? (
                <div className="rounded border border-[#b9f4d8] bg-[#f4fff9] p-4 text-sm text-[#0f8a5f]">
                  当前草稿没有阻断项。
                </div>
              ) : (
                data.validation_issues.map((issue) => (
                  <div key={issue.id} className="rounded border p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={issue.severity === "ERROR" ? "destructive" : "outline"}>{issue.severity}</Badge>
                      <span className="font-medium">{issue.message}</span>
                    </div>
                    {issue.suggestion ? <p className="mt-1 text-xs text-muted-foreground">{issue.suggestion}</p> : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="hidden">
        <Sparkles />
        字段填充情况 发布颜色 规格与图片 发布尺码 SPU 轮播图 SKC 主图/细节图 SKC 方形图 SKC 色块图
      </div>
    </PageContainer>
  )
}
