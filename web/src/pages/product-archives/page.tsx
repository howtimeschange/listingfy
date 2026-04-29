import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  Database,
  FileImage,
  ImageIcon,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type SyncSource = "mdm" | "deepdraw"

interface ProductArchiveItem {
  spu_code: string
  spu_name: string | null
  listing_title_cn: string | null
  listing_title_en: string | null
  shein_spu_code: string | null
  shein_category_name: string | null
  matched_category_rule_id: number | null
  matched_category_rule_source: string | null
  matched_category_match_key: string | null
  matched_shein_category_id: number | null
  matched_shein_product_type_id: number | null
  matched_shein_category_name: string | null
  matched_shein_category_path: string | null
  suggested_category_suggestion_id: number | null
  suggested_category_rule_source: string | null
  suggested_shein_category_id: number | null
  suggested_shein_product_type_id: number | null
  suggested_shein_category_name: string | null
  suggested_shein_category_path: string | null
  old_style_code: string | null
  deepdraw_info_status: string | null
  mdm_brand_code: string | null
  mdm_brand_name: string | null
  year: string | null
  season_name: string | null
  product_line_name: string | null
  middle_class_name: string | null
  subclass_name: string | null
  gender_name: string | null
  age_group_name: string | null
  mdm_status_name: string | null
  mdm_synced_at: string | null
  deepdraw_title: string | null
  deepdraw_brand_name: string | null
  deepdraw_category_name: string | null
  deepdraw_synced_at: string | null
  mdm_status: "SYNCED" | "MISSING"
  deepdraw_status: "SYNCED" | "MISSING"
  mdm_skc_count: number
  mdm_sku_count: number
  deepdraw_skc_count: number
  deepdraw_sku_count: number
  product_image_count: number
  detail_image_count: number
  hero_image_url: string | null
}

interface ProductArchiveList {
  items: ProductArchiveItem[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

interface ProductArchiveSummary {
  total: number
  mdm_count: number
  deepdraw_count: number
  complete_count: number
}

interface BrandMapping {
  brandCode: string
  brandName: string
  aliases: string[]
  deepdrawTenantName: string | null
}

interface DeepdrawTenantOption {
  tenantName: string
  merchantId: string
  relatedBrandCodes: string[]
}

interface ProductArchiveConfig {
  brands: BrandMapping[]
  deepdraw_tenants: DeepdrawTenantOption[]
}

interface SyncJobItem {
  spu_code: string
  status: "queued" | "running" | "completed" | "failed"
  error: string | null
}

interface SyncJob {
  id: string
  source: SyncSource
  status: "queued" | "running" | "completed"
  interval_ms: number
  options: {
    deepdrawTenantName: string | null
  }
  total_count: number
  completed_count: number
  failed_count: number
  items: SyncJobItem[]
}

function useProductArchives(query: string, brand: string) {
  return useQuery<ProductArchiveList>({
    queryKey: ["product-archives", query, brand],
    queryFn: () =>
      api.get(
        `/product-archives?q=${encodeURIComponent(query)}&brand=${encodeURIComponent(brand)}&limit=100`,
      ),
  })
}

function useProductArchiveSummary() {
  return useQuery<ProductArchiveSummary>({
    queryKey: ["product-archives", "summary"],
    queryFn: () => api.get("/product-archives/summary"),
  })
}

function useProductArchiveConfig() {
  return useQuery<ProductArchiveConfig>({
    queryKey: ["product-archives", "config"],
    queryFn: () => api.get("/product-archives/config"),
  })
}

function parseCodesPreview(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,，;；]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function SourceBadge({
  label,
  status,
}: {
  label: string
  status: "SYNCED" | "MISSING"
}) {
  return (
    <Badge
      variant="outline"
      className={
        status === "SYNCED"
          ? "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
          : "border-[#f4ddb3] bg-[#fff8e8] text-[#c37d0d]"
      }
    >
      {label}{status === "SYNCED" ? "已同步" : "未同步"}
    </Badge>
  )
}

function ProductThumb({
  src,
  alt,
}: {
  src: string | null
  alt: string
}) {
  if (!src) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
        <ImageIcon className="size-5" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-14 w-14 rounded-2xl border object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  )
}

export default function ProductArchivesPage() {
  const [searchText, setSearchText] = useState("")
  const [brandFilter, setBrandFilter] = useState("all")
  const [syncCodes, setSyncCodes] = useState("")
  const [syncSource, setSyncSource] = useState<SyncSource>("mdm")
  const [deepdrawTenantName, setDeepdrawTenantName] = useState("电商巴拉巴拉")
  const [syncIntervalMs, setSyncIntervalMs] = useState("1500")
  const [syncJobId, setSyncJobId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(searchText, 300)
  const queryClient = useQueryClient()
  const codePreview = parseCodesPreview(syncCodes)

  const { data, isLoading } = useProductArchives(debouncedSearch, brandFilter)
  const { data: summary } = useProductArchiveSummary()
  const { data: config } = useProductArchiveConfig()
  const { data: syncJob } = useQuery<SyncJob>({
    queryKey: ["product-archive-sync-job", syncJobId],
    queryFn: () => api.get(`/product-archives/sync-jobs/${syncJobId}`),
    enabled: Boolean(syncJobId),
    refetchInterval: (query) => {
      const job = query.state.data
      return job && job.status !== "completed" ? 1500 : false
    },
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (codePreview.length === 0) throw new Error("请输入款号")
      return api.post<SyncJob>("/product-archives/sync-jobs", {
        source: syncSource,
        codes: syncCodes,
        intervalMs: Number(syncIntervalMs),
        deepdrawTenantName: syncSource === "deepdraw" ? deepdrawTenantName : undefined,
      })
    },
    onSuccess: async (result) => {
      setSyncJobId(result.id)
      await queryClient.invalidateQueries({ queryKey: ["product-archives"] })
      toast.success(`已加入同步队列：${result.total_count} 个款号`)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "同步失败")
    },
  })

  const syncProgress = syncJob
    ? Math.round(((syncJob.completed_count + syncJob.failed_count) / syncJob.total_count) * 100)
    : 0
  const selectedBrand = config?.brands.find((item) => item.brandCode === brandFilter)
  const recommendedTenant = selectedBrand?.deepdrawTenantName

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="商品档案"
        description="聚合 MDM 商品主数据与深绘内容包，按 SPU 查看双源状态、图片资产和同步进度。"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="档案总数"
          value={formatNumber(summary?.total)}
          icon={PackageSearch}
        />
        <StatCard
          title="MDM 已同步"
          value={formatNumber(summary?.mdm_count)}
          icon={Database}
        />
        <StatCard
          title="深绘已同步"
          value={formatNumber(summary?.deepdraw_count)}
          icon={FileImage}
        />
        <StatCard
          title="双源完整"
          value={formatNumber(summary?.complete_count)}
          icon={RefreshCw}
        />
      </div>

      <Card className="min-h-0">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>档案列表</CardTitle>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  <RefreshCw className="size-4" />
                  批量同步
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>批量同步</DialogTitle>
                  <DialogDescription>
                    粘贴一批款号后入队执行，服务端会串行请求并按间隔控频，避免 MDM 或深绘接口被打得太密。
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Textarea
                    value={syncCodes}
                    onChange={(event) => setSyncCodes(event.target.value)}
                    placeholder={"粘贴款号，支持换行、逗号或空格分隔\n208226102001\n208226103201"}
                    className="min-h-32"
                  />
                  <div className="grid gap-2 sm:grid-cols-[132px_minmax(0,1fr)_108px]">
                    <Select
                      value={syncSource}
                      onValueChange={(value) => {
                        const nextSource = value as SyncSource
                        setSyncSource(nextSource)
                        if (nextSource === "deepdraw" && recommendedTenant) {
                          setDeepdrawTenantName(recommendedTenant)
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mdm">MDM</SelectItem>
                        <SelectItem value="deepdraw">深绘</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={syncIntervalMs}
                      onChange={(event) => setSyncIntervalMs(event.target.value)}
                      inputMode="numeric"
                      placeholder="请求间隔 ms"
                      className="min-w-0"
                    />
                    <Button
                      type="button"
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending || codePreview.length === 0}
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      入队
                    </Button>
                  </div>
                  {syncSource === "deepdraw" ? (
                    <Select
                      value={deepdrawTenantName}
                      onValueChange={setDeepdrawTenantName}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择深绘同步租户" />
                      </SelectTrigger>
                      <SelectContent>
                        {config?.deepdraw_tenants.map((tenant) => (
                          <SelectItem key={tenant.tenantName} value={tenant.tenantName}>
                            {tenant.tenantName} / {tenant.merchantId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  <div className="text-xs text-muted-foreground">
                    已识别 {codePreview.length} 个款号；服务端会串行同步，默认间隔 1500ms。
                    {syncSource === "deepdraw" ? ` 当前租户：${deepdrawTenantName}` : ""}
                  </div>
                  {syncJob ? (
                    <div className="space-y-3 rounded-2xl border bg-muted/40 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {syncJob.source.toUpperCase()} 队列：{syncJob.status === "completed" ? "已完成" : "执行中"}
                        </span>
                        <span className="text-muted-foreground">
                          {syncJob.completed_count + syncJob.failed_count}/{syncJob.total_count}
                        </span>
                      </div>
                      <Progress value={syncProgress} />
                      <div className="max-h-28 space-y-1 overflow-auto font-mono text-xs">
                        {syncJob.items.map((item) => (
                          <div
                            key={item.spu_code}
                            className="flex items-center justify-between gap-2"
                          >
                            <span>{item.spu_code}</span>
                            <span
                              className={
                                item.status === "failed"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }
                            >
                              {item.error ?? item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>
            <Select
              value={brandFilter}
              onValueChange={(value) => {
                setBrandFilter(value)
                const brand = config?.brands.find((item) => item.brandCode === value)
                if (brand?.deepdrawTenantName) {
                  setDeepdrawTenantName(brand.deepdrawTenantName)
                }
              }}
            >
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue placeholder="全部品牌" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部品牌</SelectItem>
                {config?.brands.map((brand) => (
                  <SelectItem key={brand.brandCode} value={brand.brandCode}>
                    {brand.brandCode} {brand.brandName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-[360px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索款号、标题、品牌、类目"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border p-4">
                  <Skeleton className="mb-3 h-14 w-14 rounded-2xl" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))
            ) : data?.items.length ? (
              data.items.map((item) => (
                <div key={item.spu_code} className="rounded-2xl border bg-card p-4">
                  <div className="flex gap-3">
                    <ProductThumb
                      src={item.hero_image_url}
                      alt={item.spu_name ?? item.deepdraw_title ?? item.spu_code}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/product-archives/${item.spu_code}`}
                        className="font-medium hover:text-[var(--brand-deep)] hover:underline"
                      >
                        {item.spu_code}
                      </Link>
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {item.listing_title_cn
                          ?? item.spu_name
                          ?? item.deepdraw_title
                          ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <SourceBadge label="MDM " status={item.mdm_status} />
                    <SourceBadge label="深绘 " status={item.deepdraw_status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">深绘 SKU</div>
                      <div>{item.deepdraw_skc_count} SKC / {item.deepdraw_sku_count} SKU</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">SHEIN 类目</div>
                      <div>{item.matched_shein_category_name ?? item.suggested_shein_category_name ?? item.shein_category_name ?? item.deepdraw_category_name ?? "—"}</div>
                      {item.matched_shein_category_name ? (
                        <div className="text-xs text-muted-foreground">
                          映射规则：{item.matched_category_rule_source ?? "—"}
                        </div>
                      ) : item.suggested_shein_category_name ? (
                        <div className="text-xs text-muted-foreground">
                          AI 建议：{item.suggested_category_rule_source ?? "—"}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">图片</div>
                      <div>{item.product_image_count} 商品图 / {item.detail_image_count} 商详图</div>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                    <Link to={`/product-archives/${item.spu_code}`}>
                      查看档案
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
                暂无商品档案
              </div>
            )}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[88px]">图片</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>来源状态</TableHead>
                  <TableHead>发品</TableHead>
                  <TableHead>MDM</TableHead>
                  <TableHead>深绘</TableHead>
                  <TableHead>图片</TableHead>
                  <TableHead className="w-[92px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-14 w-14 rounded-2xl" />
                      </TableCell>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.items.length ? (
                  data.items.map((item) => (
                    <TableRow key={item.spu_code}>
                      <TableCell>
                        <ProductThumb
                          src={item.hero_image_url}
                          alt={item.spu_name ?? item.deepdraw_title ?? item.spu_code}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Link
                            to={`/product-archives/${item.spu_code}`}
                            className="font-medium hover:text-[var(--brand-deep)] hover:underline"
                          >
                            {item.spu_code}
                          </Link>
                          <div className="max-w-[360px] truncate text-sm text-muted-foreground">
                            {item.listing_title_cn
                              ?? item.spu_name
                              ?? item.deepdraw_title
                              ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[item.mdm_brand_name ?? item.deepdraw_brand_name, item.year, item.season_name]
                              .filter(Boolean)
                              .join(" / ") || "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <SourceBadge label="MDM " status={item.mdm_status} />
                          <SourceBadge label="深绘 " status={item.deepdraw_status} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{item.matched_shein_category_name ?? item.suggested_shein_category_name ?? item.shein_category_name ?? "待补 SHEIN 类目"}</div>
                        {item.matched_shein_category_name ? (
                          <div className="text-xs text-muted-foreground">
                            映射规则：{item.matched_category_rule_source ?? "—"}
                          </div>
                        ) : item.suggested_shein_category_name ? (
                          <div className="text-xs text-muted-foreground">
                            AI 建议：{item.suggested_category_rule_source ?? "—"}
                          </div>
                        ) : null}
                        <div className="text-muted-foreground">
                          老款号：{item.old_style_code ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          深绘资料：{item.deepdraw_info_status ?? (item.deepdraw_status === "SYNCED" ? "已同步" : "未同步")}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{item.product_line_name ?? item.middle_class_name ?? "—"}</div>
                        <div className="text-muted-foreground">
                          {item.subclass_name ?? item.mdm_status_name ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.mdm_synced_at ? formatDateTime(item.mdm_synced_at) : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{item.deepdraw_category_name ?? "—"}</div>
                        <div className="text-muted-foreground">
                          {item.deepdraw_skc_count} SKC / {item.deepdraw_sku_count} SKU
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.deepdraw_synced_at
                            ? formatDateTime(item.deepdraw_synced_at)
                            : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{item.product_image_count} 商品图</div>
                        <div className="text-muted-foreground">
                          {item.detail_image_count} 商详图
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/product-archives/${item.spu_code}`}>
                            查看
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-28 text-center text-muted-foreground"
                    >
                      暂无商品档案
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
