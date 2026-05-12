import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Barcode, Printer, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"

interface BarcodeSizeRow {
  id: number
  barcode: string
  skcName: string
  skuCode: string
  sizeText: string
  traceId: string
  lastSyncedAt: string
}

interface PrintTask {
  id: number
  status: string
  barcodeUrl: string
  traceId: string
  errorMessage: string
  createdByUsername: string
  createdAt: string
  items: Array<{
    id: number
    orderNo: string
    supplierSku: string
    skuCode: string
    printNumber: number
    barcode: string
    errorMessages: string[]
  }>
}

export default function SheinBarcodeSizePage() {
  const queryClient = useQueryClient()
  const [barcodeText, setBarcodeText] = useState("")
  const [printSku, setPrintSku] = useState("")
  const [printSupplierSku, setPrintSupplierSku] = useState("")
  const [printOrderNo, setPrintOrderNo] = useState("")
  const [printNumber, setPrintNumber] = useState("1")
  const sizesQuery = useQuery<{ items: BarcodeSizeRow[] }>({
    queryKey: ["shein-operations", "barcode-sizes"],
    queryFn: () => api.get("/shein-operations/barcodes/sizes"),
  })
  const tasksQuery = useQuery<{ items: PrintTask[] }>({
    queryKey: ["shein-operations", "barcode-print-tasks"],
    queryFn: () => api.get("/shein-operations/barcodes/print-tasks"),
  })
  const syncMutation = useMutation({
    mutationFn: () => api.post<{ persistence: { synced: number; requested: number } }>("/shein-operations/barcodes/batch-skc-size", {
      barcodes: barcodeText,
    }),
    onSuccess: (result) => {
      toast.success(`条码尺码已同步：${formatNumber(result.persistence.synced)} / ${formatNumber(result.persistence.requested)}`)
      queryClient.invalidateQueries({ queryKey: ["shein-operations", "barcode-sizes"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "条码尺码同步失败"),
  })
  const printMutation = useMutation({
    mutationFn: () => api.post("/shein-operations/barcodes/print", {
      data: [
        {
          orderNo: printOrderNo || null,
          supplierSku: printSupplierSku || null,
          sheinSku: printSku,
          printNumber: Number(printNumber) || 1,
        },
      ],
    }),
    onSuccess: () => {
      toast.success("条码打印任务已创建")
      queryClient.invalidateQueries({ queryKey: ["shein-operations", "barcode-print-tasks"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "创建打印任务失败"),
  })

  const sizeRows = sizesQuery.data?.items ?? []
  const tasks = tasksQuery.data?.items ?? []

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="条码尺码"
        description="接入 batch-skc-size 和 print-barcode，批量回捞条码对应 SKC/SKU/尺码，并把打印变成可追踪任务。"
      >
        <Button variant="outline" onClick={() => sizesQuery.refetch()} disabled={sizesQuery.isFetching}>
          <RefreshCw className={sizesQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
          刷新
        </Button>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle>条码尺码对账</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={barcodeText}
              onChange={(event) => setBarcodeText(event.target.value)}
              className="min-h-28"
              placeholder="粘贴商品条码，支持换行、逗号、空格分隔"
            />
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <Barcode className="size-4" />
              batch-skc-size
            </Button>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>条码</TableHead>
                    <TableHead>SKC</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>尺码</TableHead>
                    <TableHead>同步时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sizeRows.length ? sizeRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.barcode}</TableCell>
                      <TableCell className="font-mono text-xs">{row.skcName || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.skuCode || "—"}</TableCell>
                      <TableCell>{row.sizeText || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.lastSyncedAt)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        暂无条码尺码快照。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>打印任务</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="grid gap-2">
                <Label>SHEIN SKU</Label>
                <Input value={printSku} onChange={(event) => setPrintSku(event.target.value.trim())} placeholder="sku_code / sheinSku" />
              </div>
              <div className="grid gap-2">
                <Label>商家 SKU</Label>
                <Input value={printSupplierSku} onChange={(event) => setPrintSupplierSku(event.target.value.trim())} placeholder="可选" />
              </div>
              <div className="grid gap-2">
                <Label>采购单号</Label>
                <Input value={printOrderNo} onChange={(event) => setPrintOrderNo(event.target.value.trim())} placeholder="可选" />
              </div>
              <div className="grid gap-2">
                <Label>份数</Label>
                <Input type="number" min="1" value={printNumber} onChange={(event) => setPrintNumber(event.target.value)} />
              </div>
            </div>
            <Button onClick={() => printMutation.mutate()} disabled={printMutation.isPending}>
              <Printer className="size-4" />
              print-barcode
            </Button>
            <div className="space-y-2">
              {tasks.length ? tasks.map((task) => (
                <div key={task.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">打印任务 #{task.id}</div>
                    <Badge variant={task.status === "SUCCESS" ? "secondary" : task.status === "FAILED" ? "destructive" : "outline"}>
                      {task.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(task.createdAt)}</div>
                  {task.barcodeUrl ? (
                    <a href={task.barcodeUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm text-[var(--brand-deep)] hover:underline">
                      下载条码
                    </a>
                  ) : null}
                  {task.errorMessage ? <p className="mt-2 text-xs text-destructive">{task.errorMessage}</p> : null}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {task.items.map((item) => item.skuCode || item.supplierSku).filter(Boolean).join(" / ") || "—"}
                  </div>
                </div>
              )) : (
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  暂无打印任务。
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
