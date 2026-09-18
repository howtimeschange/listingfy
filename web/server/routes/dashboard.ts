import { Hono } from "hono"
import { getAsyncPool } from "../db"
import { requirePermission } from "../lib/auth"
import { dashboardQuery } from "../services/dashboard/queries"

const dashboard = new Hono()
for (const channel of ["deepdraw", "shein"] as const) {
  dashboard.get(`/${channel}`, async (c) => {
    requirePermission(
      c,
      channel === "deepdraw" ? "PRODUCT_ARCHIVE_DRAFT_READ" : "LISTING_READ",
    )
    const offset = Math.max(
      0,
      Math.min(1_000_000, Math.floor(Number(c.req.query("offset")) || 0)),
    )
    const result = await getAsyncPool().query(dashboardQuery(channel), [
      (c.req.query("brand") ?? "").slice(0, 200),
      (c.req.query("q") ?? "").slice(0, 200),
      offset,
    ])
    return c.json({
      ...result.rows[0],
      generated_at: new Date().toISOString(),
    })
  })
}
export default dashboard
