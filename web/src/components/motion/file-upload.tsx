// Adapted from beUI File Upload (MIT). See web/BEUI-LICENSE.txt.
// Keep the queue presentation; use the project's dropzone validation and real request state.
import { useState } from "react"
import { useDropzone, type Accept } from "react-dropzone"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { FileUp, Upload, X, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedBadge } from "./animated-badge"
import { cn } from "@/lib/utils"

export type UploadState = "queued" | "uploading" | "processing" | "success" | "error"

export function FileUpload({ file, onFileChange, accept, description, state = "queued", progress,
  error, disabled, maxSize, onRetry, label = "选择文件",
}: {
  file: File | null
  onFileChange: (file: File | null) => void
  accept: Accept
  description: string
  state?: UploadState
  progress?: number
  error?: string
  disabled?: boolean
  maxSize?: number
  onRetry?: () => void
  label?: string
}) {
  const reduce = useReducedMotion()
  const [rejection, setRejection] = useState("")
  const busy = state === "uploading" || state === "processing"
  const locked = disabled || busy
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept, maxFiles: 1, multiple: false, maxSize, disabled: locked,
    onDropAccepted: ([next]) => { setRejection(""); if (next) onFileChange(next) },
    onDropRejected: (files) => {
      const codes = files.flatMap((entry) => entry.errors.map((entry) => entry.code))
      setRejection(codes.includes("file-too-large") ? "文件超过大小限制，请重新选择。"
        : codes.includes("too-many-files") ? "每次请选择一个文件。" : "文件格式不支持，请按提示选择。")
    },
  })
  const status = busy ? "loading" : state === "error" ? "danger" : state === "success" ? "success" : "neutral"
  const labels: Record<UploadState, string> = { queued: "待提交", uploading: "上传中", processing: "处理中", success: "已完成", error: "未完成" }
  return (
    <div className="space-y-3">
      <div {...getRootProps()} aria-label={label} aria-disabled={locked} className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        isDragActive ? "border-[var(--brand-deep)] bg-[var(--brand-light)]" : "border-input bg-muted/40 hover:bg-accent/40",
        locked && "pointer-events-none opacity-60",
      )}>
        <input {...getInputProps()} aria-label={label} />
        <Upload className="size-5 shrink-0 text-[var(--brand-deep)]" />
        <div className="min-w-0"><p className="text-sm font-medium">{isDragActive ? "松开以选择文件" : "拖拽文件到此处，或点击选择"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
      </div>
      <AnimatePresence initial={false}>
        {file && <motion.div key={`${file.name}-${file.lastModified}`} initial={{ opacity: 0, y: reduce ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.16 }} className="rounded-xl border p-3">
          <div className="flex items-center gap-2">
            <FileUp className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm" title={file.name}>{file.name}</p><p className="text-xs tabular-nums text-muted-foreground">{file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1024 / 1024).toFixed(2)} MB`}</p></div>
            <AnimatedBadge status={status} size="sm" pulse={false}>{labels[state]}</AnimatedBadge>
            {state === "error" && onRetry && <Button type="button" variant="ghost" size="icon-sm" disabled={locked} aria-label="重试文件" onClick={onRetry}><RotateCcw className="size-4" /></Button>}
            <Button type="button" variant="ghost" size="icon-sm" disabled={locked} aria-label="移除文件" onClick={() => { setRejection(""); onFileChange(null) }}><X className="size-4" /></Button>
          </div>
          {state === "uploading" && progress != null && <div className="mt-3" role="progressbar" aria-label="文件上传进度" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full origin-left bg-[var(--brand)]" style={{ transform: `scaleX(${Math.max(0, Math.min(100, progress)) / 100})` }} /></div>
            <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{Math.round(progress)}%</p>
          </div>}
          {state === "processing" && <p role="status" className="mt-2 text-xs text-muted-foreground">{progress === 100 ? "文件已上传，正在等待解析与处理结果…" : "正在提交并处理文件，请稍候…"}</p>}
          {error && <p role="alert" className="mt-2 break-words text-xs text-destructive">{error}</p>}
        </motion.div>}
      </AnimatePresence>
      {rejection && <p role="alert" className="text-xs text-destructive">{rejection}</p>}
    </div>
  )
}
