import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Activity, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, CircleStop, Clock, Download, Loader2, RotateCcw, Trash2 } from "lucide-react"
import { api } from "@/lib/api-client"
import {
  AsyncTaskContext,
  asyncTaskStorageKeys,
  useAsyncTasks,
  type AddTaskInput,
  type AsyncTaskJob,
  type AsyncTaskJobItem,
  type AsyncTaskRecord,
  type AsyncTaskContextValue,
} from "@/lib/async-task-context"
import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/lib/api-client"
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
import { ConfirmDialog } from "@/components/confirm-dialog"

const TASK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const TASK_CLEANUP_INTERVAL_MS = 10 * 60 * 1000
const TASK_PAGE_SIZE = 5
const MAX_STORED_TASKS = 100

type AsyncTaskActionResponse = {
  ok?: boolean
  deleted?: boolean
  missing?: boolean
  message?: string
  job?: AsyncTaskJob | null
}

function readStoredTasks(userId: number | null) {
  if (typeof window === "undefined") return []
  if (userId == null) return []
  try {
    const raw = window.localStorage.getItem(asyncTaskStorageKeys(userId).tasks)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? retainedTasks(parsed as AsyncTaskRecord[]) : []
  } catch {
    return []
  }
}

function readStoredSeenAt(userId: number | null) {
  if (typeof window === "undefined") return ""
  if (userId == null) return ""
  return window.localStorage.getItem(asyncTaskStorageKeys(userId).seen) ?? ""
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
  const progress = Math.round(((job.completed_count + job.failed_count) / job.total_count) * 100)
  if (job.status !== "completed") return Math.min(99, progress)
  return progress
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
  return task.job?.failed_items ?? task.job?.items?.filter((item) => item.status === "failed") ?? []
}

function legacyRunningItem(items: AsyncTaskJob["items"]) {
  return items?.find((item) => item.status === "running" || item.status === "retrying") ?? null
}

function runningTaskItem(task: AsyncTaskRecord) {
  return task.job?.current_item ?? legacyRunningItem(task.job?.items)
}

function runningTaskItems(task: AsyncTaskRecord) {
  const currentItems = task.job?.current_items?.filter((item) => item.status === "running" || item.status === "retrying") ?? []
  if (currentItems.length > 0) return currentItems
  const item = runningTaskItem(task)
  return item ? [item] : []
}

function asyncTaskEndpoint(type: AsyncTaskRecord["type"], jobId: string) {
  switch (type) {
    case "product_archive_hangtag_washlabel_ocr":
      return `/product-archive-drafts/hangtag-washlabel-ocr/jobs/${jobId}`
    case "product_archive_ai_fill":
      return `/product-archive-drafts/ai-fill-jobs/${jobId}`
    case "product_archive_publish_precheck":
      return `/product-archive-drafts/precheck-jobs/${jobId}`
    case "product_archive_publish":
      return `/product-archive-drafts/publish-jobs/${jobId}`
    case "listing_launch_plan_import":
      return `/listing-launch-plans/import-jobs/${jobId}`
    case "category_mapping_ai_suggestions":
      return `/category-mapping/ai-suggestions/jobs/${jobId}`
    case "shein_platform_product_sync":
      return `/shein-platform-products/sync-jobs/${jobId}`
    case "shein_platform_product_export":
      return `/shein-platform-products/export-jobs/${jobId}`
    default:
      return `/product-archive-drafts/batch-jobs/${jobId}`
  }
}

function canRequeueTask(task: AsyncTaskRecord) {
  const job = task.job
  if (job?.status !== "completed") return false
  if (task.type === "listing_launch_plan_import") return false
  if (job.outcome === "stopped" || job.outcome === "failed" || job.outcome === "partial_failure") return true
  return (job.failed_count ?? 0) > 0 || (job.total_count ?? 0) > (job.completed_count ?? 0)
}

function numberResultValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function textResultValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function recordResultValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function hangtagWashlabelOcrTaskSummary(task: AsyncTaskRecord) {
  if (task.type !== "product_archive_hangtag_washlabel_ocr") return null
  const result = recordResultValue(task.job?.result)
  const applySummary = recordResultValue(result?.applySummary)
  if (!applySummary) return null
  const previewSummary = recordResultValue(result?.previewSummary)
  const imageImportSummary = recordResultValue(result?.imageImportSummary)
  return {
    appliedDraftCount: numberResultValue(applySummary.appliedDraftCount),
    appliedFieldCount: numberResultValue(applySummary.appliedFieldCount),
    skippedCount: numberResultValue(applySummary.skippedCount),
    matchedCount: numberResultValue(previewSummary?.matchedCount),
    importedImageCount: numberResultValue(imageImportSummary?.importedCount),
    overwriteExisting: result?.overwriteExisting === true,
  }
}

function aiFillTaskSummary(task: AsyncTaskRecord) {
  if (task.type !== "product_archive_ai_fill") return null
  const result = recordResultValue(task.job?.result)
  const items = task.job?.items ?? []
  const processedItems = items.filter((item) => item.status === "completed")
  const itemSavedFieldCount = processedItems.reduce((sum, item) => (
    sum + numberResultValue(recordResultValue(item.result)?.savedCount)
  ), 0)
  const itemWarningCount = processedItems.reduce((sum, item) => (
    sum + numberResultValue(recordResultValue(item.result)?.warningCount)
  ), 0)
  return {
    processedDraftCount: numberResultValue(result?.processedDraftCount) || processedItems.length,
    savedFieldCount: numberResultValue(result?.savedFieldCount) || itemSavedFieldCount,
    warningCount: numberResultValue(result?.warningCount) || itemWarningCount,
  }
}

function precheckTaskSummary(task: AsyncTaskRecord) {
  if (task.type !== "product_archive_publish_precheck") return null
  const result = recordResultValue(task.job?.result)
  return {
    precheckPassedCount: numberResultValue(result?.precheckPassedCount),
    validationFailedCount: numberResultValue(result?.validationFailedCount),
    duplicateCount: numberResultValue(result?.duplicateCount),
    previewGeneratedCount: numberResultValue(result?.previewGeneratedCount),
    warningCount: numberResultValue(result?.warningCount),
  }
}

function precheckTaskItems(task: AsyncTaskRecord) {
  if (task.type !== "product_archive_publish_precheck") return []
  return task.job?.items ?? []
}

function precheckItemResultKind(item: AsyncTaskJobItem) {
  return textResultValue(recordResultValue(item.result)?.resultKind)
}

function precheckItemStatusLabel(item: AsyncTaskJobItem) {
  if (item.status === "completed") return "通过"
  if (item.status === "failed") {
    const resultKind = precheckItemResultKind(item)
    if (resultKind === "duplicate_found") return "重复"
    if (resultKind === "validation_failed" || resultKind === "preview_validation_failed") return "未通过"
    return "失败"
  }
  if (item.status === "retrying") return "等待重试"
  if (item.status === "running") return "预检中"
  return "排队中"
}

function precheckItemStatusClass(item: AsyncTaskJobItem) {
  if (item.status === "completed") return "text-[#0f7f58]"
  if (item.status === "failed") return "text-[#d45656]"
  return "text-[#3772cf]"
}

function precheckItemReason(item: AsyncTaskJobItem) {
  const result = recordResultValue(item.result)
  const message = textResultValue(result?.message ?? result?.reason)
  if (message) return message
  if (item.status === "failed") return item.error || "未知失败原因"
  if (item.status === "retrying") return item.error ? `接口繁忙，${item.error}` : "接口繁忙，等待自动重试"
  if (item.status === "running") return "正在依次执行校验、查重和提交预览"
  if (item.status === "queued") return "等待后台预检"
  return "预检通过，可批量发布到深绘"
}

function publishTaskSummary(task: AsyncTaskRecord) {
  if (task.type !== "product_archive_publish") return null
  const result = recordResultValue(task.job?.result)
  return {
    publishedCount: numberResultValue(result?.publishedCount),
    duplicateCount: numberResultValue(result?.duplicateCount),
    readbackMismatchCount: numberResultValue(result?.readbackMismatchCount),
    retryAttemptCount: numberResultValue(result?.retryAttemptCount),
  }
}

function publishTaskItems(task: AsyncTaskRecord) {
  if (task.type !== "product_archive_publish") return []
  return task.job?.items ?? []
}

function publishItemResultKind(item: AsyncTaskJobItem) {
  return textResultValue(recordResultValue(item.result)?.resultKind)
}

function publishItemStatusLabel(item: AsyncTaskJobItem) {
  if (item.status === "completed") {
    const resultKind = publishItemResultKind(item)
    if (resultKind === "duplicate_found") return "已存在"
    if (resultKind === "readback_mismatch") return "需复核"
    if (resultKind === "submitted") return "已提交"
    return "成功"
  }
  if (item.status === "failed") return "失败"
  if (item.status === "retrying") return "等待重试"
  if (item.status === "running") return "处理中"
  return "排队中"
}

function publishItemStatusClass(item: AsyncTaskJobItem) {
  if (item.status === "failed") return "text-[#d45656]"
  if (item.status !== "completed") return "text-[#3772cf]"
  const resultKind = publishItemResultKind(item)
  if (resultKind === "readback_mismatch") return "text-[#a66b00]"
  if (resultKind === "duplicate_found" || resultKind === "submitted") return "text-[#3772cf]"
  return "text-[#0f7f58]"
}

function publishItemReason(item: AsyncTaskJobItem) {
  const result = recordResultValue(item.result)
  const message = textResultValue(result?.message ?? result?.reason)
  if (message) return message
  if (item.status === "failed") return item.error || "未知失败原因"
  if (item.status === "retrying") return item.error ? `接口繁忙，${item.error}` : "接口繁忙，等待自动重试"
  if (item.status === "running") return "正在提交和回读校验"
  if (item.status === "queued") return "等待后台处理"
  const resultKind = publishItemResultKind(item)
  if (resultKind === "published") return "已发布并回读一致"
  if (resultKind === "duplicate_found") return "深绘已存在同货号商品"
  if (resultKind === "readback_mismatch") return "已创建，但深绘回读不一致，请进详情复核"
  return "已处理完成"
}

export function AsyncTaskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [tasks, setTasks] = useState<AsyncTaskRecord[]>([])
  const [lastSeenAt, setLastSeenAt] = useState("")
  const [open, setOpen] = useState(false)
  const refreshInFlight = useRef<Promise<void> | null>(null)
  const refreshGeneration = useRef(0)
  const currentActiveTaskCount = useMemo(() => activeTaskCount(tasks), [tasks])
  const unreadCompletedCount = useMemo(
    () => unreadCompletedTaskCount(tasks, lastSeenAt),
    [lastSeenAt, tasks],
  )

  useEffect(() => {
    refreshGeneration.current += 1
    // User identity changes are an external storage boundary; reset in-memory state immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTasks(readStoredTasks(userId))
    setLastSeenAt(readStoredSeenAt(userId))
    refreshInFlight.current = null
  }, [userId])

  useEffect(() => {
    if (userId == null) return
    const retained = retainedTasks(tasks)
    window.localStorage.setItem(asyncTaskStorageKeys(userId).tasks, JSON.stringify(retained))
  }, [tasks, userId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTasks((current) => retainedTasks(current))
    }, TASK_CLEANUP_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  const refreshTasks = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current
    const generation = refreshGeneration.current
    const activeTasks = tasks.filter((task) => task.job?.status !== "completed")
    if (activeTasks.length === 0) return
    const run = (async () => {
      const updates = await Promise.all(activeTasks.map(async (task) => {
        try {
          const job = await api.get<AsyncTaskJob>(task.endpoint)
          return { id: task.id, job, lastError: null, terminal: false }
        } catch (error) {
          const terminal = error instanceof ApiError && [401, 403, 404].includes(error.status)
          return {
            id: task.id,
            job: task.job ?? null,
            lastError: error instanceof Error ? error.message : String(error),
            terminal,
          }
        }
      }))
      if (generation !== refreshGeneration.current) return
      setTasks((current) => current
        .filter((task) => !updates.some((update) => update.id === task.id && update.terminal))
        .map((task) => {
          const update = updates.find((item) => item.id === task.id)
          return update ? { ...task, job: update.job, lastError: update.lastError } : task
        }))
    })()
    refreshInFlight.current = run
    try {
      await run
    } finally {
      if (refreshInFlight.current === run) refreshInFlight.current = null
    }
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
    if (userId != null) window.localStorage.setItem(asyncTaskStorageKeys(userId).seen, seenAt)
  }, [userId])

  const addTask = useCallback((input: AddTaskInput) => {
    if (userId == null) return
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
  }, [userId])

  const openTaskCenter = useCallback(() => {
    setOpen(true)
    markTasksSeen()
  }, [markTasksSeen])

  const closeTaskCenter = useCallback(() => {
    setOpen(false)
  }, [])

  const removeTask = useCallback((taskId: string) => {
    setTasks((current) => current.filter((task) => task.id !== taskId))
  }, [])

  const updateTask = useCallback((
    taskId: string,
    patch: Partial<Pick<AsyncTaskRecord, "job" | "lastError">>,
  ) => {
    setTasks((current) => current.map((task) => (
      task.id === taskId ? { ...task, ...patch } : task
    )))
  }, [])

  const value = useMemo<AsyncTaskContextValue>(() => ({
    tasks,
    activeTaskCount: currentActiveTaskCount,
    unreadCompletedCount,
    addTask,
    getTaskByJobId: (jobId) => tasks.find((task) => task.id === jobId) ?? null,
    openTaskCenter,
    closeTaskCenter,
    removeTask,
    updateTask,
  }), [addTask, closeTaskCenter, currentActiveTaskCount, openTaskCenter, removeTask, tasks, unreadCompletedCount, updateTask])

  return (
    <AsyncTaskContext.Provider value={value}>
      {children}
      <AsyncTaskDrawer open={open} onOpenChange={setOpen} tasks={tasks} onAddTask={addTask} onRemoveTask={removeTask} onUpdateTask={updateTask} />
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
      aria-label="任务中心"
    >
      <Activity className="size-4" />
      任务中心
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
  onAddTask,
  onRemoveTask,
  onUpdateTask,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: AsyncTaskRecord[]
  onAddTask: (input: AddTaskInput) => void
  onRemoveTask: (taskId: string) => void
  onUpdateTask: (taskId: string, patch: Partial<Pick<AsyncTaskRecord, "job" | "lastError">>) => void
}) {
  const [pageIndex, setPageIndex] = useState(0)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const totalPages = Math.max(1, Math.ceil(tasks.length / TASK_PAGE_SIZE))
  const visiblePageIndex = Math.min(pageIndex, totalPages - 1)
  const currentPageTasks = tasks.slice(visiblePageIndex * TASK_PAGE_SIZE, visiblePageIndex * TASK_PAGE_SIZE + TASK_PAGE_SIZE)

  const stopTask = useCallback(async (task: AsyncTaskRecord) => {
    setBusyTaskId(task.id)
    try {
      const result = await api.post<AsyncTaskActionResponse>(`/system/async-tasks/${task.type}/${encodeURIComponent(task.id)}/stop`, {})
      onUpdateTask(task.id, {
        job: result.job ?? task.job ?? null,
        lastError: null,
      })
    } catch (error) {
      onUpdateTask(task.id, {
        lastError: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusyTaskId((current) => (current === task.id ? null : current))
    }
  }, [onUpdateTask])

  const requeueTask = useCallback(async (task: AsyncTaskRecord) => {
    setBusyTaskId(task.id)
    try {
      const result = await api.post<AsyncTaskActionResponse>(`/system/async-tasks/${task.type}/${encodeURIComponent(task.id)}/requeue`, {})
      if (!result.job) throw new Error(result.message || "重新加入队列失败")
      onAddTask({
        job: result.job,
        type: task.type,
        title: `${task.title}（重新加入队列）`,
        description: "从原任务重新加入未完成项目，已成功的不会重复执行",
        endpoint: asyncTaskEndpoint(task.type, result.job.id),
      })
      onUpdateTask(task.id, { lastError: null })
      setPageIndex(0)
    } catch (error) {
      onUpdateTask(task.id, {
        lastError: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusyTaskId((current) => (current === task.id ? null : current))
    }
  }, [onAddTask, onUpdateTask])

  const deleteTask = useCallback(async (task: AsyncTaskRecord) => {
    setBusyTaskId(task.id)
    try {
      if (task.job?.status === "completed") {
        await api.delete<AsyncTaskActionResponse>(`/system/async-tasks/${task.type}/${encodeURIComponent(task.id)}`)
      } else {
        const result = await api.post<AsyncTaskActionResponse>(`/system/async-tasks/${task.type}/${encodeURIComponent(task.id)}/stop`, {})
        if (result.job) onUpdateTask(task.id, { job: result.job, lastError: null })
      }
      onRemoveTask(task.id)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        onRemoveTask(task.id)
        return
      }
      onUpdateTask(task.id, {
        lastError: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusyTaskId((current) => (current === task.id ? null : current))
    }
  }, [onRemoveTask, onUpdateTask])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>任务中心</SheetTitle>
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
              const runningItems = runningTaskItems(task)
              const runningItem = runningItems[0] ?? null
              const runningCount = Math.max(numberResultValue(job?.running_count), runningItems.length)
              const done = job?.status === "completed"
              const ocrSummary = hangtagWashlabelOcrTaskSummary(task)
              const aiFillSummary = aiFillTaskSummary(task)
              const precheckSummary = precheckTaskSummary(task)
              const precheckItems = precheckTaskItems(task)
              const publishSummary = publishTaskSummary(task)
              const publishItems = publishTaskItems(task)
              const busy = busyTaskId === task.id
              const canRequeue = canRequeueTask(task)
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
                      {!done && runningItem ? (
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                          {runningCount > 1
                            ? `当前并发 ${formatNumber(runningCount)} 个：${runningItems.slice(0, 3).map((item) => item.spu_code).join("、")}${runningCount > runningItems.length ? " 等" : ""}`
                            : `当前：${runningItem.spu_code}`}
                          {runningItem.status === "retrying" ? `，等待重试 ${formatDateTime(runningItem.next_retry_at)}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canRequeue ? (
                        <ConfirmDialog
                          title="重新加入队列？"
                          description="会从未完成项重新跑，已成功的不会重复执行；原任务记录会保留，方便后续排查。"
                          confirmLabel="重新加入队列"
                          cancelLabel="取消"
                          onConfirm={() => { void requeueTask(task) }}
                          trigger={(
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={busy}
                              aria-label="重新加入队列"
                              title="重新加入队列"
                            >
                              {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                            </Button>
                          )}
                        />
                      ) : null}
                      {!done ? (
                        <ConfirmDialog
                          title="暂停这个后台任务？"
                          description="确认后会请求后端停止任务，已经开始的当前步骤可能会先完成；未处理和等待重试的项目会标记为已停止，不会继续排队执行。"
                          confirmLabel="暂停任务"
                          cancelLabel="再等等"
                          variant="destructive"
                          onConfirm={() => { void stopTask(task) }}
                          trigger={(
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={busy}
                              aria-label="暂停任务"
                              title="暂停任务"
                            >
                              {busy ? <Loader2 className="size-4 animate-spin" /> : <CircleStop className="size-4" />}
                            </Button>
                          )}
                        />
                      ) : null}
                      <ConfirmDialog
                        title={done ? "删除这条任务记录？" : "停止并移除这条任务？"}
                        description={done
                          ? "确认后会删除后端已完成的任务记录，并从当前任务中心移除卡片。下载文件或历史排查资料如果还需要，请先确认已经处理完。"
                          : "这个任务仍在执行中。确认后会先请求后端停止任务，再从当前任务中心移除卡片；系统会保留停止记录，便于稍后排查。"}
                        confirmLabel={done ? "删除记录" : "停止并移除"}
                        cancelLabel="取消"
                        variant="destructive"
                        onConfirm={() => { void deleteTask(task) }}
                        trigger={(
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={busy}
                            aria-label={done ? "删除任务记录" : "停止并移除任务"}
                            title={done ? "删除任务记录" : "停止并移除任务"}
                          >
                            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                          </Button>
                        )}
                      />
                    </div>
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
                  {ocrSummary ? (
                    <div className="mt-3 rounded-md border border-[#b9f4d8] bg-[#f2fff8] px-2 py-1.5 text-xs text-[#0f7f58]">
                      已自动{ocrSummary.overwriteExisting ? "按覆盖模式写入" : "填充空字段"} {formatNumber(ocrSummary.appliedFieldCount)} 个，
                      匹配草稿 {formatNumber(ocrSummary.appliedDraftCount || ocrSummary.matchedCount)} 个，
                      参考图 {formatNumber(ocrSummary.importedImageCount)} 张，
                      跳过 {formatNumber(ocrSummary.skippedCount)} 个。
                    </div>
                  ) : null}
                  {aiFillSummary ? (
                    <div className="mt-3 rounded-md border border-[#b9d7ff] bg-[#f4f8ff] px-2 py-1.5 text-xs text-[#2f66b3]">
                      AI 已补齐 {formatNumber(aiFillSummary.savedFieldCount)} 个字段，
                      处理草稿 {formatNumber(aiFillSummary.processedDraftCount)} 个，
                      提示 {formatNumber(aiFillSummary.warningCount)} 条。
                    </div>
                  ) : null}
                  {precheckSummary ? (
                    <div className="mt-3 rounded-md border border-[#b9d7ff] bg-[#f4f8ff] px-2 py-1.5 text-xs text-[#2f66b3]">
                      预检通过 {formatNumber(precheckSummary.precheckPassedCount)} 个，
                      阻断 {formatNumber(precheckSummary.validationFailedCount)} 个，
                      重复 {formatNumber(precheckSummary.duplicateCount)} 个，
                      已生成预览 {formatNumber(precheckSummary.previewGeneratedCount)} 个。
                    </div>
                  ) : null}
                  {precheckItems.length > 0 ? (
                    <div className="mt-3 rounded-md border border-[#d7e0ee] bg-[#fbfdff] p-2">
                      <div className="mb-1 text-xs font-medium text-foreground">预检明细</div>
                      <div className="max-h-40 overflow-auto text-xs text-muted-foreground">
                        {precheckItems.map((item) => (
                          <div key={item.spu_code} className="grid grid-cols-[minmax(7rem,auto)_4rem_1fr] gap-2 border-t border-[#d7e0ee]/70 py-1 first:border-t-0">
                            <span className="font-mono text-foreground">{item.spu_code}</span>
                            <span className={precheckItemStatusClass(item)}>
                              {precheckItemStatusLabel(item)}
                            </span>
                            <span className="min-w-0">{precheckItemReason(item)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {publishSummary ? (
                    <div className="mt-3 rounded-md border border-[#b9f4d8] bg-[#f2fff8] px-2 py-1.5 text-xs text-[#0f7f58]">
                      发布成功 {formatNumber(publishSummary.publishedCount)} 个，
                      已存在 {formatNumber(publishSummary.duplicateCount)} 个，
                      回读不一致 {formatNumber(publishSummary.readbackMismatchCount)} 个，
                      自动重试 {formatNumber(publishSummary.retryAttemptCount)} 次。
                    </div>
                  ) : null}
                  {publishItems.length > 0 ? (
                    <div className="mt-3 rounded-md border border-[#d7e0ee] bg-[#fbfdff] p-2">
                      <div className="mb-1 text-xs font-medium text-foreground">发布明细</div>
                      <div className="max-h-40 overflow-auto text-xs text-muted-foreground">
                        {publishItems.map((item) => (
                          <div key={item.spu_code} className="grid grid-cols-[minmax(7rem,auto)_4rem_1fr] gap-2 border-t border-[#d7e0ee]/70 py-1 first:border-t-0">
                            <span className="font-mono text-foreground">{item.spu_code}</span>
                            <span className={publishItemStatusClass(item)}>
                              {publishItemStatusLabel(item)}
                            </span>
                            <span className="min-w-0">{publishItemReason(item)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
