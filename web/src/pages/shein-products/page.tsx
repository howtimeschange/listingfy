import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  Bot,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from "@/lib/format"
import { parseBatchSearch } from "@/lib/spreadsheet"
import { ServerPagination } from "@/components/server-pagination"
import type { ServerPaginationState } from "@/components/server-pagination"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface SheinBucketItem {
  id: number
  product_spu_id: number
  spu_code: string
  bucket_status: string
  platform_category_id: number | null
  product_type_id: number | null
  platform_category_name: string | null
  platform_category_path: string | null
  category_source: string | null
  category_status: string
  title_cn: string | null
  title_en: string | null
  supply_discount: number | null
  supply_price_cny: number | null
  retail_price_usd: number | null
  package_size_text: string | null
  weight_record_count: number
  size_match_count: number
  sku_count: number
  skc_count: number
  image_status: string
  readiness_status: string
  latest_listing_id: number | null
  latest_version_no: number | null
  latest_publish_status: string | null
  raw_payload_json: string
  spu_name: string | null
  brand_code: string | null
  brand_name: string | null
  year: string | null
  season_name: string | null
  product_line_name: string | null
  middle_class_name: string | null
  subclass_name: string | null
  gender_name: string | null
  deepdraw_title: string | null
  deepdraw_brand_name: string | null
  deepdraw_category_name: string | null
  hero_image_url: string | null
  updated_at: string
}

interface SheinBucketResponse {
  items: SheinBucketItem[]
  summary: {
    total: number
    ready_count: number
    needs_work_count: number
    avg_completeness: number
    missing_field_count: number
    needs_ai_count: number
    drafted_count: number
  }
  pagination: ServerPaginationState
}

interface FilterOption {
  brand_code?: string | null
  brand_name?: string | null
  category_id?: number | null
  product_type_id?: number | null
  category_name?: string | null
  path?: string | null
  count: number
}

interface SheinBucketFilters {
  brands: FilterOption[]
  categories: FilterOption[]
  bucket_statuses: string[]
  category_statuses: string[]
  readiness_statuses: string[]
  image_statuses: string[]
}

interface CreateDraftResult {
  created_count: number
  missing: string[]
  items: Array<{ listing_id: number; spu_code: string; version_no: number }>
}

interface AiFillResult {
  saved_count: number
}

const STATUS_LABELS: Record<string, string> = {
  IN_BUCKET: "清洗中",
  DRAFTED: "已建草稿",
  PUBLISHED: "已发布",
  PAUSED: "暂停",
  READY: "就绪",
  NEEDS_REVIEW: "待复核",
  NEEDS_SKC_REVIEW: "按款色复核",
  NEEDS_ENRICHMENT: "待补齐",
  PENDING: "待处理",
  MISSING: "缺失",
  NEEDS_DETAIL: "缺细节图",
}

function labelFor(status: string) {
  return STATUS_LABELS[status] ?? status
}

function useSheinProducts(params: {
  q: string
  batchSearch: string
  brandCodes: string[]
  categoryIds: string[]
  bucketStatuses: string[]
  categoryStatuses: string[]
  readinessStatuses: string[]
  imageStatuses: string[]
  pagination: { limit: number; offset: number }
}) {
  return useQuery<SheinBucketResponse>({
    queryKey: ["shein-products", params],
    queryFn: () => {
      const search = new URLSearchParams({
        q: params.q,
        batch_search: params.batchSearch,
        brand_codes: params.brandCodes.join(","),
        category_ids: params.categoryIds.join(","),
        bucket_statuses: params.bucketStatuses.join(","),
        category_statuses: params.categoryStatuses.join(","),
        readiness_statuses: params.readinessStatuses.join(","),
        image_statuses: params.imageStatuses.join(","),
      })
      return api.get(
        `/shein-products?${search.toString()}&limit=${params.pagination.limit}&offset=${params.pagination.offset}`,
      )
    },
  })
}

function useSheinFilters() {
  return useQuery<SheinBucketFilters>({
    queryKey: ["shein-products", "filters"],
    queryFn: () => api.get("/shein-products/filters"),
  })
}

function ProductThumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        <ImageIcon className="size-5" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-14 w-14 rounded-lg border object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  )
}

function FilterMenu({
  label,
  selected,
  options,
  optionKey,
  optionLabel,
  onToggle,
}: {
  label: string
  selected: string[]
  options: FilterOption[]
  optionKey: (item: FilterOption) => string
  optionLabel: (item: FilterOption) => string
  onToggle: (value: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {selected.length ? `${label} ${selected.length}` : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((item) => {
          const key = optionKey(item)
          return (
            <DropdownMenuCheckboxItem
              key={key}
              checked={selected.includes(key)}
              onCheckedChange={() => onToggle(key)}
            >
              {optionLabel(item)}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StatusFilterMenu({
  label,
  selected,
  options,
  onToggle,
}: {
  label: string
  selected: string[]
  options: string[]
  onToggle: (value: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {selected.length ? `${label} ${selected.length}` : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((item) => (
          <DropdownMenuCheckboxItem
            key={item}
            checked={selected.includes(item)}
            onCheckedChange={() => onToggle(item)}
          >
            {labelFor(item)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function parsePayload(value: string | null | undefined) {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function fieldCompleteness(item: SheinBucketItem) {
  const payload = parsePayload(item.raw_payload_json)
  const field = payload.field_completeness && typeof payload.field_completeness === "object"
    ? payload.field_completeness as Record<string, unknown>
    : {}
  const completeness = Number(field.completeness ?? 0)
  const missing = Number(field.missing_field_count ?? 0)
  const needsAi = Number(field.needs_ai_count ?? 0)
  return {
    completeness: Number.isFinite(completeness) ? completeness : 0,
    missing: Number.isFinite(missing) ? missing : 0,
    needsAi: Number.isFinite(needsAi) ? needsAi : 0,
  }
}

export default function SheinProductsPage() {
  const [search, setSearch] = useState("")
  const [batchSearchText, setBatchSearchText] = useState("")
  const [brandCodes, setBrandCodes] = useState<string[]>([])
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [bucketStatusFilter, setBucketStatusFilter] = useState<string[]>([])
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<string[]>([])
  const [readinessStatusFilter, setReadinessStatusFilter] = useState<string[]>([])
  const [imageStatusFilter] = useState<string[]>([])
  const [selectedSpus, setSelectedSpus] = useState<string[]>([])
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading } = useSheinProducts({
    q: search,
    batchSearch: batchSearchText,
    brandCodes,
    categoryIds,
    bucketStatuses: bucketStatusFilter,
    categoryStatuses: categoryStatusFilter,
    readinessStatuses: readinessStatusFilter,
    imageStatuses: imageStatusFilter,
    pagination,
  })
  const { data: filters } = useSheinFilters()
  const items = data?.items ?? []
  const selectedSet = useMemo(() => new Set(selectedSpus), [selectedSpus])
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedSet.has(item.spu_code))
  const batchCount = parseBatchSearch(batchSearchText).length

  const refreshMutation = useMutation({
    mutationFn: (spuCode: string) => api.post(`/shein-products/${encodeURIComponent(spuCode)}/refresh`, {}),
    onSuccess: async () => {
      toast.success("SHEIN 商品分桶已刷新")
      await queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
    onError: () => toast.error("刷新失败"),
  })

  const aiFillMutation = useMutation({
    mutationFn: () =>
      api.post<AiFillResult>("/pre-publish/ai-fill", {
        spu_codes: selectedSpus.length ? selectedSpus : items.map((item) => item.spu_code),
      }),
    onSuccess: async (result) => {
      toast.success(`AI 补齐完成，已保存 ${result.saved_count} 个字段`)
      await queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
    onError: () => toast.error("AI 补齐失败，请稍后重试"),
  })

  const createDraftMutation = useMutation({
    mutationFn: () =>
      api.post<CreateDraftResult>("/pre-publish/drafts", {
        platform: "SHEIN",
        spu_codes: selectedSpus,
      }),
    onSuccess: (result) => {
      toast.success(`已创建/更新 ${result.created_count} 个发布草稿`)
      if (result.missing.length) toast.warning(`未处理款号：${result.missing.join("、")}`)
      const spuCodes = result.items.map((item) => item.spu_code).join("\n")
      navigate(`/pre-publish-validation?batch_search=${encodeURIComponent(spuCodes)}`)
    },
    onError: () => toast.error("创建发布草稿失败，请先勾选分桶商品"),
  })

  function toggleSpu(spuCode: string) {
    setSelectedSpus((prev) => toggleValue(prev, spuCode))
  }

  function toggleAllVisible(checked: boolean) {
    if (!checked) {
      setSelectedSpus((prev) => prev.filter((spuCode) => !items.some((item) => item.spu_code === spuCode)))
      return
    }
    setSelectedSpus((prev) => Array.from(new Set([...prev, ...items.map((item) => item.spu_code)])))
  }

  const summary = data?.summary
  const rowSummary = [
    `分桶 ${formatNumber(summary?.total ?? data?.pagination.total ?? 0)}`,
    `就绪 ${formatNumber(summary?.ready_count ?? 0)}`,
    `待处理 ${formatNumber(summary?.needs_work_count ?? 0)}`,
    `平均完整度 ${Math.round(Number(summary?.avg_completeness ?? 0))}%`,
    `需 AI 判断 ${formatNumber(summary?.needs_ai_count ?? 0)}`,
    `已建草稿 ${formatNumber(summary?.drafted_count ?? 0)}`,
    `已勾选 ${formatNumber(selectedSpus.length)}`,
  ].join(" / ")

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="SHEIN 商品分桶"
        description="从商品档案挑选进入 SHEIN 平台业务字段清洗池，在这里完成勾选发布商品、字段完整度检查、类目尺码价格毛重图片清洗和草稿创建。"
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => aiFillMutation.mutate()}
          disabled={aiFillMutation.isPending || items.length === 0}
        >
          {aiFillMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
          AI 补齐人工判断字段
        </Button>
        <Button
          type="button"
          onClick={() => createDraftMutation.mutate()}
          disabled={createDraftMutation.isPending || selectedSpus.length === 0}
        >
          {createDraftMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          创建发布草稿
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-1">
              <CardTitle>勾选发布商品</CardTitle>
              <p className="text-sm text-muted-foreground">{rowSummary}</p>
            </div>
            <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap xl:w-auto xl:justify-end">
              <div className="relative md:w-72">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPagination((current) => ({ ...current, offset: 0 }))
                  }}
                  placeholder="搜索款号、标题、类目"
                  className="pl-9"
                />
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">批量搜索款号</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>批量搜索款号</DialogTitle>
                    <DialogDescription>支持粘贴款号、SKC 或标题关键词，空格、换行、逗号分隔。</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={batchSearchText}
                    onChange={(event) => {
                      setBatchSearchText(event.target.value)
                      setPagination((current) => ({ ...current, offset: 0 }))
                    }}
                    rows={8}
                    placeholder={"201122104105\n208226102001"}
                  />
                  <p className="text-xs text-muted-foreground">当前输入 {formatNumber(batchCount)} 个搜索词。</p>
                </DialogContent>
              </Dialog>
              <FilterMenu
                label="品牌"
                selected={brandCodes}
                options={filters?.brands ?? []}
                optionKey={(item) => String(item.brand_code ?? item.brand_name ?? "")}
                optionLabel={(item) => `${item.brand_code ?? item.brand_name ?? "未识别"} ${item.brand_name ?? ""} (${formatNumber(item.count)})`}
                onToggle={(value) => {
                  setBrandCodes((current) => toggleValue(current, value))
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              />
              <FilterMenu
                label="SHEIN 类目"
                selected={categoryIds}
                options={filters?.categories ?? []}
                optionKey={(item) => String(item.category_id)}
                optionLabel={(item) => `${item.category_name ?? item.category_id} (${formatNumber(item.count)})`}
                onToggle={(value) => {
                  setCategoryIds((current) => toggleValue(current, value))
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              />
              <StatusFilterMenu
                label="分桶状态"
                selected={bucketStatusFilter}
                options={filters?.bucket_statuses ?? []}
                onToggle={(value) => {
                  setBucketStatusFilter((current) => toggleValue(current, value))
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              />
              <StatusFilterMenu
                label="类目状态"
                selected={categoryStatusFilter}
                options={filters?.category_statuses ?? []}
                onToggle={(value) => {
                  setCategoryStatusFilter((current) => toggleValue(current, value))
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              />
              <StatusFilterMenu
                label="填充状态"
                selected={readinessStatusFilter}
                options={filters?.readiness_statuses ?? []}
                onToggle={(value) => {
                  setReadinessStatusFilter((current) => toggleValue(current, value))
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => toggleAllVisible(Boolean(checked))}
                      aria-label="全选当前分桶商品"
                    />
                  </TableHead>
                  <TableHead className="w-[88px]">款色图</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>SHEIN 类目</TableHead>
                  <TableHead>字段完整度</TableHead>
                  <TableHead>业务字段</TableHead>
                  <TableHead>图片/素材</TableHead>
                  <TableHead>发布历史</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSet.has(item.spu_code)}
                          onCheckedChange={() => toggleSpu(item.spu_code)}
                          aria-label={`选择 ${item.spu_code}`}
                        />
                      </TableCell>
                      <TableCell>
                        <ProductThumb src={item.hero_image_url} alt={item.title_cn ?? item.spu_code} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Link
                            to={`/product-archives/${item.spu_code}`}
                            className="font-medium hover:text-[var(--brand-deep)] hover:underline"
                          >
                            {item.spu_code}
                          </Link>
                          <div className="max-w-[340px] truncate text-sm text-muted-foreground">
                            {item.title_cn ?? item.spu_name ?? item.deepdraw_title ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[item.brand_name ?? item.deepdraw_brand_name, item.year, item.season_name]
                              .filter(Boolean)
                              .join(" / ") || "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[260px] text-sm">
                          <div>{item.platform_category_name ?? "未匹配类目"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.category_source ?? "—"}
                          </div>
                          <Badge variant="outline" className="mt-1">
                            {labelFor(item.category_status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[var(--brand-deep)]"
                              style={{ width: `${fieldCompleteness(item).completeness}%` }}
                            />
                          </div>
                          <div className="text-xs tabular-nums text-muted-foreground">
                            字段完整度 {fieldCompleteness(item).completeness}%
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">缺失 {formatNumber(fieldCompleteness(item).missing)}</Badge>
                            <Badge variant="outline" className="border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]">
                              判断 {formatNumber(fieldCompleteness(item).needsAi)}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>尺码 {formatNumber(item.size_match_count)} / {formatNumber(item.sku_count)}</div>
                        <div className="text-muted-foreground">
                          {formatPercent(item.supply_discount)} / {formatCurrency(item.supply_price_cny)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.package_size_text ?? "—"} / 毛重记录 {formatNumber(item.weight_record_count)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline">{labelFor(item.image_status)}</Badge>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatNumber(item.skc_count)} 款色 / {formatNumber(item.sku_count)} SKU
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{labelFor(item.bucket_status)}</Badge>
                          <Badge variant="outline">{labelFor(item.readiness_status)}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.latest_listing_id ? `草稿 #${item.latest_listing_id} / v${item.latest_version_no ?? 0}` : "暂无草稿"}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(item.updated_at)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => refreshMutation.mutate(item.spu_code)}
                            disabled={refreshMutation.isPending}
                            aria-label="刷新分桶"
                          >
                            {refreshMutation.isPending && refreshMutation.variables === item.spu_code ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <RefreshCw className="size-4" />
                            )}
                          </Button>
                          {item.latest_listing_id ? (
                            <Button asChild variant="ghost" size="sm">
                              <Link to={`/pre-publish-validation/${item.latest_listing_id}`}>
                                草稿
                                <ArrowRight className="size-4" />
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                      暂无 SHEIN 商品分桶数据，可先从商品档案勾选加入。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <ServerPagination
            pagination={data?.pagination}
            onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
          />
        </CardContent>
      </Card>
    </PageContainer>
  )
}
