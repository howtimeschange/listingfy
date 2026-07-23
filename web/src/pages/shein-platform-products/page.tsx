import { useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router"
import {
  ArrowLeft,
  ClipboardCheck,
  Download,
  DollarSign,
  Edit3,
  Eye,
  GitMerge,
  Globe2,
  History,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Upload,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"
import { JsonViewer } from "@/components/json-viewer"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { ServerPagination } from "@/components/server-pagination"
import type { ServerPaginationState } from "@/components/server-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
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
import { api } from "@/lib/api-client"
import { useAsyncTasks, type AsyncTaskJob } from "@/lib/async-task-context"
import { formatNumber } from "@/lib/format"
import {
  buildCostImportRequests,
  parseCostImportRows,
  submitCostImportRows,
  type CostImportProgress,
  type CostImportRow,
} from "@/lib/shein-cost-import"
import { exportSpreadsheet, readSpreadsheetFile, type SpreadsheetRow } from "@/lib/spreadsheet"

type JsonRecord = Record<string, unknown>

interface PlatformRequestResult {
  status: number
  payload: unknown
}

interface LifecycleOperation {
  id: number
  operationType: string
  spuName: string
  skcName: string
  skuCode: string
  status: string
  responseCode: string
  responseMessage: string
  traceId: string
  errorMessage: string
  actorUsername: string
  startedAt: string
  finishedAt: string
  createdAt: string
}

interface SaleSiteDetail {
  siteAbbr: string
  siteName: string
  shelfStatus: number | null
  shelfStatusText: string
  firstShelfTime: string
  lastShelfTime: string
  link: string
  source: string
}

interface PlatformProductRow {
  id: number
  spuName: string
  supplierCode: string
  productName: string
  brandCode: string
  brandName: string
  categoryId: string
  categoryName: string
  productTypeId: string
  productStatus: string
  shelfStatusText: string
  skcCount: number
  skuCount: number
  editableStatus: string
  editableMessage: string
  editableCheckedAt: string
  lastListSyncedAt: string
  lastDetailSyncedAt: string
  updatedAt: string
  imageUrl: string | null
  saleSites: SaleSiteDetail[]
  saleSiteCount: number
  saleSiteSummary: string
  costSummary: string
  costSkuCount: number
  skcs: Array<{
    skcName: string
    supplierCode: string
    imageUrl: string | null
    shelfStatusText: string
    skuCount: number
    skus: Array<{
      skuCode: string
      supplierSku: string
      saleText: string
      mallState: number | null
      stopPurchase: number | null
      costs: string
      prices: string
    }>
  }>
  skuCodeList: string[]
}

interface ProductListResponse {
  items: PlatformProductRow[]
  pagination: ServerPaginationState
  operations: LifecycleOperation[]
  filters: {
    brands: Array<{ value: string; label: string; count: number }>
    categories: Array<{ value: string; label: string; count: number }>
    sites: Array<{ value: string; label: string; count: number }>
  }
}

interface StoreSite {
  id: number
  mainSite: string
  mainSiteName: string
  siteAbbr: string
  siteName: string
  currency: string
  status: number | null
  symbolLeft: string
  symbolRight: string
  storeType: number | null
  lastSyncedAt: string
}

interface StoreSitesResponse {
  items: StoreSite[]
  operations: LifecycleOperation[]
}

interface DetailSku {
  id: number
  skuCode: string
  supplierSku: string
  saleText: string
  mallState: number | null
  stopPurchase: number | null
  weight: number | null
  dimensions: string
  currentCost: string
  currency: string
  costs: string
  prices: string
  rawPayload: JsonRecord
}

interface DetailSkc {
  id: number
  skcName: string
  supplierCode: string
  saleText: string
  shelfText: string
  imageUrl: string | null
  rawPayload: JsonRecord
  skus: DetailSku[]
}

interface ProductDetailResponse {
  product: PlatformProductRow
  skcs: DetailSkc[]
  rawInfo: JsonRecord
  operations: LifecycleOperation[]
}

type DetailSection = "product" | "sites"

interface CostItem {
  skcName: string
  skuCode: string
  supplierSku: string
  originalCost: string
  selected: boolean
}

interface CostForm {
  spuName: string
  cost: string
  currency: string
  changeReasonCode: string
  items: CostItem[]
}

interface CostChangeReason {
  reasonCode: string
  reasonText: string
}

interface CostChangeReasonResponse {
  source: string
  items: CostChangeReason[]
}

interface SupplierSkuCheckResult {
  items: Array<{
    supplierSku: string
    repeated: boolean
  }>
  repeated: Array<{
    supplierSku: string
    repeated: boolean
  }>
}

interface RegressionForm {
  scenario: string
  status: "PASS" | "FAIL" | "BLOCKED"
  spuName: string
  skcName: string
  skuCode: string
  traceId: string
  operatorNote: string
  errorMessage: string
}

interface EditSkuForm {
  skuCode: string
  supplierSku: string
  weight: string
  length: string
  width: string
  height: string
  mallState: string
  stopPurchase: string
}

interface CommonEditForm {
  productTitleZh: string
  productTitleEn: string
  productDescriptionZh: string
  productDescriptionEn: string
  brandCode: string
  supplierCode: string
  categoryId: string
  productTypeId: string
  skuUpdates: EditSkuForm[]
}

interface EditTemplateResponse {
  product: PlatformProductRow
  form: CommonEditForm
  payload: JsonRecord
  warnings: string[]
}

interface VariantTemplateResponse {
  product: PlatformProductRow
  payload: JsonRecord
  newVariant: {
    skc: JsonRecord
    sku: JsonRecord
  }
  notes: string[]
}

interface VariantTemplateForm {
  skcSupplierCode: string
  skcAttributeId: string
  skcAttributeValueId: string
  imageUrl: string
  skuSupplierSku: string
  skuAttributeId: string
  skuAttributeValueId: string
  weight: string
  length: string
  width: string
  height: string
  mallState: string
  stopPurchase: string
  cost: string
  currency: string
}

type JsonActionKind = "partial-edit" | "add-variants"

interface JsonActionDialogState {
  open: boolean
  kind: JsonActionKind
  spuName: string
  payloadText: string
}

interface ProductQueryParams {
  pagination: ServerPaginationState
  search: string
  brandFilter: string
  categoryFilter: string
  siteFilter: string
}

type SyncRangeMode = "last-sync" | "custom" | "all"
type SyncDialogMode = "time" | "spu"
type SyncTimeField = "updateTime" | "insertTime"
type SyncScheduleScope = "full" | "spu"

interface SyncFilters {
  rangeMode: SyncRangeMode
  syncTimeField: SyncTimeField
  timeStart: string
  timeEnd: string
  pageSize: string
  maxPages: string
  detailLimit: string
  syncDetails: boolean
}

interface SyncScheduleConfig {
  enabled: boolean
  schedule_hour: number
  sync_scope: SyncScheduleScope
  spu_names: string[]
  last_enqueued_date?: string | null
  last_enqueued_job_id?: string | null
  updated_at?: string | null
  active_job?: AsyncTaskJob | null
}

interface SyncScheduleForm {
  enabled: boolean
  schedule_hour: string
  sync_scope: SyncScheduleScope
  spu_names_text: string
}

type PlatformProductView = "list" | "sites" | "detail"
const EMPTY_SALE_SITES: SaleSiteDetail[] = []
const MAX_SPU_NAME_SYNC_COUNT = 20_000

interface SheinPlatformProductsPageProps {
  view?: PlatformProductView
}

const DEFAULT_COST_FORM: CostForm = {
  spuName: "",
  cost: "",
  currency: "CNY",
  changeReasonCode: "",
  items: [],
}

const DEFAULT_REGRESSION_FORM: RegressionForm = {
  scenario: "SYNC_PRODUCT_LIST",
  status: "PASS",
  spuName: "",
  skcName: "",
  skuCode: "",
  traceId: "",
  operatorNote: "",
  errorMessage: "",
}

const DEFAULT_COMMON_EDIT_FORM: CommonEditForm = {
  productTitleZh: "",
  productTitleEn: "",
  productDescriptionZh: "",
  productDescriptionEn: "",
  brandCode: "",
  supplierCode: "",
  categoryId: "",
  productTypeId: "",
  skuUpdates: [],
}

const DEFAULT_VARIANT_FORM: VariantTemplateForm = {
  skcSupplierCode: "",
  skcAttributeId: "",
  skcAttributeValueId: "",
  imageUrl: "",
  skuSupplierSku: "",
  skuAttributeId: "",
  skuAttributeValueId: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  mallState: "1",
  stopPurchase: "1",
  cost: "",
  currency: "CNY",
}

const DEFAULT_JSON_ACTION: JsonActionDialogState = {
  open: false,
  kind: "partial-edit",
  spuName: "",
  payloadText: "{}",
}

const DEFAULT_SYNC_FILTERS: SyncFilters = {
  rangeMode: "custom",
  syncTimeField: "updateTime",
  timeStart: "",
  timeEnd: "",
  pageSize: "50",
  maxPages: "1000",
  detailLimit: "100000",
  syncDetails: true,
}

const DEFAULT_SYNC_SCHEDULE_FORM: SyncScheduleForm = {
  enabled: true,
  schedule_hour: "23",
  sync_scope: "full",
  spu_names_text: "",
}

const syncRangeOptions: Array<{ value: SyncRangeMode; label: string }> = [
  { value: "custom", label: "指定时间范围" },
  { value: "last-sync", label: "上次同步后" },
  { value: "all", label: "全量同步" },
]

const syncTimeFieldOptions: Array<{ value: SyncTimeField; label: string }> = [
  { value: "updateTime", label: "按更新时间" },
  { value: "insertTime", label: "按创建时间" },
]

const COST_IMPORT_TEMPLATE_ROWS: SpreadsheetRow[] = [
  {
    SPU: "s2409195445",
    SKC: "sc2409195445",
    SKU: "sku2409195445",
    供货价: "10.55",
    币种: "CNY",
    涨价原因: "",
  },
]

const ALL_FILTER_VALUE = "__all"

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function recordValue(value: unknown): JsonRecord {
  return isRecord(value) ? value : {}
}

function stringValue(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function compactRecord(value: JsonRecord) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry == null) return false
      if (typeof entry === "string" && !entry.trim()) return false
      if (Array.isArray(entry) && entry.length === 0) return false
      if (isRecord(entry) && !Object.keys(entry).length) return false
      return true
    }),
  )
}

function responsePayload(result?: PlatformRequestResult | null) {
  return recordValue(result?.payload)
}

function responseCode(result?: PlatformRequestResult | null) {
  return stringValue(responsePayload(result).code)
}

function responseMessage(result?: PlatformRequestResult | null) {
  return stringValue(responsePayload(result).msg || responsePayload(result).message)
}

function responseTraceId(result?: PlatformRequestResult | null) {
  return stringValue(responsePayload(result).traceId || responsePayload(result).trace_id)
}

function responseOk(result?: PlatformRequestResult | null) {
  const code = responseCode(result)
  return Boolean(result) && (!code || code === "0") && Number(result?.status ?? 0) >= 200 && Number(result?.status ?? 0) < 300
}

function parseJsonPayload(text: string) {
  try {
    const parsed = JSON.parse(text)
    if (!isRecord(parsed)) throw new Error("JSON 负载必须是对象")
    return parsed
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "JSON 格式错误", { cause: error })
  }
}

function splitSpuNames(text: string, limit = Number.POSITIVE_INFINITY) {
  return Array.from(
    new Set(
      text
        .split(/[\s,，;；]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).slice(0, limit)
}

function syncScheduleConfigToForm(config?: SyncScheduleConfig | null): SyncScheduleForm {
  if (!config) return DEFAULT_SYNC_SCHEDULE_FORM
  return {
    enabled: config.enabled,
    schedule_hour: String(config.schedule_hour ?? 23),
    sync_scope: config.sync_scope === "spu" ? "spu" : "full",
    spu_names_text: (config.spu_names ?? []).join("\n"),
  }
}

function platformTimeInputValue(value: string) {
  const normalized = value.trim().replace("T", " ")
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) return `${normalized}:00`
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return `${normalized} 00:00:00`
  return normalized
}

function siteStatusLabel(status: number | null) {
  if (status === 1) return "启用"
  if (status === 0) return "未启用"
  return "未知"
}

function saleSiteStatusVariant(status: number | null) {
  return status === 1 ? "secondary" : "outline"
}

function mallStateLabel(state: number | null) {
  if (state === 1) return "在售"
  if (state === 2) return "停售"
  return "—"
}

function operationLabel(type: string) {
  const labels: Record<string, string> = {
    SYNC_PRODUCT_LIST: "同步商品列表",
    SYNC_PRODUCT_DETAIL: "同步详情",
    SYNC_STORE_SITES: "同步站点币种",
    CHECK_EDIT_PERMISSION: "检查可编辑",
    PARTIAL_EDIT_PRODUCT: "编辑商品资料",
    FIELD_EDIT_PRODUCT: "常用字段编辑",
    ADD_VARIANTS: "拼款/追加变体",
    UPDATE_COST: "更新成本价",
    SYNC_PRODUCT_STATUS: "同步状态",
    BATCH_SYNC_PRODUCT_STATUS: "批量同步状态",
    REVOKE_PRODUCT: "撤回商品",
  }
  return labels[type] || type
}

function actionTitle(kind: JsonActionKind) {
  return kind === "partial-edit" ? "编辑商品资料" : "拼款/追加变体"
}

function defaultActionPayload(kind: JsonActionKind, spuName: string) {
  if (kind === "partial-edit") {
    return JSON.stringify({ spuName, editData: {} }, null, 2)
  }
  return JSON.stringify({ spuName, skcInfoList: [], skuInfoList: [] }, null, 2)
}

function productDetailUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/detail`
}

function productSyncDetailUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/sync-detail`
}

function productCheckEditPermissionUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/check-edit-permission`
}

function productPartialEditUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/partial-edit`
}

function productEditTemplateUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/edit-template`
}

function productFieldEditUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/field-edit`
}

function productVariantTemplateUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/variant-template`
}

function productAddVariantsUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/add-variants`
}

function productUpdateCostUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/update-cost`
}

function productSyncStatusUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/sync-status`
}

function retryOperationUrl(operation: LifecycleOperation) {
  return `/shein-platform-products/operations/${operation.id}/retry`
}

function productRevokeUrl(spuName: string) {
  return `/shein-platform-products/${encodeURIComponent(spuName)}/revoke`
}

function useStoreSites() {
  return useQuery<StoreSitesResponse>({
    queryKey: ["shein-platform-products", "sites"],
    queryFn: () => api.get("/shein-platform-products/sites"),
  })
}

function usePlatformProducts(params: ProductQueryParams) {
  return useQuery<ProductListResponse>({
    queryKey: ["shein-platform-products", "list", params],
    queryFn: () => api.get(platformProductsListUrl(params)),
    placeholderData: keepPreviousData,
  })
}

function useSyncSchedule() {
  return useQuery<SyncScheduleConfig>({
    queryKey: ["shein-platform-products", "sync-schedule"],
    queryFn: () => api.get("/shein-platform-products/sync-schedule"),
  })
}

function platformProductsListUrl(
  params: ProductQueryParams,
  pagination: Pick<ServerPaginationState, "limit" | "offset"> = params.pagination,
  options: { includeDetails?: boolean } = {},
) {
  const search = new URLSearchParams()
  search.set("limit", String(pagination.limit))
  search.set("offset", String(pagination.offset))
  if (options.includeDetails) search.set("includeDetails", "1")
  if (params.search.trim()) search.set("search", params.search.trim())
  if (params.brandFilter.trim()) search.set("brand", params.brandFilter.trim())
  if (params.categoryFilter.trim()) search.set("category", params.categoryFilter.trim())
  if (params.siteFilter.trim()) search.set("site", params.siteFilter.trim())
  return `/shein-platform-products?${search.toString()}`
}

function useProductDetail(spuName: string) {
  return useQuery<ProductDetailResponse>({
    queryKey: ["shein-platform-products", "detail", spuName],
    enabled: Boolean(spuName.trim()),
    retry: false,
    queryFn: () => api.get(productDetailUrl(spuName.trim())),
  })
}

function useEditTemplate(spuName: string, enabled: boolean) {
  return useQuery<EditTemplateResponse>({
    queryKey: ["shein-platform-products", "edit-template", spuName],
    enabled: enabled && Boolean(spuName.trim()),
    retry: false,
    queryFn: () => api.get(productEditTemplateUrl(spuName.trim())),
  })
}

function useVariantTemplate(spuName: string, enabled: boolean) {
  return useQuery<VariantTemplateResponse>({
    queryKey: ["shein-platform-products", "variant-template", spuName],
    enabled: enabled && Boolean(spuName.trim()),
    retry: false,
    queryFn: () => api.get(productVariantTemplateUrl(spuName.trim())),
  })
}

function useCostChangeReasons() {
  return useQuery<CostChangeReasonResponse>({
    queryKey: ["shein-operations", "price-reasons"],
    queryFn: () => api.get("/shein-operations/price-reasons"),
  })
}

function ProductThumb({ src, alt, size = "md" }: { src: string | null; alt: string; size?: "xs" | "sm" | "md" }) {
  const sizes = {
    xs: { box: "h-9 w-9", icon: "size-4" },
    sm: { box: "h-10 w-10", icon: "size-4" },
    md: { box: "h-14 w-14", icon: "size-5" },
  }[size]
  const className = `${sizes.box} rounded-md border object-cover`
  if (!src) {
    return (
      <div className={`flex ${sizes.box} items-center justify-center rounded-md border bg-muted text-muted-foreground`}>
        <ImageIcon className={sizes.icon} />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  )
}

export default function SheinPlatformProductsPage({ view = "list" }: SheinPlatformProductsPageProps) {
  const queryClient = useQueryClient()
  const { tasks, addTask, openTaskCenter } = useAsyncTasks()
  const navigate = useNavigate()
  const { spuName: routeSpuName } = useParams()
  const productTableScrollRef = useRef<HTMLDivElement>(null)
  const productTableBottomScrollRef = useRef<HTMLDivElement>(null)
  const completedPlatformTaskIdsRef = useRef<Set<string>>(new Set())
  const routeSelectedSpuName = view === "detail" ? routeSpuName?.trim() ?? "" : ""
  const [searchInput, setSearchInput] = useState("")
  const [localSelectedSpuName, setSelectedSpuName] = useState("")
  const selectedSpuName = view === "detail" ? routeSelectedSpuName : localSelectedSpuName
  const [costDialogOpen, setCostDialogOpen] = useState(false)
  const [costImportDialogOpen, setCostImportDialogOpen] = useState(false)
  const [costImportRows, setCostImportRows] = useState<CostImportRow[]>([])
  const [costImportFileName, setCostImportFileName] = useState("")
  const [costImportProgress, setCostImportProgress] = useState<CostImportProgress | null>(null)
  const [costForm, setCostForm] = useState<CostForm>(DEFAULT_COST_FORM)
  const [regressionDialogOpen, setRegressionDialogOpen] = useState(false)
  const [regressionForm, setRegressionForm] = useState<RegressionForm>(DEFAULT_REGRESSION_FORM)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<CommonEditForm>(DEFAULT_COMMON_EDIT_FORM)
  const [editFormDirty, setEditFormDirty] = useState(false)
  const [variantDialogOpen, setVariantDialogOpen] = useState(false)
  const [variantForm, setVariantForm] = useState<VariantTemplateForm>(DEFAULT_VARIANT_FORM)
  const [operationsDialogOpen, setOperationsDialogOpen] = useState(false)
  const [jsonActionDialog, setJsonActionDialog] = useState<JsonActionDialogState>(DEFAULT_JSON_ACTION)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncDialogMode, setSyncDialogMode] = useState<SyncDialogMode>("spu")
  const [syncFilters, setSyncFilters] = useState<SyncFilters>(DEFAULT_SYNC_FILTERS)
  const [spuNameSyncText, setSpuNameSyncText] = useState("")
  const [syncScheduleDialogOpen, setSyncScheduleDialogOpen] = useState(false)
  const [syncScheduleForm, setSyncScheduleForm] = useState<SyncScheduleForm>(DEFAULT_SYNC_SCHEDULE_FORM)
  const [saleSitesDialogProduct, setSaleSitesDialogProduct] = useState<PlatformProductRow | null>(null)
  const [detailSection, setDetailSection] = useState<DetailSection>("product")
  const [exportingPlatformProducts, setExportingPlatformProducts] = useState(false)
  const [queryParams, setQueryParams] = useState<ProductQueryParams>({
    pagination: { limit: 50, offset: 0, total: 0 },
    search: "",
    brandFilter: "",
    categoryFilter: "",
    siteFilter: "",
  })

  const sitesQuery = useStoreSites()
  const productsQuery = usePlatformProducts(queryParams)
  const syncScheduleQuery = useSyncSchedule()
  const detailQuery = useProductDetail(selectedSpuName)
  const editTemplateQuery = useEditTemplate(selectedSpuName, editDialogOpen)
  const variantTemplateQuery = useVariantTemplate(selectedSpuName, variantDialogOpen)
  const costReasonsQuery = useCostChangeReasons()

  const siteRows = useMemo(() => sitesQuery.data?.items ?? [], [sitesQuery.data])
  const productRows = productsQuery.data?.items ?? []
  const productsErrorMessage = productsQuery.error instanceof Error
    ? productsQuery.error.message
    : "平台商品列表读取失败"
  const brandOptions = productsQuery.data?.filters?.brands ?? []
  const categoryOptions = productsQuery.data?.filters?.categories ?? []
  const siteOptions = productsQuery.data?.filters?.sites ?? []
  const detail = detailQuery.data ?? null
  const detailProduct = detail?.product
  const detailSaleSites = detailProduct?.saleSites ?? EMPTY_SALE_SITES
  const saleSitesDialogSites = saleSitesDialogProduct?.spuName === detailProduct?.spuName
    ? detailProduct?.saleSites ?? EMPTY_SALE_SITES
    : EMPTY_SALE_SITES
  const saleSitesDialogLoading = Boolean(
    saleSitesDialogProduct
      && selectedSpuName === saleSitesDialogProduct.spuName
      && detailQuery.isLoading,
  )
  const currencyOptions = useMemo(() => {
    const currencies = Array.from(new Set(siteRows.map((site) => site.currency).filter(Boolean)))
    return currencies.length ? currencies : ["CNY", "USD", "EUR"]
  }, [siteRows])

  const pagination = {
    total: productsQuery.data?.pagination.total ?? queryParams.pagination.total,
    limit: queryParams.pagination.limit,
    offset: queryParams.pagination.offset,
  }
  const activeSites = siteRows.filter((site) => site.status === 1)
  const recentOperations = detail?.operations?.length ? detail.operations : productsQuery.data?.operations ?? []
  const visibleEditForm = editFormDirty
    ? editForm
    : {
        ...DEFAULT_COMMON_EDIT_FORM,
        ...editTemplateQuery.data?.form,
        skuUpdates: editTemplateQuery.data?.form?.skuUpdates ?? [],
      }
  const costChangeReasons = costReasonsQuery.data?.items ?? []
  const costReasonSource = costReasonsQuery.data?.source ?? "DOCUMENT_FALLBACK"
  const selectedCostItems = costForm.items.filter((item) => item.selected)
  const costIncreased = selectedCostItems.some((item) => Number(costForm.cost) > Number(item.originalCost || 0))
  const costImportProgressValue = costImportProgress?.totalGroups
    ? (costImportProgress.completedGroups / costImportProgress.totalGroups) * 100
    : 0
  const spuNamesToSync = useMemo(
    () => splitSpuNames(spuNameSyncText, MAX_SPU_NAME_SYNC_COUNT),
    [spuNameSyncText],
  )
  const scheduledSpuNames = useMemo(
    () => splitSpuNames(syncScheduleForm.spu_names_text, MAX_SPU_NAME_SYNC_COUNT),
    [syncScheduleForm.spu_names_text],
  )
  const alreadyRunningScheduledSync = Boolean(
    syncScheduleQuery.data?.active_job && syncScheduleQuery.data.active_job.status !== "completed",
  )

  useEffect(() => {
    for (const task of tasks) {
      if (task.type !== "shein_platform_product_sync" || task.job?.status !== "completed") continue
      if (completedPlatformTaskIdsRef.current.has(task.id)) continue
      completedPlatformTaskIdsRef.current.add(task.id)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    }
  }, [queryClient, tasks])

  const detailSectionTabs = useMemo(
    () => [
      { value: "product" as const, label: "商品明细" },
      { value: "sites" as const, label: "销售站点明细" },
    ],
    [],
  )

  const syncProductsMutation = useMutation({
    mutationFn: () => {
      const mode = syncFilters.rangeMode === "all" ? "full" : "incremental"
      const payload: JsonRecord = {
        mode,
        pageSize: Number(syncFilters.pageSize) || 50,
        maxPages: Number(syncFilters.maxPages) || (mode === "full" ? 1000 : 50),
        detailLimit: Number(syncFilters.detailLimit) || 100000,
        syncDetails: syncFilters.syncDetails,
      }
      if (syncFilters.rangeMode === "custom") {
        const startKey = syncFilters.syncTimeField === "updateTime" ? "updateTimeStart" : "insertTimeStart"
        const endKey = syncFilters.syncTimeField === "updateTime" ? "updateTimeEnd" : "insertTimeEnd"
        if (syncFilters.timeStart.trim()) payload[startKey] = platformTimeInputValue(syncFilters.timeStart)
        if (syncFilters.timeEnd.trim()) payload[endKey] = platformTimeInputValue(syncFilters.timeEnd)
      }
      return api.post<AsyncTaskJob>(
        "/shein-platform-products/sync-jobs",
        payload,
      )
    },
    onSuccess: (job) => {
      addTask({
        job,
        type: "shein_platform_product_sync",
        title: "同步 SHEIN 平台商品",
        description: `后台同步列表并补齐商品详情，任务 ${job.id.slice(0, 8)}`,
        endpoint: `/shein-platform-products/sync-jobs/${job.id}`,
      })
      toast.success("已加入异步任务：同步 SHEIN 平台商品")
      openTaskCenter()
      setSyncDialogOpen(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "同步平台商品失败"),
  })

  const syncSpuProductsMutation = useMutation({
    mutationFn: async () => {
      if (!spuNamesToSync.length) throw new Error("请输入要同步的款号/SPU")
      return api.post<AsyncTaskJob>("/shein-platform-products/sync-jobs", { spuNames: spuNamesToSync })
    },
    onSuccess: (job) => {
      if (spuNamesToSync[0]) setSelectedSpuName(spuNamesToSync[0])
      addTask({
        job,
        type: "shein_platform_product_sync",
        title: "按款号同步 SHEIN 平台商品",
        description: `后台同步 ${formatNumber(job.total_count)} 个 SPU 详情`,
        endpoint: `/shein-platform-products/sync-jobs/${job.id}`,
      })
      toast.success(`已加入异步任务：${formatNumber(job.total_count)} 个 SPU`)
      openTaskCenter()
      setSyncDialogOpen(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "按款号同步失败"),
  })

  const syncScheduleMutation = useMutation({
    mutationFn: () => {
      const scheduleHour = Number(syncScheduleForm.schedule_hour)
      if (!Number.isInteger(scheduleHour) || scheduleHour < 0 || scheduleHour > 23) {
        throw new Error("执行小时需为 0-23 的整数")
      }
      if (syncScheduleForm.sync_scope === "spu" && scheduledSpuNames.length === 0) {
        throw new Error("自定义 SPU 款号同步至少需要 1 个款号")
      }
      return api.put<SyncScheduleConfig>("/shein-platform-products/sync-schedule", {
        enabled: syncScheduleForm.enabled,
        schedule_hour: scheduleHour,
        sync_scope: syncScheduleForm.sync_scope,
        spu_names: scheduledSpuNames,
      })
    },
    onSuccess: (config) => {
      setSyncScheduleForm(syncScheduleConfigToForm(config))
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products", "sync-schedule"] })
      toast.success("定时同步配置已生效")
      setSyncScheduleDialogOpen(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存定时同步配置失败"),
  })

  const detailSaleSiteRows = useMemo(
    () =>
      detailSaleSites.map((site) => ({
        ...site,
        displayName: site.siteName || site.siteAbbr || "—",
        siteCode: site.siteAbbr || "—",
      })),
    [detailSaleSites],
  )
  const detailSaleSiteSummary = useMemo(() => {
    if (!detailSaleSiteRows.length) return detailProduct?.saleSiteSummary || "详情同步后显示"
    const activeSites = detailSaleSiteRows.filter((site) => site.shelfStatus === 1)
    if (!activeSites.length) return "未上架"
    const preview = activeSites
      .slice(0, 4)
      .map((site) => `${site.displayName} (${site.siteCode})`)
      .join("、")
    return `上架 ${formatNumber(activeSites.length)} 站：${preview}${activeSites.length > 4 ? "..." : ""}`
  }, [detailProduct?.saleSiteSummary, detailSaleSiteRows])

  function syncProductTableScroll(source: "table" | "bottom") {
    const tableScroller = productTableScrollRef.current
    const bottomScroller = productTableBottomScrollRef.current
    if (!tableScroller || !bottomScroller) return
    if (source === "table") {
      if (bottomScroller.scrollLeft !== tableScroller.scrollLeft) {
        bottomScroller.scrollLeft = tableScroller.scrollLeft
      }
      return
    }
    if (tableScroller.scrollLeft !== bottomScroller.scrollLeft) {
      tableScroller.scrollLeft = bottomScroller.scrollLeft
    }
  }

  function openSyncScheduleDialog() {
    setSyncScheduleForm(syncScheduleConfigToForm(syncScheduleQuery.data))
    setSyncScheduleDialogOpen(true)
    void syncScheduleQuery.refetch().then((result) => {
      if (result.data) setSyncScheduleForm(syncScheduleConfigToForm(result.data))
    })
  }

  const syncSitesMutation = useMutation({
    mutationFn: () =>
      api.post<{ result: PlatformRequestResult; persistence: { siteCount: number } }>(
        "/shein-platform-products/sites/sync",
        {},
      ),
    onSuccess: (data) => {
      if (!responseOk(data.result)) {
        toast.error(`查询站点币种失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success(`站点币种已同步：${formatNumber(data.persistence.siteCount)} 个站点`)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products", "sites"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "查询站点币种失败"),
  })

  const syncDetailMutation = useMutation({
    mutationFn: (spuName: string) => api.post<{ result: PlatformRequestResult }>(productSyncDetailUrl(spuName), {}),
    onSuccess: (_data, spuName) => {
      toast.success("SPU 详情已同步")
      setSelectedSpuName(spuName)
      if (view !== "detail") {
        navigate(`/shein-platform-products/${encodeURIComponent(spuName)}`)
      }
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "同步详情失败"),
  })

  const checkEditMutation = useMutation({
    mutationFn: (spuName: string) => api.post<{ result: PlatformRequestResult }>(productCheckEditPermissionUrl(spuName), {}),
    onSuccess: (data: { result: PlatformRequestResult }, spuName) => {
      if (!responseOk(data.result)) {
        toast.error(`检查可编辑失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success("可编辑状态已更新")
      setSelectedSpuName(spuName)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "检查可编辑失败"),
  })

  const fieldEditMutation = useMutation({
    mutationFn: () => {
      if (!selectedSpuName.trim()) throw new Error("请先选择 SPU")
      return api.post<{ result: PlatformRequestResult }>(productFieldEditUrl(selectedSpuName), { form: visibleEditForm })
    },
    onSuccess: (data) => {
      if (!responseOk(data.result)) {
        toast.error(`常用字段编辑失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success(`常用字段编辑已提交${responseTraceId(data.result) ? `，Trace ${responseTraceId(data.result)}` : ""}`)
      setEditDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "常用字段编辑失败"),
  })

  const jsonActionMutation = useMutation({
    mutationFn: () => {
      const payload = parseJsonPayload(jsonActionDialog.payloadText)
      const path = jsonActionDialog.kind === "partial-edit"
        ? productPartialEditUrl(jsonActionDialog.spuName)
        : productAddVariantsUrl(jsonActionDialog.spuName)
      return api.post<{ result: PlatformRequestResult }>(path, payload)
    },
    onSuccess: (data) => {
      if (!responseOk(data.result)) {
        toast.error(`${actionTitle(jsonActionDialog.kind)}失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success(`${actionTitle(jsonActionDialog.kind)}已提交${responseTraceId(data.result) ? `，Trace ${responseTraceId(data.result)}` : ""}`)
      setJsonActionDialog(DEFAULT_JSON_ACTION)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : `${actionTitle(jsonActionDialog.kind)}失败`),
  })

  const addVariantTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSpuName.trim()) throw new Error("请先选择 SPU")
      const templatePayload = recordValue(variantTemplateQuery.data?.payload)
      const skcList = recordArray(templatePayload.skc_list)
      const cost = numberValue(variantForm.cost)
      const supplierSku = variantForm.skuSupplierSku.trim()
      const newSku = compactRecord({
        supplier_sku: supplierSku,
        height: variantForm.height.trim(),
        length: variantForm.length.trim(),
        weight: variantForm.weight.trim(),
        width: variantForm.width.trim(),
        mall_state: numberValue(variantForm.mallState),
        stop_purchase: numberValue(variantForm.stopPurchase),
        sale_attribute_list: [
          compactRecord({
            attribute_id: numberValue(variantForm.skuAttributeId) ?? variantForm.skuAttributeId.trim(),
            attribute_value_id: numberValue(variantForm.skuAttributeValueId) ?? variantForm.skuAttributeValueId.trim(),
          }),
        ].filter((item) => item.attribute_id || item.attribute_value_id),
        cost_info: cost
          ? {
              cost_price: cost.toFixed(2),
              currency: variantForm.currency,
            }
          : undefined,
      })
      const newSkc = compactRecord({
        supplier_code: variantForm.skcSupplierCode.trim(),
        shelf_way: 1,
        sale_attribute: compactRecord({
          attribute_id: numberValue(variantForm.skcAttributeId) ?? variantForm.skcAttributeId.trim(),
          attribute_value_id: numberValue(variantForm.skcAttributeValueId) ?? variantForm.skcAttributeValueId.trim(),
        }),
        image_info: variantForm.imageUrl.trim()
          ? {
              image_info_list: [
                {
                  image_sort: 1,
                  image_type: 1,
                  image_url: variantForm.imageUrl.trim(),
                },
              ],
            }
          : undefined,
        sku_list: [newSku],
      })
      if (!newSkc.supplier_code || !recordArray(newSkc.sku_list)[0]?.supplier_sku) {
        throw new Error("请填写新增 SKC 供应商货号和新增 SKU 供应商货号")
      }
      const check = await api.post<SupplierSkuCheckResult>("/shein-operations/platform-identities/supplier-sku/check", {
        supplierSkuList: [supplierSku],
        sourceType: "ADD_VARIANTS",
        sourceId: selectedSpuName,
      })
      if (check.repeated.some((item) => item.repeated)) {
        throw new Error(`商家 SKU 已在 SHEIN 存在：${check.repeated.map((item) => item.supplierSku).join("、")}`)
      }
      const payload = {
        ...templatePayload,
        spu_name: stringValue(templatePayload.spu_name) || selectedSpuName,
        skc_list: [...skcList, newSkc],
      }
      return api.post<{ result: PlatformRequestResult }>(productAddVariantsUrl(selectedSpuName), payload)
    },
    onSuccess: (data) => {
      if (!responseOk(data.result)) {
        toast.error(`拼款模板提交失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success(`拼款模板已提交${responseTraceId(data.result) ? `，Trace ${responseTraceId(data.result)}` : ""}`)
      setVariantDialogOpen(false)
      setVariantForm(DEFAULT_VARIANT_FORM)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "拼款模板提交失败"),
  })

  const updateCostMutation = useMutation({
    mutationFn: () => {
      const cost = Number(costForm.cost)
      const selectedItems = costForm.items.filter((item) => item.selected)
      if (!costForm.spuName || !selectedItems.length) {
        throw new Error("请先选择 SPU 和至少一个 SKU")
      }
      if (!Number.isFinite(cost) || cost <= 0 || cost >= 100000) {
        throw new Error("供货价需大于 0 且小于 100000")
      }
      if (costIncreased && !costForm.changeReasonCode) {
        throw new Error("成本价上涨时请选择涨价原因")
      }
      const skcGroups = selectedItems.reduce<Record<string, CostItem[]>>((groups, item) => {
        groups[item.skcName] = [...(groups[item.skcName] ?? []), item]
        return groups
      }, {})
      return api.post<{ result: PlatformRequestResult }>(productUpdateCostUrl(costForm.spuName), {
        change_reason_code: costForm.changeReasonCode || undefined,
        spu_name: costForm.spuName,
        skc_info_list: Object.entries(skcGroups).map(([skcName, items]) => ({
          skc_name: skcName,
          sku_info_list: items.map((item) => ({
            sku_code: item.skuCode,
            cost: cost.toFixed(2),
            currency: costForm.currency,
          })),
        })),
      })
    },
    onSuccess: (data) => {
      if (!responseOk(data.result)) {
        toast.error(`更新成本价失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success(`批量供货价已提交${responseTraceId(data.result) ? `，Trace ${responseTraceId(data.result)}` : ""}`)
      setCostDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "更新成本价失败"),
  })

  const costImportMutation = useMutation({
    mutationFn: async () => {
      const batch = buildCostImportRequests(costImportRows)
      setCostImportProgress({
        completedGroups: 0,
        totalGroups: batch.requests.length,
        rowCount: batch.rowCount,
        currentSpuName: "",
        ok: true,
        message: "",
      })
      return submitCostImportRows(
        costImportRows,
        (spuName, payload) => api.post<{ result: PlatformRequestResult }>(productUpdateCostUrl(spuName), payload),
        {
          concurrency: 4,
          onProgress: (progress) => setCostImportProgress(progress),
        },
      )
    },
    onSuccess: ({ results, rowCount, groupCount }) => {
      const failed = results.filter((result) => !result.ok)
      if (failed.length) {
        toast.error(`表格导入供货价部分失败：${formatNumber(failed.length)} / ${formatNumber(groupCount)} 组，首个失败 SPU ${failed[0]?.spuName} ${failed[0]?.message}`)
        return
      }
      toast.success(`表格导入供货价已提交：${formatNumber(rowCount)} 行 / ${formatNumber(groupCount)} 组`)
      setCostImportDialogOpen(false)
      setCostImportRows([])
      setCostImportFileName("")
      setCostImportProgress(null)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "表格导入供货价失败"),
  })

  const regressionLogMutation = useMutation({
    mutationFn: () => api.post("/shein-operations/p0-regression/logs", {
      ...regressionForm,
      requestPayload: {},
      responsePayload: {},
    }),
    onSuccess: () => {
      toast.success("真实数据回归记录已保存")
      setRegressionDialogOpen(false)
      setRegressionForm(DEFAULT_REGRESSION_FORM)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存真实数据回归记录失败"),
  })

  const syncStatusMutation = useMutation({
    mutationFn: (spuName: string) => api.post<{ result: PlatformRequestResult }>(productSyncStatusUrl(spuName), {}),
    onSuccess: (data, spuName) => {
      if (!responseOk(data.result)) {
        toast.error(`同步状态失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success("同步状态完成")
      setSelectedSpuName(spuName)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "同步状态失败"),
  })

  const batchSyncStatusMutation = useMutation({
    mutationFn: () =>
      api.post<{ result: PlatformRequestResult | null }>("/shein-platform-products/status/sync", {
        limit: queryParams.pagination.limit,
      }),
    onSuccess: (data) => {
      if (data.result && !responseOk(data.result)) {
        toast.error(`批量同步状态失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success("批量同步状态完成")
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "批量同步状态失败"),
  })

  const retryOperationMutation = useMutation({
    mutationFn: (operation: LifecycleOperation) => api.post<{ retry: { result?: PlatformRequestResult } }>(retryOperationUrl(operation), {}),
    onSuccess: () => {
      toast.success("重试失败操作已提交")
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "重试失败操作失败"),
  })

  const revokeMutation = useMutation({
    mutationFn: (spuName: string) => api.post<{ result: PlatformRequestResult }>(productRevokeUrl(spuName), {}),
    onSuccess: (data) => {
      if (!responseOk(data.result)) {
        toast.error(`撤回商品失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success("撤回商品已提交")
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "撤回商品失败"),
  })

  function openCostDialog(input: { spuName: string; skcName: string; skuCode: string; supplierSku: string; cost: string; currency: string }) {
    setCostForm({
      ...DEFAULT_COST_FORM,
      currency: input.currency || currencyOptions[0] || DEFAULT_COST_FORM.currency,
      spuName: input.spuName,
      cost: input.cost || "",
      items: [
        {
          skcName: input.skcName,
          skuCode: input.skuCode,
          supplierSku: input.supplierSku,
          originalCost: input.cost || "",
          selected: true,
        },
      ],
    })
    setCostDialogOpen(true)
  }

  function detailCostItems(productDetail: ProductDetailResponse) {
    return productDetail.skcs.flatMap((skc) =>
      skc.skus.map((sku) => ({
        skcName: skc.skcName,
        skuCode: sku.skuCode,
        supplierSku: sku.supplierSku,
        originalCost: sku.currentCost,
        selected: true,
      })),
    ).filter((item) => item.skcName && item.skuCode)
  }

  function openBatchCostDialog(spuName: string, items: CostItem[], defaultCurrency?: string) {
    if (!spuName.trim()) {
      toast.error("请先选择 SPU")
      return
    }
    if (!items.length) {
      toast.error("本地尚未同步 SKU 明细，请先同步 SPU 详情")
      return
    }
    setCostForm({
      ...DEFAULT_COST_FORM,
      spuName: spuName.trim(),
      currency: defaultCurrency || currencyOptions[0] || DEFAULT_COST_FORM.currency,
      items,
    })
    setCostDialogOpen(true)
  }

  function openSaleSitesDialog(row: PlatformProductRow) {
    setSelectedSpuName(row.spuName)
    setSaleSitesDialogProduct(row)
  }

  async function openBatchCostDialogFromList(row: PlatformProductRow) {
    try {
      const productDetail = await queryClient.fetchQuery<ProductDetailResponse>({
        queryKey: ["shein-platform-products", "detail", row.spuName],
        queryFn: () => api.get(productDetailUrl(row.spuName)),
        staleTime: 30_000,
      })
      const items = detailCostItems(productDetail)
      openBatchCostDialog(row.spuName, items, productDetail.skcs.flatMap((skc) => skc.skus).find((sku) => sku.currency)?.currency)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "本地尚未同步该 SPU 详情，请先同步详情")
    }
  }

  async function handleCostImportFile(file: File | null) {
    if (!file) return
    try {
      const rows = await readSpreadsheetFile(file)
      const parsedRows = parseCostImportRows(rows)
      setCostImportRows(parsedRows)
      setCostImportFileName(file.name)
      setCostImportProgress(null)
      if (!parsedRows.length) {
        toast.error("表格中没有可识别的供货价行")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "表格解析失败")
    }
  }

  function handleCostImportDialogOpenChange(open: boolean) {
    if (costImportMutation.isPending) return
    setCostImportDialogOpen(open)
    if (!open) {
      setCostImportProgress(null)
    }
  }

  async function downloadCostImportTemplate() {
    try {
      await exportSpreadsheet("SHEIN平台商品供货价导入模板.xlsx", COST_IMPORT_TEMPLATE_ROWS)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出模板失败")
    }
  }

  async function exportPlatformProducts() {
    setExportingPlatformProducts(true)
    try {
      if (pagination.total <= 0) {
        toast.error("当前筛选条件下没有可导出的平台商品")
        return
      }
      const job = await api.post<AsyncTaskJob>("/shein-platform-products/export-jobs", {
        search: queryParams.search,
        brand: queryParams.brandFilter,
        category: queryParams.categoryFilter,
        site: queryParams.siteFilter,
        includeDetails: true,
      })
      addTask({
        job,
        type: "shein_platform_product_export",
        title: "导出 SHEIN 平台商品列表",
        description: `后台生成 SHEIN平台商品列表.xlsx，预计 ${formatNumber(pagination.total)} 条平台商品`,
        endpoint: `/shein-platform-products/export-jobs/${job.id}`,
      })
      toast.success("已加入异步任务：导出 SHEIN 平台商品列表")
      openTaskCenter()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出平台商品失败")
    } finally {
      setExportingPlatformProducts(false)
    }
  }

  function openEditDialog(spuName: string) {
    const normalized = spuName.trim()
    if (!normalized) {
      toast.error("请先选择 SPU")
      return
    }
    setSelectedSpuName(normalized)
    setEditForm(DEFAULT_COMMON_EDIT_FORM)
    setEditFormDirty(false)
    setEditDialogOpen(true)
  }

  function openVariantDialog(spuName: string) {
    const normalized = spuName.trim()
    if (!normalized) {
      toast.error("请先选择 SPU")
      return
    }
    setSelectedSpuName(normalized)
    setVariantForm({
      ...DEFAULT_VARIANT_FORM,
      currency: currencyOptions[0] || DEFAULT_VARIANT_FORM.currency,
    })
    setVariantDialogOpen(true)
  }

  function updateEditSku(index: number, patch: Partial<EditSkuForm>) {
    setEditFormDirty(true)
    setEditForm((current) => ({
      ...visibleEditForm,
      ...current,
      skuUpdates: visibleEditForm.skuUpdates.map((sku, skuIndex) => (skuIndex === index ? { ...sku, ...patch } : sku)),
    }))
  }

  function patchEditForm(patch: Partial<CommonEditForm>) {
    setEditFormDirty(true)
    setEditForm((current) => ({
      ...visibleEditForm,
      ...current,
      ...patch,
    }))
  }

  function openJsonAction(kind: JsonActionKind, spuName: string) {
    const normalized = spuName.trim()
    if (!normalized) {
      toast.error("请先选择 SPU")
      return
    }
    setJsonActionDialog({
      open: true,
      kind,
      spuName: normalized,
      payloadText: defaultActionPayload(kind, normalized),
    })
  }

  function submitSearch() {
    setQueryParams((current) => ({
      ...current,
      search: searchInput.trim(),
      pagination: { ...current.pagination, offset: 0 },
    }))
  }

  const productSummary = [
    `本地 SPU ${formatNumber(pagination.total)}`,
    `当前页 ${formatNumber(productRows.length)}`,
    selectedSpuName ? `当前 ${selectedSpuName}` : "",
  ].filter(Boolean).join(" / ")

  const operationSourceLabel = selectedSpuName ? `当前 SPU：${selectedSpuName}` : "最近平台商品操作"

  return (
    <PageContainer className={view === "list" ? "flex min-h-0 flex-col gap-3 overflow-hidden px-4 py-3 md:px-6 md:py-4" : "space-y-6"}>
      {view === "list" ? (
        <section className="shrink-0 rounded-2xl border bg-card px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:px-5">
          <div className="flex flex-col gap-3 min-[980px]:flex-row min-[980px]:items-center min-[980px]:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold leading-7 text-foreground">平台商品列表</h1>
                <Badge variant="secondary" className="font-normal">
                  {productSummary}
                </Badge>
              </div>
              <p className="platform-product-header-description mt-1 hidden text-xs leading-5 text-muted-foreground min-[1180px]:block">
                同步 SHEIN 平台已上架商品并持久化到本地，作为商品链接全生命周期管理入口。
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => setSyncDialogOpen(true)}
                disabled={syncProductsMutation.isPending || syncSpuProductsMutation.isPending}
              >
                {syncProductsMutation.isPending || syncSpuProductsMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PackageSearch className="size-4" />
                )}
                同步商品
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="hidden min-[1120px]:inline-flex"
                onClick={() => batchSyncStatusMutation.mutate()}
                disabled={batchSyncStatusMutation.isPending}
              >
                {batchSyncStatusMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
                批量同步状态
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" aria-label="更多列表操作">
                    <MoreHorizontal className="size-4" />
                    更多
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>列表操作</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => openSyncScheduleDialog()}>
                    <Settings2 className="size-4" />
                    定时同步
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="min-[1120px]:hidden"
                    onSelect={() => batchSyncStatusMutation.mutate()}
                    disabled={batchSyncStatusMutation.isPending}
                  >
                    <ClipboardCheck className="size-4" />
                    批量同步状态
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCostImportDialogOpen(true)}>
                    <Upload className="size-4" />
                    表格导入更新供货价
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => void exportPlatformProducts()}
                    disabled={exportingPlatformProducts || pagination.total <= 0}
                  >
                    {exportingPlatformProducts ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    导出列表
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setOperationsDialogOpen(true)}>
                    <History className="size-4" />
                    查看最近操作
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </section>
      ) : (
        <PageHeader
          title={view === "sites" ? "站点币种" : "SPU 商品详情"}
          description={
            view === "sites"
              ? "查询和同步 SHEIN 店铺站点、币种、启用状态，为供货价、拼款和站点运营提供基础口径。"
              : "从平台商品列表进入单个 SPU，查看 SKC/SKU 明细并处理编辑、拼款、供货价和状态同步。"
          }
        >
          {view === "detail" ? (
            <Button variant="outline" onClick={() => navigate("/shein-platform-products")}>
              <ArrowLeft className="size-4" />
              返回列表
            </Button>
          ) : null}
          {view === "sites" ? (
            <Button variant="outline" onClick={() => syncSitesMutation.mutate()} disabled={syncSitesMutation.isPending}>
              {syncSitesMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Globe2 className="size-4" />}
              同步站点币种
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setOperationsDialogOpen(true)}>
            <History className="size-4" />
            查看最近操作
          </Button>
        </PageHeader>
      )}

      {view === "list" ? (
        <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
          <CardHeader className="shrink-0 border-b px-4 py-3 md:px-5">
            <div className="flex flex-col gap-2 min-[980px]:flex-row min-[980px]:items-center min-[980px]:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">本地 SPU {formatNumber(pagination.total)}</span>
                <span>当前页 {formatNumber(productRows.length)}</span>
                {selectedSpuName ? <span>当前 {selectedSpuName}</span> : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 min-[980px]:justify-end">
                <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submitSearch()
                    }}
                    placeholder="搜索 SPU、SKC、供方货号"
                    className="h-8 pl-9 text-sm"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={submitSearch}>
                  <Search className="size-4" />
                  搜索
                </Button>
                <div className="platform-product-inline-filters flex flex-wrap items-center gap-2">
                  <Select
                    value={queryParams.brandFilter || ALL_FILTER_VALUE}
                    onValueChange={(value) =>
                      setQueryParams((current) => ({
                        ...current,
                        brandFilter: value === ALL_FILTER_VALUE ? "" : value,
                        pagination: { ...current.pagination, offset: 0 },
                      }))
                    }
                  >
                    <SelectTrigger size="sm" className="w-40">
                      <SelectValue placeholder="品牌名称" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>全部品牌</SelectItem>
                      {brandOptions.map((brand) => (
                        <SelectItem key={brand.value} value={brand.value}>
                          {brand.label} ({formatNumber(brand.count)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={queryParams.categoryFilter || ALL_FILTER_VALUE}
                    onValueChange={(value) =>
                      setQueryParams((current) => ({
                        ...current,
                        categoryFilter: value === ALL_FILTER_VALUE ? "" : value,
                        pagination: { ...current.pagination, offset: 0 },
                      }))
                    }
                  >
                    <SelectTrigger size="sm" className="w-44">
                      <SelectValue placeholder="类目名称" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>全部类目</SelectItem>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label} ({formatNumber(category.count)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={queryParams.siteFilter || ALL_FILTER_VALUE}
                    onValueChange={(value) =>
                      setQueryParams((current) => ({
                        ...current,
                        siteFilter: value === ALL_FILTER_VALUE ? "" : value,
                        pagination: { ...current.pagination, offset: 0 },
                      }))
                    }
                  >
                    <SelectTrigger size="sm" className="w-40">
                      <SelectValue placeholder="销售站点" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>全部销售站点</SelectItem>
                      {siteOptions.map((site) => (
                        <SelectItem key={site.value} value={site.value}>
                          {site.count > 0 ? `${site.label} (${formatNumber(site.count)})` : site.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="platform-product-filter-popover">
                      <Settings2 className="size-4" />
                      筛选
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[min(92vw,22rem)] p-3">
                    <div className="grid gap-2">
                      <Select
                        value={queryParams.brandFilter || ALL_FILTER_VALUE}
                        onValueChange={(value) =>
                          setQueryParams((current) => ({
                            ...current,
                            brandFilter: value === ALL_FILTER_VALUE ? "" : value,
                            pagination: { ...current.pagination, offset: 0 },
                          }))
                        }
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue placeholder="品牌名称" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_FILTER_VALUE}>全部品牌</SelectItem>
                          {brandOptions.map((brand) => (
                            <SelectItem key={brand.value} value={brand.value}>
                              {brand.label} ({formatNumber(brand.count)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={queryParams.categoryFilter || ALL_FILTER_VALUE}
                        onValueChange={(value) =>
                          setQueryParams((current) => ({
                            ...current,
                            categoryFilter: value === ALL_FILTER_VALUE ? "" : value,
                            pagination: { ...current.pagination, offset: 0 },
                          }))
                        }
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue placeholder="类目名称" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_FILTER_VALUE}>全部类目</SelectItem>
                          {categoryOptions.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label} ({formatNumber(category.count)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={queryParams.siteFilter || ALL_FILTER_VALUE}
                        onValueChange={(value) =>
                          setQueryParams((current) => ({
                            ...current,
                            siteFilter: value === ALL_FILTER_VALUE ? "" : value,
                            pagination: { ...current.pagination, offset: 0 },
                          }))
                        }
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue placeholder="销售站点" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_FILTER_VALUE}>全部销售站点</SelectItem>
                          {siteOptions.map((site) => (
                            <SelectItem key={site.value} value={site.value}>
                              {site.count > 0 ? `${site.label} (${formatNumber(site.count)})` : site.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void productsQuery.refetch()}
                  disabled={productsQuery.isFetching}
                >
                  <RefreshCw className={productsQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
                  刷新
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-0 pt-3 md:px-5">
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
              <Table
                className="min-w-[1600px] table-fixed"
                containerRef={productTableScrollRef}
                containerClassName="hide-horizontal-scrollbar h-full overflow-x-hidden overflow-y-auto"
                containerOnScroll={() => syncProductTableScroll("table")}
              >
                <colgroup>
                  <col className="w-[82px]" />
                  <col className="w-[230px]" />
                  <col className="w-[320px]" />
                  <col className="w-[430px]" />
                  <col className="w-[150px]" />
                  <col className="w-[230px]" />
                  <col className="w-[190px]" />
                  <col className="w-[190px]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[82px]">商品图片</TableHead>
                    <TableHead>SPU</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead>SKC</TableHead>
                    <TableHead>供货价</TableHead>
                    <TableHead>销售站点</TableHead>
                    <TableHead>同步状态</TableHead>
                    <TableHead className="sticky right-0 z-20 bg-muted text-right shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.55)]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        加载本地平台商品...
                      </TableCell>
                    </TableRow>
                  ) : productsQuery.isError ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <div className="mx-auto flex max-w-xl flex-col items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                          <div className="font-medium">平台商品列表读取失败</div>
                          <div className="text-xs">{productsErrorMessage}</div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void productsQuery.refetch()}
                          >
                            <RefreshCw className="size-4" />
                            重新加载
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : productRows.length ? (
                    productRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="align-top">
                          <ProductThumb src={row.imageUrl} alt={row.productName || row.spuName} />
                        </TableCell>
                        <TableCell className="align-top">
                          <button
                            type="button"
                            className="font-mono text-sm font-medium hover:text-[var(--brand-deep)] hover:underline"
                            onClick={() => navigate(`/shein-platform-products/${encodeURIComponent(row.spuName)}`)}
                          >
                            {row.spuName}
                          </button>
                          <div className="mt-1 text-xs text-muted-foreground">{row.supplierCode || "—"}</div>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <div className="max-w-[280px] truncate text-sm font-medium">{row.productName || "—"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            品牌名称：{row.brandName || "—"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            类目名称：{row.categoryName || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <div className="text-sm font-medium">
                            SKC {formatNumber(row.skcCount)}
                          </div>
                          <div className="mt-2 max-h-[252px] overflow-y-auto pr-1">
                            {row.skcs.length ? (
                              <div className="grid gap-1.5">
                                {row.skcs.map((skc) => (
                                  <div key={skc.skcName} className="grid min-h-14 grid-cols-[36px_minmax(0,1fr)] gap-2 rounded-md border bg-background/80 p-1.5">
                                    <ProductThumb src={skc.imageUrl} alt={skc.skcName} size="xs" />
                                    <div className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <span className="min-w-0 truncate font-mono text-[11px] font-medium" title={skc.skcName || undefined}>
                                          {skc.skcName || "—"}
                                        </span>
                                      </div>
                                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={skc.supplierCode || undefined}>
                                        SKC供方：{skc.supplierCode || "—"}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">详情同步后显示 SKC</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <div className="max-w-[150px] truncate text-sm">{row.costSummary || "—"}</div>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full max-w-full justify-start truncate"
                            onClick={() => openSaleSitesDialog(row)}
                          >
                            <Globe2 className="size-4 shrink-0" />
                            <span className="truncate">{row.saleSiteSummary || "详情同步后显示"}</span>
                          </Button>
                          {row.saleSiteCount ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              上架站点数 {formatNumber(row.saleSiteCount)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <Badge variant={row.lastDetailSyncedAt ? "secondary" : "outline"}>
                            {row.lastDetailSyncedAt ? "已同步详情" : "仅列表"}
                          </Badge>
                          {row.productStatus ? (
                            <div className="mt-1">
                              <Badge variant={row.productStatus === "REJECTED" ? "destructive" : "outline"}>
                                {row.productStatus}
                              </Badge>
                            </div>
                          ) : null}
                          {row.editableStatus ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              可编辑：{row.editableStatus}
                            </div>
                          ) : null}
                          <div className="mt-1 break-all text-xs text-muted-foreground">
                            {row.lastDetailSyncedAt || row.lastListSyncedAt || row.updatedAt || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 bg-card align-top text-right shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.55)] group-hover:bg-accent">
                          <div className="flex flex-col items-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-end"
                              onClick={() => void openBatchCostDialogFromList(row)}
                            >
                              <DollarSign className="size-4" />
                              批量更新供货价
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-end"
                              onClick={() => navigate(`/shein-platform-products/${encodeURIComponent(row.spuName)}`)}
                            >
                              <Eye className="size-4" />
                              SPU 详情
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="ghost" size="sm" className="w-full justify-end">
                                  <MoreHorizontal className="size-4" />
                                  更多
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel>更多操作</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onSelect={() => syncDetailMutation.mutate(row.spuName)}
                                  disabled={syncDetailMutation.isPending}
                                >
                                  <PackageSearch className="size-4" />
                                  同步详情
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => checkEditMutation.mutate(row.spuName)}
                                  disabled={checkEditMutation.isPending}
                                >
                                  <ClipboardCheck className="size-4" />
                                  检查可编辑
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => syncStatusMutation.mutate(row.spuName)}
                                  disabled={syncStatusMutation.isPending}
                                >
                                  <RefreshCw className={syncStatusMutation.isPending ? "size-4 animate-spin" : "size-4"} />
                                  同步状态
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                        暂无本地平台商品数据。先点击“同步平台商品”，将 SHEIN 已上架商品拉回本地台账。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ServerPagination
              compact
              className="shrink-0 bg-card px-0"
              beforeContent={
                <div
                  ref={productTableBottomScrollRef}
                  className="mb-1 overflow-x-auto overflow-y-hidden border-b pb-0.5"
                  onScroll={() => syncProductTableScroll("bottom")}
                  aria-label="平台商品列表横向滚动"
                >
                  <div className="h-0.5 w-[1822px]" />
                </div>
              }
              pagination={pagination}
              isLoading={productsQuery.isFetching && !productsQuery.isLoading}
              onLimitChange={(limit) =>
                setQueryParams((current) => ({ ...current, pagination: { ...current.pagination, limit, offset: 0 } }))
              }
              onOffsetChange={(offset) =>
                setQueryParams((current) => ({ ...current, pagination: { ...current.pagination, offset } }))
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="sm:max-w-5xl lg:max-w-6xl">
          <DialogHeader>
            <DialogTitle>同步商品</DialogTitle>
            <DialogDescription>
              商品列表支持按创建时间或更新时间同步；按款号同步会直接拉取 SPU 详情。
            </DialogDescription>
          </DialogHeader>
          <Tabs value={syncDialogMode} onValueChange={(value) => setSyncDialogMode(value as SyncDialogMode)}>
            <TabsList className="grid w-full grid-cols-2 rounded-lg border bg-muted/40 p-1">
              <TabsTrigger value="spu" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                按款号同步
              </TabsTrigger>
              <TabsTrigger value="time" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                按时间范围同步
              </TabsTrigger>
            </TabsList>
            <TabsContent value="time" className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {syncRangeOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={syncFilters.rangeMode === option.value ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setSyncFilters((current) => ({ ...current, rangeMode: option.value }))}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {syncFilters.rangeMode === "custom" ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {syncTimeFieldOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={syncFilters.syncTimeField === option.value ? "default" : "outline"}
                        className="justify-start"
                        onClick={() => setSyncFilters((current) => ({ ...current, syncTimeField: option.value }))}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="sync-time-start">同步开始时间</Label>
                      <Input
                        id="sync-time-start"
                        type="datetime-local"
                        value={syncFilters.timeStart}
                        onChange={(event) => setSyncFilters((current) => ({ ...current, timeStart: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sync-time-end">同步结束时间</Label>
                      <Input
                        id="sync-time-end"
                        type="datetime-local"
                        value={syncFilters.timeEnd}
                        onChange={(event) => setSyncFilters((current) => ({ ...current, timeEnd: event.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="sync-page-size">分页大小</Label>
                  <Input
                    id="sync-page-size"
                    type="number"
                    min="1"
                    max="100"
                    value={syncFilters.pageSize}
                    onChange={(event) => setSyncFilters((current) => ({ ...current, pageSize: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sync-max-pages">最多页数</Label>
                  <Input
                    id="sync-max-pages"
                    type="number"
                    min="1"
                    max="1000"
                    value={syncFilters.maxPages}
                    onChange={(event) => setSyncFilters((current) => ({ ...current, maxPages: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sync-detail-limit">详情上限</Label>
                  <Input
                    id="sync-detail-limit"
                    type="number"
                    min="0"
                    max="100000"
                    value={syncFilters.detailLimit}
                    onChange={(event) => setSyncFilters((current) => ({ ...current, detailLimit: event.target.value }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Checkbox
                  checked={syncFilters.syncDetails}
                  onCheckedChange={(checked) => setSyncFilters((current) => ({ ...current, syncDetails: checked === true }))}
                />
                同步列表后补拉 SPU 详情
              </label>
            </TabsContent>
            <TabsContent value="spu" className="mt-4 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="sync-spu-names">款号/SPU</Label>
                <Textarea
                  id="sync-spu-names"
                  value={spuNameSyncText}
                  onChange={(event) => setSpuNameSyncText(event.target.value)}
                  placeholder="c250722589993&#10;s2409195445"
                  className="min-h-32 font-mono text-sm"
                />
              </div>
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                待同步 {formatNumber(spuNamesToSync.length)} 个 SPU
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSyncFilters(DEFAULT_SYNC_FILTERS)
                setSpuNameSyncText("")
              }}
              disabled={syncProductsMutation.isPending || syncSpuProductsMutation.isPending}
            >
              重置
            </Button>
            <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => (syncDialogMode === "time" ? syncProductsMutation.mutate() : syncSpuProductsMutation.mutate())}
              disabled={syncProductsMutation.isPending || syncSpuProductsMutation.isPending}
            >
              {syncProductsMutation.isPending || syncSpuProductsMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PackageSearch className="size-4" />
              )}
              开始同步
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={syncScheduleDialogOpen} onOpenChange={setSyncScheduleDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>定时同步</DialogTitle>
            <DialogDescription>
              配置 SHEIN 平台商品详情的自动同步任务，默认 23 点开始。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-3">
              <div className="min-w-0">
                <Label htmlFor="sync-schedule-enabled" className="text-sm font-medium">启用任务</Label>
                <p className="mt-1 text-xs text-muted-foreground">关闭后只停止后续自动触发。</p>
              </div>
              <Switch
                id="sync-schedule-enabled"
                checked={syncScheduleForm.enabled}
                onCheckedChange={(enabled) => setSyncScheduleForm((current) => ({ ...current, enabled }))}
                disabled={syncScheduleMutation.isPending}
              />
            </div>
            {alreadyRunningScheduledSync ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                已有进行中的定时任务，修改或关闭只影响后续触发，当前任务会继续执行。
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="sync-schedule-hour">开始小时</Label>
                <Input
                  id="sync-schedule-hour"
                  type="number"
                  min="0"
                  max="23"
                  step="1"
                  value={syncScheduleForm.schedule_hour}
                  onChange={(event) => setSyncScheduleForm((current) => ({ ...current, schedule_hour: event.target.value }))}
                  disabled={syncScheduleMutation.isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sync-schedule-scope">同步范围</Label>
                <Select
                  value={syncScheduleForm.sync_scope}
                  onValueChange={(sync_scope) => setSyncScheduleForm((current) => ({ ...current, sync_scope: sync_scope as SyncScheduleScope }))}
                  disabled={syncScheduleMutation.isPending}
                >
                  <SelectTrigger id="sync-schedule-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">全量商品同步</SelectItem>
                    <SelectItem value="spu">自定义 SPU 款号同步</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {syncScheduleForm.sync_scope === "spu" ? (
              <div className="grid gap-2">
                <Label htmlFor="sync-schedule-spu-names">SPU 款号</Label>
                <Textarea
                  id="sync-schedule-spu-names"
                  value={syncScheduleForm.spu_names_text}
                  onChange={(event) => setSyncScheduleForm((current) => ({ ...current, spu_names_text: event.target.value }))}
                  placeholder="c250722589993&#10;s2409195445"
                  className="min-h-32 font-mono text-sm"
                  disabled={syncScheduleMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  已识别 {formatNumber(scheduledSpuNames.length)} 个 SPU。
                </p>
              </div>
            ) : (
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                全量商品同步会读取本地平台商品列表中的全部 SPU，并按详情接口限流节奏分片执行。
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSyncScheduleForm(DEFAULT_SYNC_SCHEDULE_FORM)}
              disabled={syncScheduleMutation.isPending}
            >
              恢复默认
            </Button>
            <Button variant="outline" onClick={() => setSyncScheduleDialogOpen(false)} disabled={syncScheduleMutation.isPending}>
              取消
            </Button>
            <Button onClick={() => syncScheduleMutation.mutate()} disabled={syncScheduleMutation.isPending}>
              {syncScheduleMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Settings2 className="size-4" />}
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(saleSitesDialogProduct)}
        onOpenChange={(open) => {
          if (!open) setSaleSitesDialogProduct(null)
        }}
      >
        <DialogContent className="flex max-h-[90dvh] w-[min(96vw,88rem)] flex-col overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>销售站点</DialogTitle>
            <DialogDescription>
              {saleSitesDialogProduct?.spuName || "当前商品"} 的上架国家站点、状态、链接和上架时间。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto px-6">
            <div className="min-w-[760px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>站点</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>首次上架</TableHead>
                    <TableHead>最近上架</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead className="text-right">商品链接</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saleSitesDialogLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        <Loader2 className="mr-2 inline size-4 animate-spin" />
                        加载销售站点明细...
                      </TableCell>
                    </TableRow>
                  ) : saleSitesDialogSites.length ? (
                    saleSitesDialogSites.map((site) => (
                      <TableRow key={`${site.siteAbbr}-${site.source}`}>
                        <TableCell>
                          <div className="text-sm font-medium">{site.siteName || site.siteAbbr}</div>
                          <div className="font-mono text-xs text-muted-foreground">{site.siteAbbr}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={saleSiteStatusVariant(site.shelfStatus)}>
                            {site.shelfStatusText}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{site.firstShelfTime || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{site.lastShelfTime || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{site.source || "—"}</TableCell>
                        <TableCell className="text-right">
                          {site.link ? (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={site.link} target="_blank" rel="noreferrer">打开链接</a>
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        本地尚未同步到该 SPU 的销售站点明细
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button variant="outline" onClick={() => setSaleSitesDialogProduct(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {view === "sites" ? (
        <Card>
          <CardHeader>
            <CardTitle>站点币种</CardTitle>
            <p className="text-sm text-muted-foreground">
              启用站点 {formatNumber(activeSites.length)} / 币种 {formatNumber(currencyOptions.length)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>站点</TableHead>
                    <TableHead>主站</TableHead>
                    <TableHead>币种</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>最后同步</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sitesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        读取本地站点币种...
                      </TableCell>
                    </TableRow>
                  ) : siteRows.length ? (
                    siteRows.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell>
                          <div className="font-medium">{site.siteName || site.siteAbbr || "—"}</div>
                          <div className="text-xs text-muted-foreground">{site.siteAbbr || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{site.mainSiteName || site.mainSite || "—"}</div>
                          <div className="text-xs text-muted-foreground">{site.storeType != null ? `店铺类型 ${site.storeType}` : "—"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {site.symbolLeft}
                            {site.currency || "—"}
                            {site.symbolRight}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={site.status === 1 ? "secondary" : "outline"}>
                            {siteStatusLabel(site.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{site.lastSyncedAt || "—"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        暂无站点币种数据。点击“同步站点币种”从 SHEIN 拉取。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {view === "detail" ? (
        <Card>
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>商品详情</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedSpuName ? `当前 SPU：${selectedSpuName}` : "从平台商品列表选择 SPU，或手动输入 spuName 查询。"}
                </p>
                {detailQuery.isError ? (
                  <p className="mt-1 text-xs text-destructive">
                    本地尚未同步该 SPU 详情，可点击“同步详情”从 SHEIN 拉取并入库。
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {selectedSpuName ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => syncDetailMutation.mutate(selectedSpuName)}
                      disabled={syncDetailMutation.isPending}
                    >
                      <PackageSearch className="size-4" />
                      同步详情
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => checkEditMutation.mutate(selectedSpuName)}
                      disabled={checkEditMutation.isPending}
                    >
                      <ClipboardCheck className="size-4" />
                      检查可编辑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => syncStatusMutation.mutate(selectedSpuName)}
                      disabled={syncStatusMutation.isPending}
                    >
                      {syncStatusMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      同步状态
                    </Button>
                    <Button type="button" variant="outline" onClick={() => openEditDialog(selectedSpuName)}>
                      <Edit3 className="size-4" />
                      常用字段编辑
                    </Button>
                    <Button type="button" variant="outline" onClick={() => openVariantDialog(selectedSpuName)}>
                      <GitMerge className="size-4" />
                      拼款模板
                    </Button>
                    {detail ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openBatchCostDialog(selectedSpuName, detailCostItems(detail), detail.skcs.flatMap((skc) => skc.skus).find((sku) => sku.currency)?.currency)}
                      >
                        <DollarSign className="size-4" />
                        批量更新供货价
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" onClick={() => openJsonAction("partial-edit", selectedSpuName)}>
                      <Wand2 className="size-4" />
                      高级 JSON 编辑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => revokeMutation.mutate(selectedSpuName)}
                      disabled={revokeMutation.isPending}
                    >
                      <RotateCcw className="size-4" />
                      撤回商品
                    </Button>
                  </>
                ) : null}
                {detailQuery.isFetching ? (
                  <Badge variant="outline">
                    <Loader2 className="size-3 animate-spin" />
                    读取中
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
        <CardContent>
          {!selectedSpuName ? (
            <div className="flex h-36 items-center justify-center rounded-md border text-sm text-muted-foreground">
              选择一个平台商品后，这里会显示 SPU/SKC/SKU 明细和调价入口。
            </div>
          ) : detailQuery.isLoading ? (
            <div className="flex h-36 items-center justify-center rounded-md border text-sm text-muted-foreground">
              加载本地 SPU 详情...
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <Tabs value={detailSection} onValueChange={(value) => setDetailSection(value as DetailSection)}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <TabsList>
                    {detailSectionTabs.map((tab) => (
                      <TabsTrigger key={tab.value} value={tab.value}>
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <div className="grid gap-3 md:grid-cols-5">
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">SPU</p>
                      <p className="mt-1 font-mono text-sm font-medium">{detailProduct?.spuName || selectedSpuName}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">商品名称</p>
                      <p className="mt-1 truncate text-sm font-medium">{detailProduct?.productName || "—"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">供应商货号</p>
                      <p className="mt-1 truncate text-sm font-medium">{detailProduct?.supplierCode || "—"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">类目名称</p>
                      <p className="mt-1 truncate text-sm font-medium">{detailProduct?.categoryName || "—"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">可编辑</p>
                      <p className="mt-1 truncate text-sm font-medium">{detailProduct?.editableStatus || "未检查"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">平台状态</p>
                      <p className="mt-1 truncate text-sm font-medium">{detailProduct?.productStatus || "未同步"}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">销售站点</p>
                      <p className="mt-1 truncate text-sm font-medium">
                        {detailSaleSiteSummary}
                      </p>
                    </div>
                  </div>
                </div>

                <TabsContent value="product" className="mt-4 space-y-4">
                  <div className="overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[82px]">图片</TableHead>
                          <TableHead>SKC</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>供货价</TableHead>
                          <TableHead>售价</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.skcs.length ? (
                          detail.skcs.flatMap((skc) =>
                            skc.skus.length
                              ? skc.skus.map((sku, index) => (
                                  <TableRow key={`${skc.skcName}-${sku.skuCode}`}>
                                    <TableCell>{index === 0 ? <ProductThumb src={skc.imageUrl} alt={skc.skcName} /> : null}</TableCell>
                                    <TableCell>
                                      {index === 0 ? (
                                        <div className="space-y-1">
                                          <div className="font-mono text-xs font-medium">{skc.skcName || "—"}</div>
                                          <div className="text-xs text-muted-foreground">{skc.supplierCode || "—"}</div>
                                          <div className="text-xs text-muted-foreground">{skc.saleText || "—"}</div>
                                          <Badge variant="outline">{skc.shelfText || "—"}</Badge>
                                        </div>
                                      ) : null}
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <div className="font-mono text-xs font-medium">{sku.skuCode || "—"}</div>
                                        <div className="text-xs text-muted-foreground">{sku.supplierSku || "—"}</div>
                                        <div className="text-xs text-muted-foreground">{sku.saleText || "—"}</div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{sku.costs || "—"}</TableCell>
                                    <TableCell className="max-w-[260px] text-sm text-muted-foreground">{sku.prices || "—"}</TableCell>
                                    <TableCell className="text-sm">
                                      <div>{mallStateLabel(sku.mallState)}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {sku.stopPurchase === 2 ? "停采" : "在采"} / {sku.weight ?? "—"}g
                                      </div>
                                      <div className="text-xs text-muted-foreground">{sku.dimensions || "—"}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          openCostDialog({
                                            spuName: detailProduct?.spuName || selectedSpuName,
                                            skcName: skc.skcName,
                                            skuCode: sku.skuCode,
                                            supplierSku: sku.supplierSku,
                                            cost: sku.currentCost,
                                            currency: sku.currency,
                                          })
                                        }
                                      >
                                        <DollarSign className="size-4" />
                                        更新成本价
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              : [
                                  <TableRow key={`${skc.skcName}-empty`}>
                                    <TableCell><ProductThumb src={skc.imageUrl} alt={skc.skcName} /></TableCell>
                                    <TableCell className="font-mono text-xs">{skc.skcName || "—"}</TableCell>
                                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                                      该 SKC 暂未同步到 SKU 明细
                                    </TableCell>
                                  </TableRow>,
                                ],
                          )
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                              SPU 详情没有 SKC/SKU 明细
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="sites" className="mt-4 space-y-4">
                  <div className="overflow-hidden rounded-md border">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <div className="text-sm font-medium">销售站点明细</div>
                      <Badge variant="outline">上架站点数 {formatNumber(detailProduct?.saleSiteCount ?? 0)}</Badge>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>站点</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>首次上架</TableHead>
                          <TableHead>最近上架</TableHead>
                          <TableHead>来源</TableHead>
                          <TableHead className="text-right">链接</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailSaleSiteRows.length ? (
                          detailSaleSiteRows.map((site) => (
                            <TableRow key={`${site.siteAbbr}-${site.source}`}>
                              <TableCell>
                                <div className="text-sm font-medium">{site.displayName}</div>
                                <div className="font-mono text-xs text-muted-foreground">{site.siteCode}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={saleSiteStatusVariant(site.shelfStatus)}>
                                  {site.shelfStatusText}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{site.firstShelfTime || "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{site.lastShelfTime || "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{site.source || "—"}</TableCell>
                              <TableCell className="text-right">
                                {site.link ? (
                                  <Button variant="ghost" size="sm" asChild>
                                    <a href={site.link} target="_blank" rel="noreferrer">打开链接</a>
                                  </Button>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                              SPU 详情里暂未找到销售站点明细
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>

              <JsonViewer data={detail.rawInfo} label="SPU 详情原始 info" />
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center rounded-md border text-sm text-muted-foreground">
              本地暂无该 SPU 详情；点击“同步详情”后会写入平台商品明细库表。
            </div>
          )}
        </CardContent>
        </Card>
      ) : null}

      <Dialog open={costDialogOpen} onOpenChange={setCostDialogOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[min(96vw,96rem)] flex-col overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>批量更新成本价/供货价</DialogTitle>
            <DialogDescription>
              供货价通过 SHEIN `/open-api/goods/update-cost` 提交，成功后会记录生命周期操作并更新本地 SKU 成本价。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cost-spu">SPU</Label>
                <Input
                  id="cost-spu"
                  value={costForm.spuName}
                  onChange={(event) => setCostForm((current) => ({ ...current, spuName: event.target.value.trim() }))}
                />
              </div>
              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <div className="text-sm font-medium">
                    已选 SKU {formatNumber(selectedCostItems.length)} / {formatNumber(costForm.items.length)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const allSelected = selectedCostItems.length === costForm.items.length
                      setCostForm((current) => ({
                        ...current,
                        items: current.items.map((item) => ({ ...item, selected: !allSelected })),
                      }))
                    }}
                  >
                    <Settings2 className="size-4" />
                    {selectedCostItems.length === costForm.items.length ? "取消全选" : "全选"}
                  </Button>
                </div>
                <div className="max-h-72 overflow-auto">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">选</TableHead>
                        <TableHead>SKC</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>商家 SKU</TableHead>
                        <TableHead>原供货价</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costForm.items.length ? (
                        costForm.items.map((item, index) => (
                          <TableRow key={`${item.skcName}-${item.skuCode}`}>
                            <TableCell>
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={(checked) =>
                                  setCostForm((current) => ({
                                    ...current,
                                    items: current.items.map((currentItem, itemIndex) =>
                                      itemIndex === index ? { ...currentItem, selected: checked === true } : currentItem,
                                    ),
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{item.skcName || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{item.skuCode || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.supplierSku || "—"}</TableCell>
                            <TableCell className="text-sm">{item.originalCost || "—"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                            本地尚未同步 SKU 明细
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                <div className="grid gap-2">
                  <Label htmlFor="cost-value">新成本价</Label>
                  <Input
                    id="cost-value"
                    type="number"
                    min="0.01"
                    max="99999.99"
                    step="0.01"
                    value={costForm.cost}
                    onChange={(event) => setCostForm((current) => ({ ...current, cost: event.target.value }))}
                    placeholder="10.55"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>币种</Label>
                  <Select
                    value={costForm.currency}
                    onValueChange={(currency) => setCostForm((current) => ({ ...current, currency }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {costIncreased ? (
                <div className="grid gap-2">
                  <Label>涨价原因</Label>
                  <Select
                    value={costForm.changeReasonCode}
                    onValueChange={(changeReasonCode) => setCostForm((current) => ({ ...current, changeReasonCode }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择 query-change-price-reason 原因" />
                    </SelectTrigger>
                    <SelectContent>
                      {costChangeReasons.map((reason) => (
                        <SelectItem key={reason.reasonCode} value={reason.reasonCode}>
                          {reason.reasonCode} - {reason.reasonText}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    原因来源：{costReasonSource === "DOCUMENT_FALLBACK" ? "文档枚举兜底" : "SHEIN 接口 query-change-price-reason"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button variant="outline" onClick={() => setCostDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => updateCostMutation.mutate()} disabled={updateCostMutation.isPending}>
              {updateCostMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <DollarSign className="size-4" />}
              提交更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={costImportDialogOpen} onOpenChange={handleCostImportDialogOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-hidden sm:max-w-5xl lg:max-w-6xl">
          <DialogHeader>
            <DialogTitle>表格导入更新供货价</DialogTitle>
            <DialogDescription>
              模板字段：SPU、SKC、SKU、供货价、币种、涨价原因；提交后按 SPU/SKC 聚合调用更新供货价接口。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto pr-1">
            <div className="flex min-w-0 flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1 text-sm">
                <div className="font-medium">模板字段</div>
                <div className="text-muted-foreground">SPU / SKC / SKU / 供货价 / 币种 / 涨价原因</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={downloadCostImportTemplate}>
                  <Upload className="size-4" />
                  下载模板
                </Button>
                <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">
                  <Upload className="size-4" />
                  上传表格
                  <Input
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={(event) => void handleCostImportFile(event.target.files?.[0] ?? null)}
                  />
                </Label>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="max-w-full truncate">
                {costImportFileName || "未选择文件"}
              </Badge>
              <span>已解析 {formatNumber(costImportRows.length)} 行</span>
            </div>
            {costImportProgress ? (
              <div className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="font-medium">
                    正在提交 {formatNumber(costImportProgress.completedGroups)} / {formatNumber(costImportProgress.totalGroups)} 组 SPU
                  </div>
                  <div className="text-muted-foreground">
                    {formatNumber(costImportProgress.rowCount)} 行，4 路并发
                  </div>
                </div>
                <Progress value={costImportProgressValue} className="mt-3 h-2" />
                <div className="mt-2 text-xs text-muted-foreground">
                  {costImportProgress.currentSpuName
                    ? `最近完成：${costImportProgress.currentSpuName}${costImportProgress.message ? ` · ${costImportProgress.message}` : ""}`
                    : "已开始批量提交，窗口会持续显示进度。"}
                </div>
              </div>
            ) : null}
            <div className="min-w-0 rounded-md border">
              <div className="max-h-80 overflow-auto">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">行号</TableHead>
                      <TableHead className="w-[18%]">SPU</TableHead>
                      <TableHead className="w-[18%]">SKC</TableHead>
                      <TableHead className="w-[18%]">SKU</TableHead>
                      <TableHead className="w-[14%]">供货价</TableHead>
                      <TableHead className="w-[12%]">币种</TableHead>
                      <TableHead>涨价原因</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costImportRows.length ? (
                      costImportRows.slice(0, 100).map((row) => (
                        <TableRow key={`${row.rowNumber}-${row.spuName}-${row.skuCode}`}>
                          <TableCell className="text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                          <TableCell className="truncate font-mono text-xs">{row.spuName || "—"}</TableCell>
                          <TableCell className="truncate font-mono text-xs">{row.skcName || "—"}</TableCell>
                          <TableCell className="truncate font-mono text-xs">{row.skuCode || "—"}</TableCell>
                          <TableCell className="truncate">{row.cost || "—"}</TableCell>
                          <TableCell className="truncate">{row.currency || "CNY"}</TableCell>
                          <TableCell className="truncate">{row.changeReasonCode || "—"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          上传表格后在这里预览前 100 行
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleCostImportDialogOpenChange(false)} disabled={costImportMutation.isPending}>
              取消
            </Button>
            <Button onClick={() => costImportMutation.mutate()} disabled={costImportMutation.isPending || !costImportRows.length}>
              {costImportMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <DollarSign className="size-4" />}
              {costImportMutation.isPending && costImportProgress
                ? `处理中 ${formatNumber(costImportProgress.completedGroups)}/${formatNumber(costImportProgress.totalGroups)}`
                : "提交更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regressionDialogOpen} onOpenChange={setRegressionDialogOpen}>
        <DialogContent className="sm:max-w-5xl lg:max-w-6xl">
          <DialogHeader>
            <DialogTitle>真实数据回归</DialogTitle>
            <DialogDescription>
              记录 P0 真实 SHEIN 数据回归结果，沉淀 traceId、失败原因和人工备注。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>场景</Label>
                <Select
                  value={regressionForm.scenario}
                  onValueChange={(scenario) => setRegressionForm((current) => ({ ...current, scenario }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "SYNC_PRODUCT_LIST",
                      "SYNC_SITES",
                      "SYNC_DETAIL",
                      "CHECK_EDIT_PERMISSION",
                      "SYNC_STATUS",
                      "UPDATE_COST",
                      "FIELD_EDIT",
                      "ADD_VARIANTS",
                      "REVOKE",
                    ].map((scenario) => (
                      <SelectItem key={scenario} value={scenario}>{scenario}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>结果</Label>
                <Select
                  value={regressionForm.status}
                  onValueChange={(status) => setRegressionForm((current) => ({ ...current, status: status as RegressionForm["status"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PASS">PASS</SelectItem>
                    <SelectItem value="FAIL">FAIL</SelectItem>
                    <SelectItem value="BLOCKED">BLOCKED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={regressionForm.spuName}
                onChange={(event) => setRegressionForm((current) => ({ ...current, spuName: event.target.value.trim() }))}
                placeholder="SPU"
              />
              <Input
                value={regressionForm.skcName}
                onChange={(event) => setRegressionForm((current) => ({ ...current, skcName: event.target.value.trim() }))}
                placeholder="SKC"
              />
              <Input
                value={regressionForm.skuCode}
                onChange={(event) => setRegressionForm((current) => ({ ...current, skuCode: event.target.value.trim() }))}
                placeholder="SKU"
              />
            </div>
            <Input
              value={regressionForm.traceId}
              onChange={(event) => setRegressionForm((current) => ({ ...current, traceId: event.target.value.trim() }))}
              placeholder="traceId"
            />
            <Input
              value={regressionForm.errorMessage}
              onChange={(event) => setRegressionForm((current) => ({ ...current, errorMessage: event.target.value }))}
              placeholder="失败原因"
            />
            <Textarea
              value={regressionForm.operatorNote}
              onChange={(event) => setRegressionForm((current) => ({ ...current, operatorNote: event.target.value }))}
              className="min-h-24"
              placeholder="回归备注"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegressionDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => regressionLogMutation.mutate()} disabled={regressionLogMutation.isPending}>
              保存回归记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={operationsDialogOpen} onOpenChange={setOperationsDialogOpen}>
        <DialogContent className="sm:max-w-5xl lg:max-w-6xl">
          <DialogHeader>
            <DialogTitle>最近操作</DialogTitle>
            <DialogDescription>{operationSourceLabel}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
            {recentOperations.length ? (
              recentOperations.map((operation) => (
                <div key={operation.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{operationLabel(operation.operationType)}</div>
                    <Badge variant={operation.status === "SUCCESS" ? "secondary" : operation.status === "FAILED" ? "destructive" : "outline"}>
                      {operation.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {[operation.spuName, operation.skcName, operation.skuCode].filter(Boolean).join(" / ") || "全局操作"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {operation.finishedAt || operation.startedAt || operation.createdAt}
                  </div>
                  {operation.responseMessage || operation.errorMessage ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      失败原因：{operation.responseMessage || operation.errorMessage}
                    </div>
                  ) : null}
                  {operation.status === "FAILED" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => retryOperationMutation.mutate(operation)}
                      disabled={retryOperationMutation.isPending}
                    >
                      {retryOperationMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                      重试失败操作
                    </Button>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="flex h-24 items-center justify-center rounded-md border text-sm text-muted-foreground">
                暂无生命周期操作记录
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOperationsDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>常用字段编辑</DialogTitle>
            <DialogDescription>
              从已同步的 SPU 详情生成编辑载荷，表单只暴露常用字段，提交时保留 SHEIN 已发布对象编号。
            </DialogDescription>
          </DialogHeader>
          {editTemplateQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center rounded-md border text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              读取编辑模板...
            </div>
          ) : editTemplateQuery.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              本地尚未同步 SPU 详情，无法生成常用字段编辑模板。
            </div>
          ) : (
            <div className="grid max-h-[70vh] gap-4 overflow-auto pr-1">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-title-zh">商品标题（中文）</Label>
                  <Input
                    id="edit-title-zh"
                    value={visibleEditForm.productTitleZh}
                    onChange={(event) => patchEditForm({ productTitleZh: event.target.value })}
                    placeholder="商品标题"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-title-en">商品标题（英文）</Label>
                  <Input
                    id="edit-title-en"
                    value={visibleEditForm.productTitleEn}
                    onChange={(event) => patchEditForm({ productTitleEn: event.target.value })}
                    placeholder="Product title"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-desc-zh">商品描述（中文）</Label>
                  <Textarea
                    id="edit-desc-zh"
                    value={visibleEditForm.productDescriptionZh}
                    onChange={(event) => patchEditForm({ productDescriptionZh: event.target.value })}
                    className="min-h-24"
                    placeholder="商品描述"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-desc-en">商品描述（英文）</Label>
                  <Textarea
                    id="edit-desc-en"
                    value={visibleEditForm.productDescriptionEn}
                    onChange={(event) => patchEditForm({ productDescriptionEn: event.target.value })}
                    className="min-h-24"
                    placeholder="Product description"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-brand">品牌</Label>
                  <Input
                    id="edit-brand"
                    value={visibleEditForm.brandCode}
                    onChange={(event) => patchEditForm({ brandCode: event.target.value.trim() })}
                    placeholder="brand_code"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-supplier">供应商货号</Label>
                  <Input
                    id="edit-supplier"
                    value={visibleEditForm.supplierCode}
                    onChange={(event) => patchEditForm({ supplierCode: event.target.value.trim() })}
                    placeholder="supplier_code"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-category">类目</Label>
                  <Input
                    id="edit-category"
                    value={visibleEditForm.categoryId}
                    onChange={(event) => patchEditForm({ categoryId: event.target.value.trim() })}
                    placeholder="category_id"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-product-type">商品类型</Label>
                  <Input
                    id="edit-product-type"
                    value={visibleEditForm.productTypeId}
                    onChange={(event) => patchEditForm({ productTypeId: event.target.value.trim() })}
                    placeholder="product_type_id"
                  />
                </div>
              </div>
              <div className="rounded-md border">
                <div className="border-b px-3 py-2 text-sm font-medium">SKU 包装与商家 SKU</div>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>供应商货号</TableHead>
                        <TableHead>包装重量</TableHead>
                        <TableHead>长</TableHead>
                        <TableHead>宽</TableHead>
                        <TableHead>高</TableHead>
                        <TableHead>销售状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleEditForm.skuUpdates.length ? (
                        visibleEditForm.skuUpdates.map((sku, index) => (
                          <TableRow key={sku.skuCode || index}>
                            <TableCell className="font-mono text-xs">{sku.skuCode || "—"}</TableCell>
                            <TableCell>
                              <Input value={sku.supplierSku} onChange={(event) => updateEditSku(index, { supplierSku: event.target.value.trim() })} />
                            </TableCell>
                            <TableCell>
                              <Input value={sku.weight} onChange={(event) => updateEditSku(index, { weight: event.target.value.trim() })} />
                            </TableCell>
                            <TableCell>
                              <Input value={sku.length} onChange={(event) => updateEditSku(index, { length: event.target.value.trim() })} />
                            </TableCell>
                            <TableCell>
                              <Input value={sku.width} onChange={(event) => updateEditSku(index, { width: event.target.value.trim() })} />
                            </TableCell>
                            <TableCell>
                              <Input value={sku.height} onChange={(event) => updateEditSku(index, { height: event.target.value.trim() })} />
                            </TableCell>
                            <TableCell>
                              <Select value={sku.mallState || "1"} onValueChange={(mallState) => updateEditSku(index, { mallState })}>
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">在售</SelectItem>
                                  <SelectItem value="2">停售</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                            详情模板中没有 SKU，可先同步 SPU 详情。
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {editTemplateQuery.data?.warnings?.length ? (
                <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {editTemplateQuery.data.warnings.join(" ")}
                </div>
              ) : null}
              {editTemplateQuery.data?.payload ? (
                <JsonViewer data={editTemplateQuery.data.payload} label="当前模板 JSON 预览" />
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => fieldEditMutation.mutate()} disabled={fieldEditMutation.isPending || editTemplateQuery.isLoading}>
              {fieldEditMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Edit3 className="size-4" />}
              提交常用字段编辑
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="sm:max-w-5xl lg:max-w-6xl">
          <DialogHeader>
            <DialogTitle>拼款模板</DialogTitle>
            <DialogDescription>
              基于当前 SPU 详情追加新增 SKC/SKU，已发布 SKC/SKU 的平台编号由模板保留。
            </DialogDescription>
          </DialogHeader>
          {variantTemplateQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center rounded-md border text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              读取拼款模板...
            </div>
          ) : variantTemplateQuery.isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              本地尚未同步 SPU 详情，无法生成拼款模板。
            </div>
          ) : (
            <div className="grid max-h-[70vh] gap-4 overflow-auto pr-1">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-md border p-3">
                  <div className="text-sm font-medium">新增 SKC</div>
                  <div className="grid gap-2">
                    <Label htmlFor="variant-skc-supplier">供应商货号</Label>
                    <Input
                      id="variant-skc-supplier"
                      value={variantForm.skcSupplierCode}
                      onChange={(event) => setVariantForm((current) => ({ ...current, skcSupplierCode: event.target.value.trim() }))}
                      placeholder="全店唯一 SKC supplier_code"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="variant-skc-attr">销售属性 ID</Label>
                      <Input
                        id="variant-skc-attr"
                        value={variantForm.skcAttributeId}
                        onChange={(event) => setVariantForm((current) => ({ ...current, skcAttributeId: event.target.value.trim() }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="variant-skc-attr-value">销售属性值 ID</Label>
                      <Input
                        id="variant-skc-attr-value"
                        value={variantForm.skcAttributeValueId}
                        onChange={(event) => setVariantForm((current) => ({ ...current, skcAttributeValueId: event.target.value.trim() }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="variant-image">图片 URL</Label>
                    <Input
                      id="variant-image"
                      value={variantForm.imageUrl}
                      onChange={(event) => setVariantForm((current) => ({ ...current, imageUrl: event.target.value.trim() }))}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="space-y-3 rounded-md border p-3">
                  <div className="text-sm font-medium">新增 SKU</div>
                  <div className="grid gap-2">
                    <Label htmlFor="variant-sku-supplier">供应商货号</Label>
                    <Input
                      id="variant-sku-supplier"
                      value={variantForm.skuSupplierSku}
                      onChange={(event) => setVariantForm((current) => ({ ...current, skuSupplierSku: event.target.value.trim() }))}
                      placeholder="全店唯一 SKU supplier_sku"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="variant-sku-attr">销售属性 ID</Label>
                      <Input
                        id="variant-sku-attr"
                        value={variantForm.skuAttributeId}
                        onChange={(event) => setVariantForm((current) => ({ ...current, skuAttributeId: event.target.value.trim() }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="variant-sku-attr-value">销售属性值 ID</Label>
                      <Input
                        id="variant-sku-attr-value"
                        value={variantForm.skuAttributeValueId}
                        onChange={(event) => setVariantForm((current) => ({ ...current, skuAttributeValueId: event.target.value.trim() }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="grid gap-2">
                      <Label htmlFor="variant-weight">包装重量</Label>
                      <Input id="variant-weight" value={variantForm.weight} onChange={(event) => setVariantForm((current) => ({ ...current, weight: event.target.value.trim() }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="variant-length">长</Label>
                      <Input id="variant-length" value={variantForm.length} onChange={(event) => setVariantForm((current) => ({ ...current, length: event.target.value.trim() }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="variant-width">宽</Label>
                      <Input id="variant-width" value={variantForm.width} onChange={(event) => setVariantForm((current) => ({ ...current, width: event.target.value.trim() }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="variant-height">高</Label>
                      <Input id="variant-height" value={variantForm.height} onChange={(event) => setVariantForm((current) => ({ ...current, height: event.target.value.trim() }))} />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                    <div className="grid gap-2">
                      <Label htmlFor="variant-cost">供货价</Label>
                      <Input
                        id="variant-cost"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={variantForm.cost}
                        onChange={(event) => setVariantForm((current) => ({ ...current, cost: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>币种</Label>
                      <Select value={variantForm.currency} onValueChange={(currency) => setVariantForm((current) => ({ ...current, currency }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {currencyOptions.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              {variantTemplateQuery.data?.notes?.length ? (
                <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {variantTemplateQuery.data.notes.join(" ")}
                </div>
              ) : null}
              {variantTemplateQuery.data?.payload ? (
                <JsonViewer data={variantTemplateQuery.data.payload} label="拼款基础模板 JSON 预览" />
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => openJsonAction("add-variants", selectedSpuName)} disabled={!selectedSpuName}>
              高级 JSON 拼款
            </Button>
            <Button variant="outline" onClick={() => setVariantDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => addVariantTemplateMutation.mutate()} disabled={addVariantTemplateMutation.isPending || variantTemplateQuery.isLoading}>
              {addVariantTemplateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
              提交拼款模板
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={jsonActionDialog.open}
        onOpenChange={(open) => setJsonActionDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="sm:max-w-5xl lg:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{actionTitle(jsonActionDialog.kind)}</DialogTitle>
            <DialogDescription>
              当前 P0 先提供可追溯的原始 JSON 负载入口，提交后会调用 SHEIN 对应接口并记录最近操作。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="json-action-payload">请求 JSON</Label>
            <Textarea
              id="json-action-payload"
              value={jsonActionDialog.payloadText}
              onChange={(event) => setJsonActionDialog((current) => ({ ...current, payloadText: event.target.value }))}
              className="min-h-80 font-mono text-xs"
              spellCheck={false}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJsonActionDialog(DEFAULT_JSON_ACTION)}>
              取消
            </Button>
            <Button onClick={() => jsonActionMutation.mutate()} disabled={jsonActionMutation.isPending}>
              {jsonActionMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Edit3 className="size-4" />}
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
