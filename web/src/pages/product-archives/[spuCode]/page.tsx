import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Database,
  ExternalLink,
  FileImage,
  ImageIcon,
  Loader2,
  PackageSearch,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type SourceStatus = "SYNCED" | "MISSING"
type SyncSource = "mdm" | "deepdraw"
const CHANNEL_PRIORITY = ["TMALL", "TAOBAO"]

interface MdmSpu {
  id: number
  spu_code: string
  spu_name: string | null
  spu_name_en: string | null
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
  brand_code: string | null
  brand_name: string | null
  year: string | null
  season_name: string | null
  product_line_name: string | null
  middle_class_name: string | null
  subclass_name: string | null
  gender_name: string | null
  age_group_name: string | null
  fabric_type_name: string | null
  composition: string | null
  price_tag: number | null
  status_name: string | null
  enable_status: string | null
  approve_status: string | null
  synced_at: string | null
}

interface DeepdrawPackage {
  id: number
  spu_code: string
  title: string | null
  brand_name: string | null
  category_name: string | null
  trade_path: string | null
  retail_price: number | null
  primary_color: string | null
  version: number | null
  complete: number
  synced_at: string | null
}

interface MdmSkc {
  id: number
  skc_code: string
  skc_name: string | null
  color_code: string | null
  color_name: string | null
  sku_count: number
  pic_url: string | null
  status_name: string | null
}

interface MdmSku {
  id: number
  skc_code: string
  sku_code: string
  sku_name: string | null
  size_code: string | null
  size_name: string | null
  shein_size_name: string | null
  ean_code: string | null
  inner_code: string | null
  supplier_product_code: string | null
  price_tag: number | null
  supply_price_cny: number | null
  suggested_retail_price_usd: number | null
  gross_weight_g: number | null
  supply_discount: number | null
  package_size_text: string | null
  status_name: string | null
}

interface ContentSkc {
  id: number
  skc_code: string
  color_name: string | null
  color_alias: string | null
  sku_count: number
}

interface ContentField {
  id: number
  field_name: string
  value_text: string | null
  is_key: number
}

interface DetailPage {
  id: number
  page_index: number
  template_name: string | null
  template_width: number | null
  html_page_url: string | null
  image_page_url: string | null
  mixed_page_url: string | null
  screenshot_count: number
  module_count: number
}

interface SizeTable {
  id: number
  table_index: number
  field_name: string | null
  row_count: number
  options_json: string | null
}

interface SizeTableRow {
  id: number
  table_index: number
  row_index: number
  size_name: string | null
  values_json: string | null
}

interface ProductAsset {
  id: number
  source_kind: string
  asset_type: string | null
  place: string | null
  picture_type: string | null
  skc_code: string | null
  detail_page_index: number | null
  module_name: string | null
  module_index: number | null
  normalized_url: string
  file_name: string | null
  width: number | null
  height: number | null
  sort_no: number | null
}

interface ProductArchiveDetail {
  spu_code: string
  spu: MdmSpu | null
  content_package: DeepdrawPackage | null
  skcs: MdmSkc[]
  skus: MdmSku[]
  content_skcs: ContentSkc[]
  content_skus: unknown[]
  key_fields: ContentField[]
  detail_pages: DetailPage[]
  size_tables?: SizeTable[]
  size_table_rows?: SizeTableRow[]
  product_images: ProductAsset[]
  detail_images: ProductAsset[]
  source_status: {
    mdm: SourceStatus
    deepdraw: SourceStatus
  }
}

interface SkcImageMeta {
  skcCode: string
  mdmColorName: string | null
  mdmColorCode: string | null
  deepdrawColorName: string | null
  deepdrawColorAlias: string | null
}

interface SyncJob {
  id: string
  source: SyncSource
  status: "queued" | "running" | "completed"
  total_count: number
  completed_count: number
  failed_count: number
}

interface BrandMapping {
  brandCode: string
  brandName: string
  aliases: string[]
  deepdrawTenantName: string | null
}

interface ProductArchiveConfig {
  brands: BrandMapping[]
}

function useProductArchive(spuCode: string | undefined) {
  return useQuery<ProductArchiveDetail>({
    queryKey: ["product-archives", spuCode],
    queryFn: () => api.get(`/product-archives/${encodeURIComponent(spuCode!)}`),
    enabled: !!spuCode,
  })
}

function useProductArchiveConfig() {
  return useQuery<ProductArchiveConfig>({
    queryKey: ["product-archives", "config"],
    queryFn: () => api.get("/product-archives/config"),
  })
}

function SourceBadge({
  label,
  status,
}: {
  label: string
  status: SourceStatus
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
      <div className="mt-1 min-h-5 text-sm font-medium leading-5">
        {value ?? "—"}
      </div>
    </div>
  )
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
  } catch {
    return []
  }
}

function parseJsonRecord(value: string | null | undefined): Record<string, string> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).map(([key, item]) => [key, item == null ? "" : String(item)]),
    )
  } catch {
    return {}
  }
}

function formatWeight(value: number | null | undefined) {
  if (value == null) return "—"
  return `${formatNumber(value)}g`
}

function formatDiscount(value: number | null | undefined) {
  return value == null ? "—" : formatPercent(value)
}

function channelRank(place: string | null | undefined) {
  const index = CHANNEL_PRIORITY.indexOf(String(place ?? "").toUpperCase())
  return index === -1 ? CHANNEL_PRIORITY.length : index
}

function selectPreferredChannelImages(images: ProductAsset[]) {
  const preferred = images.filter((asset) => channelRank(asset.place) < CHANNEL_PRIORITY.length)
  const pool = preferred.length ? preferred : images
  const grouped = new Map<string, ProductAsset[]>()
  for (const asset of pool) {
    const key = asset.skc_code ?? asset.asset_type ?? "SPU"
    const group = grouped.get(key) ?? []
    group.push(asset)
    grouped.set(key, group)
  }

  return Array.from(grouped.values()).flatMap((group) => {
    const sorted = [...group].sort((a, b) => {
      const placeOrder = channelRank(a.place) - channelRank(b.place)
      if (placeOrder !== 0) return placeOrder
      return (a.sort_no ?? 999999) - (b.sort_no ?? 999999)
    })
    const selectedPlace = sorted[0]?.place
    return sorted.filter((asset) => asset.place === selectedPlace)
  })
}

function selectOneImagePerSkc(images: ProductAsset[]) {
  const grouped = new Map<string, ProductAsset[]>()
  for (const asset of images) {
    if (!asset.skc_code) continue
    const group = grouped.get(asset.skc_code) ?? []
    group.push(asset)
    grouped.set(asset.skc_code, group)
  }

  return Array.from(grouped.values()).map((group) => (
    [...group].sort((a, b) => {
      const placeOrder = channelRank(a.place) - channelRank(b.place)
      if (placeOrder !== 0) return placeOrder
      return (a.sort_no ?? 999999) - (b.sort_no ?? 999999)
    })[0]
  ))
}

function colorDisplayName(skcMeta?: SkcImageMeta) {
  return skcMeta?.mdmColorName ?? skcMeta?.deepdrawColorName ?? skcMeta?.deepdrawColorAlias ?? "—"
}

function ProductImageStrip({
  title,
  images,
  empty,
  skcMetaByCode,
  showColorMeta,
}: {
  title: string
  images: ProductAsset[]
  empty: string
  skcMetaByCode?: Map<string, SkcImageMeta>
  showColorMeta: boolean
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{formatNumber(images.length)} 张</span>
      </div>
      {images.length ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((asset) => (
            <ProductImageCard
              key={asset.id}
              asset={asset}
              title={title}
              skcMeta={asset.skc_code ? skcMetaByCode?.get(asset.skc_code) : undefined}
              showColorMeta={showColorMeta}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-2xl border bg-muted/40 text-sm text-muted-foreground">
          {empty}
        </div>
      )}
    </section>
  )
}

function ProductImageCard({
  asset,
  title,
  skcMeta,
  showColorMeta,
}: {
  asset: ProductAsset
  title: string
  skcMeta?: SkcImageMeta
  showColorMeta: boolean
}) {
  const mdmColorName = skcMeta?.mdmColorName
  const caption = (() => {
    if (!showColorMeta) return null
    return (
      <div className="space-y-1 p-2.5 text-xs">
        <div className="truncate font-medium">
          {asset.skc_code ?? skcMeta?.skcCode ?? "款色图"}
        </div>
        <div className="truncate text-muted-foreground">
          {mdmColorName ?? colorDisplayName(skcMeta)}
        </div>
      </div>
    )
  })()

  return (
    <a
      href={asset.normalized_url}
      target="_blank"
      rel="noreferrer"
      className="group w-[184px] shrink-0 overflow-hidden rounded-2xl border bg-background transition hover:border-[var(--brand-deep)]"
    >
      <div className="aspect-square bg-muted">
        <img
          src={asset.normalized_url}
          alt={asset.file_name ?? asset.asset_type ?? title}
          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      {caption}
    </a>
  )
}

function DetailPageImageFlow({
  pages,
  detailImagesByPage,
}: {
  pages: DetailPage[]
  detailImagesByPage: Map<number, ProductAsset[]>
}) {
  const pageIndexes = pages.length
    ? pages.map((page) => page.page_index)
    : Array.from(detailImagesByPage.keys()).sort((a, b) => a - b)

  if (!pageIndexes.length) {
    return (
      <div className="flex h-36 items-center justify-center rounded-2xl border bg-muted/40 text-sm text-muted-foreground">
        暂无商详页图片
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {pageIndexes.map((pageIndex) => (
        <section key={pageIndex} className="space-y-3">
          <div className="flex items-center justify-between gap-3 border-b pb-2">
            <h3 className="text-sm font-semibold">商详页 {pageIndex}</h3>
            <span className="text-xs text-muted-foreground">
              {formatNumber(detailImagesByPage.get(pageIndex)?.length ?? 0)} 张
            </span>
          </div>
          <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3">
            {(detailImagesByPage.get(pageIndex) ?? []).map((asset) => (
              <figure key={asset.id} className="overflow-hidden rounded-2xl border bg-background">
                <a href={asset.normalized_url} target="_blank" rel="noreferrer">
                  <img
                    src={asset.normalized_url}
                    alt={asset.module_name ?? `商详页 ${pageIndex}`}
                    className="w-full object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </a>
                <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    {asset.source_kind === "DETAIL_SCREENSHOT" ? "页面截图" : (asset.module_name ?? "模块图片")}
                    {asset.module_index ? ` #${asset.module_index}` : ""}
                  </span>
                  <a
                    href={asset.normalized_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[var(--brand-deep)]"
                  >
                    <ExternalLink className="size-3.5" />
                    原图
                  </a>
                </figcaption>
              </figure>
            ))}
            {!(detailImagesByPage.get(pageIndex)?.length) ? (
              <div className="flex h-24 items-center justify-center rounded-2xl border bg-muted/40 text-sm text-muted-foreground">
                当前商详页暂无图片
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  )
}

function HeroImage({
  image,
  title,
}: {
  image: ProductAsset | undefined
  title: string
}) {
  if (!image) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
        <ImageIcon className="size-10" />
      </div>
    )
  }
  return (
    <img
      src={image.normalized_url}
      alt={title}
      className="aspect-square w-full rounded-2xl border object-cover"
      referrerPolicy="no-referrer"
    />
  )
}

export default function ProductArchiveDetailPage() {
  const { spuCode } = useParams()
  const [syncJobId, setSyncJobId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { data, isLoading } = useProductArchive(spuCode)
  const { data: config } = useProductArchiveConfig()
  const { data: syncJob } = useQuery<SyncJob>({
    queryKey: ["product-archive-sync-job", syncJobId],
    queryFn: () => api.get(`/product-archives/sync-jobs/${syncJobId}`),
    enabled: Boolean(syncJobId),
    refetchInterval: (query) => {
      const job = query.state.data
      return job && job.status !== "completed" ? 1500 : false
    },
    refetchOnWindowFocus: false,
  })

  const syncMutation = useMutation({
    mutationFn: async (source: SyncSource) =>
      api.post<SyncJob>("/product-archives/sync-jobs", {
        source,
        codes: [spuCode],
        deepdrawTenantName: source === "deepdraw"
          ? config?.brands.find((brand) => (
            brand.brandCode === data?.spu?.brand_code
            || brand.brandName === data?.spu?.brand_name
            || brand.brandName === data?.content_package?.brand_name
          ))?.deepdrawTenantName
          : undefined,
      }),
    onSuccess: async (result) => {
      setSyncJobId(result.id)
      await queryClient.invalidateQueries({ queryKey: ["product-archives"] })
      toast.success(`${data?.spu_code ?? spuCode} ${result.source.toUpperCase()} 已加入同步队列`)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "同步失败")
    },
  })

  useEffect(() => {
    if (syncJob?.status !== "completed") return
    void queryClient.invalidateQueries({ queryKey: ["product-archives"] })
  }, [queryClient, syncJob?.status])

  if (isLoading) {
    return (
      <PageContainer className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-[520px] w-full" />
      </PageContainer>
    )
  }

  if (!data || !spuCode) {
    return (
      <PageContainer className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link to="/product-archives">
            <ArrowLeft className="size-4" />
            返回
          </Link>
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            商品档案不存在
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  const title =
    data.spu?.listing_title_cn
    ?? data.spu?.spu_name
    ?? data.content_package?.title
    ?? data.spu_code
  const skcMetaByCode = new Map<string, SkcImageMeta>()
  for (const skc of data.skcs) {
    skcMetaByCode.set(skc.skc_code, {
      skcCode: skc.skc_code,
      mdmColorName: skc.color_name,
      mdmColorCode: skc.color_code,
      deepdrawColorName: null,
      deepdrawColorAlias: null,
    })
  }
  for (const item of data.content_skcs) {
    const existing = skcMetaByCode.get(item.skc_code)
    skcMetaByCode.set(item.skc_code, {
      skcCode: item.skc_code,
      mdmColorName: existing?.mdmColorName ?? null,
      mdmColorCode: existing?.mdmColorCode ?? null,
      deepdrawColorName: item.color_name,
      deepdrawColorAlias: item.color_alias,
    })
  }
  const displaySkcs = data.skcs.length
    ? data.skcs.map((skc) => ({
      id: `mdm-${skc.id}`,
      skc_code: skc.skc_code,
      color_name: skc.color_name,
      color_code: skc.color_code,
      skc_name: skc.skc_name,
      sku_count: skc.sku_count,
      status_name: skc.status_name,
      source: "MDM",
    }))
    : data.content_skcs.map((skc) => ({
      id: `deepdraw-${skc.id}`,
      skc_code: skc.skc_code,
      color_name: skc.color_name,
      color_code: null,
      skc_name: skc.color_alias,
      sku_count: skc.sku_count,
      status_name: "深绘",
      source: "深绘",
    }))
  const mainProductImages = data.product_images.filter((asset) => asset.asset_type === "MAIN")
  const colorProductImages = data.product_images.filter((asset) => asset.asset_type === "COLOR_BLOCK")
  const colorTransparencyImages = mainProductImages.filter((asset) => (
    asset.picture_type === "TRANSPARENCY"
  ))
  const selectedMainProductImages = selectPreferredChannelImages(
    mainProductImages.filter((asset) => asset.picture_type !== "TRANSPARENCY"),
  )
  const fallbackColorProductImages = selectOneImagePerSkc(selectPreferredChannelImages(colorProductImages))
  const selectedColorProductImages = [
    ...selectOneImagePerSkc(colorTransparencyImages),
    ...fallbackColorProductImages.filter((asset) => (
      !asset.skc_code
      || !colorTransparencyImages.some((image) => image.skc_code === asset.skc_code)
    )),
  ]
  const heroImage = selectedMainProductImages[0] ?? selectedColorProductImages[0]
  const detailImagesByPage = new Map<number, ProductAsset[]>()
  for (const asset of data.detail_images) {
    const pageIndex = asset.detail_page_index ?? 0
    const images = detailImagesByPage.get(pageIndex) ?? []
    images.push(asset)
    detailImagesByPage.set(pageIndex, images)
  }
  for (const images of detailImagesByPage.values()) {
    images.sort((a, b) => {
      const sourceOrder =
        (a.source_kind === "DETAIL_SCREENSHOT" ? 0 : 1)
        - (b.source_kind === "DETAIL_SCREENSHOT" ? 0 : 1)
      if (sourceOrder !== 0) return sourceOrder
      const moduleNameOrder = (a.module_name ?? "").localeCompare(b.module_name ?? "")
      if (moduleNameOrder !== 0) return moduleNameOrder
      return (a.module_index ?? a.sort_no ?? 999999) - (b.module_index ?? b.sort_no ?? 999999)
    })
  }
  const sizeTables = Array.isArray(data.size_tables) ? data.size_tables : []
  const sizeTableRows = Array.isArray(data.size_table_rows) ? data.size_table_rows : []
  const sizeTableRowsByIndex = new Map<number, SizeTableRow[]>()
  for (const row of sizeTableRows) {
    const rows = sizeTableRowsByIndex.get(row.table_index) ?? []
    rows.push(row)
    sizeTableRowsByIndex.set(row.table_index, rows)
  }
  const syncingMdm = syncMutation.isPending && syncMutation.variables === "mdm"
  const syncingDeepdraw =
    syncMutation.isPending && syncMutation.variables === "deepdraw"
  const syncInFlight = syncJob ? ["queued", "running"].includes(syncJob.status) : false
  const activeSyncSource = syncInFlight
    ? syncJob?.source
    : syncMutation.isPending
      ? syncMutation.variables
      : null

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader title={data.spu_code} description={title} compact>
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge label="MDM " status={data.source_status.mdm} />
          <SourceBadge label="深绘 " status={data.source_status.deepdraw} />
        </div>
      </PageHeader>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link to="/product-archives">
              <ArrowLeft className="size-4" />
              商品档案
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => syncMutation.mutate("mdm")}
            disabled={syncMutation.isPending || syncInFlight}
          >
            {syncingMdm || activeSyncSource === "mdm" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            同步 MDM
          </Button>
          <Button
            type="button"
            onClick={() => syncMutation.mutate("deepdraw")}
            disabled={syncMutation.isPending || syncInFlight}
          >
            {syncingDeepdraw || activeSyncSource === "deepdraw" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            同步深绘
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="MDM 款色"
          value={formatNumber(data.skcs.length)}
          icon={Database}
          description={`${formatNumber(data.skus.length)} 个 SKU`}
        />
        <StatCard
          title="深绘款色"
          value={formatNumber(data.content_skcs.length)}
          icon={PackageSearch}
          description={`${formatNumber(data.content_skus.length)} 个 SKU`}
        />
        <StatCard
          title="商品图片"
          value={formatNumber(selectedMainProductImages.length + selectedColorProductImages.length)}
          icon={ImageIcon}
          description={`${formatNumber(selectedMainProductImages.length)} 主图 / ${formatNumber(selectedColorProductImages.length)} 款色图`}
        />
        <StatCard
          title="商详图片"
          value={formatNumber(data.detail_images.length)}
          icon={FileImage}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="space-y-3 p-4">
            <HeroImage image={heroImage} title={title} />
            <div>
              <div className="font-medium leading-5">{title}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {data.spu?.brand_name ?? data.content_package?.brand_name ?? "—"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="min-w-0">
          <TabsList>
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="images">商品图片</TabsTrigger>
            <TabsTrigger value="detail-images">商详图片</TabsTrigger>
            <TabsTrigger value="size-tables">尺码表</TabsTrigger>
            <TabsTrigger value="skus">款色/SKU</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>发品资料</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <InfoItem label="SHEIN SPU" value={data.spu?.shein_spu_code} />
                <InfoItem label="SHEIN 分类" value={data.spu?.shein_category_name} />
                <InfoItem label="规则匹配类目" value={data.spu?.matched_shein_category_name} />
                <InfoItem label="映射规则来源" value={data.spu?.matched_category_rule_source} />
                <InfoItem label="AI 建议类目" value={data.spu?.suggested_shein_category_name} />
                <InfoItem label="老款号" value={data.spu?.old_style_code} />
                <InfoItem label="深绘已有信息" value={data.spu?.deepdraw_info_status} />
                <InfoItem label="中文标题" value={data.spu?.listing_title_cn ?? data.content_package?.title} />
                <InfoItem label="英文标题" value={data.spu?.listing_title_en} />
                <InfoItem label="深绘类目" value={data.content_package?.category_name} />
                <InfoItem label="尺码表" value={sizeTables.length ? `${sizeTables.length} 张` : null} />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                <CardTitle>MDM 主数据</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <InfoItem label="款名" value={data.spu?.spu_name} />
                  <InfoItem label="英文款名" value={data.spu?.spu_name_en} />
                  <InfoItem label="品牌" value={data.spu?.brand_name} />
                  <InfoItem label="品牌编码" value={data.spu?.brand_code} />
                  <InfoItem label="年份季节" value={[data.spu?.year, data.spu?.season_name].filter(Boolean).join(" / ")} />
                  <InfoItem label="产品线" value={data.spu?.product_line_name} />
                  <InfoItem label="中类/小类" value={[data.spu?.middle_class_name, data.spu?.subclass_name].filter(Boolean).join(" / ")} />
                  <InfoItem label="性别/年龄段" value={[data.spu?.gender_name, data.spu?.age_group_name].filter(Boolean).join(" / ")} />
                  <InfoItem label="面种/成分" value={[data.spu?.fabric_type_name, data.spu?.composition].filter(Boolean).join(" / ")} />
                  <InfoItem label="挂牌价" value={formatCurrency(data.spu?.price_tag)} />
                  <InfoItem label="状态" value={data.spu?.status_name} />
                  <InfoItem label="审批" value={data.spu?.approve_status} />
                  <InfoItem label="同步时间" value={formatDateTime(data.spu?.synced_at)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                <CardTitle>深绘内容包</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <InfoItem label="标题" value={data.content_package?.title} />
                  <InfoItem label="品牌" value={data.content_package?.brand_name} />
                  <InfoItem label="类目" value={data.content_package?.category_name} />
                  <InfoItem label="行业路径" value={data.content_package?.trade_path} />
                  <InfoItem label="零售价" value={formatCurrency(data.content_package?.retail_price)} />
                  <InfoItem label="主颜色" value={data.content_package?.primary_color} />
                  <InfoItem label="版本" value={data.content_package?.version} />
                  <InfoItem
                    label="完整状态"
                    value={data.content_package ? (data.content_package.complete ? "完整" : "未完整") : "—"}
                  />
                  <InfoItem
                    label="同步时间"
                    value={formatDateTime(data.content_package?.synced_at)}
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>深绘关键字段</CardTitle>
              </CardHeader>
              <CardContent>
                {data.key_fields.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {data.key_fields.slice(0, 18).map((field) => (
                      <InfoItem
                        key={field.id}
                        label={field.field_name}
                        value={field.value_text}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无字段</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="images" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>商品主图与款色图</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <ProductImageStrip
                  title="商品主图"
                  images={selectedMainProductImages}
                  empty="暂无 TMALL/TAOBAO 商品主图"
                  skcMetaByCode={skcMetaByCode}
                  showColorMeta={false}
                />
                <ProductImageStrip
                  title="款色图"
                  images={selectedColorProductImages}
                  empty="暂无 TMALL/TAOBAO 款色图"
                  skcMetaByCode={skcMetaByCode}
                  showColorMeta={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detail-images" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>商详页</CardTitle>
              </CardHeader>
              <CardContent>
                {data.detail_pages.length ? (
                  <div className="overflow-hidden rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>页码</TableHead>
                          <TableHead>模板</TableHead>
                          <TableHead>宽度</TableHead>
                          <TableHead>截图/模块</TableHead>
                          <TableHead>链接</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.detail_pages.map((page) => (
                          <TableRow key={page.id}>
                            <TableCell>{page.page_index}</TableCell>
                            <TableCell>{page.template_name ?? "—"}</TableCell>
                            <TableCell>{page.template_width ?? "—"}</TableCell>
                            <TableCell>
                              {page.screenshot_count} / {page.module_count}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {page.html_page_url ? (
                                  <Button asChild variant="ghost" size="sm">
                                    <a href={page.html_page_url} target="_blank" rel="noreferrer">
                                      HTML
                                    </a>
                                  </Button>
                                ) : null}
                                {page.image_page_url ? (
                                  <Button asChild variant="ghost" size="sm">
                                    <a href={page.image_page_url} target="_blank" rel="noreferrer">
                                      图片页
                                    </a>
                                  </Button>
                                ) : null}
                                {page.mixed_page_url ? (
                                  <Button asChild variant="ghost" size="sm">
                                    <a href={page.mixed_page_url} target="_blank" rel="noreferrer">
                                      混合页
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无商详页</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>商详页图片顺序</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailPageImageFlow
                  pages={data.detail_pages}
                  detailImagesByPage={detailImagesByPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="size-tables" className="mt-4 space-y-4">
            {sizeTables.length ? (
              sizeTables.map((table) => {
                const columns = parseJsonArray(table.options_json)
                const rows = sizeTableRowsByIndex.get(table.table_index) ?? []
                return (
                  <Card key={table.id}>
                    <CardHeader>
                      <CardTitle>{table.field_name ?? `尺码表 ${table.table_index + 1}`}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-hidden rounded-2xl border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>尺码</TableHead>
                              {columns.map((column) => (
                                <TableHead key={column}>{column}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.length ? (
                              rows.map((row) => {
                                const values = parseJsonRecord(row.values_json)
                                return (
                                  <TableRow key={row.id}>
                                    <TableCell className="font-medium">
                                      {row.size_name ?? "—"}
                                    </TableCell>
                                    {columns.map((column) => (
                                      <TableCell key={column}>
                                        {values[column] || "—"}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                )
                              })
                            ) : (
                              <TableRow>
                                <TableCell
                                  colSpan={Math.max(1, columns.length + 1)}
                                  className="h-24 text-center text-muted-foreground"
                                >
                                  暂无尺码表行
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  暂无深绘尺码表
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="skus" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{data.skcs.length ? "MDM 款色" : "深绘款色"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKC</TableHead>
                        <TableHead>颜色</TableHead>
                        <TableHead>名称</TableHead>
                        <TableHead>SKU 数</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displaySkcs.length ? (
                        displaySkcs.map((skc) => (
                          <TableRow key={skc.id}>
                            <TableCell className="font-medium">{skc.skc_code}</TableCell>
                            <TableCell>{skc.color_name ?? skc.color_code ?? "—"}</TableCell>
                            <TableCell>{skc.skc_name ?? "—"}</TableCell>
                            <TableCell>{skc.sku_count}</TableCell>
                            <TableCell>{skc.status_name ?? skc.source ?? "—"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            暂无款色
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{data.skcs.length ? "MDM SKU" : "深绘 SKU"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>SKC</TableHead>
                        <TableHead>尺码</TableHead>
                        <TableHead>条码/企业码</TableHead>
                        <TableHead>价格</TableHead>
                        <TableHead>包装</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.skus.length ? (
                        data.skus.map((sku) => (
                          <TableRow key={sku.id}>
                            <TableCell className="font-medium">{sku.sku_code}</TableCell>
                            <TableCell>{sku.skc_code}</TableCell>
                            <TableCell>{sku.shein_size_name ?? sku.size_name ?? sku.size_code ?? "—"}</TableCell>
                            <TableCell>
                              <div>{sku.ean_code ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">
                                {sku.inner_code ?? sku.supplier_product_code ?? "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{formatCurrency(sku.supply_price_cny ?? sku.price_tag)}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(sku.suggested_retail_price_usd, "USD")}
                                {sku.supply_discount != null ? ` / ${formatDiscount(sku.supply_discount)}` : ""}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{formatWeight(sku.gross_weight_g)}</div>
                              <div className="text-xs text-muted-foreground">
                                {sku.package_size_text ?? "—"}
                              </div>
                            </TableCell>
                            <TableCell>{sku.status_name ?? "—"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            暂无 MDM SKU
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
