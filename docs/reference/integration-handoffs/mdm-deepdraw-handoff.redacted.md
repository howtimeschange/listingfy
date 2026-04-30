# MDM & DeepDraw 对接交接说明（脱敏版）

来源：`MDM&深绘 (1).docx`

更新时间：2026-04-28

> 本文件是可提交到 GitHub 的脱敏版。原始交接文档已放在本地 `docs/reference/integration-handoffs/private/`，该目录已被 `.gitignore` 忽略。

## 敏感信息处理

以下内容存在于原始文档，但不写入本文件、不提交 GitHub：

- 深绘 `appKey`
- 深绘 `appSecret`
- 深绘 `dopKey`
- 深绘 `merchantId` 与品牌账号映射表
- MDM 测试/正式环境完整请求地址

实现时请通过环境变量、密钥管理服务或部署平台的凭据引用读取这些值。

## MDM 对接

### 接口用途

从 MDM 查询商品主数据，用于后续形成 Listingify 内部 `SPU -> SKC -> SKU` 主数据。

### 环境

原始文档给出了测试与正式环境地址；完整地址不提交 GitHub。建议在运行环境中配置：

```text
MDM_QUERY_MATE_SEARCH_TEST_URL=...
MDM_QUERY_MATE_SEARCH_PROD_URL=...
```

### 请求参数

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `serverCode` | `String` | 服务编码，必传 |
| `startUpdateDate` | `Date` | 变动开始时间 |
| `endUpdateDate` | `Date` | 变动结束时间 |
| `limit` | `Number` | 每页数量，必传 |
| `page` | `Number` | 页码，必传 |
| `headBrandDesc` | `String` | 品牌编码，必传 |

### 品牌编码

原始文档列出的品牌编码如下：

| 编码 | 品牌 |
| --- | --- |
| `10` | 森马 |
| `20` | 巴拉巴拉 |
| `23` | mini bala |
| `25` | 梦多多 |
| `28` | 森马儿童 |
| `33` | 亚瑟士 |
| `35` | 彪马儿童 |
| `50` | 马卡乐 |
| `61` | MOP |

### 请求示例（脱敏）

```json
{
  "serverCode": "ordermall1001",
  "startUpdateDate": "2026-04-20 00:00:00",
  "endUpdateDate": "2026-04-29",
  "limit": 300,
  "page": 1,
  "headBrandDesc": "28"
}
```

## DeepDraw 对接

### 接口用途

按商品编码读取深绘内容包，用于补充商品标题、详情页、图片、尺码表、颜色、属性和 SKU 相关内容。

### 调用注意

- 请求不要过于频繁，需要在同步任务中做限流。
- 凭据必须从环境变量或密钥管理中读取，不写入代码和文档。

### 配置项

| 配置项 | 说明 |
| --- | --- |
| `DEEPDRAW_BASE_URL` | 深绘开放平台地址 |
| `DEEPDRAW_APP_KEY` | 应用 key，敏感 |
| `DEEPDRAW_APP_SECRET` | 应用 secret，敏感 |
| `DEEPDRAW_DOP_KEY` | DOP key，敏感 |
| `DEEPDRAW_MERCHANT_ID` | 商户账号 ID，敏感 |
| `productCode` | 商品编码，必传 |

### Java SDK 调用示例（脱敏）

```java
ProductGetByIdRequest request = new ProductGetByIdRequest(
    System.getenv("DEEPDRAW_APP_KEY"),
    System.getenv("DEEPDRAW_APP_SECRET"),
    System.getenv("DEEPDRAW_DOP_KEY"),
    System.getenv("DEEPDRAW_BASE_URL")
);

request.setMerchantId(System.getenv("DEEPDRAW_MERCHANT_ID"));
request.setProductCode(productCode);

Reply reply = request.execute();
log.info(JSON.toJSONString(reply.getResponse().getBody()));
```

### SDK

SDK 已保存到：

```text
vendor/deepdraw-sdk/
```

包含：

- `dop-sdk-1.6.0.jar`
- `sdk-core-java-1.1.0.jar`

原始文档给出的 Maven 坐标：

```xml
<dependency>
  <groupId>com.dop</groupId>
  <artifactId>dop-sdk</artifactId>
  <version>1.6.0</version>
  <scope>compile</scope>
</dependency>
<dependency>
  <groupId>com.dop</groupId>
  <artifactId>sdk-core-java</artifactId>
  <version>1.1.0</version>
</dependency>
```

## 后续接入建议

1. 新增 MDM 同步配置，按更新时间窗口分页拉取。
2. 新增 DeepDraw 内容包同步配置，按商品编码拉取并做限流。
3. 将凭据配置在 `.env` 或部署密钥管理中，本仓库只保留变量名。
4. 同步任务保存原始 payload、同步批次、来源时间和 source hash。
5. 将 MDM 主数据和 DeepDraw 内容包统一映射到 Listingify 的 `product_spu`、`product_skc`、`product_sku`、`product_content_package`、`product_asset` 等模型。
