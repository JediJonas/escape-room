# Escape room för mobiler

Ett partyspel i escape room-stil. Tre till tio personer i samma hem löser ett
uppdrag på cirka 60 minuter, var och en med sin mobil.

Konceptet finns i `docs/koncept.md`. Provet av rundbilder beskrivs i
`docs/rundbilder-prov.md`.

## Mappar

Webbsidan byggs med React och Vite, med samma upplägg som Maffia.

| Mapp | Innehåll |
| --- | --- |
| `docs/` | Konceptet och andra anteckningar |
| `index.html` | Startsidan |
| `testsida/` | Sidorna för den tekniska testsidan och testkorten |
| `src/start/` | Startsidan i React |
| `src/testsida/` | Koden till den tekniska testsidan (byggordning steg 1) |
| `src/device/` | En modul per mobilfunktion: rörelse och kamera |
| `src/sound/` | Ljud: ljudmotorn, vanligt ljud som reserv och toning |
| `src/sync/` | Kanalen mellan mobilerna och vilka som håller fingret på skärmen |
| `src/view/` | Visaren för rundbilder, med bred bild som reserv |
| `public/` | Bilder som läggs ut som de är, som rundbilderna och testkorten |
| `supabase/migrations/` | Databasens schema och kanalernas regler |
| `supabase/functions/game/` | Spelets serverfunktion |
| `supabase/tests/` | Prov av kanalernas regler i en vanlig Postgres |

Testerna ligger bredvid det de testar, som `src/sync/sync.test.ts`.

## Den tekniska testsidan

Testsidan provar rörelse och lutning, QR-skanning, ljud, synkade tryck och
rundbilder var för sig, på iPhone Safari och Android Chrome. Den ligger på
`https://jedijonas.github.io/escape-room/testsida/`.

- Lägg till `?debug=1` i adressen för att se felsökningsloggen.
- Testkorten med QR-koder finns på `testsida/platskort.html`.
- Synkade tryck går genom Supabase Realtime. Adressen och den publika nyckeln
  står i `src/config.ts`.

## Köra lokalt

Kräver Node 22.

```sh
npm install
npm run dev      # webbsidan på https://localhost:5173, även för mobiler i samma nät
npm run check    # lint, typkontroll, tester och bygge
npm run test:db  # kanalernas regler, kräver en Postgres (PGHOST med flera)
```

`npm run dev` använder ett eget certifikat, så att kamera och rörelsesensor
fungerar från en mobil i samma nät. Mobilen varnar för certifikatet första
gången.

GitHub Actions kör samma kontroller på varje PR, validerar HTML:en och provar
kanalernas regler i Postgres. När något hamnar i `main` byggs sidan och läggs
ut på GitHub Pages, och ändringar under `supabase/` läggs ut i Supabase.

## Supabase

Projektets adress och publika nyckel står i `src/config.ts`. Databasens
schema och serverfunktionen läggs ut av `.github/workflows/supabase.yml`, som
behöver hemligheterna `SUPABASE_ACCESS_TOKEN` och `SUPABASE_DB_PASSWORD` i
GitHub. Anonym inloggning ska vara påslagen i projektet.

### Token för utläggningen

`SUPABASE_ACCESS_TOKEN` är en token från Supabase (Account → Access Tokens).
Den används bara när GitHub lägger ut databasen och serverfunktionen. Går den
ut fortsätter spelet att fungera, men nästa utläggning misslyckas.

- **Namn:** escape-room GitHub Actions
- **Går ut:** Never
- **Gäller:** bara projektet escape-room
- **Behörigheter:**

| Behörighet | Nivå | Varför |
| --- | --- | --- |
| Project Settings | Read | CLI:t läser projektets inställningar |
| API Keys | Read | CLI:t läser projektets nycklar |
| API Key Secrets | Read | Samma |
| Connection Pooling | Read | GitHub når bara databasen över IPv4, via anslutningspoolen. Ligger under Database |
| Database | Read | Behövs inte enligt Supabase, men är bara läsning |
| Edge Functions | Read-write | Lägger ut serverfunktionen |

Migreringarna körs med databasens lösenord, `SUPABASE_DB_PASSWORD`, så
token behöver inte kunna skriva i databasen. Byt token genom att göra en ny
med samma inställningar, ersätta hemligheten i GitHub (Settings → Secrets and
variables → Actions) och ta bort den gamla i Supabase.

Serverfunktionen körs i Deno. GitHub Actions provar dess typer med
`deno check index.ts` i `supabase/functions/game/`. Där ligger också
`deno.json`, som säger åt Deno att hämta biblioteken själv i stället för ur
repots `node_modules`.
