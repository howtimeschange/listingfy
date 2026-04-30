import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CopyPlus,
  FileClock,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from "lucide-react"
import { ApiError, api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { parseBatchSearch } from "@/lib/spreadsheet"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { ServerPagination } from "@/components/server-pagination"
import type { ServerPaginationState } from "@/components/server-pagination"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
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

interface PlatformOption {
  platform: string
  label: string
  enabled: boolean
  account_name: string
  business_mode: string
}

interface DraftItem {
  id: number
  platform: string
  spu_code: string
  publish_unit_no: string | null
  title: string | null
  spu_name: string | null
  brand_name: string | null
  year: string | null
  season_name: string | null
  product_line_name: string | null
  middle_class_name: string | null
  subclass_name: string | null
  gender_name: string | null
  price_tag: number | null
  hero_image_url: string | null
  hero_color_name: string | null
  hero_skc_code: string | null
  skc_preview: Array<{
    skc_code: string
    color_name: string | null
    image_url: string | null
  }>
  platform_category_name: string | null
  status: string
  validation_status: string
  completeness: number
  latest_version_no: number | null
  blocker_count: number
  skc_count: number
  sku_count: number
  updated_at: string
}

interface DraftListResponse {
  items: DraftItem[]
  pagination: ServerPaginationState
}

interface DraftCategory {
  category_id: number
  product_type_id: number
  category_name: string | null
  path: string | null
  listing_count: number
}

interface BlockingField {
  field_key: string
  field_label: string
  field_value: string | number | null
  status: string
  source: string
  note: string | null
  group: string
}

interface BatchPublishCheckItem {
  listing_id: number
  spu_code?: string
  title?: string | null
  category_name?: string | null
  ok: boolean
  errors: string[]
  fields: BlockingField[]
  quick_fixes?: {
    sku_weights: Array<{
      sku_id: number
      sku_code: string
      skc_code: string | null
      size_name: string | null
      package_weight_g: number | null
      selected_for_publish?: boolean
    }>
    image_confirmations: Array<{
      skc_id: number
      skc_code: string
      color_name: string | null
      image_url: string | null
      selected_for_publish?: boolean
      confirmed: boolean
      required: boolean
    }>
  }
}

interface BatchPublishCheckResponse {
  ok: boolean
  blocker_count: number
  items: BatchPublishCheckItem[]
}

interface CreateDraftResult {
  created_count: number
  missing: string[]
  items: Array<{ listing_id: number; spu_code: string; publish_unit_no?: string; version_no: number }>
}

function usePlatforms() {
  return useQuery<{ items: PlatformOption[] }>({
    queryKey: ["pre-publish", "platforms"],
    queryFn: () => api.get("/pre-publish/platforms"),
  })
}

function useDraftCategories(platform: string) {
  return useQuery<{ items: DraftCategory[] }>({
    queryKey: ["pre-publish", "draft-categories", platform],
    queryFn: () => api.get(`/pre-publish/draft-categories?platform=${encodeURIComponent(platform)}`),
  })
}

function useDrafts(platform: string, batchSearch: string, categoryFilter: string, pagination: { limit: number; offset: number }) {
  return useQuery<DraftListResponse>({
    queryKey: ["pre-publish", "drafts", platform, batchSearch, categoryFilter, pagination],
    queryFn: () =>
      api.get(
        `/pre-publish/drafts?platform=${encodeURIComponent(platform)}&batch_search=${encodeURIComponent(batchSearch)}&category_id=${encodeURIComponent(categoryFilter)}&limit=${pagination.limit}&offset=${pagination.offset}`,
      ),
  })
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "草稿",
    NEEDS_ENRICHMENT: "待补齐",
    READY_TO_VALIDATE: "待校验",
    VALIDATION_FAILED: "校验失败",
    READY_TO_PUBLISH: "可发布",
    PAUSED: "已暂停",
    ARCHIVED: "已归档",
    PUBLISHING: "发布中",
    PUBLISH_SUBMITTED: "已提交",
    PUBLISH_FAILED: "发布失败",
  }
  return labels[status] ?? status
}

function validationLabel(status: string) {
  const labels: Record<string, string> = {
    NOT_VALIDATED: "未校验",
    FAILED: "有阻断",
    PASSED: "已通过",
  }
  return labels[status] ?? status
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string } | null
    return body?.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

function batchEditKey(listingId: number, id: number | string) {
  return `${listingId}:${id}`
}

function hasQuickAdjustments(item: BatchPublishCheckItem) {
  const quickFixes = item.quick_fixes
  return Boolean(
    item.fields.length
    || quickFixes?.sku_weights.length
    || quickFixes?.image_confirmations.length,
  )
}

function ProductThumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-16 w-12 items-center justify-center rounded border bg-muted text-muted-foreground">
        <ImageIcon className="size-4" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-16 w-12 rounded border object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  )
}

export default function PrePublishValidationPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [platform, setPlatform] = useState("SHEIN")
  const batchSearchText = searchParams.get("batch_search") ?? ""
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [draftPagination, setDraftPagination] = useState({ limit: 50, offset: 0 })
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(new Set())
  const [createDraftDialogOpen, setCreateDraftDialogOpen] = useState(false)
  const [createDraftText, setCreateDraftText] = useState("")
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [fieldEdits, setFieldEdits] = useState<Record<string, string>>({})
  const [skuWeightEdits, setSkuWeightEdits] = useState<Record<string, string>>({})
  const [imageConfirmEdits, setImageConfirmEdits] = useState<Record<string, boolean>>({})
  const { data: platformData } = usePlatforms()
  const { data: categoryData } = useDraftCategories(platform)
  const { data: draftData, isLoading } = useDrafts(platform, batchSearchText, categoryFilter, draftPagination)
  const drafts = draftData?.items ?? []
  const allVisibleSelected = drafts.length > 0 && drafts.every((draft) => selectedDraftIds.has(draft.id))
  const batchCount = useMemo(() => parseBatchSearch(batchSearchText).length, [batchSearchText])
  const selectedDrafts = useMemo(
    () => drafts.filter((draft) => selectedDraftIds.has(draft.id)),
    [drafts, selectedDraftIds],
  )
  const selectedSpuCodes = useMemo(
    () => Array.from(new Set(selectedDrafts.map((draft) => draft.spu_code).filter(Boolean))),
    [selectedDrafts],
  )
  const avgCompleteness = drafts.length
    ? Math.round(drafts.reduce((sum, item) => sum + Number(item.completeness ?? 0), 0) / drafts.length)
    : 0
  const batchCheckMutation = useMutation({
    mutationFn: (listingIds: number[]) =>
      api.post<BatchPublishCheckResponse>("/pre-publish/drafts/batch-publish-check", {
        listing_ids: listingIds,
      }),
    onSuccess: (result) => {
      setBatchDialogOpen(true)
      const nextEdits: Record<string, string> = {}
      const nextWeights: Record<string, string> = {}
      const nextConfirmations: Record<string, boolean> = {}
      for (const item of result.items) {
        for (const field of item.fields) {
          nextEdits[batchEditKey(item.listing_id, field.field_key)] = String(field.field_value ?? "")
        }
        for (const sku of item.quick_fixes?.sku_weights ?? []) {
          nextWeights[batchEditKey(item.listing_id, sku.sku_id)] = String(sku.package_weight_g ?? 500)
        }
        for (const skc of item.quick_fixes?.image_confirmations ?? []) {
          nextConfirmations[batchEditKey(item.listing_id, skc.skc_id)] = Boolean(skc.confirmed)
        }
      }
      setFieldEdits(nextEdits)
      setSkuWeightEdits(nextWeights)
      setImageConfirmEdits(nextConfirmations)
    },
    onError: (error) => toast.error(errorMessage(error, "批量发布预检失败")),
  })
  const saveBlockingFieldsMutation = useMutation({
    mutationFn: async (items: BatchPublishCheckItem[]) => {
      for (const item of items) {
        const fields = item.fields
          .map((field) => ({
            field_key: field.field_key,
            field_label: field.field_label,
            field_value: fieldEdits[batchEditKey(item.listing_id, field.field_key)] ?? String(field.field_value ?? ""),
            source: "MANUAL_BATCH_FIX",
          }))
          .filter((field) => field.field_value.trim())
        if (fields.length > 0) {
          await api.patch(`/pre-publish/drafts/${item.listing_id}/fields`, { fields })
        }

        const skuWeightValues = (item.quick_fixes?.sku_weights ?? [])
          .map((sku) => ({
            sku_id: sku.sku_id,
            package_weight_g: skuWeightEdits[batchEditKey(item.listing_id, sku.sku_id)] ?? "",
          }))
          .filter((sku) => sku.package_weight_g.trim())
        const imageFixes = item.quick_fixes?.image_confirmations ?? []
        const imageConfirmedSkcIds = imageFixes
          .filter((skc) => imageConfirmEdits[batchEditKey(item.listing_id, skc.skc_id)])
          .map((skc) => skc.skc_id)
        const savePayload: {
          sku_weight_values?: typeof skuWeightValues
          image_confirmed_skc_ids?: number[]
        } = {}
        if (skuWeightValues.length > 0) savePayload.sku_weight_values = skuWeightValues
        if (imageFixes.length > 0) savePayload.image_confirmed_skc_ids = imageConfirmedSkcIds
        if (Object.keys(savePayload).length > 0) {
          await api.post(`/pre-publish/drafts/${item.listing_id}/save`, savePayload)
        }
      }
      return api.post<BatchPublishCheckResponse>("/pre-publish/drafts/batch-publish-check", {
        listing_ids: Array.from(selectedDraftIds),
      })
    },
    onSuccess: async (result) => {
      toast.success("阻断字段已保存，已重新预检")
      await queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
      batchCheckMutation.reset()
      batchCheckMutation.mutate(Array.from(selectedDraftIds))
      setFieldEdits(Object.fromEntries(result.items.flatMap((item) =>
        item.fields.map((field) => [batchEditKey(item.listing_id, field.field_key), String(field.field_value ?? "")]),
      )))
      setSkuWeightEdits(Object.fromEntries(result.items.flatMap((item) =>
        (item.quick_fixes?.sku_weights ?? []).map((sku) => [
          batchEditKey(item.listing_id, sku.sku_id),
          String(sku.package_weight_g ?? 500),
        ]),
      )))
      setImageConfirmEdits(Object.fromEntries(result.items.flatMap((item) =>
        (item.quick_fixes?.image_confirmations ?? []).map((skc) => [
          batchEditKey(item.listing_id, skc.skc_id),
          Boolean(skc.confirmed),
        ]),
      )))
    },
    onError: (error) => toast.error(errorMessage(error, "阻断字段保存失败")),
  })
  const createDraftMutation = useMutation({
    mutationFn: (spuCodes: string[]) =>
      api.post<CreateDraftResult>("/pre-publish/drafts", {
        platform,
        spu_codes: spuCodes,
      }),
    onSuccess: async (result) => {
      const createdCount = result.items?.length ?? result.created_count ?? 0
      toast.success(`已派生 ${formatNumber(createdCount)} 个新草稿`)
      setSelectedDraftIds(new Set())
      setCreateDraftText("")
      await queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
      await queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
    onError: (error) => toast.error(errorMessage(error, "派生草稿失败")),
  })
  const duplicateDraftMutation = useMutation({
    mutationFn: (listingId: number) => api.post<{ listing_id: number }>(`/pre-publish/drafts/${listingId}/duplicate`, {}),
    onSuccess: async () => {
      toast.success("已派生新草稿")
      await queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
      await queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
    onError: (error) => toast.error(errorMessage(error, "派生草稿失败")),
  })
  const updateStatusMutation = useMutation({
    mutationFn: ({ listingId, status }: { listingId: number; status: string }) =>
      api.patch(`/pre-publish/drafts/${listingId}/status`, { status }),
    onSuccess: async () => {
      toast.success("草稿状态已更新")
      await queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
      await queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
    onError: (error) => toast.error(errorMessage(error, "草稿状态更新失败")),
  })
  const deleteDraftMutation = useMutation({
    mutationFn: (listingId: number) => api.delete(`/pre-publish/drafts/${listingId}`),
    onSuccess: async (_, listingId) => {
      toast.success("草稿已删除")
      setSelectedDraftIds((current) => {
        const next = new Set(current)
        next.delete(listingId)
        return next
      })
      await queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
      await queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
    onError: (error) => toast.error(errorMessage(error, "删除草稿失败")),
  })
  const batchPublishMutation = useMutation({
    mutationFn: async (items: BatchPublishCheckItem[]) => {
      const publishable = items.filter((item) => item.ok)
      const results = []
      for (const item of publishable) {
        try {
          const result = await api.post<{
            ok: boolean
            task_id?: number
            status?: string
          }>(`/pre-publish/drafts/${item.listing_id}/publish`, { confirm: true })
          results.push({ ...item, ok: true, result })
        } catch (error) {
          results.push({ ...item, ok: false, errors: [errorMessage(error, "发布失败")] })
        }
      }
      return results
    },
    onSuccess: async (results) => {
      const successCount = results.filter((item) => item.ok).length
      const failedCount = results.length - successCount
      if (failedCount > 0) {
        toast.warning(`批量发布完成：成功 ${successCount} 个，失败 ${failedCount} 个`)
      } else {
        toast.success(`批量发布完成：成功 ${successCount} 个`)
        setBatchDialogOpen(false)
      }
      await queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
      await queryClient.invalidateQueries({ queryKey: ["publish-tasks"] })
    },
    onError: (error) => toast.error(errorMessage(error, "批量发布失败")),
  })
  const batchCheck = batchCheckMutation.data
  const blockedItems = batchCheck?.items.filter((item) => !item.ok) ?? []
  const publishableItems = batchCheck?.items.filter((item) => item.ok) ?? []

  function updateBatchSearch(value: string) {
    const next = new URLSearchParams(searchParams)
    if (value.trim()) next.set("batch_search", value)
    else next.delete("batch_search")
    setSearchParams(next)
    setDraftPagination((current) => ({ ...current, offset: 0 }))
  }

  function toggleDraft(id: number) {
    setSelectedDraftIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleVisibleDrafts(checked: boolean) {
    setSelectedDraftIds((current) => {
      const next = new Set(current)
      for (const draft of drafts) {
        if (checked) next.add(draft.id)
        else next.delete(draft.id)
      }
      return next
    })
  }

  function startBatchPublish() {
    const ids = Array.from(selectedDraftIds)
    if (ids.length === 0) {
      toast.warning("请先勾选要批量发布的草稿")
      return
    }
    batchCheckMutation.mutate(ids)
  }

  function createDraftFromSelectedProducts() {
    if (selectedSpuCodes.length === 0) {
      toast.warning("请先勾选要派生草稿的商品")
      return
    }
    createDraftMutation.mutate(selectedSpuCodes)
  }

  function createDraftFromText() {
    const spuCodes = parseBatchSearch(createDraftText)
    if (spuCodes.length === 0) {
      toast.warning("请输入要创建草稿的款号")
      return
    }
    createDraftMutation.mutate(spuCodes)
    setCreateDraftDialogOpen(false)
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="SHEIN 发布草稿箱"
        description="同一个 SHEIN 商品可以派生多个独立草稿；每个草稿有自己的状态、版本记录、发布任务和字段填充进度。"
      >
        <Button
          type="button"
          variant="outline"
          onClick={createDraftFromSelectedProducts}
          disabled={createDraftMutation.isPending || selectedSpuCodes.length === 0}
        >
          {createDraftMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Plus className="mr-2 size-4" />
          )}
          派生新草稿
        </Button>
        <Dialog open={createDraftDialogOpen} onOpenChange={setCreateDraftDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              <Plus className="mr-2 size-4" />
              新建草稿
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建 SHEIN 发布草稿</DialogTitle>
              <DialogDescription>输入 SHEIN 商品分桶中的款号；同一个款号可以重复派生多个独立草稿。</DialogDescription>
            </DialogHeader>
            <Textarea
              value={createDraftText}
              onChange={(event) => setCreateDraftText(event.target.value)}
              rows={7}
              placeholder={"201122104105\n208226102001"}
            />
            <DialogFooter>
              <Button
                type="button"
                onClick={createDraftFromText}
                disabled={createDraftMutation.isPending}
              >
                {createDraftMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                创建草稿
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          type="button"
          onClick={startBatchPublish}
          disabled={batchCheckMutation.isPending || selectedDraftIds.size === 0}
        >
          {batchCheckMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Send className="mr-2 size-4" />
          )}
          批量提交发布
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle>草稿版本</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                共 {formatNumber(draftData?.pagination.total ?? 0)} 个草稿 / 当前页平均字段完整度 {avgCompleteness}% / 已勾选 {formatNumber(selectedDraftIds.size)} 个 / 批量搜索 {batchCount ? `${batchCount} 个词` : "未启用"}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap xl:w-auto xl:justify-end">
              <div className="space-y-1 md:w-48">
                <p className="text-xs font-medium text-muted-foreground">发布平台</p>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择发布平台" />
                  </SelectTrigger>
                  <SelectContent>
                    {(platformData?.items ?? [{ platform: "SHEIN", label: "SHEIN", enabled: true }]).map((item) => (
                      <SelectItem key={item.platform} value={item.platform} disabled={!item.enabled}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="mt-auto">
                    <Search className="mr-2 size-4" />
                    批量搜索款号
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>批量搜索款号</DialogTitle>
                    <DialogDescription>粘贴款号或 SKC，支持空格、换行、逗号和分号分隔。</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={batchSearchText}
                    onChange={(event) => updateBatchSearch(event.target.value)}
                    rows={8}
                    placeholder={"201122104105\n208226102001"}
                  />
                  <p className="text-xs text-muted-foreground">当前输入 {formatNumber(batchCount)} 个搜索词。</p>
                </DialogContent>
              </Dialog>
              <div className="space-y-1 md:w-64">
                <p className="text-xs font-medium text-muted-foreground">SHEIN 类目筛选</p>
                <Select
                  value={categoryFilter}
                  onValueChange={(value) => {
                    setCategoryFilter(value)
                    setDraftPagination((current) => ({ ...current, offset: 0 }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="按 SHEIN 类目筛选" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部 SHEIN 类目</SelectItem>
                    {(categoryData?.items ?? []).map((item) => (
                      <SelectItem key={`${item.category_id}-${item.product_type_id}`} value={String(item.category_id)}>
                        {item.category_name || item.category_id} ({formatNumber(item.listing_count)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">草稿加载中...</div>
          ) : drafts.length === 0 ? (
            <EmptyState icon={FileClock} message="暂无发布草稿，请先到 SHEIN 商品分桶勾选商品并创建草稿" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => toggleVisibleDrafts(Boolean(checked))}
                      aria-label="全选当前页草稿"
                    />
                  </TableHead>
                  <TableHead className="min-w-[360px]">商品/草稿</TableHead>
                  <TableHead>平台/类目</TableHead>
                  <TableHead>字段完整度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((draft) => (
                  <TableRow key={draft.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDraftIds.has(draft.id)}
                        onCheckedChange={() => toggleDraft(draft.id)}
                        aria-label={`选择 ${draft.spu_code}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 gap-3">
                        <ProductThumb src={draft.hero_image_url} alt={`${draft.spu_code} 款色图`} />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-sm">{draft.spu_code}</p>
                            <Badge variant="outline">草稿 #{draft.id}</Badge>
                            <Badge variant="outline">{draft.publish_unit_no || "default"}</Badge>
                          </div>
                          <p className="max-w-[360px] truncate text-sm">{draft.title || draft.spu_name}</p>
                          <p className="max-w-[360px] truncate text-xs text-muted-foreground">
                            {[draft.brand_name, draft.year, draft.season_name, draft.product_line_name, draft.gender_name].filter(Boolean).join(" / ") || "商品字段待同步"}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {(draft.skc_preview ?? []).slice(0, 3).map((skc) => (
                              <Badge key={skc.skc_code} variant="outline" className="max-w-40 truncate">
                                {skc.color_name || skc.skc_code}
                              </Badge>
                            ))}
                            {draft.hero_color_name ? <Badge variant="outline">主图 {draft.hero_color_name}</Badge> : null}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{draft.platform}</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{draft.platform_category_name || "未匹配类目"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[draft.middle_class_name, draft.subclass_name].filter(Boolean).join(" / ") || "源类目待同步"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-[var(--brand-deep)]" style={{ width: `${draft.completeness}%` }} />
                        </div>
                        <p className="text-xs tabular-nums text-muted-foreground">{draft.completeness}% / {formatNumber(draft.skc_count)} 款色 / {formatNumber(draft.sku_count)} SKU</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{statusLabel(draft.status)}</Badge>
                        <Badge variant="outline">{validationLabel(draft.validation_status)}</Badge>
                        {draft.blocker_count > 0 ? <Badge variant="destructive">{draft.blocker_count} 阻断</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>v{draft.latest_version_no ?? 0}</TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDateTime(draft.updated_at)}</div>
                      <div className="text-xs text-muted-foreground">{draft.hero_skc_code || "无款色图"}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/pre-publish-validation/${draft.id}`}>编辑</Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label={`${draft.spu_code} 更多操作`}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>草稿操作</DropdownMenuLabel>
                            <DropdownMenuItem
                              onSelect={() => duplicateDraftMutation.mutate(draft.id)}
                              disabled={duplicateDraftMutation.isPending}
                            >
                              <CopyPlus className="size-4" />
                              派生一份草稿
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => updateStatusMutation.mutate({ listingId: draft.id, status: "READY_TO_VALIDATE" })}
                              disabled={updateStatusMutation.isPending}
                            >
                              <PlayCircle className="size-4" />
                              标记待校验
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => updateStatusMutation.mutate({ listingId: draft.id, status: "PAUSED" })}
                              disabled={updateStatusMutation.isPending}
                            >
                              <PauseCircle className="size-4" />
                              暂停草稿
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => updateStatusMutation.mutate({ listingId: draft.id, status: "DRAFT" })}
                              disabled={updateStatusMutation.isPending}
                            >
                              <RefreshCw className="size-4" />
                              恢复草稿
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <ConfirmDialog
                              title="删除发布草稿"
                              description={`将删除草稿 #${draft.id} 及其版本快照、校验结果、图片补齐记录。发布中或已提交的草稿不会被删除。`}
                              confirmLabel="删除"
                              variant="destructive"
                              onConfirm={() => deleteDraftMutation.mutate(draft.id)}
                              trigger={(
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={(event) => event.preventDefault()}
                                  disabled={deleteDraftMutation.isPending}
                                >
                                  <Trash2 className="size-4" />
                                  删除草稿
                                </DropdownMenuItem>
                              )}
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <ServerPagination
            pagination={draftData?.pagination}
            onLimitChange={(limit) => setDraftPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setDraftPagination((current) => ({ ...current, offset }))}
          />
        </CardContent>
      </Card>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-h-[90dvh] sm:!max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批量提交草稿</DialogTitle>
            <DialogDescription>
              先对已勾选草稿做发布预检；没有阻断的草稿可直接提交，有字段阻断的草稿可在这里快速调整后重新预检。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">已勾选草稿</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(selectedDraftIds.size)}</p>
            </div>
            <div className="rounded border border-[#b9f4d8] bg-[#f2fff8] p-3">
              <p className="text-xs text-[#0fa76e]">可提交</p>
              <p className="mt-1 text-2xl font-semibold text-[#0fa76e]">{formatNumber(publishableItems.length)}</p>
            </div>
            <div className="rounded border border-[#f1cccc] bg-[#fff8f8] p-3">
              <p className="text-xs text-[#d45656]">有阻断</p>
              <p className="mt-1 text-2xl font-semibold text-[#d45656]">{formatNumber(blockedItems.length)}</p>
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">草稿</TableHead>
                  <TableHead>预检结果</TableHead>
                  <TableHead className="w-[420px]">快速调整字段</TableHead>
                  <TableHead className="w-[110px]">详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(batchCheck?.items ?? []).map((item) => (
                  <TableRow key={item.listing_id}>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <p className="font-mono text-sm">{item.spu_code ?? item.listing_id}</p>
                        <p className="max-w-[170px] truncate text-xs text-muted-foreground">
                          {item.title || item.category_name || "-"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      {item.ok ? (
                        <Badge variant="outline" className="border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]">
                          <CheckCircle2 className="mr-1 size-3" />
                          可提交
                        </Badge>
                      ) : (
                        <div className="space-y-2">
                          <Badge variant="outline" className="border-[#f1cccc] bg-[#fff1f1] text-[#d45656]">
                            <AlertTriangle className="mr-1 size-3" />
                            {formatNumber(item.errors.length)} 个阻断
                          </Badge>
                          <div className="space-y-1">
                            {item.errors.slice(0, 4).map((error) => (
                              <p key={error} className="text-xs text-muted-foreground">{error}</p>
                            ))}
                            {item.errors.length > 4 ? (
                              <p className="text-xs text-muted-foreground">还有 {formatNumber(item.errors.length - 4)} 个阻断，请进详情处理。</p>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {hasQuickAdjustments(item) ? (
                        <div className="space-y-4">
                          {item.fields.length ? (
                            <div className="space-y-3">
                              {item.fields.slice(0, 4).map((field) => {
                                const key = batchEditKey(item.listing_id, field.field_key)
                                return (
                                  <label key={key} className="grid gap-1">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {field.field_label}
                                    </span>
                                    <Input
                                      value={fieldEdits[key] ?? ""}
                                      onChange={(event) => setFieldEdits((current) => ({
                                        ...current,
                                        [key]: event.target.value,
                                      }))}
                                      placeholder="填写字段值"
                                    />
                                    {field.note ? <span className="text-xs text-muted-foreground">{field.note}</span> : null}
                                  </label>
                                )
                              })}
                              {item.fields.length > 4 ? (
                                <p className="text-xs text-muted-foreground">还有 {formatNumber(item.fields.length - 4)} 个字段，请打开详情页完整调整。</p>
                              ) : null}
                            </div>
                          ) : null}

                          {item.quick_fixes?.sku_weights.length ? (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">SKU 毛重/g</p>
                              <div className="space-y-2">
                                {item.quick_fixes.sku_weights.slice(0, 6).map((sku) => {
                                  const key = batchEditKey(item.listing_id, sku.sku_id)
                                  return (
                                    <div key={key} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate font-mono text-xs">{sku.sku_code}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                          {sku.skc_code || "-"} / {sku.size_name || "-"}
                                        </p>
                                      </div>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={skuWeightEdits[key] ?? ""}
                                        onChange={(event) => setSkuWeightEdits((current) => ({
                                          ...current,
                                          [key]: event.target.value,
                                        }))}
                                        placeholder="500"
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                              {item.quick_fixes.sku_weights.length > 6 ? (
                                <p className="text-xs text-muted-foreground">
                                  还有 {formatNumber(item.quick_fixes.sku_weights.length - 6)} 个 SKU 毛重，请打开详情页批量处理。
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {item.quick_fixes?.image_confirmations.length ? (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">SKC 图片确认</p>
                              <div className="grid gap-2">
                                {item.quick_fixes.image_confirmations.slice(0, 4).map((skc) => {
                                  const key = batchEditKey(item.listing_id, skc.skc_id)
                                  return (
                                    <label key={key} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2 rounded border p-2">
                                      {skc.image_url ? (
                                        <img
                                          src={skc.image_url}
                                          alt={`${skc.skc_code} 款色图`}
                                          className="h-12 w-9 rounded border object-cover"
                                          loading="lazy"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <span className="flex h-12 w-9 items-center justify-center rounded border bg-muted text-muted-foreground">
                                          <Camera className="size-4" />
                                        </span>
                                      )}
                                      <span className="min-w-0">
                                        <span className="block truncate font-mono text-xs">{skc.skc_code}</span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                          {skc.color_name || "未识别颜色"}{skc.required ? " / 必须确认" : ""}
                                        </span>
                                      </span>
                                      <Checkbox
                                        checked={Boolean(imageConfirmEdits[key])}
                                        onCheckedChange={(checked) => setImageConfirmEdits((current) => ({
                                          ...current,
                                          [key]: Boolean(checked),
                                        }))}
                                        aria-label={`确认 ${skc.skc_code} 图片`}
                                      />
                                    </label>
                                  )
                                })}
                              </div>
                              {item.quick_fixes.image_confirmations.length > 4 ? (
                                <p className="text-xs text-muted-foreground">
                                  还有 {formatNumber(item.quick_fixes.image_confirmations.length - 4)} 个 SKC 图片，请打开详情页完整确认。
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {item.ok ? "无需调整" : "当前阻断需要打开详情页处理，例如类目枚举、尺码枚举或图片补齐。"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/pre-publish-validation/${item.listing_id}`}>打开详情</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => saveBlockingFieldsMutation.mutate(blockedItems)}
              disabled={saveBlockingFieldsMutation.isPending || blockedItems.every((item) => !hasQuickAdjustments(item))}
            >
              {saveBlockingFieldsMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              保存调整并重新预检
            </Button>
            <Button
              type="button"
              onClick={() => batchPublishMutation.mutate(batchCheck?.items ?? [])}
              disabled={batchPublishMutation.isPending || publishableItems.length === 0 || blockedItems.length > 0}
            >
              {batchPublishMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              确认批量发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
