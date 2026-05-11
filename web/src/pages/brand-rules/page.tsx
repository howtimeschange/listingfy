import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BadgeCheck, Download, Edit3, Loader2, Plus, Search, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import { exportSpreadsheet, parseBatchSearch, readSpreadsheetFile } from "@/lib/spreadsheet"
import type { SpreadsheetRow } from "@/lib/spreadsheet"
import { EmptyState } from "@/components/empty-state"
import { ServerPagination } from "@/components/server-pagination"
import type { ServerPaginationState } from "@/components/server-pagination"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface BrandRule {
  id: number
  brand_code: string
  brand_name: string
  local_brand_name: string | null
  aliases: string[]
  status: string
  note: string | null
  updated_at: string
  created_at: string
}

interface BrandRuleList {
  items: BrandRule[]
  pagination: ServerPaginationState
}

interface ImportResult {
  success_count: number
  failed_count: number
}

const emptyForm = {
  brand_code: "",
  brand_name: "",
  local_brand_name: "",
  aliases: "",
  status: "ACTIVE",
  note: "",
}

const defaultBrands = [
  { brand_code: "2bbws", brand_name: "Balabala" },
  { brand_code: "252fb", brand_name: "mini bala" },
]

function useBrandRules(search: string, batchSearch: string, pagination: { limit: number; offset: number }) {
  return useQuery<BrandRuleList>({
    queryKey: ["business-rules", "brand-rules", search, batchSearch, pagination],
    queryFn: () =>
      api.get(
        `/business-rules/brand-rules?q=${encodeURIComponent(search)}&batch_search=${encodeURIComponent(batchSearch)}&limit=${pagination.limit}&offset=${pagination.offset}`,
      ),
  })
}

export default function BrandRulesPage() {
  const [search, setSearch] = useState("")
  const [batchSearchText, setBatchSearchText] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BrandRule | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const queryClient = useQueryClient()

  const { data, isLoading } = useBrandRules(search, batchSearchText, pagination)
  const items = data?.items ?? []
  const totalCount = data?.pagination?.total ?? 0
  const batchCount = useMemo(() => parseBatchSearch(batchSearchText).length, [batchSearchText])
  const canSave = form.brand_code.trim() !== "" && form.brand_name.trim() !== ""

  const importMutation = useMutation({
    mutationFn: (payload: { file_name: string; rows: SpreadsheetRow[] }) =>
      api.post<ImportResult>("/business-rules/brand-rules/import", payload),
    onSuccess: (result) => {
      toast.success(`导入完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 行`)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "brand-rules"] })
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        brand_code: form.brand_code,
        brand_name: form.brand_name,
        local_brand_name: form.local_brand_name,
        aliases: form.aliases,
        status: form.status,
        note: form.note,
      }
      return editing
        ? api.patch(`/business-rules/brand-rules/${editing.id}`, body)
        : api.post("/business-rules/brand-rules", body)
    },
    onSuccess: () => {
      toast.success(editing ? "品牌映射已更新" : "品牌映射已新增")
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "brand-rules"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/business-rules/brand-rules/${id}`),
    onSuccess: () => {
      toast.success("品牌映射已删除")
      queryClient.invalidateQueries({ queryKey: ["business-rules", "brand-rules"] })
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
    const result = await api.get<{ rows: SpreadsheetRow[] }>("/business-rules/brand-rules/export")
    exportSpreadsheet("SHEIN品牌管理-导出.xlsx", result.rows)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(row: BrandRule) {
    setEditing(row)
    setForm({
      brand_code: row.brand_code,
      brand_name: row.brand_name,
      local_brand_name: row.local_brand_name ?? "",
      aliases: row.aliases.join("\n"),
      status: row.status || "ACTIVE",
      note: row.note ?? "",
    })
    setDialogOpen(true)
  }

  function updateSearch(value: string) {
    setSearch(value)
    setPagination((current) => ({ ...current, offset: 0 }))
  }

  function updateBatchSearch(value: string) {
    setBatchSearchText(value)
    setPagination((current) => ({ ...current, offset: 0 }))
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="SHEIN 品牌管理"
        description="维护发布 payload 使用的 SHEIN brand_code 与品牌名称映射；发布时按 MDM/深绘品牌名匹配，匹配后写入 brand_code。"
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
            导入品牌映射
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
          新增品牌
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        {defaultBrands.map((item) => (
          <Card key={item.brand_code}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{item.brand_name}</CardTitle>
                <Badge variant="outline" className="font-mono">{item.brand_code}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              默认品牌映射会随数据库迁移自动创建，可在下方列表编辑或停用。
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>品牌映射列表</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                品牌记录 {totalCount} / 当前页 {items.length} / 批量搜索 {batchCount ? `${batchCount} 个词` : "未启用"}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
              <div className="relative lg:w-80">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="搜索品牌code、品牌名称或别名"
                  className="pl-9"
                />
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">批量搜索</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>批量搜索品牌</DialogTitle>
                    <DialogDescription>粘贴多个品牌code或品牌名称，支持空格、换行、逗号和分号分隔。</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={batchSearchText}
                    onChange={(event) => updateBatchSearch(event.target.value)}
                    rows={8}
                    placeholder={"2bbws\n252fb\nBalabala"}
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
            <EmptyState icon={BadgeCheck} message="暂无品牌映射" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>品牌code</TableHead>
                  <TableHead>品牌名称</TableHead>
                  <TableHead>本地品牌名称</TableHead>
                  <TableHead>匹配别名</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.brand_code}</TableCell>
                    <TableCell>{item.brand_name}</TableCell>
                    <TableCell>{item.local_brand_name || "-"}</TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {item.aliases.length ? item.aliases.join(" / ") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "ACTIVE" ? "secondary" : "outline"}>
                        {item.status === "ACTIVE" ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(item.updated_at || item.created_at)}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                        <Edit3 className="mr-1 size-4" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        <Trash2 className="mr-1 size-4" />
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <ServerPagination
            pagination={data?.pagination}
            onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑品牌映射" : "新增品牌映射"}</DialogTitle>
            <DialogDescription>品牌code会写入发布 payload 的 brand_code 字段。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Label className="grid gap-2">
                品牌code
                <Input
                  value={form.brand_code}
                  onChange={(event) => setForm((current) => ({ ...current, brand_code: event.target.value }))}
                  placeholder="2bbws"
                />
              </Label>
              <Label className="grid gap-2">
                品牌名称
                <Input
                  value={form.brand_name}
                  onChange={(event) => setForm((current) => ({ ...current, brand_name: event.target.value }))}
                  placeholder="Balabala"
                />
              </Label>
            </div>
            <Label className="grid gap-2">
              本地品牌名称
              <Input
                value={form.local_brand_name}
                onChange={(event) => setForm((current) => ({ ...current, local_brand_name: event.target.value }))}
                placeholder="巴拉巴拉"
              />
            </Label>
            <Label className="grid gap-2">
              匹配别名
              <Textarea
                value={form.aliases}
                onChange={(event) => setForm((current) => ({ ...current, aliases: event.target.value }))}
                rows={4}
                placeholder={"巴拉巴拉\n电商巴拉巴拉"}
              />
            </Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Label className="grid gap-2">
                状态
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">启用</SelectItem>
                    <SelectItem value="INACTIVE">停用</SelectItem>
                  </SelectContent>
                </Select>
              </Label>
              <Label className="grid gap-2">
                备注
                <Input
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                />
              </Label>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !canSave}>
              {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
