import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Database, Loader2, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
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

interface TradeRow {
  id: number
  tenant_name: string
  merchant_id: string
  trade_id: string
  parent_trade_id: string | null
  trade_name: string
  trade_path: string | null
  synced_at: string
}

interface FieldRow {
  id: number
  field_id: string
  field_name: string
  field_type: string | null
  required: boolean
  sale_prop: boolean
  options_json: unknown[]
  synced_at: string
}

interface MetadataSyncJob {
  id: string
  tenantName: string
  fieldConcurrency: number
  fieldRetryCount: number
  status: "queued" | "running" | "completed" | "failed"
  total_count: number
  completed_count: number
  summary: {
    topLevelCount?: number
    flattenedCount?: number
    fieldTradeCount?: number
    fieldCount?: number
    zeroFieldCount?: number
    failedTradeCount?: number
  } | null
  error: string | null
}

const tenantOptions = [
  "电商巴拉巴拉",
  "迷你巴拉",
  "股份巴拉巴拉",
  "森马电商",
  "森马股份",
]

function useTrades(query: string, tenantName: string) {
  return useQuery<{ items: TradeRow[] }>({
    queryKey: ["deepdraw-metadata", "trades", query, tenantName],
    queryFn: () =>
      api.get<{ items: TradeRow[] }>(`/deepdraw-metadata/trades?q=${encodeURIComponent(query)}&tenantName=${encodeURIComponent(tenantName)}`),
  })
}

function useTradeFields(selectedTradeId: string | null, tenantName: string) {
  return useQuery<{ items: FieldRow[] }>({
    queryKey: ["deepdraw-metadata", "trade-fields", selectedTradeId, tenantName],
    enabled: Boolean(selectedTradeId),
    queryFn: () =>
      api.get<{ items: FieldRow[] }>(`/deepdraw-metadata/trades/${selectedTradeId}/fields?tenantName=${encodeURIComponent(tenantName)}`),
  })
}

export default function DeepdrawMetadataPage() {
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState("")
  const [tenantName, setTenantName] = useState("电商巴拉巴拉")
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const [syncJobId, setSyncJobId] = useState<string | null>(null)
  const query = useDebounce(searchText, 300)
  const trades = useTrades(query, tenantName)
  const fields = useTradeFields(selectedTradeId, tenantName)
  const { data: syncJob } = useQuery<MetadataSyncJob>({
    queryKey: ["deepdraw-metadata", "sync-jobs", syncJobId],
    queryFn: () => api.get<MetadataSyncJob>(`/deepdraw-metadata/sync-jobs/${syncJobId}`),
    enabled: Boolean(syncJobId),
    refetchInterval: (query) => {
      const job = query.state.data
      return job && ["queued", "running"].includes(job.status) ? 2000 : false
    },
    refetchOnWindowFocus: false,
  })

  const refreshTrades = useMutation({
    mutationFn: () =>
      api.get<{ count: number }>(`/deepdraw-metadata/trades?refresh=1&tenantName=${encodeURIComponent(tenantName)}`),
    onSuccess: (result) => {
      toast.success(`已刷新 ${formatNumber(result.count)} 个深绘类目`)
      queryClient.invalidateQueries({ queryKey: ["deepdraw-metadata"] })
    },
  })

  const refreshFields = useMutation({
    mutationFn: () =>
      api.get<{ count: number }>(`/deepdraw-metadata/trades/${selectedTradeId}/fields?refresh=1&tenantName=${encodeURIComponent(tenantName)}`),
    onSuccess: (result) => {
      toast.success(`已刷新 ${formatNumber(result.count)} 个字段模板`)
      queryClient.invalidateQueries({ queryKey: ["deepdraw-metadata"] })
    },
  })

  const syncAllMetadata = useMutation({
    mutationFn: () =>
      api.post<MetadataSyncJob>("/deepdraw-metadata/sync-jobs", { tenantName, fieldConcurrency: 8, fieldRetryCount: 2 }),
    onSuccess: (job) => {
      setSyncJobId(job.id)
      toast.success("深绘类目字段同步任务已启动")
    },
  })

  useEffect(() => {
    if (syncJob?.status !== "completed") return
    void queryClient.invalidateQueries({ queryKey: ["deepdraw-metadata"] })
  }, [queryClient, syncJob?.status])

  const syncing = syncAllMetadata.isPending || Boolean(syncJob && ["queued", "running"].includes(syncJob.status))
  const summary = syncJob?.summary

  return (
    <CompactListPage>
      <CompactListHeader
        title="深绘类目字段"
        description="按租户缓存深绘类目树和 dp.trade.fields 字段模板，给建档草稿校验使用。"
        summary={
          summary
            ? `顶级 ${formatNumber(summary.topLevelCount ?? 0)} 个，展开 ${formatNumber(summary.flattenedCount ?? 0)} 个，字段 ${formatNumber(summary.fieldCount ?? 0)} 个，0 字段 ${formatNumber(summary.zeroFieldCount ?? 0)} 个`
            : `类目 ${formatNumber(trades.data?.items.length ?? 0)} 个`
        }
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => refreshTrades.mutate()} disabled={refreshTrades.isPending || syncing}>
              {refreshTrades.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              刷新类目
            </Button>
            <Button type="button" size="sm" onClick={() => syncAllMetadata.mutate()} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              批量拉取类目字段
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
        <CompactListCard>
          <CompactListCardHeader>
            <CompactListToolbar>
              <div>
                <CardTitle className="text-base">类目树</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">选择叶子类目查看字段模板</p>
              </div>
              <CompactListControls>
                <Select
                  value={tenantName}
                  onValueChange={(value) => {
                    setTenantName(value)
                    setSelectedTradeId(null)
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantOptions.map((tenant) => (
                      <SelectItem key={tenant} value={tenant}>{tenant}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative min-w-[220px]">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="搜索类目"
                    className="pl-8"
                  />
                </div>
              </CompactListControls>
            </CompactListToolbar>
          </CompactListCardHeader>
          <CompactListCardContent>
            <CompactListTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类目 ID</TableHead>
                    <TableHead>类目名称</TableHead>
                    <TableHead>路径</TableHead>
                    <TableHead>租户</TableHead>
                    <TableHead>同步时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(trades.data?.items ?? []).map((trade) => (
                    <TableRow
                      key={trade.id}
                      className={selectedTradeId === trade.trade_id ? "bg-[var(--brand-light)]" : ""}
                      onClick={() => setSelectedTradeId(trade.trade_id)}
                    >
                      <TableCell className="font-mono text-xs">{trade.trade_id}</TableCell>
                      <TableCell>{trade.trade_name}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{trade.trade_path || "-"}</TableCell>
                      <TableCell>{trade.tenant_name}</TableCell>
                      <TableCell>{formatDateTime(trade.synced_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CompactListTableFrame>
          </CompactListCardContent>
        </CompactListCard>

        <CompactListCard>
          <CompactListCardHeader>
            <CompactListToolbar>
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="size-4" />
                  字段模板
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedTradeId ? `tradeId ${selectedTradeId}` : "未选择类目"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedTradeId || refreshFields.isPending}
                onClick={() => refreshFields.mutate()}
              >
                {refreshFields.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                刷新字段
              </Button>
            </CompactListToolbar>
          </CompactListCardHeader>
          <CompactListCardContent>
            <CompactListTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>字段</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>属性</TableHead>
                    <TableHead>选项数</TableHead>
                    <TableHead>同步时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(fields.data?.items ?? []).map((field) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <div>{field.field_name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{field.field_id}</div>
                      </TableCell>
                      <TableCell>{field.field_type || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {field.required ? <Badge className="border-[#f1cccc] bg-[#fff1f1] text-[#d45656]">必填</Badge> : null}
                          {field.sale_prop ? <Badge className="border-[#d7e5fb] bg-[#eef5ff] text-[#3772cf]">销售属性</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(Array.isArray(field.options_json) ? field.options_json.length : 0)}</TableCell>
                      <TableCell>{formatDateTime(field.synced_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CompactListTableFrame>
          </CompactListCardContent>
        </CompactListCard>
      </div>
    </CompactListPage>
  )
}
