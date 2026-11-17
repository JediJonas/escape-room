# Escape room för mobiler – koncept och upplägg

Nov 16, 2026 · @Jonas Olsson

## Om dokumentet

Dokumentet beskriver hur ett samarbetsspel i escape room-stil kan byggas för mobiler: principer, uppgiftstyper, hur ett uppdrag är uppbyggt, skalning och teknik. Det är ett första förslag att arbeta vidare från och är tänkt som underlag i ett Claude Code-projekt.

Spelmotorn och uppdragen hålls isär. Motorn och uppgiftstyperna byggs en gång, och varje uppdrag är innehåll som kombinerar dem med en egen berättelse. Det första uppdraget, spökhuset Den femte gästen, beskrivs sist i dokumentet.

Inget är provspelat ännu. Tider, svårighetsgrad och vad mobilerna klarar är uppskattningar som behöver prövas.

## Spelidén i korthet

Spelet är ett partyspel: tre till tio personer som umgås i samma hem löser ett uppdrag tillsammans på ungefär 60 minuter, var och en med sin mobil.

- **Ingen installation.** Spelet är en webbsida. Spelarna går med genom att skanna en kod.
- **Olika information.** Spelarna ser olika saker på sina skärmar, och ingen kan lösa en uppgift ensam.
- **Växlande uppgifter.** Lugna logiska gåtor varvas med moment i realtid där alla använder mobilerna samtidigt.
- **Rörelse i huset.** Utskrivna QR-koder i olika rum gör att gruppen splittras och måste samarbeta på avstånd. Spelet kan stänga in eller låsa ute en spelare när berättelsen kräver det.
- **En berättelse som bär.** Varje uppdrag har en historia med en vändning, och spelarna avslöjar den själva genom det de hittar.
- **Flera uppdrag.** Samma motor ska kunna bära ett spökhus, en mordgåta, en zombieapokalyps eller en skattjakt.

## Vad som gör spelet roligt

Elva principer styr alla uppgifter och uppdrag. De första sex handlar om upplevelsen, de sista fem om att spelet ska fungera en vanlig kväll hemma hos någon.

1. **Alla behövs hela tiden.** Varje uppgift har roller som är beroende av varandra. Den som ser kan inte agera, och den som agerar ser inte. Att läsa upp en tabell för någon annan räknas inte som samarbete.
2. **Mobilen är ett föremål, inte ett papper.** Den lutas, hålls mot örat, läggs bredvid andra mobiler, skannar koder och låter. Spelet reagerar direkt på det spelaren gör.
3. **Variation i vad man gör.** Två uppgifter i rad får aldrig vara av samma typ. Tempot växlar mellan lugnt och stressigt, och gruppen mellan samlad och splittrad.
4. **Berättelsen upptäcks.** En vändning ska dyka upp på en spelares skärm och berättas av den spelaren, inte förklaras i en sluttext.
5. **Misslyckanden kostar men stoppar inte.** Ett fel eller en överskriden tid ger en följd i berättelsen, som ett förlorat verktyg eller ett sämre slut. Ingen grupp ska fastna.
6. **Skratt och kaos är välkomna.** Det är ett partyspel. Att alla ropar i mun på varandra är ett gott tecken, och en uppgift som slutar i fiasko ska vara rolig att berätta om efteråt.
7. **Låg tröskel.** En ovan spelare ska förstå vad hon ska göra inom en minut. Reglerna lärs ut av den första uppgiften, inte av en instruktion.
8. **Korta texter och få namn.** Högst några rader per skärm. Människor, rum och föremål har vanliga namn, inga tekniska beteckningar.
9. **Minimala förberedelser.** Spelledaren ska kunna starta på ett par minuter. Att skriva ut och tejpa upp några QR-koder är gränsen för grundspelet.
10. **Reserv för allt.** Varje moment som kräver en utskrift, en sensor eller en fysisk handling har ett alternativ på skärmen som gör uppgiften lösbar.
11. **Oberoende av bostaden.** Ingen uppgift får kräva en viss planlösning, möblering eller belysning. Spelet ska fungera i en etta och i en villa.

### Förberedelsenivåer

Varje uppgift och uppdrag märks med en nivå, så att spelledaren vet vad som krävs i förväg.

| Nivå | Vad spelledaren gör | Tid | Status |
| --- | --- | --- | --- |
| 1 | Skriver ut ett ark med QR-koder eller ett dokument och lägger ut det | Ett par minuter | Grundspelet |
| 2 | Placerar ut flera dokument, ställer in ett hänglås, lägger ett föremål i en låda | Några minuter | Senare |
| 3 | Klipper, viker, monterar eller bygger rekvisita | Längre | Bara särskilda uppdrag |

## Uppgiftstyper

Tolv uppgiftstyper utgör spelets byggstenar. Varje typ byggs en gång i motorn och fylls sedan med olika innehåll i olika uppdrag.

| Typ | Vad spelarna gör | Tempo | Mobilen används för |
| --- | --- | --- | --- |
| Lotsen | En ser vägen men kan inte styra, en annan styr utan att se | Realtid | Lutning, röst |
| Samtidigt | Alla håller in, trycker eller släpper i rätt ögonblick eller rätt ordning | Realtid | Tryck på skärmen |
| Delat vittnesmål | Var och en har en bit av en logisk gåta och gruppen pusslar ihop dem | Lugnt | Läsa och visa |
| Splittrade rum | Spelarna går till olika rum, skannar en kod och ropar till varandra vad de ser | Lugnt | Kamera, QR-kod |
| Instängd | En spelare isoleras med en egen vy och de andra lotsar ut henne | Realtid | Rundbild, ficklampa |
| Tystad | En spelare får hemlig information men får bara svara ja eller nej, knacka eller mima | Lugnt | Hemlig skärm |
| Ett öra | Ett ljud hörs bara i en mobil, och den spelaren beskriver eller återger det | Blandat | Högtalare mot örat |
| Orkestern | Varje mobil har några tangenter eller toner och gruppen spelar en följd tillsammans | Realtid | Ljud, tryck |
| Skärmar ihop | Mobilerna läggs bredvid varandra och bildar en karta eller bild | Lugnt | Skärmen som pusselbit |
| Mänskliga pusselbitar | Spelarna ställer sig i ordning eller formation efter vad deras mobiler visar | Lugnt | Hemligt värde |
| Sökaren | Spelaren ser sig omkring i ett rum genom mobilen och letar efter något | Lugnt | Rundbild, vridning |
| Dokumentet | Ett utskrivet brev eller urklipp gömmer ett budskap, och spelarna har olika regler för hur det ska läsas | Lugnt | Egen läsnyckel |

Typerna kan kombineras. Instängd och Lotsen blir tillsammans en flykt ur en källare, och Splittrade rum och Delat vittnesmål blir en gåta där ledtrådarna finns i olika rum.

### Vad varje uppgift ska ange

- Typ, tempo och uppskattad tid.
- Roller, och hur de fördelas vid tre till tio spelare.
- Vad varje roll ser och kan göra.
- Hur uppgiften klaras, och vad som händer vid misslyckande.
- Vilken bit av berättelsen den avslöjar, och på vems skärm.
- Tre ledtrådar i stigande tydlighet.
- Förberedelsenivå, material och reserv.
- Vilka mobilfunktioner den kräver.

## Hur ett uppdrag är uppbyggt

Ett uppdrag är ungefär 60 minuter långt och består av åtta till tio uppgifter på fyra till åtta minuter, fördelade på tre akter.

| Akt | Tid | Syfte | Uppgifter |
| --- | --- | --- | --- |
| 1 – Kroken | Cirka 15 min | Lära ut spelet och väcka nyfikenhet | Enkla, gruppen samlad |
| 2 – Upptäckterna | Cirka 30 min | Sprida ut gruppen, avslöja bakgrunden, leverera vändningen | Blandade, flera i olika rum |
| 3 – Finalen | Cirka 15 min | Press, ett val och ett slut | Realtid, alla samtidigt |

**Berättelsen.** Varje uppdrag har en sann bakgrund som bara systemet känner till. Varje uppgift avslöjar en bit av den. Minst en vändning upptäcks av en enskild spelare på hennes egen skärm.

**Rytmen.** En lugn uppgift följs av en stressig, och en uppgift där gruppen sitter samlad följs av en där den sprids ut.

**Tiden.** Gruppen har en gemensam nedräkning på 45, 60 eller 75 minuter. Den visas i mobilerna, där varje spelare kan växla till en nedräkningsvy. Spelet kräver ingen gemensam skärm. När tiden tar slut fortsätter spelet, men slutet blir sämre.

**Ledtrådarna.** Varje uppgift har tre ledtrådar som hela gruppen får samtidigt. De levereras inom berättelsen, till exempel som en viskning från spöket. Spelledaren kan också hoppa över en uppgift som har låst sig.

**Följderna.** Ett misslyckande kostar tid eller en resurs som märks senare. Ett uppdrag har minst två slut, så att gruppens val och prestation syns.

**Återkopplingen.** Spelet svarar direkt på det spelarna gör. Gissningar förhindras genom att svaret är en handling eller ett samspel, inte genom att dölja vad som blev fel.

## Tre till tio spelare

Uppgifterna byggs kring roller i stället för personer, så att samma uppgift fungerar oavsett hur många som spelar.

| Antal | Upplägg |
| --- | --- |
| 3 | En spelare per roll. Minsta antal för att någon ska kunna stängas in medan två hjälper till utifrån. |
| 4–6 | En eller två spelare per roll. Par som delar roll får olika bitar av den. |
| 7–10 | Två eller tre per roll. I de lugna uppgifterna delas gruppen i två lag som behöver varandras fynd. |

- **Par får aldrig samma skärm.** Om två delar roll ser den ena och den andra hör, eller så har de varsin halva. Annars blir en av dem åskådare.
- **Rollerna roterar.** Motorn håller reda på vem som har haft en framträdande roll, så att alla får vara den instängda eller den som styr någon gång.
- **Realtidsuppgifter skalar lättast.** Fler spelare betyder fler händer som ska synkas. De logiska uppgifterna är svårast att skala och behöver lagdelning vid stora grupper.
- **Folk kommer och går.** Det är en fest. En spelare ska kunna tappa anslutningen, ladda om sidan eller gå och hämta dricka utan att spelet låser sig. Rollen ligger kvar vid omladdning och kan tas över av någon annan.

## Spelledaren, rummen och QR-koderna

Spelledaren väljer uppdrag och speltid, skriver ut ett ark med QR-koder, sätter upp dem och startar. Resten sköter spelet.

**Under spelet** kan spelledaren pausa, ge nästa ledtråd, hoppa över en uppgift och se hur långt gruppen har kommit. Spelledaren spelar med som standard och kan välja att stå utanför. Då blir hennes mobil en ren administrationsvy med samma funktioner, och hon får ingen roll i uppgifterna. Facit visas bara om hon ber om det.

**Platskort i stället för uppdragskoder.** Arket innehåller sex platskort, A till F, som återanvänds i alla uppdrag. Uppdraget bestämmer vad varje plats är för kvällen: A är källaren i spökhuset och karantänen i zombieuppdraget. Arket skrivs därmed ut en enda gång.

**Koden säger ingenting.** En QR-kod innehåller bara ett id. Servern avgör vad som händer när någon skannar, beroende på vem det är och var i uppdraget gruppen befinner sig.

**Placeringen.** Korten sätts upp i olika rum, eller i olika hörn om bostaden är liten. Det enda kravet är att spelarna vid olika kort inte ser varandras skärmar.

**Instängd och utelåst.** Ingen dörr låses på riktigt. Den som är instängd får en regel på sin skärm, till exempel att stanna vid kortet tills de andra har släppt ut henne. Den som är utelåst får en mörk skärm eller en egen uppgift.

**Reserven.** Om utskrift saknas eller kameran inte fungerar väljer spelaren plats i en lista på skärmen.

**Spel utan platskort.** Platskorten används som standard, eftersom de får spelarna att gå till olika rum. Spelledaren kan välja bort dem när hon startar. Då väljer alla spelare plats i listan, och inget ark behöver skrivas ut. För motorn är det samma sak att en spelare är på en plats, oavsett om det kom från en skanning eller från listan. Därför fungerar alla uppgifter i båda lägena.

## Teknik

Spelet är en webbapp som körs i mobilens webbläsare, med en server som håller spelets tillstånd och skickar rätt vy till rätt spelare i realtid.

- **Servern äger sanningen.** Spelstatus, rollfördelning och facit ligger på servern. En mobil får bara det material dess spelare ska se.
- **Kanalerna kräver behörighet.** Den publika nyckeln till Supabase ligger öppet i webbsidan. Därför får en mobil bara lyssna och skicka i sitt eget spel, och bara det som dess spelare ska se.
- **Servern avgör samtidighet.** Synkade moment mäts av servern och får inte bygga på att mobilernas klockor går lika.
- **Uppdrag är data.** Ett uppdrag beskrivs i en fil med uppgifter, roller, texter, bilder och ljud. Motorn tolkar filen, så att ett nytt uppdrag inte kräver ny kod så länge det använder befintliga uppgiftstyper.
- **En modul per mobilfunktion.** Kamera, rörelse, ljud och övrigt kapslas in var för sig. Modulen kontrollerar om funktionen finns, ber om tillstånd och växlar till reserven vid behov.
- **React och Vite, som i Maffia.** Webbsidan byggs med React och Vite och har samma verktyg och upplägg som Maffia, men skrivs i TypeScript (Jonas 2026-11-16).
- **Inga andra bibliotek före behov.** Kandidater att utvärdera när en uppgift kräver dem är Tone.js och Howler.js för ljud och dnd-kit för dra och släpp. QR-koder läses med jsQR där webbläsaren saknar egen läsare.
- **En teknisk testsida.** Varje funktion ska kunna provas för sig på iPhone Safari och Android Chrome, utan att ett helt uppdrag startas.

### Drift

Projektet börjar från noll. GitHub Pages kan bara leverera färdiga filer och har ingen server, så det räcker inte ensamt. Spelet behöver tre saker därutöver: en databas för spelsessioner, en realtidskanal mellan mobilerna och serverkod som kontrollerar svar utan att facit når mobilen.

Webbsidan ligger kvar på GitHub Pages, och Supabase står för databas, realtid och serverkod. Kraven ovan stäms av mot Supabases gratisnivå när projektet sätts upp.

### Mobilens funktioner

Begränsningarna nedan är min bild av läget och ska bekräftas på riktiga mobiler innan en uppgift byggs på dem.

| Funktion | Används till | Att tänka på | Reserv |
| --- | --- | --- | --- |
| Rörelse och lutning | Se sig omkring, styra | iPhone kräver att spelaren godkänner efter ett tryck | Dra med fingret |
| Kamera | Skanna platskort | Kräver tillstånd och säker anslutning | Välja plats i en lista |
| Ljud | Röster, larm, toner, ljud i en enda mobil | Startar först efter ett tryck; ljudlöst läge och blåtandshörlurar ställer till det | Text eller bild med samma innehåll |
| Vibration | Hemlig signal till en spelare | Saknas i regel i iPhones webbläsare | Diskret blinkning på skärmen |
| Kompass | Riktningar | Opålitlig inomhus | Riktning relativt spelaren, inte väderstreck |
| Mikrofon | Knackningar, ljudnivå | Osäker tolkning, kräver tillstånd | Knacka på skärmen |
| Vaken skärm | Skärmen får inte slockna mitt i en uppgift | Stödet varierar mellan webbläsare | Påminnelse att röra skärmen |

Tillstånden för rörelse, kamera och ljud bör samlas in tidigt och inom berättelsen, så att ingen systemruta dyker upp mitt i en spännande scen.

### Rundbilder

Uppgiftstyperna Instängd och Sökaren behöver en rundbild per rum. Bilderna är den största produktionskostnaden i ett uppdrag. Mörker och ficklampa minskar den, eftersom spelaren aldrig ser hela bilden på en gång.

Rundbilderna tas fram som illustrationer med Googles Gemini-API och bildmodellen Nano Banana 2.1. Modellerna beskrivs i [Geminis dokumentation](https://ai.google.dev/gemini-api/docs/image-generation.md.txt). API:et tar inte formatet 2:1, så bilden tas fram i 16:9 och trycks ihop efteråt.

Det är prövat på testsidan med tre källarbilder, och rundbilderna håller. Provet beskrivs i `docs/rundbilder-prov.md`.

- **Skarven** där bildens kanter möts syns inte i någon av bilderna.
- **Golv och tak** förvrängs nära rakt upp och rakt ner, och där kan Gemini också måla fel. Upp till ungefär 30 grader från horisonten ser rummet rätt ut. Uppgifterna ska därför inte lägga något viktigt i taket eller på golvet under spelaren, och mörker och ficklampa får dölja resten.
- **Samma stil i flera rum** är inte prövat med olika sorters rum. De tre källarna fick samma stil av samma stilbeskrivning.
- **Rummets storlek** styrs av hur bilden beskrivs för Gemini, inte av visaren. I ett stort rum blir föremålen små och suddiga när spelaren zoomar in.

Spelaren ser sig omkring genom att vrida sig med mobilen, och fingret är reserven. Hon kan zooma med två fingrar och visa bilden över hela skärmen. En vuxen blev lite yr av att se sig omkring, barnen blev det inte. Efter prov på riktig mobil gäller därför två saker: rummet hålls vågrätt när mobilen lutas i sidled, och visaren använder det mjuka perspektivet, som inte drar ut bildens kanter.

Provbilderna är inte de slutliga. Bilderna till Den femte gästen tas fram på nytt, och de ska vara läskigare än provbilderna, som togs fram för tioåringar.

Reserven är en bred illustration som spelaren bara kan panorera i sidled. Den finns i visaren och tar över av sig själv om mobilen inte klarar rundvisaren.

### Föremål i rundbilden

En rundbild kan ha föremål som spelaren undersöker, till exempel en etikett på en flaska, en lapp eller en inristning i väggen. Det ger Sökaren och Instängd något att hitta.

- **Det man hittar kräver någon annan.** Föremålet ger en bit som en annan spelare behöver, inte en ledtråd som spelaren löser ensam.
- **Korta texter.** En etikett eller en rad på en lapp. Längre texter hör hemma i uppgiftstypen Dokumentet.
- **Generös träffyta.** Föremålet tänds när det hamnar nära bildens mitt eller i ficklampans sken, och ett tryck var som helst på skärmen öppnar det då. Spelaren ska inte behöva träffa ett litet föremål med tummen medan hon vrider mobilen.
- **Föremål är data.** Ett föremål beskrivs i uppdragsfilen med en riktning och en storlek. Servern skickar innehållet först när spelaren öppnar det.

Det byggs i rundvisaren när rundbilderna har visat sig hålla.

### Röster och viskningar

Röster och viskningar genereras i förväg och sparas som ljudfiler i uppdraget. Inget tal skapas under spelets gång, så spelet behöver ingen talmodell i drift.

Två tjänster är kandidater. [Geminis talfunktion](https://ai.google.dev/gemini-api/docs/speech-generation) ligger i samma API som bilderna och styrs med vanlig text, till exempel en begäran om en kuslig viskning. Svenska finns med i [språklistan](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts) som förhandsversion. [ElevenLabs v3](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v3-alpha) styrs med taggar som \[whispers\] och har svenska bland sina språk.

Hur bra en svensk viskning faktiskt låter är oprövat. Reserven är att spela in rösterna själv.

## Första uppdraget: Den femte gästen

Den femte gästen är ett spökhusuppdrag på cirka 60 minuter med nio uppgifter. Rummen finns i mobilen, så inget behöver förberedas och inga platskort sätts upp (Jonas 2026-11-17).

**Tonen.** Uppdraget ska vara läskigt och samtidigt roligt, från 16 år. Stämningen byggs med mörker, viskningar i en enda mobil och skrämselmoment, som en skärm som plötsligt slocknar. Inget blod och inget våld. Åldern höjdes från ungefär tio år i november 2026, för att uppdraget ska få vara läskigare.

### Vad spelarna får veta

En kväll 1962 hölls en seans i huset. Fem gäster kom, men bara fyra gick därifrån. Den femte, Vera, sågs aldrig mer. Spelarna upprepar seansen med mobilerna som instrument, och Vera svarar. Hon ber dem ta reda på vad som hände henne.

### Sann bakgrund, bara för systemet

Huset behåller alltid en gäst. Den som är fast kan bara lämna det om någon annan tar platsen. 1962 lockade husets dåvarande fånge ner Vera i källaren. De fyra andra gästerna förstod vad som höll på att hända, låste källardörren och flydde.

Vera ljuger inte för spelarna, men hon berättar inte allt. Hennes hjälp leder steg för steg en av dem ner i källaren.

### Vändningen

Den instängda spelaren hittar namn inristade i källarväggen, vart och ett överstruket och följt av nästa. Det sista är Vera. Under det håller spelarens eget namn på att ristas in. Bara hon ser det, och hon måste berätta det för de andra genom dörren.

### Platser

Husets rum är salongen, hallen, köket, biblioteket, sovrummet och källaren. De finns i mobilen, och spelarna går mellan dem på skärmen utan att lämna bordet (Jonas 2026-11-17). Spelet säger vart var och en ska, men alla kan gå vart de vill.

Två gånger går en spelare iväg på riktigt, till ett annat rum i bostaden med stängd dörr (Jonas 2026-11-17):

- **Vera minns.** Vera tar över spelarens mobil. Skärmen blir svart och skriver "Gå ut. Stäng dörren efter dig." Spelaren trycker Klar först när dörren är stängd, och knackar sedan Veras svar på dörren.
- **Källaren.** Den instängda går till ett annat rum och stänger dörren, och de andra lotsar henne genom dörren.

Det är de enda tillfällena då gruppen splittras på riktigt, och de blir starkare av det.

### Nu och 1962

Varje plats finns i två tider: som den är nu och som den var kvällen 1962 (Jonas 2026-11-17).

- **Nu.** När en spelare går till en plats ser hon platsen som den är i kväll, med det som gruppen har hittat där. Det som en gång har hittats ligger kvar och går att se igen, till exempel urklippen i biblioteket (se Hittat nedan). Gruppen går fortfarande igenom uppgifterna i ordning, men behöver inte minnas allt.
- **Klockan.** Alla klockor i huset stannade kvart över nio, när ljuset slocknade 1962. Det finns en enda klocka att vrida, golvuret i salongen (Jonas 2026-11-17). Den som står vid det vrider visarna, med mobilen som en ratt eller med fingret som reserv. Visarna hakar i var femte minut, så att det går att träffa rätt. Står de på 21.15 minns hela huset, för alla spelare samtidigt, och alla platser visas som de var då. Vrids de till vilken annan tid som helst är huset tillbaka i nu (Jonas 2026-11-17).
- **Minnet syns.** Minnesbilden är sepiatonad, kornig och flimrar lite, med en rad överst som säger platsen och tiden. Alla spelare ser att huset minns, var de än är.
- **Ett rum var i minnet.** När huset minns väljer varje spelare vilket rum hon ska vara i, bland dem som finns kvar, och hon stannar där tills minnet bleknar (Jonas 2026-11-17). Nästa gång väljer alla på nytt, så att spelarna kan byta rum med varandra. Är spelarna fler än rummen fylls rummen jämnt: ett rum går bara att välja om inget annat rum har färre spelare i sig. Med sex spelare och fyra rum blir det alltså två i två av rummen och en i de andra, aldrig tre i ett (Jonas 2026-11-17).
- **Minnet bleknar.** Efter några minuter bleknar minnet av sig självt, och huset är tillbaka i nu (Jonas 2026-11-17). Någon får gå tillbaka till golvuret och vrida igen. Visarna står då kvar på 21.15, så det räcker att vrida bort och tillbaka. Medan huset minns går det inte att se det som finns i nuet, till exempel urklippen i biblioteket. Det ger press och gör att gruppen behöver bestämma tillsammans när den ska resa och vart.
- **Vägen till klockan.** Huvudartikeln i Tidningsurklippen säger att golvuret i salongen stannade kvart över nio den kvällen och inte har gått sedan dess, och att ingen vet var de fem var just då. Golvuret i rundbilden står på en annan tid, så den som har läst artikeln ser att något inte stämmer. Den som kör fast kan gå tillbaka till seansen, där Vera bokstaverar en hjälp som VRID TILLBAKA eller KVART ÖVER NIO (Jonas 2026-11-17).

### Rundbilder och Hittat

Alla platser är rundbilder, i båda tiderna (Jonas 2026-11-17). En del saker i bilden går att trycka på, som seansbordet och golvuret i salongen eller byrån i biblioteket, och då öppnas en vy där spelaren gör något. Uppgiftens skärm är alltså en vy som man kommer till från rundbilden.

- **Hittat.** Under bilden finns en lista med det gruppen har hittat. Den fylls på i takt med att något hittas och är gemensam för hela gruppen. Seansen finns där från början. Urklippen kommer in när någon har hittat dem i byrån, golvuret när någon har vridit det första gången och källardörren när någon har hittat den i hallen (Jonas 2026-11-17).
- **Lätt att komma tillbaka.** Det som står i listan går att öppna var spelaren än står. Att hitta något första gången kräver att man är på rätt plats.
- **Reserv.** Listan är också reserven för den som inte hittar i bilden eller inte klarar rundvisaren.

### Kedjan genom akt 1

Varje uppgift ger vägen till nästa (Jonas 2026-11-17).

1. Seansen ger berättelsen, och Vera pekar på byrån.
2. Urklippen i byrån och en tavla i hallen ger gästernas namn och kännetecken, och tiden 21.15.
3. Golvuret tar gruppen till minnet.
4. I minnet visar Rummen minns var gästerna var.

### Källardörren och nyckeln

Källardörren finns i hallens rundbild (Jonas 2026-11-17). Den går att hitta tidigt, och då hamnar den i Hittat, men den som försöker öppna den får veta att den är låst. Nyckeln behövs för att komma ner i uppgift 7 (Jonas 2026-11-17). Ritningen visar var nyckeln ligger, i en lönnlåda i byrån, så att gruppen inte kan hoppa direkt till källaren.

### Flöde

| Nr | Uppgift | Typ | Tempo | Vad gruppen får veta |
| --- | --- | --- | --- | --- |
| 1 | Seansen | Samtidigt | Lugnt | Vera finns kvar i huset och vill ha hjälp |
| 2 | Tidningsurklippen | Dokumentet, Delat vittnesmål | Lugnt | Vilka de fem gästerna var och hur man känner igen dem |
| 3 | Rummen minns | Splittrade rum | Lugnt | Vera fanns inte i något rum när ljuset slocknade |
| 4 | Pianot | Orkestern, Ett öra | Realtid | Melodin som spelades när ljuset slocknade kallar fram Vera |
| 5 | Vera minns | Tystad | Lugnt | De fyra gästerna låste källardörren själva |
| 6 | Ritningen | Skärmar ihop | Lugnt | Det finns ett rum bakom källaren, och var nyckeln ligger |
| 7 | Källaren | Instängd, Lotsen | Realtid | Vändningen: Vera vill byta plats med en av dem |
| 8 | Hon letar | Lotsen, i hela huset | Realtid | Namnen på alla som huset har tagit |
| 9 | Bryta kedjan | Samtidigt, med ett val | Realtid | Slutet |

Akt 1 är uppgift 1–2, akt 2 är uppgift 3–7 och akt 3 är uppgift 8–9.

### Uppgifterna

**1. Seansen.** Uppdraget börjar med en berättelse: spelarna är ett gäng vänner som har valt att hålla en seans i ett hus där det sägs spöka. På brädet bokstaverar Vera vart de ska gå, till byrån (Jonas 2026-11-17). Seansen spelas som med ett ouijabräde (Jonas 2026-11-17). Brädet fyller hela skärmen, kant i kant, och har alla bokstäver från A till Ö. Klockan och menyknappen ligger överst, och vem skenet väntar på står i en ruta i underkant (Jonas 2026-11-17). Alla håller fingret på sin egen planchett och följer ett sken som glider långsamt mot nästa bokstav, lika hos alla. Skenet börjar sakta, går fortare mitt på vägen och bromsar in mot bokstaven (Jonas 2026-11-17). Skenet rör sig bara medan allas planchetter följer med. Halkar någon efter stannar det, och alla ser vem det väntar på. Når skenet bokstaven stannar det där i tre sekunder, utan att något lyser upp, eftersom fingret ändå skymmer bokstaven (Jonas 2026-11-17). Meddelandet skrivs inte ut, så gruppen får själv hålla reda på bokstäverna och prata ihop sig om vad det säger. Lyfter någon fingret bryts kontakten, alla ser vem som släppte och meddelandet börjar om. När meddelandet är klart slocknar skenet. Brädet ser ut som förut, utan någon text, och står kvar tills var och en själv trycker Lämna brädet. Sedan trycker alla Klar (Jonas 2026-11-17). Uppgiften lär ut att alla behövs. Tillstånd för ljud och rörelse begärs i scenen före, när spelaren trycker Klar, eftersom en systemruta på iPhone mitt i seansen kan bryta kontakten. En scen anger det med `asksFor` i uppdragsfilen. Brädet och planchetten ska bli bilder när designen ses över.

**2. Tidningsurklippen.** Urklippen ligger i byrån i biblioteket och hittas i rundbilden. Huvudartikeln från 1962 berättar att fem ungdomar gick in i huset men bara fyra kom ut. Den nämner inga namn och har inga bilder, men säger att golvuret stannade kvart över nio (Jonas 2026-11-17). Runt den finns andra urklipp, som en förlovningsannons, en dödsruna, en annons för en optiker och en notis från en pipklubb. Varje urklipp säger något om en eller två av gästerna, men bara halva kopplingen: det ena ger ett namn, det andra ett kännetecken som syns, till exempel en röd sjal eller ett pärlhalsband. Urklippen delas ut så att ingen har alla, och två spelare måste lägga ihop sina för att få en hel koppling. En gäst finns inte i något urklipp utan på en tavla i hallen, så att gruppen måste gå runt i huset och inte bara läsa (Jonas 2026-11-17). Urklippen ligger sedan i Hittat. De visas på skärmen. Utskrift prövas om skärmen inte räcker (Jonas 2026-11-17). Det ersätter förslaget med läsregler som Vera viskar.

**3. Rummen minns.** Urklippen leder till golvuret (se Kedjan genom akt 1). När någon har vridit tillbaka tiden väljer spelarna var sitt rum och ser minnet (se Ett rum var i minnet). Rummen är hallen, köket, biblioteket och sovrummet. Källaren sparas till uppgift 7. I minnet syns en gäst utan namn, med ett kännetecken som en röd sjal eller ett pärlhalsband, och en detalj som en stannad klocka. Inga röster säger några namn (Jonas 2026-11-17). Vem gästen är vet gruppen bara från Tidningsurklippen, så spelarna måste berätta för varandra vad de ser och lägga ihop det med vad de har läst. Sedan samlas gruppen och anger var alla fem gästerna stod, med Vera "ingenstans", i ett enda svar. Ett fel svar kostar tid. Det går därför inte att gissa sig fram rum för rum. Vid tre spelare står ett rum tomt, och gruppen behöver minnas två gånger. Vid fem eller fler delar flera på ett rum och ser olika delar av det. Rummen visas som text tills mekaniken är provad och får sedan bilder från Gemini. Den första versionen, med röster och ett val per rum, var för lätt vid provspel.

**4. Pianot.** En spelare hör en melodi i sin mobil och ingen annan hör den. De övriga har några tangenter var. Lyssnaren nynnar och dirigerar, och gruppen spelar melodin ton för ton i rätt ordning. Ett fel ger en falsk ton och ett nytt försök. Pianot står i hallen, och i minnet av hallen står det öppet med noter på. Melodin är den som spelades när ljuset slocknade 1962, och när gruppen spelar den kommer Vera så nära att hon kan ta över en mobil.

**5. Vera minns.** Vera tar över en mobil, och den spelaren går ut och stänger dörren (se Platser). Hon ser ett minne från källartrappan men får inte prata, bara knacka på dörren, en gång för ja och två för nej. Knackarna är Veras, men det är spelaren som knackar, på riktigt (Jonas 2026-11-17). Reserven är att hon trycker på skärmen och att knackarna hörs i de andras mobiler. De andra frågar sig fram till vad som hände: gästerna låste dörren och sprang. Sist knackar hon fram sovrummet, där ritningen finns.

**6. Ritningen.** Varje mobil visar en bit av husets ritning. Spelarna lägger mobilerna bredvid varandra på bordet och vrider dem tills väggarna möts. Den färdiga ritningen visar ett rum bakom källaren som inte finns på någon annan karta, och en lönnlåda i byrån där nyckeln till källardörren ligger.

**7. Källaren.** Gruppen låser upp källardörren i hallen med nyckeln, och Vera ber en spelare gå ner. Spelaren går till ett annat rum i bostaden och stänger dörren, och dörren slår igen i mobilen. Den instängdas mobil blir en ficklampa i ett mörkt rum, och hon ser sig omkring genom att vrida på mobilen, med fingret som reserv. De andra stannar vid bordet och pratar med henne genom dörren. De har var sin bit av en beskrivning av källaren, till exempel att den dolda dörren sitter bakom hyllan med syltburkarna, och lotsar henne mot det dolda rummet medan något kommer närmare. De har också proppskåpet i köket: tre säkringar som tänder källarlampan i tre sekunder hos den instängda. När dörren är mitt i ficklampan trycker hon på skärmen. Ett tryck på fel ställe hörs och för det närmare. Bakom dörren hittar hon namnen på väggen, och bara hon ser dem. Hinner det fram släpps hon ändå ut, men med färre namn till finalen. Första versionen använder källarbilden från testsidan och en beskrivning i text, eftersom Ritningen inte är byggd. En ny och läskigare källare tas fram med Gemini när mekaniken är provad.

**8. Hon letar.** Vera söker nu igenom huset. Uppgiften byggdes för riktiga rum och behöver tänkas om nu när rummen finns i mobilen (Jonas 2026-11-17). Ett förslag är att spelarna smyger mellan rummen på skärmen. I den första versionen ska spelarna hämta en sak vid varje platskort, men får bara röra sig när hon tittar åt ett annat håll. En utkik ser på sin skärm vart hon vänder sig och ropar "stilla!". Mobilen känner av den som rör sig för sent, och den spelaren får börja om från salongen. Reserv om rörelsesensorn saknas: spelaren håller in en knapp medan hon står stilla.

**9. Bryta kedjan.** Alla samlas och håller fingret på skärmen som i seansen. Namnen från källarväggen ska läsas upp i rätt ordning, och varje spelare har bara några av dem. Sedan väljer gruppen. Att stänga dörren är enkelt och räddar alla spelare, men Vera blir kvar. Att släppa ut alla huset har tagit kräver en svårare synkad avslutning, och ett misslyckande kostar.

### Slut

| Slut | När | Vad som händer |
| --- | --- | --- |
| Kedjan bryts | Gruppen väljer att släppa ut alla och klarar det | Huset blir tyst. Vera tackar dem och försvinner |
| Dörren stängs | Gruppen väljer det säkra | Alla kommer ut, men Vera är kvar och väntar på nästa gäster |
| Den sjätte gästen | Tiden är slut eller finalen misslyckas | En spelares mobil slocknar, och hennes namn står sist på väggen |

## Fler möjliga uppdrag

Tre andra teman passar samma motor och visar att uppgiftstyperna går att återanvända. De är bara idéer än så länge.

| Uppdrag | Tema | Vad som särskiljer det |
| --- | --- | --- |
| Karantänen | Zombieapokalyps | En spelare blir smittad. Hennes skärm förvrängs allt mer, och gruppen måste avgöra när hon ska låsas ute |
| Sista skålen | Mordgåta | Varje spelare har en roll med en hemlighet. Uppgifterna tvingar fram bitar av sanningen |
| Arvet | Skattjakt | Två lag följer var sin halva av en karta och måste till slut lägga ihop dem |

## Från de tidigare underlagen

De två tidigare dokumenten har använts som inspiration. Det här är vad som följer med och vad som har lämnats.

| Behåller | Lämnar |
| --- | --- |
| Förberedelsenivåerna och kravet på ett par minuters förberedelse | Ubåten och dess tekniska beteckningar |
| Reserv på skärmen för allt fysiskt | Uppgifter som går ut på att jämföra tabeller och loggar |
| Ingen spelare har all information | Fritextsvar som kontrolleras utan återkoppling |
| Gemensam nedräkning i tre längder, och spel som går att slutföra efter tidens slut | Morsekod som diktamen |
| Tre stegvisa ledtrådar per uppgift | Sluttext som förklarar vändningen |
| Facit bara på servern, QR-koder utan innehåll | Kravet på helt digitalt spel utan utskrifter |
| Mekanikerna utan insyn, rytm, synkade handlingar, mänskliga pusselbitar och dolda budskap | Textigenkänning och exakt kompassriktning i första versionen |
| En modul per mobilfunktion och en teknisk testsida |  |

## Beslut och öppna frågor

Elva frågor är avgjorda den 16 november 2026.

| Fråga | Beslut |
| --- | --- |
| Spelledarens roll | Spelar med som standard, men kan välja att stå utanför |
| Spelledare som står utanför | Mobilen blir en ren administrationsvy med samma funktioner, utan roll i uppgifterna |
| Gemensam skärm | Nej. Nedräkning, berättelse och ljud finns i spelarnas mobiler |
| Rundbilder | Illustrerade, framtagna med Gemini-API:et (Nano Banana). Prövat och håller, utom rakt upp och rakt ner |
| Platskort | Används som standard. Spelledaren kan välja bort dem, och då väljer spelarna plats i en lista. Den femte gästen används utan platskort (Jonas 2026-11-17) |
| Föremål i rundbilden | Ja. Spelaren kan undersöka föremål, med korta texter som en annan spelare behöver |
| Röster och viskningar | Genereras i förväg och sparas som ljudfiler. Oprövat på svenska |
| Ton och ålder | Läskigt med skrämselmoment, från 16 år, och samtidigt roligt. Inget blod och inget våld |
| Utgångsläge | Ingen befintlig app. Projektet börjar från noll |
| Drift | GitHub Pages för webbsidan, Supabase för databas, realtid och serverkod |
| Webbsidans verktyg | React och Vite, med samma upplägg som Maffia, i TypeScript |
| Språk | Svenska först. Texterna ligger i uppdragsfilen, så att fler språk kan läggas till senare |

Tre saker prövas när arbetet börjar.

- Får olika sorters rum samma stil i Geminis rundbilder?
- Låter genererade svenska röster och viskningar tillräckligt bra, och vilken tjänst ger bäst resultat?
- Räcker Supabases gratisnivå för realtid med tio mobiler i samma session?

## Föreslagen byggordning

1. **Teknisk testsida.** Rörelse, QR-skanning, ljud och synkade tryck provas på iPhone och Android. En rundbild tas fram med Gemini och provas i en visare. En viskning på svenska genereras och provas i en mobil. Resultatet avgör vilka uppgiftstyper som är realistiska.
2. **Motorns grund.** Supabase-projektet sätts upp, därefter session, anslutning med kod, rollfördelning, spelstatus i realtid och en enkel spelledarvy.
3. **Tre uppgifter som prototyp.** Seansen, Rummen minns och Källaren täcker tillsammans de synkade, de splittrade och de instängda momenten. Provspelas med tre till fyra personer.
4. **Resten av uppgiftstyperna** som Den femte gästen behöver.
5. **Hela uppdraget**, provspelat med tre, sex och tio spelare.
6. **Nästa uppdrag**, som prövning av att motorn klarar nytt innehåll utan ny kod.
