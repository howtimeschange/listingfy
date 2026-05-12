# Listingify

Listingify 是面向跨境电商的多平台刊登中台。产品方向是商品中台 + 平台刊登中台 + ERP 能力演进：把 MDM、深绘内容包、Excel 人工规则、图片素材、价格确认、平台发布规范校验和发布追踪串成一个可审计、可批量操作的工作台。

当前 MVP 以 SHEIN 全托管作为第一个落地平台，但核心商品模型、刊登草稿、平台账号、平台元数据、发布任务、平台身份映射和后续适配器设计都按多平台方向预留。TEMU 是下一阶段明确预留的平台适配目标。

## 产品定位

- 核心商品模型不绑定单一平台，内部按 `SPU -> SKC -> SKU` 聚合商品主数据和内容资产。
- 平台特有字段进入 `channel_*`、`listing_*`、`platform_identity` 等平台层模型。
- 每个平台通过独立适配器处理类目、属性模板、图片上传/转换、payload 构造、发布、价格流程和状态同步。
- 第一阶段先用 SHEIN 跑通元数据、草稿、校验、发布版本和状态追踪闭环；后续通过 `PlatformAdapter` 扩展 TEMU 等平台。

## 项目架构

```text
                                   +-------------------------------+
                                   | Listingify Web 工作台          |
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

更新日期：2026-05-12

项目已从 Phase 1 数据底座推进到 SHEIN 发品闭环的可操作阶段。当前主线目标是：从 MDM/深绘同步商品档案，挑选进入 SHEIN 商品分桶，完成平台字段清洗、图片选择、尺码/价格/包装维护，生成发布草稿和版本，提交 SHEIN OpenAPI，并在发布任务中追踪状态。

已完成的核心进展：

- 已完成安全加固：系统不再自动创建默认弱口令管理员，登录失败会触发锁定策略，CORS 改为显式来源控制，平台密钥支持加密存储和脱敏返回，并提供 `npm run admin:create` 创建管理员账号。
- 已完成数据库从 SQLite 到 PostgreSQL 的全量切换：运行时和管理脚本默认使用 PostgreSQL，`data/app.sqlite` 的 51 张表、784,521 行历史数据已补迁并逐表对账一致。
- 已拆分 `pre-publish.ts` 中的草稿状态、字段填充、图片规则、发布 payload、SHEIN API、通用工具和版本快照服务，路由层继续承接真实页面接口，业务逻辑逐步下沉到 `web/server/services/pre-publish/*`。
- 已抽象 `PlatformAdapter` 注册入口并落地 SHEIN Adapter，当前真实发布和图片上传/转换仍以 SHEIN 为首个平台，TEMU Adapter 保持预留但暂不接入。
- 已补齐根目录测试入口，`npm test` 统一运行现有 `.test.mjs` 套件，覆盖安全、平台凭据、PlatformAdapter、pre-publish 服务、发布任务可靠性、批次发布和主要页面接线。
- 已完成 SHEIN OpenAPI 基础联调和真实发布链路，`201122104105 / 中黄30435` 已真实推送成功；系统已具备发布 payload 预览、提交、任务记录、失败原因回写、重试和审核状态同步入口。
- 已完成 SHEIN 元数据同步、导入和查询链路，发布草稿页可按所选类目展示字段、属性枚举、图片规则和尺码模板。
- 已完成 MDM 商品主数据、深绘内容包、图片素材库和 SHEIN 商品分桶的数据流，商品档案保留源头数据，平台业务字段隔离到 SHEIN 分桶与发布草稿。
- 已完成 SHEIN 商品分桶，支持批量搜索、筛选、AI 类目/字段推荐、创建多版本发布草稿、查看发布历史和最新发布状态。
- 已完成 SHEIN 发布草稿箱，支持草稿列表、批量发布前校验、阻断项快速调整、草稿复制、暂停/恢复/删除、版本快照和状态机。
- 已完成单款发布草稿详情，按 `SPU -> SKC -> SKU` 维度维护平台类目、标题、商品属性、销售属性、发布尺码、尺码表、价格、SKU 毛重、包装长宽高和图片。
- 已完成图片选择工作台：支持本地上传、从图片素材库按 SPU/SKC 选图、按图片类型和来源平台筛选、默认排除商详截图/商详模块、默认优先 TMALL 与 VIP、按平台图片规则判断尺寸/大小合规并优先展示合规图片。
- 已完成上新批次，支持将多个发布草稿归入一个 SHEIN 批次，按批次查看草稿数、SKC/SKU 范围、阻断、发布中、审核中、通过和失败数量；批次详情页可整批或勾选草稿直接复用草稿箱的发布预检、快速修正和逐草稿提交链路。
- 已完成批次级发布任务治理：支持幂等任务记录、失败原因归因、发布状态轮询、批次摘要缓存、失败任务聚合和批量重试。
- 已完成系统管理基础能力：登录鉴权、RBAC 权限、用户管理、平台对接配置、操作日志、同步任务页面。SHEIN 凭证可从环境配置迁移到平台对接配置，接口响应中会脱敏显示密钥。
- 已完成全局列表分页与每页数量设置，商品档案、SHEIN 商品分桶、发布草稿箱、批次、发布任务、同步任务、操作日志等列表均支持服务端分页。
- 已完成规则中心 SHEIN 平台化命名：类目映射、包装规则和价格规则统一为 `SHEIN 类目映射`、`SHEIN 包装规则`、`SHEIN 价格规则`，为后续多渠道规则留出命名空间。
- 已完成 SHEIN 包装规则可配置化：包装尺寸规则支持新增、编辑、删除和按优先级匹配，SHEIN 商品分桶与发布草稿生成会复用同一套规则解析逻辑。
- 已完成 SHEIN 价格规则整合：原 `SHEIN 低倍率清单` 功能已并入 `SHEIN 价格规则`，旧路由自动跳转；价格规则页拆为默认配置、SHEIN 供货折扣规则和价格试算三个 tab。
- 已完成价格基础参数配置化：默认折扣保持 SHEIN 现行 `0.4`，并与 USD 折算汇率一起在页面和数据库中可维护，发布草稿价格计算统一读取配置。
- 已完成列表筛选交互样式统一：下拉筛选触发器和 Select 组件增加清晰的下拉视觉提示，降低筛选项和普通按钮混淆。
- 已完成 SHEIN 平台商品列表 P0 闭环：支持按时间范围/款号同步平台商品并补拉 SPU 详情，列表持久化商品、SKC、SKU、供货价、商品图片、品牌名称、类目名称和最近操作流水。
- 已完成平台商品详情运营动作：从列表进入 SPU 详情，支持同步详情、检查可编辑、常用字段编辑、拼款模板、批量更新供货价、表格导入更新供货价、同步状态、撤回商品和失败操作重试。
- 已完成 SHEIN 销售站点运营视图：从 `spu-info` 的 `shelfStatusInfoList` 和各 SKC 原始 payload 展开销售站点明细，列表显示“上架 X 站”，支持按销售站点筛选、弹窗查看国家站点/状态/链接/上架时间，并在导出中拆出 `销售站点明细` Sheet。
- 已完成平台商品列表导出增强：按当前筛选条件分页导出全部本地平台商品，主 Sheet 保留统计口径，销售站点关系独立为明细 Sheet，避免把多站点数据挤在一个单元格。
- 已完成 SHEIN P1 运营支撑第一版：平台标识对账、商家 SKU 查重、条码尺码、条码打印、成本价涨价原因、审核状态聚合和真实数据回归日志已落库并接入运营中心页面。
- 已新增产品介绍首页，根路径可先展示 Listingify 能力概览，并提供登录与工作台入口。

## 已实现能力

### 首个平台适配：SHEIN

- `scripts/lib/shein_client.mjs`：SHEIN 签名、请求头、AES 解密、请求重试和结果断言。
- `scripts/shein_probe.mjs`：单接口探查工具。
- `scripts/shein_metadata_sync.mjs`：同步 SHEIN 类目树、发布字段规范、图片规则、属性模板和枚举。
- `scripts/shein_metadata_import.mjs`：将同步产物导入 PostgreSQL。
- `scripts/shein_metadata_query.mjs`：查询类目、发布要求、图片规则、属性模板和枚举。

### 数据库

- `db/migrations/001_shein_metadata.sql`：首个平台元数据落地表，当前数据源为 SHEIN。
- `db/migrations/002_mdm_shein_mapping_dimensions.sql`：MDM 到 SHEIN 组合类目映射规则。
- `db/migrations/003_mdm_product_master.sql`：MDM SPU/SKC/SKU 商品主数据表。
- `db/migrations/004_deepdraw_content_model.sql`：深绘内容包、内容 SKC/SKU、图片、详情页、尺码表和字段池表。
- Web API 和管理脚本默认使用 PostgreSQL。原因是当前迁移和查询大量使用 `on conflict`、部分唯一索引和 JSON 查询，PostgreSQL 与原 SQLite 语义更接近；如果改 MySQL，会额外消耗在冲突更新、部分索引和 JSON 方言改写上。
- `npm run db:migrate` 默认迁移 PostgreSQL，需要 `DATABASE_URL`。SQLite helper 仅保留给少量历史测试和临时离线转换验证。
- `npm run db:migrate:sqlite-data` 可把 legacy SQLite 数据文件全量补迁到 PostgreSQL；脚本会校验表/列一致、批量导入、重置 identity sequence，并在导入后做逐表行数校验。
- 运行时通过 `scripts/lib/postgres_db.mjs` 提供 PostgreSQL 兼容 facade，现有同步查询代码会落到 PostgreSQL；后续可逐步把该兼容层拆成真正异步 repository，以提升并发能力。

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

- PRD 将 Listingify 定义为商品中台 + 平台刊登中台 + ERP 能力演进，MVP 范围是 SHEIN，全局方向预留 TEMU 等多平台适配。
- spec 中的平台账号、平台类目、属性模板、刊登草稿、校验结果、发布版本、发布任务和平台身份映射均包含 `platform` 或平台账号维度。
- 后续 TEMU 接入时不修改核心商品表，新增 `TemuAdapter` 和平台字段映射。
- 预留的 `PlatformAdapter` 能力包括类目树同步、属性模板同步、图片上传、尺码表准备、payload 构造、发布、状态同步和价格流程同步。

### Web 工作台原型

`web/` 目录包含一个前后端原型：

- 前端：React 19、TypeScript、Vite、React Router、TanStack Query、TanStack Table、shadcn/radix 风格组件。
- 后端：Hono + PostgreSQL，运行时通过 `pg` 连接池和兼容 facade 访问数据库。
- 已配置页面路由：首页、工作台、上新批次、SHEIN 商品分桶、SHEIN 发布草稿箱、发布任务、SHEIN 类目映射、SHEIN 尺码转换、SHEIN 包装规则、SHEIN 价格规则、SHEIN 元数据、商品档案、MDM 商品主数据、深绘内容包、图片素材库、平台对接、用户管理、同步任务、操作日志。旧 `SHEIN 低倍率清单` 路由保留跳转到 `SHEIN 价格规则`。
- 已实现接口：`/api/auth/*`、`/api/users/*`、`/api/platform-integrations/*`、`/api/system/*`、`/api/metadata/*`、`/api/category-mapping/*`、`/api/shein-products/*`、`/api/pre-publish/*`、`/api/publish-tasks/*`、`/api/listing-batches/*`、`/api/business-rules/*`、`/api/product-archives/*`、`/api/mdm-products/*`、`/api/deepdraw-content/*`、`/api/image-library/*`。
- 当前页面以 SHEIN 作为首个完整平台工作流，平台账号、元数据、发布任务、操作日志和后续适配器仍按多平台模型保留。

### 本次更新重点

- 数据库：新增 `docker-compose.postgres.yml`、PostgreSQL-only runtime config、迁移转换器、同步兼容 facade 和 SQLite-to-PostgreSQL 数据补迁脚本。
- 安全：移除默认密码路径，新增显式管理员创建脚本、登录失败限制、CORS 白名单、平台密钥加密和凭据脱敏。
- 架构：将 `pre-publish.ts` 中可独立测试的草稿、字段、图片、payload、SHEIN API、版本和 shared helper 拆到服务层。
- 发布可靠性：`listing_publish_task` 增加幂等键、尝试次数、失败分类、可重试标记、下次重试时间和状态轮询时间。
- 批次体验：上新批次详情页新增整批提交和勾选草稿提交，直接复用 SHEIN 发布草稿箱的预检和提交逻辑，减少页面跳转。
- 规则中心：包装规则、价格默认配置、供货折扣规则和低倍率清单整合为可配置页面，SHEIN 平台规则菜单统一加上平台前缀。
- 交互体验：统一列表筛选触发器，让所有下拉筛选项在视觉上更像可展开控件。
- 平台商品：新增 `/api/shein-platform-products` 主模块和 `平台商品列表` 页面，覆盖同步、详情、编辑、拼款、供货价、状态、撤回、站点币种、操作流水和导出。
- 销售站点：基于 `/open-api/goods/spu-info` 返回的 `shelfStatusInfoList` 展开站点明细，支持列表展示、站点筛选、详情表和多 Sheet 导出。
- 批量供货价：平台商品列表和 SPU 详情均支持批量更新供货价，列表页新增表格导入模板、上传预览和按 SPU/SKC 聚合提交。
- 品牌/类目：平台商品列表已从本地规则和类目映射表解析品牌名称、类目名称，并支持按展示名称筛选。
- 表格导出：前端导出从单 Sheet 升级为命名多 Sheet，下载逻辑使用显式 Blob 链接以兼容浏览器下载。
- P1 运营中心：新增平台标识对账、条码尺码、审核状态聚合、涨价原因缓存和真实数据回归记录。
- 测试：根目录 `npm test` 已成为稳定入口，当前关键套件覆盖 140 个测试用例。

## 运行方式

根目录命令：

```bash
docker compose -f docker-compose.postgres.yml up -d
export DATABASE_PROVIDER=postgres
export DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify

npm run db:migrate
npm run db:migrate:sqlite-data -- --sqlite data/app.sqlite
npm run admin:create -- --username admin --display-name 系统管理员 --password '<强密码>'
npm run shein:metadata:import
npm run shein:metadata:query
npm run deepdraw:sync -- --tenant 电商巴拉巴拉 208226102001 208226103201
npm run deepdraw:import
npm test
npm run web:server
npm run web:dev
```

PostgreSQL 迁移示例：

```bash
docker compose -f docker-compose.postgres.yml up -d

DATABASE_PROVIDER=postgres \
DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify \
npm run db:migrate
```

从历史 SQLite 文件补迁数据：

```bash
DATABASE_PROVIDER=postgres \
DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify \
npm run db:migrate:sqlite-data -- --sqlite data/app.sqlite
```

本地 `psql` 如果来自 Homebrew `libpq`，可使用完整路径：

```bash
/opt/homebrew/opt/libpq/bin/psql "postgres://listingify:listingify@localhost:5432/listingify"
```

创建管理员：

```bash
DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify \
npm run admin:create -- --username admin --display-name 系统管理员 --password '<强密码>'
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

- `docs/user-manual-current.md`：当前 Web 工作台用户操作手册。
- `docs/project-progress-2026-04-30.md`：截至 2026-04-30 的阶段进度、已完成能力、缺口和下一步计划。
- `docs/project-progress-2026-05-12.md`：截至 2026-05-12 的 SHEIN 平台商品生命周期、销售站点、供货价批量更新和 P1 运营中心进度快照。
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
- `docs/postgres-migration-plan-2026-05-06.md`：SQLite 到 PostgreSQL 的迁移计划、执行命令、验证项和后续优化建议。
- `docs/shein-product-lifecycle-api-plan-2026-05-11.md`：SHEIN 商品链接全生命周期接口计划和 P0/P1/P2 进度。

## 下一步

1. 用真实 SHEIN 账号回归平台商品全链路：同步列表、按款号同步、SPU 详情、站点币种、销售站点、可编辑检查、状态同步、供货价更新、编辑、拼款和撤回。
2. 强化最近操作和失败排查：补请求/响应详情查看、失败分类、重试策略和面向运营的错误提示。
3. 强化发布任务自动化：在现有手动轮询基础上，增加定时轮询、状态变更通知和审核驳回后的修复工作流。
4. 完善图片转换治理：在已有上传/转换基础上，补充平台图片标识复用、转换结果对比、失败重试和素材质量报表。
5. 强化批量发布阻断修复：支持更多字段类型、跨 SKC/SKU 批量应用、字段变更差异预览和修复历史记录。
6. 在 SHEIN 流程稳定后再启动 TEMU Adapter：复用现有 `PlatformAdapter` 边界，实现 TEMU 元数据验证、草稿字段映射和发布任务骨架。

## 注意事项

- 各平台生产环境通常有账号、白名单、签名、限流和审核差异，必须通过平台适配器隔离。
- 平台密钥只通过环境变量或凭据引用使用，不写入项目文件。
- 系统不再自动创建默认弱口令管理员。首次运行迁移后，使用 `npm run admin:create -- --username admin --display-name 系统管理员 --password '<强密码>'` 创建或重置管理员。
- 生产环境应设置 `LISTINGIFY_ALLOWED_ORIGINS` 和 `LISTINGIFY_CREDENTIAL_SECRET`；后者用于加密平台对接密钥，保存凭据后需保持稳定。
- PostgreSQL 本地数据由 `docker-compose.postgres.yml` 中的 Docker volume 管理；`data/shein-metadata/` 等同步产物不提交 Git。历史 `data/app.sqlite` 仅用于显式 legacy 转换/测试，不作为运行时数据库。
- 平台类目、发布规范和属性模板会变化，需要定期同步，并在发布前刷新关键类目规范。
- 当前 SHEIN 适配中，`fill_in_standard_list.show=false` 的字段不要提交，`attribute_status=3` 的属性必须补齐。
