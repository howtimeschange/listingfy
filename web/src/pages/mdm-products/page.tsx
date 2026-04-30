import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  Database,
  ImageIcon,
  Search,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { EmptyState } from "@/components/empty-state"
import { ServerPagination } from "@/components/server-pagination"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface MdmProductItem {
  spu_code: string
  spu_name: string | null
  spu_name_en: string | null
  listing_title_cn: string | null
  listing_title_en: string | null
  shein_spu_code: string | null
  shein_category_name: string | null
  old_style_code: string | null
  deepdraw_info_status: string | null
  brand_code: string | null
  brand_name: string | null
  year: string | null
  season_name: string | null
  product_line_name: string | null
  middle_class_name: string | null
  subclass_name: string | null
  gender_name: string | null
  age_group_name: string | null
  price_tag: number | null
  status_name: string | null
  enable_status: string | null
  approve_status: string | null
  synced_at: string | null
  skc_count: number
  sku_count: number
  color_count: number
  size_count: number
  hero_image_url: string | null
}

interface MdmProductList {
  items: MdmProductItem[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

interface MdmProductSummary {
  spu_count: number
  skc_count: number
  sku_count: number
  status_count: number
  latest_synced_at: string | null
}

function useMdmProducts(query: string, pagination: { limit: number; offset: number }) {
  return useQuery<MdmProductList>({
    queryKey: ["mdm-products", query, pagination],
    queryFn: () => api.get(`/mdm-products?q=${encodeURIComponent(query)}&limit=${pagination.limit}&offset=${pagination.offset}`),
  })
}

function useMdmProductSummary() {
  return useQuery<MdmProductSummary>({
    queryKey: ["mdm-products", "summary"],
    queryFn: () => api.get("/mdm-products/summary"),
  })
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

function StatusBadge({
  value,
}: {
  value: string | null
}) {
  return (
    <Badge
      variant="outline"
      className="border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
    >
      {value ?? "未标记"}
    </Badge>
  )
}

function productTitle(item: MdmProductItem) {
  return item.listing_title_cn ?? item.spu_name ?? item.listing_title_en ?? item.spu_name_en ?? item.spu_code
}

export default function MdmProductsPage() {
  const [searchText, setSearchText] = useState("")
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const debouncedSearch = useDebounce(searchText, 300)
  const { data, isLoading } = useMdmProducts(debouncedSearch, pagination)
  const { data: summary } = useMdmProductSummary()

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="MDM 商品主数据"
        description="以 MDM 主数据为准，按 SPU、SKC、SKU 三层维度查看商品资料、分类、状态和价格包装字段。"
      />

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>SPU 主数据列表</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              SPU {formatNumber(summary?.spu_count)} / SKC {formatNumber(summary?.skc_count)} / SKU {formatNumber(summary?.sku_count)} / 最近同步 {summary?.latest_synced_at ? formatDateTime(summary.latest_synced_at) : "—"}
            </p>
          </div>
          <div className="relative w-full lg:w-[420px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜索 SPU、款名、品牌、类目、SHEIN 类目"
              className="pl-9"
            />
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
                    <ProductThumb src={item.hero_image_url} alt={productTitle(item)} />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/mdm-products/${item.spu_code}`}
                        className="font-medium hover:text-[var(--brand-deep)] hover:underline"
                      >
                        {item.spu_code}
                      </Link>
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {productTitle(item)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <StatusBadge value={item.status_name ?? item.enable_status} />
                    {item.approve_status ? <StatusBadge value={item.approve_status} /> : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">层级数量</div>
                      <div>{item.skc_count} SKC / {item.sku_count} SKU</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">颜色尺码</div>
                      <div>{item.color_count} 色 / {item.size_count} 码</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">类目</div>
                      <div>{item.middle_class_name ?? item.shein_category_name ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">价格</div>
                      <div>{formatCurrency(item.price_tag)}</div>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                    <Link to={`/mdm-products/${item.spu_code}`}>
                      查看详情
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState message="暂无 MDM 主数据" icon={Database} />
            )}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[88px]">图片</TableHead>
                  <TableHead>SPU</TableHead>
                  <TableHead>品牌/季节</TableHead>
                  <TableHead>类目</TableHead>
                  <TableHead>维度</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>同步时间</TableHead>
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
                      <TableCell colSpan={8}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.items.length ? (
                  data.items.map((item) => (
                    <TableRow key={item.spu_code}>
                      <TableCell>
                        <ProductThumb src={item.hero_image_url} alt={productTitle(item)} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Link
                            to={`/mdm-products/${item.spu_code}`}
                            className="font-medium hover:text-[var(--brand-deep)] hover:underline"
                          >
                            {item.spu_code}
                          </Link>
                          <div className="max-w-[360px] truncate text-sm text-muted-foreground">
                            {productTitle(item)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            SHEIN SPU：{item.shein_spu_code ?? "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{[item.brand_code, item.brand_name].filter(Boolean).join(" ") || "—"}</div>
                        <div className="text-muted-foreground">
                          {[item.year, item.season_name].filter(Boolean).join(" / ") || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{item.product_line_name ?? item.middle_class_name ?? "—"}</div>
                        <div className="text-muted-foreground">
                          {[item.subclass_name, item.shein_category_name].filter(Boolean).join(" / ") || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{item.skc_count} SKC / {item.sku_count} SKU</div>
                        <div className="text-muted-foreground">
                          {item.color_count} 色 / {item.size_count} 码
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(item.price_tag)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge value={item.status_name ?? item.enable_status} />
                          {item.deepdraw_info_status ? (
                            <Badge variant="outline">
                              深绘：{item.deepdraw_info_status}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(item.synced_at)}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/mdm-products/${item.spu_code}`}>
                            查看
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                      暂无 MDM 主数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>当前展示 {formatNumber(data?.items.length ?? 0)} 条</span>
            <span>共 {formatNumber(data?.pagination.total)} 条 SPU</span>
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
