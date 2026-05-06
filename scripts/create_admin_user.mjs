#!/usr/bin/env node

import crypto from "node:crypto";
import { getDatabaseConfig } from "./lib/database_config.mjs";
import { loadLocalEnv } from "./lib/local_env.mjs";
import { SyncPostgresDatabase } from "./lib/postgres_db.mjs";

loadLocalEnv();

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function parseArgs(argv) {
  const args = {
    username: "",
    displayName: "系统管理员",
    password: "",
    databaseUrl: process.env.DATABASE_URL,
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
    else if (arg === "--database-url") args.databaseUrl = next();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  args.username = args.username.trim();
  args.displayName = args.displayName.trim();
  return args;
}

function usage() {
  process.stdout.write(`Create or reset a Listingify administrator

Options:
  --username <name>        Login username
  --display-name <name>    Display name. Default: 系统管理员
  --password <password>    Password, at least 12 characters
  --database-url <url>     PostgreSQL connection URL. Default: DATABASE_URL

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

const config = getDatabaseConfig({
  ...process.env,
  DATABASE_PROVIDER: "postgres",
  DATABASE_URL: args.databaseUrl,
});
const db = new SyncPostgresDatabase(config.url);

const adminRole = db.prepare("select id from rbac_role where role_key = 'ADMIN'").get();
if (!adminRole) {
  db.close();
  throw new Error("ADMIN role does not exist. Run migrations first.");
}

const { salt, hash } = hashPassword(args.password);
const existing = db.prepare("select id from app_user where username = ?").get(args.username);
let userId;
let action;

db.transaction(() => {
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
})();
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
