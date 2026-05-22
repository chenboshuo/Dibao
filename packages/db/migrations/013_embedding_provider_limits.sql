alter table embedding_providers
  add column text_max_chars integer not null default 8000 check (text_max_chars >= 1000 and text_max_chars <= 200000);

alter table embedding_providers
  add column requests_per_minute integer check (requests_per_minute is null or requests_per_minute > 0);

alter table embedding_providers
  add column requests_per_day integer check (requests_per_day is null or requests_per_day > 0);

alter table embedding_indexes
  add column text_max_chars integer not null default 8000 check (text_max_chars >= 1000 and text_max_chars <= 200000);
