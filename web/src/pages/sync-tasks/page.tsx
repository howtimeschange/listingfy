import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface SyncTaskItem {
  task_source: string
  id: number
  platform: string
  task_name: string
  task_no: string
  status: string
  started_at: string | null
  finished_at: string | null
  total_count: number
  success_count: number
  failed_count: number
  error_message: string | null
  created_at: string
}

export default function SyncTasksPage() {
  const { data, isLoading } = useQuery<{ items: SyncTaskItem[] }>({
    queryKey: ["system", "sync-tasks"],
    queryFn: () => api.get("/system/sync-tasks?limit=100&offset=0"),
  })
  const items = data?.items ?? []

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="同步任务"
        description="集中查看 MDM、深绘、平台元数据同步和发布任务的执行状态、耗时与失败原因。"
      />
      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
          <p className="text-sm text-muted-foreground">任务 {formatNumber(items.length)}</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>错误</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      加载同步任务...
                    </TableCell>
                  </TableRow>
                ) : items.length ? items.map((item) => (
                  <TableRow key={`${item.task_source}-${item.id}`}>
                    <TableCell>
                      <div className="font-medium">{item.task_name}</div>
                      <div className="text-xs text-muted-foreground">{item.task_source} / {item.task_no}</div>
                    </TableCell>
                    <TableCell>{item.platform}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      总数 {formatNumber(item.total_count)} / 成功 {formatNumber(item.success_count)} / 失败 {formatNumber(item.failed_count)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>开始：{formatDateTime(item.started_at)}</div>
                      <div>完成：{formatDateTime(item.finished_at)}</div>
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate text-sm text-muted-foreground">
                      {item.error_message ?? "—"}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      暂无同步任务
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
