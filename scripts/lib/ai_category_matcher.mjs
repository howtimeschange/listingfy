export const DEFAULT_AI_BASE_URL = "https://api.1xm.ai/v1";
export const DEFAULT_AI_MODEL = "gemini-3-flash-preview";
export const DEFAULT_AI_TIMEOUT_MS = 45000;

function readEnv(name, fallback = undefined) {
  const value = process.env[name];
  return value == null || value === "" ? fallback : value;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
}

export function resolveAiConfig({
  baseUrl = readEnv("AI_BASE_URL", DEFAULT_AI_BASE_URL),
  model = readEnv("AI_MODEL", DEFAULT_AI_MODEL),
  apiKey = readEnv("AI_API_KEY"),
  timeoutMs = Number(readEnv("AI_TIMEOUT_MS", DEFAULT_AI_TIMEOUT_MS)),
} = {}) {
  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    model,
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_AI_TIMEOUT_MS,
  };
}

function compactText(value, maxLength = 180) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function compactGroup(group) {
  const skcExamples = Array.isArray(group.skc_examples)
    ? group.skc_examples.slice(0, 8).map((item) => ({
      spu_code: item.spu_code ?? "",
      skc_code: item.skc_code ?? "",
      color_code: item.color_code ?? "",
      color_name: item.color_name ?? "",
      tmall_model_image_url: item.tmall_model_image_url ?? null,
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
              model_gender: "从 TMALL 款色模特图判断：男童 | 女童 | 中性 | 未知",
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
        },
      ],
    },
    meta_rules: [
      "只返回 JSON，不要返回 Markdown，不要解释 JSON 之外的文字。",
      "只能从候选 SHEIN 类目 candidates 中选择 primary 和 alternatives，不能编造 category_id 或 product_type_id。",
      "MDM 小类优先级高于深绘类目；深绘类目优先级高于标题关键词。",
      "同一个 SPU 下不同 SKC/款色可能需要映射到不同 SHEIN 类目，尤其是 MDM 性别为中性、男女童或空值时。",
      "判断中性或男女分叉类目时，必须结合 examples.skc_examples 的 TMALL 款色模特图和颜色；如果款色图显示女童模特，优先女童类目；显示男童模特，优先男童类目。",
      "当同一组合内 SKC 图片或颜色导致男女类目不同，应设置 split_by_skc=true，并在 skc_suggestions 中逐条给出 SKC 级建议。",
      "如果 SKC 缺少 tmall_model_image_url，只能基于文字字段保守判断，并在 risks 或 skc_suggestions.reasons 中说明缺少模特图，不要给过高置信度。",
      "幼童且尺码范围覆盖 073-130 或 080-130 时，优先考虑 SHEIN 女童（小）/男童（小），不要默认选择女童（大）/男童（大）。",
      "不要因为标题包含“宝宝/婴儿”就直接选择婴儿根类目；只有年龄段、尺码范围、深绘类目共同支持时才把婴儿类目作为首选。",
      "性别为中性、男女童、空值时，如果 SHEIN 候选类目按男女分叉，status 应设为 AMBIGUOUS，并给出男女两侧候选。",
      "开襟毛衫/开襟毛衣应优先考虑开襟衫类目；没有开襟衫时再考虑毛衣或针织上衣。",
      "套装、牛仔、泳装、连体裤等细分类目只有输入字段明确出现时才能选择。",
      "confidence >= 0.8 表示可批量确认；0.6-0.79 表示建议人工复核；低于 0.6 表示不建议自动确认。",
    ],
    groups: groups.map(compactGroup),
    candidates: candidates.map(compactCandidate),
  };

  return JSON.stringify(payload, null, 2);
}

export function buildCategoryMatchMessages({ groups, candidates }) {
  const prompt = buildCategoryMatchPrompt({ groups, candidates });
  const seenUrls = new Set();
  const imageParts = [];

  for (const group of groups) {
    const skcExamples = Array.isArray(group.skc_examples) ? group.skc_examples : [];
    for (const example of skcExamples) {
      const url = compactText(example.tmall_model_image_url, 2000);
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);
      imageParts.push({
        type: "image_url",
        image_url: { url },
      });
      if (imageParts.length >= 12) break;
    }
    if (imageParts.length >= 12) break;
  }

  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...imageParts,
      ],
    },
  ];
}

function extractJsonText(text) {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
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
    model_gender: String(value.model_gender ?? "未知").trim() || "未知",
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
    split_by_skc: Boolean(value.split_by_skc),
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
  };
}

export function parseAiCategoryMatchResponse(text) {
  const json = JSON.parse(extractJsonText(text));
  const suggestions = Array.isArray(json) ? json : json.suggestions;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const prompt = buildCategoryMatchPrompt({ groups, candidates });
  const userMessages = buildCategoryMatchMessages({ groups, candidates });

  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "你是跨境电商商品类目映射专家，擅长根据 MDM、深绘内容包和平台类目树做保守匹配。",
          },
          ...userMessages,
        ],
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body?.error?.message ?? body?.message ?? `AI request failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    const content = body?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI response did not include message content");
    }

    return {
      suggestions: parseAiCategoryMatchResponse(content),
      raw: body,
      prompt,
      provider: {
        baseUrl: config.baseUrl,
        model: config.model,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
