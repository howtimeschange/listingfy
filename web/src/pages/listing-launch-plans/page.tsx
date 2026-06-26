import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileSpreadsheet, Search } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useDebounce } from "@/hooks/use-debounce"
import { ImportDialog } from "@/components/import-dialog"
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

interface ListingLaunchPlanRow {
  id: number
  import_no: string
  file_name: string | null
  sheet_name: string
  row_number: number
  spu_code: string
  skc_code: string | null
  product_season: string | null
  product_line: string | null
  scene: string | null
  attribute: string | null
  gender: string | null
  category_name: string | null
  subcategory_name: string | null
  color_name: string | null
  tag_price: number | null
  launch_date_text: string | null
  search_launch_date_text: string | null
  content_launch_date_text: string | null
  listing_channel: string | null
  official_category: string | null
  vip_category: string | null
  vip_style_category: string | null
  douyin_category: string | null
  imported_at: string
}

interface LaunchPlanRowsResponse {
  items: ListingLaunchPlanRow[]
  sheets: Array<{ sheet_name: string; count: number }>
  pagination: { total: number; limit: number; offset: number }
}

interface LaunchPlanImportResponse {
  inputRowCount: number
  insertedRowCount: number
  sheetCount: number
  sourceBatchIds: number[]
  refreshSummaries?: Array<{ refreshedDraftCount: number; autoAppliedTradeCount: number }>
}

function categoryText(row: ListingLaunchPlanRow) {
  return row.official_category || row.vip_category || row.douyin_category || "-"
}

export default function ListingLaunchPlansPage() {
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState("")
  const [sheetName, setSheetName] = useState("all")
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const debouncedQuery = useDebounce(searchText, 300)

  const rows = useQuery<LaunchPlanRowsResponse>({
    queryKey: ["listing-launch-plan-rows", debouncedQuery, sheetName, pagination],
    queryFn: () =>
      api.get<LaunchPlanRowsResponse>(
        `/listing-launch-plans/rows?q=${encodeURIComponent(debouncedQuery)}&sheetName=${encodeURIComponent(sheetName)}&limit=${pagination.limit}&offset=${pagination.offset}`,
      ),
  })

  const importLaunchPlan = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      return api.postForm<LaunchPlanImportResponse>("/listing-launch-plans/imports", form)
    },
    onSuccess: (result) => {
      const autoAppliedTradeCount = (result.refreshSummaries ?? []).reduce((sum, item) => sum + (item.autoAppliedTradeCount ?? 0), 0)
      toast.success(
        `导入上市计划表完成：${formatNumber(result.insertedRowCount)} / ${formatNumber(result.inputRowCount)} 行，${formatNumber(result.sheetCount)} 个页签，自动应用类目 ${formatNumber(autoAppliedTradeCount)} 个`,
      )
      queryClient.invalidateQueries({ queryKey: ["listing-launch-plan-rows"] })
      queryClient.invalidateQueries({ queryKey: ["product-archive-drafts"] })
    },
  })

  const summary = useMemo(() => {
    const total = rows.data?.pagination.total ?? 0
    const sheetCount = rows.data?.sheets.length ?? 0
    return `${formatNumber(total)} 行 / ${formatNumber(sheetCount)} 个页签`
  }, [rows.data])

  return (
    <CompactListPage>
      <CompactListHeader
        title="上市计划表"
        description="存放上市计划表导入后的结构化明细，供深绘建档草稿匹配类目、上市时间和商品基础字段。"
        summary={summary}
        actions={
          <ImportDialog
            title="导入上市计划表"
            description="服务端解析大体积 .xlsx / .csv，按模板表头匹配款号、款色、官方发布类目和上市时间。"
            trigger={
              <Button type="button" size="sm" disabled={importLaunchPlan.isPending}>
                <FileSpreadsheet className="size-4" />
                导入上市计划表
              </Button>
            }
            onImport={async (file) => {
              await importLaunchPlan.mutateAsync(file)
            }}
          />
        }
      />

      <CompactListCard>
        <CompactListCardHeader>
          <CompactListToolbar>
            <div className="min-w-0">
              <CardTitle className="text-base">计划明细</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                款号、款色、类目、上市时间和渠道来自导入模板。
              </p>
            </div>
            <CompactListControls>
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value)
                    setPagination((current) => ({ ...current, offset: 0 }))
                  }}
                  placeholder="搜索款号、款色、类目"
                  className="pl-8"
                />
              </div>
              <Select
                value={sheetName}
                onValueChange={(value) => {
                  setSheetName(value)
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部页签</SelectItem>
                  {(rows.data?.sheets ?? []).map((sheet) => (
                    <SelectItem key={sheet.sheet_name} value={sheet.sheet_name}>
                      {sheet.sheet_name} · {formatNumber(sheet.count)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CompactListControls>
          </CompactListToolbar>
        </CompactListCardHeader>
        <CompactListCardContent>
          <CompactListTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>款号</TableHead>
                  <TableHead>款色</TableHead>
                  <TableHead>页签/行</TableHead>
                  <TableHead>基础信息</TableHead>
                  <TableHead>官方发布类目</TableHead>
                  <TableHead>唯品/抖音</TableHead>
                  <TableHead>上市时间</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>导入时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.spu_code}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.product_season || "-"}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.skc_code || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{item.sheet_name}</Badge>
                      <div className="mt-1 text-xs text-muted-foreground">第 {formatNumber(item.row_number)} 行</div>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <div className="truncate">{[item.product_line, item.scene, item.attribute].filter(Boolean).join(" / ") || "-"}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {[item.gender, item.category_name, item.subcategory_name, item.color_name].filter(Boolean).join(" / ") || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{categoryText(item)}</TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate">{item.vip_category || item.vip_style_category || "-"}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{item.douyin_category || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <div>{item.launch_date_text || item.content_launch_date_text || "-"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.listing_channel || item.search_launch_date_text || "-"}</div>
                    </TableCell>
                    <TableCell>{item.tag_price == null ? "-" : formatNumber(item.tag_price)}</TableCell>
                    <TableCell>{formatDateTime(item.imported_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CompactListTableFrame>
          <ServerPagination
            pagination={rows.data?.pagination}
            onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
            isLoading={rows.isFetching}
          />
        </CompactListCardContent>
      </CompactListCard>
    </CompactListPage>
  )
}
