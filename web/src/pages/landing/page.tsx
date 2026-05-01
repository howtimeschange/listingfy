import { Link } from "react-router"
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileCheck2,
  GitBranch,
  Image,
  Layers3,
  LineChart,
  PackageCheck,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const navItems = [
  { label: "产品能力", href: "#features" },
  { label: "上新流程", href: "#workflow" },
  { label: "系统架构", href: "#architecture" },
]

const metrics = [
  { value: "SPU", label: "商品主数据" },
  { value: "SKC", label: "款色图片校验" },
  { value: "SKU", label: "尺码价格发布" },
]

const featureCards = [
  {
    title: "多源商品档案",
    description: "把 MDM SPU/SKC/SKU、深绘内容包、图片素材和人工规则沉淀为可追溯的商品底座。",
    icon: Database,
  },
  {
    title: "发布草稿工作台",
    description: "围绕 SHEIN 全托管生成草稿、补齐字段、选择图片、维护价格包装，并保留版本快照。",
    icon: FileCheck2,
  },
  {
    title: "平台规范校验",
    description: "同步类目、属性模板、图片规则和尺码规范，提交前集中发现阻断项与风险项。",
    icon: ShieldCheck,
  },
  {
    title: "发布任务追踪",
    description: "记录 OpenAPI 请求、Trace ID、失败原因、审核状态和平台身份回写，便于运营复盘。",
    icon: Send,
  },
]

const workflowSteps = [
  {
    title: "同步商品与内容",
    description: "从 MDM 和深绘拉取商品主数据、标题、详情页、尺码表与图片素材。",
    icon: Layers3,
  },
  {
    title: "进入平台分桶",
    description: "按平台规则筛选商品，应用类目映射、字段填充和图片规范检查。",
    icon: PackageCheck,
  },
  {
    title: "批量预检发布",
    description: "将草稿归入上新批次，通过校验后提交 SHEIN 并持续同步审核结果。",
    icon: CheckCircle2,
  },
]

const architectureItems = [
  "PlatformAdapter 隔离 SHEIN、TEMU 等平台差异",
  "商品档案与平台刊登草稿分层建模",
  "发布版本、任务回执和操作日志全链路留痕",
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
              跨境上新，从商品档案到平台发布的一条清晰链路
            </h1>
            <p
              className="mt-6 max-w-[calc(100vw-40px)] text-base leading-8 text-muted-foreground sm:text-lg md:max-w-2xl"
              style={{ overflowWrap: "anywhere" }}
            >
              Listingify 将 MDM、深绘内容包、图片素材、平台规则校验和 OpenAPI 发布追踪串成一个可审计、可批量操作的刊登中台。
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

      <section id="features" className="border-t bg-background py-20 md:py-24">
        <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
          <SectionHeading
            title="把 Excel 里的上新链路，收束成可运营的产品工作流。"
            description="不是替代完整 ERP，而是把 SHEIN 全托管上新的关键步骤产品化、数据化、可追踪，并为 TEMU 等平台保留适配边界。"
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="border-t bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] py-20 md:py-24">
        <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
            <SectionHeading
              title="运营每天真正需要看的，是下一步该处理什么。"
              description="系统围绕分桶商品、发布草稿、发布任务三段工作流组织信息，让阻断项、完整度和平台回执都能在同一个节奏里推进。"
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
              title="首个平台跑通 SHEIN，但系统边界按多平台设计。"
              description="商品模型不绑定单一平台，平台差异通过适配器、元数据、发布草稿和任务回执隔离，便于后续接入 TEMU 或更多渠道。"
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
              <CardTitle>平台适配层</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AdapterRow icon={GitBranch} platform="SHEIN" status="已接入" tone="ready" />
              <AdapterRow icon={GitBranch} platform="TEMU" status="预留适配" />
              <AdapterRow icon={GitBranch} platform="更多渠道" status="待扩展" />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t px-5 py-16 md:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 rounded-[24px] border bg-primary px-6 py-8 text-primary-foreground shadow-[0_2px_4px_rgba(0,0,0,0.03)] md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.6px]">开始处理下一批上新。</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/70">
              进入工作台查看分桶、草稿、批次、发布任务和平台元数据健康度。
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
                Publish cockpit
              </p>
              <CardTitle className="mt-2">SHEIN 上新批次</CardTitle>
            </div>
            <span className="rounded-full border border-[#b9f4d8] bg-[var(--brand-light)] px-3 py-1 text-xs font-medium text-[var(--brand-deep)]">
              预检通过
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <HeroMetric label="草稿" value="128" />
            <HeroMetric label="阻断项" value="7" tone="warn" />
            <HeroMetric label="发布中" value="36" tone="info" />
          </div>
          <div className="space-y-3">
            <QueueRow title="中黄30435" description="字段完整度 96% · 12 SKU" status="待提交" icon={PackageCheck} />
            <QueueRow title="深绘内容包" description="主图、详情页、尺码表已同步" status="已匹配" icon={Image} />
            <QueueRow title="SHEIN OpenAPI" description="Trace ID 与平台身份自动回写" status="追踪中" icon={LineChart} />
          </div>
          <div className="rounded-2xl border bg-[var(--surface-tint)] p-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium">批次发布准备度</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">84%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[84%] rounded-full bg-[var(--brand)]" />
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
