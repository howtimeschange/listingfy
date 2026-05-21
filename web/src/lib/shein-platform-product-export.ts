import type { SpreadsheetSheet } from "@/lib/spreadsheet"

export interface PlatformProductExportSaleSite {
  siteAbbr: string
  shelfStatus: number | null
  shelfStatusText: string
  firstShelfTime: string
  lastShelfTime: string
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
  skcs: PlatformProductExportSkc[]
}

function saleSiteExportStatus(site: PlatformProductExportSaleSite) {
  return site.shelfStatusText || (site.shelfStatus === 1 ? "已上架" : "未上架")
}

function skcSkuDetailRows(row: PlatformProductExportRow) {
  return (row.skcs ?? []).flatMap((skc) => {
    const skus = skc.skus ?? []
    const base = {
      SPU: row.spuName,
      SPU供应商货号: row.supplierCode,
      商品名称: row.productName,
      品牌名称: row.brandName,
      类目名称: row.categoryName,
      SKC: skc.skcName,
      SKC供应商货号: skc.supplierCode,
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

export function platformProductWorkbookSheets(rows: PlatformProductExportRow[]): SpreadsheetSheet[] {
  const overviewRows = rows.map((row) => ({
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
  }))
  const detailRows = rows.flatMap(skcSkuDetailRows)
  const saleSiteDetailRows = rows.flatMap((row) =>
    (row.saleSites ?? []).map((site) => ({
      SPU: row.spuName,
      商品名称: row.productName,
      SPU供应商货号: row.supplierCode,
      品牌名称: row.brandName,
      类目名称: row.categoryName,
      供货价: row.costSummary,
      销售站点: site.siteAbbr,
      上架状态: saleSiteExportStatus(site),
      首次上架时间: site.firstShelfTime,
      最近上架时间: site.lastShelfTime,
    })),
  )
  return [
    { name: "平台商品列表", rows: overviewRows },
    { name: "SKC-SKU明细", rows: detailRows.length ? detailRows : [{
      SPU: "",
      SPU供应商货号: "",
      商品名称: "",
      品牌名称: "",
      类目名称: "",
      SKC: "",
      SKC供应商货号: "",
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
      商品名称: "",
      SPU供应商货号: "",
      品牌名称: "",
      类目名称: "",
      供货价: "",
      销售站点: "",
      上架状态: "",
      首次上架时间: "",
      最近上架时间: "",
    }] },
  ]
}
