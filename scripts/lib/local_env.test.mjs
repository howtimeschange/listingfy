import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadLocalEnv } from "./local_env.mjs";

test("loadLocalEnv reads .env.local from the project root without overriding existing env", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "listingify-env-"));
  const projectDir = path.join(tmpDir, "project");
  const childDir = path.join(projectDir, "web", "server");
  fs.mkdirSync(childDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, ".env.local"), [
    "MDM_BASE_URL=https://mdm.semirapp.com",
    "MDM_APP_ID=file-app-id",
    "MDM_APP_KEY=\"file app key\"",
    "DEEPDRAW_TENANT_NAME=电商巴拉巴拉",
    "",
  ].join("\n"));

  const previousAppId = process.env.MDM_APP_ID;
  const previousAppKey = process.env.MDM_APP_KEY;
  const previousBaseUrl = process.env.MDM_BASE_URL;
  const previousTenant = process.env.DEEPDRAW_TENANT_NAME;
  process.env.MDM_APP_ID = "shell-app-id";
  delete process.env.MDM_APP_KEY;
  delete process.env.MDM_BASE_URL;
  delete process.env.DEEPDRAW_TENANT_NAME;

  try {
    const result = loadLocalEnv({ cwd: childDir });

    assert.equal(result.loaded, true);
    assert.equal(result.filePath, path.join(projectDir, ".env.local"));
    assert.equal(process.env.MDM_APP_ID, "shell-app-id");
    assert.equal(process.env.MDM_APP_KEY, "file app key");
    assert.equal(process.env.MDM_BASE_URL, "https://mdm.semirapp.com");
    assert.equal(process.env.DEEPDRAW_TENANT_NAME, "电商巴拉巴拉");
  } finally {
    if (previousAppId === undefined) delete process.env.MDM_APP_ID;
    else process.env.MDM_APP_ID = previousAppId;
    if (previousAppKey === undefined) delete process.env.MDM_APP_KEY;
    else process.env.MDM_APP_KEY = previousAppKey;
    if (previousBaseUrl === undefined) delete process.env.MDM_BASE_URL;
    else process.env.MDM_BASE_URL = previousBaseUrl;
    if (previousTenant === undefined) delete process.env.DEEPDRAW_TENANT_NAME;
    else process.env.DEEPDRAW_TENANT_NAME = previousTenant;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
