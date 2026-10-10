// Shared by the draft editor and the PLM builder. Values here are already
// measured values; merging aliases must not apply the PLM half-width conversion.
const text = (value) => String(value ?? "").trim();
const key = (value) => text(value).replace(/\s+/g, "").replace(/[()（）]/g, "").replace(/(?:cm|厘米)$/i, "").toLowerCase();
const riseColumns = new Set(["前浪", "前档", "前裆", "后浪", "后档", "后裆"]);
const metadata = new Set(["title", "ai_fill", "aifill", "confidence", "fallback", "mappings", "reason", "source", "unmatchedtargets"]);

export function sameSizeChartTable(left, right) {
  const signature = (value) => {
    const record = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return JSON.stringify({
      title: text(record.title).split(",").map(text),
      rows: Object.entries(record).filter(([name, cells]) => !metadata.has(key(name)) && text(cells))
        .map(([size, cells]) => [size, text(cells).split(",").map(text)])
        .sort(([a], [b]) => a.localeCompare(b)),
    });
  };
  return signature(left) === signature(right);
}

export function pantsSizeChartColumn(value) {
  return ["脚口", "裤口围", "脚围"].includes(key(value)) ? "脚围" : text(value);
}

export function pantsMainSizeChartColumns(titles = [], context = "") {
  if (/牛仔(?:裤|长裤|短裤|中裤)/.test(text(context).replace(/\s+/g, ""))) {
    return ["尺码", "裤长", "腰围", "臀围", "脚围", "身高", "体重"];
  }
  const output = ["尺码"];
  const seen = new Set(["尺码", "尺寸"]);
  for (const title of titles) {
    if (riseColumns.has(key(title))) continue;
    const normalized = pantsSizeChartColumn(title);
    if (!normalized || seen.has(key(normalized))) continue;
    seen.add(key(normalized));
    output.push(normalized);
  }
  return output;
}

export function normalizePantsMainSizeChartDraft(valueJson, { fieldName = "", context = "" } = {}) {
  const value = valueJson && typeof valueJson === "object" && !Array.isArray(valueJson) ? valueJson : {};
  if (key(fieldName) !== "尺码表" || !/裤/.test(text(context))) return { valueJson: value, conflicts: [], errors: [] };
  const titles = text(value.title).split(",").map(text).filter(Boolean);
  if (!titles.length) return { valueJson: value, conflicts: [], errors: [] };
  const rows = Object.entries(value).filter(([size, cells]) => !metadata.has(key(size)) && typeof cells === "string");
  const errors = rows.filter(([, cells]) => cells.split(",").length !== titles.length)
    .map(([size]) => `${size} 的数值列数与原表头不一致，请先重新构建尺码表`);
  if (errors.length) return { valueJson: value, conflicts: [], errors };
  const columns = pantsMainSizeChartColumns(titles, context);
  const groups = columns.map((column) => titles.flatMap((title, index) => (
    key(pantsSizeChartColumn(title)) === key(column) ? [index] : []
  )));
  const output = { ...value, title: columns.join(",") };
  const conflicts = [];
  // Metadata is retained verbatim; only CSV rows aligned with the original
  // title are projected. Do not interpret rule/AI metadata as a size row.
  for (const [size, rawValues] of rows) {
    const cells = rawValues.split(",").map(text);
    output[size] = columns.map((column, index) => {
      if (index === 0) {
        const numericSize = text(size).match(/^0*(\d{2,3})(?:\s*(?:cm|厘米|公分))?\/?$/i);
        return numericSize ? String(Number(numericSize[1])) : cells[groups[index][0]] ?? text(size);
      }
      const candidates = groups[index].map((slot) => ({ title: titles[slot], value: cells[slot] ?? "" }));
      const meaningful = candidates.filter((cell) => cell.value && !/^0(?:\.0+)?$/.test(cell.value));
      const unique = [...new Set(meaningful.map((cell) => Number.isFinite(Number(cell.value)) ? String(Number(cell.value)) : cell.value))];
      if (column === "脚围" && unique.length > 1) conflicts.push({ size, values: meaningful });
      return meaningful.find((cell) => key(cell.title) === key(column))?.value
        ?? meaningful[0]?.value ?? candidates[0]?.value ?? "";
    }).join(",");
  }
  return { valueJson: output, conflicts, errors: [] };
}
