import { useMemo, useState } from "react"
import { Link } from "react-router"
import { ArrowRight, PackagePlus, Search } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { ServerPagination, type ServerPaginationState } from "@/components/server-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

interface ListingBatch {
  id: number
  batch_no: string
  batch_name: string
  status: string
  source_type: string
  note: string | null
  created_at: string
  updated_at: string
  draft_count: number
  skc_count: number
  sku_count: number
  blocker_count: number
  draft_status_count: number
  publishing_count: number
  auditing_count: number
  approved_count: number
  failed_count: number
}

interface ListingBatchResponse {
  items: ListingBatch[]
  pagination: ServerPaginationState
}

function useListingBatches(params: { q: string; pagination: { limit: number; offset: number } }) {
  return useQuery<ListingBatchResponse>({
    queryKey: ["listing-batches", params],
    queryFn: () => {
      const search = new URLSearchParams({
        platform: "SHEIN",
        q: params.q,
        limit: String(params.pagination.limit),
        offset: String(params.pagination.offset),
      })
      return api.get(`/listing-batches?${search.toString()}`)
    },
  })
}

function statusClass(batch: ListingBatch) {
  if (Number(batch.failed_count ?? 0) > 0 || Number(batch.blocker_count ?? 0) > 0) return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  if (Number(batch.approved_count ?? 0) > 0 && Number(batch.approved_count ?? 0) === Number(batch.draft_count ?? 0)) return "border-[#b9f4d8] bg-[#f4fff9] text-[#0f8a5f]"
  if (Number(batch.auditing_count ?? 0) > 0 || Number(batch.publishing_count ?? 0) > 0) return "border-[#ead7ff] bg-[#f7f0ff] text-[#7c3ec5]"
  return "border-[#e7dccd] bg-[#f7f2eb] text-[#7f684c]"
}

export default function ListingBatchesPage() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState("")
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [batchName, setBatchName] = useState(`SHEIN 上新批次 ${new Date().toISOString().slice(0, 10)}`)
  const [batchSearch, setBatchSearch] = useState("")
  const { data, isLoading } = useListingBatches({ q, pagination })
  const items = data?.items ?? []
  const summary = useMemo(() => {
    const totalDrafts = items.reduce((sum, item) => sum + Number(item.draft_count ?? 0), 0)
    const blockers = items.reduce((sum, item) => sum + Number(item.blocker_count ?? 0), 0)
    return `批次 ${formatNumber(data?.pagination.total ?? 0)} / 当前页草稿 ${formatNumber(totalDrafts)} / 阻断 ${formatNumber(blockers)}`
  }, [data, items])
  const createMutation = useMutation({
    mutationFn: () => api.post<{ batch: ListingBatch; draft_count: number }>("/listing-batches", {
      batch_name: batchName,
      batch_search: batchSearch,
    }),
    onSuccess: (result) => {
      toast.success(`已创建批次并加入 ${formatNumber(result.draft_count)} 个草稿`)
      setDialogOpen(false)
      setBatchSearch("")
      queryClient.invalidateQueries({ queryKey: ["listing-batches"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "创建批次失败"),
  })

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="上新批次"
        description="按批次组织 SHEIN 发布草稿，跟踪草稿、校验、发布、审核状态。"
      >
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PackagePlus className="mr-2 size-4" />
              创建批次
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>创建 SHEIN 上新批次</DialogTitle>
              <DialogDescription>输入款号批量搜索已有 SHEIN 发布草稿，并统一归入一个批次。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Label className="grid gap-2">
                批次名称
                <Input value={batchName} onChange={(event) => setBatchName(event.target.value)} />
              </Label>
              <Label className="grid gap-2">
                款号批量搜索
                <Textarea
                  value={batchSearch}
                  onChange={(event) => setBatchSearch(event.target.value)}
                  placeholder="每行一个款号，例如 201122104105"
                  className="min-h-40"
                />
              </Label>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                创建批次
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>批次列表</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
            </div>
            <div className="relative lg:w-80">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(event) => {
                  setQ(event.target.value)
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
                placeholder="搜索批次号、批次名称"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>批次</TableHead>
                  <TableHead>范围</TableHead>
                  <TableHead>发布进度</TableHead>
                  <TableHead>阻断</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">加载批次...</TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((item) => (
                    <TableRow key={item.batch_no}>
                      <TableCell>
                        <div className="space-y-1">
                          <Link to={`/listing-batches/${encodeURIComponent(item.batch_no)}`} className="font-medium hover:text-[var(--brand-deep)] hover:underline">
                            {item.batch_name}
                          </Link>
                          <div className="font-mono text-xs text-muted-foreground">{item.batch_no}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>草稿 {formatNumber(item.draft_count)}</div>
                        <div className="text-xs text-muted-foreground">SKC {formatNumber(item.skc_count)} / SKU {formatNumber(item.sku_count)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className={statusClass(item)}>{item.status}</Badge>
                          <Badge variant="outline">发布中 {formatNumber(item.publishing_count)}</Badge>
                          <Badge variant="outline">审核中 {formatNumber(item.auditing_count)}</Badge>
                          <Badge variant="outline">通过 {formatNumber(item.approved_count)}</Badge>
                          <Badge variant="outline">失败 {formatNumber(item.failed_count)}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={Number(item.blocker_count) > 0 ? "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]" : ""}>
                          {formatNumber(item.blocker_count)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(item.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/listing-batches/${encodeURIComponent(item.batch_no)}`}>
                            进入批次
                            <ArrowRight className="ml-1 size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">暂无批次</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <ServerPagination
            pagination={data?.pagination}
            onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
          />
        </CardContent>
      </Card>
    </PageContainer>
  )
}
