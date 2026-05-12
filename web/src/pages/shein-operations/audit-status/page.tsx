import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, ExternalLink, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"

export default function SheinAuditStatusPage() {
  const queryClient = useQueryClient()
  const { data, isFetching, refetch } = useQuery<{
    items: Array<{
      id: number
      sourceType: string
      sourceId: string
      spuName: string
      skcName: string
      documentSn: string
      documentState: number | null
      documentStateLabel: string
      version: string
      failureReasonText: string
      handledStatus: string
      ownerUsername: string
      traceId: string
      lastSyncedAt: string
    }>
    summary: {
      total: number
      open: number
      rejected: number
      bySource: Record<string, number>
      failureReasonGroups: Array<{ reason: string; count: number }>
    }
  }>({
    queryKey: ["shein-operations", "audit-status"],
    queryFn: () => api.get("/shein-operations/audit-status"),
  })
  const syncMutation = useMutation({
    mutationFn: () => api.post("/shein-operations/audit-status/sync", {}),
    onSuccess: () => {
      toast.success("审核状态中心已同步")
      queryClient.invalidateQueries({ queryKey: ["shein-operations", "audit-status"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "同步审核状态失败"),
  })
  const handlingMutation = useMutation({
    mutationFn: ({ id, handledStatus }: { id: number; handledStatus: string }) =>
      api.patch(`/shein-operations/audit-status/${id}/handling`, { handledStatus }),
    onSuccess: () => {
      toast.success("处理状态已更新")
      queryClient.invalidateQueries({ queryKey: ["shein-operations", "audit-status"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "更新处理状态失败"),
  })

  const items = data?.items ?? []
  const summary = data?.summary

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="审核状态中心"
        description="跨发布任务、平台商品、生命周期操作聚合 SHEIN 审核状态；发布后的主操作仍回到发布任务列表处理。"
      >
        <Button asChild variant="outline">
          <Link to="/publish-tasks?statuses=REJECTED%2CPARTIALLY_APPROVED">
            <ExternalLink className="size-4" />
            发布任务
          </Link>
        </Button>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
          刷新
        </Button>
        <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          <CheckCircle2 className="size-4" />
          同步审核状态
        </Button>
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">总审核快照</div>
            <div className="mt-1 text-xl font-semibold">{formatNumber(summary?.total ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">待处理</div>
            <div className="mt-1 text-xl font-semibold">{formatNumber(summary?.open ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">审核驳回</div>
            <div className="mt-1 text-xl font-semibold">{formatNumber(summary?.rejected ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">平台商品</div>
            <div className="mt-1 text-xl font-semibold">{formatNumber(summary?.bySource?.PLATFORM_PRODUCT ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>来源分布</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            ["发布任务", summary?.bySource?.PUBLISH_TASK ?? 0],
            ["平台商品", summary?.bySource?.PLATFORM_PRODUCT ?? 0],
            ["生命周期操作", summary?.bySource?.LIFECYCLE_OPERATION ?? 0],
          ].map(([label, count]) => (
            <div key={label} className="rounded-md border px-3 py-2">
              <div className="text-sm font-medium">{label}</div>
              <div className="mt-1 text-lg font-semibold">{formatNumber(Number(count))}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>失败原因分组</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {summary?.failureReasonGroups?.length ? (
            summary.failureReasonGroups.map((group) => (
              <div key={group.reason} className="rounded-md border px-3 py-2">
                <div className="text-sm font-medium">{formatNumber(group.count)} 条</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{group.reason}</p>
              </div>
            ))
          ) : (
            <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
              暂无失败原因分组
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>审核明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>对象</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>失败原因</TableHead>
                  <TableHead>处理状态</TableHead>
                  <TableHead>同步时间</TableHead>
                  <TableHead className="text-right">跳转</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length ? (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-mono text-xs">{item.spuName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{item.skcName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{item.documentSn || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.sourceType}</Badge>
                        <div className="mt-1 text-xs text-muted-foreground">{item.sourceId || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.documentState === 3 || item.documentState === -1 ? "destructive" : "outline"}>
                          {item.documentStateLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[360px] text-xs text-muted-foreground">
                        {item.failureReasonText || "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.handledStatus}
                          onValueChange={(handledStatus) => handlingMutation.mutate({ id: item.id, handledStatus })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OPEN">OPEN</SelectItem>
                            <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                            <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                            <SelectItem value="IGNORED">IGNORED</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(item.lastSyncedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/shein-platform-products/${item.spuName}`}>
                            平台商品
                            <ExternalLink className="ml-1 size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      暂无审核状态快照；可从发布任务或平台商品详情同步审核状态。
                    </TableCell>
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
