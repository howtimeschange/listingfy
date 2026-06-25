import { useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CheckCircle2, ClipboardCheck, ListTree, Loader2, RefreshCw, Save, Search, Send, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Draft {
  id: number
  draft_no: string
  spu_code: string
  tenant_name: string
  merchant_id: string
  trade_id: string | null
  trade_path: string | null
  title: string | null
  retail_price: number | null
  status: string
  source_snapshot_json: unknown
  validation_summary_json: { blocker_count?: number; warning_count?: number; validated_at?: string }
  duplicate_result_json: unknown
  created_product_id: string | null
  updated_at: string
}

interface DraftField {
  id: number
  field_name: string
  source_type: string
  value_text: string | null
  required: boolean
  blocking: boolean
  manual_override: boolean
  validation_status: string
  validation_message: string | null
  options_json?: unknown
}

interface DraftSku {
  id: number
  skc_code: string | null
  sku_code: string
  barcode: string | null
  color_name: string | null
  size_name: string | null
  price: number | null
  seller_code: string | null
}

interface DraftIssue {
  id: number
  severity: string
  issue_type: string
  field_name: string | null
  sku_code: string | null
  message: string
  resolved_at: string | null
}

interface DraftLog {
  id: number
  operation: string
  http_status: number | null
  response_code: string | null
  response_reason: string | null
  request_id: string | null
  product_id: string | null
  created_at: string
}

interface DraftDetail {
  draft: Draft
  fields: DraftField[]
  skus: DraftSku[]
  issues: DraftIssue[]
  logs: DraftLog[]
}

interface TradeRow {
  trade_id: string
  trade_name: string
  trade_path: string | null
}

interface TradeListResponse {
  items: TradeRow[]
}

interface FieldOption {
  label: string
  value: string
}

function useDraftDetail(draftId: string | undefined) {
  return useQuery<DraftDetail>({
    queryKey: ["product-archive-drafts", draftId],
    enabled: Boolean(draftId),
    queryFn: () => api.get<DraftDetail>(`/product-archive-drafts/${draftId}`),
  })
}

function statusClass(status: string) {
  if (["ready", "created", "readback_verified"].includes(status)) return "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
  if (["missing_fields", "manual_review", "readback_mismatch"].includes(status)) return "border-[#f4ddb3] bg-[#fff8e8] text-[#c37d0d]"
  if (["failed", "duplicate_found"].includes(status)) return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  return "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
}

function parseOptionList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["options", "values", "items", "list"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[]
    }
  }
  return []
}

function stringOptionValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function fieldOptionText(option: unknown, keys: string[]) {
  if (!option || typeof option !== "object") return stringOptionValue(option)
  const record = option as Record<string, unknown>
  for (const key of keys) {
    const value = stringOptionValue(record[key])
    if (value) return value
  }
  return stringOptionValue(record.value) || stringOptionValue(record.label) || stringOptionValue(record.name)
}

function fieldOptions(field: DraftField): FieldOption[] {
  const currentValue = field.value_text ?? ""
  const options = parseOptionList(field.options_json)
    .map((option) => {
      const value = fieldOptionText(option, ["value", "code", "id", "optionValue", "option_value", "key", "name", "label"])
      const label = fieldOptionText(option, ["label", "name", "text", "optionName", "option_name", "title", "value", "code"])
      if (!value && !label) return null
      return { value: value || label, label: label || value }
    })
    .filter(Boolean) as FieldOption[]
  const deduped = Array.from(new Map(options.map((option) => [option.value, option])).values())
  if (currentValue && !deduped.some((option) => option.value === currentValue)) {
    deduped.unshift({ value: currentValue, label: `${currentValue}（当前值）` })
  }
  return deduped
}

export default function ProductArchiveDraftDetailPage() {
  const { draftId } = useParams()
  const queryClient = useQueryClient()
  const detail = useDraftDetail(draftId)
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({})
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [tradeSearch, setTradeSearch] = useState("")
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const debouncedTradeSearch = useDebounce(tradeSearch, 250)

  const draft = detail.data?.draft
  const summary = draft?.validation_summary_json ?? {}
  const trades = useQuery<TradeListResponse>({
    queryKey: ["deepdraw-metadata-trades", draft?.tenant_name, debouncedTradeSearch],
    enabled: Boolean(draft && tradeDialogOpen),
    queryFn: () =>
      api.get<TradeListResponse>(`/deepdraw-metadata/trades?q=${encodeURIComponent(debouncedTradeSearch)}&tenantName=${encodeURIComponent(draft?.tenant_name ?? "")}`),
  })
  const selectedTrade = useMemo(() => {
    return (trades.data?.items ?? []).find((trade) => trade.trade_id === selectedTradeId) ?? null
  }, [selectedTradeId, trades.data?.items])
  const changedFields = useMemo(() => {
    const currentFields = new Map((detail.data?.fields ?? []).map((field) => [field.id, field.value_text ?? ""]))
    return Object.entries(fieldValues)
      .filter(([id, value]) => value !== (currentFields.get(Number(id)) ?? ""))
      .map(([id, valueText]) => ({ id: Number(id), valueText }))
  }, [detail.data?.fields, fieldValues])

  const saveFields = useMutation({
    mutationFn: () =>
      api.patch<DraftDetail>(`/product-archive-drafts/${draftId}/fields`, { fields: changedFields }),
    onSuccess: () => {
      toast.success("字段已保存")
      setFieldValues({})
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const applyTrade = useMutation({
    mutationFn: () =>
      api.patch<DraftDetail>(`/product-archive-drafts/${draftId}/trade`, {
        tradeId: selectedTrade?.trade_id ?? selectedTradeId,
        tradePath: selectedTrade?.trade_path,
      }),
    onSuccess: () => {
      toast.success("已应用类目并生成字段")
      setTradeDialogOpen(false)
      setSelectedTradeId(null)
      setFieldValues({})
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const validate = useMutation({
    mutationFn: () => api.post<unknown>(`/product-archive-drafts/${draftId}/validate`),
    onSuccess: () => {
      toast.success("校验已完成")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const aiFill = useMutation({
    mutationFn: () => api.post<{ saved: Array<{ field_id: number }> }>(`/product-archive-drafts/${draftId}/ai-fill`),
    onSuccess: (result) => {
      toast.success(`AI 已推荐补齐 ${formatNumber(result.saved.length)} 个字段`)
      setFieldValues({})
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const dryRunSubmit = useMutation({
    mutationFn: () => api.post<unknown>(`/product-archive-drafts/${draftId}/submit`, { dryRun: true }),
    onSuccess: () => {
      toast.success("已生成提交预览")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
  })

  const publishSubmit = useMutation({
    mutationFn: () => api.post<unknown>(`/product-archive-drafts/${draftId}/submit`, { dryRun: false }),
    onSuccess: () => {
      toast.success("已发布到深绘并完成回读校验")
      setPublishDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "发布到深绘失败")
    },
  })

  if (!draft) {
    return (
      <PageContainer>
        <PageHeader title="深绘建档草稿" description={detail.isLoading ? "正在加载草稿详情" : "草稿不存在"} />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title={draft.title || draft.spu_code}
        description={`${draft.spu_code} / ${draft.tenant_name} / ${draft.trade_path || "待确认类目"}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/product-archive-drafts">
            <ArrowLeft className="size-4" />
            返回
          </Link>
        </Button>
        <Dialog
          open={tradeDialogOpen}
          onOpenChange={(open) => {
            setTradeDialogOpen(open)
            if (open) setSelectedTradeId(draft.trade_id)
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <ListTree className="size-4" />
              选择深绘类目
            </Button>
          </DialogTrigger>
          <DialogContent className="grid max-h-[82vh] grid-rows-[auto_auto_minmax(0,1fr)_auto] sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>选择深绘类目</DialogTitle>
              <DialogDescription>
                从已同步的深绘类目主数据中选择模板，应用后会按类目字段重新生成草稿字段。
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={tradeSearch}
                onChange={(event) => setTradeSearch(event.target.value)}
                placeholder="搜索类目名称、路径或 tradeId"
                className="pl-9"
              />
            </div>
            <ScrollArea className="min-h-0 rounded-lg border">
              <div className="divide-y">
                {(trades.data?.items ?? []).map((trade) => {
                  const selected = selectedTradeId === trade.trade_id
                  return (
                    <button
                      key={trade.trade_id}
                      type="button"
                      className={`grid w-full gap-1 px-4 py-3 text-left text-sm hover:bg-muted ${selected ? "bg-[#d4fae8]" : ""}`}
                      onClick={() => setSelectedTradeId(trade.trade_id)}
                    >
                      <span className="font-medium">{trade.trade_name || trade.trade_id}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {trade.trade_path || "未维护路径"} · {trade.trade_id}
                      </span>
                    </button>
                  )
                })}
                {!trades.isFetching && (trades.data?.items ?? []).length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    未找到类目，请先到“深绘类目字段”同步主数据。
                  </div>
                ) : null}
                {trades.isFetching ? (
                  <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    正在加载类目
                  </div>
                ) : null}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTradeDialogOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={!selectedTradeId || applyTrade.isPending}
                onClick={() => applyTrade.mutate()}
              >
                {applyTrade.isPending ? <Loader2 className="size-4 animate-spin" /> : <ListTree className="size-4" />}
                应用类目并生成字段
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button type="button" variant="outline" size="sm" onClick={() => validate.mutate()} disabled={validate.isPending}>
          {validate.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
          重新校验
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => aiFill.mutate()} disabled={aiFill.isPending}>
          {aiFill.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          AI 推荐补齐空字段
        </Button>
        <Button type="button" size="sm" onClick={() => dryRunSubmit.mutate()} disabled={dryRunSubmit.isPending}>
          {dryRunSubmit.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          提交预览
        </Button>
        <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" disabled={publishSubmit.isPending}>
              {publishSubmit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              确认发布到深绘
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>确认发布到深绘</DialogTitle>
              <DialogDescription>
                将对款号 {draft.spu_code} 执行真实深绘建档。系统会先查重，再提交并回读校验。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPublishDialogOpen(false)}>
                取消
              </Button>
              <Button type="button" disabled={publishSubmit.isPending} onClick={() => publishSubmit.mutate()}>
                {publishSubmit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                确认发布到深绘
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard title="状态" value={draft.status} description={draft.trade_path || "待确认类目"} />
        <StatCard title="阻断问题" value={formatNumber(summary.blocker_count ?? 0)} />
        <StatCard title="警告" value={formatNumber(summary.warning_count ?? 0)} />
        <StatCard title="深绘 productId" value={draft.created_product_id || "-"} />
      </div>

      <Tabs defaultValue="overview" className="min-h-0">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="fields">字段填充</TabsTrigger>
          <TabsTrigger value="skus">SKU/颜色尺码</TabsTrigger>
          <TabsTrigger value="issues">校验问题</TabsTrigger>
          <TabsTrigger value="logs">提交记录</TabsTrigger>
          <TabsTrigger value="source">来源快照</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>草稿摘要</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div>草稿编号：{draft.draft_no}</div>
              <div>商户 ID：{draft.merchant_id}</div>
              <div>吊牌价：{draft.retail_price ?? "-"}</div>
              <div>更新时间：{formatDateTime(draft.updated_at)}</div>
              <div>最近校验：{summary.validated_at ? formatDateTime(summary.validated_at) : "-"}</div>
              <div>字段数：{formatNumber(detail.data?.fields.length ?? 0)}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>字段填充</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.trade_path || "待确认类目"}，字段来自深绘类目模板和字段规则。
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setTradeDialogOpen(true)}>
                  <ListTree className="size-4" />
                  选择深绘类目
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => aiFill.mutate()} disabled={aiFill.isPending}>
                  {aiFill.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  AI 推荐补齐空字段
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={changedFields.length === 0 || saveFields.isPending}
                  onClick={() => saveFields.mutate()}
                >
                  {saveFields.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  保存字段
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(detail.data?.fields.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <div className="text-sm font-medium">还没有字段模板</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    先选择深绘类目，系统会按该类目的字段模板生成可填字段。
                  </div>
                  <Button type="button" className="mt-4" onClick={() => setTradeDialogOpen(true)}>
                    <ListTree className="size-4" />
                    选择深绘类目
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>字段名</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>目标值</TableHead>
                      <TableHead>必填</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.data?.fields.map((field) => {
                      const options = fieldOptions(field)
                      const value = fieldValues[field.id] ?? field.value_text ?? ""
                      return (
                        <TableRow key={field.id}>
                          <TableCell>{field.field_name}</TableCell>
                          <TableCell>{field.source_type}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{field.value_text || "-"}</TableCell>
                          <TableCell>{field.required ? "必填" : "可选"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={field.validation_status === "valid" ? statusClass("ready") : statusClass("manual_review")}>
                              {field.validation_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-[220px]">
                            {options.length > 0 ? (
                              <Select
                                value={value}
                                onValueChange={(nextValue) => setFieldValues((current) => ({ ...current, [field.id]: nextValue }))}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="选择字段值" />
                                </SelectTrigger>
                                <SelectContent>
                                  {options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={value}
                                onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
                                placeholder="填写目标值"
                                className="h-8"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skus">
          <Card>
            <CardHeader>
              <CardTitle>SKU/颜色尺码</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKC</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>颜色</TableHead>
                    <TableHead>尺码</TableHead>
                    <TableHead>条码</TableHead>
                    <TableHead>价格</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.data?.skus.map((sku) => (
                    <TableRow key={sku.id}>
                      <TableCell>{sku.skc_code}</TableCell>
                      <TableCell>{sku.sku_code}</TableCell>
                      <TableCell>{sku.color_name}</TableCell>
                      <TableCell>{sku.size_name}</TableCell>
                      <TableCell>{sku.barcode || sku.seller_code}</TableCell>
                      <TableCell>{sku.price ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues">
          <Card>
            <CardHeader>
              <CardTitle>校验问题</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>级别</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>字段/SKU</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.data?.issues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>{issue.severity}</TableCell>
                      <TableCell>{issue.issue_type}</TableCell>
                      <TableCell>{issue.field_name || issue.sku_code || "-"}</TableCell>
                      <TableCell>{issue.message}</TableCell>
                      <TableCell>{issue.resolved_at ? "已解决" : "未解决"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>提交记录</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>操作</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>业务码</TableHead>
                    <TableHead>request id</TableHead>
                    <TableHead>productId</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.data?.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.operation}</TableCell>
                      <TableCell>{log.http_status ?? "-"}</TableCell>
                      <TableCell>{log.response_code || log.response_reason || "-"}</TableCell>
                      <TableCell>{log.request_id || "-"}</TableCell>
                      <TableCell>{log.product_id || "-"}</TableCell>
                      <TableCell>{formatDateTime(log.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="source">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>来源快照</CardTitle>
              <RefreshCw className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <pre className="max-h-[520px] overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify({
                  source: draft.source_snapshot_json,
                  duplicate: draft.duplicate_result_json,
                }, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
