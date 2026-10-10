import assert from "node:assert/strict";
import test from "node:test";
import { normalizePantsMainSizeChartDraft, sameSizeChartTable } from "../../web/src/lib/pants-size-chart-schema.mjs";
import { buildSizeChartForTemplate } from "./product_archive_size_chart.mjs";

const options = { fieldName: "尺码表", context: "童装/裤装/长裤" };
const oldValue = {
  title: "腰围,臀围,尺码,后裆,大腿围,脚口,裤长,身高,体重,前档,裤口围",
  "110cm": "51,76,110cm,31.5,23.9,21,61.5,110,17,24.4,21",
  "140cm": "58,88,140cm,36,27.8,24,82.5,140,31,28,24",
};

test("old pants draft merges foot aliases without scaling and matches final build columns and values", () => {
  const draft = normalizePantsMainSizeChartDraft(oldValue, options);
  assert.deepEqual(draft.conflicts, []);
  assert.deepEqual(draft.valueJson, {
    title: "尺码,腰围,臀围,大腿围,脚围,裤长,身高,体重",
    "110cm": "110,51,76,23.9,21,61.5,110,17",
    "140cm": "140,58,88,27.8,24,82.5,140,31",
  });
  const source = [
    ["1/2腰围（平量）", "29"], ["1/2臀围", "44"], ["1/2脾围", "27.8"],
    ["1/2脚口（平量）", "12"], ["裤长", "82.5"],
  ].map(([point, value]) => ({ 款号: "sample", 测量点: point, 尺码: "140/", 尺码值: value }));
  const built = buildSizeChartForTemplate({ rows: source, spuCode: "sample", template: { fieldName: "尺码表", options: oldValue.title.split(",") }, garmentType: "长裤", gender: "女童" });
  assert.equal(draft.valueJson.title, built.valueJson.title);
  assert.equal(draft.valueJson["140cm"], built.valueJson["140cm"]);
  assert.deepEqual(normalizePantsMainSizeChartDraft(draft.valueJson, options), draft);
});

test("merged foot column fills a blank alias, retains metadata, and reports conflicting measurements", () => {
  const result = normalizePantsMainSizeChartDraft({ title: "脚口,裤口围,脚围", "110cm": ",21,0", "140cm": "24,25,26", mappings: [{ sourcePoint: "PLM" }] }, options);
  assert.equal(result.valueJson["110cm"], "110,21");
  assert.equal(result.valueJson["140cm"], "140,26");
  assert.deepEqual(result.valueJson.mappings, [{ sourcePoint: "PLM" }]);
  assert.deepEqual(result.conflicts, [{ size: "140cm", values: [{ title: "脚口", value: "24" }, { title: "裤口围", value: "25" }, { title: "脚围", value: "26" }] }]);
});

test("pants draft projection is limited to the main table and uses the denim fixed schema", () => {
  assert.equal(normalizePantsMainSizeChartDraft(oldValue, { ...options, context: "童装/上衣" }).valueJson, oldValue);
  assert.equal(normalizePantsMainSizeChartDraft(oldValue, { ...options, fieldName: "唯品会尺码表" }).valueJson, oldValue);
  const denim = normalizePantsMainSizeChartDraft(oldValue, { ...options, context: "牛仔长裤" });
  assert.equal(denim.valueJson.title, "尺码,裤长,腰围,臀围,脚围,身高,体重");
  assert.equal(denim.valueJson["140cm"], "140,82.5,58,88,24,140,31");
});

test("malformed old rows keep their original alignment and block projection for review", () => {
  const value = { title: "腰围,脚口", "140cm": "58,24,82.5" };
  const result = normalizePantsMainSizeChartDraft(value, options);
  assert.equal(result.valueJson, value);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.errors, ["140cm 的数值列数与原表头不一致，请先重新构建尺码表"]);
});

test("saved-table comparison ignores JSONB key ordering and metadata but detects value and column changes", () => {
  const saved = { "140cm": "140,24", "110cm": "110,21", title: "尺码,脚围", mappings: [] };
  assert.equal(sameSizeChartTable(saved, { title: "尺码,脚围", "110cm": "110,21", "140cm": "140,24" }), true);
  assert.equal(sameSizeChartTable(saved, { title: "尺码,脚围", "110cm": "110,21", "140cm": "140,25" }), false);
  assert.equal(sameSizeChartTable(saved, { title: "脚围,尺码", "110cm": "21,110", "140cm": "24,140" }), false);
});
