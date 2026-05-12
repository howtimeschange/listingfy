import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export interface InterfaceCapability {
  name: string
  path: string
  purpose: string
  status: "已接入" | "P1待接入" | "P2规划" | "复用现有"
}

export interface OperationFlow {
  title: string
  detail: string
}

export interface CapabilityPageProps {
  title: string
  phase: "P1" | "P2"
  description: string
  businessGoal: string
  interfaces: InterfaceCapability[]
  flows: OperationFlow[]
  dataModel: string[]
  nextSteps: string[]
  children?: ReactNode
}

function statusVariant(status: InterfaceCapability["status"]) {
  if (status === "已接入" || status === "复用现有") return "secondary"
  if (status === "P1待接入") return "outline"
  return "ghost"
}

export function OperationCapabilityPage({
  title,
  phase,
  description,
  businessGoal,
  interfaces,
  flows,
  dataModel,
  nextSteps,
  children,
}: CapabilityPageProps) {
  return (
    <PageContainer className="space-y-6">
      <PageHeader title={title} description={description} compact>
        <Badge variant={phase === "P1" ? "secondary" : "outline"}>{phase}</Badge>
        <Badge variant="outline">SHEIN运营中心</Badge>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>功能设计</CardTitle>
            <p className="text-sm text-muted-foreground">{businessGoal}</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {flows.map((flow) => (
                <div key={flow.title} className="rounded-md border p-3">
                  <div className="text-sm font-medium">{flow.title}</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{flow.detail}</p>
                </div>
              ))}
            </div>
            {children}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>接口能力</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {interfaces.map((item) => (
                <div key={item.path} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{item.path}</div>
                    </div>
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.purpose}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>接入状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {nextSteps.map((step) => (
                <div key={step} className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  {step}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>数据与任务落点</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {dataModel.map((item) => (
            <div key={item} className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  )
}
