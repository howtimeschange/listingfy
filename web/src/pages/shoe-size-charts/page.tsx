import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileSpreadsheet, Pencil, Plus, Ruler, Search, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { formatNumber } from "@/lib/format"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"

interface ShoeSizeChart {
  id: number
  chart_code: string
  chart_name: string
  applicable_categories: string
  version_label: string
  source_file_name: string | null
  enabled: boolean
  row_count: number
  min_size: number | null
  max_size: number | null
}

interface ShoeSizeChartRow {
  id: number
  chart_id: number
  chart_code: string
  chart_name: string
  applicable_categories: string
  version_label: string
  size_value: number
  foot_length_mm: number
  foot_length_tolerance_mm: number
  inner_length_mm: number
  age_segment: string | null
  reference_age: string | null
  reference_stage: string | null
  general_mapping_text: string | null
  douyin_mapping_text: string | null
  vip_mapping_text: string | null
  video_pdd_vip_mapping_text: string | null
  pinduoduo_mapping_text: string | null
  enabled: boolean
  notes: string | null
}

interface ChartListResponse {
  charts: ShoeSizeChart[]
}

interface RowListResponse {
  items: ShoeSizeChartRow[]
  pagination: { total: number; limit: number; offset: number }
}

interface ShoeSizeChartImportResponse {
  fileName: string
  sheetCount: number
  parsedRowCount: number
  platformMappingRowCount: number
  insertedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  errors: Array<{ sheetName: string; rowNumber: number; reason: string }>
}

interface RowFormState {
  id?: number
  chartCode: string
  sizeValue: string
  footLengthMm: string
  footLengthToleranceMm: string
  innerLengthMm: string
  ageSegment: string
  referenceAge: string
  referenceStage: string
  generalMappingText: string
  douyinMappingText: string
  vipMappingText: string
  videoPddVipMappingText: string
  pinduoduoMappingText: string
  enabled: boolean
  notes: string
}

interface ChartFormState {
  chartCode: string
  chartName: string
  applicableCategories: string
  versionLabel: string
  enabled: boolean
}

function emptyRow(chartCode: string): RowFormState {
  return {
    chartCode,
    sizeValue: "",
    footLengthMm: "",
    footLengthToleranceMm: "2",
    innerLengthMm: "",
    ageSegment: "",
    referenceAge: "",
    referenceStage: "",
    generalMappingText: "",
    douyinMappingText: "",
    vipMappingText: "",
    videoPddVipMappingText: "",
    pinduoduoMappingText: "",
    enabled: true,
    notes: "",
  }
}

function rowForm(row: ShoeSizeChartRow): RowFormState {
  return {
    id: row.id,
    chartCode: row.chart_code,
    sizeValue: String(row.size_value),
    footLengthMm: String(row.foot_length_mm),
    footLengthToleranceMm: String(row.foot_length_tolerance_mm),
    innerLengthMm: String(row.inner_length_mm),
    ageSegment: row.age_segment ?? "",
    referenceAge: row.reference_age ?? "",
    referenceStage: row.reference_stage ?? "",
    generalMappingText: row.general_mapping_text ?? "",
    douyinMappingText: row.douyin_mapping_text ?? "",
    vipMappingText: row.vip_mapping_text ?? "",
    videoPddVipMappingText: row.video_pdd_vip_mapping_text ?? "",
    pinduoduoMappingText: row.pinduoduo_mapping_text ?? "",
    enabled: row.enabled,
    notes: row.notes ?? "",
  }
}

function chartForm(chart: ShoeSizeChart): ChartFormState {
  return {
    chartCode: chart.chart_code,
    chartName: chart.chart_name,
    applicableCategories: chart.applicable_categories,
    versionLabel: chart.version_label,
    enabled: chart.enabled,
  }
}

function rowPayload(form: RowFormState) {
  return {
    chartCode: form.chartCode,
    sizeValue: Number(form.sizeValue),
    footLengthMm: Number(form.footLengthMm),
    footLengthToleranceMm: Number(form.footLengthToleranceMm),
    innerLengthMm: Number(form.innerLengthMm),
    ageSegment: form.ageSegment || null,
    referenceAge: form.referenceAge || null,
    referenceStage: form.referenceStage || null,
    generalMappingText: form.generalMappingText || null,
    douyinMappingText: form.douyinMappingText || null,
    vipMappingText: form.vipMappingText || null,
    videoPddVipMappingText: form.videoPddVipMappingText || null,
    pinduoduoMappingText: form.pinduoduoMappingText || null,
    enabled: form.enabled,
    notes: form.notes || null,
  }
}

function cm(value: number) {
  return (Number(value) / 10).toFixed(1).replace(/\.0$/, "")
}

function footLengthRange(row: ShoeSizeChartRow) {
  const foot = Number(row.foot_length_mm)
  const tolerance = Number(row.foot_length_tolerance_mm)
  return `${cm(foot - tolerance)}–${cm(foot + tolerance)} cm`
}

export default function ShoeSizeChartsPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canManage = hasPermission("PRODUCT_ARCHIVE_RULE_MANAGE")
  const [chartCode, setChartCode] = useState("sport_leisure")
  const [searchText, setSearchText] = useState("")
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const [rowDialogOpen, setRowDialogOpen] = useState(false)
  const [rowState, setRowState] = useState<RowFormState>(() => emptyRow("sport_leisure"))
  const [chartDialogOpen, setChartDialogOpen] = useState(false)
  const [chartState, setChartState] = useState<ChartFormState | null>(null)
  const [importResult, setImportResult] = useState<ShoeSizeChartImportResponse | null>(null)
  const debouncedQuery = useDebounce(searchText, 300)

  const charts = useQuery<ChartListResponse>({
    queryKey: ["shoe-size-charts"],
    queryFn: () => api.get<ChartListResponse>("/shoe-size-charts"),
  })

  const rows = useQuery<RowListResponse>({
    queryKey: ["shoe-size-chart-rows", chartCode, debouncedQuery, pagination],
    queryFn: () => {
      const params = new URLSearchParams({
        chartCode,
        q: debouncedQuery,
        limit: String(pagination.limit),
        offset: String(pagination.offset),
      })
      return api.get<RowListResponse>(`/shoe-size-charts/rows?${params.toString()}`)
    },
  })

  const activeChart = useMemo(
    () => charts.data?.charts.find((chart) => chart.chart_code === chartCode) ?? null,
    [chartCode, charts.data?.charts],
  )

  const saveRow = useMutation({
    mutationFn: (form: RowFormState) => form.id
      ? api.patch<ShoeSizeChartRow>(`/shoe-size-charts/rows/${form.id}`, rowPayload(form))
      : api.post<ShoeSizeChartRow>("/shoe-size-charts/rows", rowPayload(form)),
    onSuccess: () => {
      toast.success(rowState.id ? "尺码明细已更新" : "尺码明细已新增")
      setRowDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["shoe-size-charts"] })
      queryClient.invalidateQueries({ queryKey: ["shoe-size-chart-rows"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存鞋品尺码失败"),
  })

  const saveChart = useMutation({
    mutationFn: (form: ChartFormState) => api.patch<ShoeSizeChart>(`/shoe-size-charts/${form.chartCode}`, {
      chartName: form.chartName,
      applicableCategories: form.applicableCategories,
      versionLabel: form.versionLabel,
      enabled: form.enabled,
    }),
    onSuccess: () => {
      toast.success("鞋品尺码模板已更新")
      setChartDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["shoe-size-charts"] })
      queryClient.invalidateQueries({ queryKey: ["shoe-size-chart-rows"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存模板失败"),
  })

  const importRows = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append("file", file)
      form.append("chartCode", chartCode)
      return api.postForm<ShoeSizeChartImportResponse>("/shoe-size-charts/imports", form)
    },
    onSuccess: (result) => {
      setImportResult(result)
      toast.success(`导入完成：新增 ${result.insertedCount}，覆盖更新 ${result.updatedCount}，跳过 ${result.skippedCount}，失败 ${result.failedCount}`)
      queryClient.invalidateQueries({ queryKey: ["shoe-size-charts"] })
      queryClient.invalidateQueries({ queryKey: ["shoe-size-chart-rows"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "导入鞋品尺码表失败"),
  })

  function openCreateRow() {
    setRowState(emptyRow(chartCode))
    setRowDialogOpen(true)
  }

  function openEditRow(row: ShoeSizeChartRow) {
    setRowState(rowForm(row))
    setRowDialogOpen(true)
  }

  function openEditChart() {
    if (!activeChart) return
    setChartState(chartForm(activeChart))
    setChartDialogOpen(true)
  }

  function updateRow<K extends keyof RowFormState>(key: K, value: RowFormState[K]) {
    setRowState((current) => ({ ...current, [key]: value }))
  }

  return (
    <CompactListPage>
      <CompactListHeader
        title="鞋品尺码表"
        description="集中维护鞋品号码、适合脚长与鞋内长的品类固定规则。当前基线来自 Balabala 2025–2026 对照表，后续深绘回填只引用这里的已启用版本。"
        summary={`${formatNumber(rows.data?.pagination.total ?? 0)} 条明细 / ${formatNumber(charts.data?.charts.length ?? 0)} 套模板`}
        actions={canManage ? (
          <div className="flex items-center gap-2">
            <ImportDialog
              title="导入覆盖更新鞋品尺码表"
              description="支持直接上传 Balabala 原始横向 .xlsx，也支持 .xlsx / .csv 纵表。按“模板代码 + 号码”覆盖已有明细并新增缺失号码；纵表未填写模板代码时默认导入当前模板。必填列：号码、脚长基准(mm)、鞋内长(mm)。"
              trigger={(
                <Button type="button" size="sm" variant="outline" disabled={importRows.isPending}>
                  <FileSpreadsheet className="size-4" />
                  导入覆盖更新
                </Button>
              )}
              onImport={async (file) => {
                await importRows.mutateAsync(file)
              }}
            />
            <Button type="button" size="sm" variant="outline" onClick={openEditChart} disabled={!activeChart}>
              <Settings2 className="size-4" />
              编辑模板
            </Button>
            <Button type="button" size="sm" onClick={openCreateRow}>
              <Plus className="size-4" />
              新增尺码
            </Button>
          </div>
        ) : null}
      />

      {importResult ? (
        <div className="rounded-xl border bg-card px-4 py-3 text-sm">
          <div className="font-medium">最近导入：{importResult.fileName}</div>
          <div className="mt-1 text-muted-foreground">
            {importResult.sheetCount} 个有效页签 · 解析 {importResult.parsedRowCount} 条 · 平台映射 {importResult.platformMappingRowCount} 条 · 新增 {importResult.insertedCount} · 覆盖更新 {importResult.updatedCount} · 跳过 {importResult.skippedCount} · 失败 {importResult.failedCount}
          </div>
          {importResult.errors.length > 0 ? (
            <div className="mt-2 space-y-1 text-xs text-destructive">
              {importResult.errors.slice(0, 5).map((error, index) => (
                <div key={`${error.sheetName}-${error.rowNumber}-${index}`}>
                  {error.sheetName} 第 {error.rowNumber} 行：{error.reason}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {(charts.data?.charts ?? []).map((chart) => (
          <button
            key={chart.chart_code}
            type="button"
            onClick={() => {
              setChartCode(chart.chart_code)
              setPagination((current) => ({ ...current, offset: 0 }))
            }}
            className={`rounded-xl border p-4 text-left transition-colors ${chart.chart_code === chartCode ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/40"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  <Ruler className="size-4 text-primary" />
                  {chart.chart_name}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{chart.applicable_categories}</p>
              </div>
              <Badge variant={chart.enabled ? "secondary" : "outline"}>{chart.version_label}</Badge>
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {formatNumber(chart.row_count)} 个号码 · {chart.min_size ?? "-"}–{chart.max_size ?? "-"} 码
            </p>
          </button>
        ))}
      </div>

      <CompactListCard>
        <CompactListCardHeader>
          <CompactListToolbar>
            <div className="min-w-0">
              <CardTitle className="text-base">{activeChart?.chart_name ?? "尺码明细"}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeChart?.source_file_name ?? "维护号码、脚长公差和鞋内长。"}
              </p>
            </div>
            <CompactListControls>
              <Select
                value={chartCode}
                onValueChange={(value) => {
                  setChartCode(value)
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              >
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(charts.data?.charts ?? []).map((chart) => (
                    <SelectItem key={chart.chart_code} value={chart.chart_code}>{chart.chart_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value)
                    setPagination((current) => ({ ...current, offset: 0 }))
                  }}
                  placeholder="搜索号码、岁段、年龄、平台映射"
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
                  <TableHead>号码</TableHead>
                  <TableHead>脚长基准</TableHead>
                  <TableHead>适合脚长</TableHead>
                  <TableHead>鞋内长</TableHead>
                  <TableHead className="min-w-[300px]">平台尺码映射</TableHead>
                  <TableHead>岁段</TableHead>
                  <TableHead>参考年龄/阶段</TableHead>
                  <TableHead>状态</TableHead>
                  {canManage ? <TableHead className="text-right">操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows.data?.items ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-semibold">{row.size_value} 码</TableCell>
                    <TableCell>{Number(row.foot_length_mm)} mm</TableCell>
                    <TableCell>{footLengthRange(row)}</TableCell>
                    <TableCell>{Number(row.inner_length_mm)} mm / {cm(Number(row.inner_length_mm))} cm</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs">
                        <div><span className="text-muted-foreground">通用：</span>{row.general_mapping_text ?? "-"}</div>
                        <div><span className="text-muted-foreground">抖音：</span>{row.douyin_mapping_text ?? "-"}</div>
                        <div><span className="text-muted-foreground">唯品：</span>{row.vip_mapping_text ?? "-"}</div>
                        {row.video_pdd_vip_mapping_text ? <div><span className="text-muted-foreground">视频号/拼多多/唯品会：</span>{row.video_pdd_vip_mapping_text}</div> : null}
                        {row.pinduoduo_mapping_text ? <div><span className="text-muted-foreground">拼多多：</span>{row.pinduoduo_mapping_text}</div> : null}
                      </div>
                    </TableCell>
                    <TableCell>{row.age_segment ?? "-"}</TableCell>
                    <TableCell>
                      <div>{row.reference_age ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">{row.reference_stage ?? "-"}</div>
                    </TableCell>
                    <TableCell><Badge variant={row.enabled ? "secondary" : "outline"}>{row.enabled ? "启用" : "停用"}</Badge></TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <Button type="button" size="icon" variant="ghost" aria-label={`编辑 ${row.size_value} 码`} onClick={() => openEditRow(row)}>
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CompactListTableFrame>
          <ServerPagination
            pagination={{
              total: rows.data?.pagination.total ?? 0,
              limit: pagination.limit,
              offset: pagination.offset,
            }}
            onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
            isLoading={rows.isFetching}
          />
        </CompactListCardContent>
      </CompactListCard>

      <Dialog open={rowDialogOpen} onOpenChange={setRowDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{rowState.id ? "编辑鞋品尺码" : "新增鞋品尺码"}</DialogTitle>
            <DialogDescription>长度统一以毫米存储，页面同步展示厘米；脚长范围按基准值 ± 公差计算。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>尺码模板</Label>
              <Select value={rowState.chartCode} onValueChange={(value) => updateRow("chartCode", value)} disabled={Boolean(rowState.id)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(charts.data?.charts ?? []).map((chart) => <SelectItem key={chart.chart_code} value={chart.chart_code}>{chart.chart_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>号码</Label><Input type="number" value={rowState.sizeValue} onChange={(event) => updateRow("sizeValue", event.target.value)} /></div>
            <div className="space-y-2"><Label>脚长基准（mm）</Label><Input type="number" step="0.01" value={rowState.footLengthMm} onChange={(event) => updateRow("footLengthMm", event.target.value)} /></div>
            <div className="space-y-2"><Label>脚长公差（mm）</Label><Input type="number" step="0.01" value={rowState.footLengthToleranceMm} onChange={(event) => updateRow("footLengthToleranceMm", event.target.value)} /></div>
            <div className="space-y-2"><Label>鞋内长（mm）</Label><Input type="number" step="0.01" value={rowState.innerLengthMm} onChange={(event) => updateRow("innerLengthMm", event.target.value)} /></div>
            <div className="space-y-2"><Label>岁段</Label><Input value={rowState.ageSegment} onChange={(event) => updateRow("ageSegment", event.target.value)} /></div>
            <div className="space-y-2"><Label>参考年龄</Label><Input value={rowState.referenceAge} onChange={(event) => updateRow("referenceAge", event.target.value)} /></div>
            <div className="space-y-2"><Label>参考阶段</Label><Input value={rowState.referenceStage} onChange={(event) => updateRow("referenceStage", event.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>通用（脚长内长上新）</Label><Input value={rowState.generalMappingText} onChange={(event) => updateRow("generalMappingText", event.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>抖音</Label><Input value={rowState.douyinMappingText} onChange={(event) => updateRow("douyinMappingText", event.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>唯品</Label><Input value={rowState.vipMappingText} onChange={(event) => updateRow("vipMappingText", event.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>视频号/拼多多/唯品会（唯品会兼容渠道口径）</Label><Input value={rowState.videoPddVipMappingText} onChange={(event) => updateRow("videoPddVipMappingText", event.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>拼多多</Label><Input value={rowState.pinduoduoMappingText} onChange={(event) => updateRow("pinduoduoMappingText", event.target.value)} /></div>
            <div className="space-y-2 md:col-span-2"><Label>备注</Label><Textarea value={rowState.notes} onChange={(event) => updateRow("notes", event.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm md:col-span-2"><Checkbox checked={rowState.enabled} onCheckedChange={(checked) => updateRow("enabled", checked === true)} />启用本条尺码</label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRowDialogOpen(false)}>取消</Button>
            <Button type="button" onClick={() => saveRow.mutate(rowState)} disabled={saveRow.isPending}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chartDialogOpen} onOpenChange={setChartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑鞋品尺码模板</DialogTitle>
            <DialogDescription>适用品类保留业务原始口径；自动匹配上线前还会单独维护标准化映射。</DialogDescription>
          </DialogHeader>
          {chartState ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>模板名称</Label><Input value={chartState.chartName} onChange={(event) => setChartState({ ...chartState, chartName: event.target.value })} /></div>
              <div className="space-y-2"><Label>适用品类</Label><Textarea value={chartState.applicableCategories} onChange={(event) => setChartState({ ...chartState, applicableCategories: event.target.value })} /></div>
              <div className="space-y-2"><Label>版本</Label><Input value={chartState.versionLabel} onChange={(event) => setChartState({ ...chartState, versionLabel: event.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={chartState.enabled} onCheckedChange={(checked) => setChartState({ ...chartState, enabled: checked === true })} />启用模板</label>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setChartDialogOpen(false)}>取消</Button>
            <Button type="button" onClick={() => chartState && saveChart.mutate(chartState)} disabled={!chartState || saveChart.isPending}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CompactListPage>
  )
}
