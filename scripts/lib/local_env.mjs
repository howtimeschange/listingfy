import fs from "node:fs";
import path from "node:path";

const DEFAULT_ENV_FILES = [".env.local", ".env"];

function stripInlineComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === "\"" || char === "'") && value[index - 1] !== "\\") {
      quote = quote === char ? null : quote ?? char;
    }
    if (char === "#" && quote === null && /\s/.test(value[index - 1] ?? " ")) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
}

function unquote(value) {
  const trimmed = stripInlineComment(value).trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, "\"");
  }
  return trimmed;
}

export function parseEnvText(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const index = normalized.indexOf("=");
    if (index <= 0) continue;
    const key = normalized.slice(0, index).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    values[key] = unquote(normalized.slice(index + 1));
  }
  return values;
}

export function findLocalEnvFile({ cwd = process.cwd(), fileNames = DEFAULT_ENV_FILES } = {}) {
  let dir = path.resolve(cwd);
  while (true) {
    for (const fileName of fileNames) {
      const filePath = path.join(dir, fileName);
      if (fs.existsSync(filePath)) return filePath;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadLocalEnv({
  cwd = process.cwd(),
  filePath = findLocalEnvFile({ cwd }),
  override = false,
} = {}) {
  if (!filePath) {
    return { loaded: false, filePath: null, keys: [] };
  }

  const values = parseEnvText(fs.readFileSync(filePath, "utf8"));
  const keys = [];
  for (const [key, value] of Object.entries(values)) {
    if (!override && process.env[key] !== undefined) continue;
    process.env[key] = value;
    keys.push(key);
  }

  return {
    loaded: true,
    filePath,
    keys,
  };
}
