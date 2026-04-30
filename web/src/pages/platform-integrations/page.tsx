import { useState } from "react"
import { CheckCircle2, Pencil, PlugZap, Plus, TestTube2, Trash2 } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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

interface PlatformIntegration {
  id: number
  platform: string
  integration_name: string
  business_mode: string
  environment: string
  status: string
  base_url: string | null
  language: string | null
  open_key_mask: string | null
  has_open_key: boolean
  secret_mask: string | null
  is_default: boolean
  last_test_status: string | null
  last_test_message: string | null
  last_tested_at: string | null
  updated_at: string
}

interface IntegrationForm {
  id?: number
  platform: string
  integration_name: string
  business_mode: string
  environment: string
  status: string
  base_url: string
  language: string
  open_key_id: string
  secret_key: string
  is_default: boolean
}

const EMPTY_FORM: IntegrationForm = {
  platform: "SHEIN",
  integration_name: "SHEIN 默认全托管账号",
  business_mode: "FULL_MANAGED",
  environment: "TEST",
  status: "ACTIVE",
  base_url: "https://openapi-test01.sheincorp.cn",
  language: "zh-cn",
  open_key_id: "",
  secret_key: "",
  is_default: true,
}

export default function PlatformIntegrationsPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<IntegrationForm>(EMPTY_FORM)
  const isEditing = Boolean(form.id)

  const { data, isLoading } = useQuery<{ items: PlatformIntegration[] }>({
    queryKey: ["platform-integrations"],
    queryFn: () => api.get("/platform-integrations"),
  })
  const items = data?.items ?? []

  const saveMutation = useMutation({
    mutationFn: () => isEditing
      ? api.put(`/platform-integrations/${form.id}`, form)
      : api.post("/platform-integrations", form),
    onSuccess: () => {
      toast.success(isEditing ? "平台配置已更新" : "平台配置已创建")
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ["platform-integrations"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存平台配置失败"),
  })

  const testMutation = useMutation({
    mutationFn: (id: number) => api.post<{ ok: boolean; message: string }>(`/platform-integrations/${id}/test`),
    onSuccess: (result) => {
      toast[result.ok ? "success" : "error"](result.message)
      queryClient.invalidateQueries({ queryKey: ["platform-integrations"] })
    },
    onError: () => toast.error("测试平台配置失败"),
  })

  const disableMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/platform-integrations/${id}`),
    onSuccess: () => {
      toast.success("平台配置已停用")
      queryClient.invalidateQueries({ queryKey: ["platform-integrations"] })
    },
    onError: () => toast.error("停用平台配置失败"),
  })

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="平台对接"
        description="统一管理 SHEIN 等平台的 OpenAPI 对接配置。已有环境文件中的 SHEIN openKeyId 和 secretKey 会自动迁移为默认配置。"
      >
        <Button
          onClick={() => {
            setForm(EMPTY_FORM)
            setOpen(true)
          }}
        >
          <Plus className="size-4" />
          新增配置
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>对接配置</CardTitle>
          <p className="text-sm text-muted-foreground">支持多平台扩展，当前发布链路优先使用启用的 SHEIN 默认配置。</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>平台</TableHead>
                  <TableHead>配置</TableHead>
                  <TableHead>凭证</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>测试</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      加载平台配置...
                    </TableCell>
                  </TableRow>
                ) : items.length ? items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <PlugZap className="size-4" />
                        {item.platform}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.environment} / {item.business_mode}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.integration_name}</div>
                      <div className="max-w-[360px] truncate text-xs text-muted-foreground">{item.base_url ?? "未配置 Base URL"}</div>
                      <div className="text-xs text-muted-foreground">语言：{item.language ?? "zh-cn"}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>openKeyId：{item.open_key_mask ?? "—"}</div>
                      <div className="text-muted-foreground">secretKey：{item.secret_mask ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className={item.status === "ACTIVE" ? "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]" : ""}>
                          {item.status === "ACTIVE" ? "启用" : "停用"}
                        </Badge>
                        {item.is_default ? (
                          <Badge variant="outline">
                            <CheckCircle2 className="mr-1 size-3" />
                            默认
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{item.last_test_status ?? "未测试"}</div>
                      <div className="max-w-[240px] truncate text-xs text-muted-foreground">
                        {item.last_test_message ?? formatDateTime(item.last_tested_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => testMutation.mutate(item.id)}>
                          <TestTube2 className="size-4" />
                          测试
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setForm({
                              id: item.id,
                              platform: item.platform,
                              integration_name: item.integration_name,
                              business_mode: item.business_mode,
                              environment: item.environment,
                              status: item.status,
                              base_url: item.base_url ?? "",
                              language: item.language ?? "zh-cn",
                              open_key_id: "",
                              secret_key: "",
                              is_default: item.is_default,
                            })
                            setOpen(true)
                          }}
                        >
                          <Pencil className="size-4" />
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => disableMutation.mutate(item.id)}>
                          <Trash2 className="size-4" />
                          停用
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      暂无平台配置
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? "编辑平台配置" : "新增平台配置"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>平台</Label>
              <Select value={form.platform} onValueChange={(value) => setForm((current) => ({ ...current, platform: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHEIN">SHEIN</SelectItem>
                  <SelectItem value="TEMU">TEMU</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>配置名称</Label>
              <Input value={form.integration_name} onChange={(event) => setForm((current) => ({ ...current, integration_name: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>环境</Label>
              <Select value={form.environment} onValueChange={(value) => setForm((current) => ({ ...current, environment: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEST">测试</SelectItem>
                  <SelectItem value="PROD">生产</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">启用</SelectItem>
                  <SelectItem value="INACTIVE">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Base URL</Label>
              <Input value={form.base_url} onChange={(event) => setForm((current) => ({ ...current, base_url: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>语言</Label>
              <Input value={form.language} onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>业务模式</Label>
              <Input value={form.business_mode} onChange={(event) => setForm((current) => ({ ...current, business_mode: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>openKeyId</Label>
              <Input
                value={form.open_key_id}
                placeholder={isEditing && form.open_key_id === "" ? "留空表示不修改" : ""}
                onChange={(event) => setForm((current) => ({ ...current, open_key_id: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>secretKey</Label>
              <Input
                type="password"
                value={form.secret_key}
                placeholder={isEditing ? "留空表示不修改" : ""}
                onChange={(event) => setForm((current) => ({ ...current, secret_key: event.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <Switch checked={form.is_default} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_default: checked }))} />
              设为该平台默认配置
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
