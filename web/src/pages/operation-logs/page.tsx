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

interface OperationLogItem {
  id: number
  actor_username: string | null
  action: string
  module: string
  entity_type: string | null
  entity_id: string | null
  summary: string
  ip_address: string | null
  created_at: string
}

export default function OperationLogsPage() {
  const { data, isLoading } = useQuery<{ items: OperationLogItem[] }>({
    queryKey: ["system", "operation-logs"],
    queryFn: () => api.get("/system/operation-logs?limit=100&offset=0"),
  })
  const items = data?.items ?? []

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="操作日志"
        description="追踪登录、平台配置、用户管理、同步和发布等关键动作，保留可审计链路。"
      />
      <Card>
        <CardHeader>
          <CardTitle>审计记录</CardTitle>
          <p className="text-sm text-muted-foreground">记录 {formatNumber(items.length)}</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>模块</TableHead>
                  <TableHead>动作</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>对象</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      加载操作日志...
                    </TableCell>
                  </TableRow>
                ) : items.length ? items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(item.created_at)}</TableCell>
                    <TableCell>{item.actor_username ?? "系统"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.module}</Badge>
                    </TableCell>
                    <TableCell>{item.action}</TableCell>
                    <TableCell className="max-w-[520px] truncate">{item.summary}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.entity_type ? `${item.entity_type} #${item.entity_id ?? "-"}` : "—"}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      暂无操作日志
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
