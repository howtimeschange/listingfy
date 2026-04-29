import { Link, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Boxes,
  Database,
  ImageIcon,
  Layers3,
  Ruler,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from "@/lib/format"
import { JsonViewer } from "@/components/json-viewer"
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

interface MdmSpu {
  id: number
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
  season_code: string | null
  season_name: string | null
  product_chain_name: string | null
  product_line_name: string | null
  product_type_name: string | null
  middle_class_name: string | null
  subclass_name: string | null
  gender_name: string | null
  age_group_name: string | null
  article_prop_name: string | null
  batch_name: string | null
  main_size_group_name: string | null
  order_size_group_name: string | null
  spec_range: string | null
  price_tag: number | null
  unit_name: string | null
  fabric_type_name: string | null
  fabric: string | null
  composition: string | null
  lining_material: string | null
  wash_label_ingr: string | null
  status_name: string | null
  enable_status: string | null
  data_status: string | null
  approve_status: string | null
  pic_url: string | null
  designer: string | null
  version_number: string | null
  model_name: string | null
  length_name: string | null
  price_range_name: string | null
  product_positioning_name: string | null
  purchase_group_name: string | null
  purchase_pattern_name: string | null
  scene_name: string | null
  is_continue_name: string | null
  is_ip_name: string | null
  is_mental_products_name: string | null
  is_uni_size_name: string | null
  channel_level: string | null
  filler: string | null
  spu_group: string | null
  creation_date: string | null
  last_update_date: string | null
  synced_at: string | null
  raw_payload_json: string
}

interface MdmSkc {
  id: number
  skc_code: string
  skc_name: string | null
  skc_name_en: string | null
  color_code: string | null
  color_name: string | null
  price_tag: number | null
  status_name: string | null
  enable_status: string | null
  approve_status: string | null
  pic_url: string | null
  sku_count: number
  synced_at: string | null
}

interface MdmSku {
  id: number
  skc_code: string
  skc_color_name: string | null
  sku_code: string
  sku_name: string | null
  supplier_product_code: string | null
  inner_code: string | null
  ean_code: string | null
  size_code: string | null
  size_name: string | null
  shein_size_name: string | null
  color_code: string | null
  color_name: string | null
  price_tag: number | null
  supply_price_cny: number | null
  suggested_retail_price_usd: number | null
  gross_weight_g: number | null
  supply_discount: number | null
  package_size_text: string | null
  status_name: string | null
  enable_status: string | null
  approve_status: string | null
  pic_url: string | null
  synced_at: string | null
}

interface MdmProductDetail {
  spu_code: string
  spu: MdmSpu
  skcs: MdmSkc[]
  skus: MdmSku[]
}

function useMdmProduct(spuCode: string | undefined) {
  return useQuery<MdmProductDetail>({
    queryKey: ["mdm-products", spuCode],
    queryFn: () => api.get(`/mdm-products/${encodeURIComponent(spuCode!)}`),
    enabled: !!spuCode,
  })
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

function parseJson(value: string | null | undefined) {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function formatWeight(value: number | null | undefined) {
  if (value == null) return "—"
  return `${formatNumber(value)}g`
}

function formatDiscount(value: number | null | undefined) {
  return value == null ? "—" : formatPercent(value)
}

function HeroImage({
  src,
  title,
}: {
  src: string | null | undefined
  title: string
}) {
  if (!src) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
        <ImageIcon className="size-10" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={title}
      className="aspect-square w-full rounded-2xl border object-cover"
      referrerPolicy="no-referrer"
    />
  )
}

export default function MdmProductDetailPage() {
  const { spuCode } = useParams()
  const { data, isLoading } = useMdmProduct(spuCode)

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
          <Link to="/mdm-products">
            <ArrowLeft className="size-4" />
            返回
          </Link>
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            MDM 商品不存在
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  const title =
    data.spu.listing_title_cn
    ?? data.spu.spu_name
    ?? data.spu.listing_title_en
    ?? data.spu.spu_name_en
    ?? data.spu_code
  const heroImage = data.spu.pic_url ?? data.skcs.find((skc) => skc.pic_url)?.pic_url ?? data.skus.find((sku) => sku.pic_url)?.pic_url

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader title={data.spu_code} description={title} compact>
        <Badge variant="outline" className="border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]">
          {data.spu.status_name ?? data.spu.enable_status ?? "MDM"}
        </Badge>
        {data.spu.approve_status ? <Badge variant="outline">{data.spu.approve_status}</Badge> : null}
      </PageHeader>

      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/mdm-products">
          <ArrowLeft className="size-4" />
          MDM 商品主数据
        </Link>
      </Button>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="SKC" value={formatNumber(data.skcs.length)} icon={Layers3} />
        <StatCard title="SKU" value={formatNumber(data.skus.length)} icon={Boxes} />
        <StatCard
          title="尺码"
          value={formatNumber(new Set(data.skus.map((sku) => sku.size_name ?? sku.size_code).filter(Boolean)).size)}
          icon={Ruler}
        />
        <StatCard
          title="同步时间"
          value={formatDateTime(data.spu.synced_at)}
          icon={Database}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="space-y-3 p-4">
            <HeroImage src={heroImage} title={title} />
            <div>
              <div className="font-medium leading-5">{title}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {[data.spu.brand_code, data.spu.brand_name].filter(Boolean).join(" ") || "—"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="min-w-0">
          <TabsList>
            <TabsTrigger value="overview">SPU</TabsTrigger>
            <TabsTrigger value="skcs">SKC</TabsTrigger>
            <TabsTrigger value="skus">SKU</TabsTrigger>
            <TabsTrigger value="raw">原始数据</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>发品关键字段</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <InfoItem label="SHEIN SPU" value={data.spu.shein_spu_code} />
                <InfoItem label="SHEIN 分类" value={data.spu.shein_category_name} />
                <InfoItem label="老款号" value={data.spu.old_style_code} />
                <InfoItem label="深绘已有信息" value={data.spu.deepdraw_info_status} />
                <InfoItem label="中文标题" value={data.spu.listing_title_cn} />
                <InfoItem label="英文标题" value={data.spu.listing_title_en} />
                <InfoItem label="挂牌价" value={formatCurrency(data.spu.price_tag)} />
                <InfoItem label="版本" value={data.spu.version_number} />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>基础主数据</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <InfoItem label="款名" value={data.spu.spu_name} />
                  <InfoItem label="英文款名" value={data.spu.spu_name_en} />
                  <InfoItem label="品牌" value={data.spu.brand_name} />
                  <InfoItem label="品牌编码" value={data.spu.brand_code} />
                  <InfoItem label="年份季节" value={[data.spu.year, data.spu.season_name].filter(Boolean).join(" / ")} />
                  <InfoItem label="产品链" value={data.spu.product_chain_name} />
                  <InfoItem label="产品线" value={data.spu.product_line_name} />
                  <InfoItem label="产品类型" value={data.spu.product_type_name} />
                  <InfoItem label="中类/小类" value={[data.spu.middle_class_name, data.spu.subclass_name].filter(Boolean).join(" / ")} />
                  <InfoItem label="性别/年龄段" value={[data.spu.gender_name, data.spu.age_group_name].filter(Boolean).join(" / ")} />
                  <InfoItem label="品类属性" value={data.spu.article_prop_name} />
                  <InfoItem label="批次" value={data.spu.batch_name} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>规格与生产</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <InfoItem label="主尺码组" value={data.spu.main_size_group_name} />
                  <InfoItem label="订货尺码组" value={data.spu.order_size_group_name} />
                  <InfoItem label="规格范围" value={data.spu.spec_range} />
                  <InfoItem label="单位" value={data.spu.unit_name} />
                  <InfoItem label="面种" value={data.spu.fabric_type_name} />
                  <InfoItem label="面料" value={data.spu.fabric} />
                  <InfoItem label="成分" value={data.spu.composition} />
                  <InfoItem label="里料" value={data.spu.lining_material} />
                  <InfoItem label="洗标成分" value={data.spu.wash_label_ingr} />
                  <InfoItem label="设计师" value={data.spu.designer} />
                  <InfoItem label="创建时间" value={formatDateTime(data.spu.creation_date)} />
                  <InfoItem label="更新时间" value={formatDateTime(data.spu.last_update_date)} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>扩展字段</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <InfoItem label="模特" value={data.spu.model_name} />
                <InfoItem label="长短" value={data.spu.length_name} />
                <InfoItem label="价格带" value={data.spu.price_range_name} />
                <InfoItem label="产品定位" value={data.spu.product_positioning_name} />
                <InfoItem label="采购组" value={data.spu.purchase_group_name} />
                <InfoItem label="采购模式" value={data.spu.purchase_pattern_name} />
                <InfoItem label="场景" value={data.spu.scene_name} />
                <InfoItem label="是否延续" value={data.spu.is_continue_name} />
                <InfoItem label="是否 IP" value={data.spu.is_ip_name} />
                <InfoItem label="心智品" value={data.spu.is_mental_products_name} />
                <InfoItem label="均码" value={data.spu.is_uni_size_name} />
                <InfoItem label="渠道等级" value={data.spu.channel_level} />
                <InfoItem label="填充物" value={data.spu.filler} />
                <InfoItem label="SPU 组" value={data.spu.spu_group} />
                <InfoItem label="启用状态" value={data.spu.enable_status} />
                <InfoItem label="审批状态" value={data.spu.approve_status} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skcs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>SKC 款色</CardTitle>
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
                        <TableHead>价格</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>同步时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.skcs.length ? (
                        data.skcs.map((skc) => (
                          <TableRow key={skc.id}>
                            <TableCell className="font-medium">{skc.skc_code}</TableCell>
                            <TableCell>{[skc.color_code, skc.color_name].filter(Boolean).join(" / ") || "—"}</TableCell>
                            <TableCell>
                              <div>{skc.skc_name ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">{skc.skc_name_en ?? "—"}</div>
                            </TableCell>
                            <TableCell>{formatNumber(skc.sku_count)}</TableCell>
                            <TableCell>{formatCurrency(skc.price_tag)}</TableCell>
                            <TableCell>{skc.status_name ?? skc.enable_status ?? skc.approve_status ?? "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDateTime(skc.synced_at)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            暂无 SKC 数据
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skus" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>SKU 明细</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>SKC/颜色</TableHead>
                        <TableHead>尺码</TableHead>
                        <TableHead>条码/货号</TableHead>
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
                            <TableCell>
                              <div>{sku.skc_code}</div>
                              <div className="text-xs text-muted-foreground">
                                {sku.skc_color_name ?? sku.color_name ?? sku.color_code ?? "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{sku.shein_size_name ?? sku.size_name ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">{sku.size_code ?? "—"}</div>
                            </TableCell>
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
                            <TableCell>{sku.status_name ?? sku.enable_status ?? sku.approve_status ?? "—"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            暂无 SKU 数据
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="mt-4">
            <JsonViewer data={parseJson(data.spu.raw_payload_json)} label="MDM SPU Raw Payload" defaultOpen />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
