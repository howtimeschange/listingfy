import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  migration: path.join(PROJECT_ROOT, "db/migrations/024_deepdraw_product_archive_creation.sql"),
  sqliteDb: path.join(PROJECT_ROOT, "scripts/lib/sqlite_db.mjs"),
  metadataService: path.join(PROJECT_ROOT, "web/server/services/deepdraw-metadata.ts"),
  draftService: path.join(PROJECT_ROOT, "web/server/services/product-archive-drafts.ts"),
  draftRoute: path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts"),
  metadataRoute: path.join(PROJECT_ROOT, "web/server/routes/deepdraw-metadata.ts"),
  deepdrawClient: path.join(PROJECT_ROOT, "scripts/lib/deepdraw_client.mjs"),
};

test("new deepdraw archive schema is a PostgreSQL-only schema revision, not a SQLite compatibility layer", async () => {
  const [migration, sqliteDb] = await Promise.all([
    readFile(files.migration, "utf8"),
    readFile(files.sqliteDb, "utf8"),
  ]);

  assert.match(migration, /postgres-only/);
  assert.match(migration, /bigserial primary key/i);
  assert.match(migration, /timestamptz not null default now\(\)/i);
  assert.match(migration, /jsonb not null default '\{\}'::jsonb/i);
  assert.match(migration, /jsonb not null default '\[\]'::jsonb/i);
  assert.match(migration, /on conflict \(permission_key\) do nothing/i);
  assert.match(sqliteDb, /postgres-only/);
  assert.doesNotMatch(migration, /autoincrement|strftime|insert or ignore/i);
});

test("deepdraw metadata service uses SyncPostgresDatabase and reuses the shared DeepDraw client", async () => {
  const [service, client] = await Promise.all([
    readFile(files.metadataService, "utf8"),
    readFile(files.deepdrawClient, "utf8"),
  ]);

  assert.match(service, /SyncPostgresDatabase/);
  assert.match(service, /from ".{0,20}\.\.\/\.\.\/\.\.\/scripts\/lib\/deepdraw_client\.mjs"/);
  assert.match(service, /requestDeepdrawPost/);
  assert.match(client, /buildDeepdrawGetRequest/);
  assert.match(client, /buildDeepdrawPostRequest/);
  assert.match(client, /REST_PATH = "\/rest"/);
  assert.match(service, /MERCHANT_TRADES_TYPE|dp\.merchant\.trades/);
  assert.match(service, /TRADE_FIELDS_TYPE|dp\.trade\.fields/);
  assert.match(service, /flattenTrades/);
  assert.match(service, /attributes\.isRequired/);
  assert.match(service, /insert into deepdraw_trade_cache/i);
  assert.match(service, /insert into deepdraw_trade_field_cache/i);
  assert.match(service, /on conflict \(tenant_name, merchant_id, trade_id\) do update/i);
  assert.match(service, /on conflict \(tenant_name, merchant_id, trade_id, field_id\) do update/i);
  assert.match(service, /raw_payload_json/);
});

test("product archive draft service is PG-first and covers build validate patch duplicate dry-run submit contracts", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /SyncPostgresDatabase/);
  assert.match(service, /export function listProductArchiveDrafts/);
  assert.match(service, /export function importProductArchiveSourceRows/);
  assert.match(service, /export function createProductArchiveDraftFromSpu/);
  assert.match(service, /export function getProductArchiveDraftDetail/);
  assert.match(service, /export function patchProductArchiveDraftFields/);
  assert.match(service, /export function validateProductArchiveDraft/);
  assert.match(service, /export async function checkDuplicateProductArchiveDraft/);
  assert.match(service, /export async function submitProductArchiveDraft/);
  assert.match(service, /export async function readbackProductArchiveDraft/);
  assert.match(service, /db\.transaction/);
  assert.match(service, /product_spu/);
  assert.match(service, /product_skc/);
  assert.match(service, /product_sku/);
  assert.match(service, /product_archive_draft/);
  assert.match(service, /product_archive_draft_field/);
  assert.match(service, /product_archive_draft_sku/);
  assert.match(service, /product_archive_validation_issue/);
  assert.match(service, /product_archive_submit_log/);
  assert.match(service, /parseProductArchiveFieldRuleRows/);
  assert.match(service, /normalizeProductArchiveSourceRows/);
  assert.match(service, /dryRun/);
  assert.match(service, /duplicate_found/);
  assert.match(service, /readback_mismatch/);
  assert.match(service, /sanitizeDeepdrawLogPayload/);
  assert.doesNotMatch(service, /openDatabase|applyMigrations|better-sqlite3|node:sqlite/);
});

test("product archive draft source rows stay scoped to the import batch when present", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /function sourceRowsForSpu\(db: SyncPostgresDatabase, spuCode: string, sourceBatchId\?: number \| null\)/);
  assert.match(service, /source\.source_batch_id = \?/);
  assert.match(service, /sourceRowsForSpu\(db, input\.spuCode, input\.sourceBatchId/);
  assert.match(service, /sourceRowsForDraft\(db, draft\)/);
});

test("product archive trade matching accepts duplicate source rows that point to the same DeepDraw trade", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
    },
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
    },
  ];
  const trades = [
    { trade_id: "12390", trade_name: "普通外套", trade_path: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
  ];

  assert.deepEqual(service.chooseDeepdrawTradeFromLaunchPlanRows(sourceRows, trades), {
    tradeId: "12390",
    tradePath: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
    confidence: "high",
    matchedField: "官方发布类目",
    matchedValue: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
  });
});

test("product archive trade matching falls back from launch-plan leaf names to shorter DeepDraw trade names", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
    },
  ];
  const trades = [
    { trade_id: "12390", trade_name: "外套", trade_path: "blbl&mini / 童装服饰 / 外套" },
  ];

  assert.deepEqual(service.chooseDeepdrawTradeFromLaunchPlanRows(sourceRows, trades), {
    tradeId: "12390",
    tradePath: "blbl&mini / 童装服饰 / 外套",
    confidence: "medium",
    matchedField: "官方发布类目",
    matchedValue: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
  });
});

test("product archive trade matching prefers the brand tenant clothing path when many short trade names tie", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
    },
  ];
  const trades = [
    { trade_id: "68", trade_name: "外套", trade_path: "童装婴幼儿服装 / 外套" },
    { trade_id: "12390", trade_name: "外套", trade_path: "blbl&mini / 童装服饰 / 外套" },
  ];

  assert.equal(service.chooseDeepdrawTradeFromLaunchPlanRows(sourceRows, trades)?.tradeId, "12390");
});

test("product archive trade matching gives official launch category priority over VIP or Douyin category leaves", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
        "发布类目 (唯品)": "婴幼外套/风衣",
      },
    },
  ];
  const trades = [
    { trade_id: "12390", trade_name: "外套", trade_path: "blbl&mini / 童装服饰 / 外套" },
    { trade_id: "12394", trade_name: "风衣", trade_path: "blbl&mini / 童装服饰 / 风衣" },
  ];

  assert.equal(service.chooseDeepdrawTradeFromLaunchPlanRows(sourceRows, trades)?.tradeId, "12390");
});

test("product archive draft service resolves merchant identity from DeepDraw credentials and keeps it out of create payload overrides", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /resolveDeepdrawConfig/);
  assert.match(service, /const deepdrawConfig = resolveDeepdrawConfig/);
  assert.match(service, /merchantId = String\(deepdrawConfig\.merchantId\)/);
  assert.doesNotMatch(service, /const merchantId = input\.merchantId \|\| process\.env\.DEEPDRAW_MERCHANT_ID \|\| ""/);
  assert.doesNotMatch(service, /merchantId:\s*stringValue\(draft\.merchant_id\)/);
});

test("product archive draft service blocks ready status when required template and duplicate checks fail", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /deepdraw_template_missing/);
  assert.match(service, /duplicate_product_found/);
  assert.match(service, /sku_color_not_in_template/);
  assert.match(service, /sku_size_not_in_template/);
});

test("product archive AI fill skips fields that already have JSON values", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /!hasValue\(recordValue\(field\.value_json\)\)/);
  assert.match(service, /fillProductArchiveDraftFieldsWithAi/);
});

test("product archive duplicate check rejects DeepDraw business failures", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const statements = [];
  const fakeDb = {
    prepare(sql) {
      statements.push(sql);
      return {
        get(id) {
          assert.equal(id, 101);
          return {
            id: 101,
            spu_code: "SPU001",
            tenant_name: "电商巴拉巴拉",
            merchant_id: "1162",
            trade_id: "100",
          };
        },
        run() {
          throw new Error("duplicate check should reject before mutating draft state");
        },
      };
    },
    transaction(fn) {
      return fn;
    },
  };

  await assert.rejects(
    () => service.checkDuplicateProductArchiveDraft(fakeDb, 101, {
      search: async () => ({
        status: 200,
        ok: true,
        requestId: "request-1",
        payload: {
          response: {
            code: 50001,
            reason: "signature invalid",
            response: "fail",
          },
        },
      }),
    }),
    /DeepDraw .*failed/i,
  );
});

test("product archive duplicate check rejects top-level DeepDraw business failures", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const fakeDb = {
    prepare() {
      return {
        get() {
          return {
            id: 102,
            spu_code: "SPU002",
            tenant_name: "电商巴拉巴拉",
            merchant_id: "1162",
            trade_id: "100",
          };
        },
        run() {
          throw new Error("duplicate check should reject top-level business failures before mutating draft state");
        },
      };
    },
    transaction(fn) {
      return fn;
    },
  };

  await assert.rejects(
    () => service.checkDuplicateProductArchiveDraft(fakeDb, 102, {
      search: async () => ({
        status: 200,
        ok: true,
        requestId: "request-2",
        payload: {
          code: 10494,
          reason: "访问频率过高，请稍后重试",
          response: "fail",
        },
      }),
    }),
    /访问频率过高/,
  );
});

test("product archive duplicate check treats DeepDraw product-not-found as no duplicate", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const runs = [];
  const fakeDb = {
    prepare() {
      return {
        get() {
          return {
            id: 103,
            spu_code: "SPU003",
            tenant_name: "电商巴拉巴拉",
            merchant_id: "1162",
            trade_id: "100",
          };
        },
        run(...args) {
          runs.push(args);
          return {};
        },
      };
    },
    transaction(fn) {
      return fn;
    },
  };

  const result = await service.checkDuplicateProductArchiveDraft(fakeDb, 103, {
    search: async () => ({
      status: 200,
      ok: false,
      requestId: "request-3",
      payload: {
        status: 200,
        response: {
          code: 10404,
          reason: "请求失败，请求的资源未在服务器上发现。productCode-SPU003",
          response: "fail",
          requestId: -1,
        },
      },
    }),
  });

  assert.equal(result.duplicateFound, false);
  assert.deepEqual(result.records, []);
  assert.ok(runs.length >= 2);
});

test("product archive service derives core sales fields from MDM master data", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const spu = {
    spu_code: "208326105214",
    price_tag: 359,
  };
  const skus = [
    {
      sku_code: "20832610521400388080",
      ean_code: "6942749195637",
      inner_code: "6942749195637",
      color_name: "蓝色调00388",
      size_name: "080",
      price_tag: 359,
    },
    {
      sku_code: "20832610521401315090",
      ean_code: "6942749195705",
      inner_code: "6942749195705",
      color_name: "粉色调01315",
      size_name: "090",
      price_tag: 359,
    },
  ];

  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("货号", { spu, skus }), {
    valueText: "208326105214",
    valueJson: {},
  });
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("价格", { spu, skus }), {
    valueText: "359",
    valueJson: {},
  });
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("颜色", { spu, skus }), {
    valueText: "蓝色,蓝色调00388;粉红,粉色调01315",
    valueJson: {},
  });
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("尺码", { spu, skus }), {
    valueText: "80cm;90cm",
    valueJson: {},
  });
  const sizeTable = service.buildProductArchiveMdmDerivedFieldValue("尺码表", { spu, skus });
  assert.equal(sizeTable.valueText, "");
  assert.deepEqual(sizeTable.valueJson, {
    title: "身高,衣长,胸围,袖长",
    "80cm": "80,0,0,0",
    "90cm": "90,0,0,0",
  });
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("上市时间", { spu, skus, dateText: "2026-07-08" }), {
    valueText: "2026-07-08",
    valueJson: {},
  });
  const merchantSku = service.buildProductArchiveMdmDerivedFieldValue("商家SKU", {
    spu,
    skus,
    dateText: "2026-07-08",
  });
  assert.equal(merchantSku.valueText, "");
  assert.equal(
    merchantSku.valueJson["蓝色调00388"]["80cm"],
    "359,208326105214,2026-07-08,0,6942749195637,6942749195637,359,359,20832610521400388080,6942749195637",
  );
});

test("product archive field mapping applies product-line domains only to matching MDM goods", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.fieldMappingDomainApplies({ field_domain_type: "通用字段" }, {}), true);
  assert.equal(service.fieldMappingDomainApplies({ field_domain_type: "1688" }, {}), true);
  assert.equal(
    service.fieldMappingDomainApplies(
      { field_domain_type: "产品线：鞋品" },
      { product_line_name: "童装服饰", subclass_name: "普通外套" },
    ),
    false,
  );
  assert.equal(
    service.fieldMappingDomainApplies(
      { field_domain_type: "产品线：鞋品" },
      { product_line_name: "鞋品", subclass_name: "运动鞋" },
    ),
    true,
  );
  assert.equal(
    service.fieldMappingDomainApplies(
      { field_domain_type: "产品线：中童" },
      { product_line_name: "童装服饰", age_group_name: "中童" },
    ),
    true,
  );
  assert.equal(
    service.fieldMappingDomainApplies(
      { field_domain_type: "鞋品字段" },
      { product_line_name: "鞋类商品" },
    ),
    true,
  );
});

test("product archive field option validation supports multi-value strings and object SKU payloads", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(
    service.productArchiveFieldValueMatchesOptions("080;090", [{ value: "080" }, { value: "090" }]),
    true,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions("蓝色,蓝色调00388;粉红,粉色调01315", [
      { label: "蓝色调00388" },
      { label: "粉色调01315" },
    ]),
    true,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions("蓝色,蓝色调00388;粉红,粉色调01315", [
      { value: "蓝色" },
      { value: "粉红" },
    ]),
    true,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions({ title: "价格,货号", 蓝色调00388: { "080": "359,code" } }, []),
    true,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions("080;100", [{ value: "080" }, { value: "090" }]),
    false,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions("勾选展示细节模块，不勾选则展示卖点模块", [
      { optionValue: "detail-module", optionName: "勾选展示细节模块，不勾选则展示卖点模块" },
    ]),
    true,
  );
});

test("product archive service derives remaining field values from launch plan and copywriting rows before AI", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const spu = {
    spu_code: "208326105214",
    price_tag: 359,
    unit_name: "件",
    age_group_name: "幼童",
  };
  const sourceRows = [
    {
      source_type: "copywriting",
      row_json: {
        "款号": "208326105214",
        "搜索标题": "巴拉巴拉儿童外套男童女童衣服2026新款秋装卡通萌趣满印防护上衣",
        "唯品标题": "巴拉巴拉儿童外套男童女童衣服2026新秋卡通萌趣满印防护上衣",
        "内容标题": "【balaOne】巴拉巴拉儿童外套男女2026新秋卡通萌趣满印防护上衣",
        "导购标题": "巴拉巴拉balaOne外套防护连帽衣",
        "推荐理由": "潮流满印外套，防风防泼水透湿",
        "FAB": "精选高弹春亚纺贴膜面料，糯弹亲肤，抗皱性强。",
        "面料成分": "成分\n面料：100%聚酯纤维\n薄膜除外\n里料：100%聚酯纤维",
        "面料名称": "春亚纺贴膜",
        "面料文案": "防风防泼水透湿，多方面防护，户外出行无忧",
        "面料三个关键词": "防泼水 防风 透湿",
        "设计师说——主图4": "春亚纺贴膜面料\n表层防风防泼水透湿\n内里柔软抗静电",
        "细节文案（不限定8个字，细节数量3-4个）": "1.立体连帽，挡风护脖\n2.小动物痛包，萌趣可爱",
        "弹性": "无弹",
      },
    },
    {
      source_type: "launch_plan",
      row_json: {
        "大货款号": "208326105214",
        "吊牌价": "359",
        "产品季": "326",
        "年龄段": "幼童",
        "性别": "中",
        "尺码段": "080-130",
        "内容上市时间": "2026-07-08T00:00:00.000Z",
        "颜色名称": "蓝色调00388",
      },
    },
    {
      source_type: "launch_plan",
      row_json: {
        "大货款号": "208326105214",
        "颜色名称": "粉色调01315",
      },
    },
  ];

  const derive = (fieldName, sourceField = "") => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu,
    sourceRows,
    sourceField,
  });

  assert.equal(derive("商家编码", "款号"), "208326105214");
  assert.equal(derive("奥莱店折扣价", "吊牌价格"), "359");
  assert.equal(derive("颜色(文本)", "颜色"), "蓝色调00388;粉色调01315");
  assert.equal(derive("上市时间(文本)"), "2026-07-08");
  assert.equal(derive("选择期数"), "326");
  assert.equal(derive("主图4文案1", "主图4第1句"), "春亚纺贴膜面料");
  assert.equal(derive("主图4文案2", "主图4第2-3句"), "表层防风防泼水透湿\n内里柔软抗静电");
  assert.equal(
    derive("25服装面料文案", "面料名称-面料文案*面料三个关键词"),
    "春亚纺贴膜\n防风防泼水透湿，多方面防护，户外出行无忧\n防泼水 防风 透湿",
  );
  assert.equal(derive("小红书标题", "去掉巴拉巴拉"), "儿童外套男童女童衣服2026新款秋装卡通萌趣满印防护上衣");
  assert.equal(derive("主面料成分含量"), "100%");
  assert.equal(derive("微信视频小店标题", "内容平台标题"), "【balaOne】巴拉巴拉儿童外套男女2026新秋卡通萌趣满印防护上衣");
  assert.match(derive("商品详情"), /精选高弹春亚纺贴膜面料/);
});

test("product archive service normalizes source values into DeepDraw enum options", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("25柔软指数", "偏硬", [
    { value: "硬" },
    { value: "微硬" },
    { value: "适中" },
  ]), "微硬");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("发货方式", "快递", [
    { value: "快递发货" },
    { value: "无需快递" },
  ]), "快递发货");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("上市时间", "2026-07-08T00:00:00.000Z", [
    { value: "2026年夏季" },
    { value: "2026年秋季" },
  ]), "2026年夏季");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用性别", "中", [
    { value: "男女通用" },
    { value: "中性/男女均可" },
  ]), "中性/男女均可");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("材质", "面料：100%聚酯纤维", [
    { value: "聚酯纤维（涤纶）" },
    { value: "棉" },
  ]), "聚酯纤维（涤纶）");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("面料(多选)", "面料：100%聚酯纤维", [
    { value: "聚酯纤维" },
    { value: "梭织布" },
  ]), "聚酯纤维");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用年龄", "幼童", [
    { value: "婴幼童(1~3岁，80~100cm)" },
    { value: "中小童(3~8岁，100~140cm)" },
  ]), "婴幼童(1~3岁，80~100cm)");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("颜色", "蓝色调00388;粉色调01315", [
    { value: "蓝色" },
    { value: "粉红" },
  ]), "蓝色,蓝色调00388;粉红,粉色调01315");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("分类", "外套", [
    { value: "风衣" },
    { value: "普通外套" },
  ]), "普通外套");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("品牌(单选)", "巴拉巴拉", [
    { value: "balabala/巴拉巴拉" },
  ]), "balabala/巴拉巴拉");
});

test("product archive payload date keeps the launch-plan source date for SDK product date", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.buildProductArchivePayloadDate([
    {
      source_type: "launch_plan",
      row_json: { "内容上市时间": "2026-07-08T00:00:00.000Z" },
    },
  ]), "2026-07-08");
});

test("routes delegate to PG services and enforce the deepdraw archive permission boundary", async () => {
  const [draftRoute, metadataRoute] = await Promise.all([
    readFile(files.draftRoute, "utf8"),
    readFile(files.metadataRoute, "utf8"),
  ]);

  assert.match(draftRoute, /from "\.\.\/services\/product-archive-drafts"/);
  assert.match(metadataRoute, /from "\.\.\/services\/deepdraw-metadata"/);
  for (const permission of [
    "PRODUCT_ARCHIVE_DRAFT_READ",
    "PRODUCT_ARCHIVE_DRAFT_WRITE",
    "PRODUCT_ARCHIVE_DRAFT_SUBMIT",
    "DEEPDRAW_METADATA_MANAGE",
    "PRODUCT_ARCHIVE_RULE_MANAGE",
  ]) {
    assert.match(`${draftRoute}\n${metadataRoute}`, new RegExp(permission));
  }
  assert.match(draftRoute, /assertSafeProductArchiveCode/);
  assert.match(draftRoute, /productArchiveDrafts\.post\("\/source-imports"/);
  assert.match(draftRoute, /submitProductArchiveDraft/);
  assert.match(metadataRoute, /syncDeepdrawTrades/);
  assert.match(metadataRoute, /syncDeepdrawTradeFields/);
});

test("product archive submit route allows real DeepDraw creates through the SDK adapter", async () => {
  const [draftRoute, deepdrawClient] = await Promise.all([
    readFile(files.draftRoute, "utf8"),
    readFile(files.deepdrawClient, "utf8"),
  ]);

  assert.doesNotMatch(draftRoute, /HTTPException\(501/);
  assert.doesNotMatch(draftRoute, /真实创建需要 SDK Product entity\/body adapter/);
  assert.match(draftRoute, /submitProductArchiveDraft\(db, draftId, \{ dryRun: Boolean\(body\.dryRun\) \}\)/);
  assert.match(deepdrawClient, /deepdraw_sdk_adapter\.mjs/);
  assert.match(deepdrawClient, /createDeepdrawProductWithSdk/);
  assert.doesNotMatch(deepdrawClient, /product create adapter is not configured/);
});
