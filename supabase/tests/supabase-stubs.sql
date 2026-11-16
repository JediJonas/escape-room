-- Det minsta av Supabase som migreringarna behöver, för att kunna provas i en
-- vanlig Postgres i GitHub Actions. Efterliknar auth.uid(), realtime.topic()
-- och tabellen realtime.messages så som Supabase beskriver dem. Används bara i
-- testerna, aldrig i Supabase.

-- Rollerna gäller hela servern och kan finnas kvar från en tidigare körning.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;

create schema realtime;
create table realtime.messages (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  extension text not null,
  payload jsonb,
  event text,
  private boolean default true,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '');
$$;
grant usage on schema realtime to anon, authenticated;
grant select, insert on realtime.messages to anon, authenticated;
