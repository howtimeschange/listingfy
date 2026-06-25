import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Activity, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, Trash2 } from "lucide-react"
import { api } from "@/lib/api-client"
import {
  AsyncTaskContext,
  useAsyncTasks,
  type AddTaskInput,
  type AsyncTaskJob,
  type AsyncTaskRecord,
  type AsyncTaskContextValue,
} from "@/lib/async-task-context"
import { formatDateTime, formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

const TASK_STORAGE_KEY = "listingify.asyncTasks.v1"
const TASK_SEEN_STORAGE_KEY = "listingify.asyncTasks.lastSeenAt.v1"
const TASK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const TASK_CLEANUP_INTERVAL_MS = 10 * 60 * 1000
const TASK_PAGE_SIZE = 5
const MAX_STORED_TASKS = 100

function readStoredTasks() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(TASK_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? retainedTasks(parsed as AsyncTaskRecord[]) : []
  } catch {
    return []
  }
}

function readStoredSeenAt() {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(TASK_SEEN_STORAGE_KEY) ?? ""
}

function timeValue(value?: string | null) {
  const time = Date.parse(value ?? "")
  return Number.isFinite(time) ? time : 0
}

function taskCreatedTime(task: AsyncTaskRecord) {
  return timeValue(task.createdAt) || timeValue(task.job?.created_at)
}

function taskCompletedTime(task: AsyncTaskRecord) {
  return timeValue(task.job?.finished_at)
}

function isTaskExpired(task: AsyncTaskRecord, now = Date.now()) {
  const createdAt = taskCreatedTime(task)
  return Boolean(createdAt && now - createdAt > TASK_RETENTION_MS)
}

function retainedTasks(tasks: AsyncTaskRecord[], now = Date.now()) {
  return tasks.filter((task) => !isTaskExpired(task, now)).slice(0, MAX_STORED_TASKS)
}

function taskProgress(job?: AsyncTaskJob | null) {
  if (!job?.total_count) return 0
  return Math.round(((job.completed_count + job.failed_count) / job.total_count) * 100)
}

function activeTaskCount(tasks: AsyncTaskRecord[]) {
  return tasks.filter((task) => task.job?.status !== "completed").length
}

function unreadCompletedTaskCount(tasks: AsyncTaskRecord[], lastSeenAt: string) {
  const lastSeenTime = timeValue(lastSeenAt)
  return tasks.filter((task) => {
    if (task.job?.status !== "completed") return false
    const completedAt = taskCompletedTime(task) || taskCreatedTime(task)
    return completedAt > lastSeenTime
  }).length
}

function failedItems(task: AsyncTaskRecord) {
  return task.job?.items?.filter((item) => item.status === "failed") ?? []
}

export function AsyncTaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<AsyncTaskRecord[]>(() => readStoredTasks())
  const [lastSeenAt, setLastSeenAt] = useState(() => readStoredSeenAt())
  const [open, setOpen] = useState(false)
  const currentActiveTaskCount = useMemo(() => activeTaskCount(tasks), [tasks])
  const unreadCompletedCount = useMemo(
    () => unreadCompletedTaskCount(tasks, lastSeenAt),
    [lastSeenAt, tasks],
  )

  useEffect(() => {
    const retained = retainedTasks(tasks)
    window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(retained))
  }, [tasks])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTasks((current) => retainedTasks(current))
    }, TASK_CLEANUP_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  const refreshTasks = useCallback(async () => {
    const activeTasks = tasks.filter((task) => task.job?.status !== "completed")
    if (activeTasks.length === 0) return
    const updates = await Promise.all(activeTasks.map(async (task) => {
      try {
        const job = await api.get<AsyncTaskJob>(task.endpoint)
        return { id: task.id, job, lastError: null }
      } catch (error) {
        return {
          id: task.id,
          job: task.job ?? null,
          lastError: error instanceof Error ? error.message : String(error),
        }
      }
    }))
    setTasks((current) => current.map((task) => {
      const update = updates.find((item) => item.id === task.id)
      return update ? { ...task, job: update.job, lastError: update.lastError } : task
    }))
  }, [tasks])

  useEffect(() => {
    if (currentActiveTaskCount === 0) return
    const timer = window.setInterval(() => {
      void refreshTasks()
    }, 1500)
    return () => window.clearInterval(timer)
  }, [currentActiveTaskCount, refreshTasks])

  const markTasksSeen = useCallback(() => {
    const seenAt = new Date().toISOString()
    setLastSeenAt(seenAt)
    window.localStorage.setItem(TASK_SEEN_STORAGE_KEY, seenAt)
  }, [])

  const addTask = useCallback((input: AddTaskInput) => {
    const endpoint = input.endpoint ?? `/product-archive-drafts/batch-jobs/${input.job.id}`
    setTasks((current) => {
      const record: AsyncTaskRecord = {
        id: input.job.id,
        type: input.type,
        title: input.title,
        description: input.description,
        endpoint,
        createdAt: new Date().toISOString(),
        job: input.job,
        lastError: null,
      }
      return retainedTasks([record, ...current.filter((task) => task.id !== input.job.id)])
    })
  }, [])

  const openTaskCenter = useCallback(() => {
    setOpen(true)
    markTasksSeen()
  }, [markTasksSeen])

  const closeTaskCenter = useCallback(() => {
    setOpen(false)
  }, [])

  const value = useMemo<AsyncTaskContextValue>(() => ({
    tasks,
    activeTaskCount: currentActiveTaskCount,
    unreadCompletedCount,
    addTask,
    getTaskByJobId: (jobId) => tasks.find((task) => task.id === jobId) ?? null,
    openTaskCenter,
    closeTaskCenter,
    removeTask: (taskId) => setTasks((current) => current.filter((task) => task.id !== taskId)),
  }), [addTask, closeTaskCenter, currentActiveTaskCount, openTaskCenter, tasks, unreadCompletedCount])

  return (
    <AsyncTaskContext.Provider value={value}>
      {children}
      <AsyncTaskDrawer open={open} onOpenChange={setOpen} tasks={tasks} onRemoveTask={value.removeTask} />
    </AsyncTaskContext.Provider>
  )
}

export function AsyncTaskTrigger() {
  const { activeTaskCount, unreadCompletedCount, openTaskCenter } = useAsyncTasks()
  const badgeCount = unreadCompletedCount > 0 ? unreadCompletedCount : activeTaskCount
  const badgeClass = unreadCompletedCount > 0 ? "bg-[#d84f4f]" : "bg-[var(--brand)]"
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="relative"
      onClick={openTaskCenter}
      aria-label="异步任务"
    >
      <Activity className="size-4" />
      异步任务
      {badgeCount > 0 ? (
        <span className={`absolute -right-1 -top-1 min-w-5 rounded-full px-1 text-center text-[10px] font-semibold text-white ${badgeClass}`}>
          {badgeCount}
        </span>
      ) : null}
    </Button>
  )
}

function AsyncTaskDrawer({
  open,
  onOpenChange,
  tasks,
  onRemoveTask,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: AsyncTaskRecord[]
  onRemoveTask: (taskId: string) => void
}) {
  const [pageIndex, setPageIndex] = useState(0)
  const totalPages = Math.max(1, Math.ceil(tasks.length / TASK_PAGE_SIZE))
  const visiblePageIndex = Math.min(pageIndex, totalPages - 1)
  const currentPageTasks = tasks.slice(visiblePageIndex * TASK_PAGE_SIZE, visiblePageIndex * TASK_PAGE_SIZE + TASK_PAGE_SIZE)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>异步任务</SheetTitle>
          <SheetDescription>
            统一查看 MDM 同步、批量建档、导出等后台任务进度，保留最近 7 天。
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          <div className="grid gap-3">
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                暂无后台任务。
              </div>
            ) : currentPageTasks.map((task) => {
              const job = task.job
              const failures = failedItems(task)
              const done = job?.status === "completed"
              return (
                <section key={task.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {done ? <CheckCircle2 className="size-4 text-[#0fa76e]" /> : <Clock className="size-4 text-[#3772cf]" />}
                        <span className="truncate">{task.title}</span>
                      </div>
                      {task.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(task.createdAt)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => onRemoveTask(task.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        已处理 {formatNumber((job?.completed_count ?? 0) + (job?.failed_count ?? 0))} / {formatNumber(job?.total_count ?? 0)}
                      </span>
                      <span>{taskProgress(job)}%</span>
                    </div>
                    <Progress value={taskProgress(job)} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-muted px-2 py-1">成功 {formatNumber(job?.completed_count ?? 0)}</div>
                    <div className="rounded-md bg-muted px-2 py-1">失败 {formatNumber(job?.failed_count ?? 0)}</div>
                    <div className="rounded-md bg-muted px-2 py-1">总数 {formatNumber(job?.total_count ?? 0)}</div>
                  </div>
                  {task.lastError ? (
                    <p className="mt-2 text-xs text-[#d45656]">{task.lastError}</p>
                  ) : null}
                  {done && job?.downloadUrl ? (
                    <a
                      href={job.downloadUrl}
                      download={job.fileName}
                      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
                    >
                      <Download className="size-3.5" />
                      下载文件
                    </a>
                  ) : null}
                  {failures.length > 0 ? (
                    <div className="mt-3 rounded-md border border-[#f1cccc] bg-[#fff8f8] p-2">
                      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-[#d45656]">
                        <AlertCircle className="size-3.5" />
                        失败明细
                      </div>
                      <div className="max-h-32 overflow-auto text-xs text-muted-foreground">
                        {failures.slice(0, 20).map((item) => (
                          <div key={item.spu_code} className="flex gap-2 border-t border-[#f1cccc]/70 py-1 first:border-t-0">
                            <span className="font-mono text-foreground">{item.spu_code}</span>
                            <span className="min-w-0 flex-1">{item.error || "未知失败原因"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        </ScrollArea>
        {tasks.length > TASK_PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span>第 {visiblePageIndex + 1} / {totalPages} 页 · 共 {formatNumber(tasks.length)} 个任务</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={visiblePageIndex === 0}
                onClick={() => setPageIndex((current) => Math.max(0, Math.min(current, totalPages - 1) - 1))}
              >
                <ChevronLeft className="size-3.5" />
                上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={visiblePageIndex >= totalPages - 1}
                onClick={() => setPageIndex((current) => Math.min(totalPages - 1, Math.min(current, totalPages - 1) + 1))}
              >
                下一页
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
