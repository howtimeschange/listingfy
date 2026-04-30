#!/usr/bin/env node

import path from "node:path";
import { createRequire } from "node:module";
import { loadLocalEnv } from "./lib/local_env.mjs";

loadLocalEnv();

const requireFromWeb = createRequire(new URL("../web/package.json", import.meta.url));
const Database = requireFromWeb("better-sqlite3");
const { hashPassword } = await import("../web/server/lib/auth.ts");

function parseArgs(argv) {
  const args = {
    username: "",
    displayName: "系统管理员",
    password: "",
    dbPath: process.env.APP_DB_PATH || "data/app.sqlite",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--username") args.username = next();
    else if (arg === "--display-name") args.displayName = next();
    else if (arg === "--password") args.password = next();
    else if (arg === "--db") args.dbPath = next();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  args.username = args.username.trim();
  args.displayName = args.displayName.trim();
  args.dbPath = path.resolve(args.dbPath);
  return args;
}

function usage() {
  process.stdout.write(`Create or reset a Listingify administrator

Options:
  --username <name>        Login username
  --display-name <name>    Display name. Default: 系统管理员
  --password <password>    Password, at least 12 characters
  --db <path>              SQLite database path. Default: APP_DB_PATH or data/app.sqlite

Examples:
  npm run admin:create -- --username admin --display-name 系统管理员 --password 'change-me-strongly'
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

if (!args.username || !args.password) {
  usage();
  throw new Error("username and password are required");
}
if (args.password.length < 12) {
  throw new Error("password must be at least 12 characters");
}

const db = new Database(args.dbPath, { fileMustExist: true });
db.pragma("foreign_keys = ON");

const adminRole = db.prepare("select id from rbac_role where role_key = 'ADMIN'").get();
if (!adminRole) {
  db.close();
  throw new Error("ADMIN role does not exist. Run migrations first.");
}

const { salt, hash } = hashPassword(args.password);
const existing = db.prepare("select id from app_user where username = ?").get(args.username);
let userId;
let action;

if (existing) {
  userId = Number(existing.id);
  db.prepare(`
    update app_user
    set display_name = ?,
      password_hash = ?,
      password_salt = ?,
      status = 'ACTIVE',
      failed_login_count = 0,
      locked_until = null,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(args.displayName, hash, salt, userId);
  action = "reset";
} else {
  const result = db.prepare(`
    insert into app_user (
      username,
      display_name,
      email,
      password_hash,
      password_salt,
      status,
      failed_login_count,
      locked_until,
      updated_at
    )
    values (?, ?, null, ?, ?, 'ACTIVE', 0, null, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(args.username, args.displayName, hash, salt);
  userId = Number(result.lastInsertRowid);
  action = "created";
}

db.prepare("insert or ignore into app_user_role(user_id, role_id) values (?, ?)").run(userId, adminRole.id);
db.close();

process.stdout.write(`${JSON.stringify({
  ok: true,
  action,
  user: {
    id: userId,
    username: args.username,
    display_name: args.displayName,
    roles: ["ADMIN"],
  },
}, null, 2)}\n`);
