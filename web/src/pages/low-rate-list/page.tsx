import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Edit3, Loader2, Plus, Search, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format"
import { exportSpreadsheet, parseBatchSearch, readSpreadsheetFile } from "@/lib/spreadsheet"
import type { SpreadsheetRow } from "@/lib/spreadsheet"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatCard } from "@/components/stat-card"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DiscountRule {
  id: number
  spu_code: string
  discount: number
  multiplier: number | null
  status: string
  note: string | null
  updated_at: string
}

interface RuleList {
  items: DiscountRule[]
}

interface ImportResult {
  success_count: number
  failed_count: number
}

const emptyForm = {
  spu_code: "",
  discount: "0.45",
  note: "",
}

function useDiscountRules(search: string, batchSearch: string) {
  return useQuery<RuleList>({
    queryKey: ["business-rules", "discount-rules", search, batchSearch],
    queryFn: () =>
      api.get(
        `/business-rules/discount-rules?q=${encodeURIComponent(search)}&batch_search=${encodeURIComponent(batchSearch)}&limit=1000`,
      ),
  })
}

export default function LowRateListPage() {
  const [search, setSearch] = useState("")
  const [batchSearchText, setBatchSearchText] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DiscountRule | null>(null)
  const [form, setForm] = useState(emptyForm)
  const queryClient = useQueryClient()

  const { data, isLoading } = useDiscountRules(search, batchSearchText)
  const items = data?.items ?? []
  const batchCount = useMemo(() => parseBatchSearch(batchSearchText).length, [batchSearchText])
  const lowRateCount = items.filter((item) => Number(item.discount) > 0.4).length

  const importMutation = useMutation({
    mutationFn: (payload: { file_name: string; rows: SpreadsheetRow[] }) =>
      api.post<ImportResult>("/business-rules/discount-rules/import", payload),
    onSuccess: (result) => {
      toast.success(`导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "discount-rules"] })
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        spu_code: form.spu_code,
        discount: Number(form.discount),
        note: form.note,
      }
      return editing
        ? api.patch(`/business-rules/discount-rules/${editing.id}`, body)
        : api.post("/business-rules/discount-rules", body)
    },
    onSuccess: () => {
      toast.success(editing ? "供货折扣规则已更新" : "供货折扣规则已新增")
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "discount-rules"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/business-rules/discount-rules/${id}`),
    onSuccess: () => {
      toast.success("供货折扣规则已删除")
      queryClient.invalidateQueries({ queryKey: ["business-rules", "discount-rules"] })
    },
  })

  async function handleFile(file: File | null) {
    if (!file) return
    try {
      const rows = await readSpreadsheetFile(file)
      importMutation.mutate({ file_name: file.name, rows })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "表格解析失败")
    }
  }

  async function exportRows() {
    const result = await api.get<{ rows: SpreadsheetRow[] }>("/business-rules/discount-rules/export")
    exportSpreadsheet("SHEIN低倍率供货折扣清单.xlsx", result.rows)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(rule: DiscountRule) {
    setEditing(rule)
    setForm({
      spu_code: rule.spu_code,
      discount: String(rule.discount),
      note: rule.note ?? "",
    })
    setDialogOpen(true)
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="低倍率清单"
        description="维护需要使用 0.45 供货折扣的款号清单，发布前价格会优先命中这里的规则，其他款默认 0.4。"
      >
        <Button variant="outline" onClick={exportRows}>
          <Download className="mr-2 size-4" />
          导出
        </Button>
        <Button asChild variant="outline">
          <Label className="cursor-pointer">
            {importMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            导入表格
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
          </Label>
        </Button>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          新增
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="规则数量" value={formatNumber(items.length)} />
        <StatCard title="命中高折扣" value={formatNumber(lowRateCount)} description="倍率高于默认 0.4" />
        <StatCard title="批量搜索" value={batchCount ? `${batchCount} 款` : "未启用"} />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <CardTitle>供货折扣规则</CardTitle>
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
              <div className="relative lg:w-72">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索款号"
                  className="pl-9"
                />
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">批量搜索</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>批量搜索款号</DialogTitle>
                    <DialogDescription>粘贴多个款号，支持空格、换行、逗号和分号分隔。</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={batchSearchText}
                    onChange={(event) => setBatchSearchText(event.target.value)}
                    rows={8}
                    placeholder={"208226102001\n208226103201"}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
          ) : items.length === 0 ? (
            <EmptyState message="暂无低倍率清单数据" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品款号</TableHead>
                  <TableHead>供货折扣</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono">{rule.spu_code}</TableCell>
                    <TableCell className="font-medium">{formatPercent(Number(rule.discount))}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate">{rule.note || "-"}</TableCell>
                    <TableCell>{formatDateTime(rule.updated_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                          <Edit3 className="mr-1 size-3.5" />
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteMutation.mutate(rule.id)}
                        >
                          <Trash2 className="mr-1 size-3.5" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑供货折扣" : "新增供货折扣"}</DialogTitle>
            <DialogDescription>命中款号会覆盖默认 0.4，用于供货价计算。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>商品款号</Label>
              <Input
                value={form.spu_code}
                onChange={(event) => setForm((prev) => ({ ...prev, spu_code: event.target.value }))}
                placeholder="208226102001"
              />
            </div>
            <div className="grid gap-2">
              <Label>供货折扣</Label>
              <Input
                value={form.discount}
                onChange={(event) => setForm((prev) => ({ ...prev, discount: event.target.value }))}
                placeholder="0.45"
              />
            </div>
            <div className="grid gap-2">
              <Label>备注</Label>
              <Textarea
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
