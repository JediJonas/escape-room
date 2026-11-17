-- Kanalernas regler och att tabellerna är stängda för mobilerna. Körs efter
-- supabase-stubs.sql och migreringarna. Ett fel avbryter körningen.

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),  -- Anna, i spel 1
  ('00000000-0000-0000-0000-00000000000b'),  -- Bo, i spel 1
  ('00000000-0000-0000-0000-00000000000c');  -- Cia, i spel 2

insert into engine.games (id, join_code, mission_id, state) values
  ('10000000-0000-0000-0000-000000000001', 'ABCD', 'prov', '{}'),
  ('10000000-0000-0000-0000-000000000002', 'EFGH', 'prov', '{}');

insert into engine.players (id, game_id, user_id, name) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Anna'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Bo'),
  ('20000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'Cia');

-- Frågar som en mobil: inloggad som användaren, på väg in i kanalen.
create function pg_temp.can(user_suffix text, target_topic text, operation text) returns boolean
language plpgsql as $$
declare
  is_allowed boolean;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || user_suffix, true);
  perform set_config('realtime.topic', target_topic, true);
  set local role authenticated;
  if operation = 'listen' then
    select count(*) > 0 into is_allowed from (
      select 1 from realtime.messages where topic = realtime.topic() and extension = 'broadcast'
    ) visible;
  else
    begin
      insert into realtime.messages (topic, extension) values (target_topic, 'broadcast');
      is_allowed := true;
    exception when insufficient_privilege then
      is_allowed := false;
    end;
  end if;
  reset role;
  return is_allowed;
end;
$$;

-- Ett meddelande i varje kanal, så att det finns något att se.
insert into realtime.messages (topic, extension) values
  ('player:20000000-0000-0000-0000-00000000000a', 'broadcast'),
  ('player:20000000-0000-0000-0000-00000000000b', 'broadcast'),
  ('game:10000000-0000-0000-0000-000000000001', 'broadcast'),
  ('game:10000000-0000-0000-0000-000000000002', 'broadcast'),
  ('group:10000000-0000-0000-0000-000000000001', 'broadcast'),
  ('group:10000000-0000-0000-0000-000000000002', 'broadcast'),
  ('testsida:1234', 'broadcast'),
  ('player:inte-ett-id', 'broadcast');

create function pg_temp.expect(description text, actual boolean, expected boolean) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FEL: % (fick %, väntade %)', description, actual, expected;
  end if;
  raise notice 'ok: %', description;
end;
$$;

begin;
select pg_temp.expect('Anna lyssnar på sin egen kanal',
  pg_temp.can('a', 'player:20000000-0000-0000-0000-00000000000a', 'listen'), true);
select pg_temp.expect('Anna lyssnar inte på Bos kanal',
  pg_temp.can('a', 'player:20000000-0000-0000-0000-00000000000b', 'listen'), false);
select pg_temp.expect('Anna lyssnar på sitt spels kanal',
  pg_temp.can('a', 'game:10000000-0000-0000-0000-000000000001', 'listen'), true);
select pg_temp.expect('Anna lyssnar inte på ett annat spels kanal',
  pg_temp.can('a', 'game:10000000-0000-0000-0000-000000000002', 'listen'), false);
select pg_temp.expect('Anna lyssnar på sitt spels gruppkanal',
  pg_temp.can('a', 'group:10000000-0000-0000-0000-000000000001', 'listen'), true);
select pg_temp.expect('Anna lyssnar inte på ett annat spels gruppkanal',
  pg_temp.can('a', 'group:10000000-0000-0000-0000-000000000002', 'listen'), false);
select pg_temp.expect('Anna lyssnar på testsidans kanal',
  pg_temp.can('a', 'testsida:1234', 'listen'), true);
select pg_temp.expect('Ett trasigt id ger nej och inget fel',
  pg_temp.can('a', 'player:inte-ett-id', 'listen'), false);
rollback;

begin;
select pg_temp.expect('Anna skickar i sitt spels kanal',
  pg_temp.can('a', 'game:10000000-0000-0000-0000-000000000001', 'send'), true);
select pg_temp.expect('Anna skickar inte i ett annat spels kanal',
  pg_temp.can('a', 'game:10000000-0000-0000-0000-000000000002', 'send'), false);
select pg_temp.expect('Anna skickar inte i sin egen spelarkanal, bara servern gör det',
  pg_temp.can('a', 'player:20000000-0000-0000-0000-00000000000a', 'send'), false);
select pg_temp.expect('Anna skickar inte i sitt spels gruppkanal, bara servern gör det',
  pg_temp.can('a', 'group:10000000-0000-0000-0000-000000000001', 'send'), false);
select pg_temp.expect('Anna skickar i testsidans kanal',
  pg_temp.can('a', 'testsida:1234', 'send'), true);
rollback;

-- En mobil kan inte läsa spelets tabeller, varken inloggad eller inte.
create function pg_temp.can_read_table(role_name text, table_name text) returns boolean
language plpgsql as $$
begin
  execute format('set local role %I', role_name);
  execute format('select count(*) from engine.%I', table_name);
  reset role;
  return true;
exception when insufficient_privilege then
  reset role;
  return false;
end;
$$;

begin;
select pg_temp.expect('Inloggad läser inte games', pg_temp.can_read_table('authenticated', 'games'), false);
select pg_temp.expect('Inloggad läser inte players', pg_temp.can_read_table('authenticated', 'players'), false);
select pg_temp.expect('Inloggad läser inte events', pg_temp.can_read_table('authenticated', 'events'), false);
select pg_temp.expect('Utloggad läser inte games', pg_temp.can_read_table('anon', 'games'), false);
rollback;
