export interface PublishFailureGroup {
  category: string
  fingerprint: string
  count: number
  retryable_count: number
  sample_error_code: string | null
  sample_error_message: string | null
  last_seen_at: string | null
}

export interface BatchPublishSummary {
  platform: string
  batch_no: string
  total_listings: number
  total_tasks: number
  retryable_failed_tasks: number
  by_listing_status: Record<string, number>
  by_task_status: Record<string, number>
  failure_groups: PublishFailureGroup[]
}

export function emptyBatchPublishSummary(batchNo = ""): BatchPublishSummary {
  return {
    platform: "SHEIN",
    batch_no: batchNo,
    total_listings: 0,
    total_tasks: 0,
    retryable_failed_tasks: 0,
    by_listing_status: {},
    by_task_status: {},
    failure_groups: [],
  }
}

export function parseBatchPublishSummary(value: unknown, batchNo = ""): BatchPublishSummary {
  if (value && typeof value === "object") {
    return { ...emptyBatchPublishSummary(batchNo), ...(value as Partial<BatchPublishSummary>) }
  }
  if (!value || typeof value !== "string") return emptyBatchPublishSummary(batchNo)
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object"
      ? { ...emptyBatchPublishSummary(batchNo), ...(parsed as Partial<BatchPublishSummary>) }
      : emptyBatchPublishSummary(batchNo)
  } catch {
    return emptyBatchPublishSummary(batchNo)
  }
}
