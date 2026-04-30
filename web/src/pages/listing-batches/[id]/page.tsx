import { Link, useParams } from "react-router"
import { ArrowLeft, ArrowRight, CheckCircle2, Send, ShieldAlert } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface BatchDetail {
  batch: {
    batch_no: string
    batch_name: string
    status: string
    draft_count: number
    skc_count: number
    sku_count: number
    blocker_count: number
    publishing_count: number
    auditing_count: number
    approved_count: number
    failed_count: number
    updated_at: string
  }
  drafts: Array<{
    id: number
    spu_code: string
    title: string | null
    spu_name: string | null
    brand_name: string | null
    status: string
    validation_status: string
    completeness: number
    platform_category_name: string | null
    platform_category_path: string | null
    skc_count: number
    sku_count: number
    blocker_count: number
    latest_version_no: number | null
    updated_at: string
  }>
}

function useBatchDetail(id: string | undefined) {
  return useQuery<BatchDetail>({
    queryKey: ["listing-batches", id],
    queryFn: () => api.get(`/listing-batches/${encodeURIComponent(id ?? "")}`),
    enabled: Boolean(id),
  })
}

function statusClass(status: string) {
  if (["PUBLISH_FAILED", "REJECTED", "FAILED"].includes(status)) return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  if (status === "APPROVED") return "border-[#b9f4d8] bg-[#f4fff9] text-[#0f8a5f]"
  if (["PUBLISHING", "PUBLISH_SUBMITTED", "UNDER_REVIEW"].includes(status)) return "border-[#ead7ff] bg-[#f7f0ff] text-[#7c3ec5]"
  return "border-[#e7dccd] bg-[#f7f2eb] text-[#7f684c]"
}

export default function BatchDetailPage() {
  const { id } = useParams()
  const { data, isLoading } = useBatchDetail(id)

  if (isLoading) {
    return <PageContainer><div className="py-16 text-center text-sm text-muted-foreground">加载批次详情...</div></PageContainer>
  }

  if (!data) {
    return <PageContainer><div className="py-16 text-center text-sm text-muted-foreground">批次不存在</div></PageContainer>
  }

  const { batch } = data
  const draftIds = data.drafts.map((draft) => draft.id).join(",")

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={batch.batch_name}
        description={`${batch.batch_no} / 更新时间 ${formatDateTime(batch.updated_at)}`}
      >
        <Button asChild variant="outline">
          <Link to="/listing-batches">
            <ArrowLeft className="mr-2 size-4" />
            返回批次列表
          </Link>
        </Button>
        <Button asChild>
          <Link to={`/pre-publish-validation?batch_search=${encodeURIComponent(data.drafts.map((draft) => draft.spu_code).join("\n"))}`}>
            <Send className="mr-2 size-4" />
            去草稿箱批量发布
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="草稿" value={formatNumber(batch.draft_count)} />
        <StatCard title="SKC / SKU" value={`${formatNumber(batch.skc_count)} / ${formatNumber(batch.sku_count)}`} />
        <StatCard title="阻断项" value={formatNumber(batch.blocker_count)} icon={ShieldAlert} />
        <StatCard title="审核通过" value={formatNumber(batch.approved_count)} icon={CheckCircle2} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>批次草稿</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded border bg-muted/25 p-3 text-sm text-muted-foreground">
            批量发布入口会带上本批次款号进入 SHEIN 发布草稿箱；在草稿箱内勾选草稿后可进行批量预检、快速修正和批量发布。草稿 ID：{draftIds || "-"}
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead>类目</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>完整度</TableHead>
                  <TableHead>范围</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.drafts.length ? (
                  data.drafts.map((draft) => (
                    <TableRow key={draft.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <Link to={`/pre-publish-validation/${draft.id}`} className="font-medium hover:text-[var(--brand-deep)] hover:underline">
                            {draft.spu_code}
                          </Link>
                          <div className="max-w-[340px] truncate text-sm text-muted-foreground">{draft.title ?? draft.spu_name ?? "—"}</div>
                          {draft.brand_name ? <div className="text-xs text-muted-foreground">{draft.brand_name}</div> : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[320px] text-sm">
                        <div>{draft.platform_category_name ?? "未选择类目"}</div>
                        <div className="truncate text-xs text-muted-foreground">{draft.platform_category_path ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className={statusClass(draft.status)}>{draft.status}</Badge>
                          <Badge variant="outline">{draft.validation_status}</Badge>
                          {Number(draft.blocker_count) > 0 ? (
                            <Badge variant="outline" className="border-[#f1cccc] bg-[#fff1f1] text-[#d45656]">
                              阻断 {formatNumber(draft.blocker_count)}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(draft.completeness)}%</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        SKC {formatNumber(draft.skc_count)} / SKU {formatNumber(draft.sku_count)} / v{draft.latest_version_no ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(draft.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/pre-publish-validation/${draft.id}`}>
                            编辑
                            <ArrowRight className="ml-1 size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">批次内暂无草稿</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
