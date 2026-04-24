---
title: MDM SKU 批量保存接口
doc_type: batch_save_api
object_type: sku
generated_at: 2026-04-21
source_files:
  - /Users/xingyicheng/Downloads/批量保存接口 (1).docx
endpoint: https://mdm.semirapp.com/demdm-api/open/api/v2/saveOrUpdateApi/SKU_LIST
method: POST
---

# MDM SKU 批量保存接口

## 元信息

- 对象类型: `sku`
- 接口类型: `batch_save_api`
- 接口地址: `https://mdm.semirapp.com/demdm-api/open/api/v2/saveOrUpdateApi/SKU_LIST`
- 请求方式: `POST`
- 原始文件: `/Users/xingyicheng/Downloads/批量保存接口 (1).docx`

## 文档正文

### 接口报文示例

#### 请求报文示例

- 可见键集合: `PUUID, DATA`

#### 响应报文示例

- 可见键集合: `PUUID, RESULT, MESSAGE, ERROR_CODE, DATA`

### 请求头

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| demdmtoken | String | 用于请求的token | 是 | 否 |

### 请求参数

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| PUUID | String | 批次的UUID接口的唯一标识 | 是 | 否 |
| DATA | List<PRODUCT_SKU> | PRODUCT_SKU | 是 | 否 |

### PRODUCT_SKU说明

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| UUID | String | 单条报文UUID接口的唯一标识 | 是 | 否 |
| FORM_CODE | String | PRODUCT_SKU | 是 | 否 |
| CREATED_ID | String | 创建人ID | 否 | 否 |
| UPDATED_ID | String | 更新人ID | 否 | 否 |

### 响应结果

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| PUUID | String | 批次的UUID接口的唯一标识 | 是 | 否 |
| DATA | List<PRODUCT_SKU> | PRODUCT_SKU | 是 | 否 |
| RESULT | String | 响应结果编码；S代表的是接口调用成功,E代表的是接口调用失败（注意，此结果只代表接口调用，具体数据是否调用成功，需要查看DATA中具体的业务对象返回的RESULT结果） | 是 | 否 |
| MESSAGE | String | 响应结果描述 | 否 | 否 |
| ERROR_CODE | String | 失败编码 | 否 | 否 |

### DATA说明

| 参数名称 | 参数类型 | 参数说明 | 是否必填 | 是否唯一 |
| --- | --- | --- | --- | --- |
| UUID | String | 单条报文UUID接口的唯一标识 | 是 | 否 |
| RESULT | String | 响应结果编码 | 是 | 否 |
| MESSAGE | String | 响应描述 | 否 | 否 |
| ERROR_CODE | String | 失败编码 | 否 | 否 |
| MDM_CODE | String | 主数据编码，指定返回的字段 | 是 | 否 |
