-- postgres-only schema revision: product archive drafts are PostgreSQL-first.

alter table product_archive_draft
  add column if not exists submit_claim_token text;

create index if not exists idx_product_archive_draft_submit_claim
  on product_archive_draft(submit_claim_token)
  where submit_claim_token is not null;
