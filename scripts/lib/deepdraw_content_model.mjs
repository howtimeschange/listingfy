import crypto from "node:crypto";

export const DEEPDRAW_SOURCE_SYSTEM = "DEEPDRAW";

const KEY_FIELD_PATTERNS = [
  /标题/,
  /品牌/,
  /适用性别/,
  /适用年龄|年龄段|年龄/,
  /适用季节|季节/,
  /风格/,
  /图案/,
  /厚薄/,
  /材质|面料|成分/,
  /卖点|推荐理由/,
  /发货方式/,
  /限购/,
  /市场价|专柜价|参考价格|价格/,
  /商品重量|重量/,
  /货号|条码|商家编码/,
  /上市时间/,
  /产地/,
  /是否商场同款/,
  /安全|执行标准/,
];

function compactJson(value) {
  return JSON.stringify(value ?? null);
}

function sourceHash(value) {
  return crypto.createHash("sha256").update(compactJson(value)).digest("hex");
}

function toIso(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return String(value);
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeDeepdrawUrl(url) {
  if (!url) return null;
  const value = String(url).trim();
  if (value.startsWith("//")) return `http:${value}`;
  return value;
}

function parseSizeCodeTexts(texts) {
  const map = new Map();
  for (const text of array(texts)) {
    const [code, sizeName] = String(text).split(",");
    if (code && sizeName && !map.has(sizeName)) {
      map.set(sizeName, code);
    }
  }
  return map;
}

function fieldValues(field) {
  const texts = array(field.texts);
  const options = array(field.options);
  const values = [];
  if (field.value !== undefined && field.value !== null && field.value !== "") values.push(field.value);
  if (field.text !== undefined && field.text !== null && field.text !== "") values.push(field.text);
  if (field.option !== undefined && field.option !== null && field.option !== "") values.push(field.option);
  if (field.values !== undefined && field.values !== null) values.push(field.values);
  return {
    texts,
    options,
    values,
    hasValue: texts.length > 0 || options.length > 0 || values.length > 0,
  };
}

function fieldValueText(field) {
  const { texts, options, values } = fieldValues(field);
  const flat = [...texts, ...options, ...values.map((value) => (
    typeof value === "string" ? value : compactJson(value)
  ))];
  return flat.join(" | ");
}

function isKeyFieldName(name) {
  return KEY_FIELD_PATTERNS.some((pattern) => pattern.test(name));
}

function pictureAssetType(pictureType) {
  const type = String(pictureType || "").toUpperCase();
  if (type === "WHITE_BACKGROUND" || type === "TRANSPARENCY") return "MAIN";
  if (type === "HOME") return "MAIN";
  if (type === "HOME_SUBSIDIARY" || type === "VERTICAL") return "DETAIL";
  if (type === "COLOR") return "COLOR_BLOCK";
  if (type === "VIDEO_HOME") return "VIDEO";
  if (type === "QUALIFICATION" || type === "CERTIFICATE") return "CERTIFICATE";
  return type || "IMAGE";
}

function deriveSkcCode({ spuCode, colorName, skuItems, picturesRoot }) {
  const sku = skuItems.find((item) => item.color === colorName);
  const values = object(sku?.values);
  if (values["唯品会货号"]) return String(values["唯品会货号"]);
  const xhsCode = values["小红书商家编码"];
  if (xhsCode && String(xhsCode).startsWith(spuCode) && String(xhsCode).length > spuCode.length + 3) {
    return String(xhsCode).slice(0, -3);
  }

  for (const place of Object.values(object(picturesRoot?.pictures))) {
    for (const pictures of Object.values(object(place?.pictures))) {
      for (const picture of array(pictures)) {
        if (picture.skc && (picture.color === colorName || String(picture.color || "").includes(colorName))) {
          return String(picture.skc);
        }
      }
    }
  }

  return `${spuCode}:${colorName}`;
}

function deriveSkuCode({ skcCode, sizeName, sizeCode, values }) {
  return String(
    values["小红书商家编码"]
      || values["SKU_CODE"]
      || values["skuCode"]
      || `${skcCode}${sizeCode || sizeName}`,
  );
}

function collectColors(body) {
  const colorNames = new Set(array(body.colors?.options).map(String));
  for (const sku of array(body.skus?.skuItems)) {
    if (sku.color) colorNames.add(String(sku.color));
  }
  return [...colorNames];
}

function buildColorAliasMaps(body) {
  const colorAliases = object(body.colors?.optionAliases);
  const aliasToColor = new Map();
  for (const [colorName, alias] of Object.entries(colorAliases)) {
    if (alias) aliasToColor.set(String(alias), colorName);
  }
  return { colorAliases, aliasToColor };
}

function moduleCount(modules) {
  return Object.values(object(modules)).reduce((total, values) => total + array(values).length, 0);
}

function extractPackage({ payload, productCode, syncedAt }) {
  const body = object(payload.body);
  const spuCode = String(body.code || productCode);
  return {
    sourceSystem: DEEPDRAW_SOURCE_SYSTEM,
    sourceCode: spuCode,
    spuCode,
    deepdrawProductId: body.productId == null ? null : String(body.productId),
    deepdrawBodyId: body.id == null ? null : String(body.id),
    title: body.title ?? null,
    brandName: body.brandName ?? null,
    categoryId: body.trade?.id == null ? null : String(body.trade.id),
    categoryName: body.trade?.name ?? null,
    tradePath: body.trade?.path ?? null,
    retailPrice: toNumber(body.retailPrice),
    primaryColor: body.primaryColor ?? null,
    version: body.version ?? null,
    complete: Boolean(body.complete),
    createDate: toIso(body.createDate),
    lastUpdateDate: toIso(body.lastUpdateDate),
    onsaleDate: toIso(body.onsaleDate),
    placesJson: compactJson(array(body.places)),
    colorsJson: compactJson(body.colors ?? {}),
    sizesJson: compactJson(body.sizes ?? {}),
    responseCode: payload.code ?? null,
    responseText: payload.response ?? null,
    reason: payload.reason ?? null,
    requestId: payload.requestId ?? null,
    rawPayloadJson: compactJson(body),
    rawResponseJson: compactJson(payload),
    sourceHash: sourceHash(body),
    syncedAt,
  };
}

function extractSkcs({ body, packageRow, syncedAt }) {
  const skuItems = array(body.skus?.skuItems);
  const { colorAliases } = buildColorAliasMaps(body);
  return collectColors(body).map((colorName) => {
    const colorSkus = skuItems.filter((item) => item.color === colorName);
    const skcCode = deriveSkcCode({
      spuCode: packageRow.spuCode,
      colorName,
      skuItems,
      picturesRoot: body.pictures,
    });
    const raw = {
      colorName,
      colorAlias: colorAliases[colorName] ?? null,
      skcCode,
      skuItems: colorSkus,
    };
    return {
      spuCode: packageRow.spuCode,
      skcCode,
      colorName,
      colorAlias: colorAliases[colorName] ?? null,
      skuCount: colorSkus.length,
      rawPayloadJson: compactJson(raw),
      sourceHash: sourceHash(raw),
      syncedAt,
    };
  });
}

function extractSkus({ body, packageRow, skcs, syncedAt }) {
  const sizeCodeByName = parseSizeCodeTexts(body.sizes?.texts);
  const { colorAliases } = buildColorAliasMaps(body);
  const skcByColor = new Map(skcs.map((skc) => [skc.colorName, skc]));
  return array(body.skus?.skuItems).map((skuItem) => {
    const values = object(skuItem.values);
    const skc = skcByColor.get(skuItem.color);
    const skcCode = skc?.skcCode || deriveSkcCode({
      spuCode: packageRow.spuCode,
      colorName: skuItem.color,
      skuItems: array(body.skus?.skuItems),
      picturesRoot: body.pictures,
    });
    const sizeName = skuItem.size == null ? null : String(skuItem.size);
    const sizeCode = sizeName ? sizeCodeByName.get(sizeName) ?? null : null;
    return {
      spuCode: packageRow.spuCode,
      skcCode,
      skuCode: deriveSkuCode({ skcCode, sizeName, sizeCode, values }),
      colorName: skuItem.color ?? null,
      colorAlias: colorAliases[skuItem.color] ?? null,
      sizeName,
      sizeCode,
      barcode: values["单品货号"] || values["唯品会条形码"] || values["商家编码"] || null,
      sellerCode: values["商家编码"] || null,
      xhsSellerCode: values["小红书商家编码"] || null,
      vipSkcCode: values["唯品会货号"] || null,
      price: toNumber(values["价格"] || values["零售价"] || packageRow.retailPrice),
      retailPrice: toNumber(values["零售价"] || packageRow.retailPrice),
      quantity: toNumber(values["数量"]),
      valuesJson: compactJson(values),
      rawPayloadJson: compactJson(skuItem),
      sourceHash: sourceHash(skuItem),
      syncedAt,
    };
  });
}

function extractSizes({ body, packageRow, syncedAt }) {
  const sizeCodeByName = parseSizeCodeTexts(body.sizes?.texts);
  const aliases = object(body.sizes?.optionAliases);
  const field = object(body.sizes?.field);
  return array(body.sizes?.options).map((sizeName, index) => {
    const raw = {
      sizeName,
      sizeCode: sizeCodeByName.get(sizeName) ?? null,
      sizeAlias: aliases[sizeName] ?? null,
      field,
      texts: array(body.sizes?.texts).filter((text) => String(text).split(",")[1] === sizeName),
    };
    return {
      spuCode: packageRow.spuCode,
      sizeName,
      sizeCode: raw.sizeCode,
      sizeAlias: raw.sizeAlias,
      sortNo: index + 1,
      fieldId: field.id == null ? null : String(field.id),
      fieldName: field.name ?? null,
      fieldType: field.type ?? null,
      rawPayloadJson: compactJson(raw),
      syncedAt,
    };
  });
}

function extractDetailPages({ body, packageRow, syncedAt }) {
  return array(body.detalPages).map((page, index) => ({
    spuCode: packageRow.spuCode,
    pageIndex: index + 1,
    templateName: page.templateName ?? null,
    templateWidth: page.templateWidth ?? null,
    active: page.active == null ? null : Boolean(page.active),
    pageTime: toIso(page.time),
    htmlPageUrl: page.htmlPageUrl ?? null,
    imagePageUrl: page.imagePageUrl ?? null,
    mixedPageUrl: page.mixedPageUrl ?? null,
    screenshotCount: array(page.screenShotSectionUrls).length,
    moduleCount: moduleCount(page.modules),
    templateSitesJson: compactJson(array(page.templateSites)),
    modulesJson: compactJson(object(page.modules)),
    rawPayloadJson: compactJson(page),
    syncedAt,
  }));
}

function extractSizeTables({ body, packageRow, syncedAt }) {
  const sizeTables = [];
  const sizeTableRows = [];
  array(body.sizeTables).forEach((table, tableIndex) => {
    const field = object(table.field);
    const row = {
      spuCode: packageRow.spuCode,
      tableIndex: tableIndex + 1,
      fieldId: field.id == null ? null : String(field.id),
      fieldName: field.name ?? null,
      fieldType: field.type ?? null,
      rowCount: array(table.sizeTableItems).length,
      optionsJson: compactJson(array(table.options)),
      optionAliasesJson: compactJson(object(table.optionAliases)),
      rawPayloadJson: compactJson(table),
      syncedAt,
    };
    sizeTables.push(row);
    array(table.sizeTableItems).forEach((item, rowIndex) => {
      sizeTableRows.push({
        spuCode: packageRow.spuCode,
        tableIndex: tableIndex + 1,
        rowIndex: rowIndex + 1,
        sizeName: item.size ?? null,
        valuesJson: compactJson(object(item.values)),
        rawPayloadJson: compactJson(item),
        syncedAt,
      });
    });
  });
  return { sizeTables, sizeTableRows };
}

function extractFields({ body, packageRow, syncedAt }) {
  return array(body.fields)
    .filter((field) => fieldValues(field).hasValue)
    .map((field) => {
      const fieldMeta = object(field.field);
      const name = String(fieldMeta.name || field.name || "");
      return {
        spuCode: packageRow.spuCode,
        fieldId: fieldMeta.id == null ? null : String(fieldMeta.id),
        fieldName: name,
        fieldType: fieldMeta.type ?? field.type ?? null,
        valueText: fieldValueText(field),
        textsJson: compactJson(array(field.texts)),
        optionsJson: compactJson(array(field.options)),
        optionAliasesJson: compactJson(object(field.optionAliases)),
        isKey: isKeyFieldName(name),
        rawPayloadJson: compactJson(field),
        syncedAt,
      };
    });
}

function extractPictureAssets({ body, packageRow, syncedAt }) {
  const { aliasToColor } = buildColorAliasMaps(body);
  const assets = [];
  for (const [placeName, place] of Object.entries(object(body.pictures?.pictures))) {
    const pictureGroups = object(place?.pictures);
    for (const [pictureType, pictures] of Object.entries(pictureGroups)) {
      array(pictures).forEach((picture, index) => {
        const normalizedUrl = normalizeDeepdrawUrl(picture.url);
        if (!normalizedUrl) return;
        const skcCode = picture.skc == null ? null : String(picture.skc);
        const colorName = aliasToColor.get(String(picture.color)) || null;
        assets.push({
          sourceSystem: DEEPDRAW_SOURCE_SYSTEM,
          sourceKind: "PICTURE",
          spuCode: packageRow.spuCode,
          skcCode,
          ownerType: skcCode ? "SKC" : "SPU",
          ownerCode: skcCode || packageRow.spuCode,
          assetType: pictureAssetType(pictureType),
          place: place.place || placeName,
          pictureType,
          detailPageIndex: null,
          moduleName: null,
          moduleIndex: null,
          sourceUrl: picture.url,
          normalizedUrl,
          fileName: picture.name ?? null,
          deepdrawImageId: picture.id == null ? null : String(picture.id),
          width: toNumber(picture.width),
          height: toNumber(picture.height),
          fileSize: toNumber(picture.size),
          sortNo: picture.sortNum ?? index + 1,
          withWatermark: picture.withWatermark == null ? null : Boolean(picture.withWatermark),
          rawPayloadJson: compactJson({ ...picture, colorName }),
          syncedAt,
        });
      });
    }
  }
  return assets;
}

function extractDetailPageAssets({ body, packageRow, syncedAt }) {
  const assets = [];
  array(body.detalPages).forEach((page, pageIndex) => {
    array(page.screenShotSectionUrls).forEach((url, index) => {
      const normalizedUrl = normalizeDeepdrawUrl(url);
      if (!normalizedUrl) return;
      assets.push({
        sourceSystem: DEEPDRAW_SOURCE_SYSTEM,
        sourceKind: "DETAIL_SCREENSHOT",
        spuCode: packageRow.spuCode,
        skcCode: null,
        ownerType: "SPU",
        ownerCode: packageRow.spuCode,
        assetType: "DETAIL_PAGE",
        place: null,
        pictureType: null,
        detailPageIndex: pageIndex + 1,
        moduleName: null,
        moduleIndex: null,
        sourceUrl: url,
        normalizedUrl,
        fileName: null,
        deepdrawImageId: null,
        width: null,
        height: null,
        fileSize: null,
        sortNo: index + 1,
        withWatermark: null,
        rawPayloadJson: compactJson({ url, index: index + 1 }),
        syncedAt,
      });
    });

    for (const [moduleName, urls] of Object.entries(object(page.modules))) {
      array(urls).forEach((url, index) => {
        const normalizedUrl = normalizeDeepdrawUrl(url);
        if (!normalizedUrl) return;
        assets.push({
          sourceSystem: DEEPDRAW_SOURCE_SYSTEM,
          sourceKind: "DETAIL_MODULE",
          spuCode: packageRow.spuCode,
          skcCode: null,
          ownerType: "SPU",
          ownerCode: packageRow.spuCode,
          assetType: "DETAIL_PAGE",
          place: null,
          pictureType: null,
          detailPageIndex: pageIndex + 1,
          moduleName,
          moduleIndex: index + 1,
          sourceUrl: url,
          normalizedUrl,
          fileName: null,
          deepdrawImageId: null,
          width: null,
          height: null,
          fileSize: null,
          sortNo: index + 1,
          withWatermark: null,
          rawPayloadJson: compactJson({ url, moduleName, moduleIndex: index + 1 }),
          syncedAt,
        });
      });
    }
  });
  return assets;
}

export function extractDeepdrawContentRows({
  payload,
  productCode = payload?.body?.code,
  syncedAt = new Date().toISOString(),
}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("DeepDraw payload must be an object");
  }
  if (!payload.body || typeof payload.body !== "object") {
    throw new Error(`DeepDraw payload has no body for product: ${productCode || "unknown"}`);
  }

  const body = payload.body;
  const packageRow = extractPackage({ payload, productCode, syncedAt });
  const skcs = extractSkcs({ body, packageRow, syncedAt });
  const skus = extractSkus({ body, packageRow, skcs, syncedAt });
  const sizes = extractSizes({ body, packageRow, syncedAt });
  const detailPages = extractDetailPages({ body, packageRow, syncedAt });
  const { sizeTables, sizeTableRows } = extractSizeTables({ body, packageRow, syncedAt });
  const fields = extractFields({ body, packageRow, syncedAt });
  const assets = [
    ...extractPictureAssets({ body, packageRow, syncedAt }),
    ...extractDetailPageAssets({ body, packageRow, syncedAt }),
  ];

  return {
    package: packageRow,
    skcs,
    skus,
    sizes,
    detailPages,
    sizeTables,
    sizeTableRows,
    fields,
    assets,
  };
}
