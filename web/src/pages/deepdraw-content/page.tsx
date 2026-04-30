import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  FileText,
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

interface DeepdrawContentItem {
  id: number
  source_code: string
  spu_code: string
  deepdraw_product_id: string | null
  title: string | null
  brand_name: string | null
  category_name: string | null
  trade_path: string | null
  retail_price: number | null
  primary_color: string | null
  version: number | null
  complete: number
  response_code: number | null
  reason: string | null
  synced_at: string | null
  skc_count: number
  sku_count: number
  field_count: number
  key_field_count: number
  detail_page_count: number
  asset_count: number
  hero_image_url: string | null
}

interface DeepdrawContentList {
  items: DeepdrawContentItem[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

interface DeepdrawContentSummary {
  package_count: number
  skc_count: number
  sku_count: number
  field_count: number
  detail_page_count: number
  asset_count: number
  latest_synced_at: string | null
}

function useDeepdrawContent(query: string, pagination: { limit: number; offset: number }) {
  return useQuery<DeepdrawContentList>({
    queryKey: ["deepdraw-content", query, pagination],
    queryFn: () => api.get(`/deepdraw-content?q=${encodeURIComponent(query)}&limit=${pagination.limit}&offset=${pagination.offset}`),
  })
}

function useDeepdrawContentSummary() {
  return useQuery<DeepdrawContentSummary>({
    queryKey: ["deepdraw-content", "summary"],
    queryFn: () => api.get("/deepdraw-content/summary"),
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

function CompleteBadge({ complete }: { complete: number }) {
  return (
    <Badge
      variant="outline"
      className={
        complete
          ? "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
          : "border-[#f4ddb3] bg-[#fff8e8] text-[#c37d0d]"
      }
    >
      {complete ? "完整" : "未完整"}
    </Badge>
  )
}

function itemTitle(item: DeepdrawContentItem) {
  return item.title ?? item.spu_code
}

export default function DeepDrawContentPage() {
  const [searchText, setSearchText] = useState("")
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const debouncedSearch = useDebounce(searchText, 300)
  const { data, isLoading } = useDeepdrawContent(debouncedSearch, pagination)
  const { data: summary } = useDeepdrawContentSummary()

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="深绘内容包"
        description="以深绘同步数据为准，全量展示内容包、款色 SKU、关键字段、尺码表、商详页面和图片素材。"
      />

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>内容包列表</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              内容包 {formatNumber(summary?.package_count)} / SKC {formatNumber(summary?.skc_count)} / SKU {formatNumber(summary?.sku_count)} / 字段 {formatNumber(summary?.field_count)} / 商详 {formatNumber(summary?.detail_page_count)} / 素材 {formatNumber(summary?.asset_count)}
            </p>
          </div>
          <div className="relative w-full lg:w-[420px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜索 SPU、标题、品牌、类目、行业路径"
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
                <div key={item.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex gap-3">
                    <ProductThumb src={item.hero_image_url} alt={itemTitle(item)} />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/deepdraw-content/${item.spu_code}`}
                        className="font-medium hover:text-[var(--brand-deep)] hover:underline"
                      >
                        {item.spu_code}
                      </Link>
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {itemTitle(item)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <CompleteBadge complete={item.complete} />
                    {item.response_code != null ? <Badge variant="outline">响应 {item.response_code}</Badge> : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">SKU</div>
                      <div>{item.skc_count} SKC / {item.sku_count} SKU</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">字段</div>
                      <div>{item.key_field_count} 关键 / {item.field_count} 全量</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">商详</div>
                      <div>{item.detail_page_count} 页 / {item.asset_count} 素材</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">价格</div>
                      <div>{formatCurrency(item.retail_price)}</div>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                    <Link to={`/deepdraw-content/${item.spu_code}`}>
                      查看详情
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState message="暂无深绘内容包" icon={FileText} />
            )}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[88px]">图片</TableHead>
                  <TableHead>内容包</TableHead>
                  <TableHead>品牌/类目</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>字段</TableHead>
                  <TableHead>商详/素材</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>状态</TableHead>
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
                    <TableRow key={item.id}>
                      <TableCell>
                        <ProductThumb src={item.hero_image_url} alt={itemTitle(item)} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Link
                            to={`/deepdraw-content/${item.spu_code}`}
                            className="font-medium hover:text-[var(--brand-deep)] hover:underline"
                          >
                            {item.spu_code}
                          </Link>
                          <div className="max-w-[380px] truncate text-sm text-muted-foreground">
                            {itemTitle(item)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            源编码：{item.source_code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{item.brand_name ?? "—"}</div>
                        <div className="max-w-[260px] truncate text-muted-foreground">
                          {item.category_name ?? item.trade_path ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.skc_count} SKC / {item.sku_count} SKU
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{item.key_field_count} 关键字段</div>
                        <div className="text-muted-foreground">{item.field_count} 全量字段</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{item.detail_page_count} 页</div>
                        <div className="text-muted-foreground">{item.asset_count} 张素材</div>
                      </TableCell>
                      <TableCell>{formatCurrency(item.retail_price)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <CompleteBadge complete={item.complete} />
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(item.synced_at)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/deepdraw-content/${item.spu_code}`}>
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
                      暂无深绘内容包
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>当前展示 {formatNumber(data?.items.length ?? 0)} 条</span>
            <span>共 {formatNumber(data?.pagination.total)} 个内容包</span>
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
