import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Edit3, Loader2, Plus, Search, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
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

interface SizeConversionRule {
  id: number
  local_size_code: string | null
  local_size_name: string | null
  shein_size_value: string
  status: string
  note: string | null
  updated_at: string
}

interface RuleList {
  items: SizeConversionRule[]
}

interface ImportResult {
  success_count: number
  failed_count: number
}

const emptyForm = {
  local_size_code: "",
  local_size_name: "",
  shein_size_value: "",
  note: "",
}

function useSizeRules(search: string, batchSearch: string) {
  return useQuery<RuleList>({
    queryKey: ["business-rules", "size-conversions", search, batchSearch],
    queryFn: () =>
      api.get(
        `/business-rules/size-conversions?q=${encodeURIComponent(search)}&batch_search=${encodeURIComponent(batchSearch)}&limit=500`,
      ),
  })
}

export default function SizeConversionPage() {
  const [search, setSearch] = useState("")
  const [batchSearchText, setBatchSearchText] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SizeConversionRule | null>(null)
  const [form, setForm] = useState(emptyForm)
  const queryClient = useQueryClient()

  const { data, isLoading } = useSizeRules(search, batchSearchText)
  const items = data?.items ?? []
  const batchCount = useMemo(() => parseBatchSearch(batchSearchText).length, [batchSearchText])

  const importMutation = useMutation({
    mutationFn: (payload: { file_name: string; rows: SpreadsheetRow[] }) =>
      api.post<ImportResult>("/business-rules/size-conversions/import", payload),
    onSuccess: (result) => {
      toast.success(`导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "size-conversions"] })
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        local_size_code: form.local_size_code,
        local_size_name: form.local_size_name,
        shein_size_value: form.shein_size_value,
        note: form.note,
      }
      return editing
        ? api.patch(`/business-rules/size-conversions/${editing.id}`, body)
        : api.post("/business-rules/size-conversions", body)
    },
    onSuccess: () => {
      toast.success(editing ? "尺码转换规则已更新" : "尺码转换规则已新增")
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "size-conversions"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/business-rules/size-conversions/${id}`),
    onSuccess: () => {
      toast.success("尺码转换规则已删除")
      queryClient.invalidateQueries({ queryKey: ["business-rules", "size-conversions"] })
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
    const result = await api.get<{ rows: SpreadsheetRow[] }>("/business-rules/size-conversions/export")
    exportSpreadsheet("SHEIN尺码转换规则.xlsx", result.rows)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(rule: SizeConversionRule) {
    setEditing(rule)
    setForm({
      local_size_code: rule.local_size_code ?? "",
      local_size_name: rule.local_size_name ?? "",
      shein_size_value: rule.shein_size_value,
      note: rule.note ?? "",
    })
    setDialogOpen(true)
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="尺码转换规则"
        description="维护 MDM 尺码到 SHEIN 尺码的映射，支持表格导入导出、批量搜索、编辑和增删改查。"
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
        <StatCard title="批量搜索" value={batchCount ? `${batchCount} 个` : "未启用"} />
        <StatCard title="示例格式" value="080 -> 9-12M" description="按表格 Shein-Size / 尺码 导入" />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <CardTitle>规则列表</CardTitle>
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
              <div className="relative lg:w-72">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索本地尺码或 SHEIN 尺码"
                  className="pl-9"
                />
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">批量搜索</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>批量搜索</DialogTitle>
                    <DialogDescription>粘贴多个尺码，支持空格、换行、逗号和分号分隔。</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={batchSearchText}
                    onChange={(event) => setBatchSearchText(event.target.value)}
                    rows={8}
                    placeholder={"080\n090\n100"}
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
            <EmptyState message="暂无尺码转换规则" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>本地尺码编码</TableHead>
                  <TableHead>尺码描述</TableHead>
                  <TableHead>SHEIN尺码-录入</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono">{rule.local_size_code || "-"}</TableCell>
                    <TableCell>{rule.local_size_name || "-"}</TableCell>
                    <TableCell className="font-medium">{rule.shein_size_value}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.status}</Badge>
                    </TableCell>
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
            <DialogTitle>{editing ? "编辑尺码转换规则" : "新增尺码转换规则"}</DialogTitle>
            <DialogDescription>保存后会直接参与发布前尺码字段补齐。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>本地尺码编码</Label>
              <Input
                value={form.local_size_code}
                onChange={(event) => setForm((prev) => ({ ...prev, local_size_code: event.target.value }))}
                placeholder="080"
              />
            </div>
            <div className="grid gap-2">
              <Label>尺码描述</Label>
              <Input
                value={form.local_size_name}
                onChange={(event) => setForm((prev) => ({ ...prev, local_size_name: event.target.value }))}
                placeholder="080"
              />
            </div>
            <div className="grid gap-2">
              <Label>SHEIN尺码-录入</Label>
              <Input
                value={form.shein_size_value}
                onChange={(event) => setForm((prev) => ({ ...prev, shein_size_value: event.target.value }))}
                placeholder="9-12M"
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
