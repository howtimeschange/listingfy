import type { getDb } from "../db"
import { queryMdmProduct } from "../../../scripts/lib/mdm_client.mjs"
import { importMdmProductRows } from "../../../scripts/lib/mdm_product_importer.mjs"

type ProductArchiveDatabase = ReturnType<typeof getDb>

export async function syncMdmProduct(db: ProductArchiveDatabase, spuCode: string) {
  const startedAt = new Date().toISOString()
  const result = await queryMdmProduct({ spuCode })
  const finishedAt = new Date().toISOString()
  const summary = importMdmProductRows(db, {
    spuCode,
    spuRows: result.spuRows,
    skuRows: result.skuRows,
    syncedAt: finishedAt,
    manifest: {
      batch_no: `web-mdm-${spuCode}-${Date.now()}`,
      started_at: startedAt,
      finished_at: finishedAt,
      request: { spuCode },
      counts: {
        spu: result.spuRows.length,
        sku: result.skuRows.length,
      },
      raw: result.raw,
    },
  })

  return {
    ok: true,
    source: "MDM",
    spu_code: spuCode,
    ...summary,
  }
}
