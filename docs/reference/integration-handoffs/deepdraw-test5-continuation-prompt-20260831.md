# 续跑 Prompt

在 `/Users/xingyicheng/Documents/Listingify` 继续排查深绘多平台尺码开放 API。先完整阅读 `docs/reference/integration-handoffs/deepdraw-test5-handoff-20260831.md`，并使用 `connect-listingify-bastion`、`dont-stop`、`systematic-debugging` 和 `verification-before-completion` 技能。

当前事实：Listingify 草稿 997、款号 `204426140121-test5` 已创建为深绘产品 `6516955`，状态 `readback_verified`。主尺码表、唯品会、天猫、抖音各 15 行及 30 个 SKU 已回读一致；多平台尺码不存在。创建成功后，用户曾再次明确授权一次 v2 单字段增量探针：SDK 1.6.24 调用 `dp.product.incremental.update`，`productFields` 只含 `多平台尺码`，保留原 `places`，表头为 `JD,PDD,XIAOHONGSHU,KUAISHOU,WEIXINXIAODIAN`、15 行 26-40；HTTP 200 但业务码仍为 `10499`，更新后既有四张尺码表、销售尺码和 SKU 均未被破坏。未经新的明确授权不得继续写线上。

下一步目标不是再次创建商品或重复已失败的单字段增量请求，而是找出公开 API 是否存在其他可用写法，或整理足够证据让深绘确认账号/类目能力。先做只读工作：

1. 回读产品 6516955 的完整 `sizes`、`sizeTables`、`fields`、`places` 快照。
2. 对比历史成功产品 `208426140203/6513943`、`208426140204/6511943` 的同一结构。
3. 反编译/审查 SDK 1.6.24 的更新请求、Product 序列化和校验实现，确认公开 API 是否能写 `sizes.optionAliases/texts`，不要从资源返回模型反推可写能力。
4. 从线上提交日志或本地历史证据找出两款历史成功时的确切请求方法和原始请求字段；没有请求证据时标记未知。
5. 形成单一假设和最小请求，明确会修改产品 6516955 的哪些字段、如何回滚；获得用户新的线上写入授权后才执行。
6. 每次只改一个变量，要求业务码 `10200`，随后资源回读 15 行并确认主表、唯品会、天猫、抖音和 30 个 SKU 未被破坏。

已排除：创建前草稿选平台、五列与四列表头、JD 单列、PDD 是否带括号；这些创建请求均返回 `10499`。SDK 1.6.24 的 v2 单字段增量更新也已排除，线上日志标记为 `v2_incremental_sdk_1_6_24_multi_platform_only_after_test5_create`，返回 `10499` 且回读仍无该表。不要再重复。

最终报告必须区分：本地代码通过、线上请求成功、资源回读一致、commit、push、部署。禁止把其中一个当作另一个。
