import assert from "node:assert/strict";
import test from "node:test";

import { resolveSheinKidsCategoryFallback } from "../../web/server/services/pre-publish/category-fallback.ts";

test("SHEIN kids category fallback only resolves deterministic gendered kids titles", () => {
  const unresolvedCases = [
    {
      row: {
        spu_code: "208126100203",
        spu_name: "儿童长袖T恤",
        gender_name: "中性",
        age_group_name: "中童",
        spec_range: "110-175",
        middle_class_name: "长袖T恤",
        subclass_name: "圆V领长袖T恤",
        deepdraw_title: "【balaOne】巴拉巴拉儿童长袖t恤男童2026春季新款女童打底衫户外",
        deepdraw_category_name: "T恤",
      },
    },
    {
      row: {
        spu_code: "208126108217",
        spu_name: "儿童长裤",
        gender_name: "中性",
        age_group_name: "中童",
        spec_range: "110-175",
        middle_class_name: "长裤",
        subclass_name: "梭织长裤",
        deepdraw_title: "【balaOne】巴拉巴拉童装儿童裤子男女童2026春装新款长裤伞兵裤",
        deepdraw_category_name: "工装裤",
      },
    },
    {
      row: {
        spu_code: "208126121205",
        spu_name: "儿童卫衣",
        gender_name: "中性",
        age_group_name: "中童",
        spec_range: "110-175",
        middle_class_name: "卫衣",
        subclass_name: "圆领卫衣",
        deepdraw_title: "【balaOne】巴拉巴拉儿童卫衣长袖男女童2026新款春装条纹上衣潮",
        deepdraw_category_name: "卫衣",
      },
    },
    {
      row: {
        spu_code: "208126105213",
        spu_name: "儿童便服",
        gender_name: "中性",
        age_group_name: "幼童",
        spec_range: "080-130",
        middle_class_name: "便服",
        subclass_name: "针织便服",
        deepdraw_title: "【balaOne】巴拉巴拉童装儿童外套男童女童2026新款春装百搭上衣",
        deepdraw_category_name: "外套",
      },
    },
    {
      row: {
        spu_code: "NO-GENDER-SHIRT",
        spu_name: "儿童衬衫",
        gender_name: "",
        age_group_name: "幼童",
        middle_class_name: "衬衫",
        subclass_name: "长袖衬衫",
      },
    },
    {
      row: {
        spu_code: "NO-GENDER-CARDIGAN",
        spu_name: "儿童开襟毛衫",
        gender_name: "",
        age_group_name: "幼童",
        middle_class_name: "毛衫",
        subclass_name: "开襟衫",
      },
    },
    {
      row: {
        spu_code: "NO-AGE-TSHIRT",
        spu_name: "女童T恤",
        gender_name: "女",
        age_group_name: "",
        spec_range: "",
        middle_class_name: "T恤",
        subclass_name: "短袖T恤",
      },
    },
  ];

  for (const item of unresolvedCases) {
    assert.equal(resolveSheinKidsCategoryFallback(item.row), null, item.row.spu_code);
  }

  const cases = [
    {
      row: {
        spu_code: "208126105213",
        spu_name: "儿童便服",
        gender_name: "女",
        age_group_name: "幼童",
        spec_range: "080-130",
        middle_class_name: "便服",
        subclass_name: "针织便服",
        deepdraw_title: "【balaOne】巴拉巴拉童装儿童外套女童2026新款春装百搭上衣",
        deepdraw_category_name: "外套",
      },
      categoryName: "女童（小）外套",
      categoryId: 2064,
      productTypeId: 9340,
    },
    {
      row: {
        spu_code: "208126108011",
        spu_name: "儿童长裤",
        gender_name: "女",
        age_group_name: "幼童",
        spec_range: "080-130",
        middle_class_name: "长裤",
        subclass_name: "针织长裤",
        deepdraw_title: "【balaOne】巴拉巴拉童装儿童长裤女童2026年新款春装休闲直筒裤",
        deepdraw_category_name: "裤子",
      },
      categoryName: "女童（小）长裤",
      categoryId: 2119,
      productTypeId: 9602,
    },
  ];

  for (const item of cases) {
    const category = resolveSheinKidsCategoryFallback(item.row);
    assert.equal(category?.category_name, item.categoryName, item.row.spu_code);
    assert.equal(category?.category_id, item.categoryId, item.row.spu_code);
    assert.equal(category?.product_type_id, item.productTypeId, item.row.spu_code);
    assert.equal(category?.status, "READY", item.row.spu_code);
  }
});
