import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Archive,
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
  Trash2,
  Upload,
} from "lucide-react"
import { ApiError, api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { parseBatchSearch } from "@/lib/spreadsheet"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { BatchPublishDialog } from "@/components/pre-publish/batch-publish-dialog"
import { ServerPagination } from "@/components/server-pagination"
import type { ServerPaginationState } from "@/components/server-pagination"
import {
  CompactListCard,
  CompactListCardContent,
  CompactListCardHeader,
  CompactListHeader,
  CompactListPage,
} from "@/components/layout/compact-list-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardTitle } from "@/components/ui/card"
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

interface CreateDraftResult {
  created_count: number
  missing: string[]
  items: Array<{
    listing_id: number
    spu_code: string
    publish_unit_no?: string
    version_no: number
    category_auto_selected?: boolean
    category_needs_review?: boolean
    category_selection_message?: string
  }>
}

interface BatchImagePackageResult {
  ok: boolean
  package: {
    file_name: string
    size: number
    spu_count: number
    skc_count: number
    source_image_count: number
    ignored_entry_count: number
  }
  scope: "SELECTED_DRAFTS" | "ALL_SHEIN_DRAFTS"
  matched_draft_count: number
  matched_spu_count: number
  matched_skc_count: number
  imported_count: number
  replaced_count: number
  unmatched_spu_codes: string[]
  unmatched_skc_codes: string[]
  warning_count: number
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
    const body = error.body as { message?: string; error_message?: string } | null
    return body?.message ?? body?.error_message ?? error.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
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
  const [batchImagePackageDialogOpen, setBatchImagePackageDialogOpen] = useState(false)
  const [batchImagePackageFile, setBatchImagePackageFile] = useState<File | null>(null)
  const [batchImagePackageResult, setBatchImagePackageResult] = useState<BatchImagePackageResult | null>(null)
  const [batchImageDialogOpen, setBatchImageDialogOpen] = useState(false)
  const [batchImageFolderPath, setBatchImageFolderPath] = useState("")
  const { data: platformData } = usePlatforms()
  const { data: categoryData } = useDraftCategories(platform)
  const { data: draftData, isLoading } = useDrafts(platform, batchSearchText, categoryFilter, draftPagination)
  const drafts = useMemo(() => draftData?.items ?? [], [draftData?.items])
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
  const createDraftMutation = useMutation({
    mutationFn: (spuCodes: string[]) =>
      api.post<CreateDraftResult>("/pre-publish/drafts", {
        platform,
        spu_codes: spuCodes,
        auto_select_category: true,
      }),
    onSuccess: async (result) => {
      const createdCount = result.items?.length ?? result.created_count ?? 0
      const autoSelectedCount = result.items?.filter((item) => item.category_auto_selected).length ?? 0
      const categoryReviewCount = result.items?.filter((item) => item.category_needs_review).length ?? 0
      toast.success(
        `已派生 ${formatNumber(createdCount)} 个新草稿；自动选类目 ${formatNumber(autoSelectedCount)} 个；类目待确认 ${formatNumber(categoryReviewCount)} 个`,
      )
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
  const batchImportFoldersMutation = useMutation({
    mutationFn: () =>
      api.post<{ imported_count: number }>("/pre-publish/drafts/batch-import-folders", {
        listing_ids: Array.from(selectedDraftIds),
        folder_path: batchImageFolderPath,
      }),
    onSuccess: async (result) => {
      toast.success(`批量导入图片目录完成：${formatNumber(result.imported_count)} 张`)
      setBatchImageDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
    },
    onError: (error) => toast.error(errorMessage(error, "批量导入图片目录失败")),
  })
  const batchUploadImagePackageMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      form.append("listing_ids", JSON.stringify(Array.from(selectedDraftIds)))
      return api.postForm<BatchImagePackageResult>("/pre-publish/drafts/batch-upload-image-package", form)
    },
    onSuccess: async (result) => {
      setBatchImagePackageResult(result)
      if (result.imported_count > 0) {
        toast.success(`图包匹配完成：${formatNumber(result.imported_count)} 张图片字段已填充`)
      } else {
        toast.warning("图包已解析，但没有匹配到可填充的草稿图片字段")
      }
      await queryClient.invalidateQueries({ queryKey: ["pre-publish", "drafts"] })
    },
    onError: (error) => toast.error(errorMessage(error, "批量上传图包失败")),
  })
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
    <CompactListPage>
      <CompactListHeader
        title="SHEIN 发布草稿箱"
        summary={`草稿 ${formatNumber(draftData?.pagination.total ?? 0)} / 平均完整度 ${avgCompleteness}% / 已勾选 ${formatNumber(selectedDraftIds.size)} 个`}
        description="同一个 SHEIN 商品可以派生多个独立草稿；每个草稿有自己的状态、版本记录、发布任务和字段填充进度。"
        actions={(
          <>
            <Dialog open={batchImagePackageDialogOpen} onOpenChange={setBatchImagePackageDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                  <Upload className="size-4" />
                  批量上传图包
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>批量上传 SHEIN 图包</DialogTitle>
                  <DialogDescription>
                    ZIP 结构为“款号 / SKC / SKC_序号.jpg”。系统按完整 SKC 精确匹配草稿，原图按序填入主图/细节图，第一张同时生成方形图和 80×80 色块图。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="rounded-lg border border-dashed p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                        <Archive className="size-5 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {batchImagePackageFile?.name ?? "选择 ZIP 图包"}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {batchImagePackageFile
                            ? `${formatNumber(Math.ceil(batchImagePackageFile.size / 1024 / 1024))} MB`
                            : "最大 600MB；支持 JPG、JPEG、PNG 图片"}
                        </span>
                      </span>
                    </div>
                    <input
                      type="file"
                      aria-label="选择 SHEIN ZIP 图包"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      className="mt-3 block w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium"
                      onChange={(event) => {
                        setBatchImagePackageFile(event.target.files?.[0] ?? null)
                        setBatchImagePackageResult(null)
                      }}
                    />
                  </div>
                  <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
                    {selectedDraftIds.size > 0 ? (
                      <p>本次只匹配已勾选的 {formatNumber(selectedDraftIds.size)} 个草稿。</p>
                    ) : (
                      <p>当前未勾选草稿，本次将按图包款号匹配全部 SHEIN 发布草稿。</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">重复上传同一款色时，只替换上一轮图包自动填充的图片，不影响人工上传和素材库图片。</p>
                  </div>
                  {batchImagePackageResult ? (
                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div><p className="text-xs text-muted-foreground">图包款号</p><p className="mt-1 font-semibold">{formatNumber(batchImagePackageResult.package.spu_count)}</p></div>
                        <div><p className="text-xs text-muted-foreground">匹配草稿</p><p className="mt-1 font-semibold">{formatNumber(batchImagePackageResult.matched_draft_count)}</p></div>
                        <div><p className="text-xs text-muted-foreground">匹配 SKC</p><p className="mt-1 font-semibold">{formatNumber(batchImagePackageResult.matched_skc_count)}</p></div>
                        <div><p className="text-xs text-muted-foreground">填充图片字段</p><p className="mt-1 font-semibold text-emerald-700">{formatNumber(batchImagePackageResult.imported_count)}</p></div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        已解析 {formatNumber(batchImagePackageResult.package.source_image_count)} 张原图
                        {batchImagePackageResult.replaced_count > 0 ? `；替换上一轮 ${formatNumber(batchImagePackageResult.replaced_count)} 张` : ""}
                        {batchImagePackageResult.warning_count > 0 ? `；${formatNumber(batchImagePackageResult.warning_count)} 条提示` : ""}
                      </p>
                      {batchImagePackageResult.unmatched_spu_codes.length > 0 ? (
                        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          未匹配款号：{batchImagePackageResult.unmatched_spu_codes.join("、")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() => batchImagePackageFile && batchUploadImagePackageMutation.mutate(batchImagePackageFile)}
                    disabled={!batchImagePackageFile || batchUploadImagePackageMutation.isPending}
                  >
                    {batchUploadImagePackageMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                    {batchUploadImagePackageMutation.isPending ? "正在上传并匹配…" : "上传并批量填充"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={createDraftFromSelectedProducts}
              disabled={createDraftMutation.isPending || selectedSpuCodes.length === 0}
            >
              {createDraftMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              派生新草稿
            </Button>
            <Dialog open={createDraftDialogOpen} onOpenChange={setCreateDraftDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                  <Plus className="size-4" />
                  新建草稿
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新建 SHEIN 发布草稿</DialogTitle>
                  <DialogDescription>
                    输入 SHEIN 商品分桶中的款号；生成时会先用确认规则和确定性算法选类目，再对未命中的商品调用 AI。低置信或歧义结果会保留为待确认。
                  </DialogDescription>
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
            <BatchPublishDialog
              listingIds={Array.from(selectedDraftIds)}
              triggerLabel="批量提交发布"
              disabled={selectedDraftIds.size === 0}
            />
            <Dialog open={batchImageDialogOpen} onOpenChange={setBatchImageDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline" disabled={selectedDraftIds.size === 0}>
                  <ImageIcon className="size-4" />
                  批量导入图片目录
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>批量导入图片目录</DialogTitle>
                  <DialogDescription>对已勾选草稿批量执行本地目录导入；系统按目录名和文件名匹配 SKC。</DialogDescription>
                </DialogHeader>
                <Textarea
                  value={batchImageFolderPath}
                  onChange={(event) => setBatchImageFolderPath(event.target.value)}
                  rows={3}
                  placeholder="/Users/xingyicheng/Downloads/20112210410530435"
                />
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() => batchImportFoldersMutation.mutate()}
                    disabled={batchImportFoldersMutation.isPending || !batchImageFolderPath.trim()}
                  >
                    {batchImportFoldersMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    批量导入图片目录
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      />

      <CompactListCard>
        <CompactListCardHeader className="gap-3">
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
        </CompactListCardHeader>
        <CompactListCardContent>
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">草稿加载中...</div>
          ) : drafts.length === 0 ? (
            <EmptyState icon={FileClock} message="暂无发布草稿，请先到 SHEIN 商品分桶勾选商品并创建草稿" />
          ) : (
            <Table containerClassName="h-full overflow-auto">
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
            compact
            className="shrink-0 bg-card px-0"
            pagination={draftData?.pagination}
            onLimitChange={(limit) => setDraftPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setDraftPagination((current) => ({ ...current, offset }))}
          />
        </CompactListCardContent>
      </CompactListCard>

    </CompactListPage>
  )
}
