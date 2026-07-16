#!/usr/bin/env node

import { closeDb, getDb } from "../web/server/db.ts"
import { backfillLegacyProductArchiveDraftTrades } from "../web/server/services/product-archive-drafts.ts"

const args = new Set(process.argv.slice(2))

if (args.has("--help") || args.has("-h")) {
  console.log(`Usage: npm run deepdraw:trade:backfill -- [--apply]

Without --apply the command runs in preview mode and does not modify drafts.
With --apply it only updates legacy drafts currently in draft, manual_review, or ready status.
Terminal drafts such as readback_verified and duplicate_found remain review-only.`)
  process.exit(0)
}

const unknownArgs = Array.from(args).filter((arg) => arg !== "--apply")
if (unknownArgs.length > 0) {
  throw new Error(`Unknown arguments: ${unknownArgs.join(", ")}`)
}

try {
  const result = backfillLegacyProductArchiveDraftTrades(getDb(), {
    apply: args.has("--apply"),
  })
  console.log(JSON.stringify(result, null, 2))
  if (result.failedCount > 0) process.exitCode = 1
} finally {
  closeDb()
}
