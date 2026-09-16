import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileUpload } from "@/components/motion/file-upload"

interface ImportDialogProps {
  trigger: React.ReactNode
  title: string
  description?: string
  accept?: Record<string, string[]>
  onImport: (file: File) => void | Promise<void>
}

export function ImportDialog({
  trigger,
  title,
  description,
  accept = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
      ".xlsx",
    ],
    "text/csv": [".csv"],
  },
  onImport,
}: ImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState("")

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError("")
    try {
      await onImport(file)
      setFile(null)
      setOpen(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : "导入失败，请检查文件后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) { setOpen(next); if (!next) { setFile(null); setError("") } } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <FileUpload
          file={file}
          onFileChange={(next) => { setFile(next); setError("") }}
          accept={accept}
          description={Object.values(accept).flat().join(" / ")}
          state={loading ? "processing" : error ? "error" : "queued"}
          error={error}
          onRetry={() => { void handleImport() }}
        />
        <DialogFooter>
          <Button variant="outline" disabled={loading} onClick={() => { setOpen(false); setFile(null); setError("") }}>
            取消
          </Button>
          <Button onClick={handleImport} disabled={!file || loading}>
            {loading ? "导入中…" : "导入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
