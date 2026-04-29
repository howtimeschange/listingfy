import { useLocation } from "react-router"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"

const PATH_LABELS: Record<string, string> = {
  dashboard: "工作台",
  "listing-batches": "上新批次",
  "draft-workbench": "草稿工作台",
  "image-management": "图片管理",
  "pre-publish-validation": "发布校验",
  "publish-tasks": "发布任务",
  "category-mapping": "类目映射",
  "attribute-mapping": "属性映射",
  "size-conversion": "尺码转换",
  "package-rules": "包装规则",
  "price-rules": "价格规则",
  "low-rate-list": "低倍率清单",
  "shein-metadata": "SHEIN 元数据",
  "product-archives": "商品档案",
  "mdm-products": "MDM 商品主数据",
  "deepdraw-content": "深绘内容包",
  "image-library": "图片素材库",
  "shein-accounts": "SHEIN 账号",
  "sync-tasks": "同步任务",
  "operation-logs": "操作日志",
}

export function AppHeader() {
  const { pathname } = useLocation()
  const segments = pathname.split("/").filter(Boolean)
  const pageKey = segments[0] ?? "dashboard"
  const pageLabel = PATH_LABELS[pageKey] ?? pageKey

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium">
              {pageLabel}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
