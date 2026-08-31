import fs from "node:fs";
import { workerData } from "node:worker_threads";
import { createRequire } from "node:module";

const requireFromWeb = createRequire(new URL("../../web/package.json", import.meta.url));
const { Client, types } = requireFromWeb("pg");

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(700, (value) => Number(value));
types.setTypeParser(701, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

const state = new Int32Array(workerData.sharedBuffer);

function createClient() {
  return new Client({
    connectionString: workerData.databaseUrl,
    connectionTimeoutMillis: Number(workerData.connectionTimeoutMillis ?? 3000),
  });
}

let client = createClient();
let connected = false;

async function resetClient() {
  const current = client;
  client = createClient();
  connected = false;
  try {
    await current.end();
  } catch {
    // A failed connection attempt can leave the pg Client unable to end cleanly.
  }
}

async function ensureConnected() {
  if (connected) return;
  try {
    await client.connect();
    connected = true;
  } catch (error) {
    await resetClient();
    throw error;
  }
}

function readRequest() {
  return JSON.parse(fs.readFileSync(workerData.requestPath, "utf8"));
}

function writeResponse(payload) {
  fs.writeFileSync(workerData.responsePath, JSON.stringify(payload));
}

async function handleRequest(request) {
  if (request.action === "close") {
    if (connected) await client.end();
    connected = false;
    return { ok: true, close: true };
  }

  if (request.action !== "query") {
    throw new Error(`Unknown PostgreSQL worker action: ${request.action}`);
  }

  await ensureConnected();
  const result = await client.query(request.sql, request.params ?? []);
  return {
    ok: true,
    result: {
      rows: result.rows,
      rowCount: result.rowCount,
      command: result.command,
    },
  };
}

async function main() {
  while (true) {
    Atomics.wait(state, 0, 0);
    const current = Atomics.load(state, 0);
    if (current === 3) break;
    if (current !== 1) continue;

    let shouldClose = false;
    try {
      const request = readRequest();
      const response = await handleRequest(request);
      shouldClose = Boolean(response.close);
      writeResponse(response);
    } catch (error) {
      writeResponse({
        ok: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          code: error?.code,
        },
      });
    }

    Atomics.store(state, 0, 2);
    Atomics.notify(state, 0);
    if (shouldClose) break;
  }
}

main().catch((error) => {
  writeResponse({
    ok: false,
    error: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: error?.code,
    },
  });
  Atomics.store(state, 0, 2);
  Atomics.notify(state, 0);
});
