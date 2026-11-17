-- Gruppens kanal ------------------------------------------------------------
--
-- group:<spel-id>  alla i spelet lyssnar, bara servern skickar
--
-- Servern skickar det som är lika för alla och ändras ofta, som seansens
-- läge, en gång här i stället för som en vy till varje spelare. Det håller
-- nere antalet meddelanden i realtid (Jonas 2026-11-17). Mobilerna skickar
-- inte här, så att ingen kan låtsas vara servern. Därför ändras bara
-- can_listen.

create or replace function engine.can_listen(topic text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    engine.is_player_of_user(engine.topic_id(topic, 'player'))
    or engine.is_member_of_game(engine.topic_id(topic, 'game'))
    or engine.is_member_of_game(engine.topic_id(topic, 'group'))
    or topic ~ '^testsida:[0-9]{1,6}$',
    false
  );
$$;
