alter table article_states
  add column liked_at integer;

create index if not exists idx_article_states_liked_at
  on article_states(liked_at);

create table behavior_events_002 (
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
      'like',
      'unlike',
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

insert into behavior_events_002 (
  id,
  article_id,
  event_type,
  event_weight,
  metadata_json,
  created_at
)
select
  id,
  article_id,
  event_type,
  event_weight,
  metadata_json,
  created_at
from behavior_events;

drop table behavior_events;
alter table behavior_events_002 rename to behavior_events;

create index if not exists idx_behavior_events_article_id on behavior_events(article_id);
create index if not exists idx_behavior_events_event_type on behavior_events(event_type);
create index if not exists idx_behavior_events_created_at on behavior_events(created_at);
