import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Edit3, Loader2, Plus, Search, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format"
import { exportSpreadsheet, parseBatchSearch, readSpreadsheetFile } from "@/lib/spreadsheet"
import type { SpreadsheetRow } from "@/lib/spreadsheet"
import { EmptyState } from "@/components/empty-state"
import { ServerPagination } from "@/components/server-pagination"
import type { ServerPaginationState } from "@/components/server-pagination"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DiscountRule {
  id: number
  spu_code: string
  discount: number
  multiplier: number | null
  status: string
  note: string | null
  updated_at: string
  created_at: string
}

interface DiscountList {
  items: DiscountRule[]
  pagination: ServerPaginationState
}

interface DiscountSummary {
  total: number
  active_count: number
  low_rate_count: number
  average_discount: number | null
  default_discount: number
  retail_usd_rate: number
  note: string | null
  updated_at: string | null
}

interface PricePreviewItem {
  spu_code: string
  spu_name: string | null
  listing_title_cn: string | null
  brand_name: string | null
  price_tag: number | null
  discount: number
  rule_id: number | null
  supply_price_cny: number | null
  retail_price_usd: number | null
}

interface ImportResult {
  success_count: number
  failed_count: number
}

const emptyForm = {
  spu_code: "",
  discount: "0.4",
  status: "ACTIVE",
  note: "",
}

const emptyConfigForm = {
  default_discount: "0.4",
  usd_exchange_rate: "7.3",
  note: "",
}

function useDiscountRules(search: string, batchSearch: string, pagination: { limit: number; offset: number }) {
  return useQuery<DiscountList>({
    queryKey: ["business-rules", "discount-rules", search, batchSearch, pagination],
    queryFn: () =>
      api.get(
        `/business-rules/discount-rules?q=${encodeURIComponent(search)}&batch_search=${encodeURIComponent(batchSearch)}&limit=${pagination.limit}&offset=${pagination.offset}`,
      ),
  })
}

function useDiscountSummary() {
  return useQuery<DiscountSummary>({
    queryKey: ["business-rules", "discount-rules", "summary"],
    queryFn: () => api.get("/business-rules/discount-rules/summary"),
  })
}

function usePricePreview(search: string) {
  return useQuery<{ items: PricePreviewItem[] }>({
    queryKey: ["business-rules", "discount-rules", "preview", search],
    queryFn: () => api.get(`/business-rules/discount-rules/preview?q=${encodeURIComponent(search)}&limit=12`),
  })
}

function formatDiscount(value: number | null | undefined) {
  if (value == null) return "-"
  return `${Number(value).toFixed(2)}x`
}

export default function PriceRulesPage() {
  const [search, setSearch] = useState("")
  const [batchSearchText, setBatchSearchText] = useState("")
  const [previewSearch, setPreviewSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DiscountRule | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [configForm, setConfigForm] = useState(emptyConfigForm)
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const queryClient = useQueryClient()

  const { data, isLoading } = useDiscountRules(search, batchSearchText, pagination)
  const { data: summary } = useDiscountSummary()
  const { data: preview } = usePricePreview(previewSearch)
  const items = data?.items ?? []
  const batchCount = useMemo(() => parseBatchSearch(batchSearchText).length, [batchSearchText])
  const canSave = form.spu_code.trim() !== "" && Number(form.discount) > 0
  const canSaveConfig = Number(configForm.default_discount) > 0 && Number(configForm.usd_exchange_rate) > 0

  useEffect(() => {
    if (!summary) return
    setConfigForm({
      default_discount: String(summary.default_discount ?? 0.4),
      usd_exchange_rate: String(summary.retail_usd_rate ?? 7.3),
      note: summary.note ?? "",
    })
  }, [summary])

  const importMutation = useMutation({
    mutationFn: (payload: { file_name: string; rows: SpreadsheetRow[] }) =>
      api.post<ImportResult>("/business-rules/discount-rules/import", payload),
    onSuccess: (result) => {
      toast.success(`导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 行`)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "discount-rules"] })
      queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        spu_code: form.spu_code,
        discount: Number(form.discount),
        multiplier: Number(form.discount),
        status: form.status,
        note: form.note,
      }
      return editing
        ? api.patch(`/business-rules/discount-rules/${editing.id}`, body)
        : api.post("/business-rules/discount-rules", body)
    },
    onSuccess: () => {
      toast.success(editing ? "价格规则已更新" : "价格规则已新增")
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "discount-rules"] })
      queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
  })

  const saveConfigMutation = useMutation({
    mutationFn: () =>
      api.patch("/business-rules/price-config", {
        default_discount: Number(configForm.default_discount),
        usd_exchange_rate: Number(configForm.usd_exchange_rate),
        note: configForm.note,
    }),
    onSuccess: () => {
      toast.success("默认配置已更新")
      queryClient.invalidateQueries({ queryKey: ["business-rules", "discount-rules"] })
      queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/business-rules/discount-rules/${id}`),
    onSuccess: () => {
      toast.success("价格规则已删除")
      queryClient.invalidateQueries({ queryKey: ["business-rules", "discount-rules"] })
      queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
  })

  async function handleFile(file: File | null) {
    if (!file) return
    try {
      const rows = await readSpreadsheetFile(file)
      importMutation.mutate({ file_name: file.name, rows })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "表格解析失败")
    }
  }

  async function exportRows() {
    const result = await api.get<{ rows: SpreadsheetRow[] }>("/business-rules/discount-rules/export")
    exportSpreadsheet("SHEIN价格规则-导出.xlsx", result.rows)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(row: DiscountRule) {
    setEditing(row)
    setForm({
      spu_code: row.spu_code,
      discount: String(row.discount ?? 0.4),
      status: row.status || "ACTIVE",
      note: row.note ?? "",
    })
    setDialogOpen(true)
  }

  function updateSearch(value: string) {
    setSearch(value)
    setPagination((current) => ({ ...current, offset: 0 }))
  }

  function updateBatchSearch(value: string) {
    setBatchSearchText(value)
    setPagination((current) => ({ ...current, offset: 0 }))
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="SHEIN 价格规则"
        description="按 SHEIN 现有口径维护默认配置、款号级供货折扣和价格试算；未配置款号默认使用 0.40。"
      />

      <Tabs defaultValue="default-config" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto rounded-xl sm:w-fit">
          <TabsTrigger value="default-config" className="flex-none px-4">默认配置</TabsTrigger>
          <TabsTrigger value="discount-rules" className="flex-none px-4">SHEIN 供货折扣规则</TabsTrigger>
          <TabsTrigger value="price-preview" className="flex-none px-4">价格试算</TabsTrigger>
        </TabsList>

        <TabsContent value="default-config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>默认配置</CardTitle>
              <p className="text-sm text-muted-foreground">
                默认折扣用于未命中款号规则的 SHEIN 供货价计算；USD 折算汇率用于建议零售价试算和草稿生成。
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Label className="grid gap-2">
                  默认折扣
                  <Input
                    type="number"
                    step="0.01"
                    value={configForm.default_discount}
                    onChange={(event) => setConfigForm((current) => ({ ...current, default_discount: event.target.value }))}
                  />
                </Label>
                <Label className="grid gap-2">
                  USD 折算汇率
                  <Input
                    type="number"
                    step="0.01"
                    value={configForm.usd_exchange_rate}
                    onChange={(event) => setConfigForm((current) => ({ ...current, usd_exchange_rate: event.target.value }))}
                  />
                </Label>
              </div>
              <Label className="grid gap-2">
                备注
                <Textarea
                  value={configForm.note}
                  onChange={(event) => setConfigForm((current) => ({ ...current, note: event.target.value }))}
                  rows={3}
                />
              </Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  当前默认折扣 {formatDiscount(summary?.default_discount)} / USD 折算汇率 {summary?.retail_usd_rate ?? 7.3}
                </p>
                <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending || !canSaveConfig}>
                  {saveConfigMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  保存默认配置
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discount-rules" className="space-y-4">
          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle>SHEIN 供货折扣规则</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    规则 {formatNumber(data?.pagination.total)} / 当前页 {formatNumber(items.length)} / 启用 {formatNumber(summary?.active_count)} / 低倍率款号 {formatNumber(summary?.low_rate_count)} / 平均折扣 {summary?.average_discount == null ? "-" : formatDiscount(summary.average_discount)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={exportRows}>
                    <Download className="mr-2 size-4" />
                    导出
                  </Button>
                  <Button asChild variant="outline">
                    <Label className="cursor-pointer">
                      {importMutation.isPending ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 size-4" />
                      )}
                      导入价格规则
                      <Input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                      />
                    </Label>
                  </Button>
                  <Button onClick={openCreate}>
                    <Plus className="mr-2 size-4" />
                    新增规则
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative lg:w-80">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => updateSearch(event.target.value)}
                    placeholder="搜索款号或备注"
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {batchCount ? (
                    <Badge variant="secondary">批量搜索 {batchCount} 个词</Badge>
                  ) : null}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">批量搜索</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>批量搜索款号</DialogTitle>
                        <DialogDescription>粘贴多个款号，支持空格、换行、逗号和分号分隔。</DialogDescription>
                      </DialogHeader>
                      <Textarea
                        value={batchSearchText}
                        onChange={(event) => updateBatchSearch(event.target.value)}
                        rows={8}
                        placeholder={"201122104105\n208226111038"}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
              ) : items.length === 0 ? (
                <EmptyState icon={Search} message="暂无价格规则" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>款号</TableHead>
                        <TableHead>供货折扣</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>备注</TableHead>
                        <TableHead>更新时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.spu_code}</TableCell>
                          <TableCell>{formatDiscount(item.discount)}</TableCell>
                          <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                          <TableCell className="max-w-[360px] truncate">{item.note || "-"}</TableCell>
                          <TableCell>{formatDateTime(item.updated_at || item.created_at)}</TableCell>
                          <TableCell className="space-x-2 text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                              <Edit3 className="mr-1 size-4" />
                              编辑
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(item.id)}>
                              <Trash2 className="mr-1 size-4" />
                              删除
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <ServerPagination
                pagination={data?.pagination}
                onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
                onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="price-preview" className="space-y-4">
          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>价格试算</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">展示商品档案按当前折扣规则计算后的 SHEIN 供货价和 USD 建议零售价。</p>
                </div>
                <div className="relative lg:w-96">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={previewSearch}
                    onChange={(event) => setPreviewSearch(event.target.value)}
                    placeholder="搜索款号、商品名"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品</TableHead>
                      <TableHead>吊牌价</TableHead>
                      <TableHead>折扣</TableHead>
                      <TableHead>供货价/CNY</TableHead>
                      <TableHead>建议零售价/USD</TableHead>
                      <TableHead>规则来源</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(preview?.items ?? []).map((item) => (
                      <TableRow key={item.spu_code}>
                        <TableCell>
                          <div className="font-mono font-medium">{item.spu_code}</div>
                          <div className="max-w-[520px] truncate text-sm text-muted-foreground">
                            {item.listing_title_cn || item.spu_name || "-"}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(item.price_tag)}</TableCell>
                        <TableCell>{formatDiscount(item.discount)}</TableCell>
                        <TableCell>{formatCurrency(item.supply_price_cny)}</TableCell>
                        <TableCell>{formatCurrency(item.retail_price_usd, "USD")}</TableCell>
                        <TableCell>
                          <Badge variant={item.rule_id ? "secondary" : "outline"}>
                            {item.rule_id ? "款号规则" : "默认规则"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑价格规则" : "新增价格规则"}</DialogTitle>
            <DialogDescription>配置款号级供货折扣。输入 0.4 表示 40% 供货价；导入表支持「商品款号」「倍率」「供货折扣」。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Label className="grid gap-2">
              款号
              <Input
                value={form.spu_code}
                onChange={(event) => setForm((current) => ({ ...current, spu_code: event.target.value }))}
                placeholder="201122104105"
              />
            </Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Label className="grid gap-2">
                供货折扣
                <Input
                  type="number"
                  step="0.01"
                  value={form.discount}
                  onChange={(event) => setForm((current) => ({ ...current, discount: event.target.value }))}
                />
              </Label>
              <Label className="grid gap-2">
                状态
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">启用</SelectItem>
                    <SelectItem value="INACTIVE">停用</SelectItem>
                  </SelectContent>
                </Select>
              </Label>
            </div>
            <Label className="grid gap-2">
              备注
              <Textarea
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
              />
            </Label>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !canSave}>
              {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </PageContainer>
  )
}
