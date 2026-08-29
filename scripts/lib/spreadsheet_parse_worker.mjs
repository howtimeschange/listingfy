import { parentPort, workerData } from "node:worker_threads";
import { readSpreadsheetSheetsFromFile } from "./listing_launch_plan_importer.mjs";

function errorPayload(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    name: "Error",
    message: String(error),
    stack: "",
  };
}

async function main() {
  if (!parentPort) throw new Error("spreadsheet_parse_worker must run as a worker thread");
  const filePath = String(workerData?.filePath ?? "");
  const fileName = String(workerData?.fileName ?? filePath);
  if (!filePath) throw new Error("缺少待解析表格文件路径");
  try {
    const sheets = await readSpreadsheetSheetsFromFile(filePath, { fileName });
    parentPort.postMessage({ ok: true, sheets });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: errorPayload(error) });
    process.exitCode = 1;
  } finally {
    parentPort.close();
  }
}

await main();
