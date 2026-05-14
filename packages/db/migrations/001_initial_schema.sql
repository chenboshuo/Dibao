create table if not exists schema_migrations (
  version text primary key,
  name text not null,
  applied_at integer not null,
  checksum text
);

create table if not exists app_settings (
  key text primary key,
  value_json text not null,
  updated_at integer not null
);

create table if not exists auth_credentials (
  id text primary key,
  password_hash text not null,
  password_algo text not null,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists sessions (
  id text primary key,
  session_hash text not null unique,
  created_at integer not null,
  expires_at integer not null,
  last_seen_at integer,
  user_agent text,
  ip_hash text
);

create table if not exists feed_folders (
  id text primary key,
  title text not null,
  sort_order integer not null default 0,
  created_at integer not null,
  updated_at integer not null,
  deleted_at integer
);

create index if not exists idx_feed_folders_sort_order
  on feed_folders(sort_order);

create table if not exists feeds (
  id text primary key,
  folder_id text references feed_folders(id) on delete set null,
  title text not null,
  site_url text,
  feed_url text not null unique,
  description text,
  enabled integer not null default 1 check (enabled in (0, 1)),
  etag text,
  last_modified text,
  last_fetched_at integer,
  last_success_at integer,
  last_error text,
  fetch_interval_minutes integer not null default 60,
  source_weight real not null default 0,
  created_at integer not null,
  updated_at integer not null,
  deleted_at integer
);

create index if not exists idx_feeds_folder_id on feeds(folder_id);
create index if not exists idx_feeds_enabled on feeds(enabled);
create index if not exists idx_feeds_last_fetched_at on feeds(last_fetched_at);
create index if not exists idx_feeds_deleted_at on feeds(deleted_at);

create table if not exists articles (
  id text primary key,
  feed_id text not null references feeds(id) on delete cascade,
  guid text,
  url text not null,
  canonical_url text,
  title text not null,
  author text,
  summary text,
  published_at integer,
  discovered_at integer not null,
  content_hash text,
  dedupe_key text not null,
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  created_at integer not null,
  updated_at integer not null,
  deleted_at integer
);

create index if not exists idx_articles_feed_id on articles(feed_id);
create index if not exists idx_articles_published_at on articles(published_at);
create index if not exists idx_articles_discovered_at on articles(discovered_at);
create index if not exists idx_articles_status on articles(status);
create index if not exists idx_articles_deleted_at on articles(deleted_at);
create index if not exists idx_articles_dedupe_key on articles(dedupe_key);
create unique index if not exists unique_articles_feed_guid
  on articles(feed_id, guid)
  where guid is not null;
create unique index if not exists unique_articles_feed_url
  on articles(feed_id, canonical_url)
  where canonical_url is not null;

create table if not exists article_contents (
  article_id text primary key references articles(id) on delete cascade,
  content_html text,
  content_text text,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'feed_only', 'success', 'failed', 'skipped')),
  extraction_error text,
  extracted_at integer,
  updated_at integer not null
);

create table if not exists article_states (
  article_id text primary key references articles(id) on delete cascade,
  read_at integer,
  favorited_at integer,
  read_later_at integer,
  hidden_at integer,
  not_interested_at integer,
  reading_progress real not null default 0 check (reading_progress >= 0 and reading_progress <= 1),
  last_opened_at integer,
  updated_at integer not null
);

create index if not exists idx_article_states_read_at on article_states(read_at);
create index if not exists idx_article_states_favorited_at on article_states(favorited_at);
create index if not exists idx_article_states_read_later_at on article_states(read_later_at);
create index if not exists idx_article_states_hidden_at on article_states(hidden_at);
create index if not exists idx_article_states_not_interested_at on article_states(not_interested_at);

create table if not exists behavior_events (
  id text primary key,
  article_id text not null references articles(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'impression',
      'open',
      'read_progress',
      'read_complete',
      'favorite',
      'unfavorite',
      'read_later',
      'remove_read_later',
      'hide',
      'not_interested',
      'mark_read',
      'mark_unread',
      'quick_bounce'
    )
  ),
  event_weight real not null,
  metadata_json text,
  created_at integer not null
);

create index if not exists idx_behavior_events_article_id on behavior_events(article_id);
create index if not exists idx_behavior_events_event_type on behavior_events(event_type);
create index if not exists idx_behavior_events_created_at on behavior_events(created_at);

create table if not exists article_behavior_summaries (
  article_id text primary key,
  feed_id text,
  positive_score real not null default 0,
  negative_score real not null default 0,
  opened_count integer not null default 0,
  read_complete_count integer not null default 0,
  favorite_count integer not null default 0,
  not_interested_count integer not null default 0,
  first_event_at integer,
  last_event_at integer,
  topic_snapshot_json text
);

create table if not exists embedding_providers (
  id text primary key,
  type text not null check (type in ('embedded_local', 'ollama', 'openai_compatible', 'custom_http')),
  name text not null,
  base_url text,
  model text not null,
  dimension integer not null check (dimension > 0),
  api_key_encrypted text,
  enabled integer not null default 0 check (enabled in (0, 1)),
  quality_tier text not null default 'basic' check (quality_tier in ('basic', 'recommended', 'best_quality')),
  last_test_status text,
  last_test_error text,
  last_test_at integer,
  created_at integer not null,
  updated_at integer not null
);

create index if not exists idx_embedding_providers_enabled on embedding_providers(enabled);
create index if not exists idx_embedding_providers_type on embedding_providers(type);
create unique index if not exists unique_embedding_providers_active
  on embedding_providers(enabled)
  where enabled = 1;

create table if not exists embedding_indexes (
  id text primary key,
  provider_id text not null references embedding_providers(id) on delete restrict,
  model text not null,
  dimension integer not null check (dimension > 0),
  distance_metric text not null default 'cosine' check (distance_metric in ('cosine')),
  table_name text not null unique,
  status text not null default 'active'
    check (status in ('active', 'building', 'disabled', 'failed', 'retired')),
  created_at integer not null,
  updated_at integer not null
);

create index if not exists idx_embedding_indexes_provider_id on embedding_indexes(provider_id);
create index if not exists idx_embedding_indexes_status on embedding_indexes(status);

create table if not exists article_embeddings (
  article_id text not null references articles(id) on delete cascade,
  embedding_index_id text not null references embedding_indexes(id) on delete cascade,
  vector_blob blob not null,
  content_hash text not null,
  created_at integer not null,
  updated_at integer not null,
  primary key (article_id, embedding_index_id)
);

create index if not exists idx_article_embeddings_index_id
  on article_embeddings(embedding_index_id);
create index if not exists idx_article_embeddings_content_hash
  on article_embeddings(content_hash);

create table if not exists article_vector_rows (
  article_id text not null references articles(id) on delete cascade,
  embedding_index_id text not null references embedding_indexes(id) on delete cascade,
  vec_rowid integer not null,
  created_at integer not null,
  primary key (article_id, embedding_index_id),
  unique (embedding_index_id, vec_rowid)
);

create table if not exists interest_clusters (
  id text primary key,
  embedding_index_id text not null references embedding_indexes(id) on delete cascade,
  polarity text not null check (polarity in ('positive', 'negative')),
  label text,
  centroid_vector_blob blob not null,
  weight real not null default 0,
  sample_count integer not null default 0,
  last_matched_at integer,
  created_at integer not null,
  updated_at integer not null
);

create index if not exists idx_interest_clusters_index_polarity
  on interest_clusters(embedding_index_id, polarity);
create index if not exists idx_interest_clusters_weight on interest_clusters(weight);
create index if not exists idx_interest_clusters_last_matched_at
  on interest_clusters(last_matched_at);

create table if not exists feed_stats (
  feed_id text primary key references feeds(id) on delete cascade,
  positive_score real not null default 0,
  negative_score real not null default 0,
  open_rate real not null default 0,
  favorite_rate real not null default 0,
  not_interested_rate real not null default 0,
  last_calculated_at integer
);

create table if not exists article_rank_scores (
  article_id text not null references articles(id) on delete cascade,
  rank_context text not null,
  embedding_index_id text references embedding_indexes(id) on delete set null,
  score real not null,
  interest_score real not null default 0,
  source_score real not null default 0,
  freshness_score real not null default 0,
  state_score real not null default 0,
  diversity_score real not null default 0,
  penalty_score real not null default 0,
  calculated_at integer not null,
  primary key (article_id, rank_context)
);

create index if not exists idx_article_rank_scores_context_score
  on article_rank_scores(rank_context, score);
create index if not exists idx_article_rank_scores_score
  on article_rank_scores(score);
create index if not exists idx_article_rank_scores_calculated_at
  on article_rank_scores(calculated_at);

create table if not exists article_rank_explanations (
  article_id text not null references articles(id) on delete cascade,
  rank_context text not null,
  embedding_index_id text references embedding_indexes(id) on delete set null,
  payload_json text not null,
  created_at integer not null,
  primary key (article_id, rank_context)
);

create virtual table if not exists article_fts using fts5(
  article_id unindexed,
  title,
  summary,
  content_text
);

create table if not exists jobs (
  id text primary key,
  type text not null check (
    type in (
      'feed_refresh',
      'content_extract',
      'embedding_generate',
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

create index if not exists idx_jobs_status_run_after on jobs(status, run_after);
create index if not exists idx_jobs_type on jobs(type);
create index if not exists idx_jobs_created_at on jobs(created_at);
