alter table article_states add column last_action_at integer;
alter table article_states add column last_ignored_at integer;

update article_states
set last_action_at = (
  select max(be.created_at)
  from behavior_events be
  where be.article_id = article_states.article_id
);

update article_states
set last_ignored_at = (
  select max(be.created_at)
  from behavior_events be
  where be.article_id = article_states.article_id
    and be.event_type = 'impression'
    and be.event_weight < 0
);

create index if not exists idx_article_states_last_action_at
  on article_states(last_action_at);

create index if not exists idx_article_states_last_ignored_at
  on article_states(last_ignored_at);
