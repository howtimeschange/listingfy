import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  router: path.join(PROJECT_ROOT, "web/src/router.tsx"),
  server: path.join(PROJECT_ROOT, "web/server/index.ts"),
  mdmPage: path.join(PROJECT_ROOT, "web/src/pages/mdm-products/page.tsx"),
  mdmDetailPage: path.join(PROJECT_ROOT, "web/src/pages/mdm-products/[spuCode]/page.tsx"),
  deepdrawPage: path.join(PROJECT_ROOT, "web/src/pages/deepdraw-content/page.tsx"),
  deepdrawDetailPage: path.join(PROJECT_ROOT, "web/src/pages/deepdraw-content/[spuCode]/page.tsx"),
  imagePage: path.join(PROJECT_ROOT, "web/src/pages/image-library/page.tsx"),
  imageDetailPage: path.join(PROJECT_ROOT, "web/src/pages/image-library/[assetId]/page.tsx"),
};

test("data center pages are backed by real API routes and detail routes", async () => {
  const [
    router,
    server,
    mdmPage,
    mdmDetailPage,
    deepdrawPage,
    deepdrawDetailPage,
    imagePage,
    imageDetailPage,
  ] = await Promise.all([
    readFile(files.router, "utf8"),
    readFile(files.server, "utf8"),
    readFile(files.mdmPage, "utf8"),
    readFile(files.mdmDetailPage, "utf8"),
    readFile(files.deepdrawPage, "utf8"),
    readFile(files.deepdrawDetailPage, "utf8"),
    readFile(files.imagePage, "utf8"),
    readFile(files.imageDetailPage, "utf8"),
  ]);

  for (const [pageName, listSource, detailSource] of [
    ["MDM 商品主数据", mdmPage, mdmDetailPage],
    ["深绘内容包", deepdrawPage, deepdrawDetailPage],
    ["图片素材库", imagePage, imageDetailPage],
  ]) {
    assert.doesNotMatch(listSource, /ComingSoonPage/, `${pageName} must not be a placeholder`);
    assert.match(listSource, /useQuery/, `${pageName} must load data from the API`);
    assert.match(detailSource, /useQuery/, `${pageName} detail must load data from the API`);
    assert.match(detailSource, /TabsTrigger/, `${pageName} detail must expose drill-down tabs`);
  }

  for (const route of [
    "mdm-products/:spuCode",
    "deepdraw-content/:spuCode",
    "image-library/:assetId",
  ]) {
    assert.match(router, new RegExp(route.replaceAll("/", "\\/")));
  }

  for (const apiRoute of ["mdm-products", "deepdraw-content", "image-library"]) {
    assert.match(server, new RegExp(`app\\.route\\("\\/api\\/${apiRoute}"`));
  }
});
