# Listingfy

Listingfy 是面向跨境电商的多平台刊登中台。产品方向是商品中台 + 平台刊登中台 + ERP 能力演进：把 MDM、深绘内容包、Excel 人工规则、图片素材、价格确认、平台发布规范校验和发布追踪串成一个可审计、可批量操作的工作台。

当前 MVP 以 SHEIN 全托管作为第一个落地平台，但核心商品模型、刊登草稿、平台账号、平台元数据、发布任务、平台身份映射和后续适配器设计都按多平台方向预留。TEMU 是下一阶段明确预留的平台适配目标。

## 产品定位

- 核心商品模型不绑定单一平台，内部按 `SPU -> SKC -> SKU` 聚合商品主数据和内容资产。
- 平台特有字段进入 `channel_*`、`listing_*`、`platform_identity` 等平台层模型。
- 每个平台通过独立适配器处理类目、属性模板、图片上传/转换、payload 构造、发布、价格流程和状态同步。
- 第一阶段先用 SHEIN 跑通元数据、草稿、校验、发布版本和状态追踪闭环；后续通过 `PlatformAdapter` 扩展 TEMU 等平台。

## 项目架构

```text
                                   +-------------------------------+
                                   | Listingfy Web 工作台          |
                                   | 上新 / 规则 / 数据 / 系统管理 |
                                   +---------------+---------------+
                                                   |
                                                   v
                                   +-------------------------------+
                                   | Hono API 服务                 |
                                   | metadata / category-mapping   |
                                   +---------------+---------------+
                                                   |
                                                   v
+----------------------+     +---------------------+---------------------+
| 外部数据来源         |     | 本地数据底座                              |
|----------------------|     |-------------------------------------------|
| MDM SPU/SKU          | --> | product_spu / product_skc / product_sku   |
| 深绘内容包           | --> | product_content_package / product_asset   |
| 观远 BI Excel        | --> | weight / size / package / price rules     |
| 规则 Excel           | --> | category / attribute / mapping rules      |
| 人工图片包           | --> | asset library / listing_asset             |
+----------+-----------+     +---------------------+---------------------+
           |                                       |
           |                                       v
           |                       +---------------+---------------+
           |                       | 平台元数据层                  |
           |                       |-------------------------------|
           |                       | channel_account               |
           |                       | channel_category              |
           |                       | channel_attribute_template    |
           |                       | channel_attribute_mapping     |
           |                       +---------------+---------------+
           |                                       |
           v                                       v
+----------+-----------+     +---------------------+---------------------+
| 同步/导入任务        |     | 刊登业务层                                |
|----------------------|     |-------------------------------------------|
| MDM sync             | --> | listing / listing_skc / listing_sku       |
| DeepDraw sync        | --> | listing_validation_result                 |
| metadata sync        | --> | listing_publish_version                   |
| Excel import         | --> | listing_publish_task                      |
| asset transform      | --> | platform_identity                         |
+----------------------+     +---------------------+---------------------+
                                                   |
                                                   v
                                   +---------------+---------------+
                                   | PlatformAdapter               |
                                   |-------------------------------|
                                   | fetchCategoryTree             |
                                   | fetchAttributeTemplate        |
                                   | uploadAsset / prepareSizeChart|
                                   | buildPublishPayload           |
                                   | publishListing / syncStatus   |
                                   +-------+---------------+-------+
                                           |               |
                                           v               v
                                  +--------+------+   +----+---------+
                                  | SHEIN Adapter |   | TEMU Adapter |
                                  | 当前 MVP      |   | 后续预留     |
                                  +---------------+   +--------------+
```

## 当前进度

更新日期：2026-04-29

项目处于 Phase 1 数据底座和 Web 原型联通阶段。多平台底层方向已在 PRD/spec 中确定，当前实现重心是把第一个 SHEIN 适配器跑通：

- 已完成 SHEIN OpenAPI 基础联调，包括店铺信息、站点币种、店铺发布规范、可发布类目树、叶子类目发布规范和属性模板。
- 已完成 SHEIN 元数据同步、导入和查询链路，支持查询类目、发布字段、图片规则、必填属性、销售属性、尺寸属性和枚举值。
- 已建立本地 SQLite 数据库迁移，覆盖平台元数据表、SHEIN 元数据落地表、MDM 到平台类目的组合映射规则，以及深绘内容包结构化表。
- 已确认类目映射规则按 `MDM 中类 + 小类 + 性别 + 年龄段` 组合匹配 SHEIN 末级类目，而不是简单小类一对一。
- 已完成深绘内容包同步和导入链路，支持将 `body` 原样保存为 raw payload，并拆出 SPU-SKC-SKU、颜色、尺码、尺码表、图片、详情页和字段池。
- 已新增 Listingfy Web 原型，包含 React + TypeScript + Vite 前端、Hono API 服务、首个平台元数据浏览和类目映射规则维护接口。
- 已规划上新工作、规则中心、数据中心和系统管理的主要页面骨架。

## 已实现能力

### 首个平台适配：SHEIN

- `scripts/lib/shein_client.mjs`：SHEIN 签名、请求头、AES 解密、请求重试和结果断言。
- `scripts/shein_probe.mjs`：单接口探查工具。
- `scripts/shein_metadata_sync.mjs`：同步 SHEIN 类目树、发布字段规范、图片规则、属性模板和枚举。
- `scripts/shein_metadata_import.mjs`：将同步产物导入本地 SQLite。
- `scripts/shein_metadata_query.mjs`：查询类目、发布要求、图片规则、属性模板和枚举。

### 数据库

- `db/migrations/001_shein_metadata.sql`：首个平台元数据落地表，当前数据源为 SHEIN。
- `db/migrations/002_mdm_shein_mapping_dimensions.sql`：MDM 到 SHEIN 组合类目映射规则。
- `db/migrations/003_mdm_product_master.sql`：MDM SPU/SKC/SKU 商品主数据表。
- `db/migrations/004_deepdraw_content_model.sql`：深绘内容包、内容 SKC/SKU、图片、详情页、尺码表和字段池表。
- 默认数据库文件为 `data/app.sqlite`，该文件不提交 Git。

当前本地已导入过的 SHEIN 元数据规模：

```text
channel_category: 2540
channel_publish_standard: 774
channel_publish_field: 13928
channel_picture_config: 8503
channel_attribute_template: 773
channel_attribute: 33568
channel_attribute_value: 642769
channel_required_attribute: 8733
```

### 多平台预留

- PRD 将 Listingfy 定义为商品中台 + 平台刊登中台 + ERP 能力演进，MVP 范围是 SHEIN，全局方向预留 TEMU 等多平台适配。
- spec 中的平台账号、平台类目、属性模板、刊登草稿、校验结果、发布版本、发布任务和平台身份映射均包含 `platform` 或平台账号维度。
- 后续 TEMU 接入时不修改核心商品表，新增 `TemuAdapter` 和平台字段映射。
- 预留的 `PlatformAdapter` 能力包括类目树同步、属性模板同步、图片上传、尺码表准备、payload 构造、发布、状态同步和价格流程同步。

### Web 工作台原型

`web/` 目录包含一个前后端原型：

- 前端：React 19、TypeScript、Vite、React Router、TanStack Query、TanStack Table、shadcn/radix 风格组件。
- 后端：Hono + better-sqlite3，本地读取 `data/app.sqlite`。
- 已配置页面路由：工作台、上新批次、草稿工作台、图片管理、发布校验、发布任务、类目映射、属性映射、尺码转换、包装规则、价格规则、低倍率清单、平台元数据、MDM 商品、深绘内容包、图片素材库、平台账号、同步任务、操作日志。
- 已实现接口：`/api/metadata/*` 和 `/api/category-mapping/*`。
- 当前页面命名仍以 SHEIN 为首个适配平台，后续会泛化为平台元数据和平台账号管理。

## 运行方式

根目录命令：

```bash
npm run db:migrate
npm run shein:metadata:import
npm run shein:metadata:query
npm run deepdraw:sync -- --tenant 电商巴拉巴拉 208226102001 208226103201
npm run deepdraw:import
npm run web:server
npm run web:dev
```

Web 子项目命令：

```bash
cd web
npm install
npm run build
npm run lint
```

默认 API 服务端口为 `3001`，Vite 开发服务端口按本地可用端口分配。

## 关键文档

- `docs/project-progress-2026-04-27.md`：项目阶段、联调结果和下一步计划。
- `docs/project-architecture-capability-ui-2026-04-27.md`：架构、能力范围和界面建议。
- `docs/prd-shein-fullmanaged-listing-mvp.md`：产品需求。虽然文件名以 SHEIN MVP 命名，但文档中明确产品方向为商品中台 + 平台刊登中台 + ERP 能力演进，并预留 TEMU 等多平台适配。
- `docs/spec-shein-fullmanaged-listing-mvp.md`：技术规格。核心原则是不让商品模型绑定 SHEIN，平台差异通过 `channel_*`、`listing_*`、`platform_identity` 和适配器隔离。
- `docs/phase1-shein-metadata-database.md`：Phase 1 数据库说明。
- `docs/mdm-product-master-data-model.md`：基于 MDM SPU/SKU 接口的 `SPU -> SKC -> SKU` 商品主数据建模。
- `docs/deepdraw-content-image-sync.md`：深绘内容包和图片同步方式、返回结构、图片入库建议。
- `docs/deepdraw-content-data-model.md`：深绘内容包结构化落库模型，覆盖 raw payload、SPU-SKC-SKU、图片、详情页、尺码表和关键 fields。
- `docs/reference/integration-handoffs/`：MDM、深绘等外部系统对接交接资料的脱敏版本；原始交接文件只保存在本地忽略目录。
- `docs/shein-openapi-live-probe-2026-04-24.md`：SHEIN OpenAPI 联调记录。
- `docs/shein-metadata-sync-task.md`：元数据同步任务说明。

## 下一步

1. 实现 MDM 到 SHEIN 类目映射规则的 Excel 导入模板和导入脚本。
2. 将类目映射规则抽象为平台类目映射能力，先完善 SHEIN 的批量更新、启停、优先级和匹配预览。
3. 接入 Excel 规则导入：观远 BI 毛重、尺码转换、包装规则、低倍率清单。
4. 生成 SHEIN listing 草稿，并用已同步的必填属性、枚举值和图片规则做发布前校验。
5. 构造 `publishOrEdit` payload，先实现测试和预览，再进入真实发布。
6. 在 SHEIN 闭环稳定后抽象 `PlatformAdapter`，补充 TEMU 元数据字段验证和适配器骨架。

## 注意事项

- 各平台生产环境通常有账号、白名单、签名、限流和审核差异，必须通过平台适配器隔离。
- 平台密钥只通过环境变量或凭据引用使用，不写入项目文件。
- `data/app.sqlite` 和 `data/shein-metadata/` 为本地数据产物，不提交 Git。
- 平台类目、发布规范和属性模板会变化，需要定期同步，并在发布前刷新关键类目规范。
- 当前 SHEIN 适配中，`fill_in_standard_list.show=false` 的字段不要提交，`attribute_status=3` 的属性必须补齐。
