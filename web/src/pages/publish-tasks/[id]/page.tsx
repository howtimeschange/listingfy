import { Link, useParams } from "react-router"
import { ArrowLeft, ExternalLink, FileJson, Send } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
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

interface PublishTaskDetail {
  task: {
    id: number
    listing_id: number
    publish_version_id: number | null
    platform: string
    task_type: string
    status: string
    attempt_count: number
    max_attempts: number
    request_payload_json: string
    response_payload_json: string
    request_payload: unknown
    response_payload: unknown
    platform_trace_id: string | null
    platform_version: string | null
    error_code: string | null
    error_message: string | null
    started_at: string | null
    finished_at: string | null
    created_at: string
    updated_at: string
    spu_code: string
    title: string | null
    listing_status: string
    validation_status: string
    platform_category_name: string | null
    platform_category_path: string | null
    account_name: string
    spu_name: string | null
    brand_name: string | null
    version_no: number | null
    version_status: string | null
    change_summary: string | null
    submitted_at: string | null
  }
  platform_identities: Array<{
    id: number
    local_type: string
    local_id: number
    platform_type: string
    platform_id: string
    platform_parent_id: string | null
    updated_at: string
  }>
  related_tasks: Array<{
    id: number
    status: string
    attempt_count: number
    platform_trace_id: string | null
    platform_version: string | null
    error_code: string | null
    error_message: string | null
    version_no: number | null
    created_at: string
    finished_at: string | null
  }>
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRM: "待确认",
  PUBLISHING: "发布中",
  PUBLISH_SUBMITTED: "已提交平台",
  PUBLISH_FAILED: "发布失败",
  SUBMITTED: "已提交",
  FAILED: "失败",
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

function statusClass(status: string) {
  if (status.includes("FAILED")) return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  if (status.includes("SUBMITTED")) return "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
  if (status.includes("PUBLISHING")) return "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
  return "border-[#e7dccd] bg-[#f7f2eb] text-[#7f684c]"
}

function prettyJson(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value || "{}"
    }
  }
  return JSON.stringify(value ?? {}, null, 2)
}

function usePublishTaskDetail(id: string | undefined) {
  return useQuery<PublishTaskDetail>({
    queryKey: ["publish-tasks", id],
    queryFn: () => api.get(`/publish-tasks/${id}`),
    enabled: Boolean(id),
  })
}

export default function PublishTaskDetailPage() {
  const { id } = useParams()
  const { data, isLoading } = usePublishTaskDetail(id)

  if (isLoading) {
    return <PageContainer><div className="py-16 text-center text-sm text-muted-foreground">加载发布任务...</div></PageContainer>
  }

  if (!data) {
    return <PageContainer><div className="py-16 text-center text-sm text-muted-foreground">发布任务不存在</div></PageContainer>
  }

  const { task } = data

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={`发布任务 #${task.id}`}
        description="查看本次平台提交的状态、版本、Trace ID、失败原因、请求 payload 和平台响应。"
      >
        <Button asChild variant="outline">
          <Link to="/publish-tasks">
            <ArrowLeft className="mr-2 size-4" />
            返回任务列表
          </Link>
        </Button>
        <Button asChild>
          <Link to={`/pre-publish-validation/${task.listing_id}`}>
            <ExternalLink className="mr-2 size-4" />
            打开发布草稿
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>任务概览</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded border p-4">
              <p className="text-xs text-muted-foreground">商品</p>
              <p className="mt-1 font-mono text-sm">{task.spu_code}</p>
              <p className="mt-2 text-sm">{task.title ?? task.spu_name ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{task.platform_category_path ?? task.platform_category_name ?? "未选择类目"}</p>
            </div>
            <div className="rounded border p-4">
              <p className="text-xs text-muted-foreground">任务状态</p>
              <Badge variant="outline" className={`mt-2 ${statusClass(task.status)}`}>
                {statusLabel(task.status)}
              </Badge>
              <p className="mt-3 text-sm text-muted-foreground">
                {task.platform} / {task.account_name} / 第 {formatNumber(task.attempt_count)} 次
              </p>
            </div>
            <div className="rounded border p-4">
              <p className="text-xs text-muted-foreground">平台回执</p>
              <p className="mt-2 text-sm">平台版本：{task.platform_version ?? "—"}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">Trace：{task.platform_trace_id ?? "—"}</p>
            </div>
            <div className="rounded border p-4">
              <p className="text-xs text-muted-foreground">版本与时间</p>
              <p className="mt-2 text-sm">草稿版本：v{task.version_no ?? "-"}</p>
              <p className="mt-1 text-xs text-muted-foreground">开始：{formatDateTime(task.started_at)}</p>
              <p className="mt-1 text-xs text-muted-foreground">完成：{formatDateTime(task.finished_at)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>失败定位</CardTitle>
          </CardHeader>
          <CardContent>
            {task.error_message ? (
              <div className="space-y-3">
                <Badge variant="outline" className="border-[#f1cccc] bg-[#fff1f1] text-[#d45656]">
                  {task.error_code ?? "ERROR"}
                </Badge>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{task.error_message}</p>
              </div>
            ) : (
              <div className="rounded border border-[#b9f4d8] bg-[#f2fff8] p-4 text-sm text-[#0fa76e]">
                当前任务没有失败信息。
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>平台身份回写</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>本地对象</TableHead>
                  <TableHead>平台对象</TableHead>
                  <TableHead>平台 ID</TableHead>
                  <TableHead>父级 ID</TableHead>
                  <TableHead>更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.platform_identities.length ? (
                  data.platform_identities.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.local_type} #{item.local_id}</TableCell>
                      <TableCell>{item.platform_type}</TableCell>
                      <TableCell className="font-mono text-xs">{item.platform_id}</TableCell>
                      <TableCell className="font-mono text-xs">{item.platform_parent_id ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(item.updated_at)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                      暂无平台身份回写
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
          <CardTitle>同款发布尝试</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>平台版本</TableHead>
                  <TableHead>错误</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.related_tasks.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link to={`/publish-tasks/${item.id}`} className="font-mono hover:text-[var(--brand-deep)] hover:underline">
                        #{item.id}
                      </Link>
                    </TableCell>
                    <TableCell>v{item.version_no ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass(item.status)}>
                        {statusLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.platform_version ?? "—"}</TableCell>
                    <TableCell className="max-w-[360px] truncate text-xs text-muted-foreground">
                      {item.error_message ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(item.finished_at ?? item.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="size-4" />
              请求 Payload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[560px] overflow-auto rounded border bg-muted/35 p-4 text-xs leading-5">
              {prettyJson(task.request_payload)}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="size-4" />
              平台响应
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[560px] overflow-auto rounded border bg-muted/35 p-4 text-xs leading-5">
              {prettyJson(task.response_payload)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
