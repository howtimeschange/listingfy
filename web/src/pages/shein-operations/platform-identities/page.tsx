import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw, Search, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { ServerPagination } from "@/components/server-pagination"
import type { ServerPaginationState } from "@/components/server-pagination"
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

interface IdentityRow {
  id: number
  skcName: string
  skuCode: string
  supplierSku: string
  designCode: string
  attributeText: string
  numberType: number
  sourcePage: number
  traceId: string
  lastSyncedAt: string
}

interface IdentityResponse {
  items: IdentityRow[]
  pagination: ServerPaginationState
}

interface SupplierSkuCheckRow {
  supplierSku: string
  repeated: boolean
}

function useNumberList(search: string, pagination: { limit: number; offset: number }) {
  return useQuery<IdentityResponse>({
    queryKey: ["shein-operations", "number-list", search, pagination],
    queryFn: () => {
      const params = new URLSearchParams({
        search,
        limit: String(pagination.limit),
        offset: String(pagination.offset),
      })
      return api.get(`/shein-operations/platform-identities/number-list?${params.toString()}`)
    },
  })
}

export default function SheinPlatformIdentitiesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState("1")
  const [type, setType] = useState("1")
  const [supplierSkuText, setSupplierSkuText] = useState("")
  const [checkResult, setCheckResult] = useState<SupplierSkuCheckRow[]>([])
  const [pagination, setPagination] = useState<ServerPaginationState>({ total: 0, limit: 50, offset: 0 })
  const numberListQuery = useNumberList(search, pagination)

  const syncMutation = useMutation({
    mutationFn: () => api.post<{ persistence: { synced: number } }>("/shein-operations/platform-identities/number-list/sync", {
      page: Number(page) || 1,
      per_page: 100,
      type: Number(type) || 1,
    }),
    onSuccess: (result) => {
      toast.success(`编号关系已同步：${formatNumber(result.persistence.synced)} 条`)
      queryClient.invalidateQueries({ queryKey: ["shein-operations", "number-list"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "同步编号关系失败"),
  })

  const checkMutation = useMutation({
    mutationFn: () => api.post<{ items: SupplierSkuCheckRow[] }>("/shein-operations/platform-identities/supplier-sku/check", {
      supplierSkuList: supplierSkuText,
      sourceType: "PLATFORM_IDENTITIES_PAGE",
    }),
    onSuccess: (result) => {
      setCheckResult(result.items)
      toast.success(`SKU 查重完成：${formatNumber(result.items.length)} 个`)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "SKU 查重失败"),
  })

  const rows = numberListQuery.data?.items ?? []
  const currentPagination = numberListQuery.data?.pagination ?? pagination

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="平台标识对账"
        description="接入 number-list 和 check-supplierSku-repeated，补齐 SHEIN SKC/SKU/设计款号关系，并在拼款前做商家 SKU 唯一性校验。"
      >
        <Button variant="outline" onClick={() => numberListQuery.refetch()} disabled={numberListQuery.isFetching}>
          <RefreshCw className={numberListQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
          刷新
        </Button>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>编号关系同步</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[120px_120px_1fr_auto]">
              <div className="grid gap-2">
                <Label>页码</Label>
                <Input value={page} onChange={(event) => setPage(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>类型</Label>
                <Input value={type} onChange={(event) => setType(event.target.value)} placeholder="1=SKC" />
              </div>
              <div className="grid gap-2">
                <Label>本地搜索</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="SKC / SKU / 商家 SKU / 设计款号" />
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                  <RefreshCw className={syncMutation.isPending ? "size-4 animate-spin" : "size-4"} />
                  同步 number-list
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKC</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>商家 SKU</TableHead>
                    <TableHead>设计款号</TableHead>
                    <TableHead>属性</TableHead>
                    <TableHead>同步时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length ? rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.skcName || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.skuCode || "—"}</TableCell>
                      <TableCell>{row.supplierSku || "—"}</TableCell>
                      <TableCell>{row.designCode || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.attributeText || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(row.lastSyncedAt)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        暂无编号关系快照，先同步 number-list。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ServerPagination
              pagination={currentPagination}
              onLimitChange={(limit) => setPagination((current) => ({ ...current, limit, offset: 0 }))}
              onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>商家 SKU 查重</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={supplierSkuText}
              onChange={(event) => setSupplierSkuText(event.target.value)}
              className="min-h-36"
              placeholder="粘贴 supplierSku，支持逗号、空格、换行分隔"
            />
            <Button onClick={() => checkMutation.mutate()} disabled={checkMutation.isPending}>
              <ShieldCheck className="size-4" />
              check-supplierSku-repeated
            </Button>
            <div className="space-y-2">
              {checkResult.length ? checkResult.map((item) => (
                <div key={item.supplierSku} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="font-mono text-xs">{item.supplierSku}</span>
                  <Badge variant={item.repeated ? "destructive" : "secondary"}>
                    {item.repeated ? "重复" : "可用"}
                  </Badge>
                </div>
              )) : (
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  查重结果会显示在这里，重复 SKU 会在拼款前阻断。
                </div>
              )}
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/shein-platform-products">回到平台商品列表</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
