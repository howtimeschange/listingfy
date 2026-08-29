type BackgroundTaskLane =
  | "product_archive_sync"
  | "product_archive_draft"
  | "product_archive_ocr"
  | "product_archive_ai_fill"
  | "product_archive_precheck"
  | "product_archive_publish"
  | "listing_launch_plan_import"
  | "category_mapping_ai_suggestions"
  | "shein_platform_product_sync"
  | "shein_platform_product_export"

type BackgroundTaskWaiter = {
  lane: BackgroundTaskLane
  resolve: (release: () => void) => void
}

const DEFAULT_MAX_ACTIVE = 2
const MAX_ACTIVE_CAP = 8

let activeCount = 0
const waiters: BackgroundTaskWaiter[] = []
const activeByLane = new Map<BackgroundTaskLane, number>()

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.floor(number)))
}

export function backgroundTaskMaxActive() {
  return boundedInteger(
    process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE,
    DEFAULT_MAX_ACTIVE,
    1,
    MAX_ACTIVE_CAP,
  )
}

function releaseBackgroundTaskSlot(lane: BackgroundTaskLane) {
  activeCount = Math.max(0, activeCount - 1)
  activeByLane.set(lane, Math.max(0, (activeByLane.get(lane) ?? 0) - 1))
  const waiter = waiters.shift()
  if (!waiter) return
  activeCount += 1
  activeByLane.set(waiter.lane, (activeByLane.get(waiter.lane) ?? 0) + 1)
  waiter.resolve(() => releaseBackgroundTaskSlot(waiter.lane))
}

export function acquireBackgroundTaskSlot(lane: BackgroundTaskLane) {
  if (activeCount < backgroundTaskMaxActive()) {
    activeCount += 1
    activeByLane.set(lane, (activeByLane.get(lane) ?? 0) + 1)
    return Promise.resolve(() => releaseBackgroundTaskSlot(lane))
  }
  return new Promise<() => void>((resolve) => {
    waiters.push({ lane, resolve })
  })
}

export async function withBackgroundTaskSlot<T>(
  lane: BackgroundTaskLane,
  run: () => Promise<T>,
) {
  const release = await acquireBackgroundTaskSlot(lane)
  try {
    return await run()
  } finally {
    release()
  }
}

export function backgroundTaskLimiterSnapshot() {
  return {
    maxActive: backgroundTaskMaxActive(),
    activeCount,
    queuedCount: waiters.length,
    activeByLane: Object.fromEntries(activeByLane.entries()),
  }
}
