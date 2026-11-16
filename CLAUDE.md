# CLAUDE.md

Svara på svenska. Alla ändringar görs som PR mot main som Jonas godkänner.
Pusha aldrig direkt till main och merga aldrig själv.

## Underlag

- Konceptet står i `docs/koncept.md`. Läs det innan du föreslår eller bygger
  något. Om koden och dokumentet säger olika saker, fråga Jonas vilket som
  gäller och uppdatera dokumentet när ett beslut ändras.
- Motorns design står i `docs/motorn.md`.

## Arbetssätt

- Jobba på en egen gren och öppna en PR mot main. Det som hamnar i main
  publiceras direkt på jedijonas.github.io/escape-room.
- Kör `npm run check` (lint, typkontroll, tester och bygge) innan du pushar.
  GitHub Actions kör samma sak och validerar dessutom HTML:en.
- Höj `VERSION` i `src/config.ts` vid varje ändring av webbsidan, så att det
  syns om en mobil kör en gammal sida ur cachen.
- Följ byggordningen i konceptet. Bygg en uppgiftstyp i taget och gör den
  provspelbar innan nästa påbörjas.
- Lägg inte till bibliotek förrän en uppgift kräver dem. Säg till när något i
  konceptet inte fungerar i praktiken, i stället för att bygga runt det.
- Commit-meddelanden och kodkommentarer skrivs på svenska. Namn i koden är på
  engelska. Beslut som Jonas har tagit märks med datum, till exempel
  `(Jonas 2026-11-16)`.

## Arkitektur

Se README.md för mapparna. Det viktigaste:

- **React och Vite, som i Maffia** (Jonas 2026-11-16). Startsidan är React.
  Testsidan använder inte React och skrivs inte om.
- **TypeScript** (Jonas 2026-11-16), med `strict` på. Typerna står i koden,
  inte i JSDoc. TypeScript ligger kvar på version 6 tills typescript-eslint
  stöder version 7.
- **Logik skild från visning.** Regler och beräkningar är rena funktioner utan
  DOM, nät eller klocka, och testas med Vitest. Testerna ligger bredvid det de
  testar.
- **En modul per mobilfunktion** i `src/device/`, `src/sound/` och
  `src/view/`. Modulen kontrollerar om funktionen finns, ber om tillstånd och
  har en reserv.
- **Servern äger sanningen.** Spelstatus, roller och facit ligger i Supabase.
  En mobil får bara det dess spelare ska se. Se `docs/motorn.md`.
- **Supabase ligger i `supabase/`.** Tabellerna ligger i schemat `engine`,
  som Data API inte visar. Kanalernas regler står i migreringen och provas
  med `npm run test:db`. Ändras reglerna ska testet i
  `supabase/tests/channels.test.sql` ändras i samma PR.
- **Serverfunktionen `game`** har sin logik i rena moduler som testas med
  Vitest. `index.ts` är bara skalet som kopplar ihop dem med Deno och
  databasen.
- **Bibliotek som bara vissa behöver laddas med `import()`**, som jsQR och
  Supabase, så att de bara hämtas när de används.

## Rundbilder och Gemini

- Rundbilder tas fram med Geminis API och modellen Nano Banana. Provet står i
  `docs/rundbilder-prov.md`. Slå upp aktuella modeller och anrop i skillen
  `gemini-api-dev` (`.claude/skills/`) innan något ändras.
