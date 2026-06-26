import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Database, FileSpreadsheet, Pencil, Plus, Search, Trash2 } from "lucide-react"
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

interface DeepdrawFieldMappingRule {
  id: number
  tenant_name: string
  merchant_id: string
  field_domain_type: string
  deepdraw_field: string
  field_source: string | null
  mapped_field: string | null
  source_type: string
  source_table: string | null
  source_field: string | null
  default_value: string | null
  field_type: string | null
  importability: string | null
  blocking: boolean
  enabled: boolean
  notes: string | null
  updated_at: string
}

interface FieldMappingListResponse {
  items: DeepdrawFieldMappingRule[]
  pagination: { total: number; limit: number; offset: number }
}

interface FieldMappingImportResponse {
  inputRowCount: number
  upsertedCount: number
  sheetCount: number
}

interface RuleFormState {
  id?: number
  tenantName: string
  merchantId: string
  fieldDomainType: string
  deepdrawField: string
  fieldSource: string
  mappedField: string
  sourceType: string
  sourceTable: string
  sourceField: string
  defaultValue: string
  fieldType: string
  importability: string
  blocking: boolean
  enabled: boolean
  notes: string
}

const sourceTypeLabels: Record<string, string> = {
  mdm: "MDM",
  launch_plan: "上市计划表",
  copywriting: "标准文案表",
  fixed: "固定值",
  manual: "人为判断/AI 补齐",
  skip: "不填",
}

function emptyForm(tenantName: string, merchantId: string): RuleFormState {
  return {
    tenantName,
    merchantId,
    fieldDomainType: "通用字段",
    deepdrawField: "",
    fieldSource: "",
    mappedField: "",
    sourceType: "manual",
    sourceTable: "",
    sourceField: "",
    defaultValue: "",
    fieldType: "",
    importability: "",
    blocking: true,
    enabled: true,
    notes: "",
  }
}

function formFromRule(rule: DeepdrawFieldMappingRule): RuleFormState {
  return {
    id: rule.id,
    tenantName: rule.tenant_name,
    merchantId: rule.merchant_id,
    fieldDomainType: rule.field_domain_type ?? "通用字段",
    deepdrawField: rule.deepdraw_field,
    fieldSource: rule.field_source ?? rule.source_table ?? "",
    mappedField: rule.mapped_field ?? rule.source_field ?? rule.default_value ?? "",
    sourceType: rule.source_type,
    sourceTable: rule.source_table ?? "",
    sourceField: rule.source_field ?? "",
    defaultValue: rule.default_value ?? "",
    fieldType: rule.field_type ?? "",
    importability: rule.importability ?? "",
    blocking: rule.blocking,
    enabled: rule.enabled,
    notes: rule.notes ?? "",
  }
}

function payloadFromForm(form: RuleFormState) {
  return {
    tenantName: form.tenantName,
    merchantId: form.merchantId,
    fieldDomainType: form.fieldDomainType || "通用字段",
    deepdrawField: form.deepdrawField,
    fieldSource: form.fieldSource || null,
    mappedField: form.mappedField || null,
    sourceType: form.sourceType,
    sourceTable: form.fieldSource || null,
    sourceField: form.mappedField || null,
    defaultValue: form.defaultValue || null,
    fieldType: form.fieldType || null,
    importability: form.importability || null,
    blocking: form.blocking,
    enabled: form.enabled,
    notes: form.notes || null,
  }
}

export default function DeepdrawFieldMappingsPage() {
  const queryClient = useQueryClient()
  const [tenantName, setTenantName] = useState("电商巴拉巴拉")
  const [merchantId, setMerchantId] = useState("1162")
  const [sourceType, setSourceType] = useState("all")
  const [searchText, setSearchText] = useState("")
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 })
  const [formOpen, setFormOpen] = useState(false)
  const [formState, setFormState] = useState<RuleFormState>(() => emptyForm("电商巴拉巴拉", "1162"))
  const debouncedQuery = useDebounce(searchText, 300)

  const mappings = useQuery<FieldMappingListResponse>({
    queryKey: ["deepdraw-field-mappings", tenantName, merchantId, sourceType, debouncedQuery, pagination],
    queryFn: () => {
      const params = new URLSearchParams({
        tenantName,
        merchantId,
        sourceType,
        q: debouncedQuery,
        limit: String(pagination.limit),
        offset: String(pagination.offset),
      })
      return api.get<FieldMappingListResponse>(`/deepdraw-field-mappings?${params.toString()}`)
    },
  })

  const importMappings = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append("file", file)
      form.append("tenantName", tenantName)
      form.append("merchantId", merchantId)
      return api.postForm<FieldMappingImportResponse>("/deepdraw-field-mappings/imports", form)
    },
    onSuccess: (result) => {
      toast.success(`导入更新完成：${formatNumber(result.upsertedCount)} / ${formatNumber(result.inputRowCount)} 条，${formatNumber(result.sheetCount)} 个页签`)
      queryClient.invalidateQueries({ queryKey: ["deepdraw-field-mappings"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "导入字段对应关系失败")
    },
  })

  const saveRule = useMutation({
    mutationFn: async (form: RuleFormState) => {
      if (form.id) {
        return api.patch<DeepdrawFieldMappingRule>(`/deepdraw-field-mappings/${form.id}`, payloadFromForm(form))
      }
      return api.post<DeepdrawFieldMappingRule>("/deepdraw-field-mappings", payloadFromForm(form))
    },
    onSuccess: () => {
      toast.success(formState.id ? "编辑规则完成" : "新增规则完成")
      setFormOpen(false)
      queryClient.invalidateQueries({ queryKey: ["deepdraw-field-mappings"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "保存字段对应关系失败")
    },
  })

  const deleteRule = useMutation({
    mutationFn: (ruleId: number) => api.delete<{ ok: boolean }>(`/deepdraw-field-mappings/${ruleId}`),
    onSuccess: () => {
      toast.success("删除规则完成")
      queryClient.invalidateQueries({ queryKey: ["deepdraw-field-mappings"] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "删除字段对应关系失败")
    },
  })

  const summary = useMemo(() => {
    const total = mappings.data?.pagination.total ?? 0
    const enabled = (mappings.data?.items ?? []).filter((item) => item.enabled).length
    return `${formatNumber(total)} 条规则 / 当前页启用 ${formatNumber(enabled)} 条`
  }, [mappings.data])

  function openCreateDialog() {
    setFormState(emptyForm(tenantName, merchantId))
    setFormOpen(true)
  }

  function openEditDialog(rule: DeepdrawFieldMappingRule) {
    setFormState(formFromRule(rule))
    setFormOpen(true)
  }

  function updateForm<K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) {
    setFormState((current) => ({ ...current, [key]: value }))
  }

  return (
    <CompactListPage>
      <CompactListHeader
        title="深绘字段对应关系"
        description="按深绘品牌租户维护字段默认取数规则，区分固定值、MDM、上市计划表、标准文案表和人为判断字段。"
        summary={summary}
        actions={
          <>
            <ImportDialog
              title="导入更新深绘字段对应关系"
              description="按附件模板表头解析：字段域类型、深绘字段、字段来源、对应字段、字段类型、是否能MDM导入、备注。"
              trigger={
                <Button type="button" variant="outline" size="sm" disabled={importMappings.isPending}>
                  <FileSpreadsheet className="size-4" />
                  导入更新
                </Button>
              }
              onImport={async (file) => {
                await importMappings.mutateAsync(file)
              }}
            />
            <Button type="button" size="sm" onClick={openCreateDialog}>
              <Plus className="size-4" />
              新增规则
            </Button>
          </>
        }
      />

      <CompactListCard>
        <CompactListCardHeader>
          <CompactListToolbar>
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4" />
                规则明细
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                当前规则会作为深绘建档草稿字段默认填充和 AI 补齐判断的来源配置。
              </p>
            </div>
            <CompactListControls>
              <Input
                value={tenantName}
                onChange={(event) => {
                  setTenantName(event.target.value)
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
                placeholder="深绘品牌租户"
                className="w-[170px]"
              />
              <Input
                value={merchantId}
                onChange={(event) => {
                  setMerchantId(event.target.value)
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
                placeholder="商户 ID"
                className="w-[120px]"
              />
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value)
                    setPagination((current) => ({ ...current, offset: 0 }))
                  }}
                  placeholder="搜索深绘字段、字段来源、对应字段、备注"
                  className="pl-8"
                />
              </div>
              <Select
                value={sourceType}
                onValueChange={(value) => {
                  setSourceType(value)
                  setPagination((current) => ({ ...current, offset: 0 }))
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  {Object.entries(sourceTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
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
                  <TableHead>深绘账号</TableHead>
                  <TableHead>深绘字段</TableHead>
                  <TableHead>字段来源</TableHead>
                  <TableHead>对应字段</TableHead>
                  <TableHead>字段类型</TableHead>
                  <TableHead>是否能MDM导入</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>启用</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mappings.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.tenant_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.merchant_id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.deepdraw_field}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.field_domain_type || "通用字段"}</div>
                    </TableCell>
                    <TableCell>
                      <div>{item.field_source || sourceTypeLabels[item.source_type] || item.source_type || "-"}</div>
                      <Badge className="mt-1" variant="outline">{sourceTypeLabels[item.source_type] ?? item.source_type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {item.mapped_field || item.source_field || item.default_value || "-"}
                    </TableCell>
                    <TableCell>
                      {item.field_type || "-"}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{item.importability || "-"}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{item.notes || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Checkbox checked={item.enabled} disabled />
                        <span>{item.enabled ? "启用" : "停用"}</span>
                      </div>
                      {item.blocking ? <div className="mt-1 text-xs text-[#c37d0d]">阻断必填</div> : null}
                    </TableCell>
                    <TableCell>{formatDateTime(item.updated_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                          <Pencil className="size-4" />
                          编辑规则
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={deleteRule.isPending}
                          onClick={() => {
                            if (window.confirm(`确认删除字段规则「${item.deepdraw_field}」？`)) {
                              deleteRule.mutate(item.id)
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CompactListTableFrame>
          <ServerPagination
            pagination={mappings.data?.pagination}
            onLimitChange={(limit) => setPagination({ limit, offset: 0 })}
            onOffsetChange={(offset) => setPagination((current) => ({ ...current, offset }))}
            isLoading={mappings.isFetching}
          />
        </CompactListCardContent>
      </CompactListCard>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{formState.id ? "编辑规则" : "新增规则"}</DialogTitle>
            <DialogDescription>
              配置深绘字段的默认取数来源。人为判断字段会进入人工/AI 补齐路径。
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[68vh] gap-4 overflow-auto pr-1 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>深绘品牌租户</Label>
              <Input value={formState.tenantName} onChange={(event) => updateForm("tenantName", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>商户 ID</Label>
              <Input value={formState.merchantId} onChange={(event) => updateForm("merchantId", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>字段域类型</Label>
              <Input value={formState.fieldDomainType} onChange={(event) => updateForm("fieldDomainType", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>深绘字段</Label>
              <Input value={formState.deepdrawField} onChange={(event) => updateForm("deepdrawField", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>字段来源</Label>
              <Input value={formState.fieldSource} onChange={(event) => updateForm("fieldSource", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>对应字段</Label>
              <Input value={formState.mappedField} onChange={(event) => updateForm("mappedField", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>系统取数类型</Label>
              <Select value={formState.sourceType} onValueChange={(value) => updateForm("sourceType", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sourceTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>固定值/默认值</Label>
              <Input value={formState.defaultValue} onChange={(event) => updateForm("defaultValue", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>字段类型</Label>
              <Input value={formState.fieldType} onChange={(event) => updateForm("fieldType", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>是否能 MDM 导入</Label>
              <Input value={formState.importability} onChange={(event) => updateForm("importability", event.target.value)} />
            </div>
            <div className="grid gap-3 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={formState.enabled} onCheckedChange={(checked) => updateForm("enabled", checked === true)} />
                启用规则
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={formState.blocking} onCheckedChange={(checked) => updateForm("blocking", checked === true)} />
                缺失时阻断下一步
              </label>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>备注</Label>
              <Textarea value={formState.notes} onChange={(event) => updateForm("notes", event.target.value)} className="min-h-24" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              disabled={saveRule.isPending || !formState.tenantName.trim() || !formState.merchantId.trim() || !formState.deepdrawField.trim()}
              onClick={() => saveRule.mutate(formState)}
            >
              {formState.id ? "保存编辑" : "创建规则"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CompactListPage>
  )
}
