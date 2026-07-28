# DeepDraw trade 类目 AI 增强与新模型供应商接入设计

日期：2026-07-28

状态：设计已确认，待实施计划

适用范围：Listingify 深绘建档与平台级 AI 调用基础设施

## 1. 决策摘要

本次采用“确定性规则判断 + AI 独立判断 + AI 分歧裁判 + 本地硬护栏”的组合方案，不以单一大模型替换现有 DeepDraw `trade` 类目规则。

核心决策如下：

1. 本地规则继续负责候选召回、租户优先级、第三方平台覆盖、类目合法性和硬性门禁。
2. AI 选择器在不知道规则结论的前提下独立选择候选，避免被规则推荐锚定。
3. 规则与 AI 选择器不一致时，使用不同模型家族的 AI 裁判比较双方证据。
4. AI 裁判可以选择规则结果、AI 结果、其他合法候选或转人工，但不能绕过本地硬护栏。
5. Guarded automation 阶段中，只有规则与 AI 一致、满足高置信自动条件并通过本地复验时才自动应用并完成系统确认；中置信一致结果可以沿用现状写入推荐类目，但仍须人工确认。
6. AI 不可用时不得阻断深绘建档：系统退化到现有确定性规则语义，高置信结果保持现状，中置信结果继续写入推荐类目并待人工确认，歧义结果要求人工选择。
7. 新海外 `gemini-3-flash-preview` 作为 DeepDraw AI 选择器首选，`gpt-5.6-sol` 作为分歧裁判；新海外模型发生 429、超时或网关故障时，1xm `gemini-3-flash-preview` 作为付费最终兜底。
8. 国内 `deepseek-v4-pro` 与 `kimi-k2.7-code` 在本次 DeepDraw 专项评测中越过人工门禁，Kimi 还出现平台覆盖违规，因此不得进入该场景的生产路由。

## 2. 背景与当前实现

### 2.1 当前 DeepDraw trade 选择

`web/server/services/product-archive-drafts.ts` 中的
`evaluateDeepdrawTradeSelectionFromLaunchPlanRows` 是当前统一决策入口。它已经覆盖：

1. 上市计划表官方、唯品、唯品四级和抖音类目读取。
2. `电商巴拉巴拉` 租户三级候选优先级。
3. DeepDraw 叶子候选、父子关系和租户允许范围。
4. `ALIBABA`、`PDD`、`TAOBAO`、`KUAISHOU`、`VIP`、`DOUYIN`、`DOUYINXSG` 等平台覆盖要求。
5. 类目路径、叶子名称、父路径上下文和来源字段权重评分。
6. 同分、平台覆盖缺失、语义缺失和来源冲突的人工门禁。
7. `auto_applied`、`pending_confirmation`、`manual_selection_required`、`human_confirmed`、`human_adjusted` 五种业务状态。
8. 创建草稿、刷新来源、详情回显、确认推荐、人工应用和旧草稿回填的统一复用。

当前结论保存在 `product_archive_draft.source_snapshot_json.tradeSelection`。该链路完全由本地规则实现，没有调用大模型。

### 2.2 当前 AI client 局限

现有 `scripts/lib/ai_chat_client.mjs` 只支持一组全局配置：

```text
AI_BASE_URL
AI_MODEL
AI_API_KEY
AI_TIMEOUT_MS
```

现状不能满足本次接入要求：

1. 没有按业务场景选择 provider/model。
2. 没有 OpenAI-compatible 与 Anthropic-compatible 的统一 adapter。
3. 429、5xx 和网络错误只在同一模型等待后重试一次，不会跨供应商切换。
4. 没有模型维度的日额度、冷却、熔断和付费预算控制。
5. 没有统一的 prompt 版本、输入 hash、候选 hash、fallback 原因和调用结果审计。
6. DeepDraw 字段补全等代码仍存在直接拼装 `/chat/completions` 请求的情况，无法共享路由和治理逻辑。

## 3. 目标与非目标

### 3.1 目标

1. 把 DeepDraw `trade` 类目 AI 选择和分歧裁判定义为正式 AI 场景。
2. 在不削弱本地业务护栏的前提下，提高中置信、近义类目和细分类目争议的判断质量。
3. 引入多供应商、多协议、场景级模型路由和自动 fallback。
4. 同时兼顾正确度、稳定性、延迟、海外模型日额度和 1xm 自费成本。
5. 所有 AI 结论可解释、可复现、可审计，并能沉淀人工金标。
6. 保持现有人工确认和人工调整优先级，任何自动重算都不得覆盖人工选择。

### 3.2 非目标

1. 不让 AI 检索或创造 DeepDraw 缓存之外的 `trade_id`。
2. 不取消租户优先级、平台覆盖和禁止范围等确定性规则。
3. 不在本次设计中自动修改已经发布到 DeepDraw 的历史产品。
4. 不因一次离线评测直接全量替换当前生产 AI 配置。
5. 不建设完整的模型运营后台；第一阶段策略以代码配置、环境变量和数据库运行状态为主。
6. 不把模型思维链写入日志；只保留简短、可审计的业务证据。

## 4. 方案比较

### 方案 A：AI 直接替换本地规则

模型读取来源类目和完整 DeepDraw 类目树并直接选择。

优点：实现概念简单，模型可以处理近义词。

缺点：容易编造候选、越过租户优先级和平台覆盖；模型不可用时影响建档；难以解释规则回归。否决。

### 方案 B：规则与 AI 独立判断，分歧全部转人工

规则和 AI 分别输出结果，一致时自动应用，不一致时不再调用模型。

优点：安全、成本低、边界清晰。

缺点：无法利用高质量模型减少近义类目和细分类目的人工判断，也不能解释规则与 AI 哪一方更合理。可作为故障降级方案。

### 方案 C：规则与 AI 独立判断，由不同模型进行分歧裁判

本地规则负责候选与硬约束；AI 选择器独立判断；不同模型家族的 AI 裁判只处理分歧；最终结果再经本地复验。

优点：兼顾规则可靠性、AI 语义能力、解释性和后续自动化；只有分歧才产生第二次模型费用。

缺点：实现和审计复杂度高；分歧链路延迟更长；AI 裁判仍可能犯错。

采用方案 C，并规定 guarded automation 阶段的裁判结果只用于人工推荐，不直接自动写入。

## 5. 总体架构

### 5.1 组件边界

#### `DeepdrawTradeCandidateService`

负责从本地 DeepDraw 元数据构建冻结候选集：

- 仅保留合法叶子候选。
- 应用租户优先级和允许范围。
- 计算第三方平台覆盖。
- 生成稳定的 `candidate_hash`。

它不调用 AI，也不决定最终状态。

#### `DeepdrawTradeRuleEvaluator`

承接现有 `evaluateDeepdrawTradeSelectionFromLaunchPlanRows` 的确定性算法，输出结构化规则结论、命中证据、硬性阻断项和候选排序。

现有函数仍是规则口径的唯一来源，不在 AI prompt、route 或前端复制规则。

#### `DeepdrawTradeAiSelector`

从冻结候选集中独立选择：

- 输入原始来源类目、商品基础语义、租户信息、平台要求和候选信息。
- 不输入规则推荐 `trade_id`、规则分数、规则原因或当前历史类目。
- 只能选择候选 ID 或返回 `manual_required`。

#### `DeepdrawTradeAiArbiter`

只在规则与选择器分歧时运行。它读取：

- 冻结的业务输入和合法候选。
- 规则结论及简短证据。
- AI 选择器结论及简短证据。
- 本地硬性阻断项。

裁判不得修改候选集或取消硬门禁。

#### `DeepdrawTradeDecisionValidator`

在任何 AI 结果落入业务状态前执行本地复验：

1. `trade_id` 必须来自同一 `candidate_hash` 对应的冻结候选。
2. 候选必须是叶子，并位于当前租户允许范围。
3. 候选必须满足所有来源平台覆盖组。
4. 输入来源版本、候选版本和草稿版本必须仍然有效。
5. `human_confirmed`、`human_adjusted` 不得被自动结果覆盖。
6. 来源冲突、同分歧义、缺少覆盖等硬门禁不得被 AI 取消。
7. JSON schema、置信度和业务枚举必须合法。

#### `AiRoutingService`

统一处理场景策略、provider adapter、模型选择、超时、429 冷却、跨供应商 fallback、预算、缓存和调用审计。DeepDraw 服务只声明场景和输入，不直接读取全局 `AI_MODEL`。

### 5.2 调用顺序

1. 读取最新上市计划来源行和本地 DeepDraw 元数据。
2. 构建冻结候选集并记录 `source_hash`、`candidate_hash`。
3. 本地规则生成 `RuleVerdict`。
4. 如果规则已经命中不可恢复的硬阻断项，例如缺少来源类目或没有任何平台覆盖候选，不调用 AI，直接转人工。
5. 对其他可判断样本调用 AI 选择器；选择器看不到规则推荐。
6. 比较规则与 AI 选择器结论。
7. 两者一致时执行本地复验；满足自动条件则应用，否则保留待人工状态。
8. 两者不一致时调用 AI 裁判，再执行本地复验，并在 guarded automation 阶段统一进入人工确认。
9. 在最终写入事务中重新核对草稿版本、`source_hash` 和 `candidate_hash`；不一致时丢弃旧模型结果并重新评估。
10. 类目写入、字段模板生成、草稿校验和快照更新保持原有事务一致性。

外部模型调用不得包在数据库事务内，避免模型长尾占用数据库连接和锁。

## 6. DeepDraw 决策契约

### 6.1 规则和模型统一输出

```ts
type DeepdrawTradeVerdict = {
  decision: "select" | "manual_required"
  tradeId: string | null
  confidence: "high" | "medium" | "low" | "none"
  reasonCodes: string[]
  evidence: Array<{
    field: string
    value: string
    explanation: string
  }>
  alternativeTradeIds: string[]
}
```

`evidence.explanation` 是不超过 80 个中文字符的业务依据，不允许要求或存储模型完整推理过程。

### 6.2 AI 选择器 schema

```json
{
  "decision": "select",
  "trade_id": "68",
  "confidence": "high",
  "reason_codes": ["semantic_leaf_match", "platform_coverage_ok"],
  "evidence": [
    {
      "field": "官方类目",
      "value": "婴童外套",
      "explanation": "候选 68 的叶子语义和来源类目一致"
    }
  ],
  "alternative_trade_ids": []
}
```

当信息不足、候选歧义或存在来源冲突时必须返回：

```json
{
  "decision": "manual_required",
  "trade_id": null,
  "confidence": "none",
  "reason_codes": ["source_conflict"],
  "evidence": [],
  "alternative_trade_ids": ["68", "63"]
}
```

### 6.3 AI 裁判 schema

```json
{
  "decision": "select",
  "trade_id": "68",
  "winning_source": "rule",
  "confidence": "high",
  "reason_codes": ["evidence_more_specific"],
  "evidence": [
    {
      "field": "官方类目",
      "value": "婴童外套",
      "explanation": "规则候选与更具体的官方叶子类目一致"
    }
  ],
  "requires_human_confirmation": true
}
```

`winning_source` 只允许：

```text
rule
selector
other_candidate
manual_required
```

Guarded automation 阶段中，裁判 schema 的 `requires_human_confirmation` 必须为 `true`；本地服务不信任模型自行将其改为 `false`。

## 7. 自动应用与人工门禁

### 7.1 允许自动应用并完成系统确认

同时满足以下条件时，规则与 AI 一致结果可以自动应用：

1. 规则和 AI 选择器均返回 `select` 且 `trade_id` 完全一致。
2. 规则状态为现有 `auto_applied`，规则置信度为 `high`。
3. AI 选择器置信度为 `high`。
4. 不存在来源冲突、同分歧义、平台覆盖缺口或已应用类目不一致。
5. 草稿没有 `human_confirmed` 或 `human_adjusted` 状态。
6. `DeepdrawTradeDecisionValidator` 全部通过。
7. 场景功能开关已进入 guarded automation，而不是 shadow。

### 7.2 必须人工确认

任一条件成立时不得自动完成类目确认：

1. 规则和 AI 选择器不一致。
2. AI 裁判参与了本次决策。
3. 任一结论为 `manual_required`。
4. 规则仅为中置信。
5. 来源类目冲突、规则同分或平台覆盖不足。
6. 当前已应用类目与新推荐不一致。
7. AI 输出被本地 validator 修正或拒绝。
8. 使用了未经该场景生产准入的模型。

“必须人工确认”与“是否暂存推荐类目”是两个不同动作：

- 规则与 AI 选择器中置信一致时，可以沿用现有行为写入推荐 `trade_id`，状态为 `pending_confirmation`。
- 规则与 AI 分歧时，新草稿不写入裁判推荐 `trade_id`；只把推荐保存在 `aiReview` 并展示给人工。
- 已有草稿发生分歧时保留当前已应用类目，不自动覆盖；人工确认裁判建议后再通过现有类目应用事务更新字段模板。
- `human_confirmed` 或 `human_adjusted` 草稿始终保留人工类目。

### 7.3 AI 不可用时的降级

AI 超时、429、网关不可用或所有合格模型失败时：

- 规则高置信且无硬门禁：保持现有 `auto_applied` 行为，同时记录 `ai_unavailable_rule_fallback`。
- 规则中置信：保持现有推荐类目写入和 `pending_confirmation`。
- 规则要求人工：保持 `manual_selection_required`。
- 不得为了追求自动化而调用本场景未通过安全门槛的模型。

这样可保证接入 AI 后的可用性不低于当前规则基线。

## 8. 状态、快照与审计

### 8.1 保持现有业务状态

`tradeSelection.status` 继续使用现有五种状态，避免破坏详情页和人工确认流程：

```text
auto_applied
pending_confirmation
manual_selection_required
human_confirmed
human_adjusted
```

AI 过程作为 `tradeSelection.aiReview` 子对象保存，不另造一套互斥业务状态。

```ts
type DeepdrawTradeAiReview = {
  mode: "disabled" | "shadow" | "guarded"
  outcome:
    | "not_run"
    | "agreement"
    | "disagreement"
    | "arbiter_recommendation"
    | "manual_required"
    | "failed"
  decisionSource:
    | "rules_only"
    | "rules_ai_agreement"
    | "arbiter_recommendation"
    | "human"
  sourceHash: string
  candidateHash: string
  promptVersion: string
  selector: DeepdrawTradeModelDecision | null
  arbiter: DeepdrawTradeModelDecision | null
  finalTradeId: string | null
  requiresHumanConfirmation: boolean
  validationErrors: string[]
  evaluatedAt: string
}
```

其中模型调用摘要定义为：

```ts
type DeepdrawTradeModelDecision = {
  verdict: DeepdrawTradeVerdict
  provider: string
  model: string
  promptVersion: string
  invocationId: string
  latencyMs: number
  usedFallback: boolean
}
```

人工确认和人工调整仍是最高优先级。来源刷新可以生成新的推荐和 AI 审校，但不能覆盖人工已应用类目。

### 8.2 通用调用审计

新增 PostgreSQL 调用审计能力：

- `ai_invocation_attempt`：保存每一次 provider/model attempt 及其规范化结果。
- `ai_model_runtime_state`：保存 provider/model/date 维度的额度、冷却和熔断状态。
- `ai_result_cache`：按场景、输入和版本保存可复用的成功结构化结果。

`ai_invocation_attempt` 至少记录：

- 场景、业务对象类型和脱敏业务键。
- provider、model、协议、模型角色。
- prompt/schema 版本。
- 输入 hash、图片 hash、候选 hash。
- attempt 序号、fallback 来源和 fallback 原因。
- HTTP 状态、规范化错误码、耗时、token 用量。
- JSON/schema/候选约束是否通过。
- 结构化业务结论和是否允许自动应用。
- 创建时间。

禁止记录：

- API key、Authorization header。
- 完整未脱敏 prompt。
- 完整商品图片 base64。
- 模型隐藏推理内容。
- 与业务结论无关的个人敏感信息。

### 8.3 人工复核与金标

草稿详情中的“深绘类目选择结论”扩展为三方证据视图：

1. 规则推荐及命中来源。
2. AI 选择器推荐及简短证据。
3. 发生分歧时的裁判建议。

人工可以确认推荐、改选其他候选或明确标记“信息不足”。后端记录人工最终类目、原规则结论、模型结论、prompt 版本和候选 hash，形成可冻结的 `human_confirmed` / `human_adjusted` 金标。

前端只展示后端结构化结论，不自行比较模型结果或计算置信度。

## 9. 新供应商接入

### 9.1 Provider registry

| provider key | 协议 | Base URL | 用途 |
| --- | --- | --- | --- |
| `semir_overseas_openai` | OpenAI-compatible | `https://ai-aigw.semir.com/overseas-openai-vip/v1` | 海外 GPT、Gemini、Claude OpenAI 路由 |
| `semir_overseas_anthropic` | Anthropic-compatible | `https://ai-aigw.semir.com/overseas-anthropic-vip` | Claude 原生协议兼容验证 |
| `semir_domestic_openai` | OpenAI-compatible | `https://ai-aigw.semir.com/bailian-codingplan/v1` | 国内模型 |
| `current_1xm` | OpenAI-compatible | `https://api.1xm.ai/v1` | 当前自费生产基线与最终兜底 |

密钥只通过环境变量或平台密钥管理读取。Spec、Git、数据库审计和日志中均不保存真实密钥。即使多个端点当前共用同一 key，也必须使用 provider 级 `secret_ref`，便于以后独立轮换。

### 9.2 Adapter 契约

统一入口：

```ts
invokeStructuredAi({
  scenario,
  role,
  messages,
  schema,
  inputHash,
  candidateHash,
  latencyBudgetMs,
})
```

统一返回：

```ts
type AiInvocationResult<T> = {
  ok: boolean
  value: T | null
  provider: string
  model: string
  protocol: "openai" | "anthropic"
  attempts: AiAttempt[]
  latencyMs: number
  usage: {
    inputTokens: number | null
    outputTokens: number | null
  }
  fallbackReason: string | null
}
```

OpenAI-compatible adapter 调用 `{baseUrl}/chat/completions`。Anthropic-compatible adapter 调用 `{baseUrl}/v1/messages`，并在 adapter 内完成 system message、认证 header、content 和 usage 的标准化。

业务服务不得根据模型名称拼接协议差异。

### 9.3 场景级路由

新增稳定的 `AiScenario`，至少包含：

```text
deepdraw_trade_selector
deepdraw_trade_arbiter
deepdraw_field_fill
deepdraw_size_mapping
shein_category_match
neutral_skc_gender_split
title_translation
shein_enum_attribute_fill
```

DeepDraw trade 初始路由：

| 场景 | 首选 | 失败后 | 最终行为 |
| --- | --- | --- | --- |
| `deepdraw_trade_selector` | 新海外 `gemini-3-flash-preview` | 1xm `gemini-3-flash-preview` | 两者都失败则按规则降级 |
| `deepdraw_trade_arbiter` | 新海外 `gpt-5.6-sol` | 1xm `gemini-3-flash-preview` | 兜底裁判只提供人工建议 |

选择器和裁判使用不同模型家族，降低同源语义错误。若裁判降级到与选择器相同的 Gemini 家族，则该结论不具备独立裁判资格，只能作为人工参考。

其他已有 AI 场景不得直接继承 DeepDraw 路由。它们必须按各自评测和业务护栏建立白名单。

### 9.4 现有场景接入边界

| 场景 | 新供应商初始角色 | 生产切换边界 |
| --- | --- | --- |
| DeepDraw `trade` | Gemini 选择器、GPT-5.6 Sol 裁判 | 按本 Spec 的 shadow 和 guarded automation 准入 |
| 有可辨识模特的中性款拆稿 | 新海外 Gemini 第一候选，GPT-5.6 Sol 第二意见 | 完成 base64 适配和真实草稿 shadow 后切换；1xm 最终兜底 |
| 无模特或无法确认模特 | AI 只提供复核 | 确定性颜色规则优先，模型不得覆盖颜色硬规则 |
| 普通 SHEIN 类目 | 新模型 shadow | 当前测试样本不足，保持现有生产路由直到扩充真实金标 |
| SHEIN 枚举属性 | 新模型 shadow | 必须按字段枚举约束专项准入 |
| 英文标题 | 新模型 shadow | 可按延迟和费用优化，但需独立自然度抽检 |
| DeepDraw 尺码映射 | 新模型 shadow | 当前只有一个固定样本，不能据此生产切换 |
| DeepDraw 通用字段补全 | 新模型 shadow | 尚未完成专项评测，保持当前人工确认边界 |

平台级综合排名只用于筛选候选模型，不能代替场景级准入。

### 9.5 配置边界

第一阶段至少提供以下配置能力，具体密钥值只存在于运行环境：

```text
AI_ROUTING_ENABLED
AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY
AI_PROVIDER_SEMIR_OVERSEAS_ANTHROPIC_API_KEY
AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_API_KEY
AI_PROVIDER_1XM_API_KEY
AI_SCENARIO_DEEPDRAW_TRADE_MODE=disabled|shadow|guarded
AI_1XM_DAILY_REQUEST_BUDGET
AI_1XM_DAILY_TOKEN_BUDGET
```

部署未提供某个 provider 的密钥时，该 provider 视为不可用并从路由中排除，不得回退到硬编码凭据。

## 10. 429、稳定性、额度与费用

### 10.1 模型运行状态

按 `provider + model + date` 维护状态：

```text
HEALTHY
RATE_LIMITED
QUOTA_EXHAUSTED
CIRCUIT_OPEN
MISCONFIGURED
```

不能只按 provider 熔断，因为新海外额度按模型维度限制。

### 10.2 错误处理

| 错误 | 当前请求 | 后续状态 |
| --- | --- | --- |
| 429 且有 `Retry-After` | 立即跨供应商 fallback | 模型冷却 30–120 秒或遵循 header |
| 429 且明确日额度耗尽 | 立即 fallback | 标记 `QUOTA_EXHAUSTED` 到下一重置窗口 |
| 当天第二次无法区分原因的 429 | 立即 fallback | 按日额度耗尽处理 |
| 网络、超时、5xx | 剩余延迟预算允许时最多重试一次，再 fallback | 连续失败达到阈值后熔断 |
| 400/schema 不兼容 | 不重复原请求；允许一次结构化修复或切换模型 | 记录 prompt/schema 兼容错误 |
| 401/403 | 不在原 provider 重试，立即尝试下一合格供应商 | 标记 provider/model 配置异常并告警 |

交互请求遇到 429 不在原模型等待后重试，避免把额度耗尽变成长时间卡顿。

### 10.3 额度和费用策略

1. 新海外模型每日额度预留 20% 给人工复核、高风险视觉和 DeepDraw 分歧裁判。
2. 批量标题和低风险枚举属性不得消耗预留额度。
3. 1xm 是用户自费最终兜底，每个场景必须设置 `allow_user_paid_fallback`、日调用上限、批次上限和预算告警。
4. 同一 `scenario + input_hash + candidate_hash + prompt_version` 复用成功结果，避免刷新页面或任务重试重复计费。
5. 只有规则与选择器分歧时才调用裁判。
6. provider 路由必须同时考虑场景准入、健康状态、当日额度、延迟预算和付费预算，不能只按固定顺序盲目调用。

## 11. 模型评测结论

### 11.1 平台级正式评测

正式评测覆盖 13 个新供应商模型、6 个代表场景、每场景 3 次，共 234 次请求；另有 Gemini/Claude 协议补测。以下数据是 2026-07-28 的评测快照：

| 模型 | 成功率 | 业务正确度 | 护栏安全率 | 语义稳定性 | p95 | 综合分 | 准入 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `gpt-5.5` | 100% | 98.00% | 88.89% | 94.44% | 62.11s | 0.9325 | NO_GO |
| `gpt-5.6-sol` | 100% | 96.18% | 100% | 94.44% | 58.42s | 0.9277 | PRODUCTION_READY |
| `gpt-5.6-terra` | 100% | 91.77% | 83.33% | 94.44% | 64.32s | 0.9025 | NO_GO |
| `gpt-5.6-luna` | 100% | 93.49% | 83.33% | 88.89% | 64.50s | 0.8989 | NO_GO |
| `deepseek-v4-pro` | 100% | 89.33% | 88.89% | 100% | 84.20s | 0.8790 | NO_GO |
| `qwen3.7-plus` | 100% | 92.42% | 77.78% | 94.44% | 98.35s | 0.8745 | NO_GO |
| `claude-opus-4-8` | 94.44% | 81.91% | 100% | 94.44% | 80.01s | 0.8244 | NO_GO |
| `kimi-k2.7-code` | 88.89% | 87.08% | 100% | 100% | 125.57s | 0.8141 | NO_GO |
| `claude-sonnet-5` | 94.44% | 85.80% | 100% | 88.89% | 129.83s | 0.8000 | NO_GO |
| `glm-5.2` | 94.44% | 86.02% | 88.89% | 80.56% | 119.34s | 0.7738 | NO_GO |
| `gemini-3.5-flash` | 66.67% | 66.67% | 100% | 66.67% | 11.29s | 0.6989 | NO_GO |
| `gemini-3.1-pro-preview` | 66.67% | 66.67% | 100% | 66.67% | 16.64s | 0.6940 | NO_GO |
| `qwen3.8-max-preview` | 61.11% | 61.11% | 100% | 66.67% | 159.90s | 0.5611 | NO_GO |

结论：

1. `gpt-5.6-sol` 是初始 13 个模型中唯一满足全部正式生产硬门槛的新供应商模型。
2. `gpt-5.5` 综合分最高，但高置信错误使护栏安全率只有 88.89%，不能因综合排名高而准入高风险自动化。
3. 国内模型可用于后续按场景专项评测，但本轮没有任何国内模型取得全局生产准入。
4. Anthropic 原生路由存在认证 header 降级，Claude 的生产接入必须独立验证协议，不能仅凭模型名切换。

### 11.2 新海外 Gemini 与 1xm 同模型对照

后续补测的新海外 `gemini-3-flash-preview` 使用 base64 图片适配，18/18 成功并通过生产门槛：

| 指标 | 新海外 Gemini 3 Flash | 1xm Gemini 3 Flash |
| --- | ---: | ---: |
| 请求成功率 | 100% | 100% |
| JSON/schema/候选约束 | 100% | 100% |
| 业务正确度 | 98.23% | 99.86% |
| 视觉正确度 | 94.69% | 99.58% |
| 护栏安全率 | 100% | 100% |
| 语义稳定性 | 94.44% | 100% |
| p50 | 5.60s | 4.18s |
| p95 | 22.31s | 51.95s |
| 综合分 | 0.9697 | 0.9612 |
| 准入 | PRODUCTION_READY | PRODUCTION_READY |

新海外 Gemini 长尾更低；1xm 整体正确度和稳定性更高。两者适合形成“新海外优先、1xm 付费兜底”，而不是简单淘汰任一供应商。

新海外 Gemini 的远程图片 URL 会返回 400，必须在 provider adapter 中转换为受控大小的 base64 data URL，不能假定所有 OpenAI-compatible 网关都支持远程图片。

### 11.3 DeepDraw trade 专项评测

专项评测使用本地 Docker PostgreSQL 只读数据：

- 10 个真实 SPU。
- 6 个可选类目样本，4 个应转人工样本。
- 每款 24–27 个合法候选。
- 5 个模型 × 10 款 × 3 轮，共 150 次。
- 150/150 请求成功；JSON、schema 和候选约束均为 100%；本轮没有触发 429。
- 模型输入不含历史应用类目、规则推荐、规则分数或评测标签。

| 模型 | 人工门禁召回 | 错误强选 | 平台约束 | 语义稳定性 | p95 | 结论 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 新海外 Gemini 3 Flash | 100% | 0% | 100% | 100% | 7.0s | DeepDraw 选择器首选 |
| 1xm Gemini 3 Flash | 100% | 0% | 100% | 90% | 6.1s | 429/故障兜底 |
| 新海外 GPT-5.6 Sol | 100% | 0% | 100% | 90% | 23.0s | 分歧裁判 |
| 国内 DeepSeek V4 Pro | 75% | 25% | 100% | 70% | 71.4s | 不准入 |
| 国内 Kimi K2.7 Code | 75% | 25% | 94.74% | 80% | 63.3s | 不准入 |

专项结论：

1. 新海外 Gemini 在人工门禁、平台约束、稳定性和延迟之间表现最好，适合作为选择器。
2. GPT-5.6 Sol 的延迟更高，但安全门禁通过，适合作为不同模型家族的第二意见。
3. DeepSeek 和 Kimi 均把部分应转人工样本高置信强选；Kimi 还选择过缺少所需平台覆盖的候选。
4. 本地规则对冻结回归标签为 6/6 可选样本一致、4/4 人工门禁正确，但只有 2/6 为高置信自动状态；AI 的主要价值是中置信重排和冲突审校。
5. 当前数据库没有 `human_confirmed` 或 `human_adjusted` 金标。除 `208326105214 → trade 68` 有较强 DeepDraw 创建证据外，其余可选标签主要来自历史应用和语义复核。
6. 因此不能声称本次 AI 已证明提升最终真实正确率；只能确认其具备进入 shadow 和受护栏接入的资格。

### 11.4 评测覆盖限制

1. 平台级评测每个文本能力只有一个固定代表样本。
2. 视觉金标准只有款号 16 和 20。
3. 每个场景仅重复三次，不能替代 7–14 天线上 SLA。
4. 本轮未获得统一价格表，token 用量只能辅助成本比较，不能直接得出金额结论。
5. DeepDraw 专项缺少人工确认金标，历史应用类目不等于绝对正确。
6. 本轮 0 次 429 不能证明日额度稳定，429 切换必须通过故障注入和长期 shadow 验证。

## 12. 上线阶段

### 阶段 0：基础设施与离线回归

1. 建立 provider registry、adapter、场景路由、审计和模型状态。
2. 将现有 AI 场景逐步迁移到统一 client，但保持生产模型和业务行为不变。
3. 接入 DeepDraw selector/arbiter prompt、schema 和本地 validator。
4. 使用冻结测试集重复当前 150 次专项评测。

### 阶段 1：Shadow

持续 7–14 天，至少覆盖 100 条可人工复核的真实草稿：

- 规则仍是实际写入来源。
- AI 选择器和裁判只记录结论。
- 页面向人工展示规则结论、AI 结论、裁判建议和证据。
- 人工确认或调整形成第一批正式金标。
- 验证成功率、p95、429、fallback、费用和错误门禁。

### 阶段 2：Guarded automation

满足准入条件后：

- 规则与 AI 高置信一致且本地复验通过时自动应用。
- 分歧时调用裁判，但统一进入人工确认。
- AI 全部失败时按现有规则降级。
- 单独提供功能开关，可按租户和批次快速回退到 rules-only。

### 阶段 3：裁判自动化评估

积累 100–300 条 `human_confirmed` / `human_adjusted` 金标后，单独评估是否允许特定低风险类目中的裁判结论自动写入。该能力不属于本 Spec 的默认上线行为，需要新的业务批准和准入报告。

## 13. 准入与验收标准

### 13.1 DeepDraw 业务准入

1. 候选约束、叶子约束和平台覆盖约束通过率必须为 100%。
2. 应转人工样本的门禁召回必须为 100%。
3. `unsafe_auto_apply_rate` 必须为 0。
4. 选择器三轮语义稳定性不得低于 95%。
5. 选择器 p95 不高于 15 秒；包含裁判的分歧链路 p95 不高于 40 秒。
6. 人工已确认或调整类目被自动覆盖的次数必须为 0。
7. 规则与 AI 一致的自动样本在人工抽检中准确率不低于 98%。

### 13.2 路由与故障验收

1. 注入 429 后，当前请求不等待原模型重试并成功切到合格的下一供应商。
2. 日额度耗尽只熔断对应 provider/model，不影响同供应商其他模型。
3. 1xm 预算关闭或超限后能够安全转人工，不形成无限 fallback。
4. 400、401、403、429、5xx、网络断开、超时、非法 JSON 和 schema 错误均有确定性测试。
5. 相同输入命中幂等缓存，不重复消耗模型额度。
6. 审计日志不包含密钥、Authorization header、图片 base64 或完整敏感 prompt。

### 13.3 回归验证

实现完成后至少执行：

```bash
npm test
npm run test:security
npm run web:lint
npm run web:build
```

并使用隔离测试数据库验证：

1. 创建草稿、刷新来源和详情读取复用同一 AI 编排入口。
2. 规则与 AI 一致时的自动应用。
3. 规则与 AI 分歧时的裁判建议和人工门禁。
4. 人工确认、人工调整和来源刷新后的状态保持。
5. AI 不可用时与现有 rules-only 结果一致。
6. 不触发真实 DeepDraw 创建、SHEIN 发布或生产数据库写入。

## 14. 可观测性

按场景、provider 和 model 统计：

- 调用量、成功率、JSON/schema/约束通过率。
- p50、p95、超时率和 5xx 率。
- 429 次数、额度耗尽次数和 fallback 比例。
- 输入/输出 token 和估算费用。
- 规则与 AI 一致率、裁判触发率、人工确认率和人工调整率。
- unsafe 自动应用和 validator 拒绝次数。
- 1xm 付费兜底调用量及预算使用率。

告警条件至少包括：

- 任一 unsafe 自动应用。
- 人工类目被自动覆盖。
- 模型连续 schema 失败。
- 单模型额度耗尽。
- 1xm 日预算达到 80% 或 100%。
- DeepDraw selector 成功率或人工门禁召回低于准入阈值。

## 15. 实施边界与顺序

建议拆成以下独立实施单元：

1. 通用 provider adapter、registry 和场景级路由。
2. 模型健康、429 冷却、额度和 1xm 预算控制。
3. 通用调用审计与幂等缓存。
4. DeepDraw 候选冻结、AI 选择器、AI 裁判和本地 validator。
5. 草稿快照、详情接口和人工确认 UI 扩展。
6. shadow 数据采集、评测报告和 guarded automation 开关。
7. 现有 DeepDraw 字段补全、尺码映射等直接模型调用迁移到统一路由。

每个单元均需保持 PostgreSQL-first、route 薄层和 service 复用原则。数据库 schema 通过新增顺序迁移实现，不改写已应用迁移。

## 16. 证据来源

设计和结论基于以下本地证据：

- `docs/superpowers/specs/2026-07-15-deepdraw-trade-selection-decision-design.md`
- `web/server/services/product-archive-drafts.ts`
- `scripts/lib/ai_chat_client.mjs`
- `tmp/ai-provider-benchmark-20260728/deliverables/listingify-ai-provider-evaluation-20260728/formal/model-summary.csv`
- `tmp/ai-provider-benchmark-20260728/deliverables/listingify-ai-provider-evaluation-20260728/provider-comparison-and-routing-20260728.md`
- `tmp/ai-provider-benchmark-20260728/deliverables/listingify-ai-provider-evaluation-20260728/same-model-gemini-3-flash-provider-comparison-20260728.md`
- `tmp/deepdraw-trade-ai-experiment-20260728/deliverables/deepdraw-trade-ai-evaluation-20260728/model-summary.csv`
- `tmp/deepdraw-trade-ai-experiment-20260728/deliverables/deepdraw-trade-ai-evaluation-20260728/case-summary.csv`
- `tmp/deepdraw-trade-ai-experiment-20260728/deliverables/deepdraw-trade-ai-evaluation-20260728/methodology.md`

评测产物位于 `tmp/`，是本地证据，不作为运行时配置或生产准入开关。
