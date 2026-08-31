# 深绘 test5 多平台尺码排查交接（2026-08-31）

## 最终线上状态

- Listingify 草稿：`997`
- 款号：`204426140121-test5`
- 类目：`546`（童鞋/亲子鞋 / 运动鞋）
- 深绘产品：`6516955`
- 草稿状态：`readback_verified`
- 最终创建方式：创建时省略 `多平台尺码`，创建成功后再完整更新唯品会、天猫、抖音等平台尺码表。
- 已回读一致：15 个销售尺码、30 个 SKU、主尺码表 15 行、唯品会尺码表 15 行、天猫尺码表 15 行、抖音尺码表 15 行。
- 未完成：深绘产品 `6516955` 中仍没有 `多平台尺码`。创建完成后用户曾再次明确授权多轮仅更新该字段的探针，v2 增量、v1 最小平台表、v1 裸行键、PDF 第 24 页 literal 表体均为 `10499`；探针后资源回读显示原有销售尺码、SKU 和四张结构表未被破坏。

## test5 资料一致性

test5 从 `204426140121` 完整复制，创建前检查结果：

- 324 个草稿字段
- 30 个 SKU
- 1 张图片
- SPU、SKC、SKU、来源行、草稿 SKU、图片逐层对齐
- `payloadIssues=[]`
- SDK `checkColor/checkSizes/checkSizeTable/checkSkus` 全部通过

## 最新 API 与 tradeId 546 证据

以 `docs/reference/interface-docs/深绘开放平台API接口文档20260827.pdf` 和 `dop-sdk-1.6.24.jar` 为准：

- PDF 第 21、23 页的创建/更新示例均使用 `product.addProductField("多平台尺码", createMultiPlatformSizes())`。
- 平台通过多平台表的 `title` 表达；文档没有额外的“启用多平台尺码”API 参数。
- PDF 第 24 页的 `createSizeTable` 与 `createMultiPlatformSizes` 方法体明显写反，不能照抄方法名判断表形状。
- `所在地` 格式是 `省,市`，本轮发送 `浙江,杭州`。
- `售后服务承诺` 格式是 `选项索引_天数`，本轮发送 `2_90`。
- PDF 仅在资源回读中说明 `sizes.optionAliases` 和 `sizes.texts`；创建/更新示例没有尺码别名或尺码备注写入方法。
- SDK 1.6.24 的创建 `Product` 仅公开基础属性、`places`、`productFields` 和 `addProductField`，没有写入 `sizes.optionAliases/texts` 的方法。
- 2026-09-01 用本地 JDK 8 `javap` 复核 SDK 1.6.24：`ProductPostCreateProductRequest`、`ProductPostUpdateProductByIdRequest`、`ProductIncrementalUpdateRequest` 均只接收 `cn.deepdraw.api.rest.entity.Product`；写入实体 `Product` 不存在 `setSizes/setTexts/setOptionAliases`，只有 `setProductFields/addProductField`。`AllInOneProduct/DpFieldValue` 虽有 `setSizes/setTexts`，但属于资源/模型对象，不是当前 v1/v2 写入请求对象。
- SDK `Product.checkSizeTable()` / `checkVipSizeTable()` 的字节码显示，它们通过 `sizeSalePropFields` 找 `尺码/尺码规格/规格尺码/规格/尺寸规格/商品规格/尺寸/规格尺码/含量/产品规格` 等销售尺码字段，再逐个校验尺码表行键是否包含在销售尺码集合中；因此 `checkSizeTable=false` 是本地 SDK 校验结果，不等于深绘服务端业务码。

实时调用 `dp.trade.fields` 拉取 tradeId 546：

- `多平台尺码`：`MULTI_TEXT`，非必填，合法选项为淘宝、天猫、京东、拼多多、微信视频小店、小红书、得物、快手。
- `尺码表`：`MULTI_TEXT`，必填；支持鞋长、适合脚长、鞋内长等列。
- `唯品会尺码表` 必填列为脚长、鞋内长；抖音尺码表必填列为脚长(cm)，可选备注；天猫尺码表必填脚长、鞋内长。

## 真实尝试矩阵

所有失败请求均为 HTTP 200、深绘业务码 `10499`；失败后没有产品 ID。

1. 创建前草稿选择京东、拼多多、小红书、快手、微信视频小店；创建同时发送五列表格：失败。
2. 复刻历史成功产品形状，只发 `JD/PDD/XIAOHONGSHU/WEIXINXIAODIAN`，PDD/小红书/微信使用带括号鞋码文本：失败。
3. 缩小为 JD 单列、15 行裸数字：失败。
4. 完全省略 `多平台尺码`：创建成功为产品 `6516955`；后置更新和完整回读成功。

结论：创建前是否在 Listingify 选择平台不是唯一原因；当前开放 API 路径只要包含 `多平台尺码` 就稳定触发 `10499`。平台代码、五列/四列/JD 单列、PDD 括号文本均已排除。

## 创建成功后的单字段增量复核

这次真实探针发生在修订前的本地提交 `c5cc8ff` 之后，现补录进提交证据：

- 修订前提交时间：2026-08-31 19:13:23 +08:00。
- 线上日志时间：`2026-08-31T11:19:23.922Z`，即 2026-08-31 19:19:23.922 +08:00。
- 目标：Listingify 草稿 `997`、款号 `204426140121-test5`、深绘产品 `6516955`、内部 ID `3b6023ce4e844e138c25f92e9af1e227`。
- 接口：`dp.product.incremental.update` v2，SDK 1.6.24。
- 单一变量：`productFields` 仅包含 `多平台尺码`；为避免 SDK 清空已选平台，产品原有 `places` 集合原样携带。
- 表格：表头 `JD,PDD,XIAOHONGSHU,KUAISHOU,WEIXINXIAODIAN`，共 15 行，对应尺码 26-40。
- 返回：HTTP `200`，深绘业务码 `10499`，原因为 `访问接口的时候发生未知异常：数据格式错误或校验失败`。
- 结果回读：`多平台尺码` 仍不存在；销售尺码 15 个、SKU 30 个、主尺码表 15 行、唯品会尺码表 15 行、天猫尺码表 15 行、抖音尺码表 15 行均保持不变，草稿状态仍为 `readback_verified`。
- 日志摘要：`probeMode=v2_incremental_sdk_1_6_24_multi_platform_only_after_test5_create`，`fieldNames=["多平台尺码"]`。

因此，最新版 SDK 的 v2 单字段增量接口也未得到可回读的写入结果；HTTP 200 只代表传输成功，不能视为多平台尺码更新成功。

## 历史成功证据

- `208426140203 / 6513943`：主尺码表含 `鞋长: 26`（回读别名 `鞋长 -> 尺码`），多平台尺码 15 行成功存在。
- `208426140204 / 6511943`：tradeId 546，多平台尺码 15 行成功存在。
- `204426140121-test3 / 6516628`：省略多平台尺码后成功创建；主表及唯品会/天猫/抖音可成功写入。

因此，不能把主尺码表增加“尺码/鞋长”列认定为本次失败根因；已有历史产品证明该形状可存在并成功回读。

## 本地代码改动

- 鞋品多平台尺码生成时把平台选择同步到 `value_text`；服饰同步京东。
- 字段填充页在“多平台尺码”选择项下显示具体尺码 × 平台表格、平台数、尺码数和已填项数。
- 鞋品主尺码表生成行标签保留 `26码`，值列使用裸数字；多平台、唯品会、天猫、抖音按业务规则生成。
- 构造鞋品尺码备注数据，但不把备注拼进销售尺码身份；公开创建 API 尚无已证实写法。
- 所在地规范成 `省,市`；售后服务承诺规范成 `0`、`1_天数`、`2_天数`。
- 鞋品创建阶段只携带主尺码表；创建后完整更新阶段发送主表、唯品会、天猫、抖音。多平台尺码正常发布默认不发送，仅探针脚本显式放行。服饰按图 1 规则在草稿侧生成京东裸尺码多平台表：行键带 `cm/码`，京东单元格不带单位，但正常发布同样暂不发送。
- 主尺码表回读比较兼容本地列名“尺码”与深绘回读列名“鞋长”。
- SDK 从 1.6.0 更新为 1.6.24，并让 Java 编译缓存感知 JAR 修改时间。

## 2026-09-01 最小请求干跑

新增只读优先探针脚本：`scripts/deepdraw_multi_platform_size_probe.mjs`。

- 默认模式为 dry-run，只设置 `DEEPDRAW_SDK_DUMP_REQUEST=1`，不调用深绘。
- 线上写入必须同时满足 `--execute` 和 `DEEPDRAW_LIVE_WRITE=1`，且款号必须为 `-test` 后缀。
- 鞋品 update 最小请求：`dp.product.update` v1，query 携带数值产品 ID；探针脚本显式 `includeMultiPlatformSizeField` 时，`productFields` 仅包含 `尺码` 与 `多平台尺码`。SDK 默认按用户最新假设发送 `尺码=26码;27码;...;40码`，`多平台尺码.title=JD,PDD,WEIXINXIAODIAN`，15 行行键为 `26码` 到 `40码`，JD 单元格为裸数字，PDD/微信视频小店单元格保留括号备注。
- 历史成功产品 `208426140203/6513943` 与 `208426140204/6511943` 的当前资源回读中，`多平台尺码` 行键为裸 `26` 到 `40`，PDD/小红书/微信视频小店单元格才带 `26码(...)` 文案；早前 test6/test7 也记录过请求层 `26码` 的半码错配风险。因此脚本同时支持 `--shoe-sale-size bare`、`--shoe-multi-row-key bare` 和 `--shoe-multi-shape size-table-body`，用于后续只改变一个变量的 A/B。
- 服饰 create 干跑请求：`dp.product.create`，query 携带 tradeId；探针场景的 `productFields` 包含 `尺码`、`尺码表`、`多平台尺码`。SDK 实际发送 `尺码=130cm;140cm;150cm;160cm;165cm;170cm`，`多平台尺码.title=JD`，行键为 `130cm` 等带单位尺码，JD 单元格为裸数字。正常服饰发布暂不发送多平台尺码。
- 2026-09-01 新增线上 test5 证据：`display/display`、`display/bare-row-key`、`display/size-table-body` 三种 v1 update 均为 HTTP `200` 但业务码 `10499`；延迟资源回读为业务码 `10200`，销售尺码 15 个、SKU 30 个、主表/唯品会/天猫/抖音各 15 行保持不变，多平台尺码仍不存在。
- 若获得新的线上写入授权，执行前先回读目标产品并保存快照；执行后必须要求业务码 `10200`，再资源回读 `多平台尺码` 行数和值，并确认销售尺码、SKU、主尺码表、唯品会尺码表、天猫尺码表、抖音尺码表指纹不变。若新增的 `多平台尺码` 内容不符合预期，当前公开 API 尚无已证实的删除接口，只能在测试商品上继续用已保存快照做对照，并通过深绘后台人工清理或放弃测试商品。

## 2026-09-01 GPUS typed 增量实测

新增只读优先 typed 探针：`scripts/deepdraw_gpus_typed_size_probe.mjs`，并新增 SDK CLI `scripts/java/DeepdrawGpusProductIncrementalUpdateCli.java`。

- 公开 PDF 的 create/update 示例仍只展示普通 `Product.addProductField("多平台尺码", ...)`；PDF 没有明确写出 `gpus.product.incremental.update` 或 `sizes.texts` 的创建/更新示例。
- SDK 1.6.24 里普通 `Product` 没有 `setSizes/setTexts/setOptionAliases`；`GpusProductIncrementalUpdateRequest` 接收 `GpusProduct`，而 `GpusProduct` 有 `setSizes(DpFieldValue)` 和 `addField(DpFieldValue)`，`DpFieldValue` 有 `options/optionAliases/texts`。
- `DpFieldValue.check()` 字节码显示：`MULTI_TEXT` 本地只要求 `texts` 非空，不要求 `options` 必须属于字段枚举；这与资源模型里 `多平台尺码.field.options=平台`、`多平台尺码.options=尺码行键`、`texts=尺码选项ID,平台选项ID,单元格值` 的形状一致。
- `docs/reference/interface-docs/深绘同步结果.txt` 的历史资源样例中，`多平台尺码` typed 字段形如：`field.id=88971`、`field.type=MULTI_TEXT`、`field.options` 为平台、`options` 为 `120cm/100cm/...`、`texts` 包含 `8379,192902,100` 这类三元组。因此新的单一假设是：普通 `Product.productFields` 的对象表格会被深绘服务端按 `10499` 拒绝，而可写形态可能是 GPUS typed `fields[]` 里的 `DpFieldValue.texts` 三元组。
- 已 dry-run 且未联网写入：
  - 鞋品多平台：`/rest/v2?type=gpus.product.incremental.update&productId=3b6023ce4e844e138c25f92e9af1e227`，`fields[]` 仅含 `多平台尺码`。字段 `88059`，平台仅 `京东/拼多多/微信视频小店`；`options` 为 `26码...40码`；`texts` 为 45 条三元组，如 `11623,188799,26`、`11623,201404,26码(脚长15.8-16.2/内长17)`、`11623,202942,26码(脚长15.8-16.2/内长17)`。SDK `productCheck/sizeCheck/fieldsCheck` 均为 `true`。
  - 鞋品尺码备注：同一 GPUS update，`sizes` 仅含尺码字段 `2398`；`options=26...40`，`optionAliases=26->26码...40->40码`，`texts` 为 15 条二元组，如 `11623,脚长15.8-16.2/内长17`。SDK `productCheck/sizeCheck/fieldsCheck` 均为 `true`。
  - 服饰多平台：字段 `88964`，仅京东；`options=130cm,140cm,150cm,160cm,165cm,170cm`；`texts` 如 `7999,192894,130`。SDK `productCheck/sizeCheck/fieldsCheck` 均为 `true`。
- 新脚本 live 写入保护：默认 dry-run；线上写入必须同时给 `--execute` 与 `DEEPDRAW_LIVE_WRITE=1`，且款号必须是 `-test` 后缀。未设置 `DEEPDRAW_LIVE_WRITE=1` 时，脚本已实测拒绝执行。
- 2026-09-01 新鲜回读 test5：`dp.product.resource` 返回业务码 `10200`，内部 UID `3b6023ce4e844e138c25f92e9af1e227`，销售尺码 15 个、SKU 30 个、主尺码表/唯品会/天猫/抖音各 15 行；`fields[]` 中仍无 `多平台尺码`，`sizes.texts=[]`。
- 2026-09-01 获得用户 test 槽位授权后真实执行 typed `多平台尺码` 一次：`gpus.product.incremental.update` 返回 HTTP `200` 但业务码 `10401`，原因为`请求失败，未授权。`；随后补充资源回读拿到业务码 `10200`，销售尺码 15 个、SKU 30 个、主尺码表/唯品会/天猫/抖音各 15 行仍在，`多平台尺码` 仍不存在，`sizes.texts=[]`。证据文件：`.codex-tmp/gpus-typed-shoe-multi-live-20260901Tcurrent/report.json` 与 `post-readback-retry.json`。
- 2026-09-01 继续按单变量真实执行 typed `sizes.texts` 尺码备注一次：执行前资源回读 `10200`，`gpus.product.incremental.update` 返回 HTTP `200` 但业务码 `10401 请求失败，未授权`；延迟资源回读 `10200`，核心指纹不变，`sizes.texts` 仍未写入。证据文件：`.codex-tmp/gpus-typed-shoe-remark-live-20260901Tcurrent-after-wait/report.json`。
- 因该账号对 `gpus.product.incremental.update` 未授权，typed `sizes.texts` 尺码备注与 typed `fields[]` 多平台尺码目前都不能作为 Listingify 正常发布入口；保留脚本只用于未来账号权限变化后的验证。
- 2026-09-01 继续只读排查 SDK PIM 线：`dop-sdk-1.6.24.jar` 含 `dp.pim.nsproduct.upload/update/incrementalUpdate` 与 `dp.pim.product.get`，`PimProduct` 可表达 `ValueNode.remark`、`props`、`sku`、`sizeTable` 等结构；但 96 页 PDF 全文没有 PIM 创建/更新示例，对 test5 执行只读 `dp.pim.product.get` 返回 HTTP `200`、业务码 `10401 请求失败，未授权`。当前账号下 PIM 不能作为多平台尺码或销售尺码备注的绕行通路。

下一次不要再重复普通 `Product.addProductField` 表格对象，也不要在当前账号权限不变时重复 GPUS/PIM typed 请求。若深绘开通 GPUS/PIM typed 权限或提供新接口，再二选一执行一个变量：

1. 只测 `sizes.texts` 尺码备注：预期影响仅为产品 `6516955` 的尺码备注；回滚候选是用执行前快照中的 `sizes.options/optionAliases/texts` 通过同一 typed 请求写回。执行后必须业务码 `10200`，并回读确认 15 个销售尺码、30 个 SKU、主表、唯品会、天猫、抖音均未变。
2. 只测 typed `多平台尺码`：预期影响仅为新增或覆盖产品 `6516955` 的 `多平台尺码`。当前没有已证实的开放 API 删除接口，因此只应在 test5/test6/test7 这类测试款执行；若写入内容不符合预期，先用执行前快照对比，必要时通过深绘后台人工清理或放弃测试商品。

## 安全续跑边界

- 不要再创建 `204426140121-test5`：该款号已经存在，产品 ID 为 `6516955`。
- 已执行的一次 v2 单字段增量探针无需重复；若继续探查，只能在用户再次明确授权后针对产品 `6516955` 做新的单变量更新，并先回读快照。
- 不要把 HTTP 200 当成功，必须检查业务码 `10200` 并再次资源回读。
- 不要提交 `.codex-tmp/` 探针，不要打印 appSecret、dopKey 或完整生产环境变量。
- 当前改动只做本地提交；未 push、未部署。
