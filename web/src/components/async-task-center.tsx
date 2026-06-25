import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Activity, AlertCircle, CheckCircle2, Clock, Download, Trash2 } from "lucide-react"
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

function readStoredTasks() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(TASK_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as AsyncTaskRecord[] : []
  } catch {
    return []
  }
}

function taskProgress(job?: AsyncTaskJob | null) {
  if (!job?.total_count) return 0
  return Math.round(((job.completed_count + job.failed_count) / job.total_count) * 100)
}

function activeTaskCount(tasks: AsyncTaskRecord[]) {
  return tasks.filter((task) => task.job?.status !== "completed").length
}

function failedItems(task: AsyncTaskRecord) {
  return task.job?.items?.filter((item) => item.status === "failed") ?? []
}

export function AsyncTaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<AsyncTaskRecord[]>(() => readStoredTasks())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks.slice(0, 30)))
  }, [tasks])

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
    if (activeTaskCount(tasks) === 0) return
    const timer = window.setInterval(() => {
      void refreshTasks()
    }, 1500)
    return () => window.clearInterval(timer)
  }, [refreshTasks, tasks])

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
      return [record, ...current.filter((task) => task.id !== input.job.id)].slice(0, 30)
    })
  }, [])

  const value = useMemo<AsyncTaskContextValue>(() => ({
    tasks,
    addTask,
    getTaskByJobId: (jobId) => tasks.find((task) => task.id === jobId) ?? null,
    openTaskCenter: () => setOpen(true),
    closeTaskCenter: () => setOpen(false),
    removeTask: (taskId) => setTasks((current) => current.filter((task) => task.id !== taskId)),
  }), [addTask, tasks])

  return (
    <AsyncTaskContext.Provider value={value}>
      {children}
      <AsyncTaskDrawer open={open} onOpenChange={setOpen} tasks={tasks} onRemoveTask={value.removeTask} />
    </AsyncTaskContext.Provider>
  )
}

export function AsyncTaskTrigger() {
  const { tasks, openTaskCenter } = useAsyncTasks()
  const activeCount = activeTaskCount(tasks)
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
      {activeCount > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--brand)] px-1 text-center text-[10px] font-semibold text-white">
          {activeCount}
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>异步任务</SheetTitle>
          <SheetDescription>
            统一查看 MDM 同步、批量建档、导出等后台任务进度。
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          <div className="grid gap-3">
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                暂无后台任务。
              </div>
            ) : tasks.map((task) => {
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
      </SheetContent>
    </Sheet>
  )
}
