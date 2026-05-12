import { OperationCapabilityPage } from "../_components/operation-capability-page"

export default function SheinCompliancePage() {
  return (
    <OperationCapabilityPage
      title="合规证书"
      phase="P2"
      description="承接欧盟站点和类目合规要求，管理证书池、证书文件、环保标、GPSR、代理公司和警告语。"
      businessGoal="在商品生命周期稳定后，把合规资料变成商品可上架前的结构化检查项，避免发布后因证书或标签问题被驳回。"
      interfaces={[
        {
          name: "证书池与证书文件",
          path: "证书池 / 证书文件相关接口",
          purpose: "维护商品证书池、上传证书文件并绑定 SKC 或类目要求。",
          status: "P2规划",
        },
        {
          name: "环保标与标签",
          path: "环保标 / 标签相关接口",
          purpose: "按站点和类目维护环保标签、包装标签等合规信息。",
          status: "P2规划",
        },
        {
          name: "GPSR 与代理公司",
          path: "GPSR / 代理公司 / 警告语相关接口",
          purpose: "补齐欧盟通用安全法规所需责任人、代理公司和警告语资料。",
          status: "P2规划",
        },
      ]}
      flows={[
        {
          title: "合规要求识别",
          detail: "按站点、类目、商品属性识别需要的证书、标签、GPSR 和警告语资料。",
        },
        {
          title: "资料池维护",
          detail: "把证书文件、有效期、适用品类、适用供应商和审核状态集中管理。",
        },
        {
          title: "商品绑定",
          detail: "在平台商品详情和发布草稿中展示缺失合规项，支持按 SKC 绑定证书池。",
        },
        {
          title: "到期预警",
          detail: "按证书有效期和站点要求生成预警任务，防止在售商品因证书过期触发下架风险。",
        },
      ]}
      dataModel={[
        "shein_certificate_pool：证书池基础信息",
        "shein_certificate_file：证书文件和有效期",
        "shein_product_compliance_task：商品合规处理任务",
      ]}
      nextSteps={[
        "先梳理 SHEIN 文档中证书、GPSR、标签接口权限。",
        "从欧盟站点高风险类目开始做要求识别。",
        "后续和平台商品详情页打通缺失合规项提醒。",
      ]}
    />
  )
}
