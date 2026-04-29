import { Link, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  ExternalLink,
  FileImage,
  FileText,
  ImageIcon,
  Layers3,
  Tags,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format"
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

interface DeepdrawPackage {
  id: number
  source_system: string
  source_code: string
  spu_code: string
  deepdraw_product_id: string | null
  deepdraw_body_id: string | null
  title: string | null
  brand_name: string | null
  category_name: string | null
  trade_path: string | null
  retail_price: number | null
  primary_color: string | null
  version: number | null
  complete: number
  create_date: string | null
  last_update_date: string | null
  onsale_date: string | null
  places_json: string
  colors_json: string
  sizes_json: string
  response_code: number | null
  response_text: string | null
  reason: string | null
  request_id: string | null
  synced_at: string | null
  raw_payload_json: string
  raw_response_json: string | null
}

interface ContentSkc {
  id: number
  skc_code: string
  color_name: string | null
  color_alias: string | null
  sku_count: number
}

interface ContentSku {
  id: number
  skc_code: string
  sku_code: string
  color_name: string | null
  color_alias: string | null
  size_name: string | null
  size_code: string | null
  barcode: string | null
  seller_code: string | null
  xhs_seller_code: string | null
  vip_skc_code: string | null
  price: number | null
  retail_price: number | null
  quantity: number | null
  values_json: string | null
}

interface ContentField {
  id: number
  field_name: string
  field_type: string | null
  value_text: string | null
  texts_json: string | null
  options_json: string | null
  is_key: number
}

interface ContentSize {
  id: number
  size_name: string
  size_code: string | null
  size_alias: string | null
  sort_no: number
  field_name: string | null
}

interface DetailPage {
  id: number
  page_index: number
  template_name: string | null
  template_width: number | null
  active: number | null
  page_time: string | null
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

interface DeepdrawContentDetail {
  spu_code: string
  content_package: DeepdrawPackage
  skcs: ContentSkc[]
  skus: ContentSku[]
  fields: ContentField[]
  sizes: ContentSize[]
  detail_pages: DetailPage[]
  size_tables: SizeTable[]
  size_table_rows: SizeTableRow[]
  assets: ProductAsset[]
}

function useDeepdrawContentDetail(spuCode: string | undefined) {
  return useQuery<DeepdrawContentDetail>({
    queryKey: ["deepdraw-content", spuCode],
    queryFn: () => api.get(`/deepdraw-content/${encodeURIComponent(spuCode!)}`),
    enabled: !!spuCode,
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

function parseJsonArray(value: string | null | undefined): string[] {
  const parsed = parseJson(value)
  return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
}

function parseJsonRecord(value: string | null | undefined): Record<string, string> {
  const parsed = parseJson(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed).map(([key, item]) => [key, item == null ? "" : String(item)]),
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

function ImageTile({ asset }: { asset: ProductAsset }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_2px_4px_rgba(0,0,0,0.03)]">
      <div className="aspect-square bg-muted">
        <img
          src={asset.normalized_url}
          alt={asset.file_name ?? asset.asset_type ?? "深绘图片"}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="space-y-1 p-3 text-xs">
        <div className="truncate font-medium">
          {asset.asset_type ?? asset.source_kind}
          {asset.picture_type ? ` / ${asset.picture_type}` : ""}
        </div>
        <div className="truncate text-muted-foreground">
          {asset.skc_code ?? asset.module_name ?? asset.place ?? "SPU"}
        </div>
        <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-start px-1">
          <a href={asset.normalized_url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            原图
          </a>
        </Button>
      </div>
    </div>
  )
}

function ImageGrid({
  images,
  empty,
}: {
  images: ProductAsset[]
  empty: string
}) {
  if (!images.length) {
    return (
      <div className="flex h-36 items-center justify-center rounded-2xl border bg-muted/40 text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
      {images.map((asset) => (
        <ImageTile key={asset.id} asset={asset} />
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

export default function DeepdrawContentDetailPage() {
  const { spuCode } = useParams()
  const { data, isLoading } = useDeepdrawContentDetail(spuCode)

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
          <Link to="/deepdraw-content">
            <ArrowLeft className="size-4" />
            返回
          </Link>
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            深绘内容包不存在
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  const title = data.content_package.title ?? data.spu_code
  const heroImage = data.assets.find((asset) => asset.source_kind === "PICTURE") ?? data.assets[0]
  const productImages = data.assets.filter((asset) => asset.source_kind === "PICTURE")
  const detailImages = data.assets.filter((asset) => asset.source_kind !== "PICTURE")
  const sizeTableRowsByIndex = new Map<number, SizeTableRow[]>()
  for (const row of data.size_table_rows) {
    const rows = sizeTableRowsByIndex.get(row.table_index) ?? []
    rows.push(row)
    sizeTableRowsByIndex.set(row.table_index, rows)
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader title={data.spu_code} description={title} compact>
        <CompleteBadge complete={data.content_package.complete} />
        {data.content_package.response_code != null ? (
          <Badge variant="outline">响应 {data.content_package.response_code}</Badge>
        ) : null}
      </PageHeader>

      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/deepdraw-content">
          <ArrowLeft className="size-4" />
          深绘内容包
        </Link>
      </Button>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="款色/SKU"
          value={`${formatNumber(data.skcs.length)} / ${formatNumber(data.skus.length)}`}
          icon={Layers3}
        />
        <StatCard title="字段" value={formatNumber(data.fields.length)} icon={Tags} />
        <StatCard title="商详页" value={formatNumber(data.detail_pages.length)} icon={FileText} />
        <StatCard title="图片素材" value={formatNumber(data.assets.length)} icon={FileImage} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="space-y-3 p-4">
            <HeroImage image={heroImage} title={title} />
            <div>
              <div className="font-medium leading-5">{title}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {data.content_package.brand_name ?? "—"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="min-w-0">
          <TabsList>
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="fields">字段</TabsTrigger>
            <TabsTrigger value="sku">款色/SKU</TabsTrigger>
            <TabsTrigger value="detail">商详</TabsTrigger>
            <TabsTrigger value="images">图片</TabsTrigger>
            <TabsTrigger value="raw">原始数据</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>内容包资料</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <InfoItem label="源系统" value={data.content_package.source_system} />
                <InfoItem label="源编码" value={data.content_package.source_code} />
                <InfoItem label="深绘商品 ID" value={data.content_package.deepdraw_product_id} />
                <InfoItem label="深绘 Body ID" value={data.content_package.deepdraw_body_id} />
                <InfoItem label="标题" value={data.content_package.title} />
                <InfoItem label="品牌" value={data.content_package.brand_name} />
                <InfoItem label="类目" value={data.content_package.category_name} />
                <InfoItem label="行业路径" value={data.content_package.trade_path} />
                <InfoItem label="零售价" value={formatCurrency(data.content_package.retail_price)} />
                <InfoItem label="主颜色" value={data.content_package.primary_color} />
                <InfoItem label="版本" value={data.content_package.version} />
                <InfoItem label="上架日期" value={formatDateTime(data.content_package.onsale_date)} />
                <InfoItem label="创建时间" value={formatDateTime(data.content_package.create_date)} />
                <InfoItem label="更新时间" value={formatDateTime(data.content_package.last_update_date)} />
                <InfoItem label="同步时间" value={formatDateTime(data.content_package.synced_at)} />
                <InfoItem label="请求 ID" value={data.content_package.request_id} />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <JsonViewer data={parseJson(data.content_package.places_json)} label="销售位置" />
              <JsonViewer data={parseJson(data.content_package.colors_json)} label="颜色映射" />
              <JsonViewer data={parseJson(data.content_package.sizes_json)} label="尺码映射" />
            </div>
          </TabsContent>

          <TabsContent value="fields" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>深绘字段</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>字段</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>值</TableHead>
                        <TableHead>选项</TableHead>
                        <TableHead>标记</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.fields.length ? (
                        data.fields.map((field) => (
                          <TableRow key={field.id}>
                            <TableCell className="font-medium">{field.field_name}</TableCell>
                            <TableCell>{field.field_type ?? "—"}</TableCell>
                            <TableCell className="max-w-[360px] truncate">
                              {field.value_text ?? (parseJsonArray(field.texts_json).join(" / ") || "—")}
                            </TableCell>
                            <TableCell className="max-w-[260px] truncate">
                              {parseJsonArray(field.options_json).join(" / ") || "—"}
                            </TableCell>
                            <TableCell>
                              {field.is_key ? <Badge variant="outline">关键字段</Badge> : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            暂无字段
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sku" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>深绘款色</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKC</TableHead>
                        <TableHead>颜色</TableHead>
                        <TableHead>别名</TableHead>
                        <TableHead>SKU 数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.skcs.length ? (
                        data.skcs.map((skc) => (
                          <TableRow key={skc.id}>
                            <TableCell className="font-medium">{skc.skc_code}</TableCell>
                            <TableCell>{skc.color_name ?? "—"}</TableCell>
                            <TableCell>{skc.color_alias ?? "—"}</TableCell>
                            <TableCell>{formatNumber(skc.sku_count)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
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
                <CardTitle>深绘 SKU</CardTitle>
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
                        <TableHead>价格/库存</TableHead>
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
                                {sku.color_alias ?? sku.color_name ?? "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{sku.size_name ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">{sku.size_code ?? "—"}</div>
                            </TableCell>
                            <TableCell>
                              <div>{sku.barcode ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">
                                {sku.seller_code ?? sku.xhs_seller_code ?? sku.vip_skc_code ?? "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{formatCurrency(sku.price ?? sku.retail_price)}</div>
                              <div className="text-xs text-muted-foreground">
                                数量：{formatNumber(sku.quantity)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            暂无 SKU
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
                <CardTitle>尺码枚举</CardTitle>
              </CardHeader>
              <CardContent>
                {data.sizes.length ? (
                  <div className="flex flex-wrap gap-2">
                    {data.sizes.map((size) => (
                      <Badge key={size.id} variant="outline" className="h-8 px-3">
                        {size.size_name}
                        {size.size_alias ? ` / ${size.size_alias}` : ""}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无尺码枚举</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detail" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>商详页</CardTitle>
              </CardHeader>
              <CardContent>
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
                      {data.detail_pages.length ? (
                        data.detail_pages.map((page) => (
                          <TableRow key={page.id}>
                            <TableCell>{page.page_index}</TableCell>
                            <TableCell>{page.template_name ?? "—"}</TableCell>
                            <TableCell>{page.template_width ?? "—"}</TableCell>
                            <TableCell>{page.screenshot_count} / {page.module_count}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {page.html_page_url ? (
                                  <Button asChild variant="ghost" size="sm">
                                    <a href={page.html_page_url} target="_blank" rel="noreferrer">HTML</a>
                                  </Button>
                                ) : null}
                                {page.image_page_url ? (
                                  <Button asChild variant="ghost" size="sm">
                                    <a href={page.image_page_url} target="_blank" rel="noreferrer">图片页</a>
                                  </Button>
                                ) : null}
                                {page.mixed_page_url ? (
                                  <Button asChild variant="ghost" size="sm">
                                    <a href={page.mixed_page_url} target="_blank" rel="noreferrer">混合页</a>
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            暂无商详页
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {data.size_tables.length ? (
              data.size_tables.map((table) => {
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
                                    <TableCell className="font-medium">{row.size_name ?? "—"}</TableCell>
                                    {columns.map((column) => (
                                      <TableCell key={column}>{values[column] || "—"}</TableCell>
                                    ))}
                                  </TableRow>
                                )
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={Math.max(1, columns.length + 1)} className="h-24 text-center text-muted-foreground">
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
            ) : null}
          </TabsContent>

          <TabsContent value="images" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>商品图片</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageGrid images={productImages} empty="暂无商品图片" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>商详与模块图片</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageGrid images={detailImages} empty="暂无商详图片" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="mt-4 space-y-4">
            <JsonViewer data={parseJson(data.content_package.raw_payload_json)} label="DeepDraw Raw Payload" defaultOpen />
            <JsonViewer data={parseJson(data.content_package.raw_response_json)} label="DeepDraw Raw Response" />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
