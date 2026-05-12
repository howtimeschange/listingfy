import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router"
import {
  ArrowLeft,
  ClipboardCheck,
  DollarSign,
  Edit3,
  Eye,
  GitMerge,
  Globe2,
  History,
  ImageIcon,
  Loader2,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  Search,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { api } from "@/lib/api-client"
import { formatNumber } from "@/lib/format"

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
  requestPayload: JsonRecord
  responsePayload: JsonRecord
  startedAt: string
  finishedAt: string
  createdAt: string
}

interface PlatformProductRow {
  id: number
  spuName: string
  supplierCode: string
  productName: string
  brandCode: string
  categoryId: string
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
  skcs: Array<{
    skcName: string
    supplierCode: string
    imageUrl: string | null
    shelfStatusText: string
  }>
  skuCodeList: string[]
  rawListPayload: JsonRecord
}

interface ProductListResponse {
  items: PlatformProductRow[]
  pagination: ServerPaginationState
  operations: LifecycleOperation[]
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
  rawPayload: JsonRecord
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

interface CostForm {
  spuName: string
  skcName: string
  skuCode: string
  supplierSku: string
  originalCost: string
  cost: string
  currency: string
  changeReasonCode: string
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
}

interface SyncFilters {
  insertTimeStart: string
  insertTimeEnd: string
  updateTimeStart: string
  updateTimeEnd: string
}

type PlatformProductView = "list" | "sites" | "detail"

interface SheinPlatformProductsPageProps {
  view?: PlatformProductView
}

const DEFAULT_COST_FORM: CostForm = {
  spuName: "",
  skcName: "",
  skuCode: "",
  supplierSku: "",
  originalCost: "",
  cost: "",
  currency: "CNY",
  changeReasonCode: "",
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

function siteStatusLabel(status: number | null) {
  if (status === 1) return "启用"
  if (status === 0) return "未启用"
  return "未知"
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
    queryFn: () => {
      const search = new URLSearchParams()
      search.set("limit", String(params.pagination.limit))
      search.set("offset", String(params.pagination.offset))
      if (params.search.trim()) search.set("search", params.search.trim())
      return api.get(`/shein-platform-products?${search.toString()}`)
    },
  })
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

function ProductThumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <ImageIcon className="size-5" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-14 w-14 rounded-md border object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  )
}

export default function SheinPlatformProductsPage({ view = "list" }: SheinPlatformProductsPageProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { spuName: routeSpuName } = useParams()
  const routeSelectedSpuName = view === "detail" ? routeSpuName?.trim() ?? "" : ""
  const [searchInput, setSearchInput] = useState("")
  const [localSelectedSpuName, setSelectedSpuName] = useState("")
  const selectedSpuName = view === "detail" ? routeSelectedSpuName : localSelectedSpuName
  const [costDialogOpen, setCostDialogOpen] = useState(false)
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
  const [syncFilters, setSyncFilters] = useState<SyncFilters>({
    insertTimeStart: "",
    insertTimeEnd: "",
    updateTimeStart: "",
    updateTimeEnd: "",
  })
  const [queryParams, setQueryParams] = useState<ProductQueryParams>({
    pagination: { limit: 50, offset: 0, total: 0 },
    search: "",
  })

  const sitesQuery = useStoreSites()
  const productsQuery = usePlatformProducts(queryParams)
  const detailQuery = useProductDetail(selectedSpuName)
  const editTemplateQuery = useEditTemplate(selectedSpuName, editDialogOpen)
  const variantTemplateQuery = useVariantTemplate(selectedSpuName, variantDialogOpen)
  const costReasonsQuery = useCostChangeReasons()

  const siteRows = useMemo(() => sitesQuery.data?.items ?? [], [sitesQuery.data])
  const productRows = productsQuery.data?.items ?? []
  const detail = detailQuery.data ?? null
  const detailProduct = detail?.product
  const currencyOptions = useMemo(() => {
    const currencies = Array.from(new Set(siteRows.map((site) => site.currency).filter(Boolean)))
    return currencies.length ? currencies : ["CNY", "USD", "EUR"]
  }, [siteRows])

  const pagination = productsQuery.data?.pagination ?? queryParams.pagination
  const activeSites = siteRows.filter((site) => site.status === 1)
  const skuCount = productRows.reduce((total, row) => total + row.skuCount, 0)
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
  const costIncreased = Number(costForm.cost) > Number(costForm.originalCost || 0)

  const syncProductsMutation = useMutation({
    mutationFn: () => {
      const pageNum = Math.floor(queryParams.pagination.offset / queryParams.pagination.limit) + 1
      const payload: JsonRecord = {
        pageNum,
        pageSize: queryParams.pagination.limit,
      }
      if (syncFilters.insertTimeStart.trim()) payload.insertTimeStart = syncFilters.insertTimeStart.trim()
      if (syncFilters.insertTimeEnd.trim()) payload.insertTimeEnd = syncFilters.insertTimeEnd.trim()
      if (syncFilters.updateTimeStart.trim()) payload.updateTimeStart = syncFilters.updateTimeStart.trim()
      if (syncFilters.updateTimeEnd.trim()) payload.updateTimeEnd = syncFilters.updateTimeEnd.trim()
      return api.post<{ result: PlatformRequestResult; persistence: { rowCount: number; productCount: number } }>(
        "/shein-platform-products/sync",
        payload,
      )
    },
    onSuccess: (data) => {
      if (!responseOk(data.result)) {
        toast.error(`同步平台商品失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success(`同步平台商品完成：${formatNumber(data.persistence.productCount)} 个 SPU`)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "同步平台商品失败"),
  })

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
      if (!costForm.spuName || !costForm.skcName || !costForm.skuCode) {
        throw new Error("请先选择 SPU、SKC 和 SKU")
      }
      if (!Number.isFinite(cost) || cost <= 0 || cost >= 100000) {
        throw new Error("供货价需大于 0 且小于 100000")
      }
      if (costIncreased && !costForm.changeReasonCode) {
        throw new Error("成本价上涨时请选择涨价原因")
      }
      return api.post<{ result: PlatformRequestResult }>(productUpdateCostUrl(costForm.spuName), {
        change_reason_code: costForm.changeReasonCode || undefined,
        spu_name: costForm.spuName,
        skc_info_list: [
          {
            skc_name: costForm.skcName,
            sku_info_list: [
              {
                sku_code: costForm.skuCode,
                cost: cost.toFixed(2),
                currency: costForm.currency,
              },
            ],
          },
        ],
      })
    },
    onSuccess: (data) => {
      if (!responseOk(data.result)) {
        toast.error(`更新成本价失败：${responseCode(data.result) || data.result.status} ${responseMessage(data.result)}`)
        return
      }
      toast.success(`成本价已提交${responseTraceId(data.result) ? `，Trace ${responseTraceId(data.result)}` : ""}`)
      setCostDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: ["shein-platform-products"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "更新成本价失败"),
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

  function openCostDialog(input: Partial<CostForm>) {
    setCostForm({
      ...DEFAULT_COST_FORM,
      currency: input.currency || currencyOptions[0] || DEFAULT_COST_FORM.currency,
      ...input,
      originalCost: input.originalCost || input.cost || "",
    })
    setCostDialogOpen(true)
  }

  function openRegressionDialog() {
    setRegressionForm((current) => ({
      ...current,
      spuName: selectedSpuName || detailProduct?.spuName || "",
    }))
    setRegressionDialogOpen(true)
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
    `SKU ${formatNumber(skuCount)}`,
    selectedSpuName ? `当前 ${selectedSpuName}` : "",
  ].filter(Boolean).join(" / ")

  const operationSourceLabel = selectedSpuName ? `当前 SPU：${selectedSpuName}` : "最近平台商品操作"

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={view === "sites" ? "站点币种" : view === "detail" ? "SPU 商品详情" : "平台商品列表"}
        description={
          view === "sites"
            ? "查询和同步 SHEIN 店铺站点、币种、启用状态，为供货价、拼款和站点运营提供基础口径。"
            : view === "detail"
              ? "从平台商品列表进入单个 SPU，查看 SKC/SKU 明细并处理编辑、拼款、供货价和状态同步。"
              : "同步 SHEIN 平台已上架商品并持久化到本地，作为商品链接全生命周期管理的入口。"
        }
      >
        {view === "detail" ? (
          <Button variant="outline" onClick={() => navigate("/shein-platform-products")}>
            <ArrowLeft className="size-4" />
            返回列表
          </Button>
        ) : null}
        {view === "list" ? (
          <Button variant="outline" onClick={() => navigate("/shein-platform-products/sites")}>
            <Globe2 className="size-4" />
            站点币种
          </Button>
        ) : null}
        {view === "sites" ? (
          <Button variant="outline" onClick={() => syncSitesMutation.mutate()} disabled={syncSitesMutation.isPending}>
            {syncSitesMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Globe2 className="size-4" />}
            同步站点币种
          </Button>
        ) : null}
        {view === "list" ? (
          <>
            <Button onClick={() => syncProductsMutation.mutate()} disabled={syncProductsMutation.isPending}>
              {syncProductsMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              同步平台商品
            </Button>
            <Button
              variant="outline"
              onClick={() => batchSyncStatusMutation.mutate()}
              disabled={batchSyncStatusMutation.isPending}
            >
              {batchSyncStatusMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
              批量同步状态
            </Button>
          </>
        ) : null}
        <Button variant="outline" onClick={() => setOperationsDialogOpen(true)}>
          <History className="size-4" />
          查看最近操作
        </Button>
        <Button variant="outline" onClick={openRegressionDialog}>
          <ClipboardCheck className="size-4" />
          真实数据回归
        </Button>
      </PageHeader>

      {view === "list" ? (
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <CardTitle>平台商品列表</CardTitle>
                <p className="text-sm text-muted-foreground">{productSummary}</p>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:flex-wrap lg:justify-end">
                <div className="relative md:w-72">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submitSearch()
                    }}
                    placeholder="搜索 SPU、SKC、SKU、商家货号"
                    className="pl-9"
                  />
                </div>
                <Button type="button" variant="outline" onClick={submitSearch}>
                  <Search className="size-4" />
                  搜索
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void productsQuery.refetch()}
                  disabled={productsQuery.isFetching}
                >
                  <RefreshCw className={productsQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
                  刷新本地列表
                </Button>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <Input
                value={syncFilters.updateTimeStart}
                onChange={(event) => setSyncFilters((current) => ({ ...current, updateTimeStart: event.target.value }))}
                placeholder="同步更新时间开始"
              />
              <Input
                value={syncFilters.updateTimeEnd}
                onChange={(event) => setSyncFilters((current) => ({ ...current, updateTimeEnd: event.target.value }))}
                placeholder="同步更新时间结束"
              />
              <Input
                value={syncFilters.insertTimeStart}
                onChange={(event) => setSyncFilters((current) => ({ ...current, insertTimeStart: event.target.value }))}
                placeholder="同步创建时间开始"
              />
              <Input
                value={syncFilters.insertTimeEnd}
                onChange={(event) => setSyncFilters((current) => ({ ...current, insertTimeEnd: event.target.value }))}
                placeholder="同步创建时间结束"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SPU</TableHead>
                    <TableHead>商品</TableHead>
                    <TableHead>SKC/SKU</TableHead>
                    <TableHead>同步状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        加载本地平台商品...
                      </TableCell>
                    </TableRow>
                  ) : productRows.length ? (
                    productRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <button
                            type="button"
                            className="font-mono text-sm font-medium hover:text-[var(--brand-deep)] hover:underline"
                            onClick={() => navigate(`/shein-platform-products/${encodeURIComponent(row.spuName)}`)}
                          >
                            {row.spuName}
                          </button>
                          <div className="mt-1 text-xs text-muted-foreground">{row.supplierCode || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[280px] truncate text-sm font-medium">{row.productName || "—"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {[row.brandCode, row.categoryId, row.productTypeId].filter(Boolean).join(" / ") || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            SKC {formatNumber(row.skcCount)} / SKU {formatNumber(row.skuCount)}
                          </div>
                          <div className="mt-1 flex max-w-[340px] flex-wrap gap-1">
                            {row.skuCodeList.length ? (
                              row.skuCodeList.slice(0, 6).map((skuCode) => (
                                <Badge key={skuCode} variant="outline" className="font-mono">
                                  {skuCode}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">详情同步后显示 SKU</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
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
                          <div className="mt-1 text-xs text-muted-foreground">
                            {row.lastDetailSyncedAt || row.lastListSyncedAt || row.updatedAt || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/shein-platform-products/${encodeURIComponent(row.spuName)}`)}
                            >
                              <Eye className="size-4" />
                              SPU 详情
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => syncDetailMutation.mutate(row.spuName)}
                              disabled={syncDetailMutation.isPending}
                            >
                              <PackageSearch className="size-4" />
                              同步详情
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => checkEditMutation.mutate(row.spuName)}
                              disabled={checkEditMutation.isPending}
                            >
                              <ClipboardCheck className="size-4" />
                              检查可编辑
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => syncStatusMutation.mutate(row.spuName)}
                              disabled={syncStatusMutation.isPending}
                            >
                              <RefreshCw className={syncStatusMutation.isPending ? "size-4 animate-spin" : "size-4"} />
                              同步状态
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                        暂无本地平台商品数据。先点击“同步平台商品”，将 SHEIN 已上架商品拉回本地台账。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ServerPagination
              pagination={pagination}
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
                  <p className="text-xs text-muted-foreground">类目/类型</p>
                  <p className="mt-1 text-sm font-medium">
                    {detailProduct?.categoryId || "—"} / {detailProduct?.productTypeId || "—"}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">可编辑</p>
                  <p className="mt-1 truncate text-sm font-medium">{detailProduct?.editableStatus || "未检查"}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">平台状态</p>
                  <p className="mt-1 truncate text-sm font-medium">{detailProduct?.productStatus || "未同步"}</p>
                </div>
              </div>

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
                                        originalCost: sku.currentCost,
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更新成本价/供货价</DialogTitle>
            <DialogDescription>
              供货价通过 SHEIN `/open-api/goods/update-cost` 提交，成功后会记录生命周期操作并更新本地 SKU 成本价。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cost-spu">SPU</Label>
              <Input
                id="cost-spu"
                value={costForm.spuName}
                onChange={(event) => setCostForm((current) => ({ ...current, spuName: event.target.value.trim() }))}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="cost-skc">SKC</Label>
                <Input
                  id="cost-skc"
                  value={costForm.skcName}
                  onChange={(event) => setCostForm((current) => ({ ...current, skcName: event.target.value.trim() }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cost-sku">SKU</Label>
                <Input
                  id="cost-sku"
                  value={costForm.skuCode}
                  onChange={(event) => setCostForm((current) => ({ ...current, skuCode: event.target.value.trim() }))}
                />
              </div>
            </div>
            {costForm.supplierSku ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                商家 SKU：{costForm.supplierSku}
              </div>
            ) : null}
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
          <DialogFooter>
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

      <Dialog open={regressionDialogOpen} onOpenChange={setRegressionDialogOpen}>
        <DialogContent>
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
        <DialogContent className="max-w-3xl">
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
        <DialogContent className="max-w-5xl">
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
        <DialogContent className="max-w-4xl">
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
        <DialogContent className="max-w-3xl">
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
