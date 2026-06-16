import { useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CheckCircle2, ClipboardCheck, Loader2, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

export default function ProductArchiveDraftDetailPage() {
  const { draftId } = useParams()
  const queryClient = useQueryClient()
  const detail = useDraftDetail(draftId)
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({})

  const draft = detail.data?.draft
  const summary = draft?.validation_summary_json ?? {}
  const changedFields = useMemo(() => {
    return Object.entries(fieldValues)
      .filter(([, value]) => value !== "")
      .map(([id, valueText]) => ({ id: Number(id), valueText }))
  }, [fieldValues])

  const saveFields = useMutation({
    mutationFn: () =>
      api.patch<DraftDetail>(`/product-archive-drafts/${draftId}/fields`, { fields: changedFields }),
    onSuccess: () => {
      toast.success("字段已保存")
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

  const dryRunSubmit = useMutation({
    mutationFn: () => api.post<unknown>(`/product-archive-drafts/${draftId}/submit`, { dryRun: true }),
    onSuccess: () => {
      toast.success("已生成提交预览")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts", draftId] })
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
        <Button type="button" variant="outline" size="sm" onClick={() => validate.mutate()} disabled={validate.isPending}>
          {validate.isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
          重新校验
        </Button>
        <Button type="button" size="sm" onClick={() => dryRunSubmit.mutate()} disabled={dryRunSubmit.isPending}>
          {dryRunSubmit.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          提交预览
        </Button>
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
              <CardTitle>字段填充</CardTitle>
              <Button
                type="button"
                size="sm"
                disabled={changedFields.length === 0 || saveFields.isPending}
                onClick={() => saveFields.mutate()}
              >
                {saveFields.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                保存字段
              </Button>
            </CardHeader>
            <CardContent>
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
                  {detail.data?.fields.map((field) => (
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
                      <TableCell>
                        <Input
                          value={fieldValues[field.id] ?? ""}
                          onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
                          placeholder="人工覆盖值"
                          className="h-8"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
