---
title: MDM 测试环境开放接口联调记录
doc_type: integration_probe
object_type: common
generated_at: 2026-04-29
environment: dev
base_url: https://mdm-dev.semirapp.com
---

# MDM 测试环境开放接口联调记录

## 范围

本记录用于沉淀 2026-04-29 对 `mdm-dev.semirapp.com` 测试环境开放接口的联调经验，覆盖 token 获取、SPU/SKU 查询、请求格式验证和当前数据命中情况。

凭据处理原则：

- `APP_KEY` 和接口返回 token 属于敏感信息，不写入文档、不落盘、不打印完整值。
- 本次联调使用业务方临时提供的测试环境 `APP_ID / APP_KEY`，后续工程实现应改为环境变量或密钥管理读取。

## 接口链路

### 1. 获取 token

```bash
curl --location --request GET \
  "https://mdm-dev.semirapp.com/demdm-api/open/api/getToken?APP_ID=${MDM_APP_ID}&APP_KEY=${MDM_APP_KEY}"
```

本次返回结果：

| 项 | 结果 |
| --- | --- |
| HTTP 状态 | `200` |
| `code` | `ok` |
| `message` | `OBTAIN_SUCCESS` |
| token 有效期 | `3600000` |
| 有效期单位 | `MILLISECONDS` |

注意：token 有效期约 1 小时，工程实现建议缓存 55 分钟以内，并在接口返回鉴权失败时强制刷新。

### 2. 查询 SPU

接口：

```text
POST https://mdm-dev.semirapp.com/demdm-api/open/api/v2/selectApi/SAP_SPU
```

请求头：

```text
content-type: application/json
demdmtoken: ${MDM_TOKEN}
```

请求体示例：

```json
{
  "UUID": "request-uuid",
  "PAGE": "1",
  "PAGE_SIZE": "20",
  "FORM_CODE": "PRODUCT_SPU",
  "DATA": {
    "MDM_CODE": "208226102001"
  }
}
```

### 3. 查询 SKU

接口：

```text
POST https://mdm-dev.semirapp.com/demdm-api/open/api/v2/selectApi/SKU_LIST
```

请求头同 SPU 查询。

请求体示例：

```json
{
  "UUID": "request-uuid",
  "PAGE": "1",
  "PAGE_SIZE": "20",
  "FORM_CODE": "PRODUCT_SKU",
  "DATA": {
    "MDM_CODE": "208226102001"
  }
}
```

## 本次验证结果

本次按款号 `208226102001`、`208226103201` 联调，结果如下：

| 对象 | 查询字段 | 查询值 | HTTP 状态 | MDM 结果 | 命中条数 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| SPU | `MDM_CODE` | `208226102001` | `200` | `S / QUERY_SUCCESS` | `0` | 请求格式可用，但无数据 |
| SPU | `MDM_CODE` | `208226103201` | `200` | `S / QUERY_SUCCESS` | `0` | 请求格式可用，但无数据 |
| SKU | `MDM_CODE` | `208226102001` | `200` | `S / QUERY_SUCCESS` | `0` | 请求格式可用，但无数据 |
| SKU | `MDM_CODE` | `208226103201` | `200` | `S / QUERY_SUCCESS` | `0` | 请求格式可用，但无数据 |

补充探测：

- SPU 用 `OLD_ARTICLE_NUMBER`、`ORIGINAL_PRODUCT_CODE` 查询上述两个完整款号和短款号 `208226102`、`208226103`，接口返回成功但 `DATA=[]`。
- SKU 用 `SKU_CODE` 查询上述两个完整款号和短款号，接口返回成功但 `DATA=[]`。
- SKU 用 `SKC_CODE`、`SUPPLIER_PRODUCT_CODE`、`INNER_CODE` 查询时，单次 8 秒超时，不能作为有效命中结论。
- 使用 `FORM_CODE=SAP_SPU` 或 `FORM_CODE=SKU_LIST` 会返回 `RESULT=E`、`MODEL_API_CONFIG_NULL`，说明请求体里的 `FORM_CODE` 必须使用文档中的 `PRODUCT_SPU / PRODUCT_SKU`，不能使用路径里的模型名。

## 与交接文档老接口的关系

项目交接文档中还有一套旧查询链路：

```text
https://mdm-test.semirapp.com/oapi/mate/ordermall1001/queryMateSearch
```

该接口与本次开放接口不是同一套协议：

| 项 | 开放接口 | 老查询接口 |
| --- | --- | --- |
| 测试域名 | `mdm-dev.semirapp.com` | `mdm-test.semirapp.com` |
| 鉴权方式 | 先 `getToken`，再用 `demdmtoken` 请求头 | 交接示例未体现 token |
| 查询方式 | `selectApi/SAP_SPU`、`selectApi/SKU_LIST` | `queryMateSearch` |
| 参数模型 | `FORM_CODE + DATA` | `serverCode + page + limit + headBrandDesc + date range` |

本次用老接口按品牌 `20 / 28 / 10`、日期 `2026-04-01` 到 `2026-04-29` 探测，也返回 `count=0`，未命中 `208226102001`、`208226103201`。

## 当前结论

- 测试环境 token 获取链路可用。
- 开放接口 SPU/SKU 查询链路可用，且 `demdmtoken` 请求头、`FORM_CODE=PRODUCT_SPU / PRODUCT_SKU` 的格式已验证。
- 两个指定款号在本次测试环境查询中未命中数据。更可能的原因是测试环境未同步这两条主数据，或业务给出的编码不是开放接口里的 `MDM_CODE` 粒度。
- MDM 接口即使业务失败也可能返回 HTTP `200`，工程实现不能只看 HTTP 状态，必须检查响应体 `RESULT / MESSAGE / ERROR_CODE`。

## 后续接入建议

1. 配置项使用环境变量：`MDM_BASE_URL`、`MDM_APP_ID`、`MDM_APP_KEY`，不要把密钥写入代码和文档。
2. token 缓存在服务端内存或密钥缓存中，日志里只允许打印 token 前后少量脱敏字符。
3. SPU/SKU 查询客户端应统一处理：
   - HTTP 非 2xx；
   - `RESULT !== "S"`；
   - `DATA` 非数组；
   - 空数据但接口成功。
4. 在 MDM 侧确认 `208226102001`、`208226103201` 是否已存在于测试环境，以及应按 `MDM_CODE`、`SKU_CODE`、`SKC_CODE` 还是其他字段查询。
5. 确认数据存在后，再补一条真实命中的样例记录，用于后续开发和自动化测试对照。
