// Status enums and color mappings for the application

export type ListingStatus =
  | "DRAFT"
  | "NEEDS_ENRICHMENT"
  | "READY_TO_VALIDATE"
  | "VALIDATING"
  | "VALIDATION_FAILED"
  | "READY_TO_PUBLISH"
  | "ASSET_TRANSFORMING"
  | "ASSET_FAILED"
  | "PUBLISHING"
  | "PUBLISH_FAILED"
  | "PUBLISH_SUBMITTED"
  | "RECEIVE_CONFIRMED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PARTIALLY_APPROVED"
  | "CANCELLED"

export type ValidationSeverity = "BLOCKER" | "WARNING" | "INFO"

export type FieldSource = "MDM" | "DEEPDRAW" | "RULE" | "MANUAL" | "PLATFORM"

export type StatusToneClass =
  | "draft"
  | "pending"
  | "processing"
  | "warning"
  | "error"
  | "success"

export const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "草稿",
  NEEDS_ENRICHMENT: "待补充",
  READY_TO_VALIDATE: "待校验",
  VALIDATING: "校验中",
  VALIDATION_FAILED: "校验失败",
  READY_TO_PUBLISH: "可发布",
  ASSET_TRANSFORMING: "图片转储中",
  ASSET_FAILED: "图片失败",
  PUBLISHING: "发布中",
  PUBLISH_FAILED: "发布失败",
  PUBLISH_SUBMITTED: "已提交",
  RECEIVE_CONFIRMED: "平台已收",
  UNDER_REVIEW: "审核中",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  PARTIALLY_APPROVED: "部分通过",
  CANCELLED: "已取消",
}

export const STATUS_TONES: Record<ListingStatus, StatusToneClass> = {
  DRAFT: "draft",
  NEEDS_ENRICHMENT: "warning",
  READY_TO_VALIDATE: "pending",
  VALIDATING: "processing",
  VALIDATION_FAILED: "error",
  READY_TO_PUBLISH: "pending",
  ASSET_TRANSFORMING: "processing",
  ASSET_FAILED: "error",
  PUBLISHING: "processing",
  PUBLISH_FAILED: "error",
  PUBLISH_SUBMITTED: "pending",
  RECEIVE_CONFIRMED: "pending",
  UNDER_REVIEW: "processing",
  APPROVED: "success",
  REJECTED: "error",
  PARTIALLY_APPROVED: "warning",
  CANCELLED: "draft",
}

export const SEVERITY_LABELS: Record<ValidationSeverity, string> = {
  BLOCKER: "阻断",
  WARNING: "警告",
  INFO: "提示",
}

export const SEVERITY_TONES: Record<ValidationSeverity, StatusToneClass> = {
  BLOCKER: "error",
  WARNING: "warning",
  INFO: "pending",
}

export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  MDM: "MDM",
  DEEPDRAW: "深绘",
  RULE: "规则",
  MANUAL: "人工",
  PLATFORM: "平台",
}

export const FIELD_SOURCE_TONES: Record<FieldSource, StatusToneClass> = {
  MDM: "pending",
  DEEPDRAW: "processing",
  RULE: "warning",
  MANUAL: "draft",
  PLATFORM: "success",
}

// Tone → Tailwind class
export const TONE_CLASSES: Record<StatusToneClass, string> = {
  draft:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200",
  pending:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  processing:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  error:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300",
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
}
