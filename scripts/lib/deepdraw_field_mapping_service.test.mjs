import assert from "node:assert/strict";
import test from "node:test";
import { importDeepdrawFieldMappingRows } from "../../web/server/services/deepdraw-field-mappings.ts";

test("importDeepdrawFieldMappingRows prunes stale rules outside the imported domain-field set", () => {
  const upserts = [];
  const deletes = [];
  const existing = [
    { id: 1, field_domain_type: "通用字段", deepdraw_field: "产品分类" },
    { id: 2, field_domain_type: "通用字段", deepdraw_field: "旧字段" },
    { id: 3, field_domain_type: "产品线：鞋品", deepdraw_field: "25产品名称" },
  ];
  const db = {
    prepare(sql) {
      if (/insert into deepdraw_field_mapping_rule/i.test(sql)) {
        return {
          run(...args) {
            upserts.push(args);
          },
        };
      }
      if (/select\s+id,\s*field_domain_type,\s*deepdraw_field/i.test(sql)) {
        return {
          all(tenantName, merchantId) {
            assert.equal(tenantName, "电商巴拉巴拉");
            assert.equal(merchantId, "1162");
            return existing;
          },
        };
      }
      if (/delete from deepdraw_field_mapping_rule/i.test(sql)) {
        return {
          run(ruleId) {
            deletes.push(ruleId);
            return { changes: 1 };
          },
        };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    transaction(fn) {
      return () => fn();
    },
  };

  const result = importDeepdrawFieldMappingRows(db, {
    tenantName: "电商巴拉巴拉",
    merchantId: "1162",
    rows: [
      {
        fieldDomainType: "通用字段",
        deepdrawField: "产品分类",
        fieldSource: "上市计划表",
        mappedField: "官方发布类目",
        sourceType: "launch_plan",
      },
      {
        fieldDomainType: "产品线：鞋品",
        deepdrawField: "25产品名称",
        fieldSource: "文案表",
        mappedField: "名称",
        sourceType: "copywriting",
      },
      {
        fieldDomainType: "通用字段",
        deepdrawField: "是否有腰带",
        fieldSource: "人工判断",
        sourceType: "manual",
      },
    ],
  });

  assert.equal(upserts.length, 3);
  assert.equal(upserts[2][12], false);
  assert.deepEqual(deletes, [2]);
  assert.equal(result.deletedStaleCount, 1);
});
