# Escape room för mobiler – koncept och upplägg

Nov 16, 2026 · @Jonas Olsson

## Om dokumentet

Dokumentet beskriver hur ett samarbetsspel i escape room-stil kan byggas för mobiler: principer, uppgiftstyper, hur ett uppdrag är uppbyggt, skalning och teknik. Det är ett första förslag att arbeta vidare från och är tänkt som underlag i ett Claude Code-projekt.

Spelmotorn och uppdragen hålls isär. Motorn och uppgiftstyperna byggs en gång, och varje uppdrag är innehåll som kombinerar dem med en egen berättelse. Det första uppdraget, spökhuset Den femte gästen, beskrivs sist i dokumentet.

Inget är provspelat ännu. Tider, svårighetsgrad och vad mobilerna klarar är uppskattningar som behöver prövas.

Begreppen som används här och i koden förklaras i [ordlistan](ordlista.md).

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

Den femte gästen går också att spela med två, så att den kan provas med två mobiler (Jonas 2026-11-18).

Uppgifterna byggs kring roller i stället för personer, så att samma uppgift fungerar oavsett hur många som spelar.

| Antal | Upplägg |
| --- | --- |
| 2 | Går att spela, framför allt för att prova. I källaren lotsar en ensam den instängda med de viktigaste bitarna (Jonas 2026-11-18). |
| 3 | En spelare per roll. Minsta antal för att någon ska kunna stängas in medan två hjälper till utifrån. |
| 4–6 | En eller två spelare per roll. Par som delar roll får olika bitar av den. |
| 7–10 | Två eller tre per roll. I de lugna uppgifterna delas gruppen i två lag som behöver varandras fynd. |

- **Par får aldrig samma skärm.** Om två delar roll ser den ena och den andra hör, eller så har de varsin halva. Annars blir en av dem åskådare.
- **Rollerna roterar.** Motorn håller reda på vem som har haft en framträdande roll, så att alla får vara den instängda eller den som styr någon gång. Den som har väntat längst får nästa. Är det lika, som i början när ingen har haft någon, lottas det mellan dem (Jonas 2026-11-18). Allt annat som delas ut, som roller, urklipp och pianots tangenter, lottas också i stället för att gå på ordningen man gick med i (Jonas 2026-11-18).
- **Realtidsuppgifter skalar lättast.** Fler spelare betyder fler händer som ska synkas. De logiska uppgifterna är svårast att skala och behöver lagdelning vid stora grupper.
- **Folk kommer och går.** Det är en fest. En spelare ska kunna tappa anslutningen, ladda om sidan eller gå och hämta dricka utan att spelet låser sig. Rollen ligger kvar vid omladdning och kan tas över av någon annan.

## Spelledaren, rummen och QR-koderna

Spelledaren väljer uppdrag och speltid, skriver ut ett ark med QR-koder, sätter upp dem och startar. Resten sköter spelet.

**Under spelet** kan spelledaren pausa, ge nästa ledtråd och hoppa över en uppgift. Allt det ligger i hennes meny, en hamburgare som alltid finns i nedre högra hörnet (Jonas 2026-11-18). Där finns Pausa spelet och Hoppa över uppgiften i en uppgift. I urklippen, som väntar på både läsningen och Rummen minns, räknar Hoppa över uppgiften alla som lästa och hoppar över Rummen minns med ett tryck (Jonas 2026-11-18). En scen har ingen knapp i menyn. Den går vidare när alla har tryckt Ok eller Klar (Jonas 2026-11-18). Ge ledtråd och Visa facit för mig finns i menyn var spelledaren än är, så länge gruppen har en olöst uppgift. Är uppgiften redan klarad syns de inte. Det finns bara en knapp Ge ledtråd, och servern väljer vilken ledtråd som kommer, så att spelledaren inte behöver veta vad gruppen väntar på. Ledtrådarna numreras genom hela steget, Ledtråd 1, Ledtråd 2 och så vidare, och rubriken säger inte vad de gäller. Det får texten säga när det behövs. Har ingen hittat saken som uppgiften börjar vid är första ledtråden att den finns i huset, till exempel Det finns ett ouijabräde någonstans i huset. Den texten står på saken i uppdragsfilen (Jonas 2026-11-18). Pausa spelet stoppar allt, inte bara nedräkningen. En ruta täcker alla mobiler så att ingen kan spela, inte heller spelledaren, men hennes meny ligger ovanpå så att hon kan fortsätta. Servern tar inte emot något från spelarna under pausen, och det som går på tid, som minnet i Rummen minns och planchetten på brädet, står still (Jonas 2026-11-18). Sist i menyn ligger Avsluta spelet, som avslutar spelet för alla, var gruppen än är (Jonas 2026-11-18). Det går inte att ångra, så menyn frågar först. Sedan visar alla mobiler att spelledaren har avslutat spelet, med knappen Till startsidan, och mobilerna glömmer spelet som när uppdraget tar slut av sig självt. Den som väntar på att få vara med släpps och ser samma sak. Ingen ser vilka som är klara, inte heller spelledaren, och ingen rad säger att mobilen väntar på de andra. Efter Ok i en berättartext är spelaren tillbaka i huset och kan leta medan de andra läser, och nästa steg märks av sig självt (Jonas 2026-11-18). Spelledaren spelar med som standard och kan välja att stå utanför. Då blir hennes mobil en ren administrationsvy med samma funktioner, och hon får ingen roll i uppgifterna. Facit visas bara om hon ber om det.

**Varje uppdrag har rum.** Spelarna går mellan rum, vare sig det är ett hus, en ubåt eller en rymdraket. Det man hittar ligger i sitt rum, och vill man se det igen går man tillbaka dit. Det finns ingen lista över det man har hittat (Jonas 2026-11-18). Provhuset, som bara används för att prova motorn, har inga rum än.

**Fyra hörn.** Varje skärm har samma fyra hörn: uppdraget uppe till vänster, tiden uppe till höger, en statusrad nere till vänster och spelledarens meny nere till höger. Statusraden är en kort rad text som står kvar och beskriver läget, som Gå runt i huset och leta eller vem planchetten väntar på. I fullskärm står Tillbaka i uppdragets hörn. Hörnen följer innehållets kanter, i mobil som i dator, och knappar står ovanför den nedre raden (Jonas 2026-11-18).

**Allt man går in på visas i fullskärm.** Det gäller i alla uppdrag. Ett tryck på en sak, som ett bräde, ett instrument, ett papper eller en bok, öppnar en vy som fyller skärmen, utan text. Överst står Tillbaka och klockan, och underst en eventuell huvudhandling nära tummen (Jonas 2026-11-18). Mellan Tillbaka och klockan står sakens namn som rubrik, samma namn som i rundbilden, till exempel Vitrinskåpet (Jonas 2026-11-23). Saken slutar alltid en bit ovanför underkanten. Där finns plats för en kort text när det behövs, som vem planchetten väntar på vid ouijabrädet, och i hörnet ligger spelledarens meny som i alla vyer. Spelarna har samma luft, fast de inte har menyn (Jonas 2026-11-18). Bakgrunden går kant i kant, men själva innehållet, som saken, brädet eller en berättartext, har en största bredd och höjd. Innehållet börjar överst, direkt under Tillbaka och tiden, som i textvyn, och centreras inte i höjdled (Jonas 2026-11-18). I mobilen får det ta telefonens hela bredd. I iPad och dator är ytan lite större, men dras inte ut över hela skärmen, så att saken ser likadan ut överallt (Jonas 2026-11-18).

- **Alla har Tillbaka.** Knappen uppe till vänster heter Tillbaka och tar spelaren ut ur vyn till det hon kom från. Klockan står alltid uppe till höger. Tillbaka, klockan och spelledarens meny står i innehållets kanter, inte i skärmens, så att de hamnar intill saken också i iPad och dator (Jonas 2026-11-18). Spelarna har ingen meny (Jonas 2026-11-18).
- **Spelledarens meny ligger i hörnet.** Spelledaren har också Tillbaka överst, och hennes meny är hamburgaren i nedre högra hörnet. Hamburgaren ligger ensam i den understa raden och aldrig bredvid en knapp, i mobil som i dator. Spelledarens knappar står en rad högre och får hela bredden, medan spelarnas knappar ligger kvar längst ner (Jonas 2026-11-18). En rad text utan knapp, som Gå runt i huset och leta eller vem planchetten väntar på, står bredvid hamburgaren (Jonas 2026-11-18). Stegets text står inte i menyn, vid någon sak. Vid brädet upprepade den seansens första ledtråd, och det som behövs ska stå i ledtrådarna (Jonas 2026-11-18).
- **Ingen text i vyn, ledtrådar i en inforuta.** Vyn visar bara saken, utan stegets text, som pianot, golvuret och ouijabrädet. Texten finns inte heller i spelledarens meny. Hur man gör vid brädet är seansens första ledtråd (Jonas 2026-11-18). Ger spelledaren en ledtråd visas den i en ruta längst ner hos alla en stund. Rutan följer innehållets kanter som spelledarens meny, så att den inte går i full skärmbredd i iPad och dator. Pausrutan och sluttexten har också sin text inom innehållets yta (Jonas 2026-11-18). Rutan går att trycka bort. Ledtrådarna står inte kvar i någon lista, det räcker att de syns en stund i rutan (Jonas 2026-11-18).
- **Berättartexter visas i fullskärm.** En berättartext fyller skärmen, och spelaren trycker Ok när hon har läst. Alla berättartexter visas på samma sätt, med text och knappen Ok, också scenerna mellan uppgifterna (Jonas 2026-11-18). Texten dyker upp av sig själv när uppgiften börjar, och visas bara en gång. Den som får pianots melodi får till exempel direkt efter ouijabrädet texten att hon hör en melodi i huvudet (Jonas 2026-11-18). Det som hörs från ett annat rum när något kallar på gruppen, som planchetten eller pianots ton, är också en berättartext (Jonas 2026-11-18).
- **Papper ligger i en hög.** Flera papper, som urklipp eller sidorna i en bok, ligger ovanpå varandra med kanterna synliga, och spelaren bläddrar genom att svajpa i sidled eller med pilar (Jonas 2026-11-18).
- **Undantag.** Den som är instängd i källaren behåller menyn tills vidare, eftersom hon inte kan gå tillbaka därifrån.

**Platskort i stället för uppdragskoder.** Arket innehåller sex platskort, A till F, som återanvänds i alla uppdrag. Uppdraget bestämmer vad varje plats är för kvällen: A är källaren i spökhuset och karantänen i zombieuppdraget. Arket skrivs därmed ut en enda gång.

**Koden säger ingenting.** En QR-kod innehåller bara ett id. Servern avgör vad som händer när någon skannar, beroende på vem det är och var i uppdraget gruppen befinner sig.

**Placeringen.** Korten sätts upp i olika rum, eller i olika hörn om bostaden är liten. Det enda kravet är att spelarna vid olika kort inte ser varandras skärmar.

**Instängd och utelåst.** Ingen dörr låses på riktigt. Den som är instängd får en regel på sin skärm, till exempel att stanna vid kortet tills de andra har släppt ut henne. Den som är utelåst får en mörk skärm eller en egen uppgift.

**Reserven.** Om utskrift saknas eller kameran inte fungerar väljer spelaren plats i en lista på skärmen.

**Spel utan platskort.** Spelet skannar inga platskort just nu. Rutan Vi har satt upp platskorten i väntrummet och skanningen i spelet är borttagna, eftersom rummen finns i mobilen (Jonas 2026-11-18). Spelarna väljer plats i listan eller går dit i huset, och inget ark behöver skrivas ut.

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
- **Motorn äger formen, uppdraget äger stämningen.** Knappar, klockan, Tillbaka, menyn, avstånd, storlekar och ikoner ser likadana ut i alla uppdrag. Ett uppdrag ändrar bara färger, typsnitt, papper, bakgrund och ornament, genom ett tema i uppdragsfilen. Temat är CSS-variabler från en fast lista, och motorn sätter dem på sidan när uppdraget visas. Det man trycker på har alltid mobilens eget typsnitt, och uppdragets typsnitt används till rubriker, berättartext, ledtrådar och papper. Accentfärgen betyder att något går att göra eller kallar på en, och rött betyder alltid fel, lite tid kvar eller Avsluta. Klockan blir röd när det är fem minuter kvar (Jonas 2026-11-23). Förslaget står i `granskning/designsystem/designforslag.md` i projektfilerna.
- **Mörkt hela tiden.** Spelet är mörkt oavsett mobilens inställning, också startsidan, som har motorns neutrala färger. Väntrummet byter till uppdragets tema när spelledaren väljer uppdrag (Jonas 2026-11-23).
- **Vyerna i designen.** Koden skrivs i fyra rutor. I väntrummet är uppdragen kort med en bild, speltiden är en växlare och Jag spelar med är en strömbrytare. Rummet visar uppdraget och rummet i två rader uppe till vänster, och den tända saken har en knapp med sakens namn. Spelledarens meny är ett blad med ikoner, med steget och antalet ledtrådar överst och Avsluta spelet sist i rött. Ledtråden står i en ruta med en glödlampa och rubriken Ledtråd 2. Paus lägger en suddig yta över vyn, och klockan visar en paus (Jonas 2026-11-23).

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
- **Rummets storlek** styrs av hur bilden beskrivs för Gemini, inte av visaren. I ett stort rum blir sakerna små och suddiga när spelaren zoomar in.

Spelaren ser sig omkring genom att vrida sig med mobilen, och fingret är reserven. Hon kan zooma med två fingrar och visa bilden över hela skärmen. En vuxen blev lite yr av att se sig omkring, barnen blev det inte. Efter prov på riktig mobil gäller därför två saker: rummet hålls vågrätt när mobilen lutas i sidled, och visaren använder det mjuka perspektivet, som inte drar ut bildens kanter.

Provbilderna är inte de slutliga. Bilderna till Den femte gästen tas fram på nytt, och de ska vara läskigare än provbilderna, som togs fram för tioåringar.

Reserven är en bred illustration som spelaren bara kan panorera i sidled. Den finns i visaren och tar över av sig själv om mobilen inte klarar rundvisaren.

### Saker i rundbilden

En rundbild kan ha saker som spelaren undersöker, till exempel en etikett på en flaska, en lapp eller en inristning i väggen. Det ger Sökaren och Instängd något att hitta.

- **Det man hittar kräver någon annan.** Saken ger en bit som en annan spelare behöver, inte en ledtråd som spelaren löser ensam.
- **Korta texter.** En etikett eller en rad på en lapp. Längre texter hör hemma i uppgiftstypen Dokumentet.
- **Generös träffyta.** Saken tänds när den hamnar nära bildens mitt eller i ficklampans sken, och ett tryck var som helst på skärmen öppnar den då. Spelaren ska inte behöva träffa en liten sak med tummen medan hon vrider mobilen.
- **Saker är data.** En sak beskrivs i uppdragsfilen med en riktning och en storlek. Servern skickar innehållet först när spelaren öppnar det.

Det byggs i rundvisaren när rundbilderna har visat sig hålla.

### Röster och viskningar

Röster och viskningar genereras i förväg och sparas som ljudfiler i uppdraget. Inget tal skapas under spelets gång, så spelet behöver ingen talmodell i drift.

Två tjänster är kandidater. [Geminis talfunktion](https://ai.google.dev/gemini-api/docs/speech-generation) ligger i samma API som bilderna och styrs med vanlig text, till exempel en begäran om en kuslig viskning. Svenska finns med i [språklistan](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts) som förhandsversion. [ElevenLabs v3](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-is-eleven-v3-alpha) styrs med taggar som \[whispers\] och har svenska bland sina språk.

Hur bra en svensk viskning faktiskt låter är oprövat. Reserven är att spela in rösterna själv.

## Första uppdraget: Den femte gästen

Den femte gästen är ett spökhusuppdrag på cirka 60 minuter med nio uppgifter. Rummen finns i mobilen, så inget behöver förberedas och inga platskort sätts upp (Jonas 2026-11-17).

**Tonen.** Uppdraget ska vara läskigt och samtidigt roligt, från 16 år. Stämningen byggs med mörker, viskningar i en enda mobil och skrämselmoment, som en skärm som plötsligt slocknar. Inget blod och inget våld. Åldern höjdes från ungefär tio år i november 2026, för att uppdraget ska få vara läskigare.

**Utseendet.** Temat är levande ljus och gulnat papper: svartbrun bakgrund med ett varmt sken uppifrån, mörkt trä i rutorna och en accent i ljusets gula färg. Rubriker och sakernas namn står i IM Fell English SC, och berättartexter, urklipp, rollkort och ledtrådar i EB Garamond, som är lättare att läsa i längre stycken (Jonas 2026-11-23). Båda typsnitten ligger i repot under SIL Open Font License.

**Sakerna.** Golvuret, gästboken, pianot, ouijabrädet och tidningsurklippen är tecknade bilder från Gemini i samma stil som rundbilderna, utan text och siffror. Spelet skriver siffror, visare, namn och bokstäver ovanpå, och bilden står överst i sakvyn, så stor som får plats (Jonas 2026-11-23). Golvuret har tom urtavla och tomt pendelfönster. Gästbokens sidor är olinjerade, och namnen står i skrivstil, Homemade Apple, med blått bläck. Pianot är en tecknad oktav, C till B, som läggs bredvid sig själv och flyttas en vit tangent per steg, så att varje spelare ser sina fyra tangenter. Bilden är beskuren till tangenterna, utan träet ovanför, och tangenterna är lika breda som ouijabrädet. Räcker inte höjden göms tangenternas övre del, som under pianots lock (Jonas 2026-11-24). Tangenterna saknar bokstäver i början, så att gruppen spelar på gehör. Bokstäverna syns först när spelledaren har gett den tredje ledtråden, som säger tonerna, och efter att melodin är spelad (Jonas 2026-11-24). Urklippen är ett stort urklipp för artikeln, med datumrad, rubrik och anfang, och ett litet för varje notis, med första meningen som rubrik. Texten står i Old Standard TT. Allt man bläddrar i, som gästboken och urklippen, ligger i en hög överst, och bläddringsknapparna ligger längst ner, närmast tummen. När spelaren tittar på sina egna urklipp står Bara du ser det här i statusraden (Jonas 2026-11-23). Typsnitten ligger i repot med sina licenser.
