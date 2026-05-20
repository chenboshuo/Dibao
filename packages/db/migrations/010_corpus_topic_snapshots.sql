create table if not exists corpus_topic_runs (
  id text primary key,
  embedding_index_id text not null references embedding_indexes(id) on delete cascade,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  algorithm text not null check (
    algorithm in ('bertopic_precomputed_embeddings', 'fixture', 'local_fallback')
  ),
  algorithm_version text,
  scope_json text not null,
  params_json text,
  article_count integer not null default 0,
  topic_count integer not null default 0,
  skipped_missing_embedding_count integer not null default 0,
  skipped_stale_embedding_count integer not null default 0,
  started_at integer,
  finished_at integer,
  error text,
  created_at integer not null,
  updated_at integer not null
);

create index if not exists idx_corpus_topic_runs_index_status
  on corpus_topic_runs(embedding_index_id, status, created_at);

create index if not exists idx_corpus_topic_runs_created_at
  on corpus_topic_runs(created_at);

create table if not exists corpus_topics (
  id text primary key,
  run_id text not null references corpus_topic_runs(id) on delete cascade,
  topic_key text not null,
  label text,
  top_terms_json text not null,
  representative_articles_json text not null,
  article_count integer not null default 0,
  centroid_vector_blob blob,
  confidence real not null default 0,
  created_at integer not null,
  updated_at integer not null,
  unique(run_id, topic_key)
);

create index if not exists idx_corpus_topics_run_id
  on corpus_topics(run_id);

create index if not exists idx_corpus_topics_article_count
  on corpus_topics(article_count);

create table if not exists corpus_topic_articles (
  run_id text not null references corpus_topic_runs(id) on delete cascade,
  topic_id text not null references corpus_topics(id) on delete cascade,
  article_id text not null references articles(id) on delete cascade,
  assignment_score real,
  is_representative integer not null default 0 check (is_representative in (0, 1)),
  created_at integer not null,
  primary key(run_id, article_id)
);

create index if not exists idx_corpus_topic_articles_topic_id
  on corpus_topic_articles(topic_id);

create index if not exists idx_corpus_topic_articles_article_id
  on corpus_topic_articles(article_id);

create table interest_cluster_labels_010 (
  cluster_id text primary key references interest_clusters(id) on delete cascade,
  auto_label text,
  manual_label text,
  label_source text not null default 'fallback' check (
    label_source in ('manual', 'keywords', 'representative_titles', 'feeds', 'corpus_topic', 'fallback')
  ),
  label_terms_json text,
  representative_articles_json text,
  feed_titles_json text,
  label_diagnostics_json text,
  confidence real not null default 0,
  generated_at integer,
  updated_at integer not null
);

insert into interest_cluster_labels_010 (
  cluster_id,
  auto_label,
  manual_label,
  label_source,
  label_terms_json,
  representative_articles_json,
  feed_titles_json,
  label_diagnostics_json,
  confidence,
  generated_at,
  updated_at
)
select
  cluster_id,
  auto_label,
  manual_label,
  label_source,
  label_terms_json,
  representative_articles_json,
  feed_titles_json,
  label_diagnostics_json,
  confidence,
  generated_at,
  updated_at
from interest_cluster_labels;

drop table interest_cluster_labels;
alter table interest_cluster_labels_010 rename to interest_cluster_labels;

create index if not exists idx_interest_cluster_labels_source
  on interest_cluster_labels(label_source, updated_at);

create table jobs_010 (
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
      'topic_snapshot_rebuild'
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

insert into jobs_010 (
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
alter table jobs_010 rename to jobs;

create index if not exists idx_jobs_status_run_after on jobs(status, run_after);
create index if not exists idx_jobs_type on jobs(type);
create index if not exists idx_jobs_created_at on jobs(created_at);
