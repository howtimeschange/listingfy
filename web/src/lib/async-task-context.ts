import { createContext, useContext } from "react"

export interface AsyncTaskJobItem {
  spu_code: string
  status: "queued" | "running" | "completed" | "failed"
  error?: string | null
}

export interface AsyncTaskJob {
  id: string
  status: "queued" | "running" | "completed"
  total_count: number
  completed_count: number
  failed_count: number
  items?: AsyncTaskJobItem[]
}

export interface AsyncTaskRecord {
  id: string
  type: "product_archive_mdm_draft" | "category_mapping_ai_suggestions"
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
