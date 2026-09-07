export type SheinPlatformProductView = "list" | "sites" | "detail"

export interface DetailQueryState {
  enabled: boolean
  spuName: string
}

export interface SaleSitesDetail<TSite> {
  spuName: string
  saleSites: TSite[]
}

function normalized(value: string | null | undefined) {
  return value?.trim() ?? ""
}

export function detailQueryForView({
  view,
  selectedSpuName,
  saleSitesDialogSpuName,
}: {
  view: SheinPlatformProductView
  selectedSpuName: string
  saleSitesDialogSpuName?: string | null
}): DetailQueryState {
  const spuName = view === "detail"
    ? normalized(selectedSpuName)
    : normalized(saleSitesDialogSpuName)
  return { spuName, enabled: Boolean(spuName) }
}

export function saleSitesForDialog<TSite>(
  saleSitesDialogSpuName: string | null | undefined,
  detail: SaleSitesDetail<TSite> | null | undefined,
): TSite[] {
  return normalized(saleSitesDialogSpuName) === normalized(detail?.spuName)
    ? detail?.saleSites ?? []
    : []
}

export function currencyForForm(explicitCurrency: string | null | undefined, currencyOptions: string[]) {
  const currency = normalized(explicitCurrency)
  return currency || currencyOptions[0] || ""
}

export function validateCurrencySelection(currency: string | null | undefined, currencyOptions: string[]) {
  const normalizedCurrency = normalized(currency)
  if (!currencyOptions.length) return "正在加载站点币种，暂不能提交"
  if (!normalizedCurrency) return "请选择店铺币种"
  if (!currencyOptions.includes(normalizedCurrency)) return `币种 ${normalizedCurrency} 不属于当前店铺可用币种`
  return ""
}
