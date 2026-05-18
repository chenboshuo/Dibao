alter table rank_model_weights add column z real not null default 0;
alter table rank_model_weights add column n real not null default 0;

alter table feed_stats add column clear_positive integer not null default 0;
alter table feed_stats add column clear_negative integer not null default 0;
alter table feed_stats add column clear_signal_count integer not null default 0;
alter table feed_stats add column smoothed_positive_rate real not null default 0;
alter table feed_stats add column source_confidence real not null default 0;

create index if not exists idx_profile_terms_polarity_scope_weight
  on profile_terms(polarity, scope, weight);

create index if not exists idx_interest_cluster_evidence_source_created
  on interest_cluster_evidence(evidence_source, created_at);

create index if not exists idx_article_fingerprints_title_simhash
  on article_fingerprints(title_simhash);

create index if not exists idx_article_fingerprints_summary_simhash
  on article_fingerprints(summary_simhash);

create index if not exists idx_article_fingerprints_normalized_title
  on article_fingerprints(normalized_title);

create index if not exists idx_duplicate_group_members_article_reason
  on duplicate_group_members(article_id, reason);

create index if not exists idx_rank_training_examples_event_created_from
  on rank_training_examples(behavior_event_id, created_from);

create index if not exists idx_ranking_eval_runs_created_status
  on ranking_eval_runs(created_at, status);

create index if not exists idx_ranking_eval_items_cutoff
  on ranking_eval_items(cutoff_at);
