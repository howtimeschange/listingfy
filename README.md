# Listingfy

Listingfy 是面向 SHEIN 全托管发品的上新中台项目。当前目标是把 MDM、深绘内容包、Excel 人工规则、图片素材、价格确认、SHEIN 发布规范校验和发布追踪串成一个可审计、可批量操作的 MVP 工作台。

## 当前进度

更新日期：2026-04-29

项目处于 Phase 1 数据底座和后台原型联通阶段：

- 已完成 SHEIN OpenAPI 基础联调，包括店铺信息、站点币种、店铺发布规范、可发布类目树、叶子类目发布规范和属性模板。
- 已完成 SHEIN 元数据同步、导入和查询链路，支持查询类目、发布字段、图片规则、必填属性、销售属性、尺寸属性和枚举值。
- 已建立本地 SQLite 数据库迁移，覆盖 SHEIN 元数据表和 MDM 到 SHEIN 组合类目映射表。
- 已确认类目映射规则按 `MDM 中类 + 小类 + 性别 + 年龄段` 组合匹配 SHEIN 末级类目，而不是简单小类一对一。
- 已新增 Listingfy Web 原型，包含 React + TypeScript + Vite 前端、Hono API 服务、SHEIN 元数据浏览和类目映射规则维护接口。
- 已规划上新工作、规则中心、数据中心和系统管理的主要页面骨架。

## 已实现能力

### SHEIN 接口与元数据

- `scripts/lib/shein_client.mjs`：SHEIN 签名、请求头、AES 解密、请求重试和结果断言。
- `scripts/shein_probe.mjs`：单接口探查工具。
- `scripts/shein_metadata_sync.mjs`：同步 SHEIN 类目树、发布字段规范、图片规则、属性模板和枚举。
- `scripts/shein_metadata_import.mjs`：将同步产物导入本地 SQLite。
- `scripts/shein_metadata_query.mjs`：查询类目、发布要求、图片规则、属性模板和枚举。

### 数据库

- `db/migrations/001_shein_metadata.sql`：SHEIN 元数据表。
- `db/migrations/002_mdm_shein_mapping_dimensions.sql`：MDM 到 SHEIN 组合类目映射规则。
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

### Web 工作台原型

`web/` 目录包含一个前后端原型：

- 前端：React 19、TypeScript、Vite、React Router、TanStack Query、TanStack Table、shadcn/radix 风格组件。
- 后端：Hono + better-sqlite3，本地读取 `data/app.sqlite`。
- 已配置页面路由：工作台、上新批次、草稿工作台、图片管理、发布校验、发布任务、类目映射、属性映射、尺码转换、包装规则、价格规则、低倍率清单、SHEIN 元数据、MDM 商品、深绘内容包、图片素材库、SHEIN 账号、同步任务、操作日志。
- 已实现接口：`/api/metadata/*` 和 `/api/category-mapping/*`。

## 运行方式

根目录命令：

```bash
npm run db:migrate
npm run shein:metadata:import
npm run shein:metadata:query
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
- `docs/prd-shein-fullmanaged-listing-mvp.md`：产品需求。
- `docs/spec-shein-fullmanaged-listing-mvp.md`：技术规格。
- `docs/phase1-shein-metadata-database.md`：Phase 1 数据库说明。
- `docs/shein-openapi-live-probe-2026-04-24.md`：SHEIN OpenAPI 联调记录。
- `docs/shein-metadata-sync-task.md`：元数据同步任务说明。

## 下一步

1. 实现 MDM 到 SHEIN 类目映射规则的 Excel 导入模板和导入脚本。
2. 完善类目映射规则的批量更新、启停、优先级和匹配预览。
3. 接入 MDM/深绘数据入库，形成 SPU/SKC/SKU 主数据和内容包。
4. 接入 Excel 规则导入：观远 BI 毛重、尺码转换、包装规则、低倍率清单。
5. 生成 SHEIN listing 草稿，并用已同步的必填属性、枚举值和图片规则做发布前校验。
6. 构造 `publishOrEdit` payload，先实现测试和预览，再进入真实发布。

## 注意事项

- SHEIN 生产环境需要 IP 白名单，换网络或服务器后需要重新配置。
- 店铺密钥只通过环境变量使用，不写入项目文件。
- `data/app.sqlite` 和 `data/shein-metadata/` 为本地数据产物，不提交 Git。
- SHEIN 类目、发布规范和属性模板会变化，需要定期同步，并在发布前刷新关键类目规范。
- `fill_in_standard_list.show=false` 的字段不要提交，`attribute_status=3` 的属性必须补齐。
