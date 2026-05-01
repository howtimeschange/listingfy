import { useLocation, useNavigate } from "react-router"
import { LogOut } from "lucide-react"
import { toast } from "sonner"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"

const PATH_LABELS: Record<string, string> = {
  dashboard: "工作台",
  "listing-batches": "上新批次",
  "draft-workbench": "SHEIN 发布草稿箱",
  "image-management": "图片管理",
  "shein-products": "SHEIN 商品分桶",
  "pre-publish-validation": "SHEIN 发布草稿箱",
  "publish-tasks": "发布任务",
  "category-mapping": "SHEIN 类目映射",
  "size-conversion": "SHEIN 尺码转换",
  "package-rules": "SHEIN 包装规则",
  "price-rules": "SHEIN 价格规则",
  "shein-metadata": "SHEIN 元数据",
  "product-archives": "商品档案",
  "mdm-products": "MDM 商品主数据",
  "deepdraw-content": "深绘内容包",
  "image-library": "图片素材库",
  "shein-accounts": "平台对接",
  "platform-integrations": "平台对接",
  users: "用户管理",
  "sync-tasks": "同步任务",
  "operation-logs": "操作日志",
}

export function AppHeader() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const segments = pathname.split("/").filter(Boolean)
  const pageKey = segments[0] ?? "dashboard"
  const pageLabel = PATH_LABELS[pageKey] ?? pageKey

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium">
              {pageLabel}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground md:inline">
          {user?.display_name ?? user?.username}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await logout()
            toast.success("已退出登录")
            navigate("/login", { replace: true })
          }}
        >
          <LogOut className="size-4" />
          退出登录
        </Button>
      </div>
    </header>
  )
}
