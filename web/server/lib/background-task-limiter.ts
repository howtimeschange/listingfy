export type BackgroundTaskLane =
  | "product_archive_sync"
  | "product_archive_draft"
  | "product_archive_ocr"
  | "product_archive_ai_fill"
  | "product_archive_precheck"
  | "product_archive_publish"
  | "product_archive_source_import"
  | "listing_launch_plan_import"
  | "category_mapping_ai_suggestions"
  | "shein_platform_product_sync"
  | "shein_platform_product_export"

type BackgroundTaskWaiter = {
  lane: BackgroundTaskLane
  resolve: (release: () => void) => void
  reject: (error: Error) => void
  signal?: AbortSignal
  abortListener?: () => void
}

export type BackgroundTaskOptions = {
  signal?: AbortSignal
  timeoutMs?: number
}

const DEFAULT_MAX_ACTIVE = 2
const MAX_ACTIVE_CAP = 16
const DEFAULT_TASK_TIMEOUT_MS = 15 * 60 * 1000
const MAX_TASK_TIMEOUT_MS = 24 * 60 * 60 * 1000

let activeCount = 0
const waiters: BackgroundTaskWaiter[] = []
const activeByLane = new Map<BackgroundTaskLane, number>()

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.floor(number)))
}

function abortError(message: string) {
  const error = new Error(message)
  error.name = "AbortError"
  return error
}

export class BackgroundTaskTimeoutError extends Error {
  readonly code = "BACKGROUND_TASK_TIMEOUT"

  constructor(lane: BackgroundTaskLane, timeoutMs: number) {
    super(`后台任务 ${lane} 执行超过 ${timeoutMs}ms，已中止并释放执行槽位`)
    this.name = "BackgroundTaskTimeoutError"
  }
}

export function backgroundTaskMaxActive() {
  return boundedInteger(
    process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE,
    DEFAULT_MAX_ACTIVE,
    1,
    MAX_ACTIVE_CAP,
  )
}

export function backgroundTaskTimeoutMs(value?: unknown) {
  return boundedInteger(
    value ?? process.env.LISTINGIFY_BACKGROUND_TASK_TIMEOUT_MS,
    DEFAULT_TASK_TIMEOUT_MS,
    1,
    MAX_TASK_TIMEOUT_MS,
  )
}

function detachWaiterAbort(waiter: BackgroundTaskWaiter) {
  if (waiter.signal && waiter.abortListener) {
    waiter.signal.removeEventListener("abort", waiter.abortListener)
  }
}

function dispatchNextWaiter() {
  while (activeCount < backgroundTaskMaxActive()) {
    const waiter = waiters.shift()
    if (!waiter) return
    detachWaiterAbort(waiter)
    if (waiter.signal?.aborted) {
      waiter.reject(abortError("后台任务在等待执行槽位时已取消"))
      continue
    }
    activeCount += 1
    activeByLane.set(waiter.lane, (activeByLane.get(waiter.lane) ?? 0) + 1)
    waiter.resolve(() => releaseBackgroundTaskSlot(waiter.lane))
  }
}

function releaseBackgroundTaskSlot(lane: BackgroundTaskLane) {
  activeCount = Math.max(0, activeCount - 1)
  const laneCount = Math.max(0, (activeByLane.get(lane) ?? 0) - 1)
  if (laneCount === 0) activeByLane.delete(lane)
  else activeByLane.set(lane, laneCount)
  dispatchNextWaiter()
}

export function acquireBackgroundTaskSlot(
  lane: BackgroundTaskLane,
  options: Pick<BackgroundTaskOptions, "signal"> = {},
) {
  if (options.signal?.aborted) {
    return Promise.reject(abortError("后台任务在等待执行槽位前已取消"))
  }
  if (activeCount < backgroundTaskMaxActive()) {
    activeCount += 1
    activeByLane.set(lane, (activeByLane.get(lane) ?? 0) + 1)
    return Promise.resolve(() => releaseBackgroundTaskSlot(lane))
  }
  return new Promise<() => void>((resolve, reject) => {
    const waiter: BackgroundTaskWaiter = { lane, resolve, reject, signal: options.signal }
    waiter.abortListener = () => {
      const index = waiters.indexOf(waiter)
      if (index >= 0) waiters.splice(index, 1)
      detachWaiterAbort(waiter)
      reject(abortError("后台任务在等待执行槽位时已取消"))
    }
    options.signal?.addEventListener("abort", waiter.abortListener, { once: true })
    waiters.push(waiter)
  })
}

function linkAbortSignal(source: AbortSignal | undefined, target: AbortController) {
  if (!source) return () => undefined
  const abort = () => target.abort(source.reason)
  if (source.aborted) abort()
  else source.addEventListener("abort", abort, { once: true })
  return () => source.removeEventListener("abort", abort)
}

export async function withBackgroundTaskSlot<T>(
  lane: BackgroundTaskLane,
  run: (signal: AbortSignal) => Promise<T>,
  options: BackgroundTaskOptions = {},
) {
  const release = await acquireBackgroundTaskSlot(lane, options)
  const controller = new AbortController()
  const unlinkAbort = linkAbortSignal(options.signal, controller)
  const timeoutMs = backgroundTaskTimeoutMs(options.timeoutMs)
  let timer: ReturnType<typeof setTimeout> | null = null
  let removeCancellationListener: () => void = () => {}
  const cancellation = new Promise<never>((_resolve, reject) => {
    const cancel = () => reject(controller.signal.reason ?? abortError("后台任务已取消"))
    if (controller.signal.aborted) cancel()
    else {
      controller.signal.addEventListener("abort", cancel, { once: true })
      removeCancellationListener = () => controller.signal.removeEventListener("abort", cancel)
    }
  })
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new BackgroundTaskTimeoutError(lane, timeoutMs)
      controller.abort(error)
      reject(error)
    }, timeoutMs)
    timer.unref?.()
  })
  try {
    if (controller.signal.aborted) throw abortError("后台任务在开始执行前已取消")
    return await Promise.race([Promise.resolve().then(() => run(controller.signal)), timeout, cancellation])
  } finally {
    if (timer) clearTimeout(timer)
    removeCancellationListener()
    unlinkAbort()
    release()
  }
}

export function backgroundTaskLimiterSnapshot() {
  return {
    maxActive: backgroundTaskMaxActive(),
    taskTimeoutMs: backgroundTaskTimeoutMs(),
    activeCount,
    queuedCount: waiters.length,
    activeByLane: Object.fromEntries(activeByLane.entries()),
  }
}
