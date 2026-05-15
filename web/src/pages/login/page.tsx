import { useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LogIn, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import { useAuth, type AuthUser } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard"

  const mutation = useMutation({
    mutationFn: () => api.post<{ user: AuthUser }>("/auth/login", { username, password }),
    onSuccess: (result) => {
      queryClient.setQueryData(["auth", "me"], result)
      navigate(from, { replace: true })
    },
    onError: () => toast.error("登录失败，请检查账号和密码"),
  })

  if (!isLoading && user) return <Navigate to="/dashboard" replace />

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">登录 Listingify</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              使用系统账号进入发布中台。
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="username">账号</Label>
              <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
              />
            </div>
            <Button className="w-full" type="submit" disabled={mutation.isPending}>
              <LogIn className="size-4" />
              登录
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
