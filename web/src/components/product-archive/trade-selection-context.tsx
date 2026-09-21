type Trade = {tradeId: string; tradePath: string}
type Decision = {status: string; reason: string; recommendedTrade: Trade | null}
type Reference = {matched: boolean; fields: Array<{key: string; label: string; value: string}>}

export function CurrentTradeSummary({tradeId,tradePath}: {tradeId?: string | null; tradePath?: string | null}) {
  return <div className="mt-2 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand-light)]/30 px-3 py-2 text-left">
    <div className="text-xs text-muted-foreground">当前已生效类目</div>
    <div className="mt-1 break-words text-sm font-medium">{tradePath || (tradeId ? '未维护类目路径' : '尚未选择类目')}
      {tradeId ? <span className="ml-2 text-xs font-normal text-muted-foreground">· {tradeId}</span> : null}
    </div>
  </div>
}

export function TradeSelectionContext({decision,reference}: {decision?: Decision | null; reference?: Reference}) {
  const official = reference?.fields.find(field => field.label === '官方发布类目')
  return <div className="space-y-2 rounded-lg border bg-muted/20 px-3 py-2">
    <div className="flex items-start gap-3 text-xs">
      <span className="w-20 shrink-0 pt-0.5 text-muted-foreground">系统规则推荐</span>
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm">{decision?.recommendedTrade?.tradePath || '暂无唯一推荐'}
          {decision?.recommendedTrade ? <span className="ml-1 text-xs text-muted-foreground">· {decision.recommendedTrade.tradeId}</span> : null}
        </div>
        {decision ? <details className="mt-1 text-muted-foreground">
          <summary className="w-fit cursor-pointer hover:text-foreground">查看规则依据</summary>
          <p className="mt-1 leading-5">{decision.reason}</p>
        </details> : null}
      </div>
    </div>
    <details className="border-t pt-2 text-xs">
      <summary className="cursor-pointer text-muted-foreground">
        上市计划来源
        <span className="ml-3 text-foreground">{official?.value || (reference?.matched ? '已匹配，展开查看' : '未匹配上市计划表')}</span>
      </summary>
      <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {reference?.fields.map(field => <div key={field.key}>
          <span className="text-muted-foreground">{field.label}：</span><span className="break-words">{field.value}</span>
        </div>)}
      </div>
    </details>
  </div>
}
