# Motorns grund: designförslag

Förslag till byggordningens steg 2, att godkänna innan något byggs. Det tar upp
det som är dyrt att ändra i efterhand: vem en mobil är, var spelets tillstånd
ligger, hur behörigheten fungerar, hur servern avgör samtidighet och hur en
uppdragsfil ser ut.

Det här är andra versionen. Vad som ändrades sedan den första står sist.

## Sammanfattning

- Varje mobil loggar in anonymt i Supabase. Inloggningen sparas i webbläsaren,
  så rollen ligger kvar när sidan laddas om.
- Spelet ligger i tre tabeller i ett schema som Data API inte visar. En mobil
  kan inte läsa någon tabell direkt, så facit skyddas utan att det hänger på
  att en RLS-regel är rätt skriven.
- Allt en mobil gör går genom en enda serverfunktion, `game`. Den låser spelet,
  räknar fram det nya tillståndet med en ren funktion och skickar varje spelare
  sin egen vy.
- Varje spelare har en privat realtidskanal för sin vy. RLS på kanalerna gör
  att en mobil bara kan lyssna på sin egen kanal och sitt eget spels kanal.
- Servern har ingen klocka som tickar. Förlopp som styrs av tiden bestäms i
  förväg som ett schema, och tillståndet räknas fram till nu vid varje anrop.
- Ett uppdrag är en JSON-fil i repot som bara serverfunktionen läser.

Namn på tabeller, fält och nycklar är på engelska, som i koden som redan finns.
Alla texter som spelarna ser är på svenska och ligger i uppdragsfilen.

## Vem en mobil är

Supabase har anonym inloggning. Mobilen får ett eget användar-id utan e-post
eller lösenord, och id:t sparas i webbläsaren. Laddar spelaren om sidan är hon
samma spelare med samma roll.

- **Ta över en spelare.** Om en mobil försvinner helt, till exempel när
  batteriet tar slut, kan spelledaren låta en annan mobil ta över spelarens
  plats. Rollen följer spelarplatsen, inte mobilen.
- **Ta över spelledningen.** Om spelledarens mobil har varit tyst i två
  minuter kan en annan spelare ta över spelledningen. Annars står spelet utan
  paus och ledtrådar om just den mobilen dör.
- **Ansluta sent.** Före start räcker koden. Efter start måste spelledaren
  släppa in den som ansluter, så att ingen utomstående som gissar en kod hamnar
  i spelet.

## Tabeller

Tre tabeller i schemat `engine`, som inte exponeras i Data API. RLS är påslaget
utan regler, som ett extra lås om schemat skulle exponeras av misstag.

| Tabell | Innehåll |
| --- | --- |
| `games` | Kod att ansluta med, uppdrag och spelets hela tillstånd som ett JSON-värde. Speltid, platskort och om spelledaren spelar ligger i tillståndet |
| `players` | Spel, användar-id, namn, om hon är spelledare och när mobilen senast hördes av. Behövs som egen tabell för att kanalernas regler ska kunna slå upp vem som hör till vilket spel |
| `events` | En logg över varje handling med serverns tid. Används för felsökning och mätning |

Tillståndet är ett enda JSON-värde: status, aktuell uppgift, roller, platser,
vem som har haft en framträdande roll, givna ledtrådar och uppgiftens eget
läge. Motorn äger formen på det. En ny uppgiftstyp kräver därmed ingen ändring
i databasen, och det finns inga tabeller som kan hamna i otakt med varandra.

Vad en spelare ser sparas inte. Det räknas fram ur tillståndet och
uppdragsfilen varje gång, av en ren funktion.

## Serverfunktionen

En Edge Function i Supabase, skriven i TypeScript, tar emot allt: skapa spel,
ansluta, välja plats, spelledarens kommandon och spelarnas handlingar. Varje
anrop gör samma sak:

1. Kontrollerar vem som frågar, med mobilens inloggning.
2. Öppnar en transaktion och låser spelets rad.
3. Räknar fram det nya tillståndet med en ren funktion: tillstånd, handling
   och serverns tid in, nytt tillstånd ut.
4. Sparar tillståndet och handlingen och skickar de vyer som har ändrats.
   Allt detta sker i samma transaktion, så en vy skickas aldrig utan att
   tillståndet är sparat.

**Två handlingar samtidigt.** Låset gör att handlingarna i ett spel behandlas
en i taget, i den ordning de kom fram. Tio fingrar som trycker i samma
ögonblick ställs i kö i några hundradelar. Ingen handling kan gå förlorad eller
skriva över en annan.

**Ett bibliotek.** Låset kräver en riktig databasanslutning från
serverfunktionen, och därmed en Postgres-drivrutin. Det är det enda biblioteket
på serversidan. Supabase beskriver sättet i sin dokumentation.

**Logiken är rena funktioner.** Motorn och uppgiftstyperna känner inte till
Supabase. De tar emot ett tillstånd och en handling och lämnar ett nytt
tillstånd, precis som `holdRoom.ts` i testsidan. De testas med `npm test` utan
nät och databas. Supabase ligger i ett tunt skal runt dem, vilket också gör det
möjligt att byta tjänst senare.

## Tid

**Servern tickar inte.** En serverfunktion körs bara när någon anropar den.
Förlopp som styrs av tiden, som bokstäverna i Seansen eller något som kommer
närmare i Källaren, bestäms därför i förväg: servern räknar ut ett schema och
ger varje mobil sin del av det. Mobilerna visar rätt sak vid rätt tid med hjälp
av serverns klocka.

**Tillståndet räknas fram till nu.** Varje anrop börjar med att föra
tillståndet fram till serverns aktuella tid. Har en tidsgräns passerat sedan
förra anropet tar motorn hand om det då. En mobil som vet att en tidsgräns har
gått ut säger till servern, så att inget blir liggande.

**Livstecken.** Varje mobil hör av sig till servern var tionde sekund under
spelet. Det enda anropet gör fyra saker:

- Servern vet vilka som är med, så att en spelare som har försvunnit inte får
  en roll.
- Mobilen får veta om den har missat en vy och hämtar den då.
- Mobilen mäter skillnaden mellan sin klocka och serverns, för nedräkningen
  och schemana.
- Serverfunktionen hålls vaken, så att den inte är långsam när det gäller.

**Samtidighet.** När en spelare trycker eller släpper noterar servern sin egen
tid, och det är den som avgör. Mobilen skickar också med sin egen uppskattning
av serverns tid. Den används inte, men den sparas i loggen. Visar första
provspelet att nätet gör serverns mätning för ryckig finns underlaget för att
byta, utan att mobilerna behöver ändras.

**Nedräkningen.** Servern sparar starttiden och hur länge spelet har varit
pausat. Mobilen räknar ner själv med sin uppmätta skillnad mot serverns klocka.

## Realtid och behörighet

Supabase Realtime har privata kanaler, där RLS-regler avgör vem som får lyssna
och skicka. Publika kanaler stängs av i projektets inställningar.

| Kanal | Vem får lyssna | Vem får skicka | Används till |
| --- | --- | --- | --- |
| `player:<id>` | Bara den spelaren | Bara servern | Spelarens vy. Spelledarens administrationsvy kommer samma väg |
| `game:<id>` | Alla spelare i spelet | Alla spelare i spelet | Rörelser som ska synas direkt i andra mobiler |

**Rörelser går inte genom servern.** Lutning och riktning som ska synas direkt
i en annan mobil, som i Lotsen, skickas mellan mobilerna i spelets kanal. Det
är bara en förhandsvisning. Det som avgör uppgiften kontrolleras av servern.

Testsidans synkade tryck använder en publik kanal och flyttas till en privat
kanal i samma steg.

## Platser

Spelaren är på en plats när hon har skannat kortet eller valt platsen i listan.
Serverfunktionen tar emot båda som samma handling och sparar bara varifrån
platsen kom, för felsökningens skull. När spelledaren har valt bort platskorten
visar mobilen listan direkt i stället för kameran.

## Uppdragsfilen

Ett uppdrag är en JSON-fil som följer med serverfunktionen och aldrig läggs ut
på webbsidan. Bilder och ljud ligger i webbsidans mapp för uppdraget.

```json
{
  "format": 1,
  "id": "den-femte-gasten",
  "title": "Den femte gästen",
  "minAge": 16,
  "places": { "A": "Källaren", "B": "Hallen", "C": "Köket", "D": "Biblioteket", "E": "Sovrummet" },
  "steps": [
    { "id": "inledning", "type": "scene", "text": "En kväll 1962 hölls en seans i det här huset." },
    {
      "id": "kallaren",
      "type": "trapped",
      "act": 2,
      "minutes": 7,
      "preparation": 1,
      "requires": ["motion"],
      "roles": [
        { "id": "trapped", "count": 1, "isProminent": true, "place": "A" },
        { "id": "guides", "count": "rest" }
      ],
      "content": {},
      "solution": {},
      "hints": ["…", "…", "…"],
      "onFailure": { "losesMinutes": 0, "sets": "fewerNames" },
      "reveals": { "to": "trapped", "text": "…" }
    }
  ],
  "endings": [ { "id": "kedjan-bryts", "when": "…", "text": "…" } ]
}
```

- **Fälten utanför `content` och `solution` är desamma för alla steg.** Motorn
  läser dem. De täcker det konceptet säger att varje uppgift ska ange.
- **`content` och `solution` tolkas av uppgiftstypen.** Varje typ beskriver
  sina fält, och ett test kontrollerar alla uppdrag mot beskrivningarna. Ett
  skrivfel i ett uppdrag syns då i testerna och inte mitt i ett spel.
  `solution` lämnar aldrig servern.
- **Roller och bitar.** En roll säger vem spelaren är i uppgiften, med ett
  antal eller `rest` för alla övriga. Det rollen ska se och göra ligger som
  bitar i `content`. Motorn delar ut bitarna över dem som delar rollen, så att
  alla bitar finns hos någon och ingen får samma skärm som en annan. Så
  fungerar samma uppgift med tre och med tio spelare.
- **Framträdande roller roterar.** En roll märkt `isProminent` går i första
  hand till någon som inte har haft en sådan.
- **Berättelsen mellan uppgifterna** är steg av typen `scene`.
- **Följder.** Ett misslyckande kan kosta minuter eller sätta en markering som
  senare steg och slut läser.
- **Språk.** Texterna står direkt på svenska. Fler språk blir en fil per språk
  med samma nycklar när de behövs.
- **`format`** gör att motorn kan känna igen en äldre fil om formatet ändras.

De gemensamma fälten bestäms nu. Fälten i `content` för varje uppgiftstyp
bestäms när typen byggs.

## Webbsidan

Webbsidan byggs med React och Vite, med samma upplägg som Maffia (Jonas
2026-11-16). Det som följer med därifrån:

- **Verktygen.** React 19, Vite, Vitest och ESLint med samma regler.
  Koden skrivs i TypeScript, till skillnad från Maffia (Jonas 2026-11-16). `npm run check` kör lint, typkontroll,
  tester och bygge, och GitHub Actions kör samma sak. Bygget läggs ut på
  GitHub Pages.
- **Mapparna.** `src/` med en mapp per ansvar: `game/` för motorns rena
  funktioner, `screens/` för vyerna, och `device/`, `sound/`, `sync/` och
  `view/` som i dag.
- **Vyn och läckkontrollen.** Maffia har en funktion som bygger det enda en
  telefon får veta, och en fristående kontroll som letar efter läckor i varje
  vy. Motorn får båda. Läckkontrollen spelar hela provuppdrag i testerna och
  letar efter facit och andras hemliga bitar i varje vy.
- **En CLAUDE.md** med arbetssätt och arkitektur.

Det som skiljer:

- **Värden är servern, inte en telefon.** Maffia låter en telefon äga spelet
  och skicka vyer genom PeerJS. Här gör serverfunktionen det. Motorn i
  `src/game/` körs därför i Supabase och i testerna, men inte i mobilen.
- **Uppdragsfilerna ligger utanför `src/`,** i `missions/`, så att bygget
  aldrig tar med dem. Ett test kontrollerar att ingen fil i webbsidan
  importerar dem.
- **Rörelser går förbi React.** Lutning och riktning kommer många gånger i
  sekunden och ritas direkt, som rundvisaren gör i dag. React ritar skärmarna
  runt omkring.

Testsidan följer med som en egen sida i samma bygge, på samma adress som nu.
Flytten görs som en egen PR innan motorn påbörjas, så att den går att granska
för sig och prova på mobilerna.

## Supabases gränser

Kontrollerat mot Supabases dokumentation den 16 november 2026.

| Gräns på gratisnivån | Värde | Vad det betyder här |
| --- | --- | --- |
| Meddelanden per sekund i realtid | 100 | Den gräns som faktiskt kan märkas, se nedan |
| Meddelanden per månad | 2 miljoner | Ungefär 100 spel med fyra spelare |
| Samtidiga anslutningar | 200 | Räcker gott |
| Anrop till serverfunktioner per månad | 500 000 | Ett spel drar några tusen |
| Anonyma inloggningar per timme och nätverk | 30 | Höjs i inställningarna inför utveckling, när samma mobiler loggar in om och om igen |
| Projektet pausas | Vid låg aktivitet i sju dagar | Måste lösas, se nedan |

**Hur meddelanden räknas.** Ett meddelande räknas en gång för avsändaren och en
gång per mottagare. En mobil som skickar sin riktning fem gånger i sekunden
till tre andra ger 20 meddelanden i sekunden. Med tio mobiler blir det 50.
Båda ligger under gränsen på 100, men tio gånger i sekunden med tio mobiler
gör det inte, och då kopplar Supabase tillfälligt ner mobilerna. Rörelser
skickas därför högst fem gånger i sekunden och inte när mobilen är stilla.

**Pausen.** Ett gratisprojekt som inte används på en vecka kan pausas och
måste då väckas för hand. Det är precis vad som händer mellan två spelkvällar.
En schemalagd GitHub Action anropar serverfunktionen ett par gånger i veckan.

**Betalnivån** kostar 25 dollar i månaden. Den har 500 meddelanden per sekund
och 5 miljoner per månad, och projektet pausas aldrig.

## Det här säger jag till om

- **Repot är publikt, och därmed facit och bilderna.** Servern skyddar mot den
  som tittar i mobilens webbläsare under spelet. Den som letar på GitHub hittar
  både uppdragsfilen och varje bild. För ett partyspel tror jag att det räcker.
  Ska det skyddas på riktigt behöver uppdragen ligga i ett privat repo och
  bilderna i Supabase Storage. Motorn ändras inte av det.
- **Vem som helst kan skapa spel.** Den publika nyckeln ligger i webbsidan.
  Gränsen för anonyma inloggningar håller tillbaka missbruk, och ett
  schemalagt jobb tar bort spel och anonyma användare som är äldre än ett dygn.
- **Fördröjningen till servern är inte mätt.** Testsidan mätte 75 ms tur och
  retur genom realtidskanalen. Ett anrop till serverfunktionen går en annan väg
  och tar troligen längre tid. Det mäts i första byggsteget, innan något annat
  byggs på det.

## Byggordning inom steget

0. **React och Vite.** Webbsidan flyttas till samma upplägg som Maffia, med
   testsidan oförändrad. Egen PR.
1. **Supabase.** Schemat, kanalernas regler och serverfunktionen läggs i repot
   under `supabase/` och läggs ut av en GitHub Action när `main` ändras.
   Fördröjningen till serverfunktionen mäts på testsidan.
2. **Ansluta.** Spelledaren skapar ett spel och visar en QR-kod och en kod på
   fyra bokstäver. Spelarna ansluter med namn, och alla ser vilka som är med.
3. **Plats och roll.** Spelarna väljer plats med kort eller lista. Ett
   provuppdrag med några scener ger olika spelare olika texter, så att
   rollfördelning och privata vyer går att se med flera mobiler.
4. **Spelledarvyn.** Starta, pausa, ge ledtråd, hoppa över, visa facit på
   begäran och låta en mobil ta över en spelare.

Varje del provas på riktiga mobiler innan nästa påbörjas. Uppgiftstyperna
själva hör till steg 3 i konceptet.

## Det här behöver Jonas göra i Supabase

- Slå på anonym inloggning (Authentication → Sign In / Providers) och höja
  gränsen för anonyma inloggningar (Authentication → Rate Limits).
- Stänga av publika kanaler (Realtime → Settings → Allow public access).
- Skapa en åtkomsttoken och lägga den och databasens lösenord som hemligheter i
  GitHub, så att Actions kan lägga ut schemat och serverfunktionen.

## Ändrat sedan första versionen

| Fråga | Första versionen | Nu | Varför |
| --- | --- | --- | --- |
| Förlopp som styrs av tiden | Togs inte upp | Schema i förväg, tillståndet räknas fram vid varje anrop | En serverfunktion körs bara när den anropas. Utan det här hade Seansen inte gått att bygga |
| Två handlingar samtidigt | Versionsnummer och nytt försök | Lås på spelets rad | Enklare att resonera om, och ingen handling kan tappas |
| Tabeller | Sju | Tre, med tillståndet som JSON | En ny uppgiftstyp ska inte kräva ändringar i databasen |
| Vyer | Sparades i en tabell | Räknas fram varje gång | En sparad kopia kan bli fel |
| Vilka som är med | Togs inte upp | Livstecken var tionde sekund | Löser också missade vyer, klockan och en långsam start |
| Gränser hos Supabase | Ur minnet | Kontrollerade | Gränsen per sekund och pausen efter sju dagar saknades |
| Bilder med hemligheter | Namn som inte går att gissa | Struket | Repot är publikt, så namnen syns ändå |
| Uppdragsfilens roller | Bara ett antal | Roller, bitar och framträdande roller | Måste klara tre till tio spelare |
| Namn | Svenska | Engelska | Koden som finns har engelska namn |
| Spelledarens kanal | Egen kanal | Samma som spelarens | En sak mindre att hålla rätt |
| Webbsidan | Vanlig JavaScript utan byggsteg | React och Vite, som i Maffia | Beslut av Jonas. Det har fungerat bra där |
| Språk | JavaScript med typer i JSDoc | TypeScript | Beslut av Jonas. Motorn har många datatyper som delas mellan mobil och server |
