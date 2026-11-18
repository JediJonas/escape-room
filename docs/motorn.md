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
  att en mobil bara kan lyssna på sin egen kanal och sitt eget spels
  kanaler.
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
| `games` | Kod att ansluta med, uppdrag och spelets hela tillstånd som ett JSON-värde. Speltid, och om spelledaren spelar ligger i tillståndet |
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
| `group:<id>` | Alla spelare i spelet | Bara servern | Det som är lika för alla och ändras ofta, som seansens läge |

**Gruppens kanal.** En vy skickas till varje spelare för sig, så en ändring
blir lika många meddelanden som det finns spelare, och varje meddelande
räknas både när det skickas och när det tas emot. Det som är lika för alla och
ändras ofta skickas därför en gång i gruppens kanal (Jonas 2026-11-17). Med
tio spelare blir en ändring 11 meddelanden i stället för 20. Vyn och läget kan
komma i fel ordning, så mobilen behåller det läge som har den senaste
serverns tid. Mobilerna skickar inte i gruppens kanal, så ingen kan låtsas
vara servern. En mobil som väntar på att bli insläppt kan lyssna där, men ser
då bara seansens läge och namnen på dem som skenet väntar på.

**Rörelser går inte genom servern.** Lutning och riktning som ska synas direkt
i en annan mobil, som i Lotsen, skickas mellan mobilerna i spelets kanal. Det
är bara en förhandsvisning. Det som avgör uppgiften kontrolleras av servern.

Testsidans synkade tryck använder en publik kanal och flyttas till en privat
kanal i samma steg.

## Platser

Spelaren är på en plats när hon har valt platsen i listan, eller gått dit i
huset när uppdraget har ett. Spelet skannar inga platskort, och valet att
använda dem när spelet startar är borttaget (Jonas 2026-11-18). QR-skanningen
finns kvar på testsidan.

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
  antal eller `rest` för alla övriga. Det rollen ska se ligger som bitar i
  rollens `pieces`. Motorn delar ut bitarna över dem som delar rollen, så att
  ingen får samma skärm som en annan. Så fungerar samma uppgift med två och
  med tio spelare. En roll har minst lika många bitar som den kan få
  spelare, och testerna kontrollerar det för varje uppdrag.
- **En roll kan ha en egen plats** med `goTo`. Då delar gruppen på sig i
  samma steg, och spelaren ser sina bitar först när hon är framme. Så
  byggdes Källaren. Ett steg utan roller med egen plats
  samlar alla på samma plats eller ingen.
- **Högst antal bitar per spelare.** Med `maxPiecesPerPlayer` får ingen fler
  bitar än så. Är spelarna få blir då vissa bitar kvar hos ingen. Utan gränsen
  fick en ensam gäst i Provhuset nio rader att läsa upp. Uppgifter som
  behöver alla bitar sätter ingen gräns. Den som skriver uppgiften avgör
  (Jonas 2026-11-17).
- **Framträdande roller roterar.** En roll märkt `isProminent` går i första
  hand till den som har väntat längst sedan sin senaste framträdande roll. Lika fall
  lottas med ett tal ur spelets starttid, stegets id och spelarens id, så att
  lotten blir densamma varje gång servern räknar (Jonas 2026-11-18).
  Också vem som får vilken roll och vilka bitar lottas, i stället för att
  gå på ordningen spelarna gick med i (Jonas 2026-11-18).
  Ordningen sparas i tillståndet som `prominentHistory`.
- **Berättelsen mellan uppgifterna** är steg av typen `scene`. En scen kan
  ha en egen text på knappen med `readyLabel`, till exempel "Jag har läst".
  Utan den står det Klar (Jonas 2026-11-18). En scen med `endsWithStep`
  har ingen knapp. Spelaren blir klar av att lämna saken med Tillbaka
  (`isDoneByLeaving` i vyn), och scenen slutar när alla är klara och gruppen
  har klarat uppgiften i nästa steg, i vilken ordning som helst. Urklippen
  slutar alltså när alla har läst dem och minnet har bleknat
  (Jonas 2026-11-18). Brädet fungerar på samma sätt när meddelandet är klart.
- **Följder.** Ett misslyckande kan kosta minuter eller sätta en markering som
  senare steg och slut läser.
- **Språk.** Texterna står direkt på svenska. Fler språk blir en fil per språk
  med samma nycklar när de behövs.
- **`format`** gör att motorn kan känna igen en äldre fil om formatet ändras.

De gemensamma fälten bestäms nu. Fälten i `content` för varje uppgiftstyp
bestäms när typen byggs.

**Seansen** har typen `seance` och meddelandet i `solution.message`, med
versaler och ett mellanslag mellan orden. Servern sparar vilken bokstav
skenet är på väg till, hur långt det har kommit vid en viss tid, vems
planchett som följer. Skenet
tar en bestämd tid för varje sträcka medan alla följer, så både servern och
mobilerna kan räkna ut var det är utan att servern tickar. Farten längs
sträckan varierar, men det avgör bara var mobilen ritar skenet. Mobilen avgör själv om
planchetten är på skenet och säger bara till när det ändras, och när den ser
skenet nå en bokstav. Fingrets rörelser går inte genom servern. Seansens läge
skickas i gruppens kanal, och bara när meddelandet är klart får alla en ny vy.
Läget har namnen på dem som följer i den ordning de kom till skenet, så att
varje mobil ser om den själv följer utan att någon annans id skickas. När
skenet når en bokstav säger den som kom först till skenet till direkt, och de
andra en halv sekund senare var, i tur och ordning, om servern inte redan har
svarat. Annars ställer sig tio anrop i kö hos servern samtidigt
(Jonas 2026-11-17). Skenet
flyttas aldrig bakåt på skärmen, och den egna mobilen stoppar det direkt när
planchetten tappar, så att fördröjningen till servern inte syns som ett hopp.
Ligger skenet efter servern när det rör sig igen glider det ikapp. Se
`seance.ts`.

En seans kan ställa en fråga. Har den `solution.answers` trycker gruppen inte
Klar när meddelandet är klart, utan skriver ett svar under `question`, och
frågan står kvar tills gruppen vet. Med `wrongAnswerMinutes` dras tid från
nedräkningen för varje fel svar, och alla ser hur många fel det har blivit.
Med `callsFromHouse` kallar brädet på gruppen tills meddelandet är klart:
saken som öppnar seansen skimrar i rummets lista, och i de andra rummen
står sakens `callingText`, till exempel att det hörs något från salongen.
Knackningar togs bort,
eftersom de var svåra att förstå (Jonas 2026-11-18). En sak i huset kan öppna flera steg med
`opensSteps`, som ouijabrädet som öppnar båda seanserna.

**Rummen minns** har typen `rooms`. Steget öppnas från golvuret i
salongen, och bara den som står där kan vrida visarna. Steget har
`clockStart`, tiden som golvuret står på från början, `memoryMinutes`, hur
länge huset minns, `memoryLabel`, raden överst i minnet, och `rooms`, med en
plats och bitar för varje rum, viktigast först. Tiden som får huset att minnas
ligger i `solution.time`. Tiderna skrivs som `21.15` och räknas på en
tolvtimmars urtavla, på en femte minut. Mobilen skickar visarnas läge när
spelaren släpper, och servern hakar i och avgör. Servern sparar var visarna
står, när minnet bleknar, vilka som har valt vilket rum i den ordning de
valde, och vilka rum som har setts. Ett rum går bara att välja om inget annat
rum har färre spelare, och den som väljer ett rum står sedan där. Är spelarna
färre än rummen kan den som har minst antal rum ta ett tomt rum till när alla
har valt, och står kvar i sitt första. Står flera i
samma rum delas bitarna mellan dem i den ordning de valde. Varje rum har därför
minst så många bitar som det kan få spelare med tio i gruppen. Medan huset
minns är dörrarna stängda. Servern tickar inte: när tiden har gått säger
mobilerna till, och servern för fram tillståndet. Visarna går då tillbaka till
starttiden, och har alla rum setts går gruppen vidare. Golvuret och minnet
syns hos alla, så alla får en ny vy när de ändras. Se `rooms.ts`.

**Golvuret och pianot går att använda hela tiden** (Jonas 2026-11-18). En
sak i huset vars steg inte är det aktuella har `instrument` i vyn: urtavlan
eller spelarens tangenter. `turnClock` och `playKey` tar emot handlingen
oavsett steg, men bara från den som står vid saken. Klaras uppgiften innan
berättelsen har kommit dit sparas stegets id i tillståndets `solvedSteps`,
och när gruppen sedan kommer dit går den förbi steget. Allt annat i
berättelsen visas som vanligt, och andra steg kan inte klaras i förväg.
Rummen och pianot sparas därför över stegen i `rooms` och `piano`. Minnet
visas hos alla så länge huset minns, vilket steg gruppen än är på.

**Källaren** har typen `cellar`. Steget har roller som andra steg, där
`trappedRoleId` pekar ut den instängda rollen, som har en egen plats.
Rundbilden står i `image`, tiden i `minutes`, säkringarna i `fuses` och
`lightMs`, och vad ett fel tryck kostar i `wrongTapMs`. Dörrens riktning i
bilden ligger i `solution`. Tiden börjar när den instängda kommer fram, och
servern sparar bara när det var, hur mycket fel tryck har kostat och hur
många säkringar som är använda. När tiden har gått ut säger mobilerna till,
och servern avgör. Hann det fram sätts `markWhenCaught` i tillståndets
`marks`, som senare steg och slut läser. Rundbilden i spelet lyssnar på
rörelsesensorn utan att fråga, eftersom tillståndet begärs i en scen
tidigare (`asksFor`). Kommer inga värden styr fingret. Se `cellar.ts`.

**Pianot** har typen `piano`. Steget öppnas från pianot i hallen, och bara
den som står där kan slå an en tangent. Steget har `keys`, pianots
tangenter som "C4" eller "F#4", och `beatMs`, hur långt ett slag är.
Melodin står i `solution.melody` som toner med antal slag. När gruppen
kommer till steget väljer servern vems mobil som spelar melodin, som en
framträdande roll, så att den roterar. Bara den mobilens vy har melodin, och
den spelas högt så att alla hör (Jonas 2026-11-18). Tangenterna delas mellan
alla i lottad ordning, också den som spelar melodin (Jonas 2026-11-18). Var och en får fyra intilliggande
tangenter, och fönstren sprids jämnt så att varje tangent finns hos någon
(Jonas 2026-11-18). De svarta tangenterna ritas och låter i mobilen, men
skickas inte till servern. Innan någon spelar melodin delas de mellan alla.
Det räknas fram vid varje anrop, så servern sparar bara vems mobil det är
och de senaste tonerna, högst lika många som melodin har. Handlingen
`playKey` tar en tangent. Inget säger till om en fel ton, och tonen låter
bara i mobilen som spelade den, så ingen annan får en ny vy av den. När de
senaste tonerna är melodin är uppgiften klar (Jonas 2026-11-18). Med `callsFromHouse` kallar pianot på gruppen som brädet.
Tonerna görs i ljudmotorn, så att inget klipp behöver hämtas. Se `piano.ts`.

**Tidningsurklippen** är en scen med roller. Urklippen är bitarna i en roll
för alla, så att de delas ut och ingen har alla. Det som alla ser, som
huvudartikeln och gästboken, står i scenens `documents`. Med `foundTitle`
hamnar steget i Hittat när gruppen lämnar det: servern sparar vem som hade
vilka bitar i tillståndets `found`, och varje spelare ser sedan dokumenten
och bara sina egna bitar. Se `found.ts`.

**Huset** står i uppdragets `house`: rummet där alla börjar, och för varje
rum dörrarna och sakerna. En sak har en text att visa, sidor att bläddra i
(`pages`, som gästboken) eller ett steg som den
öppnar (`opensSteps`, en lista, så att ouijabrädet kan öppna båda seanserna), och kan hittas först från ett visst steg (`fromStep`).
Var spelaren är sparas i `placeByPlayer`, som platskorten använder, och det
gruppen har hittat i `foundThings`. Handlingen `walk` går bara genom en dörr,
och `searchRoom` hittar det som berättelsen har kommit till i rummet. Ett
steg som öppnas från en sak syns i mobilen först när spelaren har öppnat
saken. Dörrarna kontrolleras så att de går åt båda hållen. Se `house.ts`.

**Uppdraget väljs när spelet startar.** Spelledaren ser uppdragen i
väntrummet och väljer ett när hon trycker Starta spelet. Spelet skapas med
Provhuset.

## Webbsidan

Webbsidan byggs med React och Vite, med samma upplägg som Maffia (Jonas
2026-11-16). Det som följer med därifrån:

- **Verktygen.** React 19, Vite, Vitest och ESLint med samma regler.
  Koden skrivs i TypeScript, till skillnad från Maffia (Jonas 2026-11-16). `npm run check` kör lint, typkontroll,
  tester och bygge, och GitHub Actions kör samma sak. Bygget läggs ut på
  GitHub Pages.
- **Mapparna.** Motorns rena funktioner ligger hos serverfunktionen, i
  `supabase/functions/game/`, eftersom Supabase bara lägger ut filer under
  `supabase/functions/`. `src/` har en mapp per ansvar: `screens/` för
  vyerna, och `device/`, `sound/`, `sync/` och `view/` som i dag.
- **Vyn och läckkontrollen.** Maffia har en funktion som bygger det enda en
  telefon får veta, och en fristående kontroll som letar efter läckor i varje
  vy. Motorn får båda. Läckkontrollen spelar hela provuppdrag i testerna och
  letar efter facit och andras hemliga bitar i varje vy.
- **En CLAUDE.md** med arbetssätt och arkitektur.

Det som skiljer:

- **Värden är servern, inte en telefon.** Maffia låter en telefon äga spelet
  och skicka vyer genom PeerJS. Här gör serverfunktionen det. Motorn körs
  därför i Supabase och i testerna, men inte i mobilen. Mobilen hämtar bara
  typerna och några små delade funktioner därifrån, som koden att ansluta med.
- **Uppdragsfilerna ligger utanför `src/`,** i
  `supabase/functions/game/missions/`, så att bygget aldrig tar med dem och
  Supabase lägger ut dem med serverfunktionen (Jonas 2026-11-17). Ett test
  kontrollerar att ingen fil i webbsidan importerar dem.
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

**Seansen** är den uppgift som ligger närmast gränsen. När tio spelare lägger
fingret på brädet inom två eller tre sekunder blir det tio ändringar. Som vyer
till var och en blev det cirka 200 meddelanden, alltså 70–100 i sekunden. I
gruppens kanal blir det cirka 110, alltså 40–55 i sekunden. Samma sak händer
när någon har lyft fingret och alla kommer tillbaka till skenet. Räknat i en
simulering den 17 november 2026, inte uppmätt i Supabase.

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
   Koden har bara konsonanter utan I och O, så att den inte går att läsa fel
   och inte bildar ord. QR-koden ritas med biblioteket `qrcode-generator`,
   som bara laddas hos spelledaren. En spelare kan lämna väntrummet, men
   inte spelledaren, eftersom spelet då står utan ledare.
3. **Plats och roll.** Spelarna väljer plats med kort eller lista. Ett
   provuppdrag med några scener ger olika spelare olika texter, så att
   rollfördelning och privata vyer går att se med flera mobiler. Byggs i två
   delar. Den första ger spelledaren knappen Starta spelet och en tillfällig knapp Nästa som ersätts i steg 4. En
   scen kan skicka spelarna till en plats, och texten där syns bara hos den
   som har kommit fram. Uppdragsfilen anger sitt minsta antal spelare, och
   provuppdraget Provhuset tillåter två (Jonas 2026-11-17). Den andra delen
   ger roller och bitar: motorn delar ut rollerna när ett steg börjar, och
   Provhuset har två scener där en spelare får en hemlighet och de andra
   olika bitar. En läckkontroll spelar alla uppdrag med två till tio spelare
   och letar efter andras bitar i varje vy.
4. **Spelledarvyn.** Starta, pausa, ge ledtråd, hoppa över, visa facit på
   begäran och låta en mobil ta över en spelare. Byggs i tre delar. Den
   första tar bort väntan på spelledaren: i en scen trycker varje spelare
   Klar, och gruppen går vidare när alla har tryckt. En scen som bara skickar
   alla till en plats går vidare när den sista är framme. Har platsen en text
   trycker spelaren Klar efter att ha läst den (Jonas 2026-11-17). En uppgift
   går vidare när den är löst. Är sista steget en scen är det slutet, och
   spelet tar slut när gruppen kommer dit. Spelledaren ser vilka som är klara och kan gå
   vidare ändå om någon har gått iväg. Har alla andra tryckt Klar döljs Gå
   vidare ändå, eftersom hon då kan trycka Klar själv (Jonas 2026-11-18). Hon väljer speltid, 45, 60 eller 75
   minuter, när hon startar, och kan pausa. Den andra delen ger ledtrådar,
   att hoppa över och facit, med uppgiftstypen `answer` där gruppen skriver
   in ett svar. Provhuset får uppgiften Lappen. Spelledaren ger ledtrådarna
   en i taget, och alla ser dem. Facit skickas bara till spelledaren när hon
   ber om det, och läckkontrollen prövar det. Den
   tredje låter spelledaren stå utanför, släppa in den som kommer sent och
   låta en mobil ta över en spelare. Den som kommer efter start väntar tills
   spelledaren svarar. Har mobilen samma namn som en spelare ber den om att
   ta över spelaren, och får då spelarens roll, plats och det den redan har
   gjort. Spelledarens plats kan inte tas över på det sättet. En mobil som
   väntar frågar servern var tredje sekund, eftersom kanalen den lyssnar på
   försvinner vid ett övertagande. Den gamla mobilen kan höra spelarens
   kanal tills den laddar om, eftersom Supabase prövar behörigheten när
   kanalen öppnas.

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
| Seansens läge | En vy till varje spelare | En gång i gruppens kanal | Halverar meddelandena, så att tio spelare håller sig under gränsen per sekund (Jonas 2026-11-17) |
