import { NavLink, useLocation } from "react-router"
import {
  LayoutDashboard,
  ShoppingBag,
  ShieldCheck,
  Send,
  GitBranch,
  Tags,
  Ruler,
  Box,
  DollarSign,
  TrendingDown,
  Database,
  Archive,
  Boxes,
  FileText,
  ImagePlus,
  KeyRound,
  RefreshCw,
  ScrollText,
  Sparkles,
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
      { label: "SHEIN 商品分桶", to: "/shein-products", icon: ShoppingBag },
      { label: "SHEIN 发布草稿箱", to: "/pre-publish-validation", icon: ShieldCheck },
      { label: "发布任务", to: "/publish-tasks", icon: Send },
    ],
  },
  {
    label: "规则中心",
    items: [
      { label: "类目映射", to: "/category-mapping", icon: GitBranch },
      { label: "属性映射", to: "/attribute-mapping", icon: Tags },
      { label: "SHEIN 尺码转换", to: "/size-conversion", icon: Ruler },
      { label: "包装规则", to: "/package-rules", icon: Box },
      { label: "价格规则", to: "/price-rules", icon: DollarSign },
      { label: "SHEIN 低倍率清单", to: "/low-rate-list", icon: TrendingDown },
    ],
  },
  {
    label: "数据中心",
    items: [
      { label: "SHEIN 元数据", to: "/shein-metadata", icon: Database },
      { label: "商品档案", to: "/product-archives", icon: Archive },
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar/95">
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <Sparkles className="size-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-[-0.1px]">Listingfy</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.6px] text-muted-foreground">
              Listing Platform
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="px-0 py-2">
            <SidebarGroupLabel className="h-7 px-3 font-mono text-[10px] uppercase tracking-[0.6px] text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
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
                        className="h-9 rounded-lg px-3 text-[14px] font-medium data-[active=true]:bg-[var(--brand-light)] data-[active=true]:text-foreground"
                      >
                        <NavLink
                          to={item.to}
                          className={cn(
                            "flex items-center gap-2",
                            active && "font-medium",
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate whitespace-nowrap">{item.label}</span>
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
