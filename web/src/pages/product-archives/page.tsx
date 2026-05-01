import { useMemo, useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  Check,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { parseBatchSearch } from "@/lib/spreadsheet"
import { useDebounce } from "@/hooks/use-debounce"
import { FilterTrigger } from "@/components/filter-trigger"
import { ServerPagination } from "@/components/server-pagination"
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

type SyncSource = "mdm" | "deepdraw" | "mdm_deepdraw"
type SourceStatus = "SYNCED" | "MISSING"

interface ProductArchiveItem {
  spu_code: string
  spu_name: string | null
  listing_title_cn: string | null
  listing_title_en: string | null
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
  mdm_status: SourceStatus
  deepdraw_status: SourceStatus
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

interface ImportBucketResult {
  imported_count: number
  missing: string[]
}

function useProductArchives(
  query: string,
  brand: string,
  pagination: { limit: number; offset: number },
) {
  return useQuery<ProductArchiveList>({
    queryKey: ["product-archives", query, brand, pagination],
    queryFn: () =>
      api.get(
        `/product-archives?q=${encodeURIComponent(query)}&brand=${encodeURIComponent(brand)}&limit=${pagination.limit}&offset=${pagination.offset}`,
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

function SourceBadge({ label, status }: { label: string; status: SourceStatus }) {
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

function selectedStatusesLabel(values: SourceStatus[]) {
  if (values.length === 0) return "来源状态"
  if (values.length === 2) return "已选 2 种状态"
  return values[0] === "SYNCED" ? "已同步" : "未同步"
}

export default function ProductArchivesPage() {
  const [searchText, setSearchText] = useState("")
  const [brandFilter, setBrandFilter] = useState("all")
  const [mdmStatusFilter, setMdmStatusFilter] = useState<SourceStatus[]>([])
  const [deepdrawStatusFilter, setDeepdrawStatusFilter] = useState<SourceStatus[]>([])
  const [syncCodes, setSyncCodes] = useState("")
  const [syncSource, setSyncSource] = useState<SyncSource>("mdm_deepdraw")
  const [deepdrawTenantName, setDeepdrawTenantName] = useState("电商巴拉巴拉")
  const [syncJobId, setSyncJobId] = useState<string | null>(null)
  const [batchBucketText, setBatchBucketText] = useState("")
  const [selectedSpus, setSelectedSpus] = useState<string[]>([])
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const debouncedSearch = useDebounce(searchText, 300)
  const queryClient = useQueryClient()
  const codePreview = parseBatchSearch(syncCodes)

  const { data, isLoading } = useProductArchives(debouncedSearch, brandFilter, pagination)
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

  const items = useMemo(() => {
    return (data?.items ?? []).filter((item) => {
      const mdmOk = mdmStatusFilter.length === 0 || mdmStatusFilter.includes(item.mdm_status)
      const deepdrawOk = deepdrawStatusFilter.length === 0 || deepdrawStatusFilter.includes(item.deepdraw_status)
      return mdmOk && deepdrawOk
    })
  }, [data?.items, deepdrawStatusFilter, mdmStatusFilter])
  const selectedSet = useMemo(() => new Set(selectedSpus), [selectedSpus])
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedSet.has(item.spu_code))
  const selectedBrand = config?.brands.find((item) => item.brandCode === brandFilter)
  const recommendedTenant = selectedBrand?.deepdrawTenantName
  const syncProgress = syncJob
    ? Math.round(((syncJob.completed_count + syncJob.failed_count) / syncJob.total_count) * 100)
    : 0
  const batchBucketCount = parseBatchSearch(batchBucketText).length
  const shouldChooseDeepdrawTenant = syncSource === "deepdraw" || syncSource === "mdm_deepdraw"
  const syncSourceLabel = (source: SyncSource) => {
    if (source === "mdm_deepdraw") return "MDM + 深绘"
    if (source === "deepdraw") return "深绘"
    return "MDM"
  }

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (codePreview.length === 0) throw new Error("请输入款号")
      return api.post<SyncJob>("/product-archives/sync-jobs", {
        source: syncSource,
        codes: syncCodes,
        intervalMs: 1500,
        deepdrawTenantName: shouldChooseDeepdrawTenant ? deepdrawTenantName : undefined,
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

  const importBucketMutation = useMutation({
    mutationFn: () => {
      const spuCodes = batchBucketCount > 0 ? parseBatchSearch(batchBucketText) : selectedSpus
      if (spuCodes.length === 0) throw new Error("请先勾选商品或粘贴款号")
      return api.post<ImportBucketResult>("/shein-products/import", { spu_codes: spuCodes })
    },
    onSuccess: async (result) => {
      toast.success(`已加入 SHEIN 商品分桶：${formatNumber(result.imported_count)} 款`)
      if (result.missing.length) toast.warning(`未找到款号：${result.missing.join("、")}`)
      setSelectedSpus([])
      setBatchBucketText("")
      await queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "加入分桶失败")
    },
  })

  function toggleStatus(
    values: SourceStatus[],
    setter: (value: SourceStatus[]) => void,
    status: SourceStatus,
  ) {
    setter(values.includes(status) ? values.filter((item) => item !== status) : [...values, status])
  }

  function toggleSpu(spuCode: string) {
    setSelectedSpus((prev) =>
      prev.includes(spuCode) ? prev.filter((item) => item !== spuCode) : [...prev, spuCode],
    )
  }

  function toggleAllVisible(checked: boolean) {
    if (!checked) {
      setSelectedSpus((prev) => prev.filter((spuCode) => !items.some((item) => item.spu_code === spuCode)))
      return
    }
    setSelectedSpus((prev) => Array.from(new Set([...prev, ...items.map((item) => item.spu_code)])))
  }

  const rowSummary = [
    `共 ${formatNumber(data?.pagination.total ?? summary?.total ?? 0)} 条`,
    `MDM ${formatNumber(summary?.mdm_count ?? 0)}`,
    `深绘 ${formatNumber(summary?.deepdraw_count ?? 0)}`,
    `双源完整 ${formatNumber(summary?.complete_count ?? 0)}`,
    `已勾选 ${formatNumber(selectedSpus.length)}`,
  ].join(" / ")

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="商品档案"
        description="源数据留档页，只保留 MDM、深绘内容包和图片素材状态；平台业务字段进入 SHEIN 商品分桶处理。"
      />

      <Card className="min-h-0">
        <CardHeader className="gap-4 pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-1">
              <CardTitle>源数据列表</CardTitle>
              <p className="text-sm text-muted-foreground">{rowSummary}</p>
            </div>
            <div className="flex w-full flex-col gap-2 md:flex-row xl:w-auto">
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
                      粘贴一批款号后入队执行，服务端会串行请求并按 1500ms 间隔控频。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Textarea
                      value={syncCodes}
                      onChange={(event) => setSyncCodes(event.target.value)}
                      placeholder={"粘贴款号，支持换行、逗号或空格分隔\n208226102001\n208226103201"}
                      className="min-h-32"
                    />
                    <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_108px] sm:items-end">
                      <div className="space-y-1.5">
                        <div className="text-xs font-medium text-muted-foreground">同步方式</div>
                        <Select
                          value={syncSource}
                          onValueChange={(value) => {
                            const nextSource = value as SyncSource
                            setSyncSource(nextSource)
                            if ((nextSource === "deepdraw" || nextSource === "mdm_deepdraw") && recommendedTenant) {
                              setDeepdrawTenantName(recommendedTenant)
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mdm_deepdraw">MDM + 深绘</SelectItem>
                            <SelectItem value="mdm">MDM</SelectItem>
                            <SelectItem value="deepdraw">深绘</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {shouldChooseDeepdrawTenant ? (
                        <div className="space-y-1.5">
                          <div className="text-xs font-medium text-muted-foreground">深绘租户</div>
                          <Select value={deepdrawTenantName} onValueChange={setDeepdrawTenantName}>
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
                        </div>
                      ) : (
                        <div className="hidden sm:block" />
                      )}
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
                    <div className="text-xs text-muted-foreground">
                      已识别 {codePreview.length} 个款号；服务端会串行同步，默认间隔 1500ms。
                    </div>
                    {syncJob ? (
                      <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {syncSourceLabel(syncJob.source)} 队列：
                            {syncJob.status === "completed" ? "已完成" : "执行中"}
                          </span>
                          <span className="text-muted-foreground">
                            {syncJob.completed_count + syncJob.failed_count}/{syncJob.total_count}
                          </span>
                        </div>
                        <Progress value={syncProgress} />
                        <div className="max-h-28 space-y-1 overflow-auto font-mono text-xs">
                          {syncJob.items.map((item) => (
                            <div key={item.spu_code} className="flex items-center justify-between gap-2">
                              <span>{item.spu_code}</span>
                              <span className={item.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
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

              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline">
                    <Check className="size-4" />
                    加入 SHEIN 商品分桶
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>加入 SHEIN 商品分桶</DialogTitle>
                    <DialogDescription>
                      默认使用当前勾选商品；也可以粘贴一批款号直接入桶，进入 SHEIN 业务字段清洗流程。
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={batchBucketText}
                    onChange={(event) => setBatchBucketText(event.target.value)}
                    rows={8}
                    placeholder={"可选：粘贴款号覆盖当前勾选\n201122104105\n208226102001"}
                  />
                  <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span>
                      当前勾选 {formatNumber(selectedSpus.length)} 款；批量输入 {formatNumber(batchBucketCount)} 款
                    </span>
                    <Button
                      type="button"
                      onClick={() => importBucketMutation.mutate()}
                      disabled={importBucketMutation.isPending || (selectedSpus.length === 0 && batchBucketCount === 0)}
                    >
                      {importBucketMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                      确认入桶
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Select
                value={brandFilter}
                onValueChange={(value) => {
                  setBrandFilter(value)
                  setPagination((current) => ({ ...current, offset: 0 }))
                  const brand = config?.brands.find((item) => item.brandCode === value)
                  if (brand?.deepdrawTenantName) setDeepdrawTenantName(brand.deepdrawTenantName)
                }}
              >
                <SelectTrigger className="md:w-[180px]">
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <FilterTrigger active={mdmStatusFilter.length + deepdrawStatusFilter.length > 0}>
                    {selectedStatusesLabel([...mdmStatusFilter, ...deepdrawStatusFilter])}
                  </FilterTrigger>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>MDM 状态</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={mdmStatusFilter.includes("SYNCED")}
                    onCheckedChange={() => toggleStatus(mdmStatusFilter, setMdmStatusFilter, "SYNCED")}
                  >
                    MDM 已同步
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={mdmStatusFilter.includes("MISSING")}
                    onCheckedChange={() => toggleStatus(mdmStatusFilter, setMdmStatusFilter, "MISSING")}
                  >
                    MDM 未同步
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>深绘状态</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={deepdrawStatusFilter.includes("SYNCED")}
                    onCheckedChange={() => toggleStatus(deepdrawStatusFilter, setDeepdrawStatusFilter, "SYNCED")}
                  >
                    深绘已同步
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={deepdrawStatusFilter.includes("MISSING")}
                    onCheckedChange={() => toggleStatus(deepdrawStatusFilter, setDeepdrawStatusFilter, "MISSING")}
                  >
                    深绘未同步
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="relative md:w-[320px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value)
                    setPagination((current) => ({ ...current, offset: 0 }))
                  }}
                  placeholder="搜索款号、源标题、品牌、源类目"
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => toggleAllVisible(Boolean(checked))}
                      aria-label="全选当前商品"
                    />
                  </TableHead>
                  <TableHead className="w-[88px]">图片</TableHead>
                  <TableHead>商品</TableHead>
                  <TableHead>来源状态</TableHead>
                  <TableHead>MDM 源数据</TableHead>
                  <TableHead>深绘源数据</TableHead>
                  <TableHead>图片素材</TableHead>
                  <TableHead className="w-[92px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length ? (
                  items.map((item) => (
                    <TableRow key={item.spu_code}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSet.has(item.spu_code)}
                          onCheckedChange={() => toggleSpu(item.spu_code)}
                          aria-label={`选择 ${item.spu_code}`}
                        />
                      </TableCell>
                      <TableCell>
                        <ProductThumb src={item.hero_image_url} alt={item.spu_name ?? item.deepdraw_title ?? item.spu_code} />
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
                            {item.listing_title_cn ?? item.spu_name ?? item.deepdraw_title ?? "—"}
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
                        <div>{item.product_line_name ?? item.middle_class_name ?? "—"}</div>
                        <div className="text-muted-foreground">{item.subclass_name ?? item.mdm_status_name ?? "—"}</div>
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
                          {item.deepdraw_synced_at ? formatDateTime(item.deepdraw_synced_at) : "—"}
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
                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                      暂无商品档案
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <div key={item.spu_code} className="rounded-lg border bg-card p-4">
                <div className="flex gap-3">
                  <Checkbox
                    checked={selectedSet.has(item.spu_code)}
                    onCheckedChange={() => toggleSpu(item.spu_code)}
                    aria-label={`选择 ${item.spu_code}`}
                  />
                  <ProductThumb src={item.hero_image_url} alt={item.spu_name ?? item.deepdraw_title ?? item.spu_code} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/product-archives/${item.spu_code}`} className="font-medium">
                      {item.spu_code}
                    </Link>
                    <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {item.listing_title_cn ?? item.spu_name ?? item.deepdraw_title ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <SourceBadge label="MDM " status={item.mdm_status} />
                  <SourceBadge label="深绘 " status={item.deepdraw_status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">MDM</div>
                    <div>{item.mdm_skc_count} SKC / {item.mdm_sku_count} SKU</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">深绘</div>
                    <div>{item.deepdraw_skc_count} SKC / {item.deepdraw_sku_count} SKU</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">图片</div>
                    <div>{item.product_image_count} 商品图 / {item.detail_image_count} 商详图</div>
                  </div>
                </div>
              </div>
            ))}
            {!isLoading && items.length === 0 ? (
              <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                暂无商品档案
              </div>
            ) : null}
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
