# SHEIN 元数据同步任务

## 目标

同步 SHEIN 当前店铺的发品元数据，支撑后续草稿生成、字段校验和类目映射：

- 店铺信息。
- 站点和币种。
- 当前店铺可发布类目树。
- 叶子类目的发布字段规范。
- 叶子类目的属性模板、枚举值和必填属性。

## 运行方式

凭据只通过环境变量传入，不写入项目文件。

```bash
SHEIN_OPEN_KEY_ID=... \
SHEIN_SECRET_KEY=... \
npm run shein:metadata:sync -- --roots '儿童,婴儿'
```

全店铺可发布类目同步：

```bash
SHEIN_OPEN_KEY_ID=... \
SHEIN_SECRET_KEY=... \
npm run shein:metadata:sync
```

冒烟测试：

```bash
SHEIN_OPEN_KEY_ID=... \
SHEIN_SECRET_KEY=... \
npm run shein:metadata:sync -- --roots '儿童' --limit-leaves 20
```

默认网关：

```text
https://openapi.sheincorp.cn
```

## 输出目录

默认输出到：

```text
data/shein-metadata/<timestamp>/
```

该目录已加入 `.gitignore`，避免提交大体量平台元数据。

## 输出文件

| 文件 | 用途 |
| --- | --- |
| `manifest.json` | 本次同步摘要、计数、文件索引 |
| `store-info.json` | 店铺信息和额度 |
| `site-list.json` | 站点、币种、站点状态 |
| `store-publish-standard.json` | 店铺维度发布规范 |
| `category-tree.json` | 原始类目树响应 |
| `categories.flat.jsonl` | 类目树扁平化，包含非叶子和叶子 |
| `leaf-categories.json` | 本次选中的叶子类目 |
| `publish-standards.jsonl` | 每个叶子类目的发布字段规范 |
| `attribute-templates.jsonl` | 每个 `product_type_id` 的完整属性模板 |
| `required-attributes.jsonl` | 必填属性扁平表，便于校验和界面展示 |
| `sync-failures.jsonl` | 同步失败记录 |

## 已执行结果

执行时间：2026-04-24

范围：`儿童,婴儿`

```text
root_categories: 13
all_categories: 2540
leaf_categories_total: 2162
leaf_categories_selected: 773
product_type_ids_selected: 773
publish_standards_synced: 773
attribute_templates_synced: 773
required_attribute_rows: 8733
failures_count: 0
```

输出目录：

```text
data/shein-metadata/20260424T113417Z/
```

## 入库映射建议

| 输出 | 目标表 |
| --- | --- |
| `categories.flat.jsonl` | `channel_category` |
| `publish-standards.jsonl` | `channel_attribute_template.picture_config/default_language/currency/required_fields` |
| `attribute-templates.jsonl` | `channel_attribute_template.template_payload/enum_values/input_constraints` |
| `required-attributes.jsonl` | 校验缓存表或 `channel_attribute_template.required_fields` |

关键字段：

- `category_id` 对应 SHEIN 末级类目 ID。
- `product_type_id` 用于查询属性模板和构造属性字段。
- `last_category=true` 才允许作为发品类目。
- `fill_in_standard_list.show=false` 的字段不要提交。
- `fill_in_standard_list.required=true` 的字段必须补齐。
- `attribute_status=3` 表示属性必填。
- `attribute_type=1` 是销售属性，`2` 是尺寸属性，`3/4` 是商品属性。
- `attribute_mode` 决定枚举、多选或手填方式。
