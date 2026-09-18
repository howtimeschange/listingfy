import test from "node:test"
import assert from "node:assert/strict"
import { dashboardQuery } from "../../web/server/services/dashboard/queries.ts"

// Run against an isolated PostgreSQL engine, never the application database.
// DASHBOARD_TEST_PGLITE_PATH points to an installed @electric-sql/pglite module.
test(
  "dashboard aggregates full products, splits, latest drafts and filtered issue pages",
  { skip: !process.env.DASHBOARD_TEST_PGLITE_PATH },
  async () => {
    const { PGlite } = await import(process.env.DASHBOARD_TEST_PGLITE_PATH)
    const db = new PGlite()
    try {
      await db.exec(`
      create table product_spu (spu_code text, brand_name text, spu_name text);
      create table product_archive_draft (id int, spu_code text, tenant_name text, merchant_id text, title text, status text, source_snapshot_json jsonb default '{}', validation_summary_json jsonb default '{}', created_product_id text, updated_at timestamptz default now());
      create table product_archive_draft_field (draft_id int, required bool, validation_status text);
      create table product_archive_validation_issue (id int, draft_id int, severity text, message text, resolved_at timestamptz);
      create table listing (id int, spu_code text, platform text default 'SHEIN', status text, validation_status text default 'PASSED', completeness int, updated_at text default '2026-09-18T00:00:00Z');
      create table listing_publish_task (id int, listing_id int, platform text default 'SHEIN', status text, error_message text);
      create table shein_product_bucket (spu_code text, title_cn text, readiness_status text, raw_payload_json text default '{}', updated_at text default '2026-09-18T00:00:00Z');
      insert into product_spu values ('A', '品牌甲', '商品 A'), ('B', '品牌乙', '商品 B'), ('C', '品牌甲', '商品 C');
      insert into product_archive_draft (id, spu_code, tenant_name, merchant_id, status, created_product_id, updated_at) values
        (1, 'A', 't', 'm', 'failed', null, '2026-09-17'), (2, 'A', 't', 'm', 'created', 'product-a', '2026-09-18'),
        (3, 'B', 't', 'm', 'missing_fields', null, '2026-09-18'), (4, 'C', 't', 'm', 'draft', null, '2026-09-18'),
        (5, 'unknown', 't', 'm', 'created', null, '2026-09-18'),
        (6, 'verified', 't', 'm', 'readback_verified', null, '2026-09-18'),
        (7, 'mismatch', 't', 'm', 'readback_mismatch', null, '2026-09-18');
      insert into product_archive_draft_field values (2, true, 'valid'), (2, true, 'valid'), (3, true, 'valid'), (3, true, 'missing');
      insert into product_archive_validation_issue values (1, 3, 'blocker', '缺少面料', null);
      insert into listing (id, spu_code, status, completeness) values
        (1, 'A', 'APPROVED', 100), (2, 'B', 'PUBLISH_SUBMITTED', 100),
        (3, 'C', 'APPROVED', 100), (4, 'C', 'REJECTED', 80), (5, 'A', 'ARCHIVED', 20);
      insert into listing_publish_task (id, listing_id, status, error_message) values
        (1, 1, 'FAILED', '旧失败'), (2, 1, 'APPROVED', null), (3, 4, 'REJECTED', '图片不符合要求');
      insert into shein_product_bucket (spu_code, readiness_status, raw_payload_json) values ('D', 'PENDING', '{}');
    `)
      const read = async (channel, brand = "", q = "", offset = 0) =>
        (await db.query(dashboardQuery(channel), [brand, q, offset])).rows[0]
      const deep = await read("deepdraw")
      assert.equal(deep.summary.total, 6, "latest draft only")
      assert.equal(deep.summary.success, 4, "all three successful statuses count without an additional platform id gate")
      assert.equal(deep.summary.problems, 2)
      assert.equal(deep.summary.completeness, 75)
      assert.equal(deep.summary.assessed, 2, "unassessed is not zero")
      assert.equal(deep.issues.find(item => item.spu_code === "B").reason, "缺少面料")
      assert.equal(deep.issues.find(item => item.spu_code === "mismatch").success, true)
      const filtered = await read("deepdraw", "品牌甲")
      assert.equal(filtered.summary.total, 2)
      assert.equal(
        filtered.brands.length,
        3,
        "brand selector retains all brands",
      )
      assert.equal((await read("deepdraw", "", "NO-MATCH")).issue_count, 0)
      assert.equal((await read("deepdraw", "' OR 1=1 --")).summary.total, 0)
      const shein = await read("shein")
      assert.equal(shein.summary.total, 4)
      assert.equal(
        shein.summary.success,
        1,
        "submitted and partially approved never count as success",
      )
      assert.equal(shein.summary.submitted, 1)
      assert.equal(shein.summary.assessed, 3)
      assert.equal(shein.summary.problems, 2)
      const rejected = shein.issues.find((item) => item.spu_code === "C")
      assert.equal(
        rejected.href,
        "/pre-publish-validation/4",
        "link points to failing split",
      )
      assert.equal(rejected.reason, "图片不符合要求")
      await db.exec(
        `insert into product_archive_draft (id, spu_code, tenant_name, merchant_id, status) select n, 'P' || n, 't', 'm', 'failed' from generate_series(10, 25) n`,
      )
      const page = await read("deepdraw", "", "", 10)
      assert.equal(page.issue_count, 18)
      assert.equal(page.issues.length, 8)
      await db.exec("delete from listing; delete from shein_product_bucket")
      const empty = await read("shein")
      assert.equal(empty.summary.total, 0)
      assert.equal(empty.summary.completeness, null)
      assert.deepEqual(empty.issues, [])
    } finally {
      await db.close()
    }
  },
)

test("dashboard endpoints enforce channel-specific read permissions before querying", async () => {
  const { Hono } = await import("../../web/node_modules/hono/dist/index.js")
  const { default: dashboard } =
    await import("../../web/server/routes/dashboard.ts")
  for (const permissions of [
    [],
    ["LISTING_READ"],
    ["PRODUCT_ARCHIVE_DRAFT_READ"],
  ]) {
    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("user", { id: 1, permissions })
      await next()
    })
    app.route("/dashboard", dashboard)
    for (const [channel, permission] of [
      ["deepdraw", "PRODUCT_ARCHIVE_DRAFT_READ"],
      ["shein", "LISTING_READ"],
    ]) {
      if (!permissions.includes(permission)) {
        const response = await app.request(`/dashboard/${channel}`)
        assert.equal(response.status, 403)
      }
    }
  }
  const app = new Hono().route("/dashboard", dashboard)
  assert.equal((await app.request("/dashboard/deepdraw")).status, 401)
})
