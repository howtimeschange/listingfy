import assert from "node:assert/strict";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VALID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const VALID_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAgICAgIDAgIDBQMDAwUGBQUFBQYIBgYGBgYICggICAgICAoKCgoKCgoKDAwMDAwMDg4ODg4PDw8PDw8PDw8P/9sAQwECAgIEBAQHBAQHEAsJCxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ/90ABAAB/9oADAMBAAIRAxEAPwD9OKKKK+TPUP/Z",
  "base64",
);

const {
  assertUploadFile,
  detectProductArchiveOcrUploadType,
  detectImageUploadType,
  readImageDimensions,
  readValidatedUploadBuffer,
  safeUploadFileName,
} = await import("../../web/server/lib/upload-guard.ts");
const {
  assertLocalImageFile,
} = await import("../../web/server/lib/local-path-guard.ts");

function file(bytes, name, type = "") {
  return new File([Buffer.from(bytes)], name, { type });
}

async function withEnv(values, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("upload guard rejects oversized spreadsheets and unexpected spreadsheet payloads", async () => {
  await withEnv({ LISTINGIFY_MAX_SPREADSHEET_UPLOAD_MB: "1" }, async () => {
    await assert.rejects(
      () => readValidatedUploadBuffer(file(Buffer.alloc(1024 * 1024 + 1), "launch-plan.xlsx"), "spreadsheet"),
      /文件过大/,
    );
  });

  assert.throws(
    () => assertUploadFile(file("hello", "malware.txt", "text/plain"), "spreadsheet"),
    /仅支持/,
  );
  await assert.rejects(
    () => readValidatedUploadBuffer(file("MZ executable", "fake.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "spreadsheet"),
    /不是有效的 Excel 文件/,
  );
  await assert.doesNotReject(() => readValidatedUploadBuffer(file("a,b\n1,2\n", "rows.csv", "text/csv"), "spreadsheet"));
  await assert.doesNotReject(() => readValidatedUploadBuffer(file([0x50, 0x4b, 0x03, 0x04, 1, 2], "rows.xlsx"), "spreadsheet"));
  await assert.doesNotReject(() => readValidatedUploadBuffer(file([0x50, 0x4b, 0x05, 0x06, 1, 2], "empty.xlsx"), "spreadsheet"));
  await assert.doesNotReject(() => readValidatedUploadBuffer(file([0x50, 0x4b, 0x07, 0x08, 1, 2], "spanned.xlsx"), "spreadsheet"));
  await assert.rejects(
    () => readValidatedUploadBuffer(file([0x50, 0x4b, 0x03, 0x06, 1, 2], "crossed.xlsx"), "spreadsheet"),
    /不是有效的 Excel 文件/,
  );
});

test("upload guard verifies image size, extension, MIME, and magic bytes", async () => {
  await withEnv({ LISTINGIFY_MAX_IMAGE_UPLOAD_MB: "1" }, async () => {
    await assert.rejects(
      () => readValidatedUploadBuffer(file(Buffer.alloc(1024 * 1024 + 1), "large.jpg", "image/jpeg"), "image"),
      /文件过大/,
    );
  });

  await assert.rejects(
    () => readValidatedUploadBuffer(file("not an image", "note.jpg", "image/jpeg"), "image"),
    /不是支持的图片/,
  );
  assert.deepEqual(detectImageUploadType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), { extension: ".jpg", contentType: "image/jpeg" });
  assert.deepEqual(detectImageUploadType(PNG_BYTES), { extension: ".png", contentType: "image/png" });
  assert.deepEqual(detectImageUploadType(Buffer.from("RIFFxxxxWEBP", "ascii")), { extension: ".webp", contentType: "image/webp" });
  assert.throws(
    () => detectImageUploadType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00])),
    /不是支持的图片文件/,
  );
});

test("upload guard accepts only PDF JPG and PNG for product archive OCR imports", async () => {
  await withEnv({ LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_UPLOAD_MB: "1" }, async () => {
    await assert.rejects(
      () => readValidatedUploadBuffer(file(Buffer.alloc(1024 * 1024 + 1), "large.pdf", "application/pdf"), "product_archive_ocr"),
      /文件过大/,
    );
  });

  assert.deepEqual(
    detectProductArchiveOcrUploadType(Buffer.from("%PDF-1.7\n", "ascii")),
    { extension: ".pdf", contentType: "application/pdf" },
  );
  assert.deepEqual(detectProductArchiveOcrUploadType(VALID_JPEG), { extension: ".jpg", contentType: "image/jpeg" });
  assert.deepEqual(detectProductArchiveOcrUploadType(PNG_BYTES), { extension: ".png", contentType: "image/png" });
  await assert.doesNotReject(() => readValidatedUploadBuffer(file(Buffer.from("%PDF-1.7\n", "ascii"), "hangtag.pdf", "application/pdf"), "product_archive_ocr"));
  await assert.rejects(
    () => readValidatedUploadBuffer(file("not a pdf", "hangtag.pdf", "application/pdf"), "product_archive_ocr"),
    /不是支持的图片|不是支持的吊牌\/洗唛/,
  );
  await assert.rejects(
    () => readValidatedUploadBuffer(file(Buffer.from("RIFFxxxxWEBP", "ascii"), "wash.webp", "image/webp"), "product_archive_ocr"),
    /仅支持|不支持 WEBP/,
  );
});

test("upload guard reads JPEG and PNG dimensions before SHEIN image validation", () => {
  const sofOnlyJpeg = Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    0x06, 0xf9,
    0x05, 0x3c,
    0x03, 0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
  const truncatedPng = Buffer.alloc(24);
  PNG_BYTES.copy(truncatedPng, 0);
  truncatedPng.writeUInt32BE(1200, 16);
  truncatedPng.writeUInt32BE(1200, 20);

  assert.deepEqual(readImageDimensions(VALID_JPEG), { width: 1, height: 1 });
  assert.deepEqual(readImageDimensions(VALID_PNG), { width: 1, height: 1 });
  assert.throws(
    () => readImageDimensions(sofOnlyJpeg),
    /无法读取图片尺寸/,
  );
  assert.throws(
    () => readImageDimensions(truncatedPng),
    /无法读取图片尺寸/,
  );
  assert.throws(
    () => readImageDimensions(Buffer.from([0xff, 0xd8, 0xff, 0xd9])),
    /无法读取图片尺寸/,
  );
});

test("safe upload names include a random suffix to avoid same-millisecond collisions", () => {
  const first = safeUploadFileName("same.xlsx", { fallbackName: "upload.xlsx" });
  const second = safeUploadFileName("same.xlsx", { fallbackName: "upload.xlsx" });

  assert.notEqual(first, second);
  assert.match(first, /^\d+-[0-9a-f-]{36}-same\.xlsx$/);
  assert.match(safeUploadFileName("photo.jpeg", { fallbackName: "image", extension: ".jpg" }), /^\d+-[0-9a-f-]{36}-photo\.jpg$/);
});

test("local path guard serves only real image files inside the controlled asset root", async () => {
  const root = await fsTempDir("listingify-assets-");
  const outside = await fsTempDir("listingify-outside-");
  try {
    const valid = path.join(root, "listing", "image.png");
    await mkdir(path.dirname(valid), { recursive: true });
    await writeFile(valid, PNG_BYTES);

    const result = await assertLocalImageFile({ rootDir: root, filePath: valid });
    assert.equal(result.contentType, "image/png");

    const escaped = path.join(outside, "secret.png");
    await writeFile(escaped, PNG_BYTES);
    await assert.rejects(() => assertLocalImageFile({ rootDir: root, filePath: escaped }), /图片不存在/);

    const link = path.join(root, "listing", "escape.png");
    await symlink(escaped, link);
    await assert.rejects(() => assertLocalImageFile({ rootDir: root, filePath: link }), /图片不存在/);

    const text = path.join(root, "listing", "note.txt");
    await writeFile(text, "not an image");
    await assert.rejects(() => assertLocalImageFile({ rootDir: root, filePath: text }), /不是支持的图片/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("folder image import validates real files inside the selected folder before copying", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /function resolveImportImageSource/);
  assert.match(source, /fs\.lstatSync\(filePath\)/);
  assert.match(source, /\.isSymbolicLink\(\)/);
  assert.match(source, /fs\.realpathSync\(filePath\)/);
  assert.match(source, /isPathInside\(folderRealPath,\s*sourceRealPath\)/);
  assert.match(source, /sourcePath:\s*sourceFile\.realPath/);
  assert.doesNotMatch(source, /const fileSize = fs\.statSync\(filePath\)\.size/);
});

async function fsTempDir(prefix) {
  return await import("node:fs/promises").then((fs) => fs.mkdtemp(path.join(os.tmpdir(), prefix)));
}
