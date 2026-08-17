import { createContext, useContext } from "react"

export const ASYNC_TASK_STORAGE_KEY = "listingify.asyncTasks.v1"
export const ASYNC_TASK_SEEN_STORAGE_KEY = "listingify.asyncTasks.lastSeenAt.v1"

export function asyncTaskStorageKeys(userId: number) {
  return {
    tasks: `${ASYNC_TASK_STORAGE_KEY}.user.${userId}`,
    seen: `${ASYNC_TASK_SEEN_STORAGE_KEY}.user.${userId}`,
  }
}

export function clearAsyncTaskStorage(userId: number | null | undefined) {
  if (typeof window === "undefined" || userId == null) return
  const keys = asyncTaskStorageKeys(userId)
  window.localStorage.removeItem(keys.tasks)
  window.localStorage.removeItem(keys.seen)
}

export interface AsyncTaskJobItem {
  spu_code: string
  status: "queued" | "running" | "retrying" | "completed" | "failed"
  error?: string | null
  result?: unknown
  attempt_count?: number | null
  max_attempts?: number | null
  next_retry_at?: string | null
}

export interface AsyncTaskJob {
  id: string
  status: "queued" | "running" | "completed"
  outcome?: "succeeded" | "partial_failure" | "failed" | string | null
  total_count: number
  completed_count: number
  failed_count: number
  created_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  items?: AsyncTaskJobItem[]
  current_item?: AsyncTaskJobItem | null
  failed_items?: AsyncTaskJobItem[]
  queued_count?: number
  running_count?: number
  shard_count?: number
  shard_size?: number
  downloadUrl?: string
  fileName?: string
  result?: unknown
}

export interface AsyncTaskRecord {
  id: string
  type: "product_archive_mdm_draft" | "product_archive_hangtag_washlabel_ocr" | "product_archive_ai_fill" | "product_archive_publish_precheck" | "product_archive_publish" | "listing_launch_plan_import" | "category_mapping_ai_suggestions" | "shein_platform_product_sync" | "shein_platform_product_export"
  title: string
  description?: string
  endpoint: string
  createdAt: string
  job?: AsyncTaskJob | null
  lastError?: string | null
}

export interface AddTaskInput {
  job: AsyncTaskJob
  type: AsyncTaskRecord["type"]
  title: string
  description?: string
  endpoint?: string
}

export interface AsyncTaskContextValue {
  tasks: AsyncTaskRecord[]
  activeTaskCount: number
  unreadCompletedCount: number
  addTask: (input: AddTaskInput) => void
  getTaskByJobId: (jobId: string | null | undefined) => AsyncTaskRecord | null
  openTaskCenter: () => void
  closeTaskCenter: () => void
  removeTask: (taskId: string) => void
}

export const AsyncTaskContext = createContext<AsyncTaskContextValue | null>(null)

export function useAsyncTasks() {
  const context = useContext(AsyncTaskContext)
  if (!context) throw new Error("useAsyncTasks must be used within AsyncTaskProvider")
  return context
}
