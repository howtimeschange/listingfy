import { NavLink, useLocation } from "react-router"
import {
  LayoutDashboard,
  PackagePlus,
  ClipboardEdit,
  Image,
  ShieldCheck,
  Send,
  GitBranch,
  Tags,
  Ruler,
  Box,
  DollarSign,
  TrendingDown,
  Database,
  Boxes,
  FileText,
  ImagePlus,
  KeyRound,
  RefreshCw,
  ScrollText,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  to: string
  icon: typeof LayoutDashboard
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "上新工作",
    items: [
      { label: "工作台", to: "/dashboard", icon: LayoutDashboard },
      { label: "上新批次", to: "/listing-batches", icon: PackagePlus },
      { label: "草稿工作台", to: "/draft-workbench", icon: ClipboardEdit },
      { label: "图片管理", to: "/image-management", icon: Image },
      { label: "发布校验", to: "/pre-publish-validation", icon: ShieldCheck },
      { label: "发布任务", to: "/publish-tasks", icon: Send },
    ],
  },
  {
    label: "规则中心",
    items: [
      { label: "类目映射", to: "/category-mapping", icon: GitBranch },
      { label: "属性映射", to: "/attribute-mapping", icon: Tags },
      { label: "尺码转换", to: "/size-conversion", icon: Ruler },
      { label: "包装规则", to: "/package-rules", icon: Box },
      { label: "价格规则", to: "/price-rules", icon: DollarSign },
      { label: "低倍率清单", to: "/low-rate-list", icon: TrendingDown },
    ],
  },
  {
    label: "数据中心",
    items: [
      { label: "SHEIN 元数据", to: "/shein-metadata", icon: Database },
      { label: "MDM 商品主数据", to: "/mdm-products", icon: Boxes },
      { label: "深绘内容包", to: "/deepdraw-content", icon: FileText },
      { label: "图片素材库", to: "/image-library", icon: ImagePlus },
    ],
  },
  {
    label: "系统管理",
    items: [
      { label: "SHEIN 账号", to: "/shein-accounts", icon: KeyRound },
      { label: "同步任务", to: "/sync-tasks", icon: RefreshCw },
      { label: "操作日志", to: "/operation-logs", icon: ScrollText },
    ],
  },
]

export function AppSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground text-sm font-semibold">
            S
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Listingfy</span>
            <span className="text-xs text-muted-foreground">Listing Platform</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active =
                    pathname === item.to || pathname.startsWith(`${item.to}/`)
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <NavLink
                          to={item.to}
                          className={cn(
                            "flex items-center gap-2",
                            active && "font-medium",
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
