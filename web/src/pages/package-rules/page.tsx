import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Box, PackageCheck, Search } from "lucide-react"
import { api } from "@/lib/api-client"
import { formatDateTime, formatNumber } from "@/lib/format"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  created_at: string
}

interface WeightList {
  items: WeightRow[]
}

const defaultRules = [
  {
    name: "鞋品",
    match: "中类/小类包含鞋",
    size: "30*20*10cm",
    packageType: "硬包装",
  },
  {
    name: "服装薄款",
    match: "默认服饰、梭织、夏季轻薄款",
    size: "28*24*1cm",
    packageType: "软包装+软物品",
  },
  {
    name: "服装厚款",
    match: "毛衫、毛衣、外套、厚款",
    size: "35*25*1.5cm",
    packageType: "软包装+软物品",
  },
  {
    name: "内裤",
    match: "小类包含内裤",
    size: "25*14*2cm",
    packageType: "软包装+软物品",
  },
]

function useProductWeights(search: string) {
  return useQuery<WeightList>({
    queryKey: ["business-rules", "product-weights", search],
    queryFn: () =>
      api.get(`/business-rules/product-weights?q=${encodeURIComponent(search)}&limit=500`),
  })
}

export default function PackageRulesPage() {
  const [search, setSearch] = useState("")
  const { data, isLoading } = useProductWeights(search)
  const items = data?.items ?? []

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="包装规则"
        description="发布前根据商品类型自动带出包装尺寸；产品毛重报表来自观远 BI，当前先保留为空列表等待导入。"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="尺寸规则" value={defaultRules.length} icon={PackageCheck} />
        <StatCard title="毛重记录" value={formatNumber(items.length)} icon={Box} />
        <StatCard title="默认服装尺寸" value="28*24*1cm" description="薄款服饰默认规则" />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {defaultRules.map((rule) => (
          <Card key={rule.name}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{rule.name}</CardTitle>
                <Badge variant="outline">{rule.size}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">匹配规则</p>
                <p>{rule.match}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">包装类型</p>
                <p>{rule.packageType}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>产品毛重报表</CardTitle>
            <div className="relative lg:w-80">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索款号、SKC 或 SKU"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">加载中...</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Box}
              message="暂无毛重数据"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>款号</TableHead>
                  <TableHead>SKC</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>产品毛重/g</TableHead>
                  <TableHead>导入时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.spu_code || "-"}</TableCell>
                    <TableCell className="font-mono">{item.skc_code || "-"}</TableCell>
                    <TableCell className="font-mono">{item.sku_code || "-"}</TableCell>
                    <TableCell>{item.package_weight_g ?? "-"}</TableCell>
                    <TableCell>{formatDateTime(item.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}
