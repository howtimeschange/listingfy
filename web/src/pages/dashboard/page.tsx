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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">工作台</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SHEIN 全托管上新中台
        </p>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-base">SHEIN 根类目概览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {summary.roots.map((root) => (
                <div
                  key={root.root_category_name}
                  className="flex items-center justify-between rounded border px-3 py-2"
                >
                  <span className="text-sm truncate">
                    {root.root_category_name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums ml-2 shrink-0">
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
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="py-4 px-4">
        <div className="flex items-start gap-3">
          <div className="rounded bg-primary/10 p-2">
            <Icon className="size-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to={to}>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
