import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ExternalLink,
  ImageIcon,
  Maximize2,
  Search,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { EmptyState } from "@/components/empty-state"
import { ServerPagination } from "@/components/server-pagination"
import { Button } from "@/components/ui/button"
import {
  CompactListCard,
  CompactListCardContent,
  CompactListCardHeader,
  CompactListHeader,
  CompactListPage,
} from "@/components/layout/compact-list-layout"
import { Badge } from "@/components/ui/badge"
import { CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

interface ImageAssetDetailAsset extends ImageAssetItem {
  content_package_id: number | null
  content_skc_id: number | null
  detail_page_id: number | null
  source_url: string
  deepdraw_image_id: string | null
  with_watermark: number | null
  platform_url: string | null
  raw_payload_json: string
  created_at: string
  updated_at: string
  content_trade_path: string | null
  content_synced_at: string | null
}

interface ImageAssetDetail {
  asset: ImageAssetDetailAsset
  sibling_assets: ImageAssetDetailAsset[]
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

function useImageAssets(query: string, sourceKind: string, pagination: { limit: number; offset: number }) {
  return useQuery<ImageAssetList>({
    queryKey: ["image-library", query, sourceKind, pagination],
    queryFn: () =>
      api.get(
        `/image-library?q=${encodeURIComponent(query)}&sourceKind=${encodeURIComponent(sourceKind)}&limit=${pagination.limit}&offset=${pagination.offset}`,
      ),
  })
}

function useImageAssetSummary() {
  return useQuery<ImageAssetSummary>({
    queryKey: ["image-library", "summary"],
    queryFn: () => api.get("/image-library/summary"),
  })
}

function useImageAssetDetail(assetId: number | null) {
  return useQuery<ImageAssetDetail>({
    queryKey: ["image-library", "detail", assetId],
    queryFn: () => api.get(`/image-library/${encodeURIComponent(String(assetId))}`),
    enabled: assetId != null,
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

function formatFileSize(value: number | null | undefined) {
  if (value == null) return "—"
  if (value < 1024) return `${value}B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`
  return `${(value / 1024 / 1024).toFixed(1)}MB`
}

function assetTitle(asset: ImageAssetItem) {
  return asset.content_title ?? asset.file_name ?? asset.spu_code ?? asset.owner_code ?? `素材 #${asset.id}`
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="rounded-xl border bg-background px-3 py-2.5">
      <div className="text-[11px] leading-4 text-muted-foreground">{label}</div>
      <div className="mt-1 min-h-5 break-all text-sm font-medium leading-5 text-foreground">
        {value ?? "—"}
      </div>
    </div>
  )
}

function SiblingImageButton({
  asset,
  onSelect,
}: {
  asset: ImageAssetDetailAsset
  onSelect: (asset: ImageAssetDetailAsset) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(asset)}
      className="group overflow-hidden rounded-xl border bg-card text-left transition hover:border-[var(--brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/35"
    >
      <div className="flex aspect-[4/3] items-center justify-center bg-muted/40">
        <img
          src={asset.normalized_url}
          alt={asset.file_name ?? asset.asset_type ?? "同款图片素材"}
          className="h-full w-full object-contain p-1 transition duration-200 group-hover:scale-[1.02]"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="space-y-0.5 px-2 py-1.5 text-xs">
        <div className="truncate font-medium">{sourceKindLabel(asset.source_kind)}</div>
        <div className="truncate text-muted-foreground">
          {asset.skc_code ?? asset.module_name ?? asset.asset_type ?? `#${asset.id}`}
        </div>
      </div>
    </button>
  )
}

function ImageAssetPreviewDialog({
  open,
  onOpenChange,
  asset,
  detail,
  detailLoading,
  onSelectAsset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: ImageAssetItem | null
  detail?: ImageAssetDetail
  detailLoading: boolean
  onSelectAsset: (asset: ImageAssetItem) => void
}) {
  const previewAsset = detail?.asset ?? asset
  if (!previewAsset) return null

  const detailedAsset = previewAsset as Partial<ImageAssetDetailAsset>
  const title = assetTitle(previewAsset)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1440px)]">
        <div className="grid max-h-[92dvh] min-h-[560px] overflow-hidden lg:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.9fr)]">
          <div className="flex min-h-[320px] items-start justify-center overflow-y-auto bg-muted/40 p-4 lg:min-h-[680px]">
            <img
              src={previewAsset.normalized_url}
              alt={title}
              className="w-full max-w-full rounded-2xl object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="min-h-0 overflow-y-auto border-t bg-background lg:border-l lg:border-t-0">
            <DialogHeader className="border-b px-5 py-4 pr-14">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{sourceKindLabel(previewAsset.source_kind)}</Badge>
                <Badge variant="secondary">素材 #{previewAsset.id}</Badge>
              </div>
              <DialogTitle className="break-words text-2xl leading-8">{title}</DialogTitle>
              <DialogDescription className="break-words">
                {previewAsset.spu_code ?? previewAsset.owner_code ?? "未关联 SPU"} · {formatDateTime(previewAsset.synced_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 p-5">
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={previewAsset.normalized_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    打开原图
                  </a>
                </Button>
                {detailedAsset.platform_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={detailedAsset.platform_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      平台图片
                    </a>
                  </Button>
                ) : null}
              </div>

              <section className="space-y-3">
                <h3 className="text-base font-semibold leading-6">素材信息</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoItem label="尺寸" value={formatDimensions(previewAsset)} />
                  <InfoItem label="文件大小" value={formatFileSize(previewAsset.file_size)} />
                  <InfoItem label="来源系统" value={previewAsset.source_system} />
                  <InfoItem label="来源类型" value={sourceKindLabel(previewAsset.source_kind)} />
                  <InfoItem label="素材类型" value={previewAsset.asset_type} />
                  <InfoItem label="图片类型" value={previewAsset.picture_type} />
                  <InfoItem label="SPU" value={previewAsset.spu_code} />
                  <InfoItem label="SKC" value={previewAsset.skc_code} />
                  <InfoItem label="归属类型" value={previewAsset.owner_type} />
                  <InfoItem label="归属编码" value={previewAsset.owner_code} />
                  <InfoItem label="商详页" value={previewAsset.detail_page_index} />
                  <InfoItem label="模块" value={previewAsset.module_name} />
                  <InfoItem label="模块序号" value={previewAsset.module_index} />
                  <InfoItem label="排序" value={previewAsset.sort_no} />
                  <InfoItem label="水印" value={detailedAsset.with_watermark == null ? null : detailedAsset.with_watermark ? "有" : "无"} />
                  <InfoItem label="深绘图片 ID" value={detailedAsset.deepdraw_image_id} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-semibold leading-6">关联内容包</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoItem label="标题" value={previewAsset.content_title} />
                  <InfoItem label="品牌" value={previewAsset.content_brand_name} />
                  <InfoItem label="类目" value={previewAsset.content_category_name} />
                  <InfoItem label="行业路径" value={detailedAsset.content_trade_path} />
                  <InfoItem label="内容包同步" value={formatDateTime(detailedAsset.content_synced_at)} />
                  <InfoItem label="素材创建" value={formatDateTime(detailedAsset.created_at)} />
                </div>
              </section>

              {detailLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
              ) : null}

              {detail?.sibling_assets.length ? (
                <section className="space-y-3">
                  <h3 className="text-base font-semibold leading-6">
                    同款素材 <span className="text-sm font-normal text-muted-foreground">{formatNumber(detail.sibling_assets.length)}</span>
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {detail.sibling_assets.slice(0, 12).map((item) => (
                      <SiblingImageButton key={item.id} asset={item} onSelect={onSelectAsset} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ImageCard({
  asset,
  onOpen,
}: {
  asset: ImageAssetItem
  onOpen: (asset: ImageAssetItem) => void
}) {
  const title = assetTitle(asset)

  return (
    <button
      type="button"
      onClick={() => onOpen(asset)}
      className="group overflow-hidden rounded-2xl border bg-card text-left shadow-[0_2px_4px_rgba(0,0,0,0.03)] transition hover:border-[var(--brand-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/35"
    >
      <div className="flex aspect-[4/3] min-h-[180px] items-center justify-center bg-muted/40">
        <img
          src={asset.normalized_url}
          alt={title}
          className="h-full w-full object-contain p-2 transition duration-200 group-hover:scale-[1.02]"
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
          <Maximize2 className="size-3.5 opacity-0 transition group-hover:opacity-100" />
        </div>
      </div>
    </button>
  )
}

export default function ImageLibraryPage() {
  const [searchText, setSearchText] = useState("")
  const [sourceKind, setSourceKind] = useState("all")
  const [pagination, setPagination] = useState({ limit: 24, offset: 0 })
  const [selectedAsset, setSelectedAsset] = useState<ImageAssetItem | null>(null)
  const debouncedSearch = useDebounce(searchText, 300)
  const { data, isLoading } = useImageAssets(debouncedSearch, sourceKind, pagination)
  const { data: summary } = useImageAssetSummary()
  const selectedDetailQuery = useImageAssetDetail(selectedAsset?.id ?? null)
  const selectedDetail =
    selectedDetailQuery.data?.asset.id === selectedAsset?.id ? selectedDetailQuery.data : undefined

  return (
    <CompactListPage>
      <CompactListHeader
        title="图片素材库"
        summary={`素材 ${formatNumber(summary?.asset_count)} / 商品图 ${formatNumber(summary?.picture_count)} / 商详图 ${formatNumber(summary?.detail_count)}`}
        description="以深绘同步的图片为准，全量展示商品图、商详截图与模块图片，并按 SPU、SKC、素材类型钻取。"
      />

      <CompactListCard>
        <CompactListCardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>素材列表</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              素材 {formatNumber(summary?.asset_count)} / 去重 URL {formatNumber(summary?.unique_url_count)} / 商品图 {formatNumber(summary?.picture_count)} / 商详图 {formatNumber(summary?.detail_count)} / 关联 SPU {formatNumber(summary?.spu_count)}
            </p>
          </div>
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
        </CompactListCardHeader>
        <CompactListCardContent>
          {isLoading ? (
            <div className="grid min-h-0 flex-1 auto-rows-max gap-4 overflow-auto pb-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="rounded-2xl border p-3">
                  <Skeleton className="aspect-[4/3] min-h-[180px] rounded-xl" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : data?.items.length ? (
            <div className="grid min-h-0 flex-1 auto-rows-max gap-4 overflow-auto pb-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {data.items.map((asset) => (
                <ImageCard key={asset.id} asset={asset} onOpen={setSelectedAsset} />
              ))}
            </div>
          ) : (
            <EmptyState message="暂无图片素材" icon={ImageIcon} />
          )}

          <div className="flex shrink-0 items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>当前展示 {formatNumber(data?.items.length ?? 0)} 张</span>
            <span>
              共 {formatNumber(data?.pagination.total)} 张；最近同步 {formatDateTime(summary?.latest_synced_at)}
            </span>
          </div>
          <ServerPagination
            compact
            className="shrink-0 bg-card px-0"
            pagination={data?.pagination}
            onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
            pageSizeOptions={[12, 24, 48, 96]}
          />
        </CompactListCardContent>
      </CompactListCard>

      <ImageAssetPreviewDialog
        open={selectedAsset != null}
        onOpenChange={(open) => {
          if (!open) setSelectedAsset(null)
        }}
        asset={selectedAsset}
        detail={selectedDetail}
        detailLoading={selectedDetailQuery.isFetching && !selectedDetail}
        onSelectAsset={setSelectedAsset}
      />
    </CompactListPage>
  )
}
