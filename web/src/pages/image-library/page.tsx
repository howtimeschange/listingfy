import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  FileImage,
  ImageIcon,
  Images,
  Layers3,
  Search,
  Sparkles,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { EmptyState } from "@/components/empty-state"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

interface ImageAssetItem {
  id: number
  source_system: string
  source_kind: string
  spu_code: string | null
  skc_code: string | null
  owner_type: string | null
  owner_code: string | null
  asset_type: string | null
  place: string | null
  picture_type: string | null
  detail_page_index: number | null
  module_name: string | null
  module_index: number | null
  normalized_url: string
  file_name: string | null
  width: number | null
  height: number | null
  file_size: number | null
  sort_no: number | null
  status: string
  synced_at: string | null
  content_title: string | null
  content_brand_name: string | null
  content_category_name: string | null
}

interface ImageAssetList {
  items: ImageAssetItem[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

interface SourceKindSummary {
  source_kind: string
  count: number
}

interface ImageAssetSummary {
  asset_count: number
  unique_url_count: number
  picture_count: number
  detail_count: number
  spu_count: number
  latest_synced_at: string | null
  source_kinds: SourceKindSummary[]
}

function useImageAssets(query: string, sourceKind: string) {
  return useQuery<ImageAssetList>({
    queryKey: ["image-library", query, sourceKind],
    queryFn: () =>
      api.get(
        `/image-library?q=${encodeURIComponent(query)}&sourceKind=${encodeURIComponent(sourceKind)}&limit=120`,
      ),
  })
}

function useImageAssetSummary() {
  return useQuery<ImageAssetSummary>({
    queryKey: ["image-library", "summary"],
    queryFn: () => api.get("/image-library/summary"),
  })
}

function sourceKindLabel(value: string | null | undefined) {
  switch (value) {
    case "PICTURE":
      return "商品图"
    case "DETAIL_SCREENSHOT":
      return "商详截图"
    case "DETAIL_MODULE":
      return "商详模块"
    default:
      return value ?? "未知"
  }
}

function formatDimensions(asset: ImageAssetItem) {
  if (!asset.width || !asset.height) return "—"
  return `${asset.width} × ${asset.height}`
}

function ImageCard({ asset }: { asset: ImageAssetItem }) {
  return (
    <Link
      to={`/image-library/${asset.id}`}
      className="group overflow-hidden rounded-2xl border bg-card shadow-[0_2px_4px_rgba(0,0,0,0.03)] transition hover:border-[var(--brand-deep)]"
    >
      <div className="aspect-square bg-muted">
        <img
          src={asset.normalized_url}
          alt={asset.file_name ?? asset.asset_type ?? "深绘图片素材"}
          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline">{sourceKindLabel(asset.source_kind)}</Badge>
          <span className="text-xs text-muted-foreground">{formatDimensions(asset)}</span>
        </div>
        <div className="min-h-10">
          <div className="truncate text-sm font-medium">
            {asset.spu_code ?? asset.owner_code ?? asset.file_name ?? `#${asset.id}`}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {asset.content_title ?? asset.asset_type ?? asset.picture_type ?? "—"}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{asset.skc_code ?? asset.module_name ?? asset.place ?? "SPU"}</span>
          <ArrowRight className="size-3.5 opacity-0 transition group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  )
}

export default function ImageLibraryPage() {
  const [searchText, setSearchText] = useState("")
  const [sourceKind, setSourceKind] = useState("all")
  const debouncedSearch = useDebounce(searchText, 300)
  const { data, isLoading } = useImageAssets(debouncedSearch, sourceKind)
  const { data: summary } = useImageAssetSummary()

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="图片素材库"
        description="以深绘同步的图片为准，全量展示商品图、商详截图与模块图片，并按 SPU、SKC、素材类型钻取。"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="图片素材" value={formatNumber(summary?.asset_count)} icon={Images} />
        <StatCard title="去重 URL" value={formatNumber(summary?.unique_url_count)} icon={Sparkles} />
        <StatCard
          title="商品/商详"
          value={`${formatNumber(summary?.picture_count)} / ${formatNumber(summary?.detail_count)}`}
          icon={FileImage}
        />
        <StatCard title="关联 SPU" value={formatNumber(summary?.spu_count)} icon={Layers3} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>素材列表</CardTitle>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <Select value={sourceKind} onValueChange={setSourceKind}>
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {summary?.source_kinds.map((item) => (
                  <SelectItem key={item.source_kind} value={item.source_kind}>
                    {sourceKindLabel(item.source_kind)} ({formatNumber(item.count)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full lg:w-[420px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索 SPU、SKC、文件名、图片类型、深绘标题"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="rounded-2xl border p-3">
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : data?.items.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
              {data.items.map((asset) => (
                <ImageCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <EmptyState message="暂无图片素材" icon={ImageIcon} />
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>当前展示 {formatNumber(data?.items.length ?? 0)} 张</span>
            <span>
              共 {formatNumber(data?.pagination.total)} 张；最近同步 {formatDateTime(summary?.latest_synced_at)}
            </span>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
