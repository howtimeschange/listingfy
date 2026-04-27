# Phase 1 SHEIN 元数据数据库

日期：2026-04-27

## 目标

把 SHEIN 元数据同步任务产出的本地文件导入数据库，让类目、发布字段规范、图片规则、属性模板和枚举值可以被后续后台服务查询和维护。

当前实现采用本地 SQLite：

- 默认数据库：`data/app.sqlite`
- 数据库文件不提交 Git。
- 表结构按后续 PostgreSQL 迁移方向设计。
- 业务密钥不进入数据库。
- 依赖 Node.js 24+ 内置 `node:sqlite`，不额外安装数据库驱动。

## 命令

执行迁移：

```bash
npm run db:migrate
```

导入最近一次 SHEIN 元数据：

```bash
npm run shein:metadata:import
```

导入指定同步目录：

```bash
npm run shein:metadata:import -- --source data/shein-metadata/20260424T113417Z
```

查询摘要：

```bash
npm run shein:metadata:query
```

搜索类目：

```bash
npm run shein:metadata:query -- --search '女童（大）T恤'
```

查询单个类目的发品要求：

```bash
npm run shein:metadata:query -- --category-id 2013
```

查询属性枚举：

```bash
npm run shein:metadata:query -- --product-type-id 9738 --attribute-id 87
```

## 表结构

| 表/视图 | 说明 |
| --- | --- |
| `sync_batch` | SHEIN 元数据导入批次 |
| `channel_store_metadata` | 店铺信息、站点列表、店铺发布规范原文 |
| `channel_category` | SHEIN 类目树扁平表 |
| `channel_publish_standard` | 店铺/类目维度发布规范 |
| `channel_publish_field` | 发布字段规范，包含 `required` 和 `show` |
| `channel_picture_config` | 图片规则 |
| `channel_attribute_template` | product type 维度属性模板 |
| `channel_attribute` | 属性明细 |
| `channel_attribute_value` | 属性枚举值 |
| `channel_required_attribute` | 类目维度必填属性 |
| `mdm_shein_category_mapping_rule` | MDM 中类 + 小类 + 性别 + 年龄段到 SHEIN 末级类目的组合映射规则 |
| `v_shein_leaf_category` | SHEIN 叶子类目查询视图 |
| `v_shein_category_required_attribute` | 类目必填属性查询视图 |

## 类目映射规则

SHEIN 末级类目的映射不是单纯的 MDM 小类一对一关系。第一版规则按以下维度综合匹配：

| 维度 | 字段 |
| --- | --- |
| MDM 中类 | `mdm_middle_category_code`、`mdm_middle_category_name` |
| MDM 小类 | `mdm_small_category_code`、`mdm_small_category_name` |
| 性别 | `gender_code`、`gender_name` |
| 年龄段 | `age_group_code`、`age_group_name` |
| SHEIN 目标 | `shein_category_id`、`shein_product_type_id` |

匹配策略：

- `match_mode=EXACT` 表示四个业务维度精确命中，作为常规规则。
- `match_mode=FALLBACK` 用于历史兼容或少量兜底规则，按 `priority` 决定优先级。
- `match_key` 保存归一化后的组合键，后续 Excel 导入时用于幂等更新。
- 同一个有效 `EXACT` 组合只允许指向一个 SHEIN 末级类目。

后续 Excel 导入模板建议至少包含这些列：

```text
MDM中类编码, MDM中类名称, MDM小类编码, MDM小类名称,
性别编码, 性别名称, 年龄段编码, 年龄段名称,
SHEIN末级类目ID, SHEIN product_type_id, 优先级, 状态, 备注
```

## 当前导入范围

当前本地已有一次正式同步结果：

```text
data/shein-metadata/20260424T113417Z/
```

范围：

```text
一级类目：儿童, 婴儿
叶子类目：773
发布规范：773
属性模板：773
必填属性记录：8733
同步失败：0
```

本地数据库导入验证结果：

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

## 下一步

1. 给 `mdm_shein_category_mapping_rule` 增加 Excel 导入和批量维护接口，导入维度按 MDM 中类、小类、性别、年龄段组合匹配。
2. 接 MDM/深绘数据入库，形成 SPU/SKC/SKU 主数据。
3. 基于 `channel_category` 和 `channel_required_attribute` 生成 SHEIN listing 草稿校验结果。
4. 做发布 payload 预览接口，把必填字段、图片规则和属性枚举直接展示给运营确认。
