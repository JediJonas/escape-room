# Ordlista

Nov 18, 2026

Ordlistan förklarar de begrepp som används i konceptet, i `docs/motorn.md` och
i koden. Varje begrepp har en kort förklaring och, där det finns, namnet i
koden. Den förklarar orden, inte reglerna: hur något fungerar står i
`docs/koncept.md`.

Ord som skiljer sig mellan konceptet och koden, eller som används på två sätt,
står sist under Förslag att ta ställning till. Där är inget ändrat än.

## Spelet och uppdraget

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Spel | En spelkväll: en grupp som spelar ett uppdrag tillsammans, från väntrummet till slutet. | `games`, `GameState` |
| Uppdrag | Ett helt äventyr med egen berättelse, som Den femte gästen. Ett uppdrag är innehåll, inte kod. | `Mission` |
| Uppdragsfil | Filen som beskriver ett uppdrag: steg, roller, texter, hus, ledtrådar och facit. Bara serverfunktionen läser den. | `missions/*.json` |
| Provhuset | Ett litet provuppdrag som bara används för att prova motorn. | `missions/prov.json` |
| Motor | Koden som är lika för alla uppdrag: spelets tillstånd, roller, tid, huset och uppgiftstyperna. | `supabase/functions/game/` |
| Steg | En post i uppdragets ordning. Ett steg är antingen en scen eller en uppgift. Spelarna ser till exempel steg 3 av 12. | `MissionStep`, `stepIndex` |
| Scen | Ett steg med berättelse mellan uppgifterna. Spelarna läser och trycker Klar, eller blir klara av att lämna en sak. | `SceneStep`, `type: 'scene'` |
| Uppgift | Ett steg där gruppen ska klara något, som Seansen eller Pianot. Har ledtrådar och facit. | `TaskStep` |
| Uppgiftstyp | En sorts uppgift som byggs en gång i motorn och fylls med innehåll i olika uppdrag, som Samtidigt eller Orkestern. I koden har varje typ ett eget namn. | `type`: `seance`, `rooms`, `piano`, `cellar`, `answer` |
| Akt | En av uppdragets tre delar: Kroken, Upptäckterna och Finalen. | |
| Berättelsen | Det som händer i uppdraget, som spelarna avslöjar själva genom det de hittar. | |
| Sann bakgrund | Det som verkligen hände, som bara systemet känner till. Spelarna får veta det bit för bit. | |
| Vändningen | Den överraskning i berättelsen som en enskild spelare upptäcker på sin egen skärm och berättar för de andra. | |
| Följd | Det ett misslyckande kostar: tid, eller en markering som senare steg och slut läser. | `wrongAnswerMinutes`, `marks` |
| Slut | Ett av uppdragets avslutningar. Gruppens val och prestation avgör vilket. Inte byggt än. | |
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
| Dörr | En väg från ett rum till ett annat. I Den femte gästen går alla dörrar via hallen. | `doors`, `walk` |
| Sak | Något i ett rum som går att trycka på, som ouijabrädet, golvuret, byrån eller tavlan. Öppnar alltid en sakvy. | `HouseThing`, `ThingView` |
| Hitta | En sak syns i rummets lista först när någon har hittat den. Det räcker att en spelare gör det. | `foundThings`, `searchRoom` |
| Leta i rummet | Knappen som hittar det berättelsen har kommit till, tills rundbilderna finns. | `searchRoom` |
| Kallar | En sak drar till sig gruppen: den skimrar i rummets lista, och i de andra rummen visas en berättartext. | `callsFromHouse`, `isCalling`, `callingText` |
| Instrument | Golvuret och pianot, som går att använda hela tiden och inte bara när berättelsen har kommit dit. | `Instrument`, `instrument` |
| Instängd | En spelare som isoleras med en egen vy, som i källaren. | `trapped` |
| Utelåst | En spelare som stängs ute från det de andra gör. Bara i konceptet än. | |

## Skärmarna

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Textläget | Rummet som en lista: var spelaren är, det som har hittats där och dörrarna. Jonas föreslår namnet textvy. | `RoomList` i `HouseView.tsx` |
| Rundbildsläget | Rummet som en rundbild, där spelaren trycker på saker och dörrar i bilden. Inte byggt i spelet än. Jonas föreslår namnet rumsvy. | |
| Sakvy | Det som öppnas när spelaren trycker på en sak: saken i fullskärm, utan rubrik och text, med klockan och Tillbaka överst. Jonas föreslår namnet objektvy. | `ThingScreen` |
| Berättartext | En text i fullskärm som dyker upp av sig själv, visas en gång och bekräftas med Fortsätt eller Ok. | `story`, `melodyText`, `callingFrom` |
| Fullskärm | En vy som fyller skärmen. Bakgrunden går kant i kant, men innehållet har en största bredd och höjd. | `ThingScreen` |
| Tillbaka | Knappen uppe till höger som tar spelaren ut ur en sakvy till det läge hon kom från. Alla har den. | `leaveThing` |
| Meny | Spelledarens hamburgare i nedre högra hörnet. Spelarna har ingen meny, utom den instängda i källaren. | `LeaderMenu` |
| Inforuta | Rutan längst ner som visar en ny ledtråd hos alla en stund. Går att trycka bort. | `InfoBox` |
| Huvudhandling | Skärmens viktigaste knapp. Ligger underst, närmast tummen. | `actions` i `ScreenLayout` |
| Hög med papper | Flera papper ovanpå varandra, som urklippen eller gästbokens sidor. Spelaren bläddrar med svajp eller pilar. | `PaperStack`, `Paper` |
| Dokument | Ett papper som alla ser, som huvudartikeln. Inte samma sak som uppgiftstypen Dokumentet. | `MissionDocument`, `documents` |
| Nedräkning | Gruppens gemensamma tid, som visas överst. Spelet fortsätter när den är slut, men slutet blir sämre. | `Countdown`, `clock` |
| Pausat | Spelledaren har pausat spelet, och nedräkningen står still. | `isPaused` |
| Rundbild | En bild av hela rummet runt spelaren, som hon ser sig omkring i genom att vrida mobilen. | `RoundImageView` |
| Visaren | Koden som visar en rundbild, med en bred bild som reserv. Kallas också rundvisaren. | `roundImageViewer.ts` |
| Mätrutan | Rutan som visas med `?matt` i adressen och mäter avståndet till Safaris verktygsfält. | `ViewportProbe` |

## Spelledarens verktyg

| Begrepp | Betydelse | I koden |
| --- | --- | --- |
| Ledtråd | En av uppgiftens tre hjälptexter i stigande tydlighet. Spelledaren ger dem en i taget, och alla ser dem. | `hints`, `giveHint` |
| Facit | Uppgiftens rätta svar. Ligger på servern och visas bara för spelledaren när hon ber om det. | `solution`, `showSolution` |
| Hoppa över | Spelledaren går förbi en uppgift som har låst sig. | `nextStep` |
| Alla är klara | Spelledaren låter gruppen gå vidare i en scen när någon har gått iväg. | `nextStep`, `canLeaderSkip` |
| Stegets text | Texten som beskriver steget. Syns överst i spelledarens meny vid saken, men inte hos spelarna. | `step.text`, `stepText` |
| Klara: 2 av 3 | Raden som bara spelledaren ser, med vilka som är klara. | `progress` |

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
| Golvuret | Klockan i salongen. Ställs visarna på 21.15 minns huset. | `GrandfatherClock`, `turnClock` |
| Pendeln | Pendeln bakom glasluckan i golvuret. Ett villospår som inte påverkar spelet. | `Pendulum` |
| Rummen minns | Uppgiften där huset minns 1962 och varje spelare väljer ett rum att se. | `rooms` |
| Minnet | Huset som det var 1962: sepiatonat, med dörrarna stängda. Bleknar efter några minuter. | `MemoryScreen`, `remembersUntilMs` |
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
| Spelarvy | Det en spelare får från servern: bara det hennes spelare ska se. | `PlayerView`, `GameView` |
| Läckkontroll | Testet som spelar uppdragen och letar efter facit och andras bitar i varje spelarvy. | `leakCheck.test.ts` |
| Kanal | En realtidskanal i Supabase. Varje spelare har sin egen, och spelet och gruppen har var sin. | `player:<id>`, `game:<id>`, `group:<id>` |
| Livstecken | Anropet var tionde sekund som säger att mobilen är med och hämtar missade vyer. | |
| Serverns tid | Tiden som avgör samtidighet. Mobilerna räknar med sin skillnad mot den. | `serverClock`, `clockOffsetMs` |
| Mobilfunktion | Kamera, rörelse, ljud och liknande. En modul per funktion, med tillstånd och reserv. | `src/device/`, `src/sound/` |
| Tillstånd för ljud och rörelse | iPhone kräver ett tryck. Det begärs i en scen innan det behövs. | `asksFor` |

## Förslag att ta ställning till

Här skiljer sig orden mellan konceptet, motorn och koden, eller betyder två
saker. Inget är ändrat. Varje förslag behöver ett beslut av Jonas innan
koden eller dokumenten döps om.

1. **Textläget och rundbildsläget, eller textvy och rumsvy.** Konceptet säger
   textläget och rundbildsläget. Jonas föreslår textvy och rumsvy, som passar
   knapparna Visa rummet och Dölj rummet. Förslag: textvy och rumsvy, så att
   alla skärmar heter något med vy. I koden blir det `TextView` för det som i
   dag heter `RoomList`, och `RoomView` när rundbildsläget byggs.
2. **Objektvy eller sakvy.** Konceptet och koden säger sak (`HouseThing`,
   `ThingScreen`), och konceptet säger också föremål om det man undersöker i
   rundbilden. Förslag: sak överallt, också i stället för föremål, och sakvy
   för det som öppnas. Koden behöver då inte döpas om.
3. **Helskärm eller fullskärm.** Konceptet använder båda. Förslag: fullskärm.
4. **Berättartext.** Konceptet säger också berättelsetexterna och
   berättelsen. Koden säger `story`. Förslag: berättartext för texten i
   fullskärm som visas en gång, berättelsen för helheten, och `narration` i
   koden i stället för `story`, så att det inte blandas ihop med `scene`.
5. **Vy på två sätt.** I konceptet är en vy en skärm som spelaren ser. I
   motorn är en vy också det servern skickar till en spelare. Förslag:
   spelarvy för det servern skickar, som `PlayerView` redan heter, och vy
   bara för skärmar.
6. **Hittat finns kvar i koden.** Konceptet säger att knappen Hittat är
   borttagen, men koden och motorn har kvar `found`, `foundTitle` och listan
   Hittat. Den används i dag för att läsa urklippen igen i byrån. Två
   kommentarer hänvisar till avsnittet Rundbilder och Hittat, som inte finns
   längre. Förslag: kalla det läsa igen, döpa om `foundTitle` till
   `rereadTitle` och uppdatera motorn och kommentarerna.
7. **Rummen minns heter `rooms` i koden.** Det blandas lätt ihop med husets
   rum (`HouseRoom`, `house.rooms`). Förslag: döpa om uppgiftstypen till
   `memory`.
