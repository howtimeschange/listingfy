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
    "bg-[#fafafa] text-[#666666] border-[rgba(0,0,0,0.08)]",
  pending:
    "bg-[#eef5ff] text-[#3772cf] border-[#d7e5fb]",
  processing:
    "bg-[#d4fae8] text-[#0fa76e] border-[#b9f4d8]",
  warning:
    "bg-[#fff8e8] text-[#c37d0d] border-[#f4ddb3]",
  error:
    "bg-[#fff1f1] text-[#d45656] border-[#f1cccc]",
  success:
    "bg-[#d4fae8] text-[#0fa76e] border-[#b9f4d8]",
}
