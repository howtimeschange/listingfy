# SHEIN 商品链接全生命周期接口计划

日期：2026-05-11
最近更新：2026-05-12

## 背景

来源文件：`/Users/xingyicheng/Downloads/SHEIN API接口权限&运营需求清单-5.9.xlsx`

当前系统已经实现 `publishOrEdit` 的商品发布提交。下一阶段目标不是单点“上新”，而是围绕 SHEIN 平台对象 `spu_name / skc_name / sku_code` 建立商品链接全生命周期管理：查询、编辑、在已发布 SPU 下新增 SKC/SKU、调成本价、审核状态追踪、必要时撤回或下架。

## 当前项目进度

截至 2026-05-12，P0 已经从“接口可调用”推进到“有持久化、有页面、有操作流水”的可体验闭环；P1-A/P1-B 已完成第一版后端、库表和运营页面，进入真实 SHEIN 账号回归阶段。

已完成：

1. 平台适配器已补齐 P0 生命周期 OpenAPI 方法，并保留 `/api/shein-lifecycle/*` 轻量兼容路由。
2. 新增主用后端模块 `/api/shein-platform-products`，支持平台商品同步、站点币种同步、SPU 详情同步、可编辑检查、常用字段编辑、拼款/追加变体、更新成本价/供货价、状态同步、失败操作重试、商品撤回。
3. 新增持久化表：`shein_platform_product`、`shein_platform_skc`、`shein_platform_sku`、`shein_platform_site`、`shein_lifecycle_operation`。
4. `SHEIN运营中心` 已拆出二级菜单：`平台商品列表`、`站点币种`、`条码尺码`、`平台标识对账`、`审核状态`、`合规证书`、`采购备货`、`库存运营`、`财务经营`。
5. `SPU 商品详情` 不作为独立菜单露出，而是从 `平台商品列表` 的详情入口进入：`/shein-platform-products/:spuName`。
6. `最近操作` 已从常驻侧栏改为 `查看最近操作` 按钮 + 弹窗，失败操作可在弹窗中重试。
7. 新增 `/api/shein-operations`，支持 P0 真实数据回归日志、`number-list` 平台标识对账、商家 SKU 查重、条码尺码查询、条码打印任务、成本价涨价原因、审核状态聚合。
8. 新增持久化表：`shein_real_data_regression_log`、`shein_platform_identity_snapshot`、`shein_supplier_sku_check`、`shein_barcode_size_snapshot`、`shein_barcode_print_task`、`shein_barcode_print_task_item`、`shein_cost_change_reason`、`shein_audit_status_snapshot`。
9. `发布任务` 已升级为 `发布与审核任务` 主操作台，支持审核状态批量同步、失败原因分组、状态筛选、重提版本、跳转平台商品详情；`审核状态` 页面改为跨发布任务/平台商品/生命周期操作的聚合看板。
10. 拼款模板提交前已接入 `check-supplierSku-repeated`，发现商家 SKU 重复时会阻断提交。

当前边界：

1. P0/P1-A/P1-B 页面和后端链路已完成，仍需要用真实 SHEIN 账号逐项回归：同步列表、同步站点、同步 SPU 详情、检查可编辑、常用字段编辑、拼款、更新供货价、状态同步、撤回、平台标识、SKU 查重、条码尺码、打印任务、涨价原因、审核聚合。
2. 常用字段编辑和拼款模板已按“先取 `spu-info` 基线，再保留平台生成标识”实现第一版，但字段级校验还需要继续根据真实失败响应补齐。
3. `query-change-price-reason` 已按“真实接口优先、文档枚举兜底”实现；需要在真实账号上确认接口是否开放，以及 `update-cost` payload 中原因字段是否被平台接受。
4. P2 页面仍以规划台账为主，尚未进入后端 adapter、库表和任务流实现。

最近验证：

- `npm test -- scripts/lib/platform_adapter.test.mjs scripts/lib/shein_platform_products_ui.test.mjs scripts/lib/shein_operations_center_ui.test.mjs scripts/lib/shein_operations_p1_persistence.test.mjs scripts/lib/shein_audit_center_ui.test.mjs`：132/132 通过。
- `npm run web:lint`：通过。
- `npm run web:build`：通过，仅有 Vite 大包体积提示。
- `DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify npm run db:migrate`：通过，当前无待执行迁移。

## P0：商品链接生命周期闭环

| 能力 | SHEIN 接口 | 当前落点 | 当前状态 |
| --- | --- | --- | --- |
| 查询店铺站点和币种 | `/open-api/goods/query-site-list` | `sheinAdapter.queryStoreSites`；`POST /api/shein-platform-products/sites/sync`；`GET /api/shein-platform-products/sites`；`shein_platform_site`；菜单 `SHEIN运营中心 > 站点币种` | 已完成页面、同步和落库；待真实数据回归 |
| 商品发布/编辑 | `/open-api/goods/product/publishOrEdit`、`/open-api/goods/product/partialEdit` | 已有上新 `publishListing`；平台商品模块新增 `fieldEditProduct`、`partialEditProduct`、`GET /:spuName/edit-template`、`POST /:spuName/field-edit`、`POST /:spuName/partial-edit` | 常用字段编辑和高级 JSON 编辑已接；待补字段校验和真实失败样本 |
| 拼款/追加变体 | 复用 `/open-api/goods/product/publishOrEdit` | `GET /:spuName/variant-template`、`POST /:spuName/add-variants`；详情页 `拼款模板` 弹窗 | 已完成模板和提交链路；待真实拼款样本回归 |
| 更新成本价/供货价 | `/open-api/goods/update-cost` | `sheinAdapter.updateCost`；`POST /api/shein-platform-products/:spuName/update-cost`；更新本地 SKU 成本价；详情页 SKU 行操作；上涨时读取 `shein_cost_change_reason` | 已完成；待真实账号确认原因字段 |
| SPU 商品详情查询 | `/open-api/goods/spu-info` | `sheinAdapter.queryProductDetail`；`POST /:spuName/sync-detail`；`GET /:spuName/detail`；`shein_platform_skc`、`shein_platform_sku`；详情页 `/shein-platform-products/:spuName` | 已完成同步、落库和详情页 |
| 商品列表/平台标识回捞 | `/open-api/openapi-business-backend/product/query` | `sheinAdapter.queryProductList`；`POST /api/shein-platform-products/sync`；`GET /api/shein-platform-products`；`shein_platform_product` | 已完成列表同步、分页、搜索和持久化 |
| 商品综合查询 | `/open-api/goods/searchProduct` | `sheinAdapter.searchProducts`；保留在 `/api/shein-lifecycle/products/search` | 已有接口能力；尚未作为平台商品主列表的数据源 |
| 确认商品是否可编辑 | `/open-api/goods/product/check-edit-permission` | `sheinAdapter.checkEditPermission`；`POST /:spuName/check-edit-permission`；写回 `editable_status` | 已完成；待把失败原因转成更友好的运营提示 |
| 商品审核/状态同步 | `/open-api/goods/query-document-state` | `sheinAdapter.queryDocumentState`；`POST /:spuName/sync-status`；`POST /status/sync`；写回 `product_status`、操作流水和 `shein_audit_status_snapshot` | 已完成单个/批量同步和审核状态聚合；待真实失败样本 |
| 异常重试 | 不对应单个 SHEIN 接口 | `shein_lifecycle_operation`；`POST /operations/:operationId/retry`；最近操作弹窗 | 已完成基础重试；待补请求/响应详情查看和重试策略 |
| 商品撤回 | `/open-api/goods/revoke-product` | `sheinAdapter.revokeProduct`；`POST /:spuName/revoke`；详情页 `撤回商品` | 已完成基础动作；下架能力另列后续扩展 |

## P0 收口事项

1. 用真实 SHEIN 数据回归 P0 全链路，沉淀每类接口的成功响应、失败响应、traceId 和运营提示。
2. 为 `field-edit`、`add-variants`、`update-cost` 增加更细的前端校验：必填字段、不可编辑字段、价格范围、币种、销售属性、图片组编码。
3. 在最近操作弹窗中补充“请求/响应详情”查看，便于运营和开发共同排查。
4. 将 `searchProduct` 是否纳入平台商品列表作为补充搜索源做一次评估；若返回字段稳定，再与本地商品表合并。
5. 下架/撤回、状态同步、异常处理继续扩展，其中“撤回”已有基础动作，“下架”需要等 SHEIN 文档中对应接口和业务口径明确。

## P1：运营必需支撑能力

P1-A/P1-B 已进入第一版可用阶段。下一步重点是用真实账号做回归，把接口响应差异、权限失败和运营提示沉淀到任务流。

| 能力 | SHEIN 接口 | 当前页面 | 当前状态 | 下一步 |
| --- | --- | --- | --- | --- |
| 条码批量获取 SKC 与尺码 | `/open-api/goods/batch-skc-size` | `条码尺码` | 已接入 adapter、路由、表和页面 | 真实条码回归，补缺失条码/异常提示 |
| 商品打印条码 | `/open-api/goods/print-barcode` | `条码尺码` | 已接入打印任务表和页面 | 真实打印 URL、错误行和重试策略回归 |
| 全量查询 SKC/SKU/设计款号关系 | `/open-api/goods/number-list` | `平台标识对账` | 已接入同步、分页、搜索和快照表 | 用真实账号确认 type/page 字段口径 |
| 查询商家 SKU 是否重复 | `/open-api/goods/product/check-supplierSku-repeated` | `平台标识对账`、平台商品拼款模板 | 已接入页面查重和拼款前置阻断 | 接入更多发布/编辑入口的前置校验 |
| 商品审核状态 | `/open-api/goods/query-document-state` | `发布与审核任务`、`审核状态`、平台商品详情 | 已接入发布任务批量同步和聚合看板 | 补负责人、备注、请求响应详情 |
| 成本价涨价原因枚举 | `/open-api/goods/query-change-price-reason` | 平台商品详情更新成本价表单 | 已接入真实接口优先、文档枚举兜底 | 真实账号确认独立接口是否开放 |

## P2：合规、采购、库存、财务扩展

P2 已进入 `SHEIN运营中心` 页面设计阶段。建议先做只读同步和台账，再做会改平台状态的动作。

| 模块 | 接口范围 | 当前页面 | 当前状态 | 建议节奏 |
| --- | --- | --- | --- | --- |
| 合规证书/标签 | 证书池、证书文件、环保标、GPSR/代理公司/警告语相关接口 | `合规证书` | 页面已规划，后端待接入 | 商品生命周期稳定后，按欧盟站点合规要求接入 |
| 采购/备货 | 采购单、发货单、收货仓、物流产品、手工备货单、商品备货信息 | `采购备货` | 页面已规划，后端待接入 | 和仓配流程一起设计，不混入上新主链路 |
| 库存 | `/open-api/goods/stock-update`、`/open-api/stock/stock-query`、销量查询 | `库存运营` | 页面已规划，后端待接入 | 先接 `stock-query` 只读同步，再开放 `stock-update` |
| 财务 | 报账单、销售款、补扣款 | `财务经营` | 页面已规划，后端待接入 | 后续作为经营分析，不阻塞商品链接管理 |
| 定制业务 | `/open-api/ccst/v1/*` | 暂无主线页面 | 暂不进入主线 | 除非定制品成为明确业务目标 |

## 下一步动作

执行方案详见：`docs/superpowers/plans/2026-05-12-shein-real-data-p1a-audit-status.md`。

2026-05-12 优先级更新：

1. 先做 P0/P1 真实 SHEIN 数据回归，不继续堆模拟闭环。目标是拿真实账号验证平台商品列表、站点币种、SPU 详情、可编辑检查、状态同步、更新成本价、编辑、拼款、撤回、平台标识、SKU 查重、条码尺码、打印任务、涨价原因和审核聚合，并沉淀成功/失败响应、traceId 和运营提示。
2. 根据真实失败样本补齐前端校验、操作流水详情和异常重试策略，尤其是 `field-edit`、`add-variants`、`update-cost` 的字段口径。
3. `query-change-price-reason` 在当前本地 SHEIN 文档导出中没有独立详情，已按真实账号可用性优先验证；若接口未开放，继续使用 `update-cost` 文档中的涨价理由枚举做缓存兜底。
4. 审核状态和发布任务列表已结合：`发布与审核任务` 是主工作台，`SHEIN运营中心 > 审核状态` 是跨生命周期聚合视图。

### Step 1：P0 真实可用性回归

目标：确认当前 `平台商品列表 + 站点币种 + SPU 商品详情` 能用真实 SHEIN 数据闭环。

动作：

1. 在 `平台商品列表` 执行同步，确认分页、搜索、列表落库、平台状态字段。
2. 在 `站点币种` 执行同步，确认币种、站点启用状态、符号字段。
3. 从列表进入 3-5 个 SPU 详情，确认 `spu-info` 能稳定落库 SKC/SKU、图片、供货价、售价、状态。
4. 对 1 个测试商品执行 `检查可编辑`、`同步状态`、`更新成本价`，记录成功/失败响应。
5. 对 1 个允许编辑的测试商品执行常用字段编辑；对 1 个允许拼款的测试商品执行拼款模板提交。
6. 将失败响应补入前端校验、toast 文案和最近操作详情展示。

验收：

- 平台商品、站点、SPU 详情均可持久化并刷新后仍可查看。
- 任一失败操作可在 `最近操作` 弹窗中看到失败原因并可重试。
- 成本价、编辑、拼款不会绕过 `spu-info` 基线。

### Step 2：P1-A 平台标识与条码

目标：先打通不改变商品状态的运营支撑能力。

优先接口：

1. `/open-api/goods/number-list`
2. `/open-api/goods/product/check-supplierSku-repeated`
3. `/open-api/goods/batch-skc-size`
4. `/open-api/goods/print-barcode`

建议新增：

- 后端 adapter 方法和 `/api/shein-operations/*` 路由。
- `shein_platform_identity_snapshot`：保存 `number-list` 回捞的 SKC/SKU/设计款号关系。
- `shein_supplier_sku_check`：保存商家 SKU 重复校验结果和来源动作。
- `shein_barcode_size_snapshot`：保存 SKC/SKU 尺码关系。
- `shein_barcode_print_task`：保存条码打印请求、响应、文件或下载信息。

### Step 3：P1-B 审核状态中心与调价原因

目标：把平台商品页的状态同步能力升级为运营可批量处理的状态中心。

动作：

1. 接入 `/open-api/goods/query-change-price-reason`，新增 `shein_cost_change_reason` 缓存。
2. 更新 `更新成本价/供货价` 表单，涨价时必须选择平台原因枚举。
3. 在 `审核状态` 页面展示批量同步结果、失败原因分组、处理状态、最近重试。
4. 将审核失败商品跳转到 `SPU 商品详情`，直接进入常用字段编辑或拼款处理。

### Step 4：P2 只读台账优先

目标：先沉淀可查询数据，避免过早开放会改变平台状态的动作。

建议顺序：

1. `库存运营`：先接 `/open-api/stock/stock-query`，形成 SKU/仓库/站点库存台账；再评估 `/open-api/goods/stock-update`。
2. `合规证书`：先做证书池、证书文件、GPSR、环保标台账和缺失提示。
3. `采购备货`：接采购单、发货单、收货仓、物流产品，只做状态追踪。
4. `财务经营`：接报账单、销售款、补扣款，用于经营分析和异常对账。

## 关键规则

1. “拼款”没有独立 OpenAPI；按 SHEIN 文档，它是使用 `publishOrEdit` 在已发布 `spu_name` 下新增 SKC/SKU。
2. 已发布商品编辑必须先用 `spu-info` 取平台生成标识和图片组编码；编辑接口是覆盖语义，漏传部分字段可能被清空。
3. 成本价不能放进编辑 payload，必须走 `/open-api/goods/update-cost`。
4. 商品主销售属性、次销售属性、库存、供货价等在编辑接口里不可编辑，分别走专门接口。
5. 商品列表接口只稳定返回审核通过商品；审核中/审核失败状态仍以发布响应和审核状态接口为准。
6. 新接接口默认先做持久化和操作流水，再开放批量动作；没有本地流水的 SHEIN 写操作不进入生产可用状态。
