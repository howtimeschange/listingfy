import {randomUUID} from 'node:crypto'
import {getDb} from '../db'
import {categoryAdviceContextForDraft} from './product-archive-drafts'
import {buildCategoryAdviceFacts} from '../../../scripts/lib/deepdraw_category_facts.mjs'
import {categoryAdviceDomain,categoryCandidateMatchesFacts,shouldRequestCategoryAdvice} from '../../../scripts/lib/deepdraw_category_advice_policy.mjs'
import {categoryAdviceRequest,requestCategoryAdvice,CATEGORY_ADVICE_MODEL,CATEGORY_ADVICE_PROMPT_VERSION} from '../../../scripts/lib/typesafe_category_adapter.mjs'
import {hashAiRoutingValue} from '../../../scripts/lib/ai_routing_context.mjs'
import {createPostgresAiRoutingRuntime} from '../../../scripts/lib/ai_routing_postgres.mjs'
import {createCategoryAdviceQueue} from '../../../scripts/lib/deepdraw_category_advice_queue.mjs'

type Row = Record<string, unknown>
type AdviceResult = NonNullable<Awaited<ReturnType<typeof requestCategoryAdvice>>>
const mutableStatuses = new Set(['draft','missing_fields','manual_review','ready','update_pending','duplicate_found'])
function humanSelected(draft: Row) {
  const snapshot = draft.source_snapshot_json as {tradeSelection?: {status?: string}} | null
  return ['human_confirmed','human_adjusted'].includes(snapshot?.tradeSelection?.status ?? '')
}

export function buildCategoryAdviceInput(db: ReturnType<typeof getDb>, draft: Row, {manual = false, contextForDraft = categoryAdviceContextForDraft}: {manual?: boolean; contextForDraft?: typeof categoryAdviceContextForDraft} = {}) {
    const evaluated = contextForDraft(db,draft,{forceCandidates:manual})
    const {facts,provenance} = buildCategoryAdviceFacts(evaluated.sourceRows)
    const candidates = [...new Map(evaluated.candidates.filter(t => categoryCandidateMatchesFacts(t,facts))
      .map(t => [String(t.trade_id),{trade_id:String(t.trade_id),trade_path:String(t.trade_path)}])).values()]
      .sort((a,b) => a.trade_id.localeCompare(b.trade_id))
    const reason = facts.officialCategory?.length !== 1 ? 'official_category_unavailable'
      : !categoryAdviceDomain(facts.officialCategory[0]) ? 'unsupported_domain'
      : !manual && !shouldRequestCategoryAdvice(evaluated.decision,facts) ? evaluated.decision.reasonCode
      : !candidates.length ? 'no_eligible_candidates' : candidates.length>254 ? 'candidate_limit' : null
    const inputHash = hashAiRoutingValue(facts)
    const candidateHash = hashAiRoutingValue(candidates)
    const cacheKey = hashAiRoutingValue({tenant:evaluated.tenantName,merchant:evaluated.merchantId,inputHash,candidateHash,
      model:CATEGORY_ADVICE_MODEL,prompt:CATEGORY_ADVICE_PROMPT_VERSION,policy:2})
    return {...evaluated,facts,provenance,candidates,reason,inputHash,candidateHash,cacheKey}
  }

export function createCategoryAdviceProcessor({db = getDb(),contextForDraft = categoryAdviceContextForDraft,
  requestAdvice = requestCategoryAdvice,signal, audit = createPostgresAiRoutingRuntime(db).audit}: {
  db?: ReturnType<typeof getDb>
  contextForDraft?: typeof categoryAdviceContextForDraft
  requestAdvice?: typeof requestCategoryAdvice
  signal?: AbortSignal
  audit?: ReturnType<typeof createPostgresAiRoutingRuntime>['audit']
} = {}) {
  const queue = createCategoryAdviceQueue(db)
  const context = (draft: Row) => buildCategoryAdviceInput(db,draft,{contextForDraft})
  return async function runOne() {
    queue.expandOneScope()
    const job = queue.claim()
    if (!job) return false
    try {
      const draft = db.prepare('select * from product_archive_draft where id=?').get(job.draft_id) as Row | undefined
      if (!draft || !mutableStatuses.has(String(draft.status)) || humanSelected(draft)) {
        queue.finish(job)
        return true
      }
      const observedAt = new Date().toISOString()
      const input = context(draft)
      let advice: Row = {choice:null,status:'not_evaluated',reason:input.reason}
      if (!input.reason) {
        const cached = db.prepare("select result_json from deepdraw_category_advice_cache where cache_key=? and status='complete' and lease_until>clock_timestamp()")
          .get(input.cacheKey) as {result_json:AdviceResult} | undefined
        let result = cached?.result_json
        if (!result) {
          const token = randomUUID()
          const claim = db.prepare(`insert into deepdraw_category_advice_cache(cache_key,status,lease_until,claim_token)
            values (?,'running',clock_timestamp()+interval '2 minutes',?) on conflict(cache_key) do update
            set status='running',lease_until=excluded.lease_until,claim_token=excluded.claim_token,updated_at=clock_timestamp()
            where deepdraw_category_advice_cache.lease_until<clock_timestamp() returning cache_key`).get(input.cacheKey,token)
          if (!claim) {queue.defer(job); return true}
          try {
            result = await requestAdvice(categoryAdviceRequest(input.facts,input.candidates),{signal})
            if (!result) throw new Error('typesafe_empty_result')
            const saved = db.prepare(`update deepdraw_category_advice_cache set status='complete',result_json=?::jsonb,
              lease_until=clock_timestamp()+interval '7 days',claim_token=null,updated_at=clock_timestamp()
              where cache_key=? and claim_token=? returning cache_key`).get(JSON.stringify(result),input.cacheKey,token)
            if (!saved) {queue.defer(job); return true}
            audit({scenario:'deepdraw_category_advice',mode:'shadow',role:'advisor',providerKey:'typesafe',model:CATEGORY_ADVICE_MODEL,status:'success',
              promptVersion:CATEGORY_ADVICE_PROMPT_VERSION,inputHash:input.inputHash,candidateHash:input.candidateHash,
              latencyMs:result.latencyMs,transportAttempts:result.transportAttempts,result:result.answer,
              usage:{inputTokens:result.usage.input_tokens,outputTokens:result.usage.output_tokens}})
          } catch (error) {
            db.prepare(`update deepdraw_category_advice_cache set status='failed',claim_token=null,
              lease_until=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp() where cache_key=? and claim_token=?`).run(input.cacheKey,token)
            throw error
          }
        }
        advice = {...result.answer,cached:!!cached,tradePath:input.candidates.find(c => c.trade_id===result.answer.choice)?.trade_path ?? null,
          ruleDiffers:result.answer.choice!==input.decision.recommendedTrade?.tradeId}
      }
      queue.finish(job,(currentDraft: Row | undefined) => {
        if (!currentDraft || !mutableStatuses.has(String(currentDraft.status)) || humanSelected(currentDraft)) return
        // A source event may still be waiting for scope expansion. Re-read actual
        // inputs, in addition to checking the queue's generation fence.
        const fresh = context(currentDraft)
        if (fresh.cacheKey!==input.cacheKey || fresh.reason!==input.reason
          || hashAiRoutingValue(fresh.decision.recommendedTrade)!==hashAiRoutingValue(input.decision.recommendedTrade)) {
          db.prepare("select enqueue_deepdraw_category_advice(array[?::bigint],'inputs_changed_during_request')").get(job.draft_id)
          return
        }
        db.prepare(`insert into deepdraw_category_advice_observation
          (draft_id,cache_key,input_hash,candidate_hash,source_json,rule_json,advice_json,created_at,event_revision)
          values (?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::timestamptz,?) on conflict do nothing`).run(job.draft_id,input.cacheKey,
            input.inputHash,input.candidateHash,JSON.stringify({facts:input.facts,provenance:input.provenance,style:draft.spu_code}),
            JSON.stringify(input.decision),JSON.stringify(advice),observedAt,job.claimed_revision)
      })
    } catch (error) {
      const rawCode = error instanceof Error ? error.message : ''
      const code = /^typesafe_[a-z_0-9]+$/.test(rawCode) ? rawCode : 'category_advice_processing_failed'
      queue.retry(job,code)
      audit({scenario:'deepdraw_category_advice',mode:'shadow',role:'advisor',providerKey:'typesafe',model:CATEGORY_ADVICE_MODEL,
        status:'error',errorCode:code,result:{draftId:job.draft_id}})
      console.error('Category advice job failed',{draftId:job.draft_id,code})
    }
    return true
  }
}

export function startCategoryAdviceWorker() {
  if (process.env.AI_SCENARIO_DEEPDRAW_CATEGORY_ADVICE_MODE!=='shadow' || !process.env.TYPESAFE_API_KEY) return async () => {}
  const controller = new AbortController()
  const runOne = createCategoryAdviceProcessor({signal:controller.signal})
  let active: Promise<void> | null = null
  let stopped = false
  const pump = () => {
    if (active || stopped) return
    active = (async () => {
      for (let count=0; count<10 && !stopped; count++) if (!await runOne()) break
    })().catch(() => console.error('Category advice queue unavailable')).finally(() => {active=null})
  }
  // Poll only the indexed durable event/job queues, never the product table.
  const timer = setInterval(pump,2000)
  timer.unref()
  pump()
  return async () => {stopped=true;clearInterval(timer);controller.abort();await active}
}
