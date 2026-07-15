import type { SpreadsheetSheet } from "@/lib/spreadsheet"

export interface PlatformProductExportSaleSite {
  siteAbbr: string
  shelfStatus: number | null
  shelfStatusText: string
  firstShelfTime: string
  lastShelfTime: string
  link?: string
  source?: string
}

export interface PlatformProductExportSaleSiteDetail extends PlatformProductExportSaleSite {
  skcName: string
  skcSupplierCode: string
}

export interface PlatformProductExportSku {
  skuCode: string
  supplierSku: string
  saleText: string
  costs: string
  prices: string
}

export interface PlatformProductExportSkc {
  skcName: string
  supplierCode: string
  imageUrl: string | null
  shelfStatusText: string
  skuCount?: number
  skus?: PlatformProductExportSku[]
}

export interface PlatformProductExportRow {
  spuName: string
  supplierCode: string
  productName: string
  brandName: string
  categoryName: string
  imageUrl: string | null
  costSummary: string
  saleSiteCount: number
  saleSiteSummary: string
  skcCount: number
  skuCount: number
  lastDetailSyncedAt: string
  lastListSyncedAt: string
  saleSites: PlatformProductExportSaleSite[]
  saleSiteDetails?: PlatformProductExportSaleSiteDetail[]
  skcs: PlatformProductExportSkc[]
}

function saleSiteExportStatus(site: PlatformProductExportSaleSite) {
  return site.shelfStatusText || (site.shelfStatus === 1 ? "已上架" : "未上架")
}

function saleSiteSkcName(site: PlatformProductExportSaleSite | PlatformProductExportSaleSiteDetail) {
  return "skcName" in site && typeof site.skcName === "string" ? site.skcName : ""
}

function saleSiteSkcSupplierCode(site: PlatformProductExportSaleSite | PlatformProductExportSaleSiteDetail) {
  return "skcSupplierCode" in site && typeof site.skcSupplierCode === "string" ? site.skcSupplierCode : ""
}

function skcSkuDetailRows(row: PlatformProductExportRow) {
  return (row.skcs ?? []).flatMap((skc) => {
    const skus = skc.skus ?? []
    const base = {
      SPU: row.spuName,
      SKC: skc.skcName,
      SKC供应商货号: skc.supplierCode,
      SPU供应商货号: row.supplierCode,
      商品名称: row.productName,
      品牌名称: row.brandName,
      类目名称: row.categoryName,
      SKC图片: skc.imageUrl || "",
      SKC状态: skc.shelfStatusText,
    }
    if (!skus.length) {
      return [{
        ...base,
        SKU: "",
        SKU供应商货号: "",
        SKU销售属性: "",
        供货价: "",
        售价: "",
      }]
    }
    return skus.map((sku) => ({
      ...base,
      SKU: sku.skuCode,
      SKU供应商货号: sku.supplierSku,
      SKU销售属性: sku.saleText,
      供货价: sku.costs,
      售价: sku.prices,
    }))
  })
}

function overviewExportRow(row: PlatformProductExportRow) {
  return {
    SPU: row.spuName,
    商品名称: row.productName,
    SPU供应商货号: row.supplierCode,
    品牌名称: row.brandName,
    类目名称: row.categoryName,
    商品图片: row.imageUrl || "",
    供货价: row.costSummary,
    上架站点数: row.saleSiteCount,
    销售站点: row.saleSiteSummary || "详情同步后显示",
    SKC数: row.skcCount,
    SKU数: row.skuCount,
    详情同步时间: row.lastDetailSyncedAt,
    列表同步时间: row.lastListSyncedAt,
  }
}

function saleSiteDetailRowsForProduct(row: PlatformProductExportRow) {
  const skcsByName = new Map((row.skcs ?? []).map((skc) => [skc.skcName, skc]))
  return ((row.saleSiteDetails?.length ? row.saleSiteDetails : row.saleSites) ?? []).map((site) => {
    const skcName = saleSiteSkcName(site)
    const skcSupplierCode = saleSiteSkcSupplierCode(site)
    const skc = skcsByName.get(skcName)
    return {
      SPU: row.spuName,
      SKC: skcName,
      SKC供应商货号: skcSupplierCode || skc?.supplierCode || "",
      SPU供应商货号: row.supplierCode,
      商品名称: row.productName,
      品牌名称: row.brandName,
      类目名称: row.categoryName,
      供货价: row.costSummary,
      销售站点: site.siteAbbr,
      上架状态: saleSiteExportStatus(site),
      首次上架时间: site.firstShelfTime,
      最近上架时间: site.lastShelfTime,
      商品链接: site.link || "",
      来源: site.source || "",
    }
  })
}

export const PLATFORM_PRODUCT_WORKBOOK_COLUMNS = {
  overview: ["SPU", "商品名称", "SPU供应商货号", "品牌名称", "类目名称", "商品图片", "供货价", "上架站点数", "销售站点", "SKC数", "SKU数", "详情同步时间", "列表同步时间"],
  skcSku: ["SPU", "SKC", "SKC供应商货号", "SPU供应商货号", "商品名称", "品牌名称", "类目名称", "SKC图片", "SKC状态", "SKU", "SKU供应商货号", "SKU销售属性", "供货价", "售价"],
  saleSite: ["SPU", "SKC", "SKC供应商货号", "SPU供应商货号", "商品名称", "品牌名称", "类目名称", "供货价", "销售站点", "上架状态", "首次上架时间", "最近上架时间", "商品链接", "来源"],
} as const

export function platformProductWorkbookRows(row: PlatformProductExportRow) {
  return {
    overview: overviewExportRow(row),
    skcSku: skcSkuDetailRows(row),
    saleSite: saleSiteDetailRowsForProduct(row),
  }
}

export function platformProductWorkbookSheets(rows: PlatformProductExportRow[]): SpreadsheetSheet[] {
  const transformed = rows.map(platformProductWorkbookRows)
  const overviewRows = transformed.map((item) => item.overview)
  const detailRows = transformed.flatMap((item) => item.skcSku)
  const saleSiteDetailRows = transformed.flatMap((item) => item.saleSite)
  return [
    { name: "平台商品列表", rows: overviewRows },
    { name: "SKC-SKU明细", rows: detailRows.length ? detailRows : [{
      SPU: "",
      SKC: "",
      SKC供应商货号: "",
      SPU供应商货号: "",
      商品名称: "",
      品牌名称: "",
      类目名称: "",
      SKC图片: "",
      SKC状态: "",
      SKU: "",
      SKU供应商货号: "",
      SKU销售属性: "",
      供货价: "",
      售价: "",
    }] },
    { name: "销售站点明细", rows: saleSiteDetailRows.length ? saleSiteDetailRows : [{
      SPU: "",
      SKC: "",
      SKC供应商货号: "",
      SPU供应商货号: "",
      商品名称: "",
      品牌名称: "",
      类目名称: "",
      供货价: "",
      销售站点: "",
      上架状态: "",
      首次上架时间: "",
      最近上架时间: "",
      商品链接: "",
      来源: "",
    }] },
  ]
}
