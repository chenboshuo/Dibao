create table if not exists plugin_secrets (
  plugin_id text not null references plugin_installs(id) on delete cascade,
  key text not null,
  ciphertext text not null,
  hint text,
  created_at integer not null,
  updated_at integer not null,
  primary key (plugin_id, key)
);

create table if not exists plugin_deliveries (
  id text primary key,
  plugin_id text not null references plugin_installs(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  method text not null check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  url text not null,
  request_json text not null,
  response_json text,
  error text,
  idempotency_key text,
  job_id text references jobs(id) on delete set null,
  created_at integer not null,
  updated_at integer not null,
  finished_at integer
);

create unique index if not exists idx_plugin_deliveries_idempotency
  on plugin_deliveries(plugin_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_plugin_deliveries_plugin_status
  on plugin_deliveries(plugin_id, status, updated_at);

create table if not exists plugin_delivery_attempts (
  id text primary key,
  delivery_id text not null references plugin_deliveries(id) on delete cascade,
  attempt integer not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  status_code integer,
  duration_ms integer,
  request_json text not null,
  response_json text,
  error text,
  created_at integer not null
);

create index if not exists idx_plugin_delivery_attempts_delivery
  on plugin_delivery_attempts(delivery_id, attempt);
