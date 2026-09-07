import assert from "node:assert/strict"
import test from "node:test"

import {
  currencyForForm,
  detailQueryForView,
  saleSitesForDialog,
  validateCurrencySelection,
} from "../../web/src/lib/shein-platform-product-page-state.ts"

test("SHEIN list view only requests the sale-sites dialog SPU and ignores an older detail response", () => {
  assert.deepEqual(
    detailQueryForView({ view: "list", selectedSpuName: "", saleSitesDialogSpuName: "" }),
    { enabled: false, spuName: "" },
  )

  const firstDialog = detailQueryForView({ view: "list", selectedSpuName: "SPU-A", saleSitesDialogSpuName: "SPU-A" })
  assert.deepEqual(firstDialog, { enabled: true, spuName: "SPU-A" })

  const secondDialog = detailQueryForView({ view: "list", selectedSpuName: "SPU-B", saleSitesDialogSpuName: "SPU-B" })
  assert.deepEqual(secondDialog, { enabled: true, spuName: "SPU-B" })
  assert.deepEqual(
    saleSitesForDialog("SPU-B", { spuName: "SPU-A", saleSites: [{ siteAbbr: "DE" }] }),
    [],
  )
  assert.deepEqual(
    saleSitesForDialog("SPU-B", { spuName: "SPU-B", saleSites: [{ siteAbbr: "FR" }] }),
    [{ siteAbbr: "FR" }],
  )
})

test("SHEIN cost forms wait for known site currencies and retain an explicit user or SKU currency", () => {
  assert.equal(currencyForForm("", []), "")
  assert.equal(currencyForForm("", ["EUR"]), "EUR")
  assert.equal(currencyForForm("USD", ["EUR"]), "USD")
  assert.match(validateCurrencySelection("", []), /正在加载站点币种/)
  assert.match(validateCurrencySelection("CNY", ["EUR"]), /不属于当前店铺可用币种/)
  assert.equal(validateCurrencySelection("EUR", ["EUR"]), "")
})
