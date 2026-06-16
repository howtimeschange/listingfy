import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Loader2, PackagePlus, Search, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { ServerPagination } from "@/components/server-pagination"
import {
  CompactListCard,
  CompactListCardContent,
  CompactListCardHeader,
  CompactListControls,
  CompactListHeader,
  CompactListPage,
  CompactListTableFrame,
  CompactListToolbar,
} from "@/components/layout/compact-list-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ProductArchiveDraftRow {
  id: number
  draft_no: string
  spu_code: string
  title: string | null
  tenant_name: string
  merchant_id: string
  trade_path: string | null
  status: string
  blocker_count: number
  warning_count: number
  sku_count: number
  created_product_id: string | null
  updated_at: string
}

interface DraftListResponse {
  items: ProductArchiveDraftRow[]
  pagination: { total: number; limit: number; offset: number }
}

interface DraftBatchJob {
  id: string
  status: "queued" | "running" | "completed"
  total_count: number
  completed_count: number
  failed_count: number
}

const statusLabels: Record<string, string> = {
  draft: "草稿",
  missing_fields: "缺字段",
  manual_review: "待人工判断",
  ready: "可创建",
  duplicate_found: "已存在",
  update_pending: "待更新策略",
  submitting: "创建中",
  created: "已创建",
  readback_verified: "回读通过",
  readback_mismatch: "回读不一致",
  failed: "失败",
}

function statusClass(status: string) {
  if (["ready", "created", "readback_verified"].includes(status)) return "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]"
  if (["missing_fields", "manual_review", "readback_mismatch"].includes(status)) return "border-[#f4ddb3] bg-[#fff8e8] text-[#c37d0d]"
  if (["failed", "duplicate_found"].includes(status)) return "border-[#f1cccc] bg-[#fff1f1] text-[#d45656]"
  return "border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]"
}

function useDrafts(query: string, status: string, pagination: { limit: number; offset: number }) {
  return useQuery<DraftListResponse>({
    queryKey: ["product-archive-drafts", query, status, pagination],
    queryFn: () =>
      api.get<DraftListResponse>(`/product-archive-drafts?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&limit=${pagination.limit}&offset=${pagination.offset}`),
  })
}

export default function ProductArchiveDraftsPage() {
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState("")
  const [status, setStatus] = useState("all")
  const [spuCode, setSpuCode] = useState("")
  const [batchJobId, setBatchJobId] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const debouncedQuery = useDebounce(searchText, 300)
  const drafts = useDrafts(debouncedQuery, status, pagination)
  const { data: batchJob } = useQuery<DraftBatchJob>({
    queryKey: ["product-archive-draft-batch-job", batchJobId],
    queryFn: () => api.get<DraftBatchJob>(`/product-archive-drafts/batch-jobs/${batchJobId}`),
    enabled: Boolean(batchJobId),
    refetchInterval: (query) => {
      const job = query.state.data
      return job && job.status !== "completed" ? 1500 : false
    },
    refetchOnWindowFocus: false,
  })

  const summary = useMemo(() => {
    const items = drafts.data?.items ?? []
    return {
      total: drafts.data?.pagination.total ?? 0,
      blockers: items.reduce((sum, item) => sum + Number(item.blocker_count ?? 0), 0),
      warnings: items.reduce((sum, item) => sum + Number(item.warning_count ?? 0), 0),
    }
  }, [drafts.data])

  const createDraft = useMutation({
    mutationFn: (code: string) =>
      api.post<{ draft: ProductArchiveDraftRow }>("/product-archive-drafts/from-spu/" + encodeURIComponent(code), {}),
    onSuccess: () => {
      toast.success("已生成建档草稿")
      setSpuCode("")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
  })

  const createBatch = useMutation({
    mutationFn: (codes: string) =>
      api.post<DraftBatchJob>("/product-archive-drafts/batch", { codes }),
    onSuccess: (result) => {
      setBatchJobId(result.id)
      toast.success("批量生成任务已加入队列")
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
  })

  const batchJobActive = batchJob ? batchJob.status !== "completed" : createBatch.isPending

  useEffect(() => {
    if (batchJob?.status !== "completed") return
    void queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
  }, [batchJob?.status, queryClient])

  return (
    <CompactListPage>
      <CompactListHeader
        title="深绘建档草稿"
        description="从 MDM、字段规则和深绘类目模板生成商品档案草稿，并完成校验、查重和提交前清洗。"
        summary={`共 ${formatNumber(summary.total)} 个草稿`}
        actions={
          <>
            <Button type="button" variant="outline" size="sm">
              <ShieldCheck className="size-4" />
              批量校验
            </Button>
            <Button type="button" variant="outline" size="sm">
              <Search className="size-4" />
              批量查重
            </Button>
            <Button type="button" variant="outline" size="sm">
              <CheckCircle2 className="size-4" />
              批量提交
            </Button>
          </>
        }
      />

      <CompactListCard>
        <CompactListCardHeader>
          <CompactListToolbar>
            <div className="min-w-0">
              <CardTitle className="text-base">草稿列表</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                阻断 {formatNumber(summary.blockers)} 项，警告 {formatNumber(summary.warnings)} 项
                {batchJob ? `，批量任务 ${formatNumber(batchJob.completed_count + batchJob.failed_count)} / ${formatNumber(batchJob.total_count)}` : ""}
              </p>
            </div>
            <CompactListControls>
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value)
                    setPagination((current) => ({ ...current, offset: 0 }))
                  }}
                  placeholder="搜索款号、标题、类目"
                  className="pl-8"
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value)
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={spuCode}
                onChange={(event) => setSpuCode(event.target.value)}
                placeholder="输入款号生成草稿"
                className="w-[180px]"
              />
              <Button
                type="button"
                size="sm"
                disabled={!spuCode.trim() || createDraft.isPending}
                onClick={() => createDraft.mutate(spuCode.trim())}
              >
                {createDraft.isPending ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
                生成草稿
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!spuCode.trim() || batchJobActive}
                onClick={() => createBatch.mutate(spuCode.trim())}
              >
                {batchJobActive ? <Loader2 className="size-4 animate-spin" /> : null}
                批量生成
              </Button>
            </CompactListControls>
          </CompactListToolbar>
        </CompactListCardHeader>
        <CompactListCardContent>
          <CompactListTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>款号</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>租户/商户</TableHead>
                  <TableHead>类目</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>问题</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>productId</TableHead>
                  <TableHead>更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drafts.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link to={`/product-archive-drafts/${item.id}`} className="font-medium text-primary hover:underline">
                        {item.spu_code}
                      </Link>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{item.draft_no}</div>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">{item.title || "未命名"}</TableCell>
                    <TableCell>
                      <div>{item.tenant_name}</div>
                      <div className="text-xs text-muted-foreground">{item.merchant_id}</div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{item.trade_path || "待确认"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass(item.status)}>
                        {statusLabels[item.status] ?? item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-[#d45656]">{item.blocker_count}</span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      <span className="text-[#c37d0d]">{item.warning_count}</span>
                    </TableCell>
                    <TableCell>{formatNumber(item.sku_count)}</TableCell>
                    <TableCell>{item.created_product_id || "-"}</TableCell>
                    <TableCell>{formatDateTime(item.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CompactListTableFrame>
          <ServerPagination
            pagination={drafts.data?.pagination}
            onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
            isLoading={drafts.isFetching}
          />
        </CompactListCardContent>
      </CompactListCard>
    </CompactListPage>
  )
}
