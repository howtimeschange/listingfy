#!/usr/bin/env node

import path from "node:path";
import { DEFAULT_DB_PATH, applyMigrations, openDatabase } from "./lib/sqlite_db.mjs";

function parseArgs(argv) {
  const args = {
    dbPath: process.env.APP_DB_PATH || DEFAULT_DB_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--db") args.dbPath = next();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  args.dbPath = path.resolve(args.dbPath);
  return args;
}

function usage() {
  process.stdout.write(`Database migration

Options:
  --db <path>    SQLite database path. Default: ${DEFAULT_DB_PATH}

Examples:
  npm run db:migrate
  npm run db:migrate -- --db data/app.sqlite
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const db = openDatabase(args.dbPath);
const appliedNow = applyMigrations(db);
db.close();

process.stdout.write(`${JSON.stringify({
  db_path: args.dbPath,
  applied: appliedNow,
}, null, 2)}\n`);
