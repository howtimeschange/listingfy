import { NavLink, useLocation } from "react-router"
import {
  LayoutDashboard,
  ShoppingBag,
  ShieldCheck,
  Send,
  GitBranch,
  Globe2,
  Ruler,
  Box,
  DollarSign,
  BadgeCheck,
  Database,
  Archive,
  Barcode,
  Boxes,
  ClipboardList,
  FileText,
  ImagePlus,
  PackagePlus,
  PackageSearch,
  PlugZap,
  RefreshCw,
  ScrollText,
  Sparkles,
  Tags,
  Truck,
  UserCog,
  WalletCards,
  Warehouse,
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
import { useAuth } from "@/lib/auth-context"

type NavItem = {
  label: string
  to: string
  icon: typeof LayoutDashboard
  permission?: string
  disabled?: boolean
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "上新工作",
    items: [
      { label: "工作台", to: "/dashboard", icon: LayoutDashboard, permission: "DASHBOARD_READ" },
      { label: "上新批次", to: "/listing-batches", icon: PackagePlus, permission: "LISTING_READ" },
      { label: "SHEIN 商品分桶", to: "/shein-products", icon: ShoppingBag, permission: "LISTING_READ" },
      { label: "SHEIN 发布草稿箱", to: "/pre-publish-validation", icon: ShieldCheck, permission: "LISTING_READ" },
      { label: "发布任务", to: "/publish-tasks", icon: Send, permission: "LISTING_READ" },
    ],
  },
  {
    label: "SHEIN运营中心",
    items: [
      { label: "平台商品列表", to: "/shein-platform-products", icon: PackageSearch, permission: "LISTING_READ" },
      { label: "站点币种", to: "/shein-platform-products/sites", icon: Globe2, permission: "LISTING_READ", disabled: true },
      { label: "条码尺码", to: "/shein-operations/barcode-size", icon: Barcode, permission: "LISTING_READ", disabled: true },
      { label: "平台标识对账", to: "/shein-operations/platform-identities", icon: Tags, permission: "LISTING_READ", disabled: true },
      { label: "审核状态", to: "/shein-operations/audit-status", icon: ClipboardList, permission: "LISTING_READ" },
      { label: "合规证书", to: "/shein-operations/compliance", icon: FileText, permission: "LISTING_READ", disabled: true },
      { label: "采购备货", to: "/shein-operations/procurement", icon: Truck, permission: "LISTING_READ", disabled: true },
      { label: "库存运营", to: "/shein-operations/inventory", icon: Warehouse, permission: "LISTING_READ", disabled: true },
      { label: "财务经营", to: "/shein-operations/finance", icon: WalletCards, permission: "LISTING_READ", disabled: true },
    ],
  },
  {
    label: "规则中心",
    items: [
      { label: "SHEIN 类目映射", to: "/category-mapping", icon: GitBranch, permission: "RULE_READ" },
      { label: "SHEIN 尺码转换", to: "/size-conversion", icon: Ruler, permission: "RULE_READ" },
      { label: "SHEIN 包装规则", to: "/package-rules", icon: Box, permission: "RULE_READ" },
      { label: "SHEIN 价格规则", to: "/price-rules", icon: DollarSign, permission: "RULE_READ" },
      { label: "SHEIN 品牌管理", to: "/brand-rules", icon: BadgeCheck, permission: "RULE_READ" },
    ],
  },
  {
    label: "数据中心",
    items: [
      { label: "SHEIN 元数据", to: "/shein-metadata", icon: Database, permission: "DATA_READ" },
      { label: "商品档案", to: "/product-archives", icon: Archive, permission: "DATA_READ" },
      { label: "MDM 商品主数据", to: "/mdm-products", icon: Boxes, permission: "DATA_READ" },
      { label: "深绘内容包", to: "/deepdraw-content", icon: FileText, permission: "DATA_READ" },
      { label: "图片素材库", to: "/image-library", icon: ImagePlus, permission: "DATA_READ" },
    ],
  },
  {
    label: "系统管理",
    items: [
      { label: "平台对接", to: "/platform-integrations", icon: PlugZap, permission: "PLATFORM_CONFIG" },
      { label: "用户管理", to: "/users", icon: UserCog, permission: "USER_ADMIN" },
      { label: "同步任务", to: "/sync-tasks", icon: RefreshCw, permission: "SYNC_READ" },
      { label: "操作日志", to: "/operation-logs", icon: ScrollText, permission: "OPERATION_LOG_READ" },
    ],
  },
]

export function AppSidebar() {
  const { pathname } = useLocation()
  const { hasPermission } = useAuth()

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar/95">
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <Sparkles className="size-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-[-0.1px]">Listingify</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.6px] text-muted-foreground">
              Listing Platform
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => !item.permission || hasPermission(item.permission))
          if (visibleItems.length === 0) return null
          return (
            <SidebarGroup key={group.label} className="px-0 py-2">
              <SidebarGroupLabel className="h-7 px-3 font-mono text-[10px] uppercase tracking-[0.6px] text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const active =
                      !item.disabled && (pathname === item.to || pathname.startsWith(`${item.to}/`))
                    const Icon = item.icon
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild={!item.disabled}
                          disabled={item.disabled}
                          isActive={active}
                          tooltip={item.disabled ? `${item.label}暂不可用` : item.label}
                          className={cn(
                            "h-9 rounded-lg px-3 text-[14px] font-medium data-[active=true]:bg-[var(--brand-light)] data-[active=true]:text-foreground",
                            item.disabled &&
                              "cursor-not-allowed text-muted-foreground/60 opacity-55 hover:bg-transparent hover:text-muted-foreground/60 data-[active=true]:bg-transparent data-[active=true]:text-muted-foreground/60",
                          )}
                        >
                          {item.disabled ? (
                            <>
                              <Icon className="size-4 shrink-0" />
                              <span className="truncate whitespace-nowrap">{item.label}</span>
                            </>
                          ) : (
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
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
    </Sidebar>
  )
}
