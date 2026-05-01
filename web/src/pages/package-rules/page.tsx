import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Box, Download, Edit3, Loader2, Plus, Search, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
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

interface WeightRow {
  id: number
  spu_code: string | null
  skc_code: string | null
  sku_code: string | null
  package_weight_g: number | null
  status: string
  created_at: string
  updated_at: string | null
}

interface WeightList {
  items: WeightRow[]
  pagination: ServerPaginationState
}

interface ImportResult {
  success_count: number
  failed_count: number
}

interface PackageRule {
  id: number
  rule_name: string
  priority: number
  match_mode: "ANY" | "ALL"
  match_keywords: string[]
  package_length_cm: number
  package_width_cm: number
  package_height_cm: number
  package_type: string
  status: string
  note: string | null
  updated_at: string
}

interface PackageRuleList {
  items: PackageRule[]
  pagination: ServerPaginationState
}

const emptyForm = {
  spu_code: "",
  skc_code: "",
  sku_code: "",
  package_weight_g: "",
}

const emptyRuleForm = {
  rule_name: "",
  priority: "0",
  match_mode: "ANY",
  match_keywords: "",
  package_length_cm: "",
  package_width_cm: "",
  package_height_cm: "",
  package_type: "软包装+软物品",
  status: "ACTIVE",
  note: "",
}

function useProductWeights(search: string, batchSearch: string, pagination: { limit: number; offset: number }) {
  return useQuery<WeightList>({
    queryKey: ["business-rules", "product-weights", search, batchSearch, pagination],
    queryFn: () =>
      api.get(
        `/business-rules/product-weights?q=${encodeURIComponent(search)}&batch_search=${encodeURIComponent(batchSearch)}&limit=${pagination.limit}&offset=${pagination.offset}`,
      ),
  })
}

function usePackageRules() {
  return useQuery<PackageRuleList>({
    queryKey: ["business-rules", "package-rules"],
    queryFn: () => api.get("/business-rules/package-rules?limit=200&offset=0"),
  })
}

function formatRuleSize(rule: PackageRule) {
  return `${rule.package_length_cm}*${rule.package_width_cm}*${rule.package_height_cm}cm`
}

export default function PackageRulesPage() {
  const [search, setSearch] = useState("")
  const [batchSearchText, setBatchSearchText] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WeightRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<PackageRule | null>(null)
  const [ruleForm, setRuleForm] = useState(emptyRuleForm)
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const queryClient = useQueryClient()

  const { data, isLoading } = useProductWeights(search, batchSearchText, pagination)
  const { data: packageRuleData } = usePackageRules()
  const packageRules = packageRuleData?.items ?? []
  const items = data?.items ?? []
  const totalCount = data?.pagination?.total ?? 0
  const batchCount = useMemo(() => parseBatchSearch(batchSearchText).length, [batchSearchText])
  const canSave = form.sku_code.trim() !== "" && Number(form.package_weight_g) > 0
  const canSaveRule = ruleForm.rule_name.trim() !== ""
    && Number(ruleForm.package_length_cm) > 0
    && Number(ruleForm.package_width_cm) > 0
    && Number(ruleForm.package_height_cm) > 0

  const importMutation = useMutation({
    mutationFn: (payload: { file_name: string; rows: SpreadsheetRow[] }) =>
      api.post<ImportResult>("/business-rules/product-weights/import", payload),
    onSuccess: (result) => {
      toast.success(`导入完成：成功 ${result.success_count} 个 SKU，失败 ${result.failed_count} 行`)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "product-weights"] })
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        spu_code: form.spu_code,
        skc_code: form.skc_code,
        sku_code: form.sku_code,
        package_weight_g: Number(form.package_weight_g),
      }
      return editing
        ? api.patch(`/business-rules/product-weights/${editing.id}`, body)
        : api.post("/business-rules/product-weights", body)
    },
    onSuccess: () => {
      toast.success(editing ? "产品毛重已更新" : "产品毛重已新增")
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "product-weights"] })
    },
  })

  const saveRuleMutation = useMutation({
    mutationFn: () => {
      const body = {
        rule_name: ruleForm.rule_name,
        priority: Number(ruleForm.priority),
        match_mode: ruleForm.match_mode,
        match_keywords: ruleForm.match_keywords,
        package_length_cm: Number(ruleForm.package_length_cm),
        package_width_cm: Number(ruleForm.package_width_cm),
        package_height_cm: Number(ruleForm.package_height_cm),
        package_type: ruleForm.package_type,
        status: ruleForm.status,
        note: ruleForm.note,
      }
      return editingRule
        ? api.patch(`/business-rules/package-rules/${editingRule.id}`, body)
        : api.post("/business-rules/package-rules", body)
    },
    onSuccess: () => {
      toast.success(editingRule ? "包装规则已更新" : "包装规则已新增")
      setRuleDialogOpen(false)
      setEditingRule(null)
      setRuleForm(emptyRuleForm)
      queryClient.invalidateQueries({ queryKey: ["business-rules", "package-rules"] })
      queryClient.invalidateQueries({ queryKey: ["shein-products"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/business-rules/product-weights/${id}`),
    onSuccess: () => {
      toast.success("产品毛重已删除")
      queryClient.invalidateQueries({ queryKey: ["business-rules", "product-weights"] })
    },
  })

  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/business-rules/package-rules/${id}`),
    onSuccess: () => {
      toast.success("包装规则已删除")
      queryClient.invalidateQueries({ queryKey: ["business-rules", "package-rules"] })
      queryClient.invalidateQueries({ queryKey: ["shein-products"] })
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
    const result = await api.get<{ rows: SpreadsheetRow[] }>("/business-rules/product-weights/export")
    exportSpreadsheet("库存毛重表-导出.xlsx", result.rows)
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openCreateRule() {
    setEditingRule(null)
    setRuleForm(emptyRuleForm)
    setRuleDialogOpen(true)
  }

  function openEditRule(rule: PackageRule) {
    setEditingRule(rule)
    setRuleForm({
      rule_name: rule.rule_name,
      priority: String(rule.priority ?? 0),
      match_mode: rule.match_mode || "ANY",
      match_keywords: rule.match_keywords.join("\n"),
      package_length_cm: String(rule.package_length_cm ?? ""),
      package_width_cm: String(rule.package_width_cm ?? ""),
      package_height_cm: String(rule.package_height_cm ?? ""),
      package_type: rule.package_type || "软包装+软物品",
      status: rule.status || "ACTIVE",
      note: rule.note ?? "",
    })
    setRuleDialogOpen(true)
  }

  function openEdit(row: WeightRow) {
    setEditing(row)
    setForm({
      spu_code: row.spu_code ?? "",
      skc_code: row.skc_code ?? "",
      sku_code: row.sku_code ?? "",
      package_weight_g: row.package_weight_g == null ? "" : String(row.package_weight_g),
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
        title="SHEIN 包装规则"
        description="SHEIN 包装尺寸按规则自动带出；库存毛重表只按 SKU 维度存取，导入时以源表「sku」「款号」「sku重量」逐条写入，不再按款号取平均值。"
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
            导入库存毛重表
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
          </Label>
        </Button>
        <Button variant="outline" onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          新增毛重
        </Button>
        <Button onClick={openCreateRule}>
          <Plus className="mr-2 size-4" />
          新增包装规则
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-4">
        {packageRules.map((rule) => (
          <Card key={rule.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{rule.rule_name}</CardTitle>
                <Badge variant="outline">{formatRuleSize(rule)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">匹配规则</p>
                <p>{rule.match_keywords.length ? rule.match_keywords.join(" / ") : "默认兜底"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">包装类型</p>
                <p>{rule.package_type}</p>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <Badge variant={rule.status === "ACTIVE" ? "secondary" : "outline"}>
                  优先级 {rule.priority}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-xs" onClick={() => openEditRule(rule)}>
                    <Edit3 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive"
                    onClick={() => deleteRuleMutation.mutate(rule.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>产品毛重报表</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                SHEIN 尺寸规则 {formatNumber(packageRules.length)} / SKU 毛重记录 {formatNumber(totalCount)} / 当前页 {formatNumber(items.length)} / 批量搜索 {batchCount ? `${batchCount} 个词` : "未启用"}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
              <div className="relative lg:w-80">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="搜索款号、SKC 或 SKU"
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
                    onChange={(event) => updateBatchSearch(event.target.value)}
                    rows={8}
                    placeholder={"201122104105\n20242510701000377160"}
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
            <EmptyState icon={Box} message="暂无毛重数据" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>款号</TableHead>
                  <TableHead>SKC</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>产品毛重/g</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>导入时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.spu_code || "-"}</TableCell>
                    <TableCell className="font-mono">{item.skc_code || "-"}</TableCell>
                    <TableCell className="font-mono">{item.sku_code || "-"}</TableCell>
                    <TableCell>{item.package_weight_g ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.status || "ACTIVE"}</Badge>
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
            <DialogTitle>{editing ? "编辑产品毛重" : "新增产品毛重"}</DialogTitle>
            <DialogDescription>导入源表按「sku」匹配，以「sku重量」字段写入 SKU 级产品毛重。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Label className="grid gap-2">
              款号（可选）
              <Input
                value={form.spu_code}
                onChange={(event) => setForm((current) => ({ ...current, spu_code: event.target.value }))}
                placeholder="导入源表第 5 列「款号」，可由 SKU 自动反查"
              />
            </Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Label className="grid gap-2">
                SKC
                <Input
                  value={form.skc_code}
                  onChange={(event) => setForm((current) => ({ ...current, skc_code: event.target.value }))}
                  placeholder="可选"
                />
              </Label>
              <Label className="grid gap-2">
                SKU
                <Input
                  value={form.sku_code}
                  onChange={(event) => setForm((current) => ({ ...current, sku_code: event.target.value }))}
                  placeholder="必填，导入源表第 3 列「sku」"
                />
              </Label>
            </div>
            <Label className="grid gap-2">
              SKU重量/g
              <Input
                type="number"
                value={form.package_weight_g}
                onChange={(event) => setForm((current) => ({ ...current, package_weight_g: event.target.value }))}
              />
            </Label>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !canSave}>
              {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "编辑包装规则" : "新增包装规则"}</DialogTitle>
            <DialogDescription>按优先级从高到低匹配商品中类、小类、面料、标题等文本；关键词为空时作为默认兜底规则。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Label className="grid gap-2">
                规则名称
                <Input
                  value={ruleForm.rule_name}
                  onChange={(event) => setRuleForm((current) => ({ ...current, rule_name: event.target.value }))}
                  placeholder="服装薄款"
                />
              </Label>
              <Label className="grid gap-2">
                优先级
                <Input
                  type="number"
                  value={ruleForm.priority}
                  onChange={(event) => setRuleForm((current) => ({ ...current, priority: event.target.value }))}
                />
              </Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Label className="grid gap-2">
                匹配方式
                <Select value={ruleForm.match_mode} onValueChange={(value) => setRuleForm((current) => ({ ...current, match_mode: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">任一关键词命中</SelectItem>
                    <SelectItem value="ALL">全部关键词命中</SelectItem>
                  </SelectContent>
                </Select>
              </Label>
              <Label className="grid gap-2">
                状态
                <Select value={ruleForm.status} onValueChange={(value) => setRuleForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">启用</SelectItem>
                    <SelectItem value="INACTIVE">停用</SelectItem>
                  </SelectContent>
                </Select>
              </Label>
            </div>
            <Label className="grid gap-2">
              匹配关键词
              <Textarea
                value={ruleForm.match_keywords}
                onChange={(event) => setRuleForm((current) => ({ ...current, match_keywords: event.target.value }))}
                rows={4}
                placeholder={"毛衫\n毛衣\n厚\n外套"}
              />
            </Label>
            <div className="grid gap-4 sm:grid-cols-3">
              <Label className="grid gap-2">
                长/cm
                <Input type="number" value={ruleForm.package_length_cm} onChange={(event) => setRuleForm((current) => ({ ...current, package_length_cm: event.target.value }))} />
              </Label>
              <Label className="grid gap-2">
                宽/cm
                <Input type="number" value={ruleForm.package_width_cm} onChange={(event) => setRuleForm((current) => ({ ...current, package_width_cm: event.target.value }))} />
              </Label>
              <Label className="grid gap-2">
                高/cm
                <Input type="number" step="0.1" value={ruleForm.package_height_cm} onChange={(event) => setRuleForm((current) => ({ ...current, package_height_cm: event.target.value }))} />
              </Label>
            </div>
            <Label className="grid gap-2">
              包装类型
              <Input
                value={ruleForm.package_type}
                onChange={(event) => setRuleForm((current) => ({ ...current, package_type: event.target.value }))}
              />
            </Label>
            <Label className="grid gap-2">
              备注
              <Textarea
                value={ruleForm.note}
                onChange={(event) => setRuleForm((current) => ({ ...current, note: event.target.value }))}
                rows={2}
              />
            </Label>
            <Button onClick={() => saveRuleMutation.mutate()} disabled={saveRuleMutation.isPending || !canSaveRule}>
              {saveRuleMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              保存规则
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
