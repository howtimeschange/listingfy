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
| `mdm_shein_category_mapping_rule` | MDM 小类到 SHEIN 末级类目的人工映射规则 |
| `v_shein_leaf_category` | SHEIN 叶子类目查询视图 |
| `v_shein_category_required_attribute` | 类目必填属性查询视图 |

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

1. 给 `mdm_shein_category_mapping_rule` 增加 Excel 导入和批量维护接口。
2. 接 MDM/深绘数据入库，形成 SPU/SKC/SKU 主数据。
3. 基于 `channel_category` 和 `channel_required_attribute` 生成 SHEIN listing 草稿校验结果。
4. 做发布 payload 预览接口，把必填字段、图片规则和属性枚举直接展示给运营确认。
