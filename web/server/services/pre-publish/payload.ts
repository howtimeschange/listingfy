import { asPositiveNumber, normalizeText, parseJsonArray, parseJsonObject } from "./shared"

export function publishInfo(payload: unknown) {
  const object = parseJsonObject(payload)
  return parseJsonObject(object.info)
}

export function responseCode(payload: unknown) {
  const object = parseJsonObject(payload)
  return normalizeText(object.code)
}

export function responseMessage(payload: unknown) {
  const object = parseJsonObject(payload)
  return normalizeText(object.msg) || normalizeText(object.message)
}

export function publishBusinessValidationErrors(payload: unknown) {
  const info = publishInfo(payload)
  const errors: string[] = []
  for (const key of ["pre_valid_result", "mcc_valid_result"]) {
    for (const item of parseJsonArray(info[key])) {
      const object = parseJsonObject(item)
      const formName = normalizeText(object.form_name) || normalizeText(object.form) || key
      for (const message of parseJsonArray(object.messages)) {
        const text = normalizeText(message)
        if (text) errors.push(`${formName}：${text}`)
      }
    }
  }
  return errors
}

export function normalizeBarcode(value: unknown) {
  const compact = normalizeText(value).replace(/[\s-]/g, "")
  if (!/^\d{1,32}$/.test(compact)) return ""
  return compact
}

function firstBarcode(values: unknown[], pattern: RegExp) {
  for (const value of values) {
    const barcode = normalizeBarcode(value)
    if (pattern.test(barcode)) return barcode
  }
  return ""
}

function firstText(values: unknown[], options?: { skipRepeated69?: boolean }) {
  for (const value of values) {
    const text = normalizeText(value)
    if (!text) continue
    if (options?.skipRepeated69 && /^69\d{11}$/.test(normalizeBarcode(text))) continue
    return text
  }
  return ""
}

function supplierSkuPrimary69(sku: Record<string, unknown>) {
  return firstBarcode([
    sku.ean_code,
    sku.source_ean_code,
    sku.supplier_barcode,
    sku.source_supplier_barcode,
    sku.supplier_sku,
  ], /^69\d{11}$/)
}

function supplierSkuFallback99(sku: Record<string, unknown>) {
  return firstBarcode([
    sku.source_inner_code,
    sku.inner_code,
    sku.source_supplier_product_code,
    sku.supplier_product_code,
    sku.source_sku_code_inner_code,
    sku.source_sku_code_supplier_product_code,
    sku.supplier_sku,
  ], /^99\d{11}$/)
}

function supplierSkuFallback(sku: Record<string, unknown>) {
  return supplierSkuFallback99(sku)
    || firstText([
      sku.supplier_sku,
      sku.source_inner_code,
      sku.inner_code,
      sku.source_supplier_product_code,
      sku.supplier_product_code,
      sku.source_sku_code_inner_code,
      sku.source_sku_code_supplier_product_code,
      sku.sku_code,
    ], { skipRepeated69: true })
}

export function publishSupplierSku(sku: Record<string, unknown>) {
  return supplierSkuPrimary69(sku) || supplierSkuFallback(sku)
}

export function buildPublishSupplierSkuMap(skus: Array<Record<string, unknown>>) {
  const primary69Counts = new Map<string, number>()
  const rows = skus.map((sku) => {
    const skuCode = normalizeText(sku.sku_code)
    const primary69 = supplierSkuPrimary69(sku)
    if (primary69) primary69Counts.set(primary69, (primary69Counts.get(primary69) ?? 0) + 1)
    return { sku, skuCode, primary69 }
  })
  const output = new Map<string, string>()
  for (const row of rows) {
    if (!row.skuCode) continue
    const primaryIsUnique = row.primary69 && (primary69Counts.get(row.primary69) ?? 0) === 1
    const supplierSku = primaryIsUnique
      ? row.primary69
      : supplierSkuFallback(row.sku) || row.primary69
    output.set(row.skuCode, supplierSku)
  }
  return output
}

export function publishPackageWeight(value: unknown, fallbackValue?: unknown) {
  return asPositiveNumber(value) ?? asPositiveNumber(fallbackValue)
}
