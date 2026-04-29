import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileSpreadsheet, X } from "lucide-react"
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
import { cn } from "@/lib/utils"

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
    "application/vnd.ms-excel": [".xls"],
    "text/csv": [".csv"],
  },
  onImport,
}: ImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
  })

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    try {
      await onImport(file)
      setFile(null)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <div
          {...getRootProps()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 cursor-pointer transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50",
          )}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-emerald-600" />
              <span className="text-sm">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                }}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                拖拽文件到此处，或点击选择
              </p>
              <p className="text-xs text-muted-foreground">
                .xlsx / .xls / .csv
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
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
