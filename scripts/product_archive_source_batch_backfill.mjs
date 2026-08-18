#!/usr/bin/env node

import { closeDb, getDb } from "../web/server/db.ts"
import { backfillCopywritingTriggeredDraftSourceBatches } from "../web/server/services/product-archive-drafts.ts"

const args = new Set(process.argv.slice(2))

if (args.has("--help") || args.has("-h")) {
  console.log(`Usage: npm run deepdraw:source:backfill -- [--apply]

Without --apply the command lists editable drafts whose copywriting batch was incorrectly recorded as a launch-plan batch.
With --apply it restores the real copywriting, latest launch-plan, and size-chart source batches for each affected SPU, then recalculates the DeepDraw category.
Human-adjusted categories are retained.`)
  process.exit(0)
}

const unknownArgs = Array.from(args).filter((arg) => arg !== "--apply")
if (unknownArgs.length > 0) {
  throw new Error(`Unknown arguments: ${unknownArgs.join(", ")}`)
}

try {
  const result = backfillCopywritingTriggeredDraftSourceBatches(getDb(), {
    apply: args.has("--apply"),
  })
  console.log(JSON.stringify(result, null, 2))
  if (result.failedCount > 0) process.exitCode = 1
} finally {
  closeDb()
}
