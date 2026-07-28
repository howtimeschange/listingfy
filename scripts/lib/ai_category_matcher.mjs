import {
  callAiChatCompletion,
  extractAiJsonText,
  resolveAiConfig,
} from "./ai_chat_client.mjs";

export {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_TIMEOUT_MS,
  resolveAiConfig,
} from "./ai_chat_client.mjs";

function compactText(value, maxLength = 180) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function compactGroup(group) {
  const skcExamples = Array.isArray(group.skc_examples)
    ? group.skc_examples.map((item) => ({
      spu_code: item.spu_code ?? "",
      skc_code: item.skc_code ?? "",
      color_code: item.color_code ?? "",
      color_name: item.color_name ?? "",
      tmall_color_image_url: item.tmall_color_image_url ?? item.tmall_model_image_url ?? null,
    }))
    : [];

  return {
    match_key: group.match_key,
    mdm: {
      middle_category: group.mdm_middle_category_name ?? "",
      small_category: group.mdm_small_category_name ?? "",
      gender: group.gender_name ?? "",
      age_group: group.age_group_name ?? "",
      spec_range: group.spec_range ?? "",
      fabric_type: group.fabric_type_name ?? "",
      model: group.model_name ?? "",
      length: group.length_name ?? "",
    },
    deepdraw: {
      category: group.deepdraw_category_name ?? "",
      trade_path: group.trade_path ?? "",
      title: compactText(group.deepdraw_title, 120),
      fields: group.deepdraw_fields ?? [],
    },
    examples: {
      spus: group.spus ?? [],
      spu_count: group.spu_count ?? 0,
      skc_examples: skcExamples,
    },
  };
}

function compactCandidate(candidate) {
  return {
    category_id: Number(candidate.category_id),
    product_type_id: Number(candidate.product_type_id),
    category_name: candidate.category_name,
    path: candidate.path,
    required_count: Number(candidate.required_count ?? 0),
    attr_count: Number(candidate.attr_count ?? 0),
  };
}

export function buildCategoryMatchPrompt({ groups, candidates }) {
  const payload = {
    task: "为 MDM 商品类目组合推荐最合适的 SHEIN 末级类目",
    output_schema: {
      suggestions: [
        {
          match_key: "必须等于输入 groups[].match_key",
          status: "READY | AMBIGUOUS | NO_MATCH",
          confidence: "0 到 1 的数字",
          primary: {
            category_id: "SHEIN category_id",
            product_type_id: "SHEIN product_type_id",
            category_name: "SHEIN category_name",
            path: "完整类目路径",
          },
          split_by_skc: "true 表示同一 SPU/组合下不同 SKC 可能应该进入不同 SHEIN 类目",
          skc_suggestions: [
            {
              spu_code: "输入 examples.skc_examples[].spu_code",
              skc_code: "输入 examples.skc_examples[].skc_code",
              color_name: "输入 examples.skc_examples[].color_name",
              model_present: "true=确认存在可判断性别的模特；false=确认没有足以判断性别的模特；null=有图片但无法确认是否有模特，或图片不可用",
              model_gender: "只判断图中模特：男童 | 女童 | 未知；没有模特时必须为未知",
              color_gender: "只判断颜色倾向：男童 | 女童 | 中性 | 未知",
              resolved_gender: "最终性别：男童 | 女童 | 未知",
              gender_basis: "最终判断证据：MODEL | COLOR | UNKNOWN",
              confidence: "0 到 1 的数字",
              primary: {
                category_id: "该 SKC 建议的 SHEIN category_id",
                product_type_id: "该 SKC 建议的 SHEIN product_type_id",
                category_name: "该 SKC 建议的 SHEIN category_name",
                path: "完整类目路径",
              },
              alternatives: [
                {
                  category_id: "候选 category_id",
                  product_type_id: "候选 product_type_id",
                  category_name: "候选类目名",
                  path: "候选路径",
                },
              ],
              reasons: ["短理由，说明模特性别、颜色、MDM 字段如何支持判断"],
            },
          ],
          alternatives: [
            {
              category_id: "候选 category_id",
              product_type_id: "候选 product_type_id",
              category_name: "候选类目名",
              path: "候选路径",
            },
          ],
          reasons: ["短理由，说明使用了哪些 MDM/深绘/尺码信号"],
          risks: ["不确定点，例如中性性别、标题与尺码冲突"],
          blocking_risks: ["只有会阻止自动按 SKC 分组建草稿的未解决风险；无阻断风险时必须返回空数组"],
        },
      ],
    },
    meta_rules: [
      "只返回 JSON，不要返回 Markdown，不要解释 JSON 之外的文字。",
      "只能从候选 SHEIN 类目 candidates 中选择 primary 和 alternatives，不能编造 category_id 或 product_type_id。",
      "MDM 小类优先级高于深绘类目；深绘类目优先级高于标题关键词。",
      "同一个 SPU 下不同 SKC/款色可能需要映射到不同 SHEIN 类目，尤其是 MDM 性别为中性、男女童或空值时。",
      "中性款必须为输入 examples.skc_examples 中的每个 SKC 返回且只返回一条 skc_suggestions，不能抽样、遗漏或合并。",
      "性别证据优先级必须是模特性别优先于颜色倾向：仅当 model_present=true 且 model_gender 可明确判断为男童或女童时使用模特证据，颜色不得推翻该结论。",
      "只有没有可识别模特时才允许使用颜色兜底：当 model_present=false 或 null 时允许根据颜色倾向判断性别并设置 gender_basis=COLOR；即使有图片，只要无法确认是否有模特，也可以采用颜色兜底。",
      "若 model_present=true 但 model_gender=未知，必须进入人工确认，不能用颜色覆盖明确存在但性别不明的模特。",
      "无模特时可把铁灰、深灰、卡其等低饱和中性色作为偏男童线索，把风信紫、粉紫等紫粉色作为偏女童线索；这只是兜底线索，颜色不明确时必须返回未知。",
      "无法可靠识别模特性别且颜色也不明确时，resolved_gender 必须为未知、gender_basis 必须为 UNKNOWN，不得强行归类。",
      "当同一组合内 SKC 图片或颜色导致男女类目不同，应设置 split_by_skc=true，并在 skc_suggestions 中逐条给出 SKC 级建议。",
      "如果 SKC 缺少 tmall_color_image_url，只能基于颜色文字保守判断，并在 skc_suggestions.reasons 中说明缺图；颜色结论明确时不要仅因缺图写入 blocking_risks。",
      "risks 可记录说明性信息，例如中性款需要拆分、无模特时使用颜色兜底；这些预期业务事实本身不是阻断风险。",
      "blocking_risks 只记录无法归组、图片与文字冲突、类目无法确认等真正阻止自动建草稿的问题；每个 SKC 均有可靠结论时必须为空数组。",
      "幼童且尺码范围覆盖 073-130 或 080-130 时，优先考虑 SHEIN 女童（小）/男童（小），不要默认选择女童（大）/男童（大）。",
      "不要因为标题包含“宝宝/婴儿”就直接选择婴儿根类目；只有年龄段、尺码范围、深绘类目共同支持时才把婴儿类目作为首选。",
      "性别为中性、男女童、空值时，如果 SHEIN 候选类目按男女分叉，status 应设为 AMBIGUOUS，并给出男女两侧候选。",
      "开襟毛衫/开襟毛衣应优先考虑开襟衫类目；没有开襟衫时再考虑毛衣或针织上衣。",
      "套装、牛仔、泳装、连体裤等细分类目只有输入字段明确出现时才能选择。",
      "一般 SPU 级类目自动选择必须 confidence >= 0.92；中性款逐 SKC 证据完整、类目对有效且 blocking_risks 为空时，自动分组门槛为 confidence >= 0.80；低于对应门槛必须进入人工确认。",
    ],
    groups: groups.map(compactGroup),
    candidates: candidates.map(compactCandidate),
  };

  return JSON.stringify(payload, null, 2);
}

export function buildCategoryMatchMessages({ groups, candidates }) {
  const prompt = buildCategoryMatchPrompt({ groups, candidates });
  const evidenceParts = [];

  for (const group of groups) {
    const skcExamples = Array.isArray(group.skc_examples) ? group.skc_examples : [];
    for (const example of skcExamples) {
      const url = compactText(example.tmall_color_image_url ?? example.tmall_model_image_url, 2000);
      const skcCode = compactText(example.skc_code, 160) ?? "UNKNOWN_SKC";
      const colorName = compactText(example.color_name, 160) ?? "未提供颜色名";
      if (!url) {
        evidenceParts.push({
          type: "text",
          text: `SKC ${skcCode}｜颜色 ${colorName}｜没有可用款色图；仅可按颜色文字保守判断。`,
        });
        continue;
      }
      evidenceParts.push({
        type: "text",
        text: `下图只对应 SKC ${skcCode}｜颜色 ${colorName}。先判断是否有模特；可识别模特以模特性别为准，无法确认是否有模特时可按颜色兜底。`,
      });
      evidenceParts.push({
        type: "image_url",
        image_url: { url },
      });
    }
  }

  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...evidenceParts,
      ],
    },
  ];
}

function normalizeCandidate(value) {
  if (!value || typeof value !== "object") return null;
  const categoryId = Number(value.category_id);
  const productTypeId = Number(value.product_type_id);
  if (!Number.isFinite(categoryId) || !Number.isFinite(productTypeId)) return null;
  return {
    category_id: categoryId,
    product_type_id: productTypeId,
    category_name: String(value.category_name ?? ""),
    path: String(value.path ?? ""),
  };
}

function normalizeSkcSuggestion(value) {
  if (!value || typeof value !== "object") return null;
  const skcCode = String(value.skc_code ?? "").trim();
  const confidence = Number(value.confidence);
  const primary = normalizeCandidate(value.primary);
  if (!skcCode || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;

  return {
    spu_code: String(value.spu_code ?? "").trim(),
    skc_code: skcCode,
    color_name: String(value.color_name ?? "").trim(),
    model_present: normalizeOptionalBoolean(value.model_present),
    model_gender: String(value.model_gender ?? "未知").trim() || "未知",
    color_gender: String(value.color_gender ?? "未知").trim() || "未知",
    resolved_gender: String(value.resolved_gender ?? "未知").trim() || "未知",
    gender_basis: String(value.gender_basis ?? "UNKNOWN").trim().toUpperCase() || "UNKNOWN",
    confidence,
    primary,
    alternatives: Array.isArray(value.alternatives)
      ? value.alternatives.map(normalizeCandidate).filter(Boolean)
      : [],
    reasons: Array.isArray(value.reasons)
      ? value.reasons.map((item) => String(item)).filter(Boolean).slice(0, 6)
      : [],
  };
}

function normalizeOptionalBoolean(value) {
  if (value == null || value === "") return null;
  return normalizeBoolean(value);
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(text)) return true;
    if (["false", "0", "no", "n", ""].includes(text)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return Boolean(value);
}

function normalizeSuggestion(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid AI category suggestion: suggestion must be an object");
  }
  const matchKey = String(value.match_key ?? "").trim();
  const confidence = Number(value.confidence);
  const status = String(value.status ?? "READY").trim().toUpperCase();
  const primary = normalizeCandidate(value.primary);
  if (
    !matchKey
    || !["READY", "AMBIGUOUS", "NO_MATCH"].includes(status)
    || !Number.isFinite(confidence)
    || confidence < 0
    || confidence > 1
    || ((status === "READY" || status === "AMBIGUOUS") && !primary)
  ) {
    throw new Error("Invalid AI category suggestion");
  }

  return {
    match_key: matchKey,
    status,
    confidence,
    primary,
    split_by_skc: normalizeBoolean(value.split_by_skc),
    skc_suggestions: Array.isArray(value.skc_suggestions)
      ? value.skc_suggestions.map(normalizeSkcSuggestion).filter(Boolean)
      : [],
    alternatives: Array.isArray(value.alternatives)
      ? value.alternatives.map(normalizeCandidate).filter(Boolean)
      : [],
    reasons: Array.isArray(value.reasons)
      ? value.reasons.map((item) => String(item)).filter(Boolean).slice(0, 8)
      : [],
    risks: Array.isArray(value.risks)
      ? value.risks.map((item) => String(item)).filter(Boolean).slice(0, 8)
      : [],
    blocking_risks: Array.isArray(value.blocking_risks)
      ? value.blocking_risks.map((item) => String(item)).filter(Boolean).slice(0, 8)
      : [],
  };
}

function looksLikeSuggestionObject(value) {
  return value
    && typeof value === "object"
    && (
      Object.hasOwn(value, "match_key")
      || Object.hasOwn(value, "primary")
      || Object.hasOwn(value, "confidence")
    );
}

function extractSuggestions(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return null;
  for (const key of ["suggestions", "results", "data", "items"]) {
    if (Array.isArray(json[key])) return json[key];
  }
  return looksLikeSuggestionObject(json) ? [json] : null;
}

export function parseAiCategoryMatchResponse(text) {
  const json = JSON.parse(extractAiJsonText(text));
  const suggestions = extractSuggestions(json);
  if (!Array.isArray(suggestions)) {
    throw new Error("Invalid AI category matcher response: missing suggestions array");
  }
  return suggestions.map(normalizeSuggestion);
}

export async function callAiCategoryMatcher({
  groups,
  candidates,
  config = resolveAiConfig(),
  fetchImpl = globalThis.fetch,
}) {
  if (!config.apiKey) {
    throw new Error("Missing required env: AI_API_KEY");
  }
  const prompt = buildCategoryMatchPrompt({ groups, candidates });
  const userMessages = buildCategoryMatchMessages({ groups, candidates });

  for (let responseAttempt = 0; responseAttempt < 2; responseAttempt += 1) {
    const response = await callAiChatCompletion({
      config,
      fetchImpl,
      errorLabel: "AI category matcher",
      messages: [
        {
          role: "system",
          content: responseAttempt === 0
            ? "你是跨境电商商品类目映射专家，擅长根据 MDM、深绘内容包和平台类目树做保守匹配。"
            : "你是跨境电商商品类目映射专家。上一轮结构化输出无法解析；本轮必须返回完整、严格合法且没有尾随文字的 JSON。",
        },
        ...userMessages,
      ],
    });
    try {
      return {
        suggestions: parseAiCategoryMatchResponse(response.content),
        raw: response.raw,
        prompt,
        provider: response.provider,
      };
    } catch (error) {
      const retryableResponse = error instanceof SyntaxError
        || /^Invalid AI category/.test(String(error?.message ?? ""));
      if (responseAttempt === 0 && retryableResponse) continue;
      throw error;
    }
  }

  throw new Error("AI category matcher failed after structured-response retry");
}
