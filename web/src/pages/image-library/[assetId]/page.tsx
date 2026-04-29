import { Link, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  ExternalLink,
  FileImage,
  Images,
  Layers3,
  Ruler,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { JsonViewer } from "@/components/json-viewer"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ImageAsset {
  id: number
  source_system: string
  source_kind: string
  content_package_id: number | null
  content_skc_id: number | null
  detail_page_id: number | null
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
  source_url: string
  normalized_url: string
  file_name: string | null
  deepdraw_image_id: string | null
  width: number | null
  height: number | null
  file_size: number | null
  sort_no: number | null
  with_watermark: number | null
  status: string
  platform_url: string | null
  raw_payload_json: string
  synced_at: string | null
  created_at: string
  updated_at: string
  content_title: string | null
  content_brand_name: string | null
  content_category_name: string | null
  content_trade_path: string | null
  content_synced_at: string | null
}

interface ImageAssetDetail {
  asset: ImageAsset
  sibling_assets: ImageAsset[]
}

function useImageAsset(assetId: string | undefined) {
  return useQuery<ImageAssetDetail>({
    queryKey: ["image-library", assetId],
    queryFn: () => api.get(`/image-library/${encodeURIComponent(assetId!)}`),
    enabled: !!assetId,
  })
}

function parseJson(value: string | null | undefined) {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
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

function formatDimensions(asset: Pick<ImageAsset, "width" | "height">) {
  if (!asset.width || !asset.height) return "—"
  return `${asset.width} × ${asset.height}`
}

function formatFileSize(value: number | null | undefined) {
  if (value == null) return "—"
  if (value < 1024) return `${value}B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`
  return `${(value / 1024 / 1024).toFixed(1)}MB`
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="rounded-2xl border bg-background px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.6px] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 min-h-5 break-all text-sm font-medium leading-5">
        {value ?? "—"}
      </div>
    </div>
  )
}

function SiblingImage({ asset }: { asset: ImageAsset }) {
  return (
    <Link
      to={`/image-library/${asset.id}`}
      className="group overflow-hidden rounded-2xl border bg-card transition hover:border-[var(--brand-deep)]"
    >
      <div className="aspect-square bg-muted">
        <img
          src={asset.normalized_url}
          alt={asset.file_name ?? asset.asset_type ?? "同款图片素材"}
          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="p-2 text-xs">
        <div className="truncate font-medium">{sourceKindLabel(asset.source_kind)}</div>
        <div className="truncate text-muted-foreground">
          {asset.skc_code ?? asset.module_name ?? asset.asset_type ?? `#${asset.id}`}
        </div>
      </div>
    </Link>
  )
}

export default function ImageLibraryDetailPage() {
  const { assetId } = useParams()
  const { data, isLoading } = useImageAsset(assetId)

  if (isLoading) {
    return (
      <PageContainer className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[520px] w-full" />
      </PageContainer>
    )
  }

  if (!data) {
    return (
      <PageContainer className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link to="/image-library">
            <ArrowLeft className="size-4" />
            返回
          </Link>
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            图片素材不存在
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  const { asset } = data
  const title = asset.file_name ?? asset.content_title ?? asset.spu_code ?? `素材 #${asset.id}`

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader title={`素材 #${asset.id}`} description={title} compact>
        <Badge variant="outline">{sourceKindLabel(asset.source_kind)}</Badge>
        <Badge variant="outline">{asset.status}</Badge>
      </PageHeader>

      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/image-library">
          <ArrowLeft className="size-4" />
          图片素材库
        </Link>
      </Button>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="尺寸" value={formatDimensions(asset)} icon={Ruler} />
        <StatCard title="文件大小" value={formatFileSize(asset.file_size)} icon={FileImage} />
        <StatCard title="同款素材" value={formatNumber(data.sibling_assets.length)} icon={Images} />
        <StatCard title="同步时间" value={formatDateTime(asset.synced_at)} icon={Layers3} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,520px)_1fr]">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="overflow-hidden rounded-2xl border bg-muted">
              <img
                src={asset.normalized_url}
                alt={title}
                className="max-h-[720px] w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={asset.normalized_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  打开原图
                </a>
              </Button>
              {asset.platform_url ? (
                <Button asChild variant="outline">
                  <a href={asset.platform_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    平台图片
                  </a>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="metadata" className="min-w-0">
          <TabsList>
            <TabsTrigger value="metadata">元数据</TabsTrigger>
            <TabsTrigger value="siblings">同款素材</TabsTrigger>
            <TabsTrigger value="raw">原始数据</TabsTrigger>
          </TabsList>

          <TabsContent value="metadata" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>素材信息</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <InfoItem label="来源系统" value={asset.source_system} />
                <InfoItem label="来源类型" value={sourceKindLabel(asset.source_kind)} />
                <InfoItem label="素材类型" value={asset.asset_type} />
                <InfoItem label="图片类型" value={asset.picture_type} />
                <InfoItem label="SPU" value={asset.spu_code} />
                <InfoItem label="SKC" value={asset.skc_code} />
                <InfoItem label="归属类型" value={asset.owner_type} />
                <InfoItem label="归属编码" value={asset.owner_code} />
                <InfoItem label="位置" value={asset.place} />
                <InfoItem label="商详页" value={asset.detail_page_index} />
                <InfoItem label="模块" value={asset.module_name} />
                <InfoItem label="模块序号" value={asset.module_index} />
                <InfoItem label="排序" value={asset.sort_no} />
                <InfoItem label="水印" value={asset.with_watermark == null ? null : asset.with_watermark ? "有" : "无"} />
                <InfoItem label="深绘图片 ID" value={asset.deepdraw_image_id} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>关联内容包</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <InfoItem label="标题" value={asset.content_title} />
                <InfoItem label="品牌" value={asset.content_brand_name} />
                <InfoItem label="类目" value={asset.content_category_name} />
                <InfoItem label="行业路径" value={asset.content_trade_path} />
                <InfoItem label="内容包同步" value={formatDateTime(asset.content_synced_at)} />
                <InfoItem label="素材创建" value={formatDateTime(asset.created_at)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>图片地址</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <InfoItem label="标准化 URL" value={asset.normalized_url} />
                <InfoItem label="源 URL" value={asset.source_url} />
                <InfoItem label="平台 URL" value={asset.platform_url} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="siblings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>同款素材</CardTitle>
              </CardHeader>
              <CardContent>
                {data.sibling_assets.length ? (
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
                    {data.sibling_assets.map((item) => (
                      <SiblingImage key={item.id} asset={item} />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-36 items-center justify-center rounded-2xl border bg-muted/40 text-sm text-muted-foreground">
                    暂无同款素材
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="mt-4">
            <JsonViewer data={parseJson(asset.raw_payload_json)} label="Asset Raw Payload" defaultOpen />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
