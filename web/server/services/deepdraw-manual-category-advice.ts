import {randomUUID} from 'node:crypto'
import {getDb} from '../db'
import {applyProductArchiveDraftTrade,categoryAdviceContextForDraft} from './product-archive-drafts'
import {buildCategoryAdviceInput} from './deepdraw-category-advice'
import {categoryAdviceRequest,requestCategoryAdvice,CATEGORY_ADVICE_MODEL,CATEGORY_ADVICE_PROMPT_VERSION} from '../../../scripts/lib/typesafe_category_adapter.mjs'
import {hashAiRoutingValue} from '../../../scripts/lib/ai_routing_context.mjs'
import {createPostgresAiRoutingRuntime} from '../../../scripts/lib/ai_routing_postgres.mjs'

type Row = Record<string, unknown>
type Candidate = {tradeId: string; tradePath: string; primary: boolean}
type Result = NonNullable<Awaited<ReturnType<typeof requestCategoryAdvice>>>
const mutable = new Set(['draft','missing_fields','manual_review','ready','update_pending','duplicate_found'])
export class ManualCategoryAdviceError extends Error {
  constructor(message: string, public status: 400|403|404|409|503 = 409, public stale = false) {super(message)}
}
function stateHash(draft: Row, input: ReturnType<typeof buildCategoryAdviceInput>) {
  const selection = (draft.source_snapshot_json as {tradeSelection?: Row} | null)?.tradeSelection
  return hashAiRoutingValue({inputHash:input.inputHash,candidateHash:input.candidateHash,
    tenant:input.tenantName,merchant:input.merchantId,tradeId:draft.trade_id,
    selectionStatus:selection?.status,confirmedAt:selection?.confirmedAt})
}
function dto(row: Row) {
  return {requestId:String(row.id),status:String(row.status),candidates:row.candidates_json as Candidate[],
    message:row.status==='unavailable' ? '官方类目信息不足、候选不适用或无法唯一判断，请继续人工选择。' : null}
}

export function createManualCategoryAdviceService({db=getDb(),contextForDraft=categoryAdviceContextForDraft,
  requestAdvice=requestCategoryAdvice,applyTrade=applyProductArchiveDraftTrade,
  enabled=Boolean(process.env.TYPESAFE_API_KEY),audit=createPostgresAiRoutingRuntime(db).audit}: {
  db?: ReturnType<typeof getDb>; contextForDraft?: typeof categoryAdviceContextForDraft
  requestAdvice?: typeof requestCategoryAdvice; applyTrade?: typeof applyProductArchiveDraftTrade
  enabled?: boolean; audit?: ReturnType<typeof createPostgresAiRoutingRuntime>['audit']
} = {}) {
  const inputFor = (draft: Row) => buildCategoryAdviceInput(db,draft,{manual:true,contextForDraft})
  function owned(id: string,draftId: number,userId: number) {
    const row=db.prepare('select * from deepdraw_category_manual_request where id=? and draft_id=?').get(id,draftId) as Row | undefined
    if (!row) throw new ManualCategoryAdviceError('未找到本次 AI 推荐，请重新获取。',404)
    if (Number(row.requested_by)!==userId) throw new ManualCategoryAdviceError('请使用当前账号重新获取 AI 推荐。',403)
    return row
  }
  function draftFor(id: number,lock=false) {
    const draft=db.prepare(`select * from product_archive_draft where id=?${lock?' for update':''}`).get(id) as Row | undefined
    if (!draft) throw new ManualCategoryAdviceError('草稿不存在。',404)
    if (!mutable.has(String(draft.status))) throw new ManualCategoryAdviceError('当前草稿状态不允许修改类目。')
    return draft
  }
  return {
    async recommend(draftId: number,userId: number,id: string) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new ManualCategoryAdviceError('推荐请求标识无效。',400)
      if (!enabled) throw new ManualCategoryAdviceError('AI 类目推荐尚未配置，请联系管理员。',503)
      const existing=db.prepare('select * from deepdraw_category_manual_request where id=?').get(id) as Row | undefined
      if (existing) {
        const row=owned(id,draftId,userId)
        if (['ready','unavailable','applied'].includes(String(row.status))) return dto(row)
        throw new ManualCategoryAdviceError('该请求正在处理或已失效，请重新获取推荐。')
      }
      const draft=db.transaction(()=>{
        const current=draftFor(draftId,true)
        db.prepare(`insert into deepdraw_category_manual_request(id,draft_id,requested_by,tenant_name,merchant_id,status)
          values(?,?,?,?,?,'running')`).run(id,draftId,userId,current.tenant_name,current.merchant_id)
        return current
      })()
      const observedAt=new Date().toISOString()
      try {
        const input=inputFor(draft)
        const fingerprint=stateHash(draft,input)
        let result: Result | undefined
        let cached=false
        if (!input.reason) {
          const hit=db.prepare("select result_json from deepdraw_category_advice_cache where cache_key=? and status='complete' and lease_until>clock_timestamp()")
            .get(input.cacheKey) as {result_json:Result} | undefined
          result=hit?.result_json; cached=!!hit
          if (!result) {
            const token=randomUUID()
            const claim=db.prepare(`insert into deepdraw_category_advice_cache(cache_key,status,lease_until,claim_token)
              values (?,'running',clock_timestamp()+interval '2 minutes',?) on conflict(cache_key) do update
              set status='running',lease_until=excluded.lease_until,claim_token=excluded.claim_token,updated_at=clock_timestamp()
              where deepdraw_category_advice_cache.lease_until<clock_timestamp() returning cache_key`).get(input.cacheKey,token)
            if (!claim) throw new ManualCategoryAdviceError('同类商品的 AI 推荐正在生成，请稍后重试。')
            try {
              result=await requestAdvice(categoryAdviceRequest(input.facts,input.candidates))
              if (!result) throw new Error('typesafe_empty_result')
              const saved=db.prepare(`update deepdraw_category_advice_cache set status='complete',result_json=?::jsonb,
                lease_until=clock_timestamp()+interval '7 days',claim_token=null,updated_at=clock_timestamp()
                where cache_key=? and claim_token=? returning cache_key`).get(JSON.stringify(result),input.cacheKey,token)
              if (!saved) throw new ManualCategoryAdviceError('推荐状态已更新，请重新获取。')
            } catch(error) {
              db.prepare(`update deepdraw_category_advice_cache set status='failed',claim_token=null,lease_until=clock_timestamp()+interval '30 seconds'
                where cache_key=? and claim_token=?`).run(input.cacheKey,token)
              throw error
            }
          }
        }
        const answer=result?.answer
        const offered: Candidate[]=!answer || answer.choice==='NEEDS_REVIEW' ? [] : input.candidates
          .filter(c => c.trade_id===answer.choice || (answer.probabilities[c.trade_id] ?? 0)>0)
          .sort((a,b) => Number(b.trade_id===answer.choice)-Number(a.trade_id===answer.choice)
            || (answer.probabilities[b.trade_id] ?? 0)-(answer.probabilities[a.trade_id] ?? 0))
          .slice(0,3).map(c => ({tradeId:c.trade_id,tradePath:c.trade_path,primary:c.trade_id===answer.choice}))
        db.transaction(()=>{
          const current=draftFor(draftId,true)
          if (stateHash(current,inputFor(current))!==fingerprint) throw new ManualCategoryAdviceError('草稿、来源或候选已变化，请重新获取 AI 推荐。',409,true)
          db.prepare(`update deepdraw_category_manual_request set status=?,state_hash=?,input_hash=?,candidate_hash=?,
            candidates_json=?::jsonb,primary_trade_id=?,updated_at=clock_timestamp() where id=?`).run(offered.length?'ready':'unavailable',fingerprint,
              input.inputHash,input.candidateHash,JSON.stringify(offered),answer?.choice==='NEEDS_REVIEW'?null:answer?.choice ?? null,id)
          db.prepare(`insert into deepdraw_category_advice_observation
            (draft_id,cache_key,input_hash,candidate_hash,source_json,rule_json,advice_json,created_at,event_revision,trigger_type,manual_request_id)
            values(?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::timestamptz,0,'manual',?)`).run(draftId,`${input.cacheKey}/manual/${id}`,
              input.inputHash,input.candidateHash,JSON.stringify({facts:input.facts,provenance:input.provenance,style:draft.spu_code}),
              JSON.stringify(input.decision),JSON.stringify({...answer,cached,offered,reason:input.reason}),observedAt,id)
        })()
        audit({scenario:'deepdraw_category_advice',mode:'manual',role:'advisor',providerKey:'typesafe',model:CATEGORY_ADVICE_MODEL,
          status:input.reason?'skipped':cached?'cache_hit':'success',promptVersion:CATEGORY_ADVICE_PROMPT_VERSION,
          inputHash:input.inputHash,candidateHash:input.candidateHash,result:{requestId:id,choice:answer?.choice},
          latencyMs:result?.latencyMs,usage:{inputTokens:result?.usage.input_tokens,outputTokens:result?.usage.output_tokens}})
        return dto(owned(id,draftId,userId))
      } catch(error) {
        db.prepare("update deepdraw_category_manual_request set status=?,error_code='manual_advice_failed',updated_at=clock_timestamp() where id=? and status='running'").run(error instanceof ManualCategoryAdviceError && error.stale ? "stale" : "failed",id)
        audit({scenario:'deepdraw_category_advice',mode:'manual',role:'advisor',providerKey:'typesafe',model:CATEGORY_ADVICE_MODEL,status:'error',errorCode:'manual_advice_failed',result:{requestId:id}})
        if (error instanceof ManualCategoryAdviceError) throw error
        throw new ManualCategoryAdviceError('AI 推荐暂时不可用，请稍后重试；当前类目未更改。',503)
      }
    },
    shown(draftId: number,userId: number,id: string) {
      owned(id,draftId,userId)
      db.prepare(`update deepdraw_category_manual_request set shown_at=coalesce(shown_at,clock_timestamp())
        where id=? and status in ('ready','applied') and jsonb_array_length(candidates_json)>0`).run(id)
      return {ok:true}
    },
    apply(draftId: number,userId: number,id: string,tradeId: string) {
      try { return db.transaction(()=>{
        const draft=draftFor(draftId,true)
        const row=owned(id,draftId,userId)
        if (row.status==='applied') {
          if (row.applied_trade_id===tradeId && draft.trade_id===tradeId) return {ok:true,tradeId}
          throw new ManualCategoryAdviceError('该推荐已处理，请重新获取。')
        }
        if (row.status!=='ready') throw new ManualCategoryAdviceError('推荐已失效，请重新获取。')
        if (Date.now()-new Date(String(row.created_at)).getTime()>30*60*1000) throw new ManualCategoryAdviceError('推荐已过期，请重新获取。',409,true)
        const input=inputFor(draft)
        const candidate=(row.candidates_json as Candidate[]).find(c => c.tradeId===tradeId)
        if (!candidate) throw new ManualCategoryAdviceError('请选择本次 AI 推荐中的候选类目。',400)
        if (input.reason || stateHash(draft,input)!==row.state_hash || !input.candidates.some(c => c.trade_id===tradeId)) {
          throw new ManualCategoryAdviceError('来源、合法候选或人工选择已变化，请重新获取 AI 推荐。',409,true)
        }
        applyTrade(db,draftId,{tradeId,tradePath:candidate.tradePath})
        db.prepare(`update deepdraw_category_manual_request set status='applied',applied_trade_id=?,
          shown_at=coalesce(shown_at,clock_timestamp()),applied_at=clock_timestamp(),updated_at=clock_timestamp() where id=?`).run(tradeId,id)
        return {ok:true,tradeId}
      })() } catch(error) {
        if (error instanceof ManualCategoryAdviceError && error.stale) {
          db.prepare("update deepdraw_category_manual_request set status='stale',updated_at=clock_timestamp() where id=? and requested_by=? and status='ready'").run(id,userId)
        }
        throw error
      }
    },
  }
}
