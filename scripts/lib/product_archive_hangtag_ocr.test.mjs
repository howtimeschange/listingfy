import assert from "node:assert/strict";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
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

const DOWN_FILL_WASHLABEL_TEXT = `
充绒量（单位：克）
110: 72
120: 76
130: 82
140: 88
150: 94
160: 100
`;

async function simpleJpegBuffer({ width = 16, height = 16 } = {}) {
  const sharp = requireFromWeb("sharp");
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).jpeg().toBuffer();
}

function minimalPdfBuffer() {
  const content = "0 0 0 rg 20 180 120 36 re f\n";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 223 256] /Resources << >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}endstream\nendobj\n`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(output, "ascii"));
    output += object;
  }
  const xrefOffset = Buffer.byteLength(output, "ascii");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, "ascii");
}

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

test("hangtag OCR extractor rejects malformed execution standard noise", () => {
  const result = extractHangtagWashlabelFieldsFromOcrText("执行标准:上装: 执行标准:上装:\nQ/BALABALA 104-2022 PAA aed Wie S");

  assert.equal(result.fields.filter((field) => field.key === "executionStandard").length, 1);
  assert.equal(result.fields.find((field) => field.key === "executionStandard")?.value, "Q/BALABALA 104-2022");
});

test("hangtag OCR extractor normalizes compact BALABALA execution standards", () => {
  const result = extractHangtagWashlabelFieldsFromOcrText("执行标准：Q/BALABALA102-2021");

  assert.equal(result.fields.find((field) => field.key === "executionStandard")?.value, "Q/BALABALA 102-2021");
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

test("washlabel OCR extractor keeps down fill weight table text", () => {
  const result = extractHangtagWashlabelFieldsFromOcrText(DOWN_FILL_WASHLABEL_TEXT, {
    pageNumber: 1,
    sourceKind: "washlabel",
  });

  const downFillWeight = result.fields.find((field) => field.key === "downFillWeight");
  assert.ok(downFillWeight);
  assert.match(downFillWeight.value, /110: 72/);
  assert.match(downFillWeight.value, /160: 100/);
  assert.equal(downFillWeight.sourceKind, "washlabel");
});

test("washlabel OCR extractor rejects noisy down fill weight fragments", () => {
  const result = extractHangtagWashlabelFieldsFromOcrText("充绒量 NZ: 0 = :", {
    pageNumber: 1,
    sourceKind: "washlabel",
  });

  assert.equal(result.fields.find((field) => field.key === "downFillWeight"), undefined);
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
  assert.equal(classifyProductArchiveOcrFile("幼童测试洗唛吊牌/201426108203/201426108203_吊牌_yq1.jpg"), "hangtag");
  assert.equal(classifyProductArchiveOcrFile("幼童测试洗唛吊牌/201426108203/201426108203_洗唛_yq2.jpg"), "washlabel");
  assert.equal(classifyProductArchiveOcrFile("幼童测试洗唛吊牌/201426108203/201426108203-90001_有模拍.jpg"), "unknown");
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

test("OCR file recognizer falls back to multimodal vision when OCR extracts no fields", async () => {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "listingify-ocr-vision-fallback-"));
  try {
    const filePath = path.join(workDir, "208426107229洗唛.jpg");
    await writeFile(filePath, await simpleJpegBuffer());
    const visionCalls = [];
    const result = await recognizeProductArchiveOcrFile(
      { filePath, fileName: "208426107229洗唛.jpg", fileType: "image" },
      {
        provider: async () => ({ text: "%%%@ OCR ???", providerKind: "tesseract_js" }),
        preprocessWashlabel: false,
        visionProvider: async (input) => {
          visionCalls.push(input);
          const imagePart = input.messages[1].content.find((part) => part?.type === "image_url");
          assert.match(imagePart.image_url.url, /^data:image\/jpeg;base64,/);
          return {
            providerKind: "ai_vision",
            json: {
              style_code: "208426107229",
              raw_text: "充绒量（单位：克）\n80 90 100 110 120 130\n73 83 94 108 123 138",
              fields: [
                {
                  key: "downFillWeight",
                  label: "充绒量",
                  value: "80 90 100 110 120 130\n73 83 94 108 123 138",
                  confidence: "high",
                  evidence_text: "洗唛中部充绒量表格",
                },
              ],
            },
          };
        },
      },
    );

    assert.equal(visionCalls.length, 1);
    assert.equal(result.status, "recognized");
    assert.equal(result.detectedSpuCode, "208426107229");
    assert.deepEqual(result.providerKinds, ["tesseract_js", "ai_vision"]);
    assert.match(result.warnings.join("\n"), /已使用多模态模型兜底识别/);
    assert.equal(
      result.fields.find((field) => field.key === "downFillWeight")?.value,
      "80 90 100 110 120 130\n73 83 94 108 123 138",
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test("OCR quality agent rejects noisy fields before multimodal vision fallback", async () => {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "listingify-ocr-quality-fallback-"));
  try {
    const filePath = path.join(workDir, "208426107229洗唛.jpg");
    await writeFile(filePath, await simpleJpegBuffer());
    const qualityCalls = [];
    const visionCalls = [];
    const result = await recognizeProductArchiveOcrFile(
      { filePath, fileName: "208426107229洗唛.jpg", fileType: "image" },
      {
        provider: async () => ({
          text: "充绒量（单位：克）\n80 90 100\n73 83 94\n208426107229",
          providerKind: "tesseract_js",
        }),
        preprocessWashlabel: false,
        ocrQualityProvider: async (input) => {
          qualityCalls.push(input);
          assert.match(input.messages[1].content, /充绒量/);
          return {
            providerKind: "ai_quality",
            json: {
              verdict: "reject",
              fallback_required: true,
              reason: "OCR 字段与证据不稳定，需要看原图",
              field_reviews: [
                { key: "downFillWeight", verdict: "reject", reason: "克重表疑似误读" },
              ],
            },
          };
        },
        visionProvider: async () => {
          visionCalls.push(true);
          return {
            providerKind: "ai_vision",
            json: {
              style_code: "208426107229",
              fields: [
                {
                  key: "downFillWeight",
                  label: "充绒量",
                  value: "80 90 100\n60 68 79",
                  confidence: "high",
                },
              ],
            },
          };
        },
      },
    );

    assert.equal(qualityCalls.length, 1);
    assert.equal(visionCalls.length, 1);
    assert.deepEqual(result.providerKinds, ["tesseract_js", "ai_quality", "ai_vision"]);
    assert.match(result.warnings.join("\n"), /AI OCR质检判定不可信/);
    assert.match(result.warnings.join("\n"), /AI OCR质检判定识别不可靠.*已使用多模态模型兜底识别/);
    assert.equal(result.fields.find((field) => field.key === "downFillWeight")?.value, "80 90 100\n60 68 79");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test("OCR vision fallback keeps the original washlabel image when the preprocessed OCR crop is gone", async () => {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "listingify-ocr-vision-original-"));
  try {
    const filePath = path.join(workDir, "208426107229洗唛.jpg");
    await writeFile(filePath, await simpleJpegBuffer({ width: 900, height: 900 }));
    const visionCalls = [];
    const result = await recognizeProductArchiveOcrFile(
      { filePath, fileName: "208426107229洗唛.jpg", fileType: "image" },
      {
        provider: async (imagePath) => {
          await unlink(imagePath);
          return { text: "%%%@ OCR ???", providerKind: "tesseract_js" };
        },
        visionProvider: async (input) => {
          visionCalls.push(input);
          const imageParts = input.messages[1].content.filter((part) => part?.type === "image_url");
          assert.equal(imageParts.length, 1);
          assert.match(imageParts[0].image_url.url, /^data:image\/jpeg;base64,/);
          return {
            providerKind: "ai_vision",
            json: {
              style_code: "208426107229",
              fields: [{
                key: "downFillWeight",
                label: "充绒量",
                value: "80 90 100\n73 83 94",
                confidence: "high",
              }],
            },
          };
        },
      },
    );

    assert.equal(visionCalls.length, 1);
    assert.equal(result.status, "recognized");
    assert.equal(result.fields.find((field) => field.key === "downFillWeight")?.value, "80 90 100\n73 83 94");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test("OCR vision fallback re-renders PDF when the OCR page image is unavailable", async () => {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "listingify-ocr-vision-pdf-rerender-"));
  try {
    const filePath = path.join(workDir, "208426107013洗唛.pdf");
    await writeFile(filePath, minimalPdfBuffer());
    const visionCalls = [];
    const result = await recognizeProductArchiveOcrFile(
      { filePath, fileName: "208426107013洗唛.pdf", fileType: "pdf" },
      {
        provider: async (imagePath) => {
          await unlink(imagePath);
          return { text: "", providerKind: "tesseract_js" };
        },
        ocrQualityGate: false,
        visionProvider: async (input) => {
          visionCalls.push(input);
          assert.equal(input.imagePayloads.length, 1);
          assert.match(input.imagePayloads[0].dataUrl, /^data:image\/jpeg;base64,/);
          return {
            providerKind: "ai_vision",
            json: {
              style_code: "208426107013",
              fields: [{
                key: "downFillWeight",
                label: "充绒量",
                value: "80 90 100 110 120 130\n60 68 79 90 103 116",
                confidence: "high",
              }],
            },
          };
        },
      },
    );

    assert.equal(visionCalls.length, 1);
    assert.deepEqual(result.providerKinds, ["tesseract_js", "ai_vision"]);
    assert.match(result.warnings.join("\n"), /多模态兜底已重新渲染PDF图片/);
    assert.equal(
      result.fields.find((field) => field.key === "downFillWeight")?.value,
      "80 90 100 110 120 130\n60 68 79 90 103 116",
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test("OCR file recognizer falls back to multimodal vision when OCR provider fails", async () => {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "listingify-ocr-provider-failed-"));
  try {
    const filePath = path.join(workDir, "208426103215吊牌.jpg");
    await writeFile(filePath, await simpleJpegBuffer());
    const result = await recognizeProductArchiveOcrFile(
      { filePath, fileName: "208426103215吊牌.jpg", fileType: "image" },
      {
        provider: async () => {
          throw new Error("tesseract crashed");
        },
        preprocessWashlabel: false,
        visionProvider: async () => ({
          providerKind: "ai_vision",
          json: {
            style_code: "208426103215",
            fields: [
              {
                key: "executionStandard",
                label: "执行标准",
                value: "Q/BALABALA 104-2022",
                confidence: "high",
              },
            ],
          },
        }),
      },
    );

    assert.equal(result.status, "recognized");
    assert.equal(result.error, null);
    assert.deepEqual(result.providerKinds, ["ai_vision"]);
    assert.equal(result.fields.find((field) => field.key === "executionStandard")?.value, "Q/BALABALA 104-2022");
    assert.match(result.warnings.join("\n"), /OCR 识别失败，已使用多模态模型兜底识别/);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
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
