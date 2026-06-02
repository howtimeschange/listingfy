import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCostImportRequests,
  parseCostImportRows,
  submitCostImportRows,
} from "../../web/src/lib/shein-cost-import.ts";

function costRow(index, overrides = {}) {
  return {
    spuName: `k${String(index).padStart(6, "0")}`,
    skcName: `sk${String(index).padStart(6, "0")}`,
    skuCode: `sku${String(index).padStart(6, "0")}`,
    cost: "59.7",
    currency: "CNY",
    changeReasonCode: "",
    rowNumber: index + 2,
    ...overrides,
  };
}

test("SHEIN cost import parses spreadsheet rows into normalized cost rows", () => {
  const rows = parseCostImportRows([
    {
      SPU: " k250212146560 ",
      SKC: " sk25021214656069611 ",
      SKU: " I62syz504c6n ",
      供货价: "59.7",
      币种: "",
      涨价原因: "",
    },
    {
      SPU: "",
      SKC: "",
      SKU: "",
      供货价: "",
      币种: "",
      涨价原因: "",
    },
  ]);

  assert.deepEqual(rows, [
    {
      spuName: "k250212146560",
      skcName: "sk25021214656069611",
      skuCode: "I62syz504c6n",
      cost: "59.7",
      currency: "CNY",
      changeReasonCode: "",
      rowNumber: 2,
    },
  ]);
});

test("SHEIN cost import builds one update request per SPU/currency/reason group", () => {
  const requests = buildCostImportRequests([
    costRow(1, { spuName: "spu-a", skcName: "skc-a", skuCode: "sku-a1" }),
    costRow(2, { spuName: "spu-a", skcName: "skc-a", skuCode: "sku-a2" }),
    costRow(3, { spuName: "spu-b", skcName: "skc-b", skuCode: "sku-b1", currency: "" }),
  ]);

  assert.equal(requests.rowCount, 3);
  assert.equal(requests.requests.length, 2);
  assert.deepEqual(requests.requests[0].payload, {
    spu_name: "spu-a",
    skc_info_list: [
      {
        skc_name: "skc-a",
        sku_info_list: [
          { sku_code: "sku-a1", cost: "59.70", currency: "CNY" },
          { sku_code: "sku-a2", cost: "59.70", currency: "CNY" },
        ],
      },
    ],
  });
  assert.deepEqual(requests.requests[1].payload, {
    spu_name: "spu-b",
    skc_info_list: [
      {
        skc_name: "skc-b",
        sku_info_list: [
          { sku_code: "sku-b1", cost: "59.70", currency: "CNY" },
        ],
      },
    ],
  });
});

test("SHEIN cost import submits groups with bounded concurrency and progress", async () => {
  const sourceRows = Array.from({ length: 12 }, (_, index) => costRow(index, {
    spuName: `spu-${index}`,
    skcName: `skc-${index}`,
    skuCode: `sku-${index}`,
  }));
  let active = 0;
  let maxActive = 0;
  const completed = [];
  const progress = [];

  const result = await submitCostImportRows(
    sourceRows,
    async (spuName) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      completed.push(spuName);
      return { result: { status: 200, payload: { code: "0", msg: "ok" } } };
    },
    {
      concurrency: 4,
      onProgress: (state) => progress.push(state),
    },
  );

  assert.equal(result.rowCount, 12);
  assert.equal(result.results.length, 12);
  assert.equal(result.results.every((item) => item.ok), true);
  assert.equal(maxActive, 4);
  assert.equal(completed.length, 12);
  assert.equal(progress.at(-1).completedGroups, 12);
  assert.equal(progress.at(-1).totalGroups, 12);
});
