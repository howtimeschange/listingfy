import { OperationCapabilityPage } from "../_components/operation-capability-page"

export default function SheinProcurementPage() {
  return (
    <OperationCapabilityPage
      title="采购备货"
      phase="P2"
      description="把采购单、发货单、收货仓、物流产品、手工备货单和商品备货信息纳入运营中心。"
      businessGoal="将商品链接生命周期延伸到备货履约阶段，给运营提供从商品、SKU、仓库到采购/发货任务的统一视图。"
      interfaces={[
        {
          name: "采购单与发货单",
          path: "采购单 / 发货单相关接口",
          purpose: "同步采购计划、发货节点和异常状态，关联平台 SKU。",
          status: "P2规划",
        },
        {
          name: "收货仓与物流产品",
          path: "收货仓 / 物流产品相关接口",
          purpose: "维护可用仓库和物流产品，为备货单创建提供基础配置。",
          status: "P2规划",
        },
        {
          name: "手工备货单与商品备货信息",
          path: "手工备货单 / 商品备货信息相关接口",
          purpose: "创建和追踪手工备货任务，查询商品备货要求。",
          status: "P2规划",
        },
      ]}
      flows={[
        {
          title: "备货需求看板",
          detail: "按 SPU/SKC/SKU 聚合待备货数量、目标仓、物流产品和计划发货时间。",
        },
        {
          title: "采购单追踪",
          detail: "同步采购单和发货单状态，识别逾期、数量不匹配和仓库异常。",
        },
        {
          title: "手工备货",
          detail: "从平台商品或库存预警直接生成手工备货单，并保留请求/响应流水。",
        },
        {
          title: "仓配基础数据",
          detail: "维护收货仓、物流产品、供应商和商品备货信息，减少人工查询平台后台。",
        },
      ]}
      dataModel={[
        "shein_procurement_order：采购单快照",
        "shein_shipping_order：发货单与物流节点",
        "shein_manual_stockup_task：手工备货单任务",
      ]}
      nextSteps={[
        "先确定是否有仓配团队日常操作入口需求。",
        "梳理采购单/发货单接口字段和权限。",
        "和库存运营页面共享 SKU、仓库、物流产品基础表。",
      ]}
    />
  )
}
