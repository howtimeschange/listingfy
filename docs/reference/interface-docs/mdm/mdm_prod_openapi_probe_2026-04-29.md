---
title: MDM 正式环境开放接口联调记录
doc_type: integration_probe
object_type: common
generated_at: 2026-04-29
environment: prod
base_url: https://mdm.semirapp.com
---

# MDM 正式环境开放接口联调记录

## 范围

本记录用于沉淀 2026-04-29 对 `mdm.semirapp.com` 正式环境开放接口的联调经验，覆盖 token 获取、SPU/SKU 查询、与测试环境联调结果的差异。

凭据处理原则：

- 正式环境 `APP_ID`、`APP_KEY` 和接口返回 token 不写入文档、不落盘、不打印完整值。
- 后续工程实现必须通过环境变量或密钥管理读取正式环境凭据。
- 业务方提供的 curl 示例中，`APP_KEY` 后带有中文分号；联调时按 32 位 key 本身处理，未将中文分号作为密钥字符。

## 接口链路

### 1. 获取 token

```bash
curl --location --request GET \
  "https://mdm.semirapp.com/demdm-api/open/api/getToken?APP_ID=${MDM_APP_ID}&APP_KEY=${MDM_APP_KEY}"
```

本次返回结果：

| 项 | 结果 |
| --- | --- |
| HTTP 状态 | `200` |
| `code` | `ok` |
| `message` | `OBTAIN_SUCCESS` |
| token 有效期 | `3600000` |
| 有效期单位 | `MILLISECONDS` |

### 2. 查询 SPU

接口：

```text
POST https://mdm.semirapp.com/demdm-api/open/api/v2/selectApi/SAP_SPU
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
  "PAGE_SIZE": "50",
  "FORM_CODE": "PRODUCT_SPU",
  "DATA": {
    "MDM_CODE": "208226102001"
  }
}
```

### 3. 查询 SKU

接口：

```text
POST https://mdm.semirapp.com/demdm-api/open/api/v2/selectApi/SKU_LIST
```

请求头同 SPU 查询。

请求体示例：

```json
{
  "UUID": "request-uuid",
  "PAGE": "1",
  "PAGE_SIZE": "50",
  "FORM_CODE": "PRODUCT_SKU",
  "DATA": {
    "MDM_CODE": "208226102001"
  }
}
```

## 本次验证结果

本次按款号 `208226102001`、`208226103201` 联调，正式环境均可命中。

| 对象 | 查询字段 | 查询值 | HTTP 状态 | MDM 结果 | 命中条数 | 摘要 |
| --- | --- | --- | --- | --- | --- | --- |
| SPU | `MDM_CODE` | `208226102001` | `200` | `S / QUERY_SUCCESS` | `1` | 巴拉巴拉，2026 Q2，幼童服装，长袖衬衫 / 梭织长袖衬衫，女，幼童，活动 |
| SKU | `MDM_CODE` | `208226102001` | `200` | `S / QUERY_SUCCESS` | `12` | 示例 SKC：`20822610200100311`，颜色：白色调00311，尺码含 `080` 起 |
| SPU | `MDM_CODE` | `208226103201` | `200` | `S / QUERY_SUCCESS` | `1` | 巴拉巴拉，2026 Q2，幼童服装，毛衫 / 开襟毛衫，中性，幼童，活动 |
| SKU | `MDM_CODE` | `208226103201` | `200` | `S / QUERY_SUCCESS` | `12` | 示例 SKC：`20822610320100313`，颜色：白黄色调00313，尺码含 `080` 起 |

## 与测试环境结果的差异

同样的 token + `selectApi` 查询方式，在测试环境 `https://mdm-dev.semirapp.com` 对上述两个款号返回 `QUERY_SUCCESS` 但 `DATA=[]`；正式环境 `https://mdm.semirapp.com` 可以命中 SPU 和 SKU。

这说明 2026-04-29 的测试环境问题更可能是数据未同步或数据范围缺失，而不是请求格式、鉴权头或 `FORM_CODE` 配置问题。

## 当前结论

- 正式环境 token 获取链路可用。
- 正式环境 SPU 查询链路可用，`FORM_CODE=PRODUCT_SPU`、`DATA.MDM_CODE=<款号>` 可命中 SPU。
- 正式环境 SKU 查询链路可用，`FORM_CODE=PRODUCT_SKU`、`DATA.MDM_CODE=<款号>` 可返回该款号下 SKU 明细。
- `PAGE_SIZE=50` 足够覆盖本次两个款号各 12 条 SKU；后续实现仍应按 `LAST_PAGE` 做分页兜底。
- MDM 接口返回业务状态在响应体中，工程实现仍必须同时检查 HTTP 状态和 `RESULT / MESSAGE / ERROR_CODE`。

## 后续接入建议

1. 环境配置区分：
   - 测试：`MDM_BASE_URL=https://mdm-dev.semirapp.com`
   - 正式：`MDM_BASE_URL=https://mdm.semirapp.com`
2. 正式环境凭据只进部署密钥，不提交仓库。
3. 建议先实现只读查询客户端，并以 `208226102001`、`208226103201` 作为人工联调样例。
4. 数据同步落库时，SPU 用 `MDM_CODE` 作为款号主键；SKU 用 `SKU_CODE` 作为 SKU 主键，`SKC_CODE` 作为颜色维度归组字段。
5. 对测试环境继续向 MDM 侧确认数据同步范围；不能用测试环境空数据否定接口格式。
