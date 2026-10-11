import { StringDecoder } from "node:string_decoder";

/** Preserve UTF-8 characters that span ZIP-entry chunks before ExcelJS parses XML. */
export async function* decodeUtf8Chunks(iterable) {
  const decoder = new StringDecoder("utf8");
  for await (const chunk of iterable) {
    if (typeof chunk === "string") {
      const pending = decoder.end();
      if (pending) yield pending;
      yield chunk;
    } else {
      const text = decoder.write(chunk);
      if (text) yield text;
    }
  }
  const remaining = decoder.end();
  if (remaining) yield remaining;
}

function decodeEntry(entry) {
  // Readable.setEncoding uses a per-entry StringDecoder, retaining partial characters.
  entry.setEncoding("utf8");
  return entry;
}

/**
 * ExcelJS 4.4's SAX reader decodes each binary chunk separately. Its XML hooks
 * receive decoded strings here, so shared strings, inline strings, and sheet
 * metadata remain intact without loading a whole workbook into memory.
 */
export function createUtf8WorkbookReader(ExcelJS, input, options) {
  class Utf8WorkbookReader extends ExcelJS.stream.xlsx.WorkbookReader {
    async _parseRels(entry) {
      return super._parseRels(decodeEntry(entry));
    }

    async _parseWorkbook(entry) {
      return super._parseWorkbook(decodeEntry(entry));
    }

    async *_parseSharedStrings(entry) {
      yield* super._parseSharedStrings(decodeEntry(entry));
    }

    async _parseStyles(entry) {
      return super._parseStyles(decodeEntry(entry));
    }

    *_parseWorksheet(iterator, sheetNo) {
      yield* super._parseWorksheet(decodeUtf8Chunks(iterator), sheetNo);
    }

    *_parseHyperlinks(iterator, sheetNo) {
      yield* super._parseHyperlinks(decodeUtf8Chunks(iterator), sheetNo);
    }
  }

  return new Utf8WorkbookReader(input, options);
}
