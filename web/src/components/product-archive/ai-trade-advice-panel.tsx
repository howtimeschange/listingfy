import {useEffect, useState} from 'react'
import {Loader2, Sparkles} from 'lucide-react'
import {toast} from 'sonner'
import {api} from '@/lib/api-client'
import {Button} from '@/components/ui/button'

type Advice = {
  requestId: string
  status: string
  candidates: Array<{tradeId: string; tradePath: string; primary: boolean}>
  message: string | null
}

export function AiTradeAdvicePanel({draftId,disabled,onApplied}: {
  draftId: number; disabled?: boolean; onApplied: () => void
}) {
  const [advice,setAdvice] = useState<Advice | null>(null)
  const [loading,setLoading] = useState(false)
  const [applying,setApplying] = useState<string | null>(null)
  const [error,setError] = useState<string | null>(null)
  useEffect(() => {
    if (!advice?.candidates.length) return
    // Exposure is recorded only after a candidate list actually renders.
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const recordShown = async (attempt: number) => {
      try {await api.post(`/product-archive-drafts/${draftId}/trade/ai-advice/${advice.requestId}/shown`)}
      catch {if (!cancelled && attempt < 3) timer = setTimeout(() => void recordShown(attempt + 1), 1000 * attempt)}
    }
    void recordShown(1)
    return () => {cancelled = true;clearTimeout(timer)}
  },[advice,draftId])
  async function recommend() {
    setLoading(true);setError(null);setAdvice(null)
    try {
      setAdvice(await api.post<Advice>(`/product-archive-drafts/${draftId}/trade/ai-advice`,{requestId:crypto.randomUUID()}))
    } catch (e) {setError(e instanceof Error ? e.message : '获取 AI 推荐失败，请重试。')}
    finally {setLoading(false)}
  }
  async function apply(tradeId: string) {
    if (!advice) return
    setApplying(tradeId);setError(null)
    try {
      await api.post(`/product-archive-drafts/${draftId}/trade/ai-advice/${advice.requestId}/apply`,{tradeId})
      toast.success('已采用 AI 推荐类目并生成字段')
      onApplied()
    } catch (e) {setError(e instanceof Error ? e.message : '应用失败，请重试。')}
    finally {setApplying(null)}
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
    <Button type="button" size="sm" variant="brand" title="Powered by Jev" className="relative h-9 px-4 font-semibold" disabled={disabled || loading || applying!==null} onClick={() => void recommend()}>
      {loading ? <Loader2 className="size-4 animate-spin"/> : <Sparkles className="size-4"/>}
      {loading ? '正在推荐…' : advice ? '重新获取 AI 推荐' : 'AI 推荐类目'}
      <span aria-label="Powered by Jev" className="pointer-events-none absolute -right-1 -top-1 rounded-full border border-background bg-foreground px-1.5 text-[9px] font-semibold leading-3.5 text-background">Jev</span>
    </Button>
    <p className="text-xs text-muted-foreground">参考官方类目与上市计划，确认后应用并重建字段。</p>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {advice?.message ? <p role="status" className="text-sm text-muted-foreground">{advice.message}</p> : null}
    {advice?.candidates.length ? <div aria-label="AI 推荐候选" className="grid gap-2 md:grid-cols-3">
      {advice.candidates.map(candidate => <div key={candidate.tradeId} className={`flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 ${candidate.primary ? "border-[var(--brand)]/30 bg-[var(--brand-light)]/30" : "bg-background"}`}>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted-foreground">{candidate.primary ? 'AI 首选' : '备选'} · {candidate.tradeId}</div>
          <div title={candidate.tradePath} className="mt-0.5 line-clamp-2 break-words text-xs leading-4">{candidate.tradePath}</div>
        </div>
        <Button type="button" size="sm" className="h-7 shrink-0 px-2 text-xs" variant={candidate.primary ? 'default' : 'outline'}
          disabled={disabled || applying!==null} onClick={() => void apply(candidate.tradeId)}>
          {applying===candidate.tradeId ? <Loader2 className="size-4 animate-spin"/> : null}确认采用
        </Button>
      </div>)}
    </div> : null}
  </div>
}
