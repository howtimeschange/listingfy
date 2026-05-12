import { OperationCapabilityPage } from "../_components/operation-capability-page"

export default function SheinFinancePage() {
  return (
    <OperationCapabilityPage
      title="财务经营"
      phase="P2"
      description="沉淀报账单、销售款、补扣款等财务数据，作为经营分析而不是商品编辑主链路的前置条件。"
      businessGoal="把 SHEIN 财务数据和平台商品、供货价、销量结合，形成经营分析和异常核对能力。"
      interfaces={[
        {
          name: "报账单",
          path: "报账单相关接口",
          purpose: "同步报账单和结算周期，用于核对商品维度经营结果。",
          status: "P2规划",
        },
        {
          name: "销售款",
          path: "销售款相关接口",
          purpose: "同步销售款明细，结合 SKU、销量、供货价做利润分析。",
          status: "P2规划",
        },
        {
          name: "补扣款",
          path: "补扣款相关接口",
          purpose: "识别平台补款、扣款、罚款等异常财务事项。",
          status: "P2规划",
        },
      ]}
      flows={[
        {
          title: "结算同步",
          detail: "按账期同步报账单和销售款明细，并关联平台 SPU/SKC/SKU。",
        },
        {
          title: "经营核算",
          detail: "结合供货价、销量、销售款和扣款，计算 SKU 维度毛利和异常波动。",
        },
        {
          title: "补扣款核对",
          detail: "按原因、账期、商品聚合补扣款，生成待处理财务异常列表。",
        },
        {
          title: "经营分析导出",
          detail: "面向财务和运营导出账期、商品、站点、币种维度分析表。",
        },
      ]}
      dataModel={[
        "shein_finance_statement：报账单账期快照",
        "shein_sales_payment：销售款明细",
        "shein_adjustment_payment：补扣款明细",
      ]}
      nextSteps={[
        "先确认财务接口权限和字段口径。",
        "和库存运营共享销量、SKU、币种基础维度。",
        "P2 后半段再接入，不阻塞 P0/P1 商品生命周期闭环。",
      ]}
    />
  )
}
