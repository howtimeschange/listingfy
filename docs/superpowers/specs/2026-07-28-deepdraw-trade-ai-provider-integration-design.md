# DeepDraw trade 类目 AI 增强与新模型供应商接入设计

日期：2026-07-28

状态：30 SPU 离线专项评测已完成；阶段 0 代码已实现，尚未授权切换生产配置

适用范围：Listingify 深绘建档与平台级 AI 调用基础设施

## 1. 决策摘要

“确定性规则判断 + AI 独立判断 + AI 分歧裁判 + 本地硬护栏”仍是目标架构，
但 2026-07-29 的 30 SPU 盲测表明：当前没有任何模型通过 DeepDraw `trade` 场景准入，
因此目标架构暂不进入生产路由，更不能让 AI 裁判自动覆盖规则结果。

核心决策如下：

1. DeepDraw `trade` 继续由本地规则负责候选召回、租户优先级、第三方平台覆盖、
   类目合法性、最终决策和人工门禁；AI 只保留在离线实验，不进入生产 Shadow 候选。
2. 普通 SHEIN 类目仍以最新本地元数据、确定性映射和人工确认为主。
   国内 `deepseek-v4-pro` 只通过 text-only Shadow 门槛，不得自动写入
   `category_id/product_type_id`。
3. 中性款 SKC 暂无合格视觉模型。新海外 Gemini 与 Sol 对儿童商品图片稳定拒答；
   1xm 的准确率、unsafe 和稳定性均未达标。现阶段不得由 AI 自动拆稿。
4. 英文标题的首选是新海外 `gpt-5.6-terra`，同网关不同模型的备选是
   `gpt-5.6-sol`；两者都失败或供应商不可用时保留原结果并转人工，而不是调用未准入模型。
5. DeepDraw 尺码映射首选国内 `kimi-k2.7-code`，跨供应商备选
   `gpt-5.6-sol`，最终付费兜底为 1xm；三者均通过本场景 Guarded 候选门槛。
6. SHEIN 枚举属性首选新海外 `gemini-3-flash-preview`，国内
   `deepseek-v4-pro` 作为无海外日额度限制的跨供应商备选，1xm 作为付费最终兜底。
7. DeepDraw 通用字段首选国内 `kimi-k2.7-code`，跨供应商备选
   `gpt-5.6-sol`；1xm 与 DeepSeek 均在鞋类字段出现高置信错误，不得作为自动 fallback。
8. 任何场景只允许 fallback 到同场景已经准入的模型。全部合格模型失败时，
   必须退回本地规则、保留原值或转人工，不能为了“有结果”调用 NO_GO 模型。
9. 新海外 429 按 provider + model 隔离，原模型不重试；国内模型用于消化批量任务和
   海外额度转移，1xm 只在明确准入的场景作为用户自费最终兜底。
10. 本轮结论只授权后续 Shadow/受保护改造，不修改生产 `AI_*` 配置，
    不写 SHEIN 或 DeepDraw 业务草稿。

### 1.1 阶段 0 实施结果（2026-07-29）

本地分支已完成以下基础改造，默认配置仍保持原生产路径：

1. 新增统一场景路由、OpenAI-compatible 与 Anthropic-compatible adapter、
   provider 级密钥、场景白名单和固定 fallback 顺序。
2. 新增 PostgreSQL 调用审计、`provider + model` 运行状态和 1xm 日用量表。
   审计只保存路由元数据、脱敏后的业务结果投影和输入/候选哈希，不保存 prompt、
   messages、Authorization、图片 URL 或 base64。
3. 429 不在原模型重试；明确日额度耗尽时以 `QUOTA_EXHAUSTED` 记录并只熔断
   对应模型到下一 UTC 日期边界。网络、超时和 5xx 最多重试一次，连续失败达到
   阈值后按模型熔断。
4. 1xm Guarded fallback 必须显式设置合法的正数日请求预算；缺少、非法或非正数
   预算时默认关闭，并同时记录请求量与 token 用量。
5. 已迁移英文标题、SHEIN 枚举属性、普通 SHEIN 类目、DeepDraw 字段补全和
   DeepDraw 尺码映射。相同 `scenario + input_hash + candidate_hash + prompt_version`
   在进程内复用成功结果。
6. 普通 SHEIN 类目中的 DeepSeek 只接 text-only Shadow；中性 SKC 视觉和
   DeepDraw `trade` 仍由代码硬限制为 `disabled`。普通/中性混合批次会按场景
   隔离，普通组继续执行，中性组明确记录为禁用跳过，且图片不会进入普通类目请求。
7. `AI_ROUTING_ENABLED=false` 时继续执行原 `AI_*` 路径；开启后的默认模式仍是
   Shadow，新供应商结果不会替换业务结果。Guarded 需后续独立授权和环境配置。

本实施结果不代表生产已启用 Shadow 或 Guarded，也没有在实现过程中调用真实模型、
切换生产密钥或写入 SHEIN/DeepDraw 业务草稿。

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

1. 把 DeepDraw `trade` 类目 AI 选择和分歧裁判保留为独立离线专项场景；
   只有重新通过准入后，才注册为可进入生产 Shadow 的正式 AI 场景。
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

方案 C 仅作为未来重新准入后的目标架构；当前仍采用 `rules_only`。
即使未来进入 guarded automation，裁判结果也只用于人工推荐，不直接自动写入。

## 5. 总体架构

本节描述 DeepDraw `trade` 的目标架构，不代表已经准入或启用。当前运行策略是
`rules_only`：不调用 selector/arbiter，不让任何模型参与最终 `trade_id` 决策。
只有后续新一轮人工金标评测通过 Shadow 和 Guarded 硬门槛后，才允许按本节实施。

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

本节的 AI 自动应用条件目前全部处于关闭状态。2026-07-29 专项评测中没有
DeepDraw `trade` 模型达到 Shadow 候选门槛，因此生产只执行 7.2 中的规则与人工边界；
7.1 仅作为未来重新准入后的验收契约。

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

当前没有合格的 DeepDraw `trade` AI 模型，因此“AI 不可用”不是异常降级，而是
`rules_only` 的常态。不得把 1xm 或其他场景通过的模型直接借用到该场景。

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
| `current_1xm` | OpenAI-compatible | `https://api.1xm.ai/v1` | 现有自费供应商；仅在同场景通过准入且预算允许时作为最终兜底 |

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

DeepDraw trade 当前路由：

| 场景 | 当前模式 | AI 模型 | 最终行为 |
| --- | --- | --- | --- |
| `deepdraw_trade_selector` | `disabled` | 无准入模型 | 本地规则决定推荐或转人工 |
| `deepdraw_trade_arbiter` | `disabled` | 无准入模型 | 规则歧义或分歧直接人工确认 |

未来重新准入时，选择器和裁判必须使用不同模型家族，降低同源语义错误；但不得提前
预设 Gemini 或 Sol 一定担任某个角色。模型角色必须由当期同场景金标结果决定。

其他已有 AI 场景不得直接继承 DeepDraw 路由。它们必须按各自评测和业务护栏建立白名单。

### 9.4 现有场景接入边界

| 场景 | 本轮角色与顺序 | 失败后的安全行为 | 当前准入 |
| --- | --- | --- | --- |
| DeepDraw `trade` | 本地规则，不调用 AI | 规则歧义直接人工 | `rules_only` |
| 有可辨识模特的中性款拆稿 | 无合格视觉模型 | 人工确认每个 SKC 模特性别 | `NO_GO` |
| 无模特或无法确认模特 | 人工确认“无可辨识模特”后使用本地颜色规则 | 颜色也不明确则人工 | `rules_only` |
| 普通 SHEIN 类目 | 最新元数据/本地规则；DeepSeek text-only 只做影子复核 | 规则不确定或 AI 分歧转人工 | `SHADOW_CANDIDATE` |
| SHEIN 枚举属性 | 新海外 Gemini → 国内 DeepSeek → 1xm | 全部失败则保留空值并人工补齐 | 三者 `GUARDED_CANDIDATE` |
| 英文标题 | Terra → Sol | 两个海外模型或供应商均不可用时保留原值并人工 | 两者 `GUARDED_CANDIDATE` |
| DeepDraw 尺码映射 | 国内 Kimi → 新海外 Sol → 1xm | 全部失败走现有规则 fallback/人工 | 三者 `GUARDED_CANDIDATE` |
| DeepDraw 通用字段补全 | 国内 Kimi → 新海外 Sol | 全部失败保留未填字段并人工 | 两者 `GUARDED_CANDIDATE` |

表中的 `GUARDED_CANDIDATE` 是离线资格，不是生产已切换。由于每个场景只有
4–10 个独立 SPU 金标，实施后必须先运行 Shadow，并验证现网 prompt 与本轮 prompt
一致，才能启用受保护写入。

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

1. 每个新海外模型按自身额度单独计数；达到 70% 时把可延迟批量任务转移到已准入的
   国内模型，达到 90% 时只保留交互请求和跨供应商故障备援，429 或 100% 时熔断到重置窗口。
2. 不为当前 NO_GO 的视觉或 DeepDraw `trade` 场景预留额度；任何离线复测使用独立评测预算。
3. 1xm 只有在目标场景自身通过准入时，才可作为用户自费最终兜底；允许使用的场景必须
   设置 `allow_user_paid_fallback`、日调用上限、批次上限和预算告警。
4. 同一 `scenario + input_hash + candidate_hash + prompt_version` 复用成功结果，避免刷新页面或任务重试重复计费。
5. 只有规则与选择器分歧时才调用裁判。
6. provider 路由必须同时考虑场景准入、健康状态、当日额度、延迟预算和付费预算，不能只按固定顺序盲目调用。
7. 本轮没有统一价格表，不能声称某模型金额更低；费用决策只采用“国内/新供应商额度优先、
   同场景已准入的 1xm 最后付费兜底”的保守顺序，并持续记录 token 与实际账单。

## 11. 30 SPU 离线专项评测结论

### 11.1 数据、盲标与评分口径

本轮使用本地 Docker PostgreSQL 只读抽取的 30 个唯一真实 SPU：

- 性别覆盖男 6、女 9、中性 15；年龄覆盖婴童 6、幼童 12、中童 12。
- 28 个 SPU 有图，75/75 张原始图片可访问。
- 七个场景的独立金标数分别为：标题 4、尺码 5、DeepDraw `trade` 10、
  SHEIN 类目 4、SHEIN 属性 4、中性 SKC 8、DeepDraw 字段 5。
- 模型输入与 `gold.private.json` 物理隔离，不包含 SHEIN 目标 pair、历史应用
  `trade_id`、规则推荐、规则分数或预期答案。
- 金标版本为 `blind-v2`，是单次盲审和证据完整性校验，不是双人人工裁决。

本轮共纳入 474 次可追溯评分记录：新供应商文本/结构化 174 次、1xm 同口径 90 次、
海外视觉硬停止 24 次、DeepDraw `trade` 复用真实结果 150 次、标题 fallback 定向补测
36 次。所有完整 run 的结果数必须与 manifest 计划数一致；半截 run 会拒绝生成汇总。

Shadow 硬门槛为 transport/JSON/schema ≥ 95%、候选约束 100%、业务正确度 ≥ 85%、
unsafe = 0、语义稳定性 ≥ 90%、p95 ≤ 120 秒且没有 429 遗留跳过。Guarded 还要求
Safe auto usable ≥ 85%，人工门禁召回 100%。

### 11.2 场景级关键结果

| 场景与模型 | 业务正确度 | Unsafe | 稳定性 | p95 | 准入 |
| --- | ---: | ---: | ---: | ---: | --- |
| 标题：新海外 Terra | 100% | 0% | 100% | 2.93s | Guarded 候选 |
| 标题：新海外 Sol | 100% | 0% | 100% | 5.27s | Guarded 候选 |
| 标题：1xm Gemini | 91.67% | 0% | 91.67% | 8.04s | NO_GO，JSON 仅 91.67% |
| 尺码：国内 Kimi | 100% | 0% | 100% | 16.90s | Guarded 候选 |
| 尺码：新海外 Sol | 100% | 0% | 100% | 12.28s | Guarded 候选 |
| 尺码：1xm Gemini | 100% | 0% | 100% | 5.84s | Guarded 候选 |
| SHEIN 属性：新海外 Gemini | 100% | 0% | 100% | 3.51s | Guarded 候选 |
| SHEIN 属性：国内 DeepSeek | 100% | 0% | 100% | 27.12s | Guarded 候选 |
| SHEIN 属性：1xm Gemini | 100% | 0% | 100% | 3.77s | Guarded 候选 |
| DeepDraw 字段：国内 Kimi | 100% | 0% | 100% | 15.85s | Guarded 候选 |
| DeepDraw 字段：新海外 Sol | 100% | 0% | 100% | 7.73s | Guarded 候选 |
| DeepDraw 字段：1xm Gemini | 97.00% | 20.00% | 100% | 4.06s | NO_GO |
| SHEIN 类目：国内 DeepSeek text-only | 100% | 0% | 100% | 56.48s | Shadow 候选 |
| SHEIN 类目：1xm Gemini vision | 80.83% | 16.67% | 91.67% | 13.54s | NO_GO |
| 中性 SKC：1xm Gemini vision | 83.54% | 16.67% | 87.50% | 14.57s | NO_GO |
| DeepDraw `trade`：新海外 Gemini | 84.00% | 0% | 100% | 7.04s | NO_GO |

新海外 Gemini 与 Sol 的视觉链路虽然 24/24 得到 HTTP 200，但对 SHEIN 图片类目和
中性 SKC 统一返回“很抱歉，我无法回答您的问题”，JSON/schema/业务正确度均为 0。
这属于当前网关/安全策略能力边界，不应通过改写提示词规避。

DeepSeek 的 SHEIN 类目 12/12 pair 正确，但只有 25% 达到自动可用条件；它没有读取
图片，且部分响应主动保留图片/性别风险。因此只能做 text-only Shadow 复核。

### 11.3 DeepDraw `trade` 结论

10 SPU × 5 模型 × 3 轮的 150 次真实结果全部重新按 `blind-v2` 评分，五个模型均
`NO_GO`：

| 模型 | 业务正确度 | Unsafe | 人工门禁召回 | 稳定性 | p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 新海外 Gemini | 84.00% | 0% | 100% | 100% | 7.04s |
| 1xm Gemini | 84.00% | 3.33% | 100% | 96.67% | 6.14s |
| 新海外 Sol | 76.00% | 23.33% | 80% | 96.67% | 22.97s |
| 国内 DeepSeek | 70.67% | 30.00% | 60% | 86.67% | 71.36s |
| 国内 Kimi | 65.33% | 36.67% | 60% | 93.33% | 63.32s |

所以“规则判断 + AI 独立判断 + AI 评判哪一个更合理”在架构上可行，但当前没有模型
达到上线门槛。生产继续 `rules_only`；规则不确定时人工确认。AI 只能留在离线实验，
不能把低于 Shadow 门槛的模型包装成“只提供复核”后进入业务链路。

### 11.4 争议样本与覆盖限制

1. `208326105104` 的 SHEIN 类目经商品主数据、上市计划、元数据和原图独立复核，
   继续保留 `1990/9341 男童（大）外套`。`2519/1354 男童（大）夹克` 有视觉合理性，
   因此该样本在结论中标为有争议，但不因模型多数意见改标签。
2. `204326141197` 的 DeepDraw 字段 `shoe_type=皮鞋` 经官方、唯品、抖音发布类目和
   原图复核后保留；1xm 与 DeepSeek 的“休闲鞋”是高置信证据优先级错误。
3. 同一 SPU 的 DeepDraw `trade` 原金标从历史应用 `543 通用皮鞋` 改为
   `manual_required`：`10172 男童皮鞋` 也有语义依据，且“男/公主鞋/休闲鞋”来源冲突。
   150 条模型结果只重评分、不重调，五个模型仍全部 NO_GO。
4. 场景金标只有 4–10 个 SPU；通过只代表进入 Shadow/Guarded 候选，不是直接生产切换。
5. 英文标题评分覆盖品牌、受众、品类、季节和稳定性，尚未完成独立双语文案自然度盲审。
6. 现网旧批量 `ai-fill` 的 `title_en` prompt 与本轮标题 prompt 不完全同构；
   切换前必须统一入口或做同 prompt Shadow。
7. 后台 MDM 未映射组合的类目候选分布比本轮 4 个 SHEIN 类目样本更宽，不能外推为
   全量映射任务已准入。
8. 不同供应商图片协议不同：新海外要求完整 data URL，1xm 当前要求同源远程 URL，
   国内模型本轮明确 text-only。不同网络路径的绝对延迟不能全部归因于模型。
9. 474 次记录中没有 429，不代表日额度已验证；需故障注入和至少 7–14 天 Shadow。
10. 没有统一价格表，不能给出金额成本排名；1xm 仅按“用户自费最终兜底”治理。
11. 本轮没有切换生产配置，没有写 SHEIN/DeepDraw 草稿。

## 12. 上线阶段

### 阶段 0：基础设施与离线回归

1. 建立 provider registry、adapter、场景路由、审计和模型状态。
2. 将现有 AI 场景逐步迁移到统一 client，但保持生产模型和业务行为不变。
3. 先接入已通过 Guarded 候选门槛的标题、尺码、SHEIN 属性和 DeepDraw 字段路由；
   SHEIN 类目只接 text-only Shadow。
4. DeepDraw `trade` selector/arbiter 与中性 SKC 视觉保持 `disabled`，只保留离线 harness。
5. 为 429、供应商故障、NO_GO 模型排除、1xm 预算和全模型失败转人工补确定性测试。

### 阶段 1：Shadow

持续 7–14 天，至少覆盖 100 条可人工复核的真实任务：

- 生产现有路径仍是实际写入来源，新路由只记录结论。
- 仅运行本 Spec 已列为 Guarded/Shadow 候选的模型；DeepDraw `trade` 和中性视觉不运行。
- 页面或审计中展示新旧结果、validator 结论和 fallback 原因。
- 人工确认或调整形成第一批正式金标，并单独记录现网 prompt 版本。
- 验证成功率、p95、429、fallback、费用和错误门禁。

### 阶段 2：Guarded automation

低风险场景满足准入条件后：

- 标题、尺码、枚举属性和 DeepDraw 字段按场景白名单启用受保护结果。
- SHEIN 类目继续 Shadow，不自动写入。
- DeepDraw `trade` 与中性 SKC 继续 rules/manual，不进入本阶段。
- AI 全部失败时按本场景的规则、保留原值或人工边界降级。
- 单独提供功能开关，可按租户和批次快速回退到 rules-only。

### 阶段 3：裁判自动化评估

DeepDraw `trade` 积累 100–300 条 `human_confirmed` / `human_adjusted` 金标后，
重新评估 selector 和 arbiter。只有模型先通过 Shadow 和 Guarded 门槛，才讨论特定
低风险类目的裁判自动化；该能力不属于本 Spec 默认上线行为，需要新的业务批准和准入报告。

## 13. 准入与验收标准

### 13.1 通用场景离线准入

1. Shadow 候选必须同时满足：transport/JSON/schema ≥ 95%、候选约束 100%、
   业务正确度 ≥ 85%、unsafe = 0、稳定性 ≥ 90%、p95 ≤ 120 秒且无 429 遗留跳过。
2. Guarded 候选还必须满足 Safe auto usable ≥ 85%、人工门禁召回 100%。
3. 候选资格按 `scenario + provider + model + prompt_version` 计算，不存在“模型全局通过”
   后自动继承到其他场景。
4. 少于 10 个独立 SPU 的场景必须先 Shadow；离线 Guarded 候选不直接授权生产写入。

### 13.2 DeepDraw `trade` 业务准入

1. 候选约束、叶子约束和平台覆盖约束通过率必须为 100%。
2. 应转人工样本的门禁召回必须为 100%。
3. `unsafe_auto_apply_rate` 必须为 0。
4. 选择器三轮语义稳定性不得低于 95%。
5. 选择器 p95 不高于 15 秒；包含裁判的分歧链路 p95 不高于 40 秒。
6. 人工已确认或调整类目被自动覆盖的次数必须为 0。
7. 规则与 AI 一致的自动样本在人工抽检中准确率不低于 98%。

### 13.3 路由与故障验收

1. 注入 429 后，当前请求不等待原模型重试并成功切到合格的下一供应商。
2. 日额度耗尽只熔断对应 provider/model，不影响同供应商其他模型。
3. 1xm 预算关闭或超限后能够安全转人工，不形成无限 fallback。
4. 400、401、403、429、5xx、网络断开、超时、非法 JSON 和 schema 错误均有确定性测试。
5. 相同输入命中幂等缓存，不重复消耗模型额度。
6. 审计日志不包含密钥、Authorization header、图片 base64 或完整敏感 prompt。

### 13.4 回归验证

实现完成后至少执行：

```bash
npm test
npm run test:security
npm run web:lint
npm run web:build
```

并使用隔离测试数据库验证：

1. 创建草稿、刷新来源和详情读取复用同一 AI 编排入口。
2. 仅针对已获 Guarded 批准的低风险场景，验证规则与 AI 一致时的受保护应用。
3. DeepDraw `trade` 的规则/AI 分歧、裁判建议和人工门禁只在离线 harness 验证；
   未重新准入前不得接入生产调用链。
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
4. 现有标题、SHEIN 属性、DeepDraw 字段与尺码映射迁移到统一路由，先保持 Shadow。
5. SHEIN 类目 text-only Shadow、草稿快照和人工确认 UI 扩展。
6. 低风险场景的 Shadow 数据采集、评测报告和 guarded automation 开关。
7. DeepDraw `trade` 候选冻结、selector/arbiter 和 validator 只在离线实验实现；
   未重新准入前不得接入生产调用链。
8. 中性 SKC 视觉模型继续离线评测，生产只保留人工确认与颜色规则。

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
- `tmp/ai-provider-specialized-evaluation-20260729/dataset/coverage.json`
- `tmp/ai-provider-specialized-evaluation-20260729/specialized/gold.private.json`
- `tmp/ai-provider-specialized-evaluation-20260729/specialized/scoring-rules.md`
- `tmp/ai-provider-specialized-evaluation-20260729/specialized/runs/20260729T-specialized-new-provider-text-formal-v3/summary.json`
- `tmp/ai-provider-specialized-evaluation-20260729/specialized/runs/20260729T-specialized-1xm-formal-v2/summary.json`
- `tmp/ai-provider-specialized-evaluation-20260729/specialized/runs/20260729T-specialized-overseas-vision-hard-stop-v2/summary.json`
- `tmp/ai-provider-specialized-evaluation-20260729/specialized/runs/20260729T-specialized-trade-reused-v2/summary.json`
- `tmp/ai-provider-specialized-evaluation-20260729/specialized/runs/20260729T-specialized-title-fallback-tiebreak-v2/summary.json`
- `tmp/ai-provider-specialized-evaluation-20260729/specialized/runs/20260729T-specialized-title-cross-provider-fallback-v2/summary.json`

评测产物位于 `tmp/`，是本地证据，不作为运行时配置或生产准入开关。
