import { Link, useParams } from "react-router"
import { ArrowLeft, ArrowRight, CheckCircle2, ListChecks, RefreshCw, RotateCcw, Send, ShieldAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { type BatchPublishSummary, parseBatchPublishSummary } from "@/lib/publish-summary"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { BatchPublishDialog } from "@/components/pre-publish/batch-publish-dialog"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
    last_status_synced_at: string | null
    publish_status_summary_json: string | null
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

interface BatchPublishSummaryResponse {
  ok: boolean
  summary: BatchPublishSummary
}

interface BatchPublishActionResponse {
  ok: boolean
  created_count?: number
  existing_count?: number
  skipped_count?: number
  polled_count?: number
  failed_count?: number
  summary: BatchPublishSummary
  skipped?: Array<{
    listing_id?: number
    task_id?: number
    spu_code?: string
    title?: string | null
    reason: string
  }>
}

function useBatchDetail(id: string | undefined) {
  return useQuery<BatchDetail>({
    queryKey: ["listing-batches", id],
    queryFn: () => api.get(`/listing-batches/${encodeURIComponent(id ?? "")}`),
    enabled: Boolean(id),
  })
}

function useBatchPublishSummary(id: string | undefined) {
  return useQuery<BatchPublishSummaryResponse>({
    queryKey: ["listing-batches", id, "publish-summary"],
    queryFn: () => api.get(`/listing-batches/${encodeURIComponent(id ?? "")}/publish-summary`),
    enabled: Boolean(id),
  })
}

function statusClass(status: string) {
  if (["PUBLISH_FAILED", "REJECTED", "FAILED"].includes(status)) return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  if (status === "APPROVED") return "border-[#b9f4d8] bg-[#f4fff9] text-[#0f8a5f]"
  if (["PUBLISHING", "PUBLISH_SUBMITTED", "UNDER_REVIEW"].includes(status)) return "border-[#ead7ff] bg-[#f7f0ff] text-[#7c3ec5]"
  return "border-[#e7dccd] bg-[#f7f2eb] text-[#7f684c]"
}

function taskStatusCount(summary: BatchPublishSummary, ...statuses: string[]) {
  return statuses.reduce((sum, status) => sum + Number(summary.by_task_status?.[status] ?? 0), 0)
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "body" in error) {
    const body = (error as { body?: { message?: unknown } }).body
    const message = typeof body?.message === "string" ? body.message : ""
    if (message) return message
  }
  return error instanceof Error ? error.message : fallback
}

export default function BatchDetailPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(new Set())
  const { data, isLoading } = useBatchDetail(id)
  const { data: publishSummaryData, isFetching: isSummaryFetching } = useBatchPublishSummary(id)
  const draftRows = data?.drafts ?? []
  const allDraftIds = draftRows.map((draft) => draft.id)
  const selectedDraftIdList = allDraftIds.filter((draftId) => selectedDraftIds.has(draftId))
  const allDraftsSelected = draftRows.length > 0 && draftRows.every((draft) => selectedDraftIds.has(draft.id))
  const storedSummary = useMemo(
    () => parseBatchPublishSummary(data?.batch.publish_status_summary_json, data?.batch.batch_no ?? id ?? ""),
    [data?.batch.batch_no, data?.batch.publish_status_summary_json, id],
  )
  const invalidateBatchQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["listing-batches"] })
    queryClient.invalidateQueries({ queryKey: ["publish-tasks"] })
    queryClient.invalidateQueries({ queryKey: ["pre-publish"] })
  }
  const syncStatusMutation = useMutation({
    mutationFn: () => api.post<BatchPublishActionResponse>(`/listing-batches/${encodeURIComponent(id ?? "")}/sync-status`, {
      limit: 30,
    }),
    onSuccess: (result) => {
      toast.success(`已轮询 ${formatNumber(result.polled_count ?? 0)} 个任务，失败 ${formatNumber(result.failed_count ?? 0)} 个`)
      invalidateBatchQueries()
    },
    onError: (error) => toast.error(errorMessage(error, "轮询审核状态失败")),
  })
  const retryFailedMutation = useMutation({
    mutationFn: () => api.post<BatchPublishActionResponse>(`/listing-batches/${encodeURIComponent(id ?? "")}/retry-failed`, {
      retryable_only: true,
    }),
    onSuccess: (result) => {
      toast.success(`已生成 ${formatNumber(result.created_count ?? 0)} 个重试任务，复用 ${formatNumber(result.existing_count ?? 0)} 个，跳过 ${formatNumber(result.skipped_count ?? 0)} 个`)
      invalidateBatchQueries()
    },
    onError: (error) => toast.error(errorMessage(error, "批量重试失败")),
  })

  function toggleDraft(id: number) {
    setSelectedDraftIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllDrafts(checked: boolean) {
    setSelectedDraftIds((current) => {
      const next = new Set(current)
      for (const draft of draftRows) {
        if (checked) next.add(draft.id)
        else next.delete(draft.id)
      }
      return next
    })
  }

  if (isLoading) {
    return <PageContainer><div className="py-16 text-center text-sm text-muted-foreground">加载批次详情...</div></PageContainer>
  }

  if (!data) {
    return <PageContainer><div className="py-16 text-center text-sm text-muted-foreground">批次不存在</div></PageContainer>
  }

  const { batch } = data
  const draftIds = data.drafts.map((draft) => draft.id).join(",")
  const publishSummary = publishSummaryData?.summary ?? storedSummary
  const pendingTasks = taskStatusCount(publishSummary, "PENDING_CONFIRM")
  const activeTasks = taskStatusCount(publishSummary, "PUBLISHING", "PUBLISH_SUBMITTED", "UNDER_REVIEW", "PARTIALLY_APPROVED")
  const failedTasks = taskStatusCount(publishSummary, "PUBLISH_FAILED", "FAILED", "REJECTED")
  const approvedTasks = taskStatusCount(publishSummary, "APPROVED")
  const isActionPending = syncStatusMutation.isPending || retryFailedMutation.isPending
  const publishButtonsDisabled = draftRows.length === 0

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
        <Button
          variant="outline"
          onClick={() => syncStatusMutation.mutate()}
          disabled={isActionPending || activeTasks === 0}
        >
          <RefreshCw className={syncStatusMutation.isPending ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />
          轮询审核状态
        </Button>
        <Button
          variant="outline"
          onClick={() => retryFailedMutation.mutate()}
          disabled={isActionPending || Number(publishSummary.retryable_failed_tasks ?? 0) === 0}
        >
          <RotateCcw className="mr-2 size-4" />
          批量重试失败
        </Button>
        <Button asChild>
          <Link to={`/publish-tasks?batch_search=${encodeURIComponent(batch.batch_no)}`}>
            <ArrowRight className="mr-2 size-4" />
            发布任务中心
          </Link>
        </Button>
        <Button asChild variant="outline">
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
        <CardHeader className="gap-2">
          <CardTitle>批次发布任务</CardTitle>
          <p className="text-sm text-muted-foreground">
            任务 {formatNumber(publishSummary.total_tasks)}
            {" / "}待提交 {formatNumber(pendingTasks)}
            {" / "}进行中 {formatNumber(activeTasks)}
            {" / "}通过 {formatNumber(approvedTasks)}
            {" / "}失败 {formatNumber(failedTasks)}
            {" / "}最近轮询 {formatDateTime(batch.last_status_synced_at)}
            {isSummaryFetching ? " / 正在刷新" : ""}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatCard title="发布任务总数" value={formatNumber(publishSummary.total_tasks)} icon={ListChecks} />
            <StatCard title="可批量重试" value={formatNumber(publishSummary.retryable_failed_tasks)} icon={RotateCcw} />
          </div>
          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <div className="font-medium">失败原因聚合</div>
              <p className="text-sm text-muted-foreground">按平台错误类别和稳定指纹归并，方便批量修正和重试。</p>
            </div>
            <div className="divide-y">
              {publishSummary.failure_groups.length ? (
                publishSummary.failure_groups.slice(0, 5).map((group) => (
                  <div key={`${group.category}-${group.fingerprint}`} className="grid gap-2 p-4 md:grid-cols-[160px_1fr_auto] md:items-start">
                    <div>
                      <Badge variant="outline" className="border-[#f1cccc] bg-[#fff1f1] text-[#d45656]">
                        {group.category}
                      </Badge>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {formatNumber(group.count)} 次 / 可重试 {formatNumber(group.retryable_count)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs text-muted-foreground">{group.fingerprint}</div>
                      <p className="mt-1 line-clamp-2 text-sm">{group.sample_error_message ?? "平台未返回详细原因"}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(group.last_seen_at)}</div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-sm text-muted-foreground">暂无失败原因</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>批次草稿</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                共 {formatNumber(draftRows.length)} 个草稿 / 已勾选 {formatNumber(selectedDraftIdList.length)} 个
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <BatchPublishDialog
                listingIds={allDraftIds}
                triggerLabel="整批提交发布"
                emptyMessage="当前批次暂无可提交的草稿"
                disabled={publishButtonsDisabled}
                selectionLabel="本批草稿"
                onAfterChange={() => invalidateBatchQueries()}
              />
              <BatchPublishDialog
                listingIds={selectedDraftIdList}
                triggerLabel="提交已选草稿"
                emptyMessage="请先勾选要提交的草稿"
                disabled={selectedDraftIdList.length === 0}
                variant="outline"
                selectionLabel="已选草稿"
                onAfterChange={() => invalidateBatchQueries()}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded border bg-muted/25 p-3 text-sm text-muted-foreground">
            批次页直接复用 SHEIN 发布草稿箱的预检、快速修正和逐草稿提交逻辑；需要更细的类目、图片、尺码编辑时再打开草稿详情。草稿 ID：{draftIds || "-"}
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allDraftsSelected}
                      onCheckedChange={(checked) => toggleAllDrafts(Boolean(checked))}
                      aria-label="全选本批次草稿"
                    />
                  </TableHead>
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
                {draftRows.length ? (
                  draftRows.map((draft) => (
                    <TableRow key={draft.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedDraftIds.has(draft.id)}
                          onCheckedChange={() => toggleDraft(draft.id)}
                          aria-label={`选择 ${draft.spu_code}`}
                        />
                      </TableCell>
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
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">批次内暂无草稿</TableCell>
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
