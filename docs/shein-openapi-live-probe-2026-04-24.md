# SHEIN OpenAPI 真实联调记录

日期：2026-04-24

## 结论

当前 SHEIN 生产全托管网关已调通，签名、IP 白名单、店铺元数据接口均验证通过。

调用网关：

```text
https://openapi.sheincorp.cn
```

不应使用测试网关调用这组店铺密钥；测试网关会返回签名错误。

## 已调通接口

| 能力 | 接口 | 结果 |
| --- | --- | --- |
| 店铺信息 | `/open-api/openapi-business-backend/query-store-info` | `code=0` |
| 站点和币种 | `/open-api/goods/query-site-list` | `code=0` |
| 店铺维度发布规范 | `/open-api/goods/query-publish-fill-in-standard` | `code=0` |
| 当前店铺可发布类目树 | `/open-api/goods/query-category-tree` | `code=0` |
| 叶子类目发布规范 | `/open-api/goods/query-publish-fill-in-standard` with `category_id` | `code=0` |
| 属性模板 | `/open-api/goods/query-attribute-template` with `product_type_id_list` | `code=0` |

## 店铺信息

```text
supplierId: 2366027
totalLimit: 999999
availableLimit: 999565
usedQuota: 434
```

## 店铺维度发布规范

```text
default_language: zh-cn
currency: CNY
```

店铺维度必填且可展示字段：

| field_key | module |
| --- | --- |
| `stop_purchase` | `supplier_info` |
| `suggest_price` | `sales_info` |

店铺维度可展示但非必填字段包括：

- `skc_title`
- `brand_code`
- `brand_series`
- `original_image`
- `ip_character`

## 类目树概览

当前店铺返回：

```text
一级类目数: 13
叶子类目数: 2162
```

一级类目叶子数量：

| 一级类目 | category_id | 叶子类目数 |
| --- | ---: | ---: |
| 运动&户外 | 2866 | 1358 |
| 儿童 | 2029 | 537 |
| 婴儿 | 2894 | 236 |
| 家居&生活 | 2030 | 10 |
| 工具&家装 | 4357 | 5 |
| 玩具&游戏 | 4358 | 5 |
| 鞋子 | 3293 | 3 |
| 箱包 | 3294 | 2 |
| 家用纺织品 | 3978 | 2 |
| 內衣&睡衣 | 2036 | 1 |
| 电子产品 | 2264 | 1 |
| 办公和学习用品 | 2282 | 1 |
| 美容&健康 | 1864 | 1 |

## 样例叶子类目

样例：女童（大）T恤

```text
path: 儿童 > 女童（大）服装 > 女童（大）上衣 > 女童（大）T恤
category_id: 2013
product_type_id: 9738
```

类目维度发布规范：

```text
default_language: zh-cn
currency: CNY
support_sale_attribute_sort: false
```

必填且可展示字段：

| field_key | module |
| --- | --- |
| `stop_purchase` | `supplier_info` |
| `suggest_price` | `sales_info` |

图片规则：

| field_key | is_true |
| --- | --- |
| `switch_spu_picture` | false |
| `spu_image_detail_show` | true |
| `spu_image_detail_required` | false |
| `spu_image_detail_single` | true |
| `spu_image_square_show` | false |
| `spu_image_square_required` | false |
| `skc_image_detail_show` | true |
| `skc_image_detail_required` | true |
| `skc_image_detail_single` | false |
| `skc_image_square_show` | true |
| `skc_image_square_required` | true |

属性模板：

```text
attribute_count: 62
required_attribute_count: 9
sale_attributes: 颜色, 尺寸
```

必填属性：

| attribute_id | 属性 | 类型 | 填写方式 |
| ---: | --- | ---: | ---: |
| 1000437 | 是否加绒 | 4 | 3 |
| 90 | 袖长 | 4 | 3 |
| 39 | 面料弹性 | 4 | 1 |
| 160 | 材质 | 4 | 3 |
| 62 | 成分 | 3 | 4 |
| 1000069 | 护理说明/注意事项 | 4 | 3 |
| 1000062 | 织造方式 | 4 | 3 |
| 1000411 | 数量 | 4 | 4 |
| 1000407 | 关税种类 | 4 | 3 |

## 批量属性模板验证

单次请求 10 个 `product_type_id` 成功返回。

| product_type_id | 属性数 | 必填属性数 | 销售属性 |
| ---: | ---: | ---: | --- |
| 5925 | 61 | 11 | 尺寸, 颜色 |
| 9736 | 62 | 9 | 颜色, 尺寸 |
| 9738 | 62 | 9 | 颜色, 尺寸 |
| 9600 | 56 | 18 | 颜色, 尺寸 |
| 9632 | 63 | 20 | 颜色, 尺寸 |
| 9601 | 55 | 18 | 颜色, 尺寸 |
| 9335 | 60 | 18 | 颜色, 尺寸 |
| 9341 | 60 | 19 | 颜色, 尺寸 |
| 9342 | 60 | 19 | 颜色, 尺寸 |
| 9631 | 63 | 20 | 颜色, 尺寸 |

## 下一步开发动作

1. 将 `query-category-tree` 写入 `channel_category`。
2. 对 `last_category=true` 的叶子类目批量同步 `query-publish-fill-in-standard` 和 `query-attribute-template`。
3. 以 `category_id + product_type_id` 作为 SHEIN 类目映射规则的目标值。
4. 商品草稿校验时，按类目发布规范过滤 `show=false` 字段，并强制填写 `required=true` 字段。
5. 属性校验时，按 `attribute_status=3`、`attribute_type`、`attribute_mode` 判断必填属性、销售属性、尺寸属性和枚举/手填方式。
