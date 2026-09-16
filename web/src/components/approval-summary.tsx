// Adapted layout from beUI Approval Card (MIT). See web/BEUI-LICENSE.txt.
// Presentation only: authorization, preflight and submit actions remain with the caller.
import { ShieldCheck } from "lucide-react"
import { AnimatedBadge } from "@/components/motion/animated-badge"

export function ApprovalSummary({ title, scope, effect, warning, pending }: {
  title: string; scope: string; effect: string; warning?: string; pending?: boolean
}) {
  return <section aria-label={title} className="rounded-xl border border-[var(--brand-deep)]/20 bg-[var(--brand-light)]/25 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-[var(--brand-deep)]" />{title}</h3><AnimatedBadge status={pending ? "loading" : "info"} size="sm" pulse={false}>{pending ? "校验中" : "请核对范围"}</AnimatedBadge></div>
    <dl className="mt-3 grid grid-cols-[4rem_1fr] gap-x-3 gap-y-2 text-xs leading-5"><dt className="text-muted-foreground">操作范围</dt><dd>{scope}</dd><dt className="text-muted-foreground">执行结果</dt><dd>{effect}</dd></dl>
    {warning && <p className="mt-2 text-xs leading-5 text-amber-800">{warning}</p>}
  </section>
}
