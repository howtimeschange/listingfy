# 项目进度记录

日期：2026-04-27

## 当前阶段

项目处于 SHEIN 全托管商品发布 MVP 的 Phase 1 数据底座阶段：

- Phase 0 已完成：SHEIN 账号、签名、IP 白名单、类目树、发布字段规范、属性模板已调通。
- Phase 1 已完成第一段：SHEIN 元数据已从本地同步文件导入数据库，并支持查询类目、发布字段、图片规则、必填属性和枚举值。
- 当前下一步：做 MDM 到 SHEIN 末级类目的组合映射规则导入、维护和批量应用。

## 已确认业务规则

- 主键以 MDM 款号为 SPU 主键。
- MDM 真实 SKU 字段作为 SHEIN 商家 SKU；企业码只是内部码。
- DeepDraw 和 MDM 的 SPU/SKC/SKU 本质对齐，同步时做清洗归一。
- 同一 SKC 允许拆成多个 SHEIN 发布链接，使用 `publish_unit_no` 和 `split_group_key` 管理。
- 观远 BI 毛重、尺码转换表、包装规则、低倍率款号清单、类目映射规则第一期支持 Excel 上传和人工维护。
- SHEIN 末级类目映射不是 MDM 小类一对一关系，必须按 MDM 中类、小类、性别、年龄段组合匹配。
- 图片第一期接受人工上传 SKC 图片包，DeepDraw 主图和详情页作为补充。
- SHEIN 必填项优先从 MDM/DeepDraw 自动取，缺失项支持界面批量填充；非必填项第一期允许为空。
- 价格字段必须单独人工确认后才能发布。
- 发布/编辑按版本管理，保存请求、响应、快照和 traceId。
- Webhook 不作为 MVP 必配项，先用 `/open-api/goods/query-document-state` 轮询审核状态；后续生产量起来再补 Webhook。

## 已完成产出

### 产品和技术文档

- `docs/prd-shein-fullmanaged-listing-mvp.md`
- `docs/spec-shein-fullmanaged-listing-mvp.md`
- `docs/shein-openapi-live-probe-2026-04-24.md`
- `docs/shein-metadata-sync-task.md`
- `docs/phase1-shein-metadata-database.md`
- `docs/reference/interface-docs/`

### SHEIN 接口工具

- `scripts/lib/shein_client.mjs`
  - SHEIN 签名。
  - 应用验签和店铺验签请求头。
  - AES 解密工具。
  - 请求重试和成功断言。
- `scripts/shein_probe.mjs`
  - 单接口调试工具。
  - 支持类目树、发布规范、属性模板、站点、店铺信息等。
- `scripts/shein_metadata_sync.mjs`
  - 正式元数据同步任务。
  - 支持按一级类目筛选、限制叶子类目数量、并发同步和失败记录。
- `scripts/db_migrate.mjs`
  - 本地 SQLite 数据库迁移脚本。
- `scripts/shein_metadata_import.mjs`
  - 将 SHEIN 元数据同步产物导入数据库。
- `scripts/shein_metadata_query.mjs`
  - 查询类目、发布要求、图片规则、属性模板和枚举值。
- `package.json`
  - `npm run shein:probe`
  - `npm run shein:metadata:sync`
  - `npm run db:migrate`
  - `npm run shein:metadata:import`
  - `npm run shein:metadata:query`

## SHEIN 联调结果

使用生产全托管网关：

```text
https://openapi.sheincorp.cn
```

已调通：

- 店铺信息。
- 站点和币种。
- 店铺维度发布规范。
- 当前店铺可发布类目树。
- 叶子类目发布规范。
- 属性模板。

真实同步范围：

```text
一级类目：儿童, 婴儿
叶子类目：773
发布规范：773
属性模板：773
必填属性记录：8733
失败数：0
```

同步产物位于本地忽略目录：

```text
data/shein-metadata/20260424T113417Z/
```

该目录不提交 Git，避免提交大体量平台元数据。

## Phase 1 数据库进度

已新增本地 SQLite 数据库迁移、SHEIN 元数据导入服务和查询脚本：

- `db/migrations/001_shein_metadata.sql`
- `db/migrations/002_mdm_shein_mapping_dimensions.sql`
- `scripts/db_migrate.mjs`
- `scripts/shein_metadata_import.mjs`
- `scripts/shein_metadata_query.mjs`
- `docs/phase1-shein-metadata-database.md`

默认数据库为 `data/app.sqlite`，不提交 Git。导入后可以查询 SHEIN 叶子类目、类目发布字段、图片规则、必填属性和属性枚举。

本地数据库当前导入结果：

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

类目映射规则已修正为组合维度：MDM 中类、小类、性别、年龄段共同决定 SHEIN 末级类目，不按 MDM 小类一对一处理。

## 下一步

1. 做 `MDM 中类 + 小类 + 性别 + 年龄段 -> SHEIN 末级类目` 映射规则的 Excel 导入模板和导入脚本。
2. 增加映射规则查询、批量更新、启停和优先级维护能力。
3. 接 MDM/深绘数据入库，形成 SPU/SKC/SKU 主数据和内容包。
4. 接 Excel 规则导入：观远 BI 毛重、尺码转换、包装规则、低倍率清单。
5. 生成 SHEIN listing 草稿，并用已同步的必填属性、枚举值和图片规则做发布前校验。
6. 构造 `publishOrEdit` payload，先实现测试/预览，再进入真实发布。

## 风险和注意事项

- SHEIN 生产环境需要 IP 白名单，换网络或服务器后需要重新配置。
- 店铺密钥只通过环境变量使用，不写入项目文件。
- SHEIN 类目、发布规范和属性模板会变化，需要定期同步，并在发布前刷新关键类目规范。
- `fill_in_standard_list.show=false` 的字段不要提交。
- `attribute_status=3` 的属性必须补齐。
- 图片规则和 `picture_config_list` 按类目变化，不能只看店铺维度规范。
