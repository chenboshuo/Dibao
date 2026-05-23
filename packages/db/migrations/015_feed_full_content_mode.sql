alter table feeds
  add column full_content_mode text not null default 'feed_only'
  check (full_content_mode in ('feed_only', 'fetch_full_content'));
