# 深绘类目自动选择结论与人工确认设计

## 目标

把上市计划表类目与深绘类目的匹配结果固化为后端能力，而不是依赖一次性批量表格。草稿创建、来源刷新、草稿详情和人工调整必须复用同一套选择逻辑，并向页面返回稳定的结论枚举、推荐类目、置信度、原因及待办动作。

业务确认的核心行为是：中置信度结果继续自动应用推荐类目，但必须标记为“待人工确认”。人工确认同一类目后清除待确认状态；人工选择其他类目后记录为“人工已调整”。

## 当前基线

后端 `chooseDeepdrawTradeFromLaunchPlanRows` 已实现以下规则：

1. 读取官方、唯品、唯品四级、抖音计划类目共同评分。
2. 官方类目存在时，候选深绘类目必须覆盖 `ALIBABA`、`PDD`、`TAOBAO`、`KUAISHOU`。
3. 唯品类目存在时必须覆盖 `VIP`。
4. 抖音类目存在时必须覆盖 `DOUYIN` 或 `DOUYINXSG`。
5. 综合比较完整路径、类目名称、末级名称和父路径上下文；同分时优先较短的公共路径，同分同深度不自动选择。

这套规则已经用于草稿创建和来源刷新，但目前只返回“匹配对象或 `null`”。草稿详情只暴露计划表类目参考，没有结构化选择结论；页面也无法区分自动应用、待确认和人工选择。

## 方案比较

### 方案 A：后端结构化结论 + 草稿快照确认状态

后端选择函数始终返回结构化结论；当前评估结果实时生成，人工确认状态写入 `source_snapshot_json`。旧草稿无需迁移即可回显，来源或元数据刷新后可以重新评估。

优点：不需要数据库迁移；兼容现有草稿；创建、刷新、详情和页面共用同一口径；人工状态可审计。

缺点：草稿详情读取时需要执行一次类目评估查询。

### 方案 B：在草稿表新增结论、置信度和确认字段

通过数据库迁移新增多个列，创建和刷新时持久化全部结论。

优点：详情读取简单，查询成本低。

缺点：需要迁移；类目元数据变化后容易产生陈旧结论；旧草稿需要回填；字段扩展成本更高。

### 方案 C：前端根据 `trade_id` 和计划表字段自行推断

后端保持现状，页面自己判断是否推荐和是否需要确认。

优点：后端改动少。

缺点：自动建档与页面形成两套口径，无法供创建/刷新流程复用，也不能可靠记录人工确认。

采用方案 A。

## 后端结论契约

新增稳定的类目选择状态枚举：

```text
auto_applied
pending_confirmation
manual_selection_required
human_confirmed
human_adjusted
```

含义：

1. `auto_applied`：唯一高置信度结果已自动应用，来源类目没有冲突。
2. `pending_confirmation`：推荐类目已自动应用，但置信度为中，或同一平台来源类目存在多个不同值，需要人工确认。
3. `manual_selection_required`：缺少计划类目、平台覆盖不足、没有语义命中或存在无法打破的并列结果，不自动应用类目。
4. `human_confirmed`：人工确认了系统已应用的推荐类目。
5. `human_adjusted`：人工选择了不同于系统推荐的类目。

详情接口返回 `tradeSelectionDecision`：

```ts
type TradeSelectionDecision = {
  status:
    | "auto_applied"
    | "pending_confirmation"
    | "manual_selection_required"
    | "human_confirmed"
    | "human_adjusted"
  confidence: "high" | "medium" | "none"
  reasonCode:
    | "unique_high_confidence"
    | "medium_confidence"
    | "source_category_conflict"
    | "missing_source_category"
    | "missing_platform_coverage"
    | "missing_semantic_match"
    | "ambiguous_match"
    | "human_confirmed"
    | "human_adjusted"
  recommendedTrade: {
    tradeId: string
    tradePath: string
  } | null
  appliedTrade: {
    tradeId: string
    tradePath: string
  } | null
  matchedField: string | null
  matchedValue: string | null
  requiredPlatforms: string[]
  coveredPlatforms: string[]
  sourceConflict: boolean
  reason: string
  evaluatedAt: string
  confirmedAt: string | null
}
```

`reason` 是面向业务的中文说明，必须包含自动选择或不能自动选择的直接原因。`reasonCode` 供页面、测试和后续统计稳定使用，不依赖中文文案。

## 数据流与状态转换

### 草稿创建

1. 从来源批次读取当前款号的计划表行。
2. 后端评估所有深绘候选类目并生成 `TradeSelectionDecision`。
3. `auto_applied` 和 `pending_confirmation` 都自动写入推荐 `trade_id`、`trade_path` 并生成字段。
4. `manual_selection_required` 保持类目为空，不生成类目字段模板。
5. 当前决策写入 `source_snapshot_json.tradeSelection`。

### 来源刷新

1. 使用最新计划表数据和深绘元数据重新评估。
2. 推荐结果或原因发生变化时，更新快照。
3. 新结果为中置信度或来源冲突时重置为 `pending_confirmation`。
4. 已人工调整的草稿不被自动推荐覆盖；后端只更新最新推荐并保留当前人工类目。

### 草稿详情

1. 使用当前来源行和深绘元数据生成最新推荐。
2. 叠加快照中的人工确认状态。
3. 返回 `tradeSelectionDecision`，并明确当前已应用类目是否与推荐一致。
4. 旧草稿没有快照状态时直接按当前数据生成结论，不要求数据迁移。

### 人工确认与调整

新增确认推荐类目的后端动作。人工点击“确认推荐类目”时，确认当前推荐仍与已应用类目一致，然后写入 `human_confirmed` 和确认时间。

现有人工应用类目动作继续负责更换类目：

1. 选择与推荐相同的类目时记录 `human_confirmed`。
2. 选择与推荐不同的类目时记录 `human_adjusted`。
3. 两种情况都重新生成类目字段并重新校验草稿。

## 页面设计

在草稿详情页标题区下方、草稿摘要上方增加“深绘类目选择结论”提示卡，不把判断逻辑放在前端。

页面状态：

1. `auto_applied`：绿色提示，显示“已自动应用推荐类目”、类目路径、tradeId 和高置信度。
2. `pending_confirmation`：黄色提示，显示“已自动应用，待人工确认”、推荐类目、中置信度或冲突原因；提供“确认推荐类目”和“重新选择”按钮。
3. `manual_selection_required`：红色或橙色提示，显示“需要人工选择”、不能自动选择的原因；提供“选择深绘类目”按钮。
4. `human_confirmed`：绿色提示，显示“人工已确认”和确认时间。
5. `human_adjusted`：蓝色提示，同时显示当前人工类目和系统推荐类目，避免误以为两者一致。

类目选择弹窗继续显示上市计划表四组类目参考，并在其上方复用同一结论摘要。页面只根据后端枚举选择颜色、文案模板和可用操作，不重新计算置信度或原因。

## 错误处理

1. 深绘元数据未同步或平台覆盖为空时返回 `manual_selection_required`，不抛出详情页错误。
2. 人工确认时推荐结果已变化，后端拒绝旧确认并返回“推荐结果已更新，请刷新后重新确认”。
3. 人工选择的类目在本地元数据中不存在时沿用现有错误“本地未找到该深绘类目”。
4. 刷新来源时单个草稿评估失败继续进入现有 `failedDrafts`，不影响其他草稿。

## 测试

后端回归测试覆盖：

1. 高置信度唯一匹配生成 `auto_applied`。
2. 中置信度匹配自动应用并生成 `pending_confirmation`。
3. 同一平台来源类目多值时自动应用但生成 `pending_confirmation`。
4. 缺少类目、平台覆盖不足、无语义匹配和并列结果生成 `manual_selection_required` 及对应 `reasonCode`。
5. 人工确认同一类目生成 `human_confirmed`。
6. 人工改选其他类目生成 `human_adjusted`，来源刷新不覆盖人工类目。
7. 草稿详情返回完整 `tradeSelectionDecision`。

前端回归测试覆盖五种枚举的中文提示、置信度、推荐类目和操作按钮。完成后执行：

```bash
npm test
npm run web:lint
npm run web:build
```

## 范围

本次包含：后端选择结论、草稿快照确认状态、详情接口、确认动作、草稿详情页回显和回归测试。

本次不包含：批量审核工作台、数据库新表、把 Excel 结果逐条导入、改写已发布到深绘的历史产品、自动发布到深绘。
