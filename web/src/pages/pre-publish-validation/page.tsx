import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ImageIcon,
  Loader2,
  Save,
  Search,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatNumber } from "@/lib/format"
import { parseBatchSearch } from "@/lib/spreadsheet"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface AttributeOption {
  attribute_value_id: number
  attribute_value: string
  attribute_value_en: string | null
}

interface FillField {
  key: string
  label: string
  value: string | number | null
  source: string
  status: "READY" | "MISSING" | "NEEDS_AI" | "WARNING"
  confidence?: number | null
  note?: string | null
  options?: AttributeOption[]
}

interface FieldGroup {
  group: string
  fields: FillField[]
}

interface SkcRow {
  skc_code: string
  color_code: string | null
  color_name: string | null
  pic_url: string | null
  tmall_color_image_url: string | null
  tmall_color_url: string | null
  sku_count: number
}

interface ReadinessItem {
  spu_code: string
  spu_name: string | null
  title_cn: string | null
  title_en: string | null
  brand_name: string | null
  category: {
    category_id: number | null
    product_type_id: number | null
    category_name: string | null
    path: string | null
    source: string
    status: string
  }
  skcs: SkcRow[]
  sku_count: number
  completeness: number
  ready_field_count: number
  total_field_count: number
  missing_field_count: number
  needs_ai_count: number
  field_groups: FieldGroup[]
  manual_fields: FillField[]
  blocking_issues: string[]
}

interface ReadinessResponse {
  summary: {
    total_products: number
    ready_products: number
    needs_ai_products: number
    blocking_products: number
    missing_field_count: number
    needs_ai_count: number
    avg_completeness: number
  }
  items: ReadinessItem[]
}

interface AiFillResult {
  saved_count: number
}

const statusClass: Record<FillField["status"], string> = {
  READY: "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]",
  WARNING: "border-[#f4ddb3] bg-[#fff8e8] text-[#b6720b]",
  MISSING: "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]",
  NEEDS_AI: "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]",
}

function usePrePublishReadiness(search: string, batchSearch: string) {
  return useQuery<ReadinessResponse>({
    queryKey: ["pre-publish", "readiness", search, batchSearch],
    queryFn: () =>
      api.get(
        `/pre-publish/readiness?q=${encodeURIComponent(search)}&batch_search=${encodeURIComponent(batchSearch)}`,
      ),
  })
}

function ProductImage({ skc }: { skc: SkcRow }) {
  const src = skc.tmall_color_image_url || skc.tmall_color_url || skc.pic_url
  if (!src) {
    return (
      <div className="flex h-20 w-16 items-center justify-center rounded border bg-muted text-muted-foreground">
        <ImageIcon className="size-5" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={skc.skc_code}
      className="h-20 w-16 rounded border object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  )
}

function FieldSourceBadge({ field }: { field: FillField }) {
  return (
    <Badge variant="outline" className={statusClass[field.status]}>
      {field.status === "NEEDS_AI" ? "需要人工判断" : field.source}
    </Badge>
  )
}

export default function PrePublishValidationPage() {
  const [search, setSearch] = useState("")
  const [batchSearchText, setBatchSearchText] = useState("")
  const [selectedSpu, setSelectedSpu] = useState<string | null>(null)
  const [manualValues, setManualValues] = useState<Record<string, string>>({})
  const queryClient = useQueryClient()
  const { data, isLoading } = usePrePublishReadiness(search, batchSearchText)
  const items = data?.items ?? []
  const summary = data?.summary
  const selected = useMemo(
    () => items.find((item) => item.spu_code === selectedSpu) ?? items[0] ?? null,
    [items, selectedSpu],
  )
  const batchCount = useMemo(() => parseBatchSearch(batchSearchText).length, [batchSearchText])

  const aiFillMutation = useMutation({
    mutationFn: () =>
      api.post<AiFillResult>("/pre-publish/ai-fill", {
        spu_codes: selected ? [selected.spu_code] : items.map((item) => item.spu_code),
      }),
    onSuccess: (result) => {
      toast.success(`AI 补齐完成，已保存 ${result.saved_count} 个字段`)
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "readiness"] })
    },
    onError: () => toast.error("AI 补齐失败，请稍后重试"),
  })

  const saveFieldMutation = useMutation({
    mutationFn: (payload: {
      spu_code: string
      field_key: string
      field_label: string
      field_value: string
    }) =>
      api.post("/pre-publish/field-fills", {
        ...payload,
        source: "MANUAL",
      }),
    onSuccess: () => {
      toast.success("保存字段成功")
      queryClient.invalidateQueries({ queryKey: ["pre-publish", "readiness"] })
    },
  })

  function saveField(field: FillField) {
    if (!selected) return
    const value = manualValues[field.key] ?? String(field.value ?? "")
    saveFieldMutation.mutate({
      spu_code: selected.spu_code,
      field_key: field.key,
      field_label: field.label,
      field_value: value,
    })
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="发布前字段补齐"
        description="按批量发布商品明细概览把 MDM、深绘、SHEIN 类目属性和规则表汇总成发布前最后一张检查清单。"
      >
        <Button
          variant="outline"
          onClick={() => aiFillMutation.mutate()}
          disabled={aiFillMutation.isPending || items.length === 0}
        >
          {aiFillMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Bot className="mr-2 size-4" />
          )}
          AI 补齐人工判断字段
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="商品数" value={formatNumber(summary?.total_products ?? 0)} icon={ClipboardCheck} />
        <StatCard title="字段完整度" value={`${summary?.avg_completeness ?? 0}%`} icon={CheckCircle2} />
        <StatCard title="需要人工判断" value={formatNumber(summary?.needs_ai_count ?? 0)} icon={Sparkles} />
        <StatCard title="阻断商品" value={formatNumber(summary?.blocking_products ?? 0)} />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <CardTitle>商品清单</CardTitle>
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
              <div className="relative lg:w-80">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索款号、标题、类目"
                  className="pl-9"
                />
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">批量搜索款号</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>批量搜索款号</DialogTitle>
                    <DialogDescription>粘贴款号或 SKC，支持空格、换行、逗号和分号分隔。</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={batchSearchText}
                    onChange={(event) => setBatchSearchText(event.target.value)}
                    rows={8}
                    placeholder={"208226102001\n208226103201"}
                  />
                  <p className="text-xs text-muted-foreground">当前输入 {batchCount} 个搜索词。</p>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>款号</TableHead>
                  <TableHead>标题/类目</TableHead>
                  <TableHead>SKC</TableHead>
                  <TableHead>字段完整度</TableHead>
                  <TableHead>缺失/判断</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.spu_code}
                    className={item.spu_code === selected?.spu_code ? "bg-muted/50" : "cursor-pointer"}
                    onClick={() => setSelectedSpu(item.spu_code)}
                  >
                    <TableCell className="font-mono">{item.spu_code}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{item.title_cn || item.spu_name || "-"}</p>
                        <p className="text-xs text-muted-foreground">{item.category.category_name || "未匹配类目"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{item.skcs.length} 款色 / {item.sku_count} SKU</TableCell>
                    <TableCell>
                      <div className="flex min-w-[150px] items-center gap-3">
                        <Progress value={item.completeness} className="h-2" />
                        <span className="w-10 text-right text-xs tabular-nums">{item.completeness}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">缺失 {item.missing_field_count}</Badge>
                        <Badge variant="outline" className="border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]">
                          判断 {item.needs_ai_count}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>SPU / SKC 款色图</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-mono text-sm font-medium">{selected.spu_code}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selected.title_cn || selected.spu_name}</p>
              </div>
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">{selected.category.category_name || "未匹配类目"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{selected.category.path || selected.category.source}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {selected.skcs.map((skc) => (
                  <div key={skc.skc_code} className="rounded border p-2">
                    <ProductImage skc={skc} />
                    <p className="mt-2 truncate font-mono text-xs">{skc.skc_code}</p>
                    <p className="truncate text-xs text-muted-foreground">{skc.color_name || skc.color_code}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">TMALL COLOR_BLOCK / COLOR</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>字段来源与补齐结果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {selected.field_groups.map((group) => (
                <div key={group.group} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{group.group}</h3>
                    <Badge variant="outline">字段来源</Badge>
                  </div>
                  <div className="overflow-hidden rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">字段</TableHead>
                          <TableHead>字段值</TableHead>
                          <TableHead className="w-[160px]">来源</TableHead>
                          <TableHead className="w-[180px]">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.fields.map((field) => (
                          <TableRow key={field.key}>
                            <TableCell className="font-medium">{field.label}</TableCell>
                            <TableCell>
                              {field.options && field.options.length > 0 ? (
                                <Select
                                  value={manualValues[field.key] ?? String(field.value ?? "")}
                                  onValueChange={(value) =>
                                    setManualValues((prev) => ({ ...prev, [field.key]: value }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="选择枚举值" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {field.options.map((option) => (
                                      <SelectItem
                                        key={`${field.key}-${option.attribute_value_id}`}
                                        value={option.attribute_value}
                                      >
                                        {option.attribute_value}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div>
                                  <p className="text-sm">{field.value ?? "-"}</p>
                                  {field.note ? (
                                    <p className="mt-1 text-xs text-muted-foreground">{field.note}</p>
                                  ) : null}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <FieldSourceBadge field={field} />
                            </TableCell>
                            <TableCell>
                              {field.status === "NEEDS_AI" || field.options?.length ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => saveField(field)}
                                  disabled={saveFieldMutation.isPending}
                                >
                                  <Save className="mr-1 size-3.5" />
                                  保存字段
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">已自动填充</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  )
}
