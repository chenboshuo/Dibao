create table if not exists interest_families (
  id text primary key,
  embedding_index_id text not null references embedding_indexes(id) on delete cascade,
  polarity text not null check (polarity in ('positive', 'negative')),
  display_label text not null,
  centroid_vector_blob blob not null,
  weight real not null default 0,
  cluster_count integer not null default 0,
  support_article_count integer not null default 0,
  support_event_count integer not null default 0,
  source_count integer not null default 0,
  strong_signal_count integer not null default 0,
  top_source_share real not null default 0,
  maturity real not null default 0,
  dominance_ratio real not null default 0,
  label_terms_json text,
  representative_cluster_ids_json text,
  diagnostics_json text,
  created_at integer not null,
  updated_at integer not null
);

create index if not exists idx_interest_families_index_polarity_weight
  on interest_families(embedding_index_id, polarity, weight);
create index if not exists idx_interest_families_dominance
  on interest_families(embedding_index_id, polarity, dominance_ratio);

create table if not exists interest_cluster_family_members (
  cluster_id text primary key references interest_clusters(id) on delete cascade,
  family_id text not null references interest_families(id) on delete cascade,
  embedding_index_id text not null references embedding_indexes(id) on delete cascade,
  polarity text not null check (polarity in ('positive', 'negative')),
  membership_confidence real not null default 0,
  centroid_similarity real not null default 0,
  created_at integer not null,
  updated_at integer not null
);

create index if not exists idx_interest_cluster_family_members_family
  on interest_cluster_family_members(family_id, membership_confidence);
create index if not exists idx_interest_cluster_family_members_index_polarity
  on interest_cluster_family_members(embedding_index_id, polarity);

create table jobs_017 (
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
      'interest_cluster_auto_merge',
      'interest_family_rebuild'
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

insert into jobs_017 (
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
alter table jobs_017 rename to jobs;

create index if not exists idx_jobs_status_run_after on jobs(status, run_after);
create index if not exists idx_jobs_type on jobs(type);
create index if not exists idx_jobs_created_at on jobs(created_at);
