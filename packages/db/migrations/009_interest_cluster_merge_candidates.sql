alter table interest_cluster_labels add column label_diagnostics_json text;

create table if not exists interest_cluster_merge_candidates (
  id text primary key,
  embedding_index_id text not null,
  left_cluster_id text not null,
  right_cluster_id text not null,
  polarity text not null check (polarity in ('positive', 'negative')),
  centroid_similarity real not null,
  label_jaccard real not null default 0,
  evidence_overlap real not null default 0,
  representative_overlap real not null default 0,
  source_overlap real not null default 0,
  merge_score real not null,
  recommendation text not null check (
    recommendation in ('auto_merge', 'review', 'ignore')
  ),
  status text not null default 'open' check (
    status in ('open', 'merged', 'ignored', 'dismissed')
  ),
  reason_json text,
  created_at integer not null,
  updated_at integer not null,
  decided_at integer
);

create unique index if not exists idx_interest_cluster_merge_pair
  on interest_cluster_merge_candidates(left_cluster_id, right_cluster_id);

create index if not exists idx_interest_cluster_merge_candidates_status
  on interest_cluster_merge_candidates(embedding_index_id, status, merge_score);

create table jobs_009 (
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
      'vector_index_rebuild',
      'article_fingerprint_backfill',
      'duplicate_group_rebuild',
      'keyword_profile_rebuild',
      'recent_intent_rebuild',
      'ftrl_train',
      'ranking_eval_run',
      'recommendation_backfill',
      'interest_cluster_label_rebuild',
      'interest_cluster_merge_diagnostics',
      'interest_cluster_auto_merge'
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

insert into jobs_009 (
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
alter table jobs_009 rename to jobs;

create index if not exists idx_jobs_status_run_after on jobs(status, run_after);
create index if not exists idx_jobs_type on jobs(type);
create index if not exists idx_jobs_created_at on jobs(created_at);
