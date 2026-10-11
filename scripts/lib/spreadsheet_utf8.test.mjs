import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { TextDecoder } from "node:util";
import {
  createUtf8WorkbookReader,
  decodeUtf8Chunks,
} from "./utf8_workbook_reader.mjs";
import { readSpreadsheetSheetsFromFile } from "./listing_launch_plan_importer.mjs";
import { readSpreadsheetSheetsFromFileInWorker } from "../../web/server/services/spreadsheet-worker.ts";

const requireFromWeb = createRequire(new URL("../../web/package.json", import.meta.url));
const ExcelJS = requireFromWeb("exceljs");
const JSZip = requireFromWeb("jszip");
const parseSax = requireFromWeb("exceljs/lib/utils/parse-sax");

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function sheetXml({ sharedTitle, inlineText }) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="inlineStr"><is><t>${xmlEscape(inlineText)}</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>2</v></c>
      <c r="B2" t="inlineStr"><is><t>${xmlEscape(sharedTitle)}</t></is></c>
      <c r="C2"><v>426</v></c>
    </row>
  </sheetData>
</worksheet>`;
}

async function writeUtf8Fixture(filePath) {
  const zip = new JSZip();
  const sharedTitle = "款号裤装标题🙂".repeat(7_000);
  const inlineText = "内联童装文案🙂".repeat(7_000);
  const richPrefix = "富文本裤装";
  const richSuffix = "上市计划🙂";

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="计划-裤装🙂" sheetId="1" r:id="rId1"/>
    <sheet name="童装复核" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`);
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3">
  <si><t>${xmlEscape(sharedTitle)}</t></si>
  <si><r><t>${xmlEscape(richPrefix)}</t></r><r><t>${xmlEscape(richSuffix)}</t></r></si>
  <si><t>第二行裤装🙂</t></si>
</sst>`);
  zip.file("xl/worksheets/sheet1.xml", sheetXml({ sharedTitle, inlineText }));
  zip.file("xl/worksheets/sheet2.xml", sheetXml({
    sharedTitle: "童装第二页🙂",
    inlineText: "第二页内联裤装🙂".repeat(5_000),
  }));

  const content = await zip.generateAsync({
    type: "nodebuffer",
    compression: "STORE",
    streamFiles: false,
  });
  await writeFile(filePath, content);
  return {
    inlineText,
    richText: `${richPrefix}${richSuffix}`,
    sharedTitle,
  };
}

async function parseTextEvents(chunks) {
  const texts = [];
  for await (const events of parseSax(chunks)) {
    for (const event of events) {
      if (event.eventType === "text") texts.push(event.value);
    }
  }
  return texts.join("");
}

async function readWithUtf8WorkbookReader(filePath) {
  const workbookReader = createUtf8WorkbookReader(ExcelJS, filePath, {
    entries: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
    worksheets: "emit",
  });
  const sheets = [];
  for await (const worksheetReader of workbookReader) {
    const rows = [];
    for await (const row of worksheetReader) rows.push(row.values);
    sheets.push({ name: worksheetReader.name, rows });
  }
  return sheets;
}

function countReplacementChars(value) {
  return JSON.stringify(value).split("\uFFFD").length - 1;
}

test("decodeUtf8Chunks preserves multibyte text split at every byte boundary", async () => {
  const text = "裤装上市🙂童装𠮷";
  const bytes = Buffer.from(text, "utf8");
  for (let split = 1; split < bytes.length; split += 1) {
    const decoded = [];
    for await (const chunk of decodeUtf8Chunks([bytes.subarray(0, split), bytes.subarray(split)])) {
      decoded.push(chunk);
    }
    assert.equal(decoded.join(""), text, `split at byte ${split}`);
  }

  const mixed = [];
  for await (const chunk of decodeUtf8Chunks([
    Buffer.from("裤", "utf8").subarray(0, 1),
    Buffer.from("裤", "utf8").subarray(1),
    "装",
    Buffer.from("🙂童装", "utf8"),
  ])) {
    mixed.push(chunk);
  }
  assert.equal(mixed.join(""), "裤装🙂童装");
});

test("ExcelJS 4.4 SAX decoding corrupts split UTF-8 bytes while the wrapper preserves them", async () => {
  const text = "裤";
  const bytes = Buffer.from(`<root><t>${text}</t></root>`, "utf8");
  const split = bytes.indexOf(Buffer.from(text, "utf8")) + 1;

  const oldDecoded = new TextDecoder("utf-8").decode(bytes.subarray(0, split))
    + new TextDecoder("utf-8").decode(bytes.subarray(split));
  assert.equal(oldDecoded.includes("\uFFFD"), true);
  assert.equal(await parseTextEvents([bytes.subarray(0, split), bytes.subarray(split)]), "\uFFFD��");

  const fixedChunks = [];
  for await (const chunk of decodeUtf8Chunks([bytes.subarray(0, split), bytes.subarray(split)])) {
    fixedChunks.push(chunk);
  }
  assert.equal(await parseTextEvents(fixedChunks), text);
});

test("UTF-8 workbook reader matches stable in-memory ExcelJS for large shared, inline, rich text, and sheet names", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "listingify-utf8-xlsx-"));
  try {
    const filePath = path.join(directory, "utf8-boundaries.xlsx");
    const fixture = await writeUtf8Fixture(filePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    assert.equal(workbook.worksheets[0].name, "计划-裤装🙂");
    assert.equal(workbook.worksheets[0].getCell("A1").value, fixture.sharedTitle);
    assert.equal(workbook.worksheets[0].getCell("B1").value.richText.map((part) => part.text).join(""), fixture.richText);
    assert.equal(workbook.worksheets[0].getCell("C1").value, fixture.inlineText);

    const streamed = await readWithUtf8WorkbookReader(filePath);
    assert.equal(streamed[0].name, "计划-裤装🙂");
    assert.equal(streamed[0].rows[0][1], fixture.sharedTitle);
    assert.equal(streamed[0].rows[0][2].richText.map((part) => part.text).join(""), fixture.richText);
    assert.equal(streamed[0].rows[0][3], fixture.inlineText);
    assert.equal(countReplacementChars(streamed), 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("public spreadsheet readers preserve generated UTF-8 XLSX content in-process and in worker", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "listingify-utf8-public-"));
  try {
    const filePath = path.join(directory, "上市计划-utf8.xlsx");
    const fixture = await writeUtf8Fixture(filePath);

    const direct = await readSpreadsheetSheetsFromFile(filePath, { fileName: "上市计划-utf8.xlsx" });
    assert.equal(direct.length, 2);
    assert.equal(direct[0].name, "计划-裤装🙂");
    assert.equal(direct[0].rows[0]["Column 1"], fixture.sharedTitle);
    assert.equal(direct[0].rows[0]["Column 2"], fixture.richText);
    assert.equal(direct[0].rows[0]["Column 3"], fixture.inlineText);
    assert.equal(countReplacementChars(direct), 0);

    const chunks = [];
    const worker = await readSpreadsheetSheetsFromFileInWorker(filePath, {
      fileName: "上市计划-utf8.xlsx",
      chunkRows: 1,
      onChunk: ({ rowCount }) => chunks.push(rowCount),
    });
    assert.deepEqual(chunks, [1, 1, 1, 1]);
    assert.deepEqual(worker, direct);
    assert.equal(countReplacementChars(worker), 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
