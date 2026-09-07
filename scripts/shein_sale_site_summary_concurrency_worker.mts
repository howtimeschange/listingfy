import { SyncPostgresDatabase } from "./lib/postgres_db.mjs"
import { persistProductDetailResult } from "../web/server/services/shein-platform-products.ts"

const encoded = process.argv[2]
if (!encoded) throw new Error("Missing SHEIN summary concurrency worker payload")
const input = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
  databaseUrl: string
  accountKey: string
  spuName: string
  siteAbbr: string
  shelfStatus: number
}

const db = new SyncPostgresDatabase(input.databaseUrl, { connectionTimeoutMillis: 5_000 })
try {
  persistProductDetailResult(db, {
    credentials: {},
    platform: "SHEIN",
    platformAccountKey: input.accountKey,
    platformIntegrationId: null,
  }, {
    status: 200,
    payload: {
      code: "0",
      info: {
        spuName: input.spuName,
        skcInfoList: [{
          skcName: `${input.spuName}-SKC`,
          shelfStatusInfoList: [{ shelfStatus: input.shelfStatus, siteAbbr: input.siteAbbr }],
          skuInfoList: [{ skuCode: `${input.spuName}-SKU`, supplierSku: `${input.spuName}-SUPPLIER` }],
        }],
      },
    },
  })
} finally {
  db.close()
}
