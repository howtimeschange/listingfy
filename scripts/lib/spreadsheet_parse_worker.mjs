import { parentPort, workerData } from "node:worker_threads";
import { streamSpreadsheetSheetsFromFile } from "./listing_launch_plan_importer.mjs";

function errorPayload(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    };
  }
  return {
    name: "Error",
    message: String(error),
    stack: "",
  };
}

function createAcknowledgedSender(port) {
  let sequence = 0;
  const acknowledgements = new Map();
  port.on("message", (message) => {
    if (message?.type !== "ack") return;
    const resolve = acknowledgements.get(message.sequence);
    if (!resolve) return;
    acknowledgements.delete(message.sequence);
    resolve();
  });
  return (message) => new Promise((resolve) => {
    sequence += 1;
    acknowledgements.set(sequence, resolve);
    port.postMessage({ ...message, sequence });
  });
}

async function main() {
  if (!parentPort) throw new Error("spreadsheet_parse_worker must run as a worker thread");
  const filePath = String(workerData?.filePath ?? "");
  const fileName = String(workerData?.fileName ?? filePath);
  if (!filePath) throw new Error("缺少待解析表格文件路径");
  const send = createAcknowledgedSender(parentPort);
  try {
    await streamSpreadsheetSheetsFromFile(filePath, {
      fileName,
      ...workerData?.limits,
      onChunk: (chunk) => send({ type: "chunk", ...chunk }),
      onReset: () => send({ type: "reset" }),
    });
    await send({ type: "done" });
  } catch (error) {
    await send({ type: "error", error: errorPayload(error) });
    process.exitCode = 1;
  } finally {
    parentPort.close();
  }
}

await main();
