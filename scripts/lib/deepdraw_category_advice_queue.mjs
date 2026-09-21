import {randomUUID} from 'node:crypto';

export function createCategoryAdviceQueue(db) {
  return {
    expandOneScope() {
      return db.transaction(() => {
        const event = db.prepare(`select * from deepdraw_category_advice_scope_event
          where available_at <= clock_timestamp() order by available_at
          for update skip locked limit 1`).get();
        if (!event) return false;
        const payload = event.payload_json;
        const where = event.kind === 'source' ? 'spu_code = ?' : 'tenant_name = ? and merchant_id = ?';
        const values = event.kind === 'source' ? [payload.spu] : [payload.tenant_name,payload.merchant_id];
        db.prepare(`select enqueue_deepdraw_category_advice(array(select id from product_archive_draft
          where ${where} and status in ('draft','missing_fields','manual_review','ready','update_pending','duplicate_found')
          and coalesce(source_snapshot_json #>> '{tradeSelection,status}','') not in ('human_confirmed','human_adjusted')), ?)`)
          .get(...values,event.kind === 'source' ? 'launch_plan_changed' : 'candidates_changed');
        db.prepare('delete from deepdraw_category_advice_scope_event where kind=? and scope_key=?').run(event.kind,event.scope_key);
        return true;
      })();
    },
    claim() {
      return db.prepare(`with next_job as (
        select draft_id from deepdraw_category_advice_job
        where (status='queued' and available_at<=clock_timestamp())
          or (status='running' and lease_until<clock_timestamp())
        order by available_at,draft_id for update skip locked limit 1
      ) update deepdraw_category_advice_job j set status='running',claim_token=?,
        claimed_revision=j.revision,attempts=j.attempts+1,lease_until=clock_timestamp()+interval '2 minutes',updated_at=clock_timestamp()
      from next_job n where j.draft_id=n.draft_id returning j.*`).get(randomUUID());
    },
    // Caller holds the draft lock before entering; draft -> job is the same lock
    // order used by write triggers, avoiding inversions with human operations.
    finish(job, callback) {
      return db.transaction(() => {
        const draft = db.prepare('select * from product_archive_draft where id=? for update').get(job.draft_id);
        const current = db.prepare('select * from deepdraw_category_advice_job where draft_id=? for update').get(job.draft_id);
        if (!current || current.claim_token !== job.claim_token || current.status !== 'running') return false;
        const superseded = current.revision !== job.claimed_revision;
        if (!superseded) callback?.(draft);
        db.prepare(`update deepdraw_category_advice_job set
          status=case when revision=claimed_revision then 'completed' else 'queued' end,
          claim_token=null,lease_until=null,updated_at=clock_timestamp() where draft_id=? and claim_token=?`)
          .run(job.draft_id,job.claim_token);
        return !superseded;
      })();
    },
    retry(job, code, delaySeconds = 30) {
      db.prepare(`update deepdraw_category_advice_job set
        status=case when revision<>claimed_revision then 'queued' when attempts>=3 then 'failed' else 'queued' end,
        available_at=case when revision<>claimed_revision then clock_timestamp() else clock_timestamp()+(?::double precision*interval '1 second') end,
        last_error_code=?,claim_token=null,lease_until=null,updated_at=clock_timestamp()
        where draft_id=? and claim_token=? and status='running'`).run(delaySeconds,code,job.draft_id,job.claim_token);
    },
    defer(job, delaySeconds = 10) {
      db.prepare(`update deepdraw_category_advice_job set status='queued',attempts=greatest(0,attempts-1),
        available_at=clock_timestamp()+(?::double precision*interval '1 second'),claim_token=null,lease_until=null
        where draft_id=? and claim_token=?`).run(delaySeconds,job.draft_id,job.claim_token);
    },
  };
}
