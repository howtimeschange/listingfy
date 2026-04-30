# 深绘内容包与图片同步说明

更新日期：2026-04-29

本文记录深绘商品内容包同步的当前联调结论，重点覆盖图片同步方式、同步内容、返回数据结构和后续入库建议。敏感凭据不写入本文档和仓库。

结构化落库模型见 `docs/deepdraw-content-data-model.md`。

## 当前结论

- 深绘图片不是通过独立图片列表接口同步，而是随商品内容包一起返回。
- 当前使用 SDK 中的 `ProductGetByIdRequest` 对应能力，按款号 `productCode` 拉取完整内容包。
- 图片入口在 `body.pictures` 和 `body.detalPages`。注意深绘返回字段名是 `detalPages`，不是 `detailPages`。
- 当前脚本只同步图片 URL 和元数据，不下载图片二进制文件。
- 深绘外部图片后续用于 SHEIN 发品时，需要走 SHEIN `transform-pic` 转成平台可用 URL。

## 脚本入口

已落地脚本：

```bash
npm run deepdraw:sync -- --tenant 电商巴拉巴拉 208226102001 208226103201
```

相关文件：

| 文件 | 说明 |
| --- | --- |
| `scripts/lib/deepdraw_client.mjs` | 深绘签名、凭据解析、GET 请求封装 |
| `scripts/deepdraw_product_sync.mjs` | 按款号同步深绘内容包并写入 `data/deepdraw-content/` |
| `scripts/lib/deepdraw_client.test.mjs` | 凭据解析和签名 canonical request 的单元测试 |
| `vendor/deepdraw-sdk/` | 交接包中的 Java SDK jar |

输出目录：

```text
data/deepdraw-content/<timestamp>/
  manifest.json
  products.raw.jsonl
  products.summary.jsonl
  sync-failures.jsonl
  products/
    <productCode>.json

data/deepdraw-content/latest-manifest.json
```

`data/deepdraw-content/` 已加入 `.gitignore`，只作为本地同步产物。

## 凭据配置

优先从环境变量读取：

| 变量 | 说明 |
| --- | --- |
| `DEEPDRAW_BASE_URL` | 默认 `http://open.deepdraw.cn` |
| `DEEPDRAW_APP_KEY` | 深绘 appKey |
| `DEEPDRAW_APP_SECRET` | 深绘 appSecret |
| `DEEPDRAW_DOP_KEY` | 深绘 dopKey |
| `DEEPDRAW_MERCHANT_ID` | 深绘租户账号 |
| `DEEPDRAW_TENANT_NAME` | 本地交接文档中的租户名称，默认 `电商巴拉巴拉` |
| `DEEPDRAW_CREDENTIAL_DOC` | 本地私有交接文档路径 |
| `DEEPDRAW_SYNC_DELAY_MS` | 款号之间的请求间隔，默认 800ms |
| `DEEPDRAW_TIMEOUT_MS` | 单请求超时，默认 30000ms |

如果环境变量未提供完整凭据，本地脚本会尝试读取：

```text
docs/reference/integration-handoffs/private/MDM&深绘 (1).docx
```

该目录被 `.gitignore` 忽略，仅用于本地联调。

## 请求方式

SDK 入口：

```java
ProductGetByIdRequest request = new ProductGetByIdRequest(appKey, appSecret, dopKey, baseUrl);
request.setMerchantId(merchantId);
request.setProductCode(productCode);
Reply reply = request.execute();
```

当前 Node 脚本复刻 SDK 请求：

| 项 | 值 |
| --- | --- |
| Method | `GET` |
| URL | `http://open.deepdraw.cn/rest/v2` |
| type | `dp.product.resource` |
| 必传 query | `dopKey`, `type`, `merchantId`, `productCode` |
| 签名算法 | Aliyun CloudAPI 风格 `HmacSHA256` |

query 示例，值仅示意：

```text
/rest/v2?dopKey=<dopKey>&merchantId=<merchantId>&productCode=208226102001&type=dp.product.resource
```

签名请求头包含：

| Header | 说明 |
| --- | --- |
| `accept` | `application/json; charset=utf-8` |
| `content-type` | `application/x-www-form-urlencoded; charset=utf-8` |
| `date` | HTTP date |
| `host` | `open.deepdraw.cn` |
| `x-ca-key` | appKey |
| `x-ca-nonce` | UUID |
| `x-ca-timestamp` | 毫秒时间戳 |
| `x-ca-signature-method` | `HmacSHA256` |
| `x-ca-signature-headers` | 签名 header 列表 |
| `x-ca-signature` | HMAC-SHA256 + base64 |
| `CA_VERSION` | `1` |

成功响应特点：

```json
{
  "code": 10200,
  "response": "success",
  "reason": "访问成功！",
  "body": {}
}
```

注意 `10200` 是本次联调确认的深绘成功业务码，不是常见的 `0`。

## 同步内容

每个商品内容包顶层结构：

| 字段 | 说明 |
| --- | --- |
| `code` | 深绘业务响应码 |
| `response` | `success` / `fail` |
| `reason` | 业务说明 |
| `requestId` | 深绘响应中的 request id，样例中为 `-1`；HTTP header 里也有 `x-ca-request-id` |
| `timestamp` | 响应时间戳 |
| `body` | 商品内容包主体 |

`body` 常见字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `brandName` | string | 品牌 |
| `code` | string | 款号 / 深绘商品编码 |
| `productId` | number | 深绘商品数字 ID |
| `id` | string | 深绘内容包 ID，常用于资源 URL 路径 |
| `title` | string | 商品标题 |
| `retailPrice` | string | 零售价 / 吊牌价 |
| `primaryColor` | string | 主色别名 |
| `complete` | boolean | 内容包是否完整 |
| `version` | number | 深绘版本号 |
| `createDate` / `lastUpdateDate` / `onsaleDate` | number | 毫秒时间戳 |
| `trade` | object | 深绘行业类目信息 |
| `places` | array | 适配渠道列表 |
| `colors` | object | 颜色选项和颜色别名 |
| `sizes` | object | 尺码选项和尺码别名 |
| `skus` | object | SKU 维度信息 |
| `pictures` | object | 图片分组 |
| `detalPages` | array | 详情页模板和截图 |
| `sizeTables` | array | 尺码表结构化数据 |
| `fields` | array | 深绘字段池，包含标题、属性、卖点、平台字段等 |

## 商品图片结构

商品图片在：

```text
body.pictures.pictures[place].pictures[pictureType][]
```

示意结构：

```json
{
  "pictures": {
    "TMALL": {
      "place": "TMALL",
      "pictures": {
        "HOME": [
          {
            "id": 688265488,
            "name": "xxx.jpg",
            "url": "//product.resources.deepdraw.biz/.../original/xxx.jpg",
            "skc": "20822610200100311",
            "color": "雅致白00311",
            "width": "800",
            "height": "800",
            "size": "83231",
            "sortNum": 1,
            "withWatermark": false
          }
        ]
      }
    }
  }
}
```

图片对象字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 深绘图片 ID |
| `name` | 文件名 |
| `url` | 图片 URL，常见为 `//product.resources.deepdraw.biz/...` 协议相对地址 |
| `skc` | 款色编码，可用于绑定 SKC |
| `color` | 深绘颜色别名 |
| `width` / `height` | 图片尺寸，字符串数字 |
| `size` | 文件大小，字符串数字，单位按字节处理 |
| `sortNum` | 同类型排序 |
| `withWatermark` | 是否带水印 |

URL 处理规则：

- `url` 以 `//` 开头时，入库前统一补协议，例如 `http:`。
- 同一张图片可能在多个 `place` 下重复出现，不能只按行数判断真实图片数量。
- 需要同时保留 `place`、`pictureType`、`skc`、`color`，否则后续无法追溯图片原始用途。

当前样例出现的渠道：

```text
WEIXINXIAODIAN, TAOBAO, AIKUCUN, XIAOHONGSHU, YOUZAN,
DANGDANG, TMALL, KUAISHOU, PDD, ALIBABA, JD, VIP, HAOYK, DOUYIN
```

当前样例出现的图片类型：

| 深绘图片类型 | 含义判断 | Listingify 初始归类建议 |
| --- | --- | --- |
| `HOME` | 渠道主图/展示图 | `MAIN` 或 `DETAIL`，按 SHEIN 图片位再筛选 |
| `HOME_SUBSIDIARY` | 主图辅图 | `DETAIL` |
| `COLOR` | 颜色/SKC 图片 | `COLOR_BLOCK` 或 SKC 详情图，需人工/规则确认 |
| `WHITE_BACKGROUND` | 白底图 | `MAIN` 候选 |
| `TRANSPARENCY` | 透明底图 | `SQUARE` 或 `MAIN` 候选 |
| `VERTICAL` | 竖图 | `DETAIL` |
| `VIDEO_HOME` | 视频封面或视频主素材 | `VIDEO` 或视频封面 |
| `QUALIFICATION` | 资质/合规图 | 不默认发品，保留 raw_payload |
| `CERTIFICATE` | 证书/合规图 | 不默认发品，保留 raw_payload |

上述映射是入库初始建议，不等同于 SHEIN 最终图片位。SHEIN 侧仍需结合类目 `picture_config_list` 和发布字段规范判断必填图片。

## 详情页图片结构

详情页在：

```text
body.detalPages[]
```

常见字段：

| 字段 | 说明 |
| --- | --- |
| `templateName` | 深绘详情页模板名 |
| `templateWidth` | 模板宽度 |
| `templateSites` | 支持渠道 |
| `active` | 是否启用 |
| `time` | 模板生成时间 |
| `htmlPageUrl` | HTML 详情页 |
| `imagePageUrl` | 图片版详情页 |
| `mixedPageUrl` | 混合版详情页 |
| `screenShotSectionUrls` | 截图切片 URL 数组 |
| `modules` | 按详情模块分组的截图 URL |

样例模块：

| 模块 | 说明 |
| --- | --- |
| `穿搭效果` | 模特/穿搭展示 |
| `商品信息` | 商品信息模块 |
| `细节展示` | 商品细节图 |
| `配件` | 配件/搭配图 |
| `商品展示` | 静物或商品展示 |

详情页 URL 多为完整 `http://product.resources.deepdraw.biz/...`。后续可把 `screenShotSectionUrls` 和 `modules` 中的 URL 作为 `DETAIL_PAGE` 类型素材入库。

## 尺码表结构

尺码表在：

```text
body.sizeTables[]
```

常见结构：

```json
{
  "field": {
    "id": "1705",
    "name": "尺码表",
    "type": "MULTI_TEXT"
  },
  "options": ["胸围", "袖长", "肩宽"],
  "optionAliases": {},
  "sizeTableItems": [
    {
      "size": "80cm",
      "values": {
        "胸围": "63.5",
        "袖长": "27.5"
      }
    }
  ]
}
```

当前样例通常包含：

- 通用 `尺码表`
- `唯品会尺码表`
- `天猫尺码表`，样例中可能 0 行
- `抖音尺码表`

尺码表本身不是图片 URL。后续如果平台需要尺码表图，应从结构化数据渲染图片，或使用深绘详情页中的尺码相关截图。

## SKU 结构

SKU 在：

```text
body.skus.skuItems[]
```

每条 SKU：

```json
{
  "color": "米白",
  "size": "80cm",
  "values": {
    "货号": "208226102001",
    "单品货号": "6900137868198",
    "商家编码": "6900137868198",
    "小红书商家编码": "20822610200100311080",
    "价格": "169"
  }
}
```

当前样例中两个款号都是 2 色 x 6 尺码，共 12 条 SKU。`values` 中有各渠道价格、条码、商家编码、上市时间、数量等字段。

## fields 字段池

`body.fields[]` 是深绘字段池，字段形态统一为：

```json
{
  "field": {
    "id": "79469",
    "name": "品牌",
    "type": "TEXT",
    "options": []
  },
  "texts": ["巴拉巴拉(Balabala)"],
  "options": [],
  "optionAliases": {}
}
```

字段类型样例：

| 类型 | 说明 |
| --- | --- |
| `TEXT` | 单值文本 |
| `MULTI_TEXT` | 多值文本 |
| `SINGLE_CHOICE` | 单选 |
| `MULTI_CHOICE` | 多选 |

`fields` 中包含大量空字段。抽取时应以 `texts.length > 0` 或 `options.length > 0` 判断有效值，不要仅凭字段对象存在判断已填写。

后续生成 listing 草稿时优先关注：

- 标题：小红书标题、抖音标题、快手标题、唯品会标题、导购短标题
- 属性：品牌、适用性别、适用年龄、适用季节、风格、图案、厚薄
- 材质：材质、面料、材质成分、主面料成分含量、详情页面料
- 卖点：宝贝卖点、天猫商品卖点、有赞商品卖点、推荐理由
- 平台字段：发货方式、限购、市场价、参考价格类型、商品重量

## 入库建议

### product_content_package

建议按款号保存一条内容包：

| 目标字段 | 来源 |
| --- | --- |
| `source_system` | 固定 `DEEPDRAW` |
| `source_code` | `body.code` |
| `spu_code` | `body.code` |
| `title_cn` | `body.title`，或从 `fields` 中平台标题补充 |
| `brand_name` | `body.brandName` |
| `category_name` | `body.trade.name` |
| `trade_path` | `body.trade.path` |
| `colors` | `body.colors` |
| `fields` | `body.fields` |
| `size_tables` | `body.sizeTables` |
| `detail_pages` | `body.detalPages` |
| `sku_items` | `body.skus.skuItems` |
| `raw_payload` | 完整响应 |
| `version` | `body.version` |
| `synced_at` | 当前同步时间 |

幂等键建议：

```text
source_system + source_code
```

如果要保留历史版本，则额外引入 `version` 或 `source_hash`。

### product_asset

商品图片建议从两个来源抽取：

1. `body.pictures.pictures[place].pictures[pictureType][]`
2. `body.detalPages[].screenShotSectionUrls` 和 `body.detalPages[].modules`

图片入库字段建议：

| 目标字段 | 来源 |
| --- | --- |
| `owner_type` | 有 `skc` 时优先绑定 `SKC`，详情页可绑定 `SPU` 或 `CONTENT_PACKAGE` |
| `owner_id` | 对应本地 SPU/SKC/content package id |
| `asset_type` | 按图片类型初步映射为 `MAIN` / `DETAIL` / `COLOR_BLOCK` / `DETAIL_PAGE` / `VIDEO` 等 |
| `source_system` | 固定 `DEEPDRAW` |
| `source_url` | 深绘图片 URL，入库前补全协议 |
| `width` / `height` | 图片对象中的 `width` / `height` |
| `file_size` | 图片对象中的 `size` |
| `sort_no` | 图片对象中的 `sortNum` 或详情页数组顺序 |
| `status` | 初始 `PENDING`，SHEIN 转换成功后更新 |
| `platform_url` | SHEIN `transform-pic` 返回后填充 |
| `raw_payload` | 保留 `place`, `pictureType`, `skc`, `color`, `deepdraw id`, `withWatermark`, `moduleName` 等 |

去重建议：

- 物理图片可按规范化后的 `source_url` 去重。
- 但同一 URL 可能服务多个 `place` 或 `pictureType`，用途关系不要丢。
- 可以用图片资产表保存唯一图片，再用关联表或 `raw_payload.usages` 保留多用途；MVP 也可以先按用途多行入库。

### listing_asset

生成 SHEIN 草稿时不要直接把所有深绘图片塞进发布 payload，应先：

1. 根据 MDM / 深绘 / 人工图片包合并 SKC。
2. 读取 SHEIN 类目图片规则 `picture_config_list`。
3. 从深绘图片中挑选候选，例如白底图、主图、细节图、详情页图。
4. 对深绘外链调用 SHEIN `transform-pic`。
5. 写入 `listing_asset`，记录来源为 `DEEPDRAW`。

第一期产品原则仍是：人工上传 SKC 图片包作为发品主来源，深绘主图和详情页作为补充来源。

## 当前样例统计

2026-04-29 使用 `电商巴拉巴拉` 租户联调过两个款号：

| 款号 | 类目 | SKU | 图片行数 | 唯一图片 URL | 详情页截图 | 尺码表 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `208226102001` | 衬衫 | 12 | 155 | 153 | 29 | 4 |
| `208226103201` | 毛衣 | 12 | 161 | 152 | 29 | 4 |

两款均返回 `code=10200`、`response=success`、`body.complete=true`。

## 注意事项

- 深绘交接文档提醒请求不要过于频繁；脚本默认每个款号间隔 800ms。
- Java SDK jar 已保留，但当前 Node 脚本不依赖本机 Java runtime。
- `body.detalPages` 字段名拼写固定按深绘返回处理。
- 图片 URL 可能是协议相对地址，前端展示和 SHEIN 转换前要补协议。
- `fields` 中空字段很多，抽取时要过滤空 `texts` / `options`。
- 图片类型和 SHEIN 图片位不是一一对应关系，必须结合 SHEIN 类目图片规则和人工补齐结果再决定最终发布素材。
