import assert from "node:assert/strict";
import test from "node:test";
import {
  BRAND_MAPPINGS,
  DEEPDRAW_TENANT_OPTIONS,
  deepdrawTenantForBrand,
  findBrandMapping,
} from "./brand_mapping.mjs";

test("brand mappings keep MDM brand codes and recommended DeepDraw tenants together", () => {
  assert.deepEqual(findBrandMapping("20"), {
    brandCode: "20",
    brandName: "巴拉巴拉",
    aliases: ["Balabala"],
    deepdrawTenantName: "电商巴拉巴拉",
  });
  assert.equal(findBrandMapping("mini bala").brandCode, "23");
  assert.equal(deepdrawTenantForBrand("28"), "电商马卡乐（森马儿童）");
});

test("DeepDraw tenant options are derived from the credential document table", () => {
  assert.equal(BRAND_MAPPINGS.length, 9);
  assert.equal(DEEPDRAW_TENANT_OPTIONS.length, 12);
  assert.ok(DEEPDRAW_TENANT_OPTIONS.some((item) => (
    item.tenantName === "电商巴拉巴拉" && item.merchantId === "1162"
  )));
});
