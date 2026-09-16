// Adapted from beUI Agent Activity (MIT). See web/BEUI-LICENSE.txt.
// Use real job items rather than inventing phases from elapsed time.
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronDown } from "lucide-react"
import { useId, useState } from "react"
import { AnimatedBadge } from "@/components/motion/animated-badge"
import { type AsyncTaskRecord, isAsyncTaskTerminal } from "@/lib/async-task-context"
import { taskPresentation } from "@/lib/task-presentation"

export function TaskActivity({ task }: { task: AsyncTaskRecord }) {
  const [expanded, setExpanded] = useState(false)
  const reduce = useReducedMotion()
  const id = useId()
  const job = task.job
  const phase = taskPresentation(job)
  const terminal = isAsyncTaskTerminal(job)
  const items = job?.items?.length ? job.items : [
    ...(job?.current_items ?? (job?.current_item ? [job.current_item] : [])),
    ...(job?.failed_items ?? []),
  ]
  const unique = [...new Map(items.map((item) => [item.spu_code, item])).values()]
  return <div className="mt-3 rounded-lg border bg-muted/30">
    <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span>执行明细 · {phase.label}</span><ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
    <AnimatePresence initial={false}>{expanded && <motion.div id={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.15 }} className="max-h-48 overflow-auto border-t px-3 py-2">
      {task.lastError && <p className="mb-2 text-xs text-destructive">状态更新失败：{task.lastError}</p>}
      {unique.length ? <ol className="space-y-2">{unique.map((item) => {
        const stopped = terminal && (item.status === "queued" || item.status === "running" || item.status === "retrying")
        const label = stopped ? "未完成" : ({ queued: "排队", running: "处理中", retrying: "等待重试", completed: "完成", failed: "失败" })[item.status]
        return <li key={item.spu_code} className="border-l-2 border-[var(--brand)]/30 pl-2">
          <div className="flex items-center justify-between gap-2 text-xs"><span className="break-all font-mono">{item.spu_code}</span><AnimatedBadge size="sm" pulse={false} status={stopped ? "warning" : item.status === "failed" ? "danger" : item.status === "completed" ? "success" : item.status === "running" ? "loading" : "neutral"}>{label}</AnimatedBadge></div>
          {item.error && <p className="mt-1 break-words text-xs text-destructive">{item.error}</p>}
          {item.status === "retrying" && !terminal && item.next_retry_at && <p className="mt-1 text-xs text-muted-foreground">下次重试：{new Date(item.next_retry_at).toLocaleString("zh-CN")}</p>}
        </li>
      })}</ol> : <p className="text-xs text-muted-foreground">{job ? "后端尚未返回逐项明细；进度以任务汇总为准。" : "正在获取任务状态…"}</p>}
    </motion.div>}</AnimatePresence>
  </div>
}
