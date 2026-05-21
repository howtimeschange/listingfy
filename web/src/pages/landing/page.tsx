import { Link } from "react-router"
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Database,
  DollarSign,
  FileCheck2,
  GitBranch,
  Globe2,
  Layers3,
  LineChart,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const navItems = [
  { label: "能力闭环", href: "#capabilities" },
  { label: "运营流程", href: "#workflow" },
  { label: "工程底座", href: "#architecture" },
]

const metrics = [
  { value: "P0", label: "平台商品闭环" },
  { value: "P1", label: "运营中心接入" },
  { value: "140", label: "关键测试用例" },
]

const featureCards = [
  {
    title: "商品档案与内容底座",
    description: "从 MDM、深绘内容包、图片素材和规则 Excel 聚合 SPU/SKC/SKU，为发布和运营保留清晰源头。",
    icon: Database,
  },
  {
    title: "SHEIN 发布闭环",
    description: "商品分桶、发布草稿、字段清洗、图片校验、价格包装、批次发布和版本快照已串成可操作链路。",
    icon: FileCheck2,
  },
  {
    title: "平台商品生命周期运营",
    description: "同步 SHEIN 平台商品，落库 SPU/SKC/SKU、销售站点、供货价、操作流水，并支持编辑、撤回和重试。",
    icon: PackageSearch,
  },
  {
    title: "P1 运营中心",
    description: "平台标识对账、商家 SKU 查重、条码尺码、审核状态聚合和真实数据回归日志已进入运营视图。",
    icon: ClipboardList,
  },
  {
    title: "销售站点与多 Sheet 导出",
    description: "平台商品列表支持销售站点筛选，导出时主表保留摘要，站点明细独立展开到明细 Sheet。",
    icon: Globe2,
  },
  {
    title: "规则与价格配置",
    description: "SHEIN 类目、尺码、包装、品牌和价格规则统一平台化命名，默认折扣和汇率支持页面维护。",
    icon: DollarSign,
  },
  {
    title: "安全与系统管理",
    description: "登录锁定、CORS 白名单、平台密钥加密、凭据脱敏、RBAC、同步任务和操作日志构成管理底座。",
    icon: ShieldCheck,
  },
  {
    title: "PostgreSQL 运行口径",
    description: "运行时和管理脚本已切到 PostgreSQL，并保留 SQLite 历史数据补迁、对账和种子快照初始化路径。",
    icon: RefreshCw,
  },
]

const workflowSteps = [
  {
    title: "沉淀商品档案",
    description: "从 MDM、深绘和图片素材库同步商品、内容、图片、尺码表与规则数据，形成可追溯的数据底座。",
    icon: Layers3,
  },
  {
    title: "完成发布准备",
    description: "在 SHEIN 商品分桶中应用类目映射、字段推荐、图片规则、价格包装和尺码转换，生成多版本发布草稿。",
    icon: PackageCheck,
  },
  {
    title: "批次提交与审核追踪",
    description: "把草稿归入上新批次，整批或勾选提交，记录幂等任务、失败归因、Trace ID、平台身份和审核状态。",
    icon: Send,
  },
  {
    title: "回捞平台商品继续运营",
    description: "同步已发布平台商品和 SPU 详情，维护供货价、常用字段、销售站点、撤回动作和最近操作流水。",
    icon: PackageSearch,
  },
]

const architectureItems = [
  "PlatformAdapter 隔离 SHEIN、TEMU 等平台差异，核心商品模型不绑定单一渠道",
  "商品档案、发布草稿、平台商品和运营动作分层建模，便于追踪生命周期",
  "发布版本、任务回执、审核状态、最近操作和操作日志全链路留痕",
  "PostgreSQL、RBAC、凭据加密、种子快照和测试入口支撑持续交付",
]

const platformModules = [
  { label: "平台商品列表", value: "同步 / 筛选 / 导出", icon: PackageSearch },
  { label: "销售站点", value: "上架站点明细", icon: Globe2 },
  { label: "供货价维护", value: "批量 / 表格导入", icon: DollarSign },
  { label: "审核状态", value: "聚合追踪", icon: ClipboardList },
  { label: "平台标识对账", value: "SPU/SKC/SKU 映射", icon: Tags },
  { label: "发布与审核任务", value: "失败归因 / 重试", icon: LineChart },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/82 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 md:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="Listingify 首页">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.15px]">Listingify</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-[var(--brand-deep)]"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">登录</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/dashboard">
                进入工作台
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_50%_0%,rgba(24,226,153,0.24),transparent_58%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-8rem)] min-w-0 w-full max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 py-14 md:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(480px,1.05fr)] lg:py-16">
          <div className="min-w-0 max-w-3xl">
            <h1
              className="max-w-[calc(100vw-40px)] text-4xl font-semibold leading-[1.12] tracking-[-0.8px] text-foreground sm:text-5xl md:max-w-full md:text-[64px] md:leading-[1.06] md:tracking-[-1.1px]"
              style={{ overflowWrap: "anywhere" }}
            >
              跨境运营，从商品发布到平台商品生命周期的一条清晰链路
            </h1>
            <p
              className="mt-6 max-w-[calc(100vw-40px)] text-base leading-8 text-muted-foreground sm:text-lg md:max-w-2xl"
              style={{ overflowWrap: "anywhere" }}
            >
              Listingify 将 MDM、深绘内容包、图片素材、平台规则、发布任务、SHEIN 平台商品回捞、供货价维护和审核状态聚合成一个可审计、可批量操作的跨境运营平台。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/dashboard">
                  打开工作台
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login">系统登录</Link>
              </Button>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 divide-x overflow-hidden rounded-2xl border bg-card shadow-[0_2px_4px_rgba(0,0,0,0.03)]">
              {metrics.map((metric) => (
                <div key={metric.label} className="min-w-0 px-4 py-4">
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.6px] text-[var(--brand-deep)]">
                    {metric.value}
                  </p>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <HeroWorkbench />
        </div>
      </section>

      <section id="capabilities" className="border-t bg-background py-20 md:py-24">
        <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
          <SectionHeading
            title="项目已经从发品闭环，推进到平台商品运营闭环。"
            description="首页内容基于当前最新进度：SHEIN 仍是首个落地平台，但能力已经覆盖发布前、发布中、发布后和运营中心聚合视图。"
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] py-20 md:py-24">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-[minmax(0,0.76fr)_minmax(0,1.24fr)] lg:items-start">
          <SectionHeading
            title="SHEIN 运营中心开始承接发布后的日常动作。"
            description="平台商品不再只是发布结果，而是后续同步、修改、对账、导出、审核追踪和真实数据回归的运营对象。"
            align="left"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {platformModules.map((item) => (
              <PlatformModule key={item.label} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="border-t bg-background py-20 md:py-24">
        <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
            <SectionHeading
              title="运营每天真正推进的，是商品所处的下一段生命周期。"
              description="从商品档案到发布草稿，再到平台商品回捞和运营动作，系统把阻断项、完整度、平台回执、销售站点和最近操作放在同一个节奏里。"
              align="left"
            />
            <div className="grid gap-4">
              {workflowSteps.map((step, index) => (
                <WorkflowStep key={step.title} index={index + 1} {...step} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="architecture" className="border-t bg-background py-20 md:py-24">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.78fr)] lg:items-center">
          <div>
            <SectionHeading
              title="首个平台深入 SHEIN，但工程边界按多平台和长期运营设计。"
              description="商品模型、平台元数据、发布任务、平台身份和运营动作保持分层，平台差异通过适配器隔离；运行底座已经切到 PostgreSQL，并补齐安全、种子快照和测试入口。"
              align="left"
            />
            <div className="mt-8 grid gap-3">
              {architectureItems.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 shrink-0 text-[var(--brand-deep)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <Card className="rounded-[24px]">
            <CardHeader>
              <CardTitle>平台与底座状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AdapterRow icon={GitBranch} platform="SHEIN" status="发布与运营闭环" tone="ready" />
              <AdapterRow icon={GitBranch} platform="TEMU" status="预留适配" />
              <AdapterRow icon={Database} platform="PostgreSQL" status="运行口径" tone="ready" />
              <AdapterRow icon={ShieldCheck} platform="安全与 RBAC" status="已加固" tone="ready" />
              <AdapterRow icon={CheckCircle2} platform="测试入口" status="npm test" tone="ready" />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t px-5 py-16 md:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 rounded-[24px] border bg-primary px-6 py-8 text-primary-foreground shadow-[0_2px_4px_rgba(0,0,0,0.03)] md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.6px]">开始处理下一批上新。</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/70">
              进入工作台查看分桶、草稿、批次、发布任务、平台商品、销售站点、审核状态和运营中心健康度。
            </p>
          </div>
          <Button asChild variant="brand" size="lg" className="self-start md:self-center">
            <Link to="/dashboard">
              进入 Listingify
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}

function HeroWorkbench() {
  return (
    <div className="relative mx-auto min-w-0 w-full max-w-2xl">
      <div className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(circle_at_50%_20%,rgba(24,226,153,0.18),transparent_65%)]" />
      <Card className="relative overflow-hidden rounded-[24px]">
        <CardHeader className="border-b bg-card/90">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.6px] text-[var(--brand-deep)]">
                Operation cockpit
              </p>
              <CardTitle className="mt-2">SHEIN 运营闭环</CardTitle>
            </div>
            <span className="rounded-full border border-[#b9f4d8] bg-[var(--brand-light)] px-3 py-1 text-xs font-medium text-[var(--brand-deep)]">
              平台商品已回捞
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <HeroMetric label="平台商品" value="P0" />
            <HeroMetric label="运营中心" value="P1" tone="info" />
            <HeroMetric label="测试覆盖" value="140" />
          </div>
          <div className="space-y-3">
            <QueueRow title="SHEIN 平台商品列表" description="按款号或时间范围同步，补拉 SPU 详情" status="运营中" icon={PackageSearch} />
            <QueueRow title="销售站点明细" description="上架站点、链接、首次与最近上架时间独立展开" status="可筛选" icon={Globe2} />
            <QueueRow title="批量供货价维护" description="模板下载、上传预览、按 SPU/SKC 聚合提交" status="已接入" icon={DollarSign} />
            <QueueRow title="发布与审核任务" description="失败归因、幂等任务、状态轮询和批量重试" status="追踪中" icon={LineChart} />
          </div>
          <div className="rounded-2xl border bg-[var(--surface-tint)] p-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium">生命周期运营闭环</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">P1</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[72%] rounded-full bg-[var(--brand)]" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SectionHeading({
  title,
  description,
  align = "center",
}: {
  title: string
  description: string
  align?: "center" | "left"
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <h2 className="text-4xl font-semibold leading-[1.1] tracking-[-0.8px] text-foreground">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{description}</p>
    </div>
  )
}

function FeatureCard({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-light)] text-[var(--brand-deep)]">
          <Icon className="size-5" />
        </div>
        <h3 className="mt-6 text-xl font-semibold leading-[1.3] tracking-[-0.2px]">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function PlatformModule({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: LucideIcon
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] border bg-card px-5 py-4 shadow-[0_2px_4px_rgba(0,0,0,0.03)]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand-deep)]">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{label}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{value}</p>
        </div>
      </div>
      <CheckCircle2 className="size-4 shrink-0 text-[var(--brand-deep)]" />
    </div>
  )
}

function WorkflowStep({
  index,
  title,
  description,
  icon: Icon,
}: {
  index: number
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <div className="grid gap-4 rounded-[24px] border bg-card p-5 shadow-[0_2px_4px_rgba(0,0,0,0.03)] sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.6px] text-muted-foreground">
          Step {index}
        </p>
        <h3 className="mt-1 text-xl font-semibold tracking-[-0.2px]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="hidden size-5 text-muted-foreground sm:block" />
    </div>
  )
}

function AdapterRow({
  icon: Icon,
  platform,
  status,
  tone = "default",
}: {
  icon: LucideIcon
  platform: string
  status: string
  tone?: "default" | "ready"
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-medium">{platform}</span>
      </div>
      <span
        className={
          tone === "ready"
            ? "rounded-full border border-[#b9f4d8] bg-[var(--brand-light)] px-3 py-1 text-xs font-medium text-[var(--brand-deep)]"
            : "rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
        }
      >
        {status}
      </span>
    </div>
  )
}

function HeroMetric({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "warn" | "info"
}) {
  const color = tone === "warn" ? "text-[#c37d0d]" : tone === "info" ? "text-[#3772cf]" : "text-foreground"

  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold leading-none tracking-[-0.24px] tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  )
}

function QueueRow({
  title,
  description,
  status,
  icon: Icon,
}: {
  title: string
  description: string
  status: string
  icon: LucideIcon
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-background px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand-deep)]">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <span className="shrink-0 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        {status}
      </span>
    </div>
  )
}
