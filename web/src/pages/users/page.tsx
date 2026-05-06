import { useMemo, useState } from "react"
import { Pencil, Plus, ShieldCheck, Trash2, KeyRound } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
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

interface UserItem {
  id: number
  username: string
  display_name: string
  email: string | null
  status: string
  roles: string[]
  last_login_at: string | null
  updated_at: string
}

interface RoleItem {
  role_key: string
  role_name: string
  description: string
}

interface UserForm {
  id?: number
  username: string
  display_name: string
  email: string
  password: string
  status: string
  roles: string[]
}

const EMPTY_FORM: UserForm = {
  username: "",
  display_name: "",
  email: "",
  password: "",
  status: "ACTIVE",
  roles: ["VIEWER"],
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    ADMIN: "管理员",
    OPERATOR: "运营",
    VIEWER: "只读",
  }
  return labels[role] ?? role
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const isEditing = Boolean(form.id)

  const { data: usersData, isLoading } = useQuery<{ items: UserItem[] }>({
    queryKey: ["users"],
    queryFn: () => api.get("/users"),
  })
  const { data: rolesData } = useQuery<{ items: RoleItem[] }>({
    queryKey: ["users", "roles"],
    queryFn: () => api.get("/users/roles"),
  })

  const roles = useMemo(() => rolesData?.items ?? [], [rolesData])
  const users = useMemo(() => usersData?.items ?? [], [usersData])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        username: form.username,
        display_name: form.display_name,
        email: form.email,
        password: form.password,
        status: form.status,
        roles: form.roles,
      }
      return isEditing ? api.put(`/users/${form.id}`, payload) : api.post("/users", payload)
    },
    onSuccess: () => {
      toast.success(isEditing ? "用户已更新" : "用户已创建")
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存用户失败"),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api.post(`/users/${id}/reset-password`, { password }),
    onSuccess: () => toast.success("密码已重置"),
    onError: () => toast.error("重置密码失败"),
  })

  const disableMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success("用户已停用")
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: () => toast.error("停用用户失败"),
  })

  const activeCount = useMemo(() => users.filter((item) => item.status === "ACTIVE").length, [users])

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="用户管理"
        description="管理系统账号、角色和 RBAC 权限，控制谁可以维护平台配置、发布任务和查看审计记录。"
      >
        <Button
          onClick={() => {
            setForm(EMPTY_FORM)
            setOpen(true)
          }}
        >
          <Plus className="size-4" />
          新增用户
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <p className="text-sm text-muted-foreground">用户 {users.length} / 启用 {activeCount}</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账号</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      加载用户...
                    </TableCell>
                  </TableRow>
                ) : users.length ? users.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.username}{item.email ? ` / ${item.email}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.roles.map((role) => (
                          <Badge key={role} variant="outline">
                            {roleLabel(role)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={item.status === "ACTIVE" ? "border-[#b9f4d8] bg-[#d4fae8] text-[#0fa76e]" : ""}>
                        {item.status === "ACTIVE" ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(item.last_login_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setForm({
                              id: item.id,
                              username: item.username,
                              display_name: item.display_name,
                              email: item.email ?? "",
                              password: "",
                              status: item.status,
                              roles: item.roles,
                            })
                            setOpen(true)
                          }}
                        >
                          <Pencil className="size-4" />
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const password = window.prompt("请输入新密码，至少 8 位")
                            if (password) resetPasswordMutation.mutate({ id: item.id, password })
                          }}
                        >
                          <KeyRound className="size-4" />
                          重置密码
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={item.status !== "ACTIVE"}
                          onClick={() => disableMutation.mutate(item.id)}
                        >
                          <Trash2 className="size-4" />
                          停用
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      暂无用户
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "编辑用户" : "新增用户"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>账号</Label>
              <Input
                value={form.username}
                disabled={isEditing}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>姓名</Label>
              <Input
                value={form.display_name}
                onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>邮箱</Label>
              <Input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            {!isEditing ? (
              <div className="grid gap-2">
                <Label>初始密码</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">启用</SelectItem>
                  <SelectItem value="DISABLED">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>角色</Label>
              <div className="grid gap-2 rounded-lg border p-3">
                {roles.map((role) => (
                  <label key={role.role_key} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={form.roles.includes(role.role_key)}
                      onCheckedChange={(checked) => {
                        setForm((current) => ({
                          ...current,
                          roles: checked
                            ? [...current.roles, role.role_key]
                            : current.roles.filter((item) => item !== role.role_key),
                        }))
                      }}
                    />
                    <span>
                      <span className="flex items-center gap-1 font-medium">
                        <ShieldCheck className="size-3.5" />
                        {role.role_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">{role.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
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
