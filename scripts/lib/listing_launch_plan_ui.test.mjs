import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  migration: path.join(PROJECT_ROOT, "db/migrations/028_listing_launch_plan.sql"),
  importJobMigration: path.join(PROJECT_ROOT, "db/migrations/033_listing_launch_plan_import_jobs.sql"),
  performanceMigration: path.join(PROJECT_ROOT, "db/migrations/055_product_archive_performance.sql"),
  server: path.join(PROJECT_ROOT, "web/server/index.ts"),
  route: path.join(PROJECT_ROOT, "web/server/routes/listing-launch-plans.ts"),
  service: path.join(PROJECT_ROOT, "web/server/services/listing-launch-plans.ts"),
  bulkWriter: path.join(PROJECT_ROOT, "web/server/services/product-archive-bulk-write.ts"),
  importJobService: path.join(PROJECT_ROOT, "web/server/services/listing-launch-plan-import-jobs.ts"),
  spreadsheetWorkerService: path.join(PROJECT_ROOT, "web/server/services/spreadsheet-worker.ts"),
  spreadsheetParserWorker: path.join(PROJECT_ROOT, "scripts/lib/spreadsheet_parse_worker.mjs"),
  draftRoute: path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts"),
  draftService: path.join(PROJECT_ROOT, "web/server/services/product-archive-drafts.ts"),
  router: path.join(PROJECT_ROOT, "web/src/router.tsx"),
  sidebar: path.join(PROJECT_ROOT, "web/src/components/layout/app-sidebar.tsx"),
  page: path.join(PROJECT_ROOT, "web/src/pages/listing-launch-plans/page.tsx"),
  draftListPage: path.join(PROJECT_ROOT, "web/src/pages/product-archive-drafts/page.tsx"),
};

const LISTING_ROW_VALUE_COUNT = 34;

function launchPlanRow(spuCode, skcCode = `${spuCode}-SKC`, sheetName = "Sheet1") {
  return {
    "大货款号": spuCode,
    "款色号": skcCode,
    "官方发布类目": "童装/上衣",
    sheetName,
  };
}

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

class ListingLaunchPlanMemoryDb {
  imports = [];
  rows = [];
  latest = new Map();
  sheetStats = new Map();
  nextImportId = 1;
  nextRowId = 1;
  failNextBulkInsert = false;

  transaction(fn) {
    return (...args) => {
      const snapshot = {
        imports: cloneRows(this.imports),
        rows: cloneRows(this.rows),
        latest: new Map([...this.latest].map(([key, value]) => [key, { ...value }])),
        sheetStats: new Map([...this.sheetStats].map(([key, value]) => [key, { ...value }])),
        nextImportId: this.nextImportId,
        nextRowId: this.nextRowId,
      };
      try {
        return fn(...args);
      } catch (error) {
        this.imports = snapshot.imports;
        this.rows = snapshot.rows;
        this.latest = snapshot.latest;
        this.sheetStats = snapshot.sheetStats;
        this.nextImportId = snapshot.nextImportId;
        this.nextRowId = snapshot.nextRowId;
        throw error;
      }
    };
  }

  prepare(sql) {
    const compact = sql.replace(/\s+/g, " ").trim();
    if (/insert into listing_launch_plan_import \(/.test(compact)) {
      return {
        run: (...params) => {
          const id = this.nextImportId++;
          this.imports.push({
            id,
            import_no: params[0],
            file_name: params[1],
            file_size_bytes: params[2],
            sheet_count: params[3],
            input_row_count: params[4],
            normalized_row_count: params[5],
            source_batch_ids_json: params[6],
            raw_manifest_json: params[7],
            created_by: params[8],
            created_at: params[9],
          });
          return { lastInsertRowid: id };
        },
      };
    }
    if (/insert into listing_launch_plan_row \(/.test(compact)) {
      return {
        run: (...params) => {
          if (this.failNextBulkInsert) {
            this.failNextBulkInsert = false;
            throw new Error("simulated row insert failure");
          }
          for (let index = 0; index < params.length; index += LISTING_ROW_VALUE_COUNT) {
            const values = params.slice(index, index + LISTING_ROW_VALUE_COUNT);
            this.rows.push({
              id: this.nextRowId++,
              import_id: values[0],
              sheet_name: values[1],
              row_number: values[2],
              spu_code: values[3],
              skc_code: values[4],
              product_season: values[5],
              product_line: values[6],
              scene: values[7],
              attribute: values[8],
              gender: values[11],
              category_name: values[12],
              subcategory_name: values[13],
              color_name: values[14],
              tag_price: values[16],
              launch_date_text: values[22],
              search_launch_date_text: values[24],
              content_launch_date_text: values[26],
              listing_channel: values[27],
              official_category: values[28],
              vip_category: values[29],
              vip_style_category: values[30],
              douyin_category: values[31],
            });
          }
          return { changes: params.length / LISTING_ROW_VALUE_COUNT };
        },
      };
    }
    if (/select \* from listing_launch_plan_import where id = \?/.test(compact)) {
      return {
        get: (id) => this.imports.find((item) => item.id === Number(id)) ?? null,
      };
    }
    if (/insert into listing_launch_plan_import_sheet_stat/.test(compact)) {
      return {
        run: (importId) => {
          const rows = this.rows.filter((row) => row.import_id === Number(importId));
          const bySheet = new Map();
          for (const row of rows) {
            const stat = bySheet.get(row.sheet_name) ?? { row_count: 0, spus: new Set() };
            stat.row_count += 1;
            stat.spus.add(row.spu_code);
            bySheet.set(row.sheet_name, stat);
          }
          for (const [sheetName, stat] of bySheet) {
            this.sheetStats.set(`${importId}:${sheetName}`, {
              import_id: Number(importId),
              sheet_name: sheetName,
              row_count: stat.row_count,
              spu_count: stat.spus.size,
            });
          }
          return { changes: bySheet.size };
        },
      };
    }
    if (/insert into listing_launch_plan_spu_latest/.test(compact)) {
      return {
        run: (importId) => {
          const bySpu = new Map();
          for (const row of this.rows.filter((item) => item.import_id === Number(importId))) {
            const current = bySpu.get(row.spu_code) ?? { latestRow: row, rowCount: 0 };
            current.rowCount += 1;
            if (row.id > current.latestRow.id) current.latestRow = row;
            bySpu.set(row.spu_code, current);
          }
          for (const [spuCode, summary] of bySpu) {
            const existing = this.latest.get(spuCode);
            if (!existing || existing.import_id < Number(importId)) {
              this.latest.set(spuCode, {
                spu_code: spuCode,
                import_id: Number(importId),
                row_id: summary.latestRow.id,
                sheet_name: summary.latestRow.sheet_name,
                row_count: summary.rowCount,
              });
            }
          }
          return { changes: bySpu.size };
        },
      };
    }
    if (/select count\(\*\) as count from listing_launch_plan_import/.test(compact)) {
      return { get: () => ({ count: this.imports.length }) };
    }
    if (/select count\(\*\) as count from listing_launch_plan_row row join listing_launch_plan_spu_latest latest/.test(compact)) {
      return { get: () => ({ count: this.latestRows().length }) };
    }
    if (/select latest\.sheet_name, count\(\*\)::integer as count from listing_launch_plan_spu_latest latest/.test(compact)) {
      return {
        all: () => {
          const entries = [...this.latest.values()]
            .reduce((counts, item) => counts.set(item.sheet_name, (counts.get(item.sheet_name) ?? 0) + 1), new Map())
            .entries();
          return Array.from(entries)
            .map(([sheet_name, count]) => ({ sheet_name, count }))
            .sort((a, b) => a.sheet_name.localeCompare(b.sheet_name));
        },
      };
    }
    if (/select row\.id, row\.sheet_name/.test(compact)) {
      return {
        all: (...params) => this.listRows(compact, params),
      };
    }
    throw new Error(`unhandled SQL in test fake: ${compact}`);
  }

  latestRows() {
    return [...this.latest.values()]
      .map((summary) => {
        const row = this.rows.find((item) => item.id === summary.row_id);
        const imp = this.imports.find((item) => item.id === summary.import_id);
        return row && imp ? { row, imp, summary } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.row.spu_code.localeCompare(b.row.spu_code) || a.row.id - b.row.id);
  }

  listRows(sql, params) {
    const hasCursor = sql.includes("(row.spu_code, row.id) > (?, ?)");
    const hasOffset = sql.includes("offset ?");
    const limit = Number(params.at(hasOffset ? -2 : -1));
    const offset = hasOffset ? Number(params.at(-1)) : 0;
    const afterSpuCode = hasCursor ? String(params.at(-3)) : "";
    const afterRowId = hasCursor ? Number(params.at(-2)) : 0;
    let rows = this.latestRows();
    if (hasCursor) {
      rows = rows.filter(({ row }) => row.spu_code.localeCompare(afterSpuCode) > 0
        || (row.spu_code === afterSpuCode && row.id > afterRowId));
    }
    return rows.slice(offset, offset + limit).map(({ row, imp, summary }) => ({
      id: row.id,
      sheet_name: row.sheet_name,
      row_number: row.row_number,
      spu_code: row.spu_code,
      skc_code: row.skc_code,
      official_category: row.official_category,
      row_count: summary.row_count,
      file_name: imp.file_name,
      import_no: imp.import_no,
      imported_at: imp.created_at,
    }));
  }
}

async function listingLaunchPlanService() {
  return import(pathToFileURL(files.service).href);
}

test("latest summary chooses newer import rows once for each SPU", async () => {
  const { importListingLaunchPlanSheets, listListingLaunchPlanRows } = await listingLaunchPlanService();
  const db = new ListingLaunchPlanMemoryDb();

  importListingLaunchPlanSheets(db, {
    fileName: "old.xlsx",
    sheets: [{ name: "Old", rows: [launchPlanRow("A", "A-old", "Old")] }],
  });
  importListingLaunchPlanSheets(db, {
    fileName: "new.xlsx",
    sheets: [{ name: "New", rows: [launchPlanRow("A", "A-new", "New"), launchPlanRow("B", "B-new", "New")] }],
  });

  const result = listListingLaunchPlanRows(db, { limit: 10, includeTotal: false });

  assert.deepEqual(result.items.map((item) => item.id), [2, 3]);
  assert.deepEqual(result.items.map((item) => item.spu_code), ["A", "B"]);
  assert.equal(result.items.find((item) => item.spu_code === "A").skc_code, "A-new");
});

test("cursor pagination does not repeat or skip rows after a newer import is added before the next page", async () => {
  const { importListingLaunchPlanSheets, listListingLaunchPlanRows } = await listingLaunchPlanService();
  const db = new ListingLaunchPlanMemoryDb();

  importListingLaunchPlanSheets(db, {
    fileName: "base.xlsx",
    sheets: [{ name: "Base", rows: ["A", "B", "C", "D"].map((spu) => launchPlanRow(spu, `${spu}-base`, "Base")) }],
  });
  const first = listListingLaunchPlanRows(db, { limit: 2, includeTotal: false });

  importListingLaunchPlanSheets(db, {
    fileName: "newer-before-cursor.xlsx",
    sheets: [{ name: "New", rows: [launchPlanRow("A", "A-new", "New")] }],
  });
  const second = listListingLaunchPlanRows(db, {
    limit: 2,
    afterSpuCode: first.nextCursor.afterSpuCode,
    afterRowId: first.nextCursor.afterRowId,
    includeTotal: false,
  });

  const seenIds = [...first.items, ...second.items].map((item) => item.id);
  assert.equal(new Set(seenIds).size, 4);
  assert.deepEqual([...first.items, ...second.items].map((item) => item.spu_code), ["A", "B", "C", "D"]);
});

test("offset compatibility does not expose a next cursor for an exactly full final page", async () => {
  const { importListingLaunchPlanSheets, listListingLaunchPlanRows } = await listingLaunchPlanService();
  const db = new ListingLaunchPlanMemoryDb();

  importListingLaunchPlanSheets(db, {
    fileName: "exact.xlsx",
    sheets: [{ name: "Exact", rows: ["A", "B"].map((spu) => launchPlanRow(spu, `${spu}-base`, "Exact")) }],
  });

  const result = listListingLaunchPlanRows(db, { limit: 2, offset: 0, includeTotal: false });

  assert.equal(result.items.length, 2);
  assert.equal(result.nextCursor, null);
});

test("failed listing launch plan imports do not alter latest summaries", async () => {
  const { importListingLaunchPlanSheets, listListingLaunchPlanRows } = await listingLaunchPlanService();
  const db = new ListingLaunchPlanMemoryDb();

  importListingLaunchPlanSheets(db, {
    fileName: "base.xlsx",
    sheets: [{ name: "Base", rows: [launchPlanRow("A", "A-base", "Base")] }],
  });
  db.failNextBulkInsert = true;
  assert.throws(() => importListingLaunchPlanSheets(db, {
    fileName: "failed.xlsx",
    sheets: [{ name: "Failed", rows: [launchPlanRow("A", "A-failed", "Failed"), launchPlanRow("B", "B-failed", "Failed")] }],
  }), /simulated row insert failure/);

  const result = listListingLaunchPlanRows(db, { limit: 10, includeTotal: false });

  assert.deepEqual(result.items.map((item) => item.spu_code), ["A"]);
  assert.equal(result.items[0].skc_code, "A-base");
  assert.equal(db.imports.length, 1);
});

test("listing launch plan schema stores imports and normalized rows separately from draft source rows", async () => {
  const migration = await readFile(files.migration, "utf8");
  const importJobMigration = await readFile(files.importJobMigration, "utf8");

  assert.match(migration, /postgres-only/);
  assert.match(migration, /create table if not exists listing_launch_plan_import/);
  assert.match(migration, /create table if not exists listing_launch_plan_row/);
  assert.match(migration, /source_batch_ids_json jsonb not null default '\[\]'::jsonb/);
  assert.match(migration, /official_category text/);
  assert.match(migration, /vip_category text/);
  assert.match(migration, /douyin_category text/);
  assert.match(migration, /raw_row_json jsonb not null default '\{\}'::jsonb/);
  assert.match(migration, /idx_listing_launch_plan_row_spu/);
  assert.match(migration, /idx_listing_launch_plan_row_category/);
  assert.doesNotMatch(migration, /sqlite|autoincrement|strftime/i);

  assert.match(importJobMigration, /postgres-only/);
  assert.match(importJobMigration, /create table if not exists listing_launch_plan_import_job/);
  assert.match(importJobMigration, /result_json jsonb not null default '\{\}'::jsonb/);
  assert.match(importJobMigration, /check\(status in \('queued', 'running', 'completed'\)\)/);
  assert.doesNotMatch(importJobMigration, /sqlite|autoincrement|strftime/i);
});

test("listing launch plan performance migration adds latest SPU and sheet stat summaries additively", async () => {
  const migration = await readFile(files.performanceMigration, "utf8");

  assert.match(migration, /create table if not exists listing_launch_plan_spu_latest/);
  assert.match(migration, /spu_code text primary key/);
  assert.match(migration, /import_id bigint not null references listing_launch_plan_import\(id\) on delete cascade/);
  assert.match(migration, /row_id bigint not null references listing_launch_plan_row\(id\) on delete cascade/);
  assert.match(migration, /sheet_name text not null/);
  assert.match(migration, /row_count integer not null default 1/);
  assert.match(migration, /idx_listing_launch_plan_spu_latest_import/);
  assert.match(migration, /on listing_launch_plan_spu_latest\(import_id desc, spu_code\)/);
  assert.match(migration, /create table if not exists listing_launch_plan_import_sheet_stat/);
  assert.match(migration, /primary key\(import_id, sheet_name\)/);
  assert.match(migration, /spu_count integer not null default 0/);
  assert.match(migration, /from listing_launch_plan_row row[\s\S]*join listing_launch_plan_import imp on imp\.id = row\.import_id/);
  assert.match(migration, /row_number\(\) over \(partition by row\.spu_code order by row\.import_id desc, row\.id desc\) as latest_rank/);
  assert.match(migration, /where latest_rank = 1[\s\S]*on conflict \(spu_code\) do update/);
  assert.match(migration, /count\(distinct spu_code\)::integer as spu_count/);
  assert.doesNotMatch(migration, /drop table|alter table listing_launch_plan_row/i);
});

test("listing launch plan service maintains summaries transactionally and lists from cached latest SPUs", async () => {
  const service = await readFile(files.service, "utf8");
  const importTransaction = service.slice(
    service.indexOf("export function importListingLaunchPlanSheets"),
    service.indexOf("export async function importListingLaunchPlanSheetsInChunks"),
  );
  const listRows = service.slice(service.indexOf("export function listListingLaunchPlanRows"));

  assert.match(service, /function refreshListingLaunchPlanSummaries\(db: SyncPostgresDatabase, importId: number\)/);
  assert.match(importTransaction, /insertRowsInBatches[\s\S]*refreshListingLaunchPlanSummaries\(db, id\)/);
  assert.match(service, /on conflict \(spu_code\) do update[\s\S]*where listing_launch_plan_spu_latest\.import_id < excluded\.import_id/);
  assert.match(service, /insert into listing_launch_plan_import_sheet_stat/);
  assert.match(listRows, /listing_launch_plan_spu_latest latest/);
  assert.doesNotMatch(listRows, /select spu_code, max\(import_id\) as import_id/);
  assert.match(service, /afterSpuCode\?: string \| null/);
  assert.match(service, /afterRowId\?: unknown/);
  assert.match(listRows, /nextCursor/);
  assert.match(listRows, /\(row\.spu_code, row\.id\) > \(\?, \?\)/);
  assert.match(service, /LISTING_LAUNCH_PLAN_COUNT_CACHE_MS = 15_000/);
});

test("listing launch plan API and page expose server-side upload and parsed row browsing", async () => {
  const [server, route, service, bulkWriter, importJobService, router, sidebar, page, draftRoute, draftService, draftListPage] = await Promise.all([
    readFile(files.server, "utf8"),
    readFile(files.route, "utf8"),
    readFile(files.service, "utf8"),
    readFile(files.bulkWriter, "utf8"),
    readFile(files.importJobService, "utf8"),
    readFile(files.router, "utf8"),
    readFile(files.sidebar, "utf8"),
    readFile(files.page, "utf8"),
    readFile(files.draftRoute, "utf8"),
    readFile(files.draftService, "utf8"),
    readFile(files.draftListPage, "utf8"),
  ]);

  assert.match(server, /import listingLaunchPlans from "\.\/routes\/listing-launch-plans"/);
  assert.match(server, /app\.route\("\/api\/listing-launch-plans", listingLaunchPlans\)/);
  assert.match(route, /listingLaunchPlans\.get\("\/imports"/);
  assert.match(route, /listingLaunchPlans\.get\("\/rows"/);
  assert.match(route, /listingLaunchPlans\.post\("\/imports"/);
  assert.match(route, /listingLaunchPlans\.get\("\/import-jobs\/:jobId"/);
  assert.match(route, /c\.req\.formData\(\)/);
  assert.match(route, /randomUUID/);
  assert.match(route, /enqueueListingLaunchPlanImportJob/);
  assert.match(route, /getListingLaunchPlanImportJob/);
  assert.match(service, /export function importListingLaunchPlanSheets/);
  assert.match(service, /export async function importListingLaunchPlanSheetsInChunks/);
  assert.match(service, /normalizeListingLaunchPlanRows/);
  assert.match(service, /insert into listing_launch_plan_import/);
  assert.match(service, /insertRowsInBatches/);
  assert.match(bulkWriter, /insert into \$\{spec\.table\}/);
  assert.match(bulkWriter, /listing_launch_plan_row/);
  assert.match(service, /export function listListingLaunchPlanRows/);
  assert.match(service, /listing_launch_plan_spu_latest latest/);
  assert.match(service, /latest\.row_id = row\.id/);
  assert.match(service, /export function listListingLaunchPlanImports/);
  assert.match(service, /export function listListingLaunchPlanImports/);
  assert.match(importJobService, /readSpreadsheetSheetsFromFile/);
  assert.match(importJobService, /importProductArchiveSourceRows/);
  assert.match(importJobService, /refreshProductArchiveDraftsFromSourceBatchInChunks/);
  assert.match(importJobService, /importListingLaunchPlanSheetsInChunks/);
  assert.doesNotMatch(importJobService, /importListingLaunchPlanSheets\(getDb\(\)/);
  assert.match(draftService, /export async function refreshProductArchiveDraftsFromSourceBatchInChunks/);
  assert.match(importJobService, /export function enqueueListingLaunchPlanImportJob/);
  assert.match(importJobService, /export function getListingLaunchPlanImportJob/);
  assert.match(importJobService, /scheduleListingLaunchPlanImportJobs/);
  assert.doesNotMatch(importJobService, /id:\s*job\.actor\.id\s*\?\?\s*0/);

  assert.match(router, /ListingLaunchPlansPage/);
  assert.match(router, /path: "listing-launch-plans"/);
  assert.match(sidebar, /上市计划表/);
  assert.match(sidebar, /\/listing-launch-plans/);
  assert.match(page, /上市计划表/);
  assert.match(page, /同款号以最近一次导入为准/);
  assert.match(page, /覆盖同款号的生效明细/);
  assert.match(page, /FormData/);
  assert.match(page, /\/listing-launch-plans\/imports/);
  assert.match(page, /\/listing-launch-plans\/import-jobs\/\$\{job\.id\}/);
  assert.match(page, /useAsyncTasks/);
  assert.match(page, /addTask/);
  assert.match(page, /openTaskCenter/);
  assert.match(page, /listing_launch_plan_import/);
  assert.match(page, /\/listing-launch-plans\/rows/);
  assert.match(page, /afterSpuCode/);
  assert.match(page, /afterRowId/);
  assert.match(page, /nextCursor/);
  assert.match(page, /CursorPagination/);
  assert.doesNotMatch(page, /ServerPagination/);
  assert.match(page, /官方发布类目/);
  assert.match(page, /款号、款色、类目/);

  assert.match(draftRoute, /productArchiveDrafts\.post\("\/source-imports\/upload"/);
  assert.match(draftRoute, /readSpreadsheetSheetsFromFile/);
  assert.match(draftRoute, /refreshProductArchiveDraftsFromSourceBatch/);
  assert.match(draftListPage, /FormData/);
  assert.doesNotMatch(draftListPage, /readSpreadsheetWorkbook/);
});

test("listing launch plan route accepts cursor params and frontend avoids broad draft invalidation", async () => {
  const [route, page, draftListPage] = await Promise.all([
    readFile(files.route, "utf8"),
    readFile(files.page, "utf8"),
    readFile(files.draftListPage, "utf8"),
  ]);

  assert.match(route, /afterSpuCode: c\.req\.query\("afterSpuCode"\)/);
  assert.match(route, /afterRowId: c\.req\.query\("afterRowId"\)/);
  assert.match(page, /setCursorStack/);
  assert.match(page, /encodeURIComponent\(pagination\.afterSpuCode/);
  assert.match(page, /queryClient\.invalidateQueries\(\{ queryKey: \["listing-launch-plan-rows"\] \}\)/);
  assert.doesNotMatch(page, /queryClient\.invalidateQueries\(\{ queryKey: \["product-archive-drafts"\] \}\)/);
  assert.match(draftListPage, /refetchDraftQueries/);
  assert.match(draftListPage, /predicate: \(query\) => query\.queryKey\[0\] === "product-archive-drafts"/);
  assert.match(draftListPage, /query\.queryKey\.length !== 2/);
});

test("draft source import refreshes existing drafts after launch plan or copywriting uploads", async () => {
  const draftService = await readFile(files.draftService, "utf8");

  assert.match(draftService, /export function refreshProductArchiveDraftsFromSourceBatch/);
  assert.match(draftService, /chooseDeepdrawTradeFromLaunchPlanRows/);
  assert.match(draftService, /applyProductArchiveDraftTrade/);
  assert.match(draftService, /rebuildProductArchiveDraftFields/);
  assert.match(draftService, /sourceBatchIds/);
});

test("listing launch plan import jobs offload spreadsheet parsing and chunk source writes", async () => {
  const [service, importJobService, spreadsheetWorkerService, spreadsheetParserWorker, draftService] = await Promise.all([
    readFile(files.service, "utf8"),
    readFile(files.importJobService, "utf8"),
    readFile(files.spreadsheetWorkerService, "utf8"),
    readFile(files.spreadsheetParserWorker, "utf8"),
    readFile(files.draftService, "utf8"),
  ]);

  assert.match(importJobService, /readSpreadsheetSheetsFromFileInWorker/);
  assert.doesNotMatch(importJobService, /import \{ readSpreadsheetSheetsFromFile \}/);
  assert.match(spreadsheetWorkerService, /from "node:worker_threads"/);
  assert.match(spreadsheetWorkerService, /new Worker/);
  assert.match(spreadsheetWorkerService, /spreadsheet_parse_worker\.mjs/);
  assert.match(spreadsheetParserWorker, /streamSpreadsheetSheetsFromFile/);
  assert.match(spreadsheetParserWorker, /port\.postMessage/);
  assert.match(spreadsheetParserWorker, /type: "chunk"/);
  assert.match(spreadsheetParserWorker, /type !== "ack"/);

  assert.match(service, /normalizeListingLaunchPlanRowsInChunks/);
  assert.match(draftService, /export async function importProductArchiveSourceRowsInChunks/);
  assert.match(importJobService, /importProductArchiveSourceRowsInChunks/);
  assert.match(importJobService, /onProgress: \(\{ sourceBatchId, insertedRowCount, totalRowCount \}\)/);
});
