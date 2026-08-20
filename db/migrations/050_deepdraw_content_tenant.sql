alter table product_content_package
  add column if not exists tenant_name text not null default 'legacy';

-- sqlite-skip-statement: SQLite cannot drop an inline UNIQUE constraint.
alter table product_content_package
  drop constraint if exists product_content_package_source_system_source_code_key;

create unique index if not exists idx_product_content_package_tenant_source
  on product_content_package(tenant_name, source_system, source_code);

create index if not exists idx_product_content_package_tenant_spu
  on product_content_package(tenant_name, spu_code);
