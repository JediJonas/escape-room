# Ordlista

Nov 18, 2026

Ordlistan förklarar de begrepp som används i konceptet, i `docs/motorn.md` och
i koden. Varje begrepp har en kort förklaring och, där det finns, namnet i
koden. Den förklarar orden, inte reglerna: hur något fungerar står i
`docs/koncept.md`.

Där konceptet och koden använde olika ord har Jonas valt ett. Besluten står
sist under Namn som är bestämda.

## Spelet och uppdraget

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Spel | En spelkväll: en grupp som spelar ett uppdrag tillsammans, från väntrummet till slutet. | `games`, `GameState` |
| Uppdrag | Ett helt äventyr med egen berättelse, som Den femte gästen. Ett uppdrag är innehåll, inte kod. | `Mission` |
| Uppdragsfil | Filen som beskriver ett uppdrag: steg, roller, texter, hus, ledtrådar och facit. Bara serverfunktionen läser den. | `missions/*.json` |
| Provhuset | Ett litet provuppdrag som bara används för att prova motorn. | `missions/prov.json` |
| Motor | Koden som är lika för alla uppdrag: spelets tillstånd, roller, tid, huset och uppgiftstyperna. | `supabase/functions/game/` |
| Steg | En post i uppdragets ordning. Ett steg är antingen en scen eller en uppgift. Spelledaren ser till exempel steg 3 av 12 överst i sin meny (Jonas 2026-11-23). | `MissionStep`, `stepIndex` |
| Scen | Ett steg med berättelse mellan uppgifterna. Spelarna läser berättartexten och trycker Ok, eller blir klara av att lämna en sak. | `SceneStep`, `type: 'scene'` |
| Uppgift | Ett steg där gruppen ska klara något, som Seansen eller Pianot. Har ledtrådar och facit. | `TaskStep` |
| Uppgiftstyp | En sorts uppgift som byggs en gång i motorn och fylls med innehåll i olika uppdrag, som Samtidigt eller Orkestern. I koden har varje typ ett eget namn. | `type`: `seance`, `flashback`, `piano`, `cellar`, `answer` |
| Akt | En av uppdragets tre delar: Kroken, Upptäckterna och Finalen. | |
| Berättelsen | Det som händer i uppdraget, som spelarna avslöjar själva genom det de hittar. | |
| Sann bakgrund | Det som verkligen hände, som bara systemet känner till. Spelarna får veta det bit för bit. | |
| Vändningen | Den överraskning i berättelsen som en enskild spelare upptäcker på sin egen skärm och berättar för de andra. | |
| Följd | Det ett misslyckande kostar: tid, eller en markering som senare steg och slut läser. | `wrongAnswerMinutes`, `marks` |
| Slut | Ett av uppdragets avslutningar. Gruppens val och prestation avgör vilket. Inte byggt än. | |
| Avsluta spelet | Spelledaren avslutar spelet för alla innan uppdraget är slut. Finns i hennes meny. | `endGame`, `isEndedByLeader` |
| Förberedelsenivå | Hur mycket spelledaren behöver göra före spelet, från 1 (skriva ut ett ark) till 3 (bygga rekvisita). | |
| Reserv | Ett sätt att klara ett moment på skärmen när en utskrift, sensor eller fysisk handling inte fungerar. | |

## Spelare och roller

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Spelare | En person med en mobil i spelet. | `PlayerRecord`, `players` |
| Spelledare | Den som skapar spelet, väljer uppdrag och speltid och startar. Spelar med som standard. | `isLeader` |
| Står utanför | Spelledaren spelar inte med. Hennes mobil blir en administrationsvy utan roll. | `isPlaying`, `leaderPlays` |
| Gruppen | Alla spelare tillsammans. | |
| Roll | Vem spelaren är i en uppgift, som den instängda eller lotsarna. Roller delas ut när ett steg börjar. | `Role`, `roleByPlayer` |
| Bit | En del av det en roll ska se, som ett urklipp eller en rad i en beskrivning. Bitarna delas ut så att ingen har samma skärm som en annan. | `pieces` |
| Framträdande roll | En stor roll, som den instängda eller den som spelar melodin. Går till den som har väntat längst. | `isProminent`, `prominentHistory` |
| Lottas | Det som delas ut, som roller, bitar och tangenter, fördelas med lott och inte efter ordningen man gick med i. | `lotSeed` |
| Klar | En spelare är klar med ett steg när hon har tryckt Klar eller lämnat saken. Gruppen går vidare när alla är klara. | `readyPlayerIds`, `isMeDone` |
| Ta över en spelare | En ny mobil tar en spelares plats, roll och det hon har gjort, till exempel när ett batteri tar slut. | `takesOverPlayerId` |
| Kommer sent | En mobil som går med efter start och väntar tills spelledaren släpper in den. | `pendingPlayers`, `WaitingView` |

## Före spelet

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Startsidan | Första sidan, med Gå med i spel och Skapa spel. | `StartScreen` |
| Kod | De fyra bokstäverna man går med med. Bara konsonanter utan I och O. | `joinCode` |
| Väntrummet | Där alla samlas innan spelet startar, och där spelledaren väljer uppdrag och speltid. | `lobby`, `LobbyScreen` |
| Speltid | Gruppens tid: 45, 60 eller 75 minuter. | `minutes` |
| Testsidan | Den tekniska testsidan där mobilens funktioner provas var för sig. Skrivs inte i React. | `src/testsida/` |

## Huset och platserna

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Plats | Ett av uppdragets ställen, med en bokstav från A till F. Uppdraget bestämmer vad varje plats är för kvällen. | `PlaceId`, `Place`, `places` |
| Platskort | Ett utskrivet kort med en QR-kod för en plats. Används inte i spelet just nu. | |
| Huset | Uppdragets rum i mobilen, med dörrar och saker. Spelarna går mellan rummen på skärmen. | `House`, `house` |
| Rum | En plats i huset, som hallen eller salongen. Ett rum har dörrar och saker. | `HouseRoom` |
| Dörr | En väg från ett rum till ett annat. I Den femte gästen nås alla rum från hallen, och salongen har också dörrar till sovrummet och köket. | `doors`, `walk` |
| Sak | Något i ett rum som går att trycka på, som ouijabrädet, golvuret, byrån eller tavlan. Öppnar alltid en sakvy. Också det man undersöker i en rundbild, som tidigare kallades föremål. | `HouseThing`, `ThingView` |
| Hitta | En sak heter Undersök i rundbilden tills någon har tryckt på den. Sedan heter den sitt namn för alla. Det räcker att en spelare gör det. | `foundThings`, `findThing`, `hiddenSpots` |
| Leta i rummet | Knappen som hittar det som finns i ett rum utan rundbild, som källaren. | `searchRoom` |
| Plats i bilden | Var en sak eller dörr sitter i rundbilden: vridning, lutning och en träffyta i grader. | `Spot`, `spot`, `doorSpots` |
| Tänd | Mitten av rundbilden tänder saken vars ram den är innanför: sakens kontur ritas och raden längst ner säger vad det är. Inget tänds förrän spelaren har börjat se sig omkring i rummet. Ett tryck öppnar det. | `findSpotAt` |
| Kallar | En sak drar till sig gruppen: raden längst ner i dess rum skimrar, och i de andra rummen visas en berättartext. | `callsFromHouse`, `isCalling`, `callingText` |
| Instrument | Golvuret och pianot, som går att använda hela tiden och inte bara när berättelsen har kommit dit. | `Instrument`, `instrument` |
| Instängd | En spelare som isoleras med en egen vy, som i källaren. | `trapped` |
| Utelåst | En spelare som stängs ute från det de andra gör. Bara i konceptet än. | |

## Skärmarna

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Rumsvy | Rummet som en rundbild i fullskärm, där spelaren trycker på saker och dörrar i bilden. Det enda sättet att se ett rum, sedan textvyn togs bort (Jonas 2026-11-20). Ett rum utan bild, som källaren, visas som en lista tills bilden finns. | `RoomView`, `RoomList` |
| Sakvy | Det som öppnas när spelaren trycker på en sak: saken i fullskärm, utan text, med Tillbaka, sakens namn som rubrik och klockan överst. En sak med en funktion, som pianot, ouijabrädet, golvuret, byrån och gästboken, visar först en närbild och en text med knappen Använd. | `ThingScreen` |
| Berättartext | En text i fullskärm som dyker upp av sig själv, visas en gång och bekräftas med Ok. Också scenerna i huset visas så. | `narration`, `melodyText`, `callingFrom` |
| Fullskärm | En vy som fyller skärmen. Inte helskärm. Bakgrunden går kant i kant, men innehållet har en största bredd och höjd. | `ThingScreen` |
| Fyra hörn | Varje skärm har samma fyra hörn: uppdraget uppe till vänster, tiden uppe till höger, statusraden nere till vänster och spelledarens meny nere till höger. I fullskärm står Tillbaka i uppdragets hörn. Knapparna står ovanför den nedre raden. Hörnen följer innehållets kanter, inte skärmens. | |
| Statusrad | Den korta raden text nere till vänster, som står kvar och beskriver läget, som Gå runt i huset och leta eller vem skenet väntar på. Hette tidigare notis. | |
| Tillbaka | Knappen uppe till vänster som tar spelaren ut ur en sakvy tillbaka till rummet. Alla har den. | `leaveThing` |
| Meny | Spelledarens hamburgare i nedre högra hörnet. Spelarna har ingen meny, utom den instängda i källaren. | `LeaderMenu` |
| Inforuta | Den tillfälliga rutan längst ner som visar en ny ledtråd hos alla en stund. Går att trycka bort. Inte samma sak som statusraden, som står kvar. | `InfoBox` |
| Huvudhandling | Skärmens viktigaste knapp. Ligger underst, närmast tummen. | `actions` i `ScreenLayout` |
| Hög med papper | Flera papper ovanpå varandra, som urklippen eller gästbokens sidor. Spelaren bläddrar med svajp eller pilar. | `PaperStack`, `Paper` |
| Dokument | Ett papper som alla ser, som huvudartikeln. Inte samma sak som uppgiftstypen Dokumentet. | `MissionDocument`, `documents` |
| Nedräkning | Gruppens gemensamma tid, som visas uppe till höger. Spelet fortsätter när den är slut, men slutet blir sämre. | `Countdown`, `clock` |
| Pausat | Spelledaren har pausat spelet, och nedräkningen står still. | `isPaused` |
| Rundbild | En bild av hela rummet runt spelaren, som hon ser sig omkring i genom att vrida mobilen. | `RoundImageView` |
| Visaren | Koden som visar en rundbild, med en bred bild som reserv. Kallas också rundvisaren. | `roundImageViewer.ts` |
| Mätrutan | Rutan som visas med `?matt` i adressen och mäter avståndet till Safaris verktygsfält. | `ViewportProbe` |

## Spelledarens verktyg

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Ledtråd | En av uppgiftens tre hjälptexter i stigande tydlighet. Spelledaren ger dem en i taget med Ge ledtråd, servern väljer vilken, och alla ser dem en stund i en ruta. Före dem kan det komma att en sak finns i huset, om ingen har hittat den. | `hints`, `findHint`, `giveHint` |
| Facit | Uppgiftens rätta svar. Ligger på servern och visas bara för spelledaren när hon ber om det. | `solution`, `showSolution` |
| Hoppa över | Spelledaren går förbi en uppgift som har låst sig. I urklippen räknas alla som lästa och Rummen minns hoppas över med ett tryck. | `nextStep`, `skipReading` |
| Stegets text | Texten som beskriver steget. Syns i berättartexter och utanför huset, men inte i en sak i fullskärm och inte i spelledarens meny. | `step.text` |

## Den femte gästen

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Seansen | Uppgiften vid ouijabrädet där alla följer skenet och läser ett meddelande. | `seance` |
| Ouijabrädet | Brädet med bokstäverna A till Ö. Kallas också brädet. | `SeanceBoard` |
| Planchetten | Det som varje spelare håller fingret på och följer skenet med. | `planchette` |
| Skenet | Ljuset som glider mot nästa bokstav. Rör sig bara medan allas planchetter följer. | `glow` |
| Meddelandet | Det skenet bokstaverar, som HJÄLP MIG eller VEM ÄR JAG. | `solution.message` |
| Tidningsurklippen | Urklippen i byrån. Varje spelare har bara några av dem. | scen med `documents` och bitar |
| Gästboken | Boken i hallen med namn grupperade per datum. | `pages` |
| Golvuret | Klockan i salongen. Ställs visarna på 22.15 minns huset. | `GrandfatherClock`, `turnClock` |
| Pendeln | Pendeln bakom glasluckan i golvuret. Ett villospår som inte påverkar spelet. | `Pendulum` |
| Rummen minns | Uppgiften där huset minns 1962 och varje spelare väljer ett rum att se. | `flashback` |
| Minnet | Huset som det var 1962: sepiatonat, med dörrarna stängda. Bleknar efter några minuter. | `FlashbackScreen`, `remembersUntilMs` |
| Nu | Huset som det är i kväll, med det gruppen har hittat. | |
| Pianot | Uppgiften där gruppen spelar melodin tillsammans med fyra tangenter var. | `piano`, `PianoTask` |
| Melodin | De sju tonerna som gruppen ska spela. Spelas högt från en spelares mobil. | `solution.melody`, `hasMelody` |
| Vera minns | Uppgiften där en spelare knackar Veras svar på en stängd dörr. | |
| Källaren | Uppgiften där den instängda letar efter den dolda dörren med ficklampan, och de andra lotsar henne. | `cellar`, `CellarTask` |
| Säkringarna | Proppskåpets tre säkringar, som tänder källarlampan en kort stund. | `fuses`, `flipFuse` |

## Tekniken

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Servern | Supabase och serverfunktionen. Äger spelets tillstånd, rollerna och facit. | |
| Serverfunktionen | Edge Function i Supabase som tar emot allt mobilen gör. | `game`, `index.ts` |
| Tillstånd | Spelets hela läge, sparat som ett JSON-värde på servern. | `GameState` |
| Handling | Något en mobil ber servern om, som att gå genom en dörr eller slå an en tangent. | `Action` |
| Vägran | Serverns nej till en handling, med ett skäl. | `Refusal`, till exempel `GameRefusal` |
| Vy från servern | Det en spelare får från servern, som mobilen bygger hennes skärm av. Innehåller bara det hon ska se. | `PlayerView`, `GameView` |
| Läckkontroll | Testet som spelar uppdragen och letar efter facit och andras bitar i varje vy från servern. | `leakCheck.test.ts` |
| Kanal | En realtidskanal i Supabase. Varje spelare har sin egen, och spelet och gruppen har var sin. | `player:<id>`, `game:<id>`, `group:<id>` |
| Livstecken | Anropet var tionde sekund som säger att mobilen är med och hämtar missade vyer. | |
| Serverns tid | Tiden som avgör samtidighet. Mobilerna räknar med sin skillnad mot den. | `serverClock`, `clockOffsetMs` |
| Mobilfunktion | Kamera, rörelse, ljud och liknande. En modul per funktion, med tillstånd och reserv. | `src/device/`, `src/sound/` |
| Tillstånd för ljud och rörelse | iPhone kräver ett tryck. Det begärs i en scen innan det behövs. | `asksFor` |

## Namn som är bestämda

Jonas tog ställning till de här namnen den 18 november 2026.

1. **Textvy och rumsvy** i stället för textläget och rundbildsläget. Rumsvyn
   heter `RoomView` i koden. Textvyn är borttagen (Jonas 2026-11-20).
2. **Sak och sakvy.** Sak används överallt, också i stället för föremål om
   det man undersöker i en rundbild. Det som öppnas heter sakvy. Koden heter
   redan `HouseThing` och `ThingScreen`.
3. **Fullskärm**, inte helskärm.
4. **Berättartext** för texten i fullskärm som visas en gång, och
   **berättelsen** för helheten. I koden heter den `narration`.
5. **Vy** behåller båda betydelserna. Det servern skickar är det spelaren
   ser, så det behöver inget eget namn.
6. **Hittat** finns inte längre som lista eller knapp. Namnen `found` och
   `foundTitle` ligger kvar i koden, eftersom urklippen i byrån går att läsa
   igen genom dem.
7. **Rummen minns** heter `flashback` i koden i stället för `rooms`, så att
   den inte blandas ihop med husets rum. Namnet memory valdes bort, eftersom
   det låter som datorns minne. Också fälten heter så, som `flashbackMinutes`,
   och handlingarna `chooseFlashbackRoom` och `fadeFlashback`. På svenska
   heter det fortfarande minnet.
