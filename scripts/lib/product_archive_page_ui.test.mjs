import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/product-archives/page.tsx");
const DETAIL_PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/product-archives/[spuCode]/page.tsx");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/product-archives.ts");

test("product archive bulk sync is launched from a dialog instead of an inline panel", async () => {
  const source = await readFile(PAGE_FILE, "utf8");

  assert.match(source, /DialogTrigger\s+asChild/);
  assert.match(source, /<DialogTitle>批量同步<\/DialogTitle>/);
  assert.doesNotMatch(source, /xl:grid-cols-\[1fr_560px\]/);
});

test("product archive bulk sync defaults to combined sync without exposing interval input", async () => {
  const source = await readFile(PAGE_FILE, "utf8");

  assert.match(source, /useState<SyncSource>\("mdm_deepdraw"\)/);
  assert.match(source, />同步方式</);
  assert.match(source, />深绘租户</);
  assert.match(source, /<SelectItem value="mdm_deepdraw">MDM \+ 深绘<\/SelectItem>/);
  assert.doesNotMatch(source, /syncIntervalMs/);
  assert.doesNotMatch(source, /请求间隔 ms/);
});

test("product archive pages stay source-only and move SHEIN business fields into bucket workflow", async () => {
  const [listPage, detailPage, route] = await Promise.all([
    readFile(PAGE_FILE, "utf8"),
    readFile(DETAIL_PAGE_FILE, "utf8"),
    readFile(ROUTE_FILE, "utf8"),
  ]);

  for (const field of [
    "shein_category_name",
    "matched_shein_category_name",
    "suggested_shein_category_name",
    "publish_supply_price_cny",
    "publish_retail_price_usd",
    "publish_package_size_text",
    "publish_weight_record_count",
    "shein_size_name",
    "supply_price_cny",
    "suggested_retail_price_usd",
    "gross_weight_g",
    "package_size_text",
  ]) {
    assert.doesNotMatch(listPage, new RegExp(field), `${field} should not be rendered on archive list`);
    assert.doesNotMatch(detailPage, new RegExp(field), `${field} should not be rendered on archive detail`);
  }

  assert.doesNotMatch(route, /publish_supply_price_cny/);
  assert.doesNotMatch(route, /matched_shein_category_name/);
  assert.match(listPage, /加入 SHEIN 商品分桶/);
  assert.match(listPage, /\/shein-products\/import/);
  assert.match(listPage, /selectedSpus/);
  assert.match(listPage, /源数据/);
  assert.match(detailPage, /源数据概览/);
  assert.match(detailPage, /商品档案尺码/);
  assert.match(detailPage, /挂牌价/);
});

test("product archive detail page tolerates older API responses without size tables", async () => {
  const detailPage = await readFile(DETAIL_PAGE_FILE, "utf8");

  assert.match(detailPage, /Array\.isArray\(data\.size_tables\)/);
  assert.match(detailPage, /Array\.isArray\(data\.size_table_rows\)/);
  assert.doesNotMatch(detailPage, /for \(const row of data\.size_table_rows\)/);
});

test("product archive detail page refreshes after queued sync jobs complete", async () => {
  const detailPage = await readFile(DETAIL_PAGE_FILE, "utf8");

  assert.match(detailPage, /setSyncJobId\(result\.id\)/);
  assert.match(detailPage, /api\.get\(`\/product-archives\/sync-jobs\/\$\{syncJobId\}`\)/);
  assert.match(detailPage, /syncJob\?\.status !== "completed"/);
  assert.match(detailPage, /invalidateQueries\(\{ queryKey: \["product-archives"\] \}\)/);
});

test("product archive detail image sections keep only main color images and render detail pages in order", async () => {
  const detailPage = await readFile(DETAIL_PAGE_FILE, "utf8");

  assert.match(detailPage, /mainProductImages/);
  assert.match(detailPage, /colorProductImages/);
  assert.match(detailPage, /asset\.asset_type === "MAIN"/);
  assert.match(detailPage, /asset\.asset_type === "COLOR_BLOCK"/);
  assert.match(detailPage, /DetailPageImageFlow/);
  assert.match(detailPage, /detailImagesByPage/);
  assert.match(detailPage, /detail_page_index/);
  assert.match(detailPage, /module_index/);
  assert.doesNotMatch(detailPage, /<ImageGrid images=\{data\.product_images\}/);
  assert.doesNotMatch(detailPage, /<ImageGrid images=\{data\.detail_images\}/);
});

test("product archive image picker uses transparent main images as color images with concise color labels", async () => {
  const detailPage = await readFile(DETAIL_PAGE_FILE, "utf8");

  assert.match(detailPage, /CHANNEL_PRIORITY = \["TMALL", "TAOBAO"\]/);
  assert.match(detailPage, /selectPreferredChannelImages/);
  assert.match(detailPage, /selectOneImagePerSkc/);
  assert.match(detailPage, /colorTransparencyImages/);
  assert.match(detailPage, /selectedMainProductImages/);
  assert.match(detailPage, /selectedColorProductImages/);
  assert.match(detailPage, /asset\.asset_type === "MAIN"/);
  assert.match(detailPage, /asset\.picture_type === "TRANSPARENCY"/);
  assert.match(detailPage, /skcMetaByCode/);
  assert.match(detailPage, /mdmColorName/);
  assert.match(detailPage, /colorDisplayName/);
  assert.doesNotMatch(detailPage, /渠道：\{asset\.place/);
  assert.doesNotMatch(detailPage, /sourceImageLabel/);
});

test("product archive main images do not show SKC or color captions", async () => {
  const detailPage = await readFile(DETAIL_PAGE_FILE, "utf8");

  assert.match(detailPage, /showColorMeta=\{false\}/);
  assert.match(detailPage, /showColorMeta=\{true\}/);
  assert.match(detailPage, /if \(!showColorMeta\) return null/);
});
