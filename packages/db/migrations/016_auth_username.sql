alter table auth_credentials
  add column username text;

create unique index if not exists unique_auth_credentials_username
  on auth_credentials(username);
