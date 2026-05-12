import { OperationCapabilityPage } from "../_components/operation-capability-page"

export default function SheinInventoryPage() {
  return (
    <OperationCapabilityPage
      title="库存运营"
      phase="P2"
      description="围绕库存查询、库存更新和销量查询建立价格/库存协同运营面板。"
      businessGoal="在成本价更新闭环之后，补齐库存查询和库存更新，帮助运营在 SKU 维度判断补货、停售和库存异常。"
      interfaces={[
        {
          name: "更新商品库存",
          path: "/open-api/goods/stock-update",
          purpose: "按 SHEIN SKU 或仓库维度更新可售库存。",
          status: "P2规划",
        },
        {
          name: "库存查询",
          path: "/open-api/stock/stock-query",
          purpose: "查询平台库存，和本地库存、备货单做差异对账。",
          status: "P2规划",
        },
        {
          name: "销量查询",
          path: "销量查询相关接口",
          purpose: "结合库存和销量判断缺货、滞销、补货优先级。",
          status: "P2规划",
        },
      ]}
      flows={[
        {
          title: "库存同步",
          detail: "按 SPU/SKC/SKU 和仓库批量查询平台库存，写入本地库存快照。",
        },
        {
          title: "库存更新",
          detail: "选择 SKU 和仓库提交库存调整，记录原因、操作人和 SHEIN 响应。",
        },
        {
          title: "库存异常",
          detail: "识别平台库存为 0、本地有库存、库存差异过大、停售仍有库存等异常。",
        },
        {
          title: "销量辅助",
          detail: "接入销量查询后按近 7/14/30 天销量生成补货和停售建议。",
        },
      ]}
      dataModel={[
        "shein_inventory_snapshot：平台库存快照",
        "shein_inventory_adjustment：库存更新任务流水",
        "shein_sales_snapshot：销量快照与趋势",
      ]}
      nextSteps={[
        "在平台商品 SKU 详情中增加库存入口。",
        "先做 stock-query 只读同步，再开放 stock-update。",
        "库存更新需要操作原因、权限和审计日志。",
      ]}
    />
  )
}
