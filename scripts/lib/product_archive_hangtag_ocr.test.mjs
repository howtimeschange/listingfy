import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  analyzeProductArchiveOcrDocument,
  classifyProductArchiveOcrFile,
  extractHangtagWashlabelFieldsFromOcrText,
  extractStyleCodesFromText,
  normalizeScmChineseCompositionText,
  productArchiveOcrFileType,
  readScmHangtagWashlabelSupplementWorkbook,
  recognizeProductArchiveOcrFile,
} from "./product_archive_hangtag_ocr.mjs";

const requireFromWeb = createRequire(new URL("../../web/package.json", import.meta.url));

const SAMPLE_HANGTAG_OCR = `
产品名称：针织衫
产品货号：208426103215
执行标准：Q/BALABALA 104-2022
产品等级：合格品
贮藏要求：防霉防蛀等
安全技术类别：符合GB 31701 A类
`;

const REAL_VISION_HANGTAG_TEXT = `
产品名称：针织衫
产品货号：208426103215-
执行标准：Q/BALABALA 104-2022-
产品等级：合格品
安全技术类别：符合GB 31701
A类（婴幼儿用品）
`;

const REAL_WASHLABEL_TEXT = `
成分
主面料：100%聚酯纤维
（装饰部分除外）
下摆罗纹：96.4%聚酯纤维
3.2%锦纶
0.4%氨纶
洗涤说明
不可干洗
本商品建议单独洗涤，如有轻
微褪色属正常现象，为保持衣
服色泽，衣服不宜久浸。
中国制造
208426103215
`;

const NOISY_TESSERACT_HANGTAG_TEXT = `
产品名称i 针织衫 产品名称
一 产品货号:208426103215 款号
执行标准:Q/BALABALA 104-2022 执行标准
产品等级:合格品 产品等级
安全技术类别:符合GB 31701 安全技术类别1
A弥(骝幼儿用品) 安全技术类别
`;

const NOISY_TESSERACT_WASHLABEL_TEXT = `
成分
主面料: 10026聚酯纤维
t 装饰部分除外 )
下摆罗纹: 96.4%6聚酯纤维
3.20%6锣纶
0.426氨纶
洗涤说明 2
不可干活
本商品建议单独洗涤,如有绍
做褪色属正常环象, 为保持衣
服色泽,衣服不宥久浸.
中国制遂
208426103215
`;

test("hangtag OCR extractor reads compliance fields and style code from real label text", () => {
  const result = extractHangtagWashlabelFieldsFromOcrText(SAMPLE_HANGTAG_OCR, {
    pageNumber: 2,
    sourceKind: "hangtag",
  });

  assert.deepEqual(result.styleCodes, ["208426103215"]);
  assert.deepEqual(
    result.fields.map((field) => [field.key, field.value, field.confidence, field.pageNumber, field.sourceKind]),
    [
      ["productName", "针织衫", "high", 2, "hangtag"],
      ["articleNo", "208426103215", "high", 2, "hangtag"],
      ["executionStandard", "Q/BALABALA 104-2022", "high", 2, "hangtag"],
      ["safetyCategory", "符合GB 31701 A类", "high", 2, "hangtag"],
      ["productGrade", "合格品", "high", 2, "hangtag"],
    ],
  );
});

test("hangtag OCR extractor falls back to standard and safety regexes when labels are sparse", () => {
  const result = extractHangtagWashlabelFieldsFromOcrText("Q / BALABALA 104 - 2022\n符合 GB31701B 类\n合格品");

  assert.deepEqual(result.fields.map((field) => [field.key, field.value, field.confidence]), [
    ["executionStandard", "Q/BALABALA 104-2022", "medium"],
    ["safetyCategory", "符合 GB 31701 B类", "medium"],
    ["productGrade", "合格品", "medium"],
  ]);
});

test("hangtag OCR document analysis prefers filename code and warns on OCR mismatch", () => {
  const document = analyzeProductArchiveOcrDocument({
    fileName: "PRC1403650-展鑫208426103215吊牌.pdf",
    pages: [{ pageNumber: 1, text: SAMPLE_HANGTAG_OCR.replace("208426103215", "208426103216") }],
  });

  assert.equal(document.fileType, "pdf");
  assert.equal(document.sourceKind, "hangtag");
  assert.equal(document.detectedSpuCode, "208426103215");
  assert.deepEqual(document.styleCodes, ["208426103215", "208426103216"]);
  assert.match(document.warnings.join("\n"), /文件名款号 208426103215 与 OCR 款号 208426103216 不一致/);
  assert.equal(document.fields.find((field) => field.key === "executionStandard")?.value, "Q/BALABALA 104-2022");
});

test("hangtag OCR extractor handles real Vision line breaks and trailing OCR hyphens", () => {
  const result = extractHangtagWashlabelFieldsFromOcrText(REAL_VISION_HANGTAG_TEXT, {
    pageNumber: 1,
    sourceKind: "hangtag",
  });

  assert.equal(result.fields.find((field) => field.key === "articleNo")?.value, "208426103215");
  assert.equal(result.fields.find((field) => field.key === "executionStandard")?.value, "Q/BALABALA 104-2022");
  assert.equal(result.fields.find((field) => field.key === "safetyCategory")?.value, "符合GB 31701 A类");
});

test("washlabel OCR extractor keeps multiline composition and wash-care blocks", () => {
  const result = extractHangtagWashlabelFieldsFromOcrText(REAL_WASHLABEL_TEXT, {
    pageNumber: 1,
    sourceKind: "washlabel",
  });

  assert.deepEqual(result.styleCodes, ["208426103215"]);
  assert.equal(
    result.fields.find((field) => field.key === "materialComposition")?.value,
    "主面料:100%聚酯纤维\n（装饰部分除外）\n下摆罗纹:96.4%聚酯纤维\n3.2%锦纶\n0.4%氨纶",
  );
  assert.equal(
    result.fields.find((field) => field.key === "washCare")?.value,
    "不可干洗\n本商品建议单独洗涤，如有轻\n微褪色属正常现象，为保持衣\n服色泽，衣服不宜久浸",
  );
});

test("hangtag OCR extractor cleans noisy Tesseract table text before mapping fields", () => {
  const result = extractHangtagWashlabelFieldsFromOcrText(NOISY_TESSERACT_HANGTAG_TEXT, {
    pageNumber: 1,
    sourceKind: "hangtag",
  });

  assert.equal(result.fields.find((field) => field.key === "productName")?.value, "针织衫");
  assert.equal(result.fields.find((field) => field.key === "articleNo")?.value, "208426103215");
  assert.equal(result.fields.find((field) => field.key === "executionStandard")?.value, "Q/BALABALA 104-2022");
  assert.equal(result.fields.find((field) => field.key === "safetyCategory")?.value, "符合GB 31701 A类");
  assert.equal(result.fields.find((field) => field.key === "productGrade")?.value, "合格品");
});

test("washlabel OCR extractor cleans common Tesseract percent and care-text noise", () => {
  const result = extractHangtagWashlabelFieldsFromOcrText(NOISY_TESSERACT_WASHLABEL_TEXT, {
    pageNumber: 1,
    sourceKind: "washlabel",
  });

  assert.equal(
    result.fields.find((field) => field.key === "materialComposition")?.value,
    "主面料: 100%聚酯纤维\n(装饰部分除外)\n下摆罗纹: 96.4%聚酯纤维\n3.2%锦纶\n0.4%氨纶",
  );
  assert.equal(
    result.fields.find((field) => field.key === "washCare")?.value,
    "不可干洗\n本商品建议单独洗涤,如有轻\n微褪色属正常现象, 为保持衣\n服色泽,衣服不宜久浸",
  );
});

test("hangtag OCR helpers classify batch file names", () => {
  assert.equal(classifyProductArchiveOcrFile("208426103215洗唛.jpg"), "washlabel");
  assert.equal(classifyProductArchiveOcrFile("208426103215%E6%B4%97%E5%94%9B.jpg"), "washlabel");
  assert.equal(classifyProductArchiveOcrFile("PRC-208426103215-吊牌.pdf"), "hangtag");
  assert.equal(productArchiveOcrFileType("hangtag.pdf"), "pdf");
  assert.equal(productArchiveOcrFileType("washlabel.jpeg"), "image");
  assert.deepEqual(extractStyleCodesFromText("x 208426103215 y 208426103215"), ["208426103215"]);
});

test("OCR file recognizer accepts an injected provider for deterministic tests", async () => {
  const result = await recognizeProductArchiveOcrFile(
    { filePath: "/tmp/208426103215洗唛.jpg", fileName: "208426103215洗唛.jpg", fileType: "image" },
    { provider: async () => SAMPLE_HANGTAG_OCR, preprocessWashlabel: false },
  );

  assert.equal(result.status, "recognized");
  assert.equal(result.detectedSpuCode, "208426103215");
  assert.deepEqual(result.providerKinds, ["injected"]);
  assert.equal(result.sourceKind, "washlabel");
  assert.equal(result.fields.find((field) => field.key === "safetyCategory")?.value, "符合GB 31701 A类");
});

test("OCR file recognizer records provider metadata returned by providers", async () => {
  const result = await recognizeProductArchiveOcrFile(
    { filePath: "/tmp/208426103215洗唛.jpg", fileName: "208426103215洗唛.jpg", fileType: "image" },
    { provider: async () => ({ text: SAMPLE_HANGTAG_OCR, providerKind: "tesseract_js" }), preprocessWashlabel: false },
  );

  assert.equal(result.status, "recognized");
  assert.deepEqual(result.providerKinds, ["tesseract_js"]);
});

test("SCM wash-hangtag workbook rows become composition supplement documents", async () => {
  const ExcelJS = requireFromWeb("exceljs");
  const workDir = await mkdtemp(path.join(os.tmpdir(), "listingify-scm-ocr-workbook-"));
  try {
    const filePath = path.join(workDir, "SCM洗唛吊牌下载结果.xlsx");
    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet("成分汇总");
    summary.addRow(["款号", "款名", "中文成分", "查询结果"]);
    summary.addRow([
      "208426103215",
      "儿童针织衫",
      "成分主面料:100%聚酯纤维(装饰部分除外)下摆罗纹:96.4%聚酯纤维3.2%锦纶0.4%氨纶",
      "成功",
    ]);
    const detail = workbook.addWorksheet("下载明细");
    detail.addRow(["款号", "文件类型", "文件名", "中文成分", "下载结果"]);
    detail.addRow([
      "208426103215",
      "洗唛文件",
      "208426103215洗唛.jpg",
      "成分主面料:100%聚酯纤维(装饰部分除外)下摆罗纹:96.4%聚酯纤维3.2%锦纶0.4%氨纶",
      "已下载",
    ]);
    await workbook.xlsx.writeFile(filePath);

    const parsed = await readScmHangtagWashlabelSupplementWorkbook(filePath, {
      fileName: "SCM洗唛吊牌下载结果.xlsx",
    });

    assert.equal(parsed.sheetCount, 2);
    assert.equal(parsed.documentCount, 1);
    assert.equal(parsed.documents[0].sourceKind, "scm_list");
    assert.equal(parsed.documents[0].detectedSpuCode, "208426103215");
    assert.equal(parsed.documents[0].fields[0].key, "materialComposition");
    assert.equal(
      parsed.documents[0].fields[0].value,
      "主面料: 100%聚酯纤维\n(装饰部分除外)\n下摆罗纹: 96.4%聚酯纤维\n3.2%锦纶\n0.4%氨纶",
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test("SCM composition text normalizer formats dense Chinese composition text", () => {
  assert.equal(
    normalizeScmChineseCompositionText("成分主面料:100%聚酯纤维(装饰部分除外)下摆罗纹:96.4%聚酯纤维3.2%锦纶0.4%氨纶"),
    "主面料: 100%聚酯纤维\n(装饰部分除外)\n下摆罗纹: 96.4%聚酯纤维\n3.2%锦纶\n0.4%氨纶",
  );
});
