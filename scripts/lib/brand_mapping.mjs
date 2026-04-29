export const BRAND_MAPPINGS = [
  {
    brandCode: "20",
    brandName: "巴拉巴拉",
    aliases: ["Balabala"],
    deepdrawTenantName: "电商巴拉巴拉",
  },
  {
    brandCode: "25",
    brandName: "梦多多",
    aliases: [],
    deepdrawTenantName: null,
  },
  {
    brandCode: "10",
    brandName: "森马",
    aliases: ["Semir"],
    deepdrawTenantName: "森马电商",
  },
  {
    brandCode: "50",
    brandName: "马卡乐",
    aliases: [],
    deepdrawTenantName: "电商马卡乐（森马儿童）",
  },
  {
    brandCode: "28",
    brandName: "森马儿童",
    aliases: [],
    deepdrawTenantName: "电商马卡乐（森马儿童）",
  },
  {
    brandCode: "23",
    brandName: "mini bala",
    aliases: ["迷你巴拉"],
    deepdrawTenantName: "迷你巴拉",
  },
  {
    brandCode: "33",
    brandName: "亚瑟士",
    aliases: ["ASICS"],
    deepdrawTenantName: "电商亚瑟士",
  },
  {
    brandCode: "35",
    brandName: "彪马儿童",
    aliases: ["PUMAKIDS"],
    deepdrawTenantName: "PUMAKIDS",
  },
  {
    brandCode: "61",
    brandName: "MOP",
    aliases: [],
    deepdrawTenantName: "MOP",
  },
];

export const DEEPDRAW_TENANT_OPTIONS = [
  { tenantName: "森马股份", merchantId: "21226", relatedBrandCodes: ["10"] },
  { tenantName: "森马电商", merchantId: "1154", relatedBrandCodes: ["10"] },
  { tenantName: "森马内衣", merchantId: "21468", relatedBrandCodes: ["10"] },
  { tenantName: "森马鞋品", merchantId: "20598", relatedBrandCodes: ["10"] },
  { tenantName: "电商巴拉巴拉", merchantId: "1162", relatedBrandCodes: ["20"] },
  { tenantName: "电商亚瑟士", merchantId: "23391", relatedBrandCodes: ["33"] },
  { tenantName: "股份巴拉巴拉", merchantId: "21211", relatedBrandCodes: ["20"] },
  { tenantName: "电商马卡乐（森马儿童）", merchantId: "1212", relatedBrandCodes: ["28", "50"] },
  { tenantName: "股份马卡乐（森马儿童）", merchantId: "22643", relatedBrandCodes: ["28", "50"] },
  { tenantName: "迷你巴拉", merchantId: "1527", relatedBrandCodes: ["23"] },
  { tenantName: "MOP", merchantId: "1527", relatedBrandCodes: ["61"] },
  { tenantName: "PUMAKIDS", merchantId: "24422", relatedBrandCodes: ["35"] },
];

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function findBrandMapping(value) {
  const query = normalize(value);
  if (!query) return null;
  return BRAND_MAPPINGS.find((item) => (
    normalize(item.brandCode) === query
    || normalize(item.brandName) === query
    || item.aliases.some((alias) => normalize(alias) === query)
  )) ?? null;
}

export function deepdrawTenantForBrand(value) {
  return findBrandMapping(value)?.deepdrawTenantName ?? null;
}
