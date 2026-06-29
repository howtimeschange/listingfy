import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileClock,
  GitBranch,
  PackageSearch,
  PenLine,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
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

interface ProductArchiveDraftItem {
  id: number
  draft_no: string
  spu_code: string
  title: string | null
  tenant_name: string
  merchant_id: string
  trade_path: string | null
  status: string
  blocker_count: number
  warning_count: number
  sku_count: number
  created_product_id: string | null
  updated_at: string
}

interface ProductArchiveDraftListResponse {
  items: ProductArchiveDraftItem[]
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

const ARCHIVE_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  missing_fields: "缺字段",
  manual_review: "待人工判断",
  ready: "可创建",
  duplicate_found: "已存在",
  update_pending: "待更新策略",
  submitting: "创建中",
  created: "已创建",
  readback_verified: "回读通过",
  readback_mismatch: "回读不一致",
  failed: "失败",
}

function useMetadataSummary(enabled = true) {
  return useQuery<MetadataSummary>({
    queryKey: ["metadata", "summary"],
    queryFn: () => api.get("/metadata/summary"),
    enabled,
  })
}

function useSheinBucketOverview(enabled = true) {
  return useQuery<SheinBucketResponse>({
    queryKey: ["dashboard", "shein-products"],
    queryFn: () => api.get("/shein-products?limit=5&offset=0"),
    enabled,
  })
}

function useDraftOverview(enabled = true) {
  return useQuery<DraftListResponse>({
    queryKey: ["dashboard", "pre-publish", "drafts"],
    queryFn: () => api.get("/pre-publish/drafts?platform=SHEIN&limit=6&offset=0"),
    enabled,
  })
}

function usePublishTaskOverview(enabled = true) {
  return useQuery<PublishTasksResponse>({
    queryKey: ["dashboard", "publish-tasks"],
    queryFn: () => api.get("/publish-tasks?platform=SHEIN&limit=6&offset=0"),
    enabled,
  })
}

function useProductArchiveDraftOverview(enabled = true) {
  return useQuery<ProductArchiveDraftListResponse>({
    queryKey: ["dashboard", "product-archive-drafts"],
    queryFn: () => api.get("/product-archive-drafts?limit=6&offset=0"),
    enabled,
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
  const normalized = status.toUpperCase()
  if (normalized.includes("FAILED") || status === "MISSING" || status === "failed" || status === "duplicate_found") {
    return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  }
  if (
    normalized.includes("SUBMITTED")
    || status === "PASSED"
    || status === "READY"
    || status === "ready"
    || status === "created"
    || status === "readback_verified"
  ) {
    return "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
  }
  if (normalized.includes("PUBLISHING") || normalized.includes("PENDING") || status === "NEEDS_REVIEW" || status === "submitting") {
    return "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
  }
  if (
    normalized.includes("ENRICHMENT")
    || normalized.includes("VALIDATE")
    || status === "NEEDS_DETAIL"
    || status === "missing_fields"
    || status === "manual_review"
    || status === "readback_mismatch"
  ) {
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
  const { hasPermission } = useAuth()
  const canUseDeepdraw = hasPermission("PRODUCT_ARCHIVE_DRAFT_READ")
  const canUseShein = hasPermission("LISTING_READ")
  const deepdrawQueryGate = { enabled: canUseDeepdraw }
  const sheinQueryGate = { enabled: canUseShein }
  const { data: metadata, isLoading: metadataLoading } = useMetadataSummary(sheinQueryGate.enabled)
  const { data: bucketData, isLoading: bucketLoading } = useSheinBucketOverview(sheinQueryGate.enabled)
  const { data: draftData, isLoading: draftLoading } = useDraftOverview(sheinQueryGate.enabled)
  const { data: taskData, isLoading: taskLoading } = usePublishTaskOverview(sheinQueryGate.enabled)
  const { data: archiveDraftData, isLoading: archiveDraftLoading } = useProductArchiveDraftOverview(deepdrawQueryGate.enabled)

  const recentDrafts = draftData?.items ?? []
  const recentTasks = taskData?.items ?? []
  const recentProducts = bucketData?.items ?? []
  const recentArchiveDrafts = archiveDraftData?.items ?? []
  const taskStatus = taskData?.summary.by_status ?? {}
  const failedTasks = numberValue(taskStatus.PUBLISH_FAILED) + numberValue(taskStatus.FAILED)
  const publishingTasks = numberValue(taskStatus.PUBLISHING)
  const submittedTasks = numberValue(taskStatus.PUBLISH_SUBMITTED) + numberValue(taskStatus.SUBMITTED)
  const draftTotal = numberValue(draftData?.pagination.total)
  const archiveDraftTotal = numberValue(archiveDraftData?.pagination.total)
  const archiveReadyDrafts = recentArchiveDrafts.filter((item) =>
    ["ready", "created", "readback_verified"].includes(item.status),
  ).length
  const archiveNeedsWork = recentArchiveDrafts.filter((item) =>
    ["draft", "missing_fields", "manual_review", "update_pending"].includes(item.status),
  ).length
  const archiveBlockers = recentArchiveDrafts.reduce((sum, item) => sum + numberValue(item.blocker_count), 0)
  const archiveWarnings = recentArchiveDrafts.reduce((sum, item) => sum + numberValue(item.warning_count), 0)
  const draftAvgCompleteness = recentDrafts.length
    ? Math.round(recentDrafts.reduce((sum, item) => sum + numberValue(item.completeness), 0) / recentDrafts.length)
    : 0
  const leafCategoryCount = metadata?.roots.reduce((sum, item) => sum + numberValue(item.leaf_count), 0) ?? 0
  const bucketSummary = bucketData?.summary
  const bucketCompleteness = clampPercent(bucketSummary?.avg_completeness)
  const isLoading =
    (canUseDeepdraw && archiveDraftLoading)
    || (canUseShein && (metadataLoading || bucketLoading || draftLoading || taskLoading))

  const workstreams: Array<{
    title: string
    description: string
    value: string
    meta: string
    icon: LucideIcon
    to: string
    action: string
  }> = []

  if (canUseDeepdraw) {
    workstreams.push(
      {
        title: "深绘建档",
        description: "从标准文案表、上市计划和 MDM 数据生成深绘商品建档草稿。",
        value: formatNumber(archiveDraftTotal),
        meta: `可创建 ${formatNumber(archiveReadyDrafts)} / 阻断 ${formatNumber(archiveBlockers)}`,
        icon: PenLine,
        to: "/product-archive-drafts",
        action: "打开深绘建档草稿",
      },
      {
        title: "上市计划表",
        description: "维护建档前置的上市计划明细，用于匹配类目、上市时间和商品基础字段。",
        value: formatNumber(archiveNeedsWork),
        meta: `最近草稿 ${formatNumber(recentArchiveDrafts.length)} / 警告 ${formatNumber(archiveWarnings)}`,
        icon: FileSpreadsheet,
        to: "/listing-launch-plans",
        action: "查看上市计划表",
      },
    )
  }

  if (canUseShein) {
    workstreams.push(
      {
        title: "SHEIN 上新运营",
        description: "确认类目、图片、尺码、价格、毛重和 AI 待判断字段，推进发布草稿。",
        value: formatNumber(bucketSummary?.needs_work_count ?? 0),
        meta: `就绪 ${formatNumber(bucketSummary?.ready_count ?? 0)} / 完整度 ${bucketCompleteness}%`,
        icon: ShoppingBag,
        to: "/shein-products",
        action: "处理 SHEIN 分桶",
      },
      {
        title: "SHEIN 平台商品运营",
        description: "追踪平台商品、销售站点、供货价、审核状态和最近操作。",
        value: formatNumber(taskData?.summary.total ?? 0),
        meta: `发布中 ${formatNumber(publishingTasks)} / 失败 ${formatNumber(failedTasks)}`,
        icon: PackageSearch,
        to: "/shein-platform-products",
        action: "查看平台商品",
      },
    )
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="全链路运营驾驶舱"
        description="按角色聚合深绘建档、SHEIN 上新运营和平台商品运营。每个角色只看到自己能处理的链路入口、待办和风险。"
      >
        {canUseDeepdraw ? (
          <Button asChild>
            <Link to="/product-archive-drafts">
              <PenLine className="size-4" />
              深绘建档
            </Link>
          </Button>
        ) : null}
        {canUseShein ? (
          <Button asChild variant={canUseDeepdraw ? "outline" : "default"}>
            <Link to="/shein-platform-products">
              <PackageSearch className="size-4" />
              SHEIN 平台商品
            </Link>
          </Button>
        ) : null}
      </PageHeader>

      {!canUseDeepdraw && !canUseShein ? (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <ShieldCheck className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">当前账号暂无运营链路权限</p>
              <p className="mt-1 text-sm text-muted-foreground">请联系管理员分配深绘建档运营、SHEIN 运营或只读角色。</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {canUseDeepdraw ? (
            <>
              <StatCard
                title="深绘建档草稿"
                value={formatNumber(archiveDraftTotal)}
                icon={PenLine}
                description={`最近可创建 ${formatNumber(archiveReadyDrafts)} 个`}
              />
              <StatCard
                title="深绘待补齐"
                value={formatNumber(archiveNeedsWork)}
                icon={AlertTriangle}
                description={`阻断 ${formatNumber(archiveBlockers)} / 警告 ${formatNumber(archiveWarnings)}`}
              />
            </>
          ) : null}
          {canUseShein ? (
            <>
              <StatCard
                title="SHEIN 分桶商品"
                value={formatNumber(bucketSummary?.total ?? bucketData?.pagination.total ?? 0)}
                icon={ShoppingBag}
                description={`已建草稿 ${formatNumber(bucketSummary?.drafted_count ?? 0)} 款`}
              />
              <StatCard
                title="SHEIN 待处理"
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
            </>
          ) : null}
        </div>
      )}

      {workstreams.length ? (
        <div className="grid gap-4 xl:grid-cols-4">
          {workstreams.map((item) => (
            <WorkstreamCard key={item.title} {...item} />
          ))}
        </div>
      ) : null}

      {canUseDeepdraw ? (
        <Card>
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>深绘建档焦点</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  先补齐建档字段和类目，再校验、查重并提交到深绘。
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/product-archive-drafts">
                  <PenLine className="size-4" />
                  全部建档草稿
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <FocusMetric
                label="草稿总数"
                value={formatNumber(archiveDraftTotal)}
                description={`最近 ${formatNumber(recentArchiveDrafts.length)} 个建档草稿`}
                icon={PenLine}
              />
              <FocusMetric
                label="可创建"
                value={formatNumber(archiveReadyDrafts)}
                description="可进入提交或回读验证"
                icon={CheckCircle2}
                tone="success"
              />
              <FocusMetric
                label="字段阻断"
                value={formatNumber(archiveBlockers)}
                description={archiveBlockers ? "需要补齐字段或类目" : "暂无阻断字段"}
                icon={archiveBlockers ? AlertTriangle : CheckCircle2}
                tone={archiveBlockers ? "danger" : "success"}
              />
            </div>

            <div className="divide-y">
              {recentArchiveDrafts.length ? (
                recentArchiveDrafts.map((draft) => <ArchiveDraftRow key={draft.id} draft={draft} />)
              ) : (
                <EmptyQueue
                  icon={PenLine}
                  title="暂无深绘建档草稿"
                  description="导入标准文案表和上市计划表后，这里会显示待补齐、待校验和可创建的草稿。"
                  to="/product-archive-drafts"
                  action="开始建档"
                />
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <QuickAction icon={FileSpreadsheet} title="上市计划表" to="/listing-launch-plans" />
              <QuickAction icon={GitBranch} title="字段对应关系" to="/deepdraw-field-mappings" />
              <QuickAction icon={Database} title="深绘类目字段" to="/deepdraw-metadata" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canUseShein ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
            <Card>
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>SHEIN 上新运营焦点</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  按当前工作流优先级聚合：先清洗分桶，再完善草稿，最后追踪发布回执。
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/shein-platform-products">
                  <PackageSearch className="size-4" />
                  平台商品列表
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
            <CardTitle>SHEIN 平台元数据</CardTitle>
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
              <QuickAction icon={GitBranch} title="维护 SHEIN 类目映射" to="/category-mapping" />
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
        </>
      ) : null}
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

function ArchiveDraftRow({ draft }: { draft: ProductArchiveDraftItem }) {
  return (
    <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/product-archive-drafts/${draft.id}`} className="font-mono text-sm font-medium hover:text-[var(--brand-deep)] hover:underline">
            {draft.spu_code}
          </Link>
          <Badge variant="outline">{draft.draft_no}</Badge>
          <Badge variant="outline" className={statusClass(draft.status)}>
            {labelFor(ARCHIVE_STATUS_LABELS, draft.status)}
          </Badge>
          {draft.created_product_id ? <Badge variant="outline">深绘 ID {draft.created_product_id}</Badge> : null}
        </div>
        <p className="mt-1 max-w-[720px] truncate text-sm text-muted-foreground">
          {draft.title ?? "商品标题待补齐"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {draft.trade_path ?? "未匹配深绘类目"} · SKU {formatNumber(draft.sku_count)} · {formatDateTime(draft.updated_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {draft.blocker_count > 0 ? (
          <Badge variant="destructive">{formatNumber(draft.blocker_count)} 阻断</Badge>
        ) : (
          <Badge variant="outline" className="border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]">
            可推进
          </Badge>
        )}
        {draft.warning_count > 0 ? <Badge variant="outline">{formatNumber(draft.warning_count)} 提醒</Badge> : null}
        <Button asChild variant="ghost" size="icon-sm">
          <Link to={`/product-archive-drafts/${draft.id}`} aria-label={`查看深绘建档草稿 ${draft.draft_no}`}>
            <ArrowRight className="size-4" />
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
