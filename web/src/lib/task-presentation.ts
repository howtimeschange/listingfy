import type { AsyncTaskJob } from "./async-task-context"

export function taskPresentation(job?: AsyncTaskJob | null): { label: string; status: "neutral" | "loading" | "success" | "warning" | "danger" } {
  if (!job) return { label: "获取状态", status: "neutral" }
  if (job.status === "cancelled" || job.outcome === "stopped") return { label: "已停止", status: "neutral" }
  if (job.status === "failed" || job.outcome === "failed") return { label: "失败", status: "danger" }
  if (job.status === "queued") return { label: "排队中", status: "neutral" }
  if (job.status === "running") return { label: "进行中", status: "loading" }
  if (job.failed_count > 0 || job.outcome === "partial_failure") return { label: "部分失败", status: "warning" }
  return { label: "已完成", status: "success" }
}
