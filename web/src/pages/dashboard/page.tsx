import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import {
  Database,
  FolderTree,
  Tags,
  GitBranch,
  PackagePlus,
  ArrowRight,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { formatNumber, formatDateTime } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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

function useSummary() {
  return useQuery<MetadataSummary>({
    queryKey: ["metadata", "summary"],
    queryFn: () => api.get("/metadata/summary"),
  })
}

export default function DashboardPage() {
  const { data: summary, isLoading } = useSummary()

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="工作台"
        description="SHEIN 全托管上新中台。把平台元数据、商品档案、规则和发布流程收束成一个清晰可追踪的操作面。"
      >
        <Button asChild>
          <Link to="/product-archives">
            商品档案
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/shein-metadata">浏览元数据</Link>
        </Button>
      </PageHeader>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatCard
            title="SHEIN 叶子类目"
            value={formatNumber(
              summary.roots.reduce((s, r) => s + r.leaf_count, 0),
            )}
            icon={FolderTree}
            description={`${summary.roots.length} 个根类目`}
          />
          <StatCard
            title="属性模板"
            value={formatNumber(summary.counts.channel_attribute_template)}
            icon={Tags}
          />
          <StatCard
            title="属性枚举值"
            value={formatNumber(summary.counts.channel_attribute_value)}
            icon={Database}
          />
          <StatCard
            title="最后同步"
            value={
              summary.latest_batch
                ? formatDateTime(summary.latest_batch.finished_at)
                : "—"
            }
            icon={Database}
            description={
              summary.latest_batch
                ? `${summary.latest_batch.status} · ${formatNumber(summary.latest_batch.success_count)} 成功`
                : undefined
            }
          />
        </div>
      ) : null}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLink
          title="SHEIN 元数据浏览"
          description="查看类目树、发布字段、图片规则、属性模板"
          icon={Database}
          to="/shein-metadata"
        />
        <QuickLink
          title="类目映射规则"
          description="管理 MDM 到 SHEIN 的类目映射"
          icon={GitBranch}
          to="/category-mapping"
        />
        <QuickLink
          title="上新批次"
          description="创建和管理上新批次"
          icon={PackagePlus}
          to="/listing-batches"
        />
      </div>

      {/* Root categories overview */}
      {summary && summary.roots.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>SHEIN 根类目概览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {summary.roots.map((root) => (
                <div
                  key={root.root_category_name}
                  className="flex items-center justify-between rounded-2xl border bg-background px-4 py-3 transition-colors hover:border-input hover:bg-accent/35"
                >
                  <span className="truncate text-sm font-medium">
                    {root.root_category_name}
                  </span>
                  <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {root.leaf_count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}

function QuickLink({
  title,
  description,
  icon: Icon,
  to,
}: {
  title: string
  description: string
  icon: typeof Database
  to: string
}) {
  return (
    <Card className="group hover:border-input hover:bg-accent/20">
      <CardContent className="px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-[var(--brand-light)] text-[var(--brand-deep)]">
            <Icon className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-medium tracking-[-0.1px]">{title}</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 opacity-80 group-hover:bg-background group-hover:opacity-100"
            asChild
          >
            <Link to={to}>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
