# Listingify SHEIN MVP 与平台化方向技术规格

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v1.0 |
| 文档日期 | 2026-05-01 |
| 对应 PRD | `docs/prd-listingify-shein-mvp-and-platform-direction-2026-05-01.md` |
| 当前技术栈 | React、Vite、Hono、better-sqlite3、TypeScript、Node.js |
| 当前数据库 | SQLite，表结构按后续 PostgreSQL 迁移保留清晰边界 |
| 当前第一平台 | SHEIN 全托管 |

## 2. 技术目标

当前技术目标不是重写系统，而是在已跑通的 SHEIN 单款发布链路上规范后续开发方向。

本规格定义：

1. 当前系统的分层边界。
2. 后续新增能力应该落在哪些模块。
3. 批量发布、任务、异常和状态同步如何收敛。
4. 哪些模型必须保持平台无关，哪些模型允许 SHEIN 特化。
5. TEMU 等未来平台如何预留，但不提前实现。

## 3. 总体架构原则

### 3.1 核心原则

1. 商品事实层不绑定 SHEIN 字段。
2. SHEIN 特有字段进入 `shein_*`、`channel_*` 或 `listing_*` 表。
3. 每次发布都必须生成版本化快照。
4. 发布、重试、状态同步都必须任务化。
5. 批量任务必须支持部分成功。
6. 失败和阻断必须可归因、可跳转修复、可重试或关闭。
7. 平台身份统一保存，不散落在草稿业务字段中。
8. 密钥、发布动作、人工覆盖和配置修改必须审计。
9. 平台适配器负责协议差异，不反向污染商品模型。

### 3.2 分层结构

```text
Source Layer
  MDM SPU/SKU API
  DeepDraw API
  SHEIN OpenAPI
  Excel / Manual Rules
  Local Image Upload

Fact Layer
  Product Master
  Content Package
  Asset Library
  Source Snapshot

Rule Layer
  SHEIN Metadata
  Category Mapping
  Attribute Mapping
  Size Conversion
  Package Rule
  Price Rule
  Weight Rule

Listing Layer
  SHEIN Product Bucket
  Listing Draft
  Listing SKC/SKU
  Listing Asset
  Field Fill
  Validation Result

Execution Layer
  Publish Version
  Publish Package Snapshot
  Publish Task
  Publish Task Item
  Status Sync
  Exception Workbench

Adapter Layer
  PlatformAdapter Contract
  SheinAdapter
  TemuAdapter Reserved

Governance Layer
  Auth / RBAC
  Platform Integration
  Operation Log
  Sync Task
```

## 4. 当前代码模块基线

### 4.1 前端页面

| 模块 | 当前路径 | 责任 |
| --- | --- | --- |
| SHEIN 商品分桶 | `web/src/pages/shein-products/page.tsx` | 平台字段清洗、AI 推荐、创建发布草稿 |
| SHEIN 发布草稿箱 | `web/src/pages/pre-publish-validation/page.tsx` | 草稿列表、批量校验、批量发布入口 |
| 单款草稿详情 | `web/src/pages/pre-publish-validation/[listingId]/page.tsx` | SPU/SKC/SKU 字段、图片、尺码、价格包装维护 |
| 上新批次 | `web/src/pages/listing-batches/page.tsx`、`web/src/pages/listing-batches/[id]/page.tsx` | 批次组织、批次详情、批次级操作 |
| 发布任务 | `web/src/pages/publish-tasks/page.tsx`、`web/src/pages/publish-tasks/[id]/page.tsx` | 任务追踪、请求响应、重试、状态同步 |
| 图片素材库 | `web/src/pages/image-library/page.tsx` | 图片检索和素材详情 |
| 规则中心 | `web/src/pages/category-mapping/page.tsx` 等 | 类目、尺码、包装、价格规则 |
| 系统管理 | `web/src/pages/users/page.tsx`、`web/src/pages/platform-integrations/page.tsx` | 用户、RBAC、平台配置 |

### 4.2 后端模块

| 模块 | 当前路径 | 责任 |
| --- | --- | --- |
| 草稿与发布前能力 | `web/server/routes/pre-publish.ts` | 草稿、校验、图片、发布入口 |
| 发布服务 | `web/server/services/publish/publish-job-service.ts` | 批量发布任务、失败分类、重试 |
| 审核状态同步 | `web/server/services/publish/shein-status-sync.ts` | SHEIN 审核状态查询和回写 |
| 预发布服务 | `web/server/services/pre-publish/*` | 图片、payload、版本、字段填充 helper |
| 批次路由 | `web/server/routes/listing-batches.ts` | 批次列表、详情、任务聚合 |
| 任务路由 | `web/server/routes/publish-tasks.ts` | 发布任务查询、重试、同步 |
| 规则路由 | `web/server/routes/business-rules.ts` | 尺码、包装、价格、毛重等规则 |
| 平台配置 | `web/server/routes/platform-integrations.ts` | SHEIN 对接配置 |
| 审计 | `web/server/lib/audit.ts` | 操作日志 |

### 4.3 开发约束

1. `web/server/routes/pre-publish.ts` 已经很大，后续新增纯逻辑必须优先抽到 `web/server/services/pre-publish/`。
2. 发布执行逻辑优先进入 `web/server/services/publish/`，路由只做参数校验和响应封装。
3. 前端页面继续保持生产工具风格，高密度表格、分栏、抽屉和弹窗，避免营销式页面。
4. 新增能力必须有对应脚本测试或静态 UI 测试。

## 5. 数据模型方向

本节不要求一次性重建数据库，而是定义后续迁移和新增表的方向。

### 5.1 商品事实层

当前已存在：

1. `product_spu`
2. `product_skc`
3. `product_sku`
4. `product_content_package`
5. `product_content_skc`
6. `product_content_sku`
7. `product_content_size_table`
8. `product_content_field`
9. `product_asset`

要求：

1. 事实层只保存 MDM、深绘和通用资产字段。
2. 不新增 `shein_*` 字段到事实层。
3. 需要补充字段血缘时，优先新增独立字段填充/血缘表，而不是把来源列散落到每张事实表。

建议新增或增强：

```sql
create table if not exists field_lineage_event (
  id integer primary key autoincrement,
  object_type text not null,
  object_id integer not null,
  field_key text not null,
  old_value_json text,
  new_value_json text,
  source_type text not null,
  source_system text,
  source_object text,
  source_field text,
  source_snapshot text,
  priority_rule text,
  manual_override integer not null default 0,
  actor_user_id integer,
  reason text,
  created_at text not null default current_timestamp
);
```

使用范围：

1. AI 写入字段。
2. 规则自动补齐字段。
3. 人工覆盖字段。
4. MDM/深绘同步导致候选字段变化。

### 5.2 SHEIN 分桶层

当前已存在：

1. `shein_product_bucket`
2. 类目映射和 AI 推荐相关表

要求：

1. SHEIN 分桶是平台字段清洗池，不是商品事实层。
2. 分桶可以缓存 SHEIN 类目、字段完整度、图片状态、最新草稿状态。
3. 分桶不直接代表一次发布，发布必须进入 listing 草稿。

后续增强：

1. 增加分桶字段变更历史。
2. 增加 AI 推荐采纳率统计。
3. 增加最近阻断原因和最近成功发布版本引用。

### 5.3 刊登草稿层

当前已存在或已接近：

1. `listing`
2. `listing_skc`
3. `listing_sku`
4. `listing_asset`
5. `listing_field_fill`
6. `listing_validation_result`
7. `listing_publish_version`
8. `platform_identity`

要求：

1. `listing` 是发布单元，一个 SPU 可以有多个 listing。
2. `listing_skc` 表示草稿内发布款色，可独立选择是否发布。
3. `listing_sku` 表示草稿内发布尺码、价格、包装、毛重。
4. `listing_asset` 表示草稿使用的图片及其 SHEIN 转换状态。
5. `listing_publish_version` 是不可覆盖的版本快照。
6. `platform_identity` 保存平台 ID 映射。

建议增强 `listing_publish_version` 的逻辑字段：

```text
source_snapshot      商品事实和草稿字段快照
field_snapshot       字段填充和人工覆盖快照
price_snapshot       价格、币种、折扣、确认人、确认时间
asset_snapshot       图片、平台 URL、转换状态、图片规则
size_snapshot        尺码表和 SHEIN 发布尺码
request_payload      实际提交 payload
response_payload     SHEIN 响应
diff_summary_json    相比上一版本的字段差异摘要
package_summary_json 运营发布前确认摘要
```

### 5.4 批次与任务层

当前已存在：

1. `listing_batch`
2. `listing_publish_task`
3. 任务可靠性字段：`idempotency_key`、`failure_category`、`failure_fingerprint`、`retryable` 等

建议新增任务分项表：

```sql
create table if not exists listing_publish_task_item (
  id integer primary key autoincrement,
  task_id integer not null references listing_publish_task(id) on delete cascade,
  listing_id integer not null,
  listing_skc_id integer,
  listing_sku_id integer,
  item_type text not null,
  status text not null,
  platform_object_type text,
  platform_object_id text,
  request_payload text,
  response_payload text,
  error_code text,
  error_message text,
  failure_category text,
  failure_fingerprint text,
  retryable integer not null default 0,
  started_at text,
  finished_at text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);
```

用途：

1. 支持批量任务部分成功。
2. 支持定位某个 listing、SKC、SKU 的失败。
3. 支持批次详情聚合失败原因。
4. 支持后续平台差异更大的任务执行模型。

### 5.5 异常层

建议新增异常表：

```sql
create table if not exists exception_record (
  id integer primary key autoincrement,
  platform text not null,
  exception_type text not null,
  status text not null default 'OPEN',
  severity text not null default 'ERROR',
  owner_role text,
  batch_no text,
  listing_id integer,
  listing_skc_id integer,
  listing_sku_id integer,
  task_id integer,
  task_item_id integer,
  field_key text,
  failure_category text,
  failure_fingerprint text,
  raw_error text,
  normalized_message text not null,
  suggestion text,
  source_module text not null,
  first_seen_at text not null default current_timestamp,
  last_seen_at text not null default current_timestamp,
  resolved_at text,
  resolved_by integer,
  resolution_note text
);
```

建议新增异常事件表：

```sql
create table if not exists exception_event (
  id integer primary key autoincrement,
  exception_id integer not null references exception_record(id) on delete cascade,
  event_type text not null,
  message text,
  actor_user_id integer,
  payload_json text,
  created_at text not null default current_timestamp
);
```

异常来源：

1. `listing_validation_result`
2. `listing_asset.transform_status = FAILED`
3. `listing_publish_task.status = FAILED`
4. `listing_publish_task.failure_category`
5. SHEIN 审核驳回
6. 状态同步失败
7. 平台配置不可用

异常去重：

```text
platform + source_module + failure_fingerprint + listing_id + field_key
```

## 6. 状态模型

### 6.1 Listing 状态

建议统一状态：

| 状态 | 含义 |
| --- | --- |
| `DRAFT` | 草稿已创建 |
| `NEEDS_ENRICHMENT` | 需要补齐字段、图片、价格或包装 |
| `READY_TO_VALIDATE` | 信息基本齐全，等待校验 |
| `VALIDATING` | 校验中 |
| `VALIDATION_FAILED` | 校验失败 |
| `READY_TO_PUBLISH` | 校验通过 |
| `ASSET_TRANSFORMING` | 图片转换中 |
| `ASSET_FAILED` | 图片转换失败 |
| `PUBLISHING` | 发布中 |
| `PUBLISH_SUBMITTED` | 已提交 SHEIN |
| `UNDER_REVIEW` | 审核中 |
| `APPROVED` | 审核通过 |
| `REJECTED` | 审核驳回 |
| `PARTIALLY_APPROVED` | 部分通过 |
| `PUBLISH_FAILED` | 发布失败 |
| `PAUSED` | 暂停 |
| `ARCHIVED` | 归档 |

### 6.2 Task 状态

任务主状态：

| 状态 | 含义 |
| --- | --- |
| `PENDING` | 待执行 |
| `RUNNING` | 执行中 |
| `SUCCESS` | 成功 |
| `PARTIAL_SUCCESS` | 部分成功 |
| `FAILED` | 失败 |
| `RETRY_WAITING` | 等待重试 |
| `CANCELLED` | 取消 |

任务分项状态：

| 状态 | 含义 |
| --- | --- |
| `PENDING` | 待处理 |
| `BLOCKED` | 发布前阻断 |
| `SUBMITTED` | 已提交平台 |
| `PROCESSING` | 平台处理中 |
| `SUCCESS` | 成功 |
| `FAILED` | 失败 |
| `IGNORED` | 跳过 |

### 6.3 Batch 状态

批次状态：

| 状态 | 含义 |
| --- | --- |
| `DRAFT` | 批次已创建 |
| `VALIDATING` | 批量校验中 |
| `READY` | 可发布 |
| `PUBLISHING` | 批量发布中 |
| `PARTIAL_SUCCESS` | 部分成功 |
| `SUCCESS` | 全部成功 |
| `FAILED` | 全部失败或关键失败 |
| `UNDER_REVIEW` | 有任务审核中 |
| `COMPLETED` | 批次处理完成 |
| `ARCHIVED` | 归档 |

批次状态由草稿和任务汇总计算，不应只靠人工设置。

## 7. 发布包与版本设计

### 7.1 发布包生成时机

以下动作必须生成或更新发布版本：

1. 创建草稿。
2. 保存草稿字段。
3. AI 补齐字段。
4. 图片导入或转换。
5. 发布前校验通过后准备发布。
6. 提交 SHEIN 发布。
7. 审核驳回后修复重提。

### 7.2 发布包内容

发布包至少包含：

1. 平台和账号。
2. SPU/SKC/SKU 对象集合。
3. SHEIN 类目和 `product_type_id`。
4. 商品属性、销售属性、尺寸属性。
5. 标题、描述、语种。
6. 图片清单、图片类型、平台 URL。
7. 尺码表和发布尺码。
8. 供货价、币种、毛重、包装长宽高。
9. 平台规则版本或同步时间。
10. 校验结果摘要。
11. request payload。
12. 操作人和生成时间。

### 7.3 版本差异

版本差异应按以下维度生成：

1. 类目变化。
2. 标题/描述变化。
3. 商品属性变化。
4. SKC 是否发布变化。
5. SKU 是否发布变化。
6. SHEIN 尺码变化。
7. 价格包装变化。
8. 图片变化。
9. payload 关键字段变化。

前端展示先做摘要，不要求完整 JSON diff 可视化。

## 8. PlatformAdapter 设计

### 8.1 接口契约

后续沉淀统一 adapter 接口：

```ts
export interface PlatformAdapter {
  platform: string
  fetchCategoryTree(accountId: number): Promise<PlatformCategoryTree>
  fetchPublishRules(accountId: number, categoryId: string, productTypeId?: string): Promise<PlatformPublishRules>
  fetchAttributeTemplate(accountId: number, productTypeId: string): Promise<PlatformAttributeTemplate>
  validateListing(input: PlatformListingValidationInput): Promise<PlatformValidationResult>
  prepareAssets(input: PlatformAssetPrepareInput): Promise<PlatformAssetPrepareResult>
  buildPublishPayload(input: PlatformPublishBuildInput): Promise<PlatformPublishPayload>
  publishListing(input: PlatformPublishInput): Promise<PlatformPublishResult>
  syncPublishStatus(input: PlatformStatusSyncInput): Promise<PlatformStatusSyncResult>
  normalizeError(error: unknown): PlatformNormalizedError
}
```

### 8.2 SHEIN Adapter 当前职责

SHEIN adapter 需要覆盖：

1. 签名和请求。
2. 类目树。
3. 发布字段规范。
4. 属性模板。
5. SKU 重复检查。
6. 图片上传/转换。
7. `publishOrEdit` payload 构建。
8. 发布响应解析。
9. `spu_name/skc_name/sku_code` 平台身份提取。
10. 审核状态查询。
11. 错误归一化。

### 8.3 TEMU Adapter 预留

当前不实现 TEMU 真实发布。允许做：

1. 字段映射研究。
2. 元数据结构验证。
3. adapter contract 是否足够的静态设计。
4. 不调用 TEMU 发布接口。
5. 不新增 TEMU 页面主流程。

## 9. API 方向

### 9.1 批次 API

建议稳定以下接口：

```text
GET  /api/listing-batches
POST /api/listing-batches
GET  /api/listing-batches/:id
POST /api/listing-batches/:id/validate
POST /api/listing-batches/:id/publish-tasks
GET  /api/listing-batches/:id/publish-summary
POST /api/listing-batches/:id/sync-status
POST /api/listing-batches/:id/retry-failed
```

返回要求：

1. 批次基本信息。
2. 草稿数量、SKC 数、SKU 数。
3. 状态汇总。
4. 失败原因分组。
5. 最近同步时间。
6. 可操作动作列表。

### 9.2 任务 API

```text
GET  /api/publish-tasks
GET  /api/publish-tasks/:id
POST /api/publish-tasks/:id/retry
POST /api/publish-tasks/:id/sync-status
```

任务详情返回：

1. 任务主记录。
2. 任务分项。
3. 关联 listing。
4. 关联版本。
5. 请求响应。
6. 平台身份。
7. 异常记录。

### 9.3 异常 API

```text
GET  /api/exceptions
GET  /api/exceptions/:id
POST /api/exceptions/:id/resolve
POST /api/exceptions/:id/reopen
POST /api/exceptions/:id/retry
```

异常列表支持筛选：

1. 平台。
2. 批次。
3. 款号。
4. 状态。
5. 错误类型。
6. 责任角色。
7. 严重级别。

### 9.4 草稿 API

现有草稿 API 继续演进，新增能力优先保持兼容：

1. 保存草稿后返回新版本号和 diff 摘要。
2. 发布前返回发布包摘要。
3. 批量校验返回对象层级问题列表。
4. 图片转换失败返回可用于异常归因的错误分类。

## 10. 错误归因分类

建议统一 `failure_category`：

| 分类 | 场景 | 是否可自动重试 |
| --- | --- | --- |
| `VALIDATION` | 字段缺失、必填属性、枚举不匹配 | 否 |
| `IMAGE` | 图片缺失、尺寸不符、转换失败 | 部分可 |
| `PRICE` | 价格未确认、币种缺失、供货价非法 | 否 |
| `PACKAGE` | 毛重、包装长宽高缺失 | 否 |
| `DUPLICATE_SKU` | 供应商 SKU 重复 | 否 |
| `AUTH` | 平台密钥、权限、白名单问题 | 否 |
| `RATE_LIMIT` | SHEIN 限流 | 是 |
| `NETWORK` | 网络超时、连接失败 | 是 |
| `SHEIN_PRE_VALIDATION` | SHEIN 返回平台预校验失败 | 否 |
| `SHEIN_AUDIT` | 审核驳回 | 否 |
| `SHEIN_SERVER` | SHEIN 5xx 或临时错误 | 是 |
| `UNKNOWN` | 未识别错误 | 否，需人工判断 |

错误归因函数必须输出：

```ts
type NormalizedFailure = {
  category: string
  fingerprint: string
  retryable: boolean
  displayMessage: string
  suggestion: string
}
```

## 11. 审核状态同步

### 11.1 同步方式

当前以 `/open-api/goods/query-document-state` 查询为主，Webhook 不作为当前阶段必配项。

同步入口：

1. 发布任务详情手动同步。
2. 批次详情批量同步。
3. 后端定时任务同步处于 `PUBLISH_SUBMITTED`、`UNDER_REVIEW` 的任务。

### 11.2 同步结果

同步后必须更新：

1. `listing.status`
2. `listing.validation_status`
3. `listing_publish_task.status`
4. `listing_publish_task.last_status_synced_at`
5. `listing_batch.publish_status_summary_json`
6. `listing_validation_result` 中的审核驳回项
7. `exception_record` 中的审核异常

### 11.3 定时策略

建议：

1. 发布后 24 小时内，每 15 分钟同步一次。
2. 发布后 24 到 72 小时，每 1 小时同步一次。
3. 超过 72 小时仍未终态，标记为长期待审核并进入异常提醒。

## 12. 前端交互规范

### 12.1 批次详情

必须展示：

1. 批次基础信息。
2. 草稿状态分布。
3. 任务状态分布。
4. 失败原因分组。
5. 最近审核状态同步时间。
6. 操作按钮：批量校验、生成发布任务、同步审核状态、重试失败项。

### 12.2 草稿详情

必须保持：

1. SPU、SKC、SKU 清晰分区。
2. SKU 级价格、毛重、包装在同一表格维护。
3. 图片规则贴近每个 SKC 展示。
4. 阻断项可跳转到对应字段或模块。
5. 发布按钮必须二次确认。
6. 发布前能查看发布包摘要。

### 12.3 异常工作台

第一版 UI：

1. 左侧筛选区。
2. 中间异常表格。
3. 右侧详情抽屉。
4. 详情内展示原始错误、归因、建议动作、关联对象、事件历史。
5. 支持跳转到草稿详情、任务详情、批次详情。

## 13. 测试策略

### 13.1 必跑命令

```bash
npm test
npm run web:build
npm run web:lint
```

### 13.2 后端测试重点

1. 发布前校验。
2. payload 构建。
3. 图片规则判断。
4. 价格和包装规则解析。
5. 发布任务失败归因。
6. 批量发布部分成功。
7. 状态同步回写。
8. 异常去重和关闭。
9. RBAC 权限。

### 13.3 前端静态测试重点

1. 批次详情是否调用批量发布相关 API。
2. 草稿详情是否展示发布包摘要入口。
3. 异常工作台是否提供跳转入口。
4. 发布和重试是否有二次确认。
5. 关键筛选项是否保留。

### 13.4 联调测试脚本

每次发布链路改动后，至少验证：

1. 可从商品档案进入 SHEIN 分桶。
2. 可创建草稿。
3. 可补齐类目、图片、尺码、价格和包装。
4. 可通过发布前校验。
5. 可生成发布版本。
6. 可提交 SHEIN。
7. 可看到平台身份。
8. 可同步审核状态。
9. 可在失败时看到归因和重试入口。

## 14. 实施分期

### 14.1 Phase B1：批量发布操作闭环

目标：把批次详情变成批量发布操作中心。

范围：

1. 批次详情接入发布任务生成。
2. 批次详情接入状态同步。
3. 批次详情接入失败聚合。
4. 批次详情接入批量重试。
5. 发布任务列表支持按批次筛选。

退出标准：

1. 同一批次多个草稿可批量提交。
2. 部分失败不影响其他草稿。
3. 批次页可看到失败原因和重试入口。

### 14.2 Phase B2：发布包摘要和版本差异

目标：让发布前确认和发布后追溯更清晰。

范围：

1. 生成发布包摘要。
2. 生成版本差异摘要。
3. 前端展示发布包摘要确认弹窗。
4. 任务详情展示版本快照摘要。

退出标准：

1. 运营发布前能确认关键字段。
2. 发布后可回查当时提交的数据。

### 14.3 Phase C1：异常工作台

目标：把阻断、失败、审核驳回统一收敛。

范围：

1. 新增异常表。
2. 从校验、任务、审核同步生成异常。
3. 新增异常列表和详情。
4. 支持关闭、重开和跳转修复。

退出标准：

1. 发布失败和审核驳回都能进入异常工作台。
2. 异常可按类型、批次、状态筛选。

### 14.4 Phase C2：字段血缘和规则治理

目标：强化数据可信度。

范围：

1. 记录人工覆盖字段。
2. 记录 AI 和规则自动补齐来源。
3. 规则导入批次审计。
4. 规则冲突检测。
5. 规则回滚。

退出标准：

1. 关键发布字段能追到来源。
2. 规则误导入可定位和回滚。

### 14.5 Phase D：平台化边界固化

目标：为 TEMU 做技术准备，但不真实发布。

范围：

1. 抽象 `PlatformAdapter`。
2. 拆出 `SheinAdapter`。
3. 梳理 TEMU 字段映射差异。
4. 写 adapter contract 测试。

退出标准：

1. SHEIN 发布链路不因抽象而回归。
2. TEMU 接入点明确，但无真实发布入口。

## 15. 迁移注意事项

1. SQLite `alter table` 对复杂迁移有限制，新增表优先，重构旧表需谨慎。
2. 生产前如迁移 PostgreSQL，需要把 JSON 文本列整理为 `jsonb`。
3. 新增表必须有索引：
   - 批次号
   - listing id
   - task id
   - failure fingerprint
   - status
   - updated_at
4. 所有迁移脚本必须可重复执行或通过 `schema_migration` 保护。

## 16. 安全要求

1. 平台密钥只允许脱敏返回前端。
2. 发布接口必须检查用户登录态和发布权限。
3. 平台配置修改必须记录审计。
4. 用户管理必须记录审计。
5. 批量发布和批量重试必须记录操作人。
6. 发布 payload 可能包含敏感业务数据，默认只给有权限用户查看。

## 17. 开放问题

1. 批量发布并发数默认值。
2. SHEIN 审核状态定时同步是否由 Web server 内部定时器承担，还是独立 worker。
3. 异常责任角色首版是否手动选择，还是由错误分类自动派生。
4. 字段血缘是否需要做完整 UI，还是先在版本详情和操作日志中展示。
5. 发布包摘要是否需要导出为 Excel 或 JSON。
6. TEMU adapter 研究何时进入实际计划。
