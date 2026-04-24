---
title: MDM SKU 查询接口
doc_type: query_api
object_type: sku
generated_at: 2026-04-21
source_files:
  - /Users/xingyicheng/Downloads/查询接口 (1).docx
endpoint: https://mdm.semirapp.com/demdm-api/open/api/v2/selectApi/SKU_LIST
method: POST
---

# MDM SKU 查询接口

## 元信息

- 对象类型: `sku`
- 接口类型: `query_api`
- 接口地址: `https://mdm.semirapp.com/demdm-api/open/api/v2/selectApi/SKU_LIST`
- 请求方式: `POST`
- 原始文件: `/Users/xingyicheng/Downloads/查询接口 (1).docx`

## 文档正文

### 自定义查询条件使用说明

查询接口支持使用系统字段和表单组件查询数据，在请求参数中传入组件的格式即可，不同组件对应的传参格式详情见请求参数及说明

### 接口报文示例

#### 请求报文示例

- 可见键集合: `FORM_CODE, UUID, PAGE, PAGE_SIZE, DATA`

#### 响应报文示例

- 可见键集合: `UUID, RESULT, MESSAGE, ERROR_CODE, LAST_PAGE, DATA`

### 请求头

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| demdmtoken | String | 用于请求的token | 是 | 否 |

### 请求参数

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| UUID | String | 请求的唯一标识 | 是 | 否 |
| PAGE | String | 分页参数，默认为1 | 是 | 否 |
| PAGE_SIZE | String | 分页参数，默认为10,每页查询多少条 | 是 | 否 |
| FORM_CODE | String | PRODUCT_SKU | 是 | 否 |
| DATA | PRODUCT_SKU | PRODUCT_SKU | 是 | 否 |

### PRODUCT_SKU说明

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| BRAND_DESC | String | 品牌名称 | 否 | 否 |
| COLOR_DESC | String | 颜色名称 | 否 | 否 |
| COMPOSITION | String | 成分 | 否 | 否 |
| FABRIC | String | 面料 | 否 | 否 |
| IP_CARTOON_DESC | String | IP-卡通人物名称 | 否 | 否 |
| IP_TYPE_DESC | String | IP类型名称 | 否 | 否 |
| IS_IP_DESC | String | 是否IP名称 | 否 | 否 |
| LINING_MATERIAL | String | 里料 | 否 | 否 |
| MDM_CODE | String | 款号 | 否 | 否 |
| MDM_NAME | String | 款名称 | 否 | 否 |
| PIC_URL | String | 商品图片 | 否 | 否 |
| PRICE_TAG | String | 挂牌单价 | 否 | 否 |
| SEASON_DESC | String | 季节名称 | 否 | 否 |
| SIZE_DESC | String | 尺码名称 | 否 | 否 |
| SKC_NAME | String | SKC名称 | 否 | 否 |
| SKU_CODE | String | SKU编码 | 否 | 否 |
| SKU_NAME | String | SKU名称 | 否 | 否 |
| STATUS_DESC | String | 物料状态名称 | 否 | 否 |
| SUPPLY_TYPE_DESC | String | 轻供类型名称 | 否 | 否 |
| WASH_LABEL_INGR | String | 洗唛成分 | 否 | 否 |
| YEAR | String | 年份 | 否 | 否 |
| MDM_NAME_US | String | 款描述-英语 | 否 | 否 |
| MDM_NAME_VN | String | 款描述-越南语 | 否 | 否 |
| BRAND_CODE | String | 品牌编码 | 否 | 否 |
| COLOR_CODE | String | 颜色编码 | 否 | 否 |
| EAN_CODE | String | 国际码 | 否 | 否 |
| INNER_CODE | String | 企业码 | 否 | 否 |
| IP_CARTOON_CODE | String | IP-卡通人物编码 | 否 | 否 |
| IP_TYPE_CODE | String | IP类型编码 | 否 | 否 |
| IS_IP_CODE | String | 是否IP编码 | 否 | 否 |
| SEASON_CODE | String | 季节编码 | 否 | 否 |
| SIZE_CODE | String | 尺码编码 | 否 | 否 |
| SKC_CODE | String | SKC编码 | 否 | 否 |
| STATUS_CODE | String | 物料状态编码 | 否 | 否 |
| SUPPLIER_PRODUCT_CODE | String | 供应商商品条码 | 否 | 否 |
| SUPPLY_TYPE_CODE | String | 轻供类型编码 | 否 | 否 |
| CREATED_BY | String | 创建人 | 否 | 否 |
| LAST_UPDATED_BY | String | 最后更新人 | 否 | 否 |
| CREATION_DATE | String | 创建日期 | 否 | 否 |
| CREATION_DATE_START | String | 创建日期_开始时间 | 否 | 否 |
| CREATION_DATE_END | String | 创建日期_结束时间 | 否 | 否 |
| LAST_UPDATE_DATE | String | 最后更新日期 | 否 | 否 |
| LAST_UPDATE_DATE_START | String | 最后更新日期_开始时间 | 否 | 否 |
| LAST_UPDATE_DATE_END | String | 最后更新日期_结束时间 | 否 | 否 |
| ENABLED_DATE | String | 启用时间 | 否 | 否 |
| ENABLED_DATE_START | String | 启用时间_开始时间 | 否 | 否 |
| ENABLED_DATE_END | String | 启用时间_结束时间 | 否 | 否 |
| DISABLED_DATE | String | 禁用时间 | 否 | 否 |
| DISABLED_DATE_START | String | 禁用时间_开始时间 | 否 | 否 |
| DISABLED_DATE_END | String | 禁用时间_结束时间 | 否 | 否 |
| ENABLE_STATUS | String | 启用禁用 | 否 | 否 |

### 响应结果

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| UUID | String | 请求的唯一标识 | 是 | 否 |
| DATA | List<PRODUCT_SKU> | PRODUCT_SKU | 是 | 否 |
| RESULT | String | 响应结果编码；S代表的是接口调用成功,E代表的是接口调用失败 | 是 | 否 |
| MESSAGE | String | 响应结果集描述 | 否 | 否 |
| ERROR_CODE | String | 失败编码 | 否 | 否 |

### DATA说明

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| ASSOCIATED_MDM_ID | String | 记录关联主数据的ID | 否 | 否 |
| BRAND_DESC | String | 品牌名称 | 否 | 否 |
| COLOR_DESC | String | 颜色名称 | 否 | 否 |
| COMPOSITION | String | 成分 | 否 | 否 |
| DOMAIN_ID | String | 记录主数据域的ID | 否 | 否 |
| FABRIC | String | 面料 | 否 | 否 |
| FORM_CODE | String | 记录主数据的表单编码 | 否 | 否 |
| ID | String | 记录主数据的ID | 否 | 否 |
| IP_CARTOON | String | IP-卡通人物 | 否 | 否 |
| IP_CARTOON_DESC | String | IP-卡通人物名称 | 否 | 否 |
| IP_TYPE_DESC | String | IP类型名称 | 否 | 否 |
| IS_IP_DESC | String | 是否IP名称 | 否 | 否 |
| LINING_MATERIAL | String | 里料 | 否 | 否 |
| MDM_CODE | String | 款号 | 否 | 否 |
| MDM_NAME | String | 款名称 | 否 | 否 |
| MERGE_MDM_ID | String | 记录合并主数据的ID | 否 | 否 |
| PIC_URL | String | 商品图片 | 否 | 否 |
| PRICE_TAG | String | 挂牌单价 | 否 | 否 |
| SEASON_DESC | String | 季节名称 | 否 | 否 |
| SIZE_DESC | String | 尺码名称 | 否 | 否 |
| SKC_NAME | String | SKC名称 | 否 | 否 |
| SKU_CODE | String | SKU编码 | 否 | 否 |
| SKU_NAME | String | SKU名称 | 否 | 否 |
| SOURCE_DOMAIN_ID | String | 记录来源主数据域的ID | 否 | 否 |
| SOURCE_MDM_ID | String | 记录来源主数据的ID | 否 | 否 |
| STATUS_DESC | String | 物料状态名称 | 否 | 否 |
| SUPPLY_TYPE_DESC | String | 轻供类型名称 | 否 | 否 |
| WASH_LABEL_INGR | String | 洗唛成分 | 否 | 否 |
| YEAR | String | 年份 | 否 | 否 |
| MDM_NAME_US | String | 款描述-英语 | 否 | 否 |
| MDM_NAME_VN | String | 款描述-越南语 | 否 | 否 |
| BRAND_CODE | String | 品牌编码 | 否 | 否 |
| COLOR_CODE | String | 颜色编码 | 否 | 否 |
| EAN_CODE | String | 国际码 | 否 | 否 |
| INNER_CODE | String | 企业码 | 否 | 否 |
| IP_CARTOON_CODE | String | IP-卡通人物编码 | 否 | 否 |
| IP_TYPE_CODE | String | IP类型编码 | 否 | 否 |
| IS_IP_CODE | String | 是否IP编码 | 否 | 否 |
| SEASON_CODE | String | 季节编码 | 否 | 否 |
| SIZE_CODE | String | 尺码编码 | 否 | 否 |
| SKC_CODE | String | SKC编码 | 否 | 否 |
| STATUS_CODE | String | 物料状态编码 | 否 | 否 |
| SUPPLIER_PRODUCT_CODE | String | 供应商商品条码 | 否 | 否 |
| SUPPLY_TYPE_CODE | String | 轻供类型编码 | 否 | 否 |
| CREATED_BY | String | 创建人 | 否 | 否 |
| LAST_UPDATED_BY | String | 最后更新人 | 否 | 否 |
| CREATION_DATE | String | 创建日期 | 否 | 否 |
| CREATION_DATE_START | String | 创建日期_开始时间 | 否 | 否 |
| CREATION_DATE_END | String | 创建日期_结束时间 | 否 | 否 |
| LAST_UPDATE_DATE | String | 最后更新日期 | 否 | 否 |
| LAST_UPDATE_DATE_START | String | 最后更新日期_开始时间 | 否 | 否 |
| LAST_UPDATE_DATE_END | String | 最后更新日期_结束时间 | 否 | 否 |
| ENABLED_DATE | String | 启用时间 | 否 | 否 |
| ENABLED_DATE_START | String | 启用时间_开始时间 | 否 | 否 |
| ENABLED_DATE_END | String | 启用时间_结束时间 | 否 | 否 |
| DISABLED_DATE | String | 禁用时间 | 否 | 否 |
| DISABLED_DATE_START | String | 禁用时间_开始时间 | 否 | 否 |
| DISABLED_DATE_END | String | 禁用时间_结束时间 | 否 | 否 |
| ENABLE_STATUS | String | 启用禁用 | 否 | 否 |
