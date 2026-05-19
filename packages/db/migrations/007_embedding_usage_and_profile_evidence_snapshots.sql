create table embedding_usage_events (
  id text primary key,
  provider_id text not null references embedding_providers(id) on delete cascade,
  embedding_index_id text references embedding_indexes(id) on delete cascade,
  model text not null,
  source text not null check (source in ('job', 'test')),
  request_count integer not null default 1 check (request_count >= 0),
  item_count integer not null default 0 check (item_count >= 0),
  estimated_tokens integer not null default 0 check (estimated_tokens >= 0),
  created_at integer not null
);

create index idx_embedding_usage_events_index_created
  on embedding_usage_events(embedding_index_id, created_at);

create index idx_embedding_usage_events_provider_created
  on embedding_usage_events(provider_id, created_at);

alter table interest_cluster_evidence add column article_title_snapshot text;
alter table interest_cluster_evidence add column feed_id_snapshot text;
alter table interest_cluster_evidence add column feed_title_snapshot text;
alter table interest_cluster_evidence add column event_type_snapshot text;
alter table interest_cluster_evidence add column reading_progress_snapshot real;
alter table interest_cluster_evidence add column vector_blob_snapshot blob;

update interest_cluster_evidence
set
  article_title_snapshot = (
    select a.title
    from articles a
    where a.id = interest_cluster_evidence.article_id
  ),
  feed_id_snapshot = (
    select a.feed_id
    from articles a
    where a.id = interest_cluster_evidence.article_id
  ),
  feed_title_snapshot = (
    select f.title
    from articles a
    join feeds f on f.id = a.feed_id
    where a.id = interest_cluster_evidence.article_id
  ),
  event_type_snapshot = coalesce(
    (
      select be.event_type
      from behavior_events be
      where be.id = interest_cluster_evidence.behavior_event_id
    ),
    'read_complete'
  ),
  reading_progress_snapshot = coalesce(
    (
      select s.reading_progress
      from article_states s
      where s.article_id = interest_cluster_evidence.article_id
    ),
    0
  ),
  vector_blob_snapshot = (
    select ae.vector_blob
    from article_embeddings ae
    join interest_clusters ic on ic.id = interest_cluster_evidence.cluster_id
    where ae.article_id = interest_cluster_evidence.article_id
      and ae.embedding_index_id = ic.embedding_index_id
  )
where article_title_snapshot is null;
