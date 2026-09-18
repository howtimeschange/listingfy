import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  CheckCheck,
  CircleHelp,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { formatDateTime, formatNumber } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { AnimatedBadge } from "@/components/ui/animated-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Channel = "deepdraw" | "shein"
interface Metrics {
  total: number
  success: number
  problems: number
  ready: number
  processing: number
  submitted: number
  completeness: number | null
  assessed: number
  missing: number
  warnings: number
}
interface Overview {
  summary: Metrics
  brands: (Metrics & { brand: string })[]
  issues: {
    key: string
    spu_code: string
    brand: string
    title: string | null
    status: string
    completeness: number | null
    missing: number
    warnings: number
    reason: string
    href: string
    updated_at: string
  }[]
  issue_count: number
  source_updated_at: string | null
  generated_at: string
}
const channels = {
  deepdraw: {
    name: "深绘渠道",
    subtitle: "商品建档",
    success: "建档成功",
    to: "/product-archive-drafts",
    action: "进入深绘建档",
    note: "按租户、商家和款号去重，取最新草稿。已创建、回读通过、回读不一致均计为建档成功；回读不一致同时列入问题款号。",
    completeness:
      "每款必填字段校验通过数 ÷ 必填字段数，再取平均；没有必填字段记录的款不参与平均。",
  },
  shein: {
    name: "SHEIN 渠道",
    subtitle: "商品上新",
    success: "发布成功 · 审核通过",
    to: "/shein-platform-products",
    action: "查看平台商品",
    note: "统计本系统上新链路，按款号去重。同款所有未归档发布单元审核通过才计为成功；仅提交、部分通过和平台历史商品不计入。",
    completeness:
      "有发布草稿时取同款最低草稿完备率，否则取商品分桶完备率，再按款平均；未评估款不参与平均。",
  },
}
const statuses: Record<string, string> = {
  draft: "待完善",
  missing_fields: "资料缺失",
  manual_review: "待人工判断",
  duplicate_found: "重复商品待确认",
  update_pending: "待更新策略",
  readback_mismatch: "回读不一致",
  failed: "建档失败",
  created: "已创建",
  readback_verified: "回读通过",
  ready: "可创建",
  DRAFT: "待完善",
  NEEDS_ENRICHMENT: "待补齐",
  VALIDATION_FAILED: "校验失败",
  PUBLISH_FAILED: "发布失败",
  FAILED: "发布失败",
  REJECTED: "审核驳回",
  REVOKED: "已撤回",
  STATUS_UNKNOWN: "回执待核实",
  NEEDS_REVIEW: "待复核",
  PENDING: "待评估",
  PUBLISH_SUBMITTED: "已提交待回执",
  UNDER_REVIEW: "审核中",
  PARTIALLY_APPROVED: "部分审核通过",
  APPROVED: "审核通过",
  READY_TO_VALIDATE: "待校验",
  READY_TO_PUBLISH: "可发布",
  READY: "已就绪",
  PAUSED: "已暂停",
  PUBLISHING: "发布中",
}
const percent = (value: number | null) =>
  value == null ? "未评估" : `${Math.round(Number(value) * 10) / 10}%`

export default function DashboardPage() {
  const { hasPermission } = useAuth()
  const canUseDeepdraw = hasPermission("PRODUCT_ARCHIVE_DRAFT_READ")
  const canUseShein = hasPermission("LISTING_READ")
  const [tab, setTab] = useState<Channel>(canUseDeepdraw ? "deepdraw" : "shein")
  const active =
    tab === "deepdraw" && !canUseDeepdraw
      ? "shein"
      : tab === "shein" && !canUseShein
        ? "deepdraw"
        : tab
  const [brand, setBrand] = useState("")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [offset, setOffset] = useState(0)
  const params = (channel: Channel) =>
    new URLSearchParams({
      brand: active === channel ? brand : "",
      q: active === channel ? query : "",
      offset: String(active === channel ? offset : 0),
    }).toString()
  const deepdrawParams = params("deepdraw")
  const sheinParams = params("shein")
  const deepdraw = useQuery<Overview>({
    queryKey: ["dashboard", "deepdraw", deepdrawParams],
    queryFn: () => api.get(`/dashboard/deepdraw?${deepdrawParams}`),
    enabled: canUseDeepdraw,
    staleTime: 30_000,
  })
  const shein = useQuery<Overview>({
    queryKey: ["dashboard", "shein", sheinParams],
    queryFn: () => api.get(`/dashboard/shein?${sheinParams}`),
    enabled: canUseShein,
    staleTime: 30_000,
  })
  const queries = { deepdraw, shein }
  const current = queries[active]
  const data = current.data
  const allowed = (["deepdraw", "shein"] as Channel[]).filter((c) =>
    c === "deepdraw" ? canUseDeepdraw : canUseShein,
  )
  const selectChannel = (value: Channel) => {
    setTab(value)
    setBrand("")
    setOffset(0)
    setSearch("")
    setQuery("")
  }
  const chooseBrand = (value: string) => {
    setBrand(value)
    setOffset(0)
  }
  const refreshing = allowed.some((c) => queries[c].isFetching)

  return (
    <PageContainer className="space-y-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium tracking-widest text-muted-foreground">
            商品运营 / 渠道总览
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">工作台</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            看发布结果，也看每一款卡在哪里。
          </p>
        </div>
        {allowed.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              全量数据 · 按款统计
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() =>
                void Promise.all(allowed.map((c) => queries[c].refetch()))
              }
            >
              <RefreshCw
                className={cn(
                  "size-3.5",
                  refreshing && "motion-safe:animate-spin",
                )}
              />
              刷新数据
            </Button>
          </div>
        )}
      </header>
      {!allowed.length && (
        <div className="rounded-2xl border p-12 text-center">
          <ShieldCheck className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p>当前账号暂无运营链路权限</p>
          <p className="mt-2 text-sm text-muted-foreground">
            请联系管理员分配深绘或 SHEIN 运营权限。
          </p>
        </div>
      )}
      <div className={cn("grid gap-5", allowed.length > 1 && "xl:grid-cols-2")}>
        {allowed.map((channel) => (
          <ChannelCard
            key={channel}
            channel={channel}
            data={queries[channel].data}
            loading={queries[channel].isPending}
            error={queries[channel].isError}
            active={active === channel}
            onSelect={() => selectChannel(channel)}
            retry={() => void queries[channel].refetch()}
          />
        ))}
      </div>
      {allowed.length > 0 && (
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <Tabs
              value={active}
              onValueChange={(value) => selectChannel(value as Channel)}
            >
              <TabsList aria-label="渠道明细">
                {allowed.map((c) => (
                  <TabsTrigger key={c} value={c}>
                    {channels[c].name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button asChild variant="ghost" size="sm">
              <Link to={channels[active].to}>
                {channels[active].action}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          {current.isPending ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-32" />
              <Skeleton className="h-48" />
            </div>
          ) : current.isError ? (
            <ErrorState retry={() => void current.refetch()} />
          ) : (
            data && (
              <>
                <div className="p-5 md:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">品牌进展</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        选择品牌，查看对应的过程数据和问题款号。
                      </p>
                    </div>
                    <Button
                      variant={brand ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => chooseBrand("")}
                    >
                      全部品牌
                    </Button>
                  </div>
                  {data.brands.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[580px] text-left text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="pb-3 font-normal">品牌</th>
                            <th className="pb-3 text-right font-normal">
                              纳入款数
                            </th>
                            <th className="pb-3 text-right font-normal">
                              {active === "deepdraw" ? "建档成功" : "审核通过"}
                            </th>
                            <th className="pb-3 text-right font-normal">
                              问题款数
                            </th>
                            <th className="pb-3 pl-8 font-normal">
                              数据完备率
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.brands.map((item) => (
                            <tr
                              key={item.brand}
                              className={cn(
                                "border-b last:border-0 transition-colors hover:bg-muted/50",
                                brand === item.brand &&
                                  "bg-[var(--brand-light)]/40",
                              )}
                            >
                              <td className="py-3">
                                <button
                                  onClick={() =>
                                    chooseBrand(
                                      brand === item.brand ? "" : item.brand,
                                    )
                                  }
                                  aria-pressed={brand === item.brand}
                                  className="rounded px-2 py-1 text-left font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                                >
                                  {item.brand}
                                  <ArrowRight className="ml-2 inline size-3 text-muted-foreground" />
                                </button>
                              </td>
                              <td className="text-right tabular-nums">
                                {formatNumber(item.total)}
                              </td>
                              <td className="text-right font-medium tabular-nums text-emerald-700">
                                {formatNumber(item.success)}
                              </td>
                              <td
                                className={cn(
                                  "text-right tabular-nums",
                                  item.problems > 0 && "text-amber-700",
                                )}
                              >
                                {formatNumber(item.problems)}
                              </td>
                              <td className="w-48 pl-8">
                                <div className="flex items-center gap-3">
                                  <Progress
                                    value={item.completeness ?? 0}
                                    className="h-1.5 flex-1"
                                  />
                                  <span className="w-14 text-right text-xs tabular-nums">
                                    {percent(item.completeness)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-6 text-sm text-muted-foreground">
                      暂无渠道商品数据，开始建档或上新后将在这里汇总。
                    </p>
                  )}
                </div>
                <div className="border-y bg-muted/30 px-5 py-4 md:px-6">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">
                      {brand || "全部品牌"} · 过程数据
                    </h2>
                    <AnimatedBadge
                      size="sm"
                      status={data.summary.problems ? "warning" : "neutral"}
                    >
                      {data.summary.problems
                        ? `${formatNumber(data.summary.problems)} 款需要处理`
                        : "暂无已识别问题"}
                    </AnimatedBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                    <ProcessMetric
                      title="数据完备率"
                      value={percent(data.summary.completeness)}
                      detail={`已评估 ${formatNumber(data.summary.assessed)} / ${formatNumber(data.summary.total)} 款`}
                    />
                    <ProcessMetric
                      title={
                        active === "deepdraw"
                          ? "待创建 · 已就绪"
                          : "待发布 · 已就绪"
                      }
                      value={formatNumber(data.summary.ready)}
                      detail={`${formatNumber(data.summary.processing)} 款处理中`}
                    />
                    <ProcessMetric
                      title="缺失 / 无效必填字段"
                      value={formatNumber(data.summary.missing)}
                      detail={
                        active === "deepdraw"
                          ? "来自必填字段校验"
                          : "来自商品分桶评估"
                      }
                    />
                    <ProcessMetric
                      title={
                        active === "deepdraw"
                          ? "校验提醒"
                          : "待 AI / 人工判断字段"
                      }
                      value={formatNumber(data.summary.warnings)}
                      detail="字段或提醒条数，不等于款数"
                    />
                  </div>
                </div>
                <div className="p-5 md:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-semibold">
                        问题款号{" "}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          {formatNumber(data.issue_count)}
                        </span>
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        资料缺失、校验异常与发布失败，点击款号进入处理。
                      </p>
                    </div>
                    <form
                      className="flex w-full gap-2 sm:w-auto"
                      onSubmit={(e) => {
                        e.preventDefault()
                        setQuery(search.trim())
                        setOffset(0)
                      }}
                    >
                      <Input
                        className="h-9 sm:w-56"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="搜索款号或商品标题"
                        aria-label="搜索问题款号"
                      />
                      <Button variant="outline" size="sm" type="submit">
                        <Search className="size-3.5" />
                        搜索
                      </Button>
                    </form>
                  </div>
                  {!data.issues.length ? (
                    <div className="rounded-xl border border-dashed px-4 py-10 text-center">
                      <CheckCheck className="mx-auto mb-3 size-6 text-emerald-600" />
                      <p className="text-sm">
                        {query
                          ? "没有匹配的问题款号"
                          : data.summary.total
                            ? "当前范围暂无已识别的问题款号"
                            : "暂无可评估的商品"}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {query
                          ? "更换关键词或清空搜索后重试。"
                          : "未评估和处理中不代表已发布成功。"}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {data.issues.map((item) => (
                        <div
                          key={item.key}
                          className="grid gap-3 py-4 first:pt-0 md:grid-cols-[minmax(160px,0.8fr)_minmax(200px,1.6fr)_100px_64px] md:items-center"
                        >
                          <div className="min-w-0">
                            <Link
                              to={item.href}
                              className="font-mono text-sm font-semibold text-foreground hover:underline"
                            >
                              {item.spu_code}
                            </Link>
                            <p
                              className="mt-1 truncate text-xs text-muted-foreground"
                              title={item.title ?? ""}
                            >
                              {item.title || "商品标题待补齐"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.brand}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-amber-700">
                              {statuses[item.status] ?? "待检查"}
                            </span>
                            <p
                              className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground"
                              title={item.reason}
                            >
                              {item.reason ||
                                (item.missing > 0
                                  ? `${item.missing} 个必填字段待补齐或修正`
                                  : "需检查资料、校验结果或平台回执")}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">
                              完备率
                            </span>
                            <p className="mt-1 text-sm tabular-nums">
                              {percent(item.completeness)}
                            </p>
                          </div>
                          <Button asChild variant="ghost" size="sm">
                            <Link to={item.href}>
                              处理
                              <ArrowRight className="size-3" />
                            </Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {data.issue_count > 10 && (
                    <div className="mt-4 flex items-center justify-end gap-3 border-t pt-4">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        第 {offset / 10 + 1} /{" "}
                        {Math.ceil(data.issue_count / 10)} 页
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={offset === 0}
                        onClick={() => setOffset(offset - 10)}
                      >
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={offset + 10 >= data.issue_count}
                        onClick={() => setOffset(offset + 10)}
                      >
                        下一页
                      </Button>
                    </div>
                  )}
                </div>
                <footer className="border-t px-5 py-4 text-xs leading-6 text-muted-foreground md:px-6">
                  <p>{channels[active].note}</p>
                  <p>
                    完备率：{channels[active].completeness}{" "}
                    问题数与成功数可能交叉，不作为相加的漏斗。
                  </p>
                  <p>
                    汇总时间 {formatDateTime(data.generated_at)}
                    {data.source_updated_at
                      ? ` · 来源最近更新 ${formatDateTime(data.source_updated_at)}`
                      : ""}
                  </p>
                </footer>
              </>
            )
          )}
        </section>
      )}
    </PageContainer>
  )
}

function ChannelCard({
  channel,
  data,
  loading,
  error,
  active,
  onSelect,
  retry,
}: {
  channel: Channel
  data?: Overview
  loading: boolean
  error: boolean
  active: boolean
  onSelect: () => void
  retry: () => void
}) {
  const config = channels[channel]
  // Overview cards stay channel-wide even while the detail area filters one brand.
  const total = data?.brands.reduce((sum, b) => sum + b.total, 0) ?? 0
  const success = data?.brands.reduce((sum, b) => sum + b.success, 0) ?? 0
  const problems = data?.brands.reduce((sum, b) => sum + b.problems, 0) ?? 0
  const submitted = data?.brands.reduce((sum, b) => sum + b.submitted, 0) ?? 0
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-colors",
        active && "border-emerald-300",
      )}
    >
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="font-semibold">
          {config.name}{" "}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {config.subtitle}
          </span>
        </h2>
        <AnimatedBadge
          size="sm"
          status={loading ? "loading" : error ? "danger" : "neutral"}
        >
          {loading
            ? "读取中"
            : error
              ? "读取失败"
              : `${data?.brands.filter((b) => b.brand !== "未识别品牌").length ?? 0} 个已识别品牌`}
        </AnimatedBadge>
      </div>
      {loading ? (
        <div className="space-y-4 p-6">
          <Skeleton className="h-16" />
          <Skeleton className="h-8" />
        </div>
      ) : error ? (
        <ErrorState retry={retry} />
      ) : (
        <div className="px-6 pb-5 pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {config.success}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={`${config.name}成功统计口径`}
                  className="rounded focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <CircleHelp className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {config.note}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-semibold tracking-tight tabular-nums">
              {formatNumber(success)}
            </span>
            <span className="text-sm text-muted-foreground">
              款<span className="mx-2 text-border">/</span>共{" "}
              {formatNumber(total)} 款
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span
              className={problems ? "text-amber-700" : "text-muted-foreground"}
            >
              问题款号{" "}
              <strong className="ml-1 tabular-nums">
                {formatNumber(problems)}
              </strong>
            </span>
            {channel === "shein" ? (
              <span className="text-muted-foreground">
                已提交 / 待审核{" "}
                <strong className="ml-1 tabular-nums text-foreground">
                  {formatNumber(submitted)}
                </strong>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {data?.brands.map((b) => b.brand).join("、") || "暂无品牌数据"}
              </span>
            )}
          </div>
        </div>
      )}
      <button
        onClick={onSelect}
        className="flex w-full items-center justify-between border-t bg-muted/20 px-6 py-3 text-xs font-medium transition-colors hover:bg-[var(--brand-light)]/40 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span>查看品牌进展与问题款号</span>
        <ArrowRight className="size-3.5" />
      </button>
    </article>
  )
}
function ProcessMetric({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="p-6 text-sm">
      <p>数据暂时无法读取，请重试。</p>
      <p className="mt-1 text-xs text-muted-foreground">读取失败不会计为 0。</p>
      <Button className="mt-3" size="sm" variant="outline" onClick={retry}>
        重新加载
      </Button>
    </div>
  )
}
