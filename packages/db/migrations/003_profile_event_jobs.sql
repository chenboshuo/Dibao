create table jobs_new (
  id text primary key,
  type text not null check (
    type in (
      'feed_refresh',
      'content_extract',
      'embedding_generate',
      'profile_event_process',
      'ranking_recalculate',
      'profile_decay',
      'retention_cleanup',
      'vector_index_rebuild'
    )
  ),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  payload_json text,
  error text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after integer not null,
  started_at integer,
  finished_at integer,
  created_at integer not null,
  updated_at integer not null
);

insert into jobs_new (
  id,
  type,
  status,
  payload_json,
  error,
  attempts,
  max_attempts,
  run_after,
  started_at,
  finished_at,
  created_at,
  updated_at
)
select
  id,
  type,
  status,
  payload_json,
  error,
  attempts,
  max_attempts,
  run_after,
  started_at,
  finished_at,
  created_at,
  updated_at
from jobs;

drop table jobs;
alter table jobs_new rename to jobs;

create index if not exists idx_jobs_status_run_after on jobs(status, run_after);
create index if not exists idx_jobs_type on jobs(type);
create index if not exists idx_jobs_created_at on jobs(created_at);
