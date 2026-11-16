-- Motorns grund, se docs/motorn.md.
--
-- Spelet ligger i schemat engine, som Data API inte visar. Mobilerna kan
-- därför inte läsa någon tabell direkt. Allt går genom serverfunktionen game,
-- som ansluter till databasen direkt. RLS är ändå påslaget utan regler, som
-- ett extra lås om schemat skulle exponeras av misstag.

create schema engine;
revoke all on schema engine from public, anon, authenticated;

create table engine.games (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique check (join_code ~ '^[A-Z]{4}$'),
  mission_id text not null,
  -- Spelets hela tillstånd. Motorn äger formen, så en ny uppgiftstyp kräver
  -- ingen ändring i databasen.
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table engine.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references engine.games (id) on delete cascade,
  -- Mobilens anonyma inloggning. Byts när en annan mobil tar över spelaren.
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  is_leader boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (game_id, user_id)
);
create index players_user_id_idx on engine.players (user_id);

create table engine.events (
  id bigint generated always as identity primary key,
  game_id uuid references engine.games (id) on delete cascade,
  player_id uuid references engine.players (id) on delete set null,
  action jsonb not null,
  -- Serverns tid när handlingen kom fram. Det är den som avgör samtidighet.
  received_at timestamptz not null default clock_timestamp()
);
create index events_game_id_idx on engine.events (game_id, id);

alter table engine.games enable row level security;
alter table engine.players enable row level security;
alter table engine.events enable row level security;
revoke all on all tables in schema engine from public, anon, authenticated;

-- Kanalernas regler -------------------------------------------------------
--
-- player:<spelar-id>  bara den spelaren lyssnar, bara servern skickar
-- game:<spel-id>      alla i spelet lyssnar och skickar
-- testsida:<rum>      alla inloggade, för testsidans synkade tryck
--
-- Funktionerna körs som ägaren (security definer), så att reglerna kan slå
-- upp spelarna utan att mobilerna får läsa tabellen.

create function engine.is_player_of_user(player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from engine.players
    where id = player_id and user_id = (select auth.uid())
  );
$$;

create function engine.is_member_of_game(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from engine.players
    where game_id = target_game_id and user_id = (select auth.uid())
  );
$$;

-- Ett id i en kanal som inte är ett giltigt uuid ska ge nej, inte ett fel.
create function engine.topic_id(topic text, prefix text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when topic ~ ('^' || prefix || ':[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    then substring(topic from char_length(prefix) + 2)::uuid
  end;
$$;

create function engine.can_listen(topic text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    engine.is_player_of_user(engine.topic_id(topic, 'player'))
    or engine.is_member_of_game(engine.topic_id(topic, 'game'))
    or topic ~ '^testsida:[0-9]{1,6}$',
    false
  );
$$;

create function engine.can_send(topic text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    engine.is_member_of_game(engine.topic_id(topic, 'game'))
    or topic ~ '^testsida:[0-9]{1,6}$',
    false
  );
$$;

grant usage on schema engine to authenticated;
revoke all on all functions in schema engine from public, anon;
grant execute on function
  engine.is_player_of_user(uuid),
  engine.is_member_of_game(uuid),
  engine.topic_id(text, text),
  engine.can_listen(text),
  engine.can_send(text)
to authenticated;

create policy "Inloggade lyssnar på sina egna kanaler"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and engine.can_listen((select realtime.topic()))
);

create policy "Inloggade skickar i sitt spels kanal"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and engine.can_send((select realtime.topic()))
);
