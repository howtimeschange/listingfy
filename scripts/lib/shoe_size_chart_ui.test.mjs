import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const ROOT = path.resolve(import.meta.dirname, "../..")
const file = (relativePath) => readFile(path.join(ROOT, relativePath), "utf8")

test("shoe size-chart migration creates three versioned templates with all 82 source rows", async () => {
  const [migration, platformMigration] = await Promise.all([
    file("db/migrations/046_product_archive_shoe_size_charts.sql"),
    file("db/migrations/047_product_archive_shoe_size_chart_platform_mappings.sql"),
  ])
  assert.match(migration, /create table if not exists product_archive_shoe_size_chart \(/)
  assert.match(migration, /create table if not exists product_archive_shoe_size_chart_row \(/)
  assert.match(migration, /'open_sandal', '前后空凉鞋'/)
  assert.match(migration, /'closed_sandal', '中空凉鞋（前后包鞋面）'/)
  assert.match(migration, /'sport_leisure', '运动\/休闲\/婴童\/其他'/)
  const sourceBlock = migration.slice(migration.indexOf("with source_rows("), migration.indexOf("insert into product_archive_shoe_size_chart_row"))
  const sourceRows = sourceBlock.match(/\('(open_sandal|closed_sandal|sport_leisure)',\s*\d+,/g) ?? []
  assert.equal(sourceRows.length, 82)
  assert.match(migration, /foot_length_tolerance_mm numeric\(5, 2\) not null default 2/)
  assert.match(migration, /unique\(chart_id, size_value\)/)
  assert.match(platformMigration, /general_mapping_text text/)
  assert.match(platformMigration, /douyin_mapping_text text/)
  assert.match(platformMigration, /vip_mapping_text text/)
  assert.match(platformMigration, /video_pdd_vip_mapping_text text/)
  assert.match(platformMigration, /pinduoduo_mapping_text text/)
  assert.match(platformMigration, /脚长内长上新列，即通用口径/)
  assert.match(platformMigration, /视频号\/拼多多\/唯品会兼容渠道口径/)
})

test("shoe size-chart API is permission guarded and mounted", async () => {
  const [route, index, service] = await Promise.all([
    file("web/server/routes/shoe-size-charts.ts"),
    file("web/server/index.ts"),
    file("web/server/services/shoe-size-charts.ts"),
  ])
  assert.match(route, /requirePermission\(c, "PRODUCT_ARCHIVE_DRAFT_READ"\)/)
  assert.match(route, /requirePermission\(c, "PRODUCT_ARCHIVE_RULE_MANAGE"\)/)
  assert.match(route, /shoeSizeCharts\.get\("\/rows"/)
  assert.match(route, /shoeSizeCharts\.post\("\/rows"/)
  assert.match(route, /shoeSizeCharts\.patch\("\/rows\/:rowId"/)
  assert.match(route, /shoeSizeCharts\.patch\("\/:chartCode"/)
  assert.match(index, /app\.route\("\/api\/shoe-size-charts", shoeSizeCharts\)/)
  assert.match(service, /footLengthToleranceMm/)
  assert.match(service, /order by chart\.id, row\.size_value/)
})

test("shoe size-chart page is routed under the DeepDraw workstream", async () => {
  const [sidebar, router, lazyPages, page] = await Promise.all([
    file("web/src/components/layout/app-sidebar.tsx"),
    file("web/src/router.tsx"),
    file("web/src/router-lazy-pages.tsx"),
    file("web/src/pages/shoe-size-charts/page.tsx"),
  ])
  assert.match(sidebar, /鞋品尺码表", to: "\/shoe-size-charts", icon: Ruler, permission: "PRODUCT_ARCHIVE_DRAFT_READ"/)
  assert.match(router, /path: "shoe-size-charts"/)
  assert.match(lazyPages, /ShoeSizeChartsPage/)
  assert.match(page, /title="鞋品尺码表"/)
  assert.match(page, /脚长范围按基准值 ± 公差计算/)
  assert.match(page, /hasPermission\("PRODUCT_ARCHIVE_RULE_MANAGE"\)/)
})

test("shoe size-chart importer normalizes Chinese columns and reports invalid rows", async () => {
  const service = await import("../../web/server/services/shoe-size-charts.ts")
  assert.equal(typeof service.normalizeShoeSizeChartImportRows, "function")

  const result = service.normalizeShoeSizeChartImportRows([
    {
      "模板代码": "sport_leisure",
      "号码": "26码",
      "脚长基准(mm)": "160",
      "脚长公差(mm)": "2",
      "鞋内长(mm)": "170.32",
      "岁段": "婴幼童（二段）",
      "参考年龄": "4岁",
      "参考阶段": "幼儿园中班",
      "状态": "启用",
    },
    {
      "模板代码": "未知鞋型",
      "号码": "27",
      "脚长基准(mm)": "165",
      "鞋内长(mm)": "176.98",
    },
  ])

  assert.deepEqual(result.rows, [{
    chartCode: "sport_leisure",
    sizeValue: 26,
    footLengthMm: 160,
    footLengthToleranceMm: 2,
    innerLengthMm: 170.32,
    ageSegment: "婴幼童（二段）",
    referenceAge: "4岁",
    referenceStage: "幼儿园中班",
    generalMappingText: null,
    douyinMappingText: null,
    vipMappingText: null,
    videoPddVipMappingText: null,
    pinduoduoMappingText: null,
    enabled: true,
    notes: null,
    rowNumber: 2,
  }])
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0].reason, /无法识别模板/)
})

test("shoe size-chart importer expands the original Balabala horizontal matrix", async () => {
  const service = await import("../../web/server/services/shoe-size-charts.ts")
  const result = service.normalizeShoeSizeChartImportRows([
    { "Column 3": "岁段", "Column 4": "婴幼童（一段）" },
    { "Column 3": "参考年龄段", "Column 4": "6个月", "Column 5": "6-8个月" },
    { "Column 3": "参考阶段", "Column 4": "步前鞋", "Column 5": "学步鞋" },
    { "Column 3": "号码", "Column 4": 15, "Column 5": 16 },
    { "Column 3": "脚长（鞋号）（+/-2mm)", "Column 4": 100, "Column 5": 105 },
    { "Column 2": "前后空凉鞋", "Column 3": "楦底样长(内长）", "Column 4": 107, "Column 5": 112 },
    { "Column 2": "中空凉鞋（前后包鞋面）", "Column 3": "楦底样长(内长）", "Column 4": 111, "Column 5": 116 },
    { "Column 2": "运动鞋", "Column 3": "楦底样长(内长）", "Column 4": 112, "Column 5": 117 },
    { "Column 2": "休闲鞋", "Column 3": "楦底样长(内长）", "Column 4": 112, "Column 5": 117 },
  ])

  assert.equal(result.rows.length, 6)
  assert.equal(result.sourceFormat, "balabala_horizontal")
  assert.deepEqual(result.rows.map((row) => `${row.chartCode}:${row.sizeValue}`), [
    "open_sandal:15",
    "open_sandal:16",
    "closed_sandal:15",
    "closed_sandal:16",
    "sport_leisure:15",
    "sport_leisure:16",
  ])
  assert.deepEqual(result.rows[1], {
    chartCode: "open_sandal",
    sizeValue: 16,
    footLengthMm: 105,
    footLengthToleranceMm: 2,
    innerLengthMm: 112,
    ageSegment: "婴幼童（一段）",
    referenceAge: "6-8个月",
    referenceStage: "学步鞋",
    generalMappingText: null,
    douyinMappingText: null,
    vipMappingText: null,
    videoPddVipMappingText: null,
    pinduoduoMappingText: null,
    enabled: true,
    notes: null,
    rowNumber: 6,
  })
  assert.equal(result.errors.length, 0)
})

test("shoe size-chart importer reads general, Douyin, Vipshop, and compatible channel mappings", async () => {
  const service = await import("../../web/server/services/shoe-size-charts.ts")
  const result = service.normalizeShoeSizeChartImportRows([
    { "Column 9": "前后空凉鞋", "Column 14": "中空凉鞋（前后包鞋面）", "Column 19": "运动鞋/休闲鞋/婴童鞋/其他" },
    {
      "Column 1": "岁段", "Column 2": "参考年龄段", "Column 3": "参考阶段", "Column 4": "号码", "Column 6": "脚长（鞋号）（+/-2mm)", "Column 8": "适合脚长(cm)",
      "Column 9": "楦底样长(内长）(mm)", "Column 11": "脚长内长上新", "Column 12": "抖音", "Column 13": "唯品",
      "Column 14": "楦底样长(内长）(mm)", "Column 16": "脚长内长上新", "Column 17": "抖音", "Column 18": "唯品",
      "Column 19": "楦底样长(内长）(mm)", "Column 21": "脚长内长上新", "Column 22": "抖音", "Column 23": "唯品",
      "Column 24": "视频号/拼多多/唯品会", "Column 25": "拼多多",
    },
    {
      "Column 1": "婴幼童（一段）", "Column 2": "6个月", "Column 3": "步前鞋", "Column 4": 15, "Column 6": 100, "Column 8": "9.8-10.2",
      "Column 9": 107, "Column 11": "(脚长9.8-10.2/内长10.7)", "Column 12": "脚长9.8-10.2/内长10.7", "Column 13": "15码(脚长10/内长10.7)",
      "Column 14": 111, "Column 16": "(脚长9.8-10.2/内长11.1)", "Column 17": "脚长9.8-10.2/内长11.1", "Column 18": "15码(脚长10/内长11.1)",
      "Column 19": 112, "Column 21": "(脚长9.8-10.2/内长11.2)", "Column 22": "脚长9.8-10.2/内长11.2", "Column 23": "15码(脚长10/内长11.2)",
      "Column 24": "15码(脚长9.8-10.2/内长11.2)", "Column 25": "15码脚长9.8-10.2/内长11.2",
    },
  ])

  assert.equal(result.sourceFormat, "balabala_conversion")
  assert.equal(result.rows.length, 3)
  const sport = result.rows.find((row) => row.chartCode === "sport_leisure")
  assert.equal(sport?.generalMappingText, "(脚长9.8-10.2/内长11.2)")
  assert.equal(sport?.douyinMappingText, "脚长9.8-10.2/内长11.2")
  assert.equal(sport?.vipMappingText, "15码(脚长10/内长11.2)")
  assert.equal(sport?.videoPddVipMappingText, "15码(脚长9.8-10.2/内长11.2)")
  assert.equal(sport?.pinduoduoMappingText, "15码脚长9.8-10.2/内长11.2")
})

test("shoe size-chart import upserts by template and size with row-level results", async () => {
  const service = await import("../../web/server/services/shoe-size-charts.ts")
  assert.equal(typeof service.importShoeSizeChartRows, "function")

  const written = []
  const db = {
    prepare(sql) {
      if (/from product_archive_shoe_size_chart where chart_code/.test(sql)) {
        return { get: (chartCode) => ({ id: chartCode === "sport_leisure" ? 3 : 1, chart_code: chartCode }) }
      }
      if (/select id from product_archive_shoe_size_chart_row/.test(sql)) {
        return { get: (_chartId, sizeValue) => sizeValue === 26 ? { id: 10 } : undefined }
      }
      if (/insert into product_archive_shoe_size_chart_row/.test(sql)) {
        return { run: (...params) => written.push(params) }
      }
      if (/update product_archive_shoe_size_chart set/.test(sql)) {
        return { run: () => undefined }
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
    transaction(fn) {
      return () => fn()
    },
  }

  const result = service.importShoeSizeChartRows(db, {
    rows: [
      { chartCode: "sport_leisure", sizeValue: 26, footLengthMm: 160, footLengthToleranceMm: 2, innerLengthMm: 170.32, enabled: true },
      { chartCode: "sport_leisure", sizeValue: 43, footLengthMm: 265, footLengthToleranceMm: 2, innerLengthMm: 283.54, enabled: true },
    ],
    userId: 9,
    sourceFileName: "鞋品尺码导入.xlsx",
  })

  assert.equal(result.updatedCount, 1)
  assert.equal(result.insertedCount, 1)
  assert.equal(written.length, 2)
  assert.deepEqual(result.items.map((item) => item.status), ["updated", "inserted"])
})

test("shoe size-chart import is exposed through a guarded upload API and page dialog", async () => {
  const [route, page] = await Promise.all([
    file("web/server/routes/shoe-size-charts.ts"),
    file("web/src/pages/shoe-size-charts/page.tsx"),
  ])
  assert.match(route, /shoeSizeCharts\.post\("\/imports"/)
  assert.match(route, /requirePermission\(c, "PRODUCT_ARCHIVE_RULE_MANAGE"\)/)
  assert.match(route, /readSpreadsheetSheetsFromFile/)
  assert.match(route, /parsed\.sourceFormat === "balabala_horizontal"/)
  assert.match(route, /parsed\.sourceFormat === "balabala_conversion"/)
  assert.match(route, /platformMappingRowCount/)
  assert.match(route, /shoe_size_chart\.imported/)
  assert.match(page, /ImportDialog/)
  assert.match(page, /导入覆盖更新/)
  assert.match(page, /api\.postForm<.*>\("\/shoe-size-charts\/imports"/s)
})
