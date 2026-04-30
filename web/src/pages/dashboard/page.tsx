import { useMemo } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileClock,
  GitBranch,
  PackageCheck,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

interface SyncBatch {
  id: number
  batch_no: string
  status: string
  started_at: string
  finished_at: string
  total_count: number
  success_count: number
  failed_count: number
}

interface MetadataSummary {
  latest_batch: SyncBatch | null
  counts: Record<string, number>
  roots: Array<{ root_category_name: string; leaf_count: number }>
}

interface SheinBucketItem {
  id: number
  spu_code: string
  bucket_status: string
  readiness_status: string
  category_status: string
  image_status: string
  platform_category_name: string | null
  title_cn: string | null
  spu_name: string | null
  brand_name: string | null
  deepdraw_title: string | null
  latest_listing_id: number | null
  updated_at: string
  raw_payload_json: string
}

interface SheinBucketResponse {
  items: SheinBucketItem[]
  summary: {
    total: number
    ready_count: number
    needs_work_count: number
    avg_completeness: number
    missing_field_count: number
    needs_ai_count: number
    drafted_count: number
  }
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

interface DraftItem {
  id: number
  platform: string
  spu_code: string
  publish_unit_no: string | null
  title: string | null
  spu_name: string | null
  brand_name: string | null
  platform_category_name: string | null
  status: string
  validation_status: string
  completeness: number
  latest_version_no: number | null
  blocker_count: number
  skc_count: number
  sku_count: number
  updated_at: string
}

interface DraftListResponse {
  items: DraftItem[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

interface PublishTask {
  id: number
  listing_id: number
  status: string
  platform_trace_id: string | null
  platform_version: string | null
  error_code: string | null
  error_message: string | null
  finished_at: string | null
  created_at: string
  spu_code: string
  title: string | null
  spu_name: string | null
  account_name: string
  version_no: number | null
}

interface PublishTasksResponse {
  items: PublishTask[]
  summary: {
    total: number
    by_status: Record<string, number>
  }
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

const BUCKET_STATUS_LABELS: Record<string, string> = {
  IN_BUCKET: "清洗中",
  DRAFTED: "已建草稿",
  PUBLISHED: "已发布",
  PAUSED: "暂停",
  READY: "就绪",
  NEEDS_REVIEW: "待复核",
  NEEDS_SKC_REVIEW: "按款色复核",
  NEEDS_ENRICHMENT: "待补齐",
  PENDING: "待处理",
  MISSING: "缺失",
  NEEDS_DETAIL: "缺细节图",
}

const DRAFT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  NEEDS_ENRICHMENT: "待补齐",
  READY_TO_VALIDATE: "待校验",
  VALIDATION_FAILED: "校验失败",
  READY_TO_PUBLISH: "可发布",
  PAUSED: "已暂停",
  ARCHIVED: "已归档",
  PUBLISHING: "发布中",
  PUBLISH_SUBMITTED: "已提交",
  PUBLISH_FAILED: "发布失败",
}

const VALIDATION_LABELS: Record<string, string> = {
  NOT_VALIDATED: "未校验",
  FAILED: "有阻断",
  PASSED: "已通过",
}

const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRM: "待确认",
  PUBLISHING: "发布中",
  PUBLISH_SUBMITTED: "已提交平台",
  PUBLISH_FAILED: "发布失败",
  SUBMITTED: "已提交",
  FAILED: "失败",
}

function useMetadataSummary() {
  return useQuery<MetadataSummary>({
    queryKey: ["metadata", "summary"],
    queryFn: () => api.get("/metadata/summary"),
  })
}

function useSheinBucketOverview() {
  return useQuery<SheinBucketResponse>({
    queryKey: ["dashboard", "shein-products"],
    queryFn: () => api.get("/shein-products?limit=5&offset=0"),
  })
}

function useDraftOverview() {
  return useQuery<DraftListResponse>({
    queryKey: ["dashboard", "pre-publish", "drafts"],
    queryFn: () => api.get("/pre-publish/drafts?platform=SHEIN&limit=6&offset=0"),
  })
}

function usePublishTaskOverview() {
  return useQuery<PublishTasksResponse>({
    queryKey: ["dashboard", "publish-tasks"],
    queryFn: () => api.get("/publish-tasks?platform=SHEIN&limit=6&offset=0"),
  })
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function clampPercent(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(numberValue(value))))
}

function labelFor(map: Record<string, string>, value: string) {
  return map[value] ?? value
}

function statusClass(status: string) {
  if (status.includes("FAILED") || status === "MISSING") {
    return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  }
  if (status.includes("SUBMITTED") || status === "PASSED" || status === "READY") {
    return "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
  }
  if (status.includes("PUBLISHING") || status.includes("PENDING") || status === "NEEDS_REVIEW") {
    return "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
  }
  if (status.includes("ENRICHMENT") || status.includes("VALIDATE") || status === "NEEDS_DETAIL") {
    return "border-[#e7dccd] bg-[#f7f2eb] text-[#7f684c]"
  }
  return "border-border bg-background text-foreground"
}

function fieldCompleteness(item: SheinBucketItem) {
  try {
    const parsed = JSON.parse(item.raw_payload_json || "{}") as {
      field_completeness?: {
        completeness?: number
        missing_field_count?: number
        needs_ai_count?: number
      }
    }
    return {
      completeness: clampPercent(parsed.field_completeness?.completeness),
      missing: numberValue(parsed.field_completeness?.missing_field_count),
      needsAi: numberValue(parsed.field_completeness?.needs_ai_count),
    }
  } catch {
    return { completeness: 0, missing: 0, needsAi: 0 }
  }
}

export default function DashboardPage() {
  const { data: metadata, isLoading: metadataLoading } = useMetadataSummary()
  const { data: bucketData, isLoading: bucketLoading } = useSheinBucketOverview()
  const { data: draftData, isLoading: draftLoading } = useDraftOverview()
  const { data: taskData, isLoading: taskLoading } = usePublishTaskOverview()

  const recentDrafts = draftData?.items ?? []
  const recentTasks = taskData?.items ?? []
  const recentProducts = bucketData?.items ?? []
  const taskStatus = taskData?.summary.by_status ?? {}
  const failedTasks = numberValue(taskStatus.PUBLISH_FAILED) + numberValue(taskStatus.FAILED)
  const publishingTasks = numberValue(taskStatus.PUBLISHING)
  const submittedTasks = numberValue(taskStatus.PUBLISH_SUBMITTED) + numberValue(taskStatus.SUBMITTED)
  const draftTotal = numberValue(draftData?.pagination.total)
  const draftAvgCompleteness = recentDrafts.length
    ? Math.round(recentDrafts.reduce((sum, item) => sum + numberValue(item.completeness), 0) / recentDrafts.length)
    : 0
  const draftBlockers = recentDrafts.reduce((sum, item) => sum + numberValue(item.blocker_count), 0)
  const readyDrafts = recentDrafts.filter((item) =>
    item.validation_status === "PASSED" || item.status === "READY_TO_PUBLISH",
  ).length
  const leafCategoryCount = metadata?.roots.reduce((sum, item) => sum + numberValue(item.leaf_count), 0) ?? 0
  const bucketSummary = bucketData?.summary
  const bucketCompleteness = clampPercent(bucketSummary?.avg_completeness)
  const isLoading = metadataLoading || bucketLoading || draftLoading || taskLoading

  const workstreams = useMemo(() => [
    {
      title: "商品分桶",
      description: "确认类目、图片、尺码、价格、毛重和 AI 待判断字段。",
      value: formatNumber(bucketSummary?.needs_work_count ?? 0),
      meta: `就绪 ${formatNumber(bucketSummary?.ready_count ?? 0)} / 完整度 ${bucketCompleteness}%`,
      icon: ShoppingBag,
      to: "/shein-products",
      action: "处理分桶",
    },
    {
      title: "发布草稿",
      description: "编辑商品字段、确认 SKC/SKU、保存版本并发起预检。",
      value: formatNumber(draftTotal),
      meta: `最近可发布 ${formatNumber(readyDrafts)} / 阻断 ${formatNumber(draftBlockers)}`,
      icon: ShieldCheck,
      to: "/pre-publish-validation",
      action: "打开草稿箱",
    },
    {
      title: "发布任务",
      description: "追踪提交状态、平台 Trace ID、失败原因和历史发布尝试。",
      value: formatNumber(taskData?.summary.total ?? 0),
      meta: `发布中 ${formatNumber(publishingTasks)} / 失败 ${formatNumber(failedTasks)}`,
      icon: Send,
      to: "/publish-tasks",
      action: "查看任务",
    },
  ], [
    bucketCompleteness,
    bucketSummary?.needs_work_count,
    bucketSummary?.ready_count,
    draftBlockers,
    draftTotal,
    failedTasks,
    publishingTasks,
    readyDrafts,
    taskData?.summary.total,
  ])

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="工作台"
        description="围绕 SHEIN 商品分桶、发布草稿箱和发布任务，集中查看待处理项、字段完整度、提交状态与平台元数据健康度。"
      >
        <Button asChild>
          <Link to="/shein-products">
            <ShoppingBag className="size-4" />
            SHEIN 商品分桶
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/pre-publish-validation">
            <ShieldCheck className="size-4" />
            发布草稿箱
          </Link>
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="SHEIN 分桶商品"
            value={formatNumber(bucketSummary?.total ?? bucketData?.pagination.total ?? 0)}
            icon={ShoppingBag}
            description={`已建草稿 ${formatNumber(bucketSummary?.drafted_count ?? 0)} 款`}
          />
          <StatCard
            title="待处理商品"
            value={formatNumber(bucketSummary?.needs_work_count ?? 0)}
            icon={AlertTriangle}
            description={`缺失字段 ${formatNumber(bucketSummary?.missing_field_count ?? 0)} / 需判断 ${formatNumber(bucketSummary?.needs_ai_count ?? 0)}`}
          />
          <StatCard
            title="发布草稿"
            value={formatNumber(draftTotal)}
            icon={FileClock}
            description={`最近平均完整度 ${draftAvgCompleteness}%`}
          />
          <StatCard
            title="发布任务"
            value={formatNumber(taskData?.summary.total ?? 0)}
            icon={Send}
            description={`已提交 ${formatNumber(submittedTasks)} / 失败 ${formatNumber(failedTasks)}`}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {workstreams.map((item) => (
          <WorkstreamCard key={item.title} {...item} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
        <Card>
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>待处理焦点</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  按当前工作流优先级聚合：先清洗分桶，再完善草稿，最后追踪发布回执。
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/product-archives">
                  <PackageCheck className="size-4" />
                  商品档案
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <FocusMetric
                label="字段完整度"
                value={`${bucketCompleteness}%`}
                description={`SHEIN 分桶平均值`}
                icon={Sparkles}
                progress={bucketCompleteness}
              />
              <FocusMetric
                label="最近草稿完整度"
                value={`${draftAvgCompleteness}%`}
                description={`最近 ${formatNumber(recentDrafts.length)} 个草稿`}
                icon={ShieldCheck}
                progress={draftAvgCompleteness}
              />
              <FocusMetric
                label="发布异常"
                value={formatNumber(failedTasks)}
                description={failedTasks ? "需要回到草稿修正" : "暂无失败任务"}
                icon={failedTasks ? AlertTriangle : CheckCircle2}
                tone={failedTasks ? "danger" : "success"}
              />
            </div>

            <div className="space-y-3">
              {recentProducts.length ? (
                recentProducts.map((item) => (
                  <ProductQueueRow key={item.id} item={item} />
                ))
              ) : (
                <EmptyQueue
                  icon={ShoppingBag}
                  title="暂无分桶商品"
                  description="从商品档案勾选商品加入 SHEIN 商品分桶后，这里会显示最新待处理项。"
                  to="/product-archives"
                  action="去商品档案"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>平台元数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand-deep)]">
                  <Database className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">最后同步</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {metadata?.latest_batch
                      ? `${formatDateTime(metadata.latest_batch.finished_at)} · ${metadata.latest_batch.status}`
                      : "暂无同步记录"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <MiniMetric label="叶子类目" value={formatNumber(leafCategoryCount)} />
                <MiniMetric label="属性模板" value={formatNumber(metadata?.counts.channel_attribute_template ?? 0)} />
                <MiniMetric label="枚举值" value={formatNumber(metadata?.counts.channel_attribute_value ?? 0)} />
              </div>
            </div>

            <div className="space-y-2">
              {(metadata?.roots ?? []).slice(0, 6).map((root) => (
                <div key={root.root_category_name} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <span className="truncate text-sm">{root.root_category_name}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatNumber(root.leaf_count)}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <QuickAction icon={Database} title="浏览元数据" to="/shein-metadata" />
              <QuickAction icon={GitBranch} title="维护类目映射" to="/category-mapping" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>最近发布草稿</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/pre-publish-validation">
                全部草稿
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {recentDrafts.length ? (
                recentDrafts.map((draft) => <DraftRow key={draft.id} draft={draft} />)
              ) : (
                <EmptyQueue
                  icon={FileClock}
                  title="暂无发布草稿"
                  description="在 SHEIN 商品分桶勾选商品后，可以批量创建发布草稿。"
                  to="/shein-products"
                  action="去创建草稿"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>最近发布任务</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/publish-tasks">
                全部任务
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {recentTasks.length ? (
                recentTasks.map((task) => <TaskRow key={task.id} task={task} />)
              ) : (
                <EmptyQueue
                  icon={Send}
                  title="暂无发布任务"
                  description="草稿完成预检并提交平台后，任务回执会出现在这里。"
                  to="/pre-publish-validation"
                  action="去草稿箱"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}

function WorkstreamCard({
  title,
  description,
  value,
  meta,
  icon: Icon,
  to,
  action,
}: {
  title: string
  description: string
  value: string
  meta: string
  icon: LucideIcon
  to: string
  action: string
}) {
  return (
    <Card className="group">
      <CardContent className="px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand-deep)]">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="mt-1 text-3xl font-semibold leading-none tracking-[-0.24px] tabular-nums">{value}</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="icon-sm" className="shrink-0 group-hover:bg-accent/50">
            <Link to={to} aria-label={action}>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-sm leading-5 text-muted-foreground">{description}</p>
        <p className="mt-3 text-xs font-medium text-foreground">{meta}</p>
      </CardContent>
    </Card>
  )
}

function FocusMetric({
  label,
  value,
  description,
  icon: Icon,
  progress,
  tone = "default",
}: {
  label: string
  value: string
  description: string
  icon: LucideIcon
  progress?: number
  tone?: "default" | "success" | "danger"
}) {
  const toneClass = tone === "danger"
    ? "text-[#d45656]"
    : tone === "success"
      ? "text-[#0fa76e]"
      : "text-[var(--brand-deep)]"

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${toneClass}`} />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {progress == null ? null : <Progress value={clampPercent(progress)} className="mt-3" />}
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function ProductQueueRow({ item }: { item: SheinBucketItem }) {
  const completeness = fieldCompleteness(item)
  return (
    <div className="flex flex-col gap-3 rounded-lg border px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/product-archives/${item.spu_code}`} className="font-mono text-sm font-medium hover:text-[var(--brand-deep)] hover:underline">
            {item.spu_code}
          </Link>
          <Badge variant="outline" className={statusClass(item.readiness_status)}>
            {labelFor(BUCKET_STATUS_LABELS, item.readiness_status)}
          </Badge>
          <Badge variant="outline">{labelFor(BUCKET_STATUS_LABELS, item.image_status)}</Badge>
        </div>
        <p className="mt-1 max-w-[720px] truncate text-sm text-muted-foreground">
          {item.title_cn ?? item.spu_name ?? item.deepdraw_title ?? "商品标题待补齐"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.platform_category_name ?? "未匹配 SHEIN 类目"} · {formatDateTime(item.updated_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="w-28">
          <Progress value={completeness.completeness} />
          <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{completeness.completeness}%</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={item.latest_listing_id ? `/pre-publish-validation/${item.latest_listing_id}` : "/shein-products"}>
            {item.latest_listing_id ? "打开草稿" : "处理"}
          </Link>
        </Button>
      </div>
    </div>
  )
}

function DraftRow({ draft }: { draft: DraftItem }) {
  return (
    <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/pre-publish-validation/${draft.id}`} className="font-mono text-sm font-medium hover:text-[var(--brand-deep)] hover:underline">
            {draft.spu_code}
          </Link>
          <Badge variant="outline">草稿 #{draft.id}</Badge>
          <Badge variant="outline" className={statusClass(draft.status)}>
            {labelFor(DRAFT_STATUS_LABELS, draft.status)}
          </Badge>
          <Badge variant="outline" className={statusClass(draft.validation_status)}>
            {labelFor(VALIDATION_LABELS, draft.validation_status)}
          </Badge>
        </div>
        <p className="mt-1 max-w-[520px] truncate text-sm text-muted-foreground">
          {draft.title ?? draft.spu_name ?? "商品标题待补齐"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {draft.platform_category_name ?? "未选择类目"} · v{draft.latest_version_no ?? 0} · {formatDateTime(draft.updated_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="w-28">
          <Progress value={clampPercent(draft.completeness)} />
          <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{clampPercent(draft.completeness)}%</p>
        </div>
        {draft.blocker_count > 0 ? (
          <Badge variant="destructive">{formatNumber(draft.blocker_count)} 阻断</Badge>
        ) : (
          <Badge variant="outline" className="border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]">
            可推进
          </Badge>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: PublishTask }) {
  return (
    <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/publish-tasks/${task.id}`} className="font-mono text-sm font-medium hover:text-[var(--brand-deep)] hover:underline">
            #{task.id}
          </Link>
          <Badge variant="outline" className={statusClass(task.status)}>
            {labelFor(TASK_STATUS_LABELS, task.status)}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">{task.spu_code}</span>
        </div>
        <p className="mt-1 max-w-[520px] truncate text-sm text-muted-foreground">
          {task.title ?? task.spu_name ?? "商品标题待补齐"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          v{task.version_no ?? 0} · {task.platform_version ?? "平台版本待回写"} · {formatDateTime(task.finished_at ?? task.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {task.error_message ? (
          <Badge variant="outline" className="border-[#f1cccc] bg-[#fff1f1] text-[#d45656]">
            {task.error_code ?? "ERROR"}
          </Badge>
        ) : (
          <Badge variant="outline">{task.platform_trace_id ?? "Trace 待回写"}</Badge>
        )}
        <Button asChild variant="ghost" size="icon-sm">
          <Link to={`/publish-tasks/${task.id}`} aria-label={`查看发布任务 ${task.id}`}>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium tabular-nums">{value}</p>
    </div>
  )
}

function QuickAction({ icon: Icon, title, to }: { icon: LucideIcon; title: string; to: string }) {
  return (
    <Button asChild variant="outline" className="justify-between">
      <Link to={to}>
        <span className="inline-flex items-center gap-2">
          <Icon className="size-4" />
          {title}
        </span>
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  )
}

function EmptyQueue({
  icon: Icon,
  title,
  description,
  to,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  to: string
  action: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link to={to}>{action}</Link>
      </Button>
    </div>
  )
}
