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
- Höj `VERSION` i `src/config.js` vid varje ändring av webbsidan, så att det
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
  Testsidan är vanlig JavaScript och skrivs inte om.
- **Logik skild från visning.** Regler och beräkningar är rena funktioner utan
  DOM, nät eller klocka, och testas med Vitest. Testerna ligger bredvid det de
  testar.
- **En modul per mobilfunktion** i `src/device/`, `src/sound/` och
  `src/view/`. Modulen kontrollerar om funktionen finns, ber om tillstånd och
  har en reserv.
- **Servern äger sanningen.** Spelstatus, roller och facit ligger i Supabase.
  En mobil får bara det dess spelare ska se. Se `docs/motorn.md`.
- **Bibliotek som bara vissa behöver laddas med `import()`**, som jsQR och
  Supabase, så att de bara hämtas när de används.

## Rundbilder och Gemini

- Rundbilder tas fram med Geminis API och modellen Nano Banana. Provet står i
  `docs/rundbilder-prov.md`. Slå upp aktuella modeller och anrop i skillen
  `gemini-api-dev` (`.claude/skills/`) innan något ändras.
