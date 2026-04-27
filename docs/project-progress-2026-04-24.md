# 项目进度记录

日期：2026-04-24

## 当前阶段

项目处于 SHEIN 全托管商品发布 MVP 的 Phase 0/Phase 1 交界：

- Phase 0：SHEIN 账号、签名、IP 白名单、类目树、发布字段规范、属性模板已调通。
- Phase 1：已经具备把 SHEIN 元数据同步成结构化文件的任务脚本，下一步接数据库表和后台界面。

## 已确认业务规则

- 主键以 MDM 款号为 SPU 主键。
- MDM 真实 SKU 字段作为 SHEIN 商家 SKU；企业码只是内部码。
- DeepDraw 和 MDM 的 SPU/SKC/SKU 本质对齐，同步时做清洗归一。
- 同一 SKC 允许拆成多个 SHEIN 发布链接，使用 `publish_unit_no` 和 `split_group_key` 管理。
- 观远 BI 毛重、尺码转换表、包装规则、低倍率款号清单、类目映射规则第一期支持 Excel 上传和人工维护。
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
- `package.json`
  - `npm run shein:probe`
  - `npm run shein:metadata:sync`

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

## 下一步

1. Phase 1 已开始：接数据库，创建 SHEIN 元数据表和导入脚本。
2. 将 `categories.flat.jsonl`、`publish-standards.jsonl`、`attribute-templates.jsonl`、`required-attributes.jsonl` 导入本地数据库。
3. 做 `MDM 小类 -> SHEIN 末级类目` 映射规则维护。
4. 接 Excel 导入：观远 BI 毛重、尺码转换、包装规则、低倍率清单。
5. 生成 SHEIN listing 草稿，并用已同步的必填属性和图片规则做发布前校验。
6. 构造 `publishOrEdit` payload，先实现测试/预览，再进入真实发布。

## 2026-04-27 Phase 1 补充

已新增本地 SQLite 数据库迁移、SHEIN 元数据导入服务和查询脚本：

- `db/migrations/001_shein_metadata.sql`
- `scripts/db_migrate.mjs`
- `scripts/shein_metadata_import.mjs`
- `scripts/shein_metadata_query.mjs`
- `docs/phase1-shein-metadata-database.md`

默认数据库为 `data/app.sqlite`，不提交 Git。导入后可以查询 SHEIN 叶子类目、类目发布字段、图片规则、必填属性和属性枚举。

## 风险和注意事项

- SHEIN 生产环境需要 IP 白名单，换网络或服务器后需要重新配置。
- 店铺密钥只通过环境变量使用，不写入项目文件。
- SHEIN 类目、发布规范和属性模板会变化，需要定期同步，并在发布前刷新关键类目规范。
- `fill_in_standard_list.show=false` 的字段不要提交。
- `attribute_status=3` 的属性必须补齐。
- 图片规则和 `picture_config_list` 按类目变化，不能只看店铺维度规范。
