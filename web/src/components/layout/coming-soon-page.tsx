import type { LucideIcon } from "lucide-react"
import { Construction } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { PageContainer } from "./page-container"
import { PageHeader } from "./page-header"

interface ComingSoonPageProps {
  title: string
  description: string
  icon?: LucideIcon
}

export function ComingSoonPage({
  title,
  description,
  icon: Icon = Construction,
}: ComingSoonPageProps) {
  return (
    <PageContainer className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="py-14">
          <EmptyState
            message="功能开发中，当前页面已按项目设计系统预留结构。"
            icon={Icon}
          />
        </CardContent>
      </Card>
    </PageContainer>
  )
}
