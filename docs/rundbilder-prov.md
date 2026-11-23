# Rundbilder med Gemini: prov

Anteckningar från provet av rundbilder, som konceptet tar upp under Rundbilder.
Bilderna ligger i `public/testsida/rundbilder/` och visas i kortet Rundbild på
testsidan.

## Så togs bilden fram

- Modell: `gemini-nano-banana-2.1`, via `POST /v1/interactions`.
- Format: `response_format` med `aspect_ratio` 16:9 och `image_size` 2K. Det
  gav 2752×1536 bildpunkter.
- API:et tar inte formatet 2:1. Tillåtna värden är 1:1, 2:3, 3:2, 3:4, 4:3,
  4:5, 5:4, 9:16, 16:9, 21:9, 1:8, 8:1, 1:4 och 4:1. Bilden trycks därför ihop
  i höjdled till 2752×1376 efteråt och sparas som WebP.
- Ett anrop kostade 2 753 tokens, varav 1 680 för bilden.

Prompten till källaren:

> A seamless 360-degree equirectangular panorama (full sphere: 360 degrees horizontally, 180 degrees vertically) of the cellar of an old Swedish house from the early 1900s, seen from the middle of the room at eye height. Hand-painted storybook illustration style with visible brush texture, muted palette of deep blue-green shadows and warm amber light, slightly spooky but friendly, suitable for ten-year-olds. No blood, no people, no monsters, no text. Contents: rough stone walls, a brick vaulted ceiling with wooden beams, an earthen floor with worn flagstones, a steep wooden staircase up to a closed door with light leaking under it, shelves with dusty jam jars, an old wooden trunk, a stack of firewood, a cobwebbed oil lantern glowing on a barrel, a small high window with moonlight, an old rocking chair. Correct equirectangular projection: the horizon is a straight horizontal line at the exact vertical middle, the ceiling stretches across the whole top edge and the floor across the whole bottom edge, vertical lines stay vertical. The left and right edges must match perfectly so the image wraps around without a visible seam.

## Resultat, källaren (en bild)

Bedömt i visaren i Chromium på dator. Riktiga mobiler återstår.

| Fråga | Resultat |
| --- | --- |
| Syns skarven? | Nej. Hyllan, väggen och gungstolen fortsätter över skarven utan synlig kant. |
| Förvrängs golv och tak? | Ja, nära rakt upp och rakt ner. Upp till ungefär 30 grader från horisonten ser rummet rätt ut. Vid 60 grader böjer sig valv och bjälkar, och rakt upp och rakt ner dras bilden ihop till en punkt. |
| Får flera rum samma stil? | Inte prövat än. Det kräver en bild till. |

Bilden är alltså inte en riktig equirektangulär projektion, men den ligger
tillräckligt nära för blickar runt horisonten. Två sätt att leva med det är att
begränsa hur långt upp och ner spelaren kan titta, eller att låta mörker och
ficklampa dölja tak och golv.

## Större rum och zoom

Den första källaren upplevdes som liten. En andra bild, `kallare-stor.webp`,
togs fram med samma prompt och ett tillägg om rummets storlek: ungefär åtta
gånger tio meter, minst fyra meter till varje vägg, öppet golv runt
betraktaren och föremålen längs väggarna. Rummets storlek går alltså att styra
med prompten. Skarven syns inte i den bilden heller, och stilen blev lik den
första utan att den första bilden skickades med som referens.

Rundvisaren zoomar med två fingrar, mellan 30 och 110 graders synfält i
höjdled. Fullt inzoomad blir bilden suddig, eftersom 2752 bildpunkter på ett
varv bara är knappt åtta bildpunkter per grad.

## Se sig omkring genom att vrida mobilen

Rundvisaren kan följa mobilens rörelse, så att mobilen blir ett fönster in i
rummet. Blicken räknas ut från mobilens läge (`orientationToLook` i
`src/view/lookDirection.ts`). Fingret och knapparna vrider då rummet i
förhållande till mobilen, och fingret är reserven när sensorn saknas eller
nekas. Visaren räknar med att mobilen hålls stående. Liggande mobil är inte
hanterad.

## Perspektiv och yrsel

En vuxen blev lite yr av att se sig omkring i rummet, barnen blev det inte.
Kortet har därför tre saker att prova, och valet hamnar i resultattexten:

- Synfältet, som ändras med zoomen. Ett snävare synfält rör bilden lugnare.
- Mjukt perspektiv (stereografiskt), som inte drar ut kanterna vid brett
  synfält men böjer raka linjer.
- Håll rummet vågrätt, som låter rummet stå still när mobilen lutas i sidled.
  Utan det lutar rummet med mobilen.

Ägaren valde Håll rummet vågrätt och mjukt perspektiv efter prov på riktig
mobil, så båda är påslagna från början.

Visaren har ingen rumsstorlek. Betraktaren står i mitten av ett klot, så hur
stort rummet känns avgörs bara av vad som är målat i bilden. De två
provbilderna med rutnät visar det: samma kub med 8 respektive 16 rutor per
sida, där den med fler och mindre rutor läses som ett dubbelt så stort rum.

En tredje källare, `kallare-storst.webp`, togs fram med rummet beskrivet som
sexton gånger tjugo meter och minst åtta meter till varje vägg. Rummet blev
tydligt större, med pelare och valv och små föremål längs väggarna. Längst ner
i bilden, rakt under betraktaren, målade Gemini ett band som ser ut som böjda
plankor i stället för golv. Det syns bara när man tittar brant nedåt.
Ägaren såg också att skarven syns i taket i den här bilden. Felen sitter
alltså där projektionen är som svårast, rakt upp och rakt ner.

## Slutsats

Rundbilderna håller för blickar runt horisonten. Provbilderna är inte de
slutliga: bilderna till det första uppdraget tas fram på nytt, och ägaren vill
att de då blir läskigare. Uppdraget är numera från 16 år, och provbilderna
togs fram med en text som bad om bilder för tioåringar. Räkna med att en bild ibland behöver göras om.

## Hallen i fyra stilar

Källarbilderna var för gulliga för ett hus som har stått orört sedan 1962.
Hallen togs därför fram i fyra stilar, så att ägaren kan välja. Bilderna ligger
i `public/testsida/rundbilder/hallen-*.webp` och går att välja i kortet
Rundbild på testsidan.

- Modell och anrop som för källaren, men med `image_size` 4K. Det gav
  5504×3072 bildpunkter, som skalas om till 4096×2048. Det ger drygt elva
  bildpunkter per grad, mot knappt åtta för källaren, och 4096 är den största
  bredd som alla mobiler säkert klarar i visaren. Ett anrop kostade cirka
  6 300 tokens, varav 3 780 för bilden.
- Bildens mitt är hallens bortre vägg. Ytterdörren sitter mitt på väggen bakom
  betraktaren och hamnar alltså i skarven. Gemini ritade ändå en hel dörr över
  skarven i alla fyra bilderna, utan synlig kant.
- Dörrarna hamnade på rätt väggar: pianot och dörrarna till salongen och köket
  på den bortre väggen, källardörren längst ner på högra väggen och
  sovrumsdörren på vänstra. Var på väggen de sitter varierar, så de tryckbara
  dörrarna får placeras efter bilden, som konceptet säger.
- Den första 60-talsbilden såg ut som ett vanligt foto i dagsljus. Först när
  prompten beskrev färgstick, blixt och korn tydligt blev den gammal.

Prompten består av en stilrad och en gemensam beskrivning av hallen:

> A seamless 360-degree equirectangular panorama (full sphere: 360 degrees horizontally, 180 degrees vertically) of the entrance hall of an old Swedish wooden villa from around 1900 that has stood abandoned and untouched since 1962. Style: a realistic photograph taken late at night inside the dark house. There is no daylight at all. The only light is pale blue moonlight through the glass panes of the front door and a faint warm glow from somewhere out of sight; the corners, the ceiling and the far ends of the walls sink into near-black shadow, and objects are only just readable. Underexposed, high ISO grain, muted cold colours. It feels neglected, cold, damp and quietly threatening, like somewhere you should not be. Unsettling, not cosy, not cute, not theatrical.
>
> Contents and layout. The hall is a square room, about five by five metres, ceiling about three metres high. The viewer stands in the exact middle of the room at eye height. The centre of the image faces the back wall; the left quarter and right quarter of the image show the side walls; the far left and far right edges show the front wall behind the viewer.
>
> - Back wall (centre of the image): an old upright piano stands against the left half of the back wall, lid closed, thick with dust. At the right end of the back wall are two closed wooden panel doors side by side: the first leads to the parlour, and the second, immediately to its right, sits right in the corner and leads to the kitchen.
> - Right wall: a long bare wall with peeling wallpaper. At its far end, near the corner with the front wall, a heavy, dark, locked wooden door to the cellar, with a large iron lock and keyhole. There is no other door on the right wall.
> - Left wall: a small hall table halfway along the wall with a thick old guest book lying closed on it, and a tarnished, spotted mirror above it. At the far end of the left wall, near the corner with the front wall, a closed wooden door to a bedroom.
> - Front wall (behind the viewer, split between the far left and far right edges of the image): the closed wooden front door in the middle of the wall, with a small dirty glass pane, and old coats hanging stiff on hooks beside it.
> - No staircase anywhere in the hall. Only these five doors.
> - Wooden floorboards, scuffed and grey with dust, a worn rug with a faded pattern, dust sheets nowhere. Cobwebs in the corners and on the dead ceiling lamp. Wallpaper with a faded 1950s pattern, stained by damp, peeling in strips. Dead leaves blown in under the front door. Nobody has been here since 1962.
>
> Correct equirectangular projection: the horizon is a straight horizontal line at the exact vertical middle, the ceiling stretches across the whole top edge and the floor across the whole bottom edge, vertical lines stay vertical. The left and right edges must match perfectly so the image wraps around without a visible seam. No people, no ghosts, no monsters, no blood, no text, no letters, no clocks.

De andra stilraderna:

- Målning: *dark atmospheric painted concept art for a serious horror game, realistic proportions and textures, desaturated palette of cold grey-green and dirty ochre, deep black shadows, a thin cold moonbeam through the front door pane picking out dust hanging in the air. Grim, oppressive and eerie, not cartoonish, not storybook, not cute.*
- 60-talsfoto: *it must look like an old colour photograph from the 1960s that has faded for sixty years, not like a modern photo. Strong overall orange-red and magenta colour cast, the blues and cyans almost gone, low contrast with milky shadows, blown-out highlights, coarse film grain, a few scratches and dust specks. Taken at night with a harsh flashbulb from the viewer's position, so the near floor and nearby objects are flat and glaring while the far corners fall off into murky darkness. It feels like an old police photo of a place where something went wrong.*
- Foto i dagsljus: som natten, men med *cold, weak moonlight falling through the glass pane of the front door and a dim grey glow*. Gemini gjorde ändå dagsljus av det.

## Hallen som illustration, med matta i stället för plankor

Ägaren valde stilen i nattbilden, men som illustration i stället för foto
(Jonas 2026-11-20). I nattbilden blev golvplankorna böjda nära skarven när man
tittar nedåt. Betraktaren stod redan i mitten av rummet. Felet är att Gemini
ritar plankorna som raka linjer i bilden, och raka linjer i en equirektangulär
bild blir böjda nära rakt ner. Det är samma fel som i taket på den största
källaren.

Lösningen är att inte ge golvet några raka linjer. Raden om golvet byttes mot:

> The floor: almost the whole floor is covered by one large, dark, threadbare rug, wall to wall, with only a soft, blotchy, worn pattern and grey dust; no floorboards, no tiles, no straight lines or stripes on the floor anywhere. The floor right under the viewer lies in deep shadow.

Tre illustrationsstilar provades med samma nattljus. Golvet ser rätt ut i alla
tre när man tittar nedåt. En smal remsa plankor syns fortfarande längs
väggarna, men den ligger nära horisonten där bilden håller.

- Målad illustration (`hallen-malad.webp`): *a hand-painted illustration, not a photograph: a dark, serious digital painting with visible brush strokes and painterly textures, realistic proportions, like the illustrations in an adult gothic horror novel.*
- Tusch (`hallen-tusch.webp`): *an illustration, not a photograph: ink line drawing with heavy black ink shadows and cross-hatching, coloured with muted, dirty watercolour washes, like a dark graphic novel for adults.*
- Gouache, bortvald: *matte gouache painting with flat, softly graded shapes and a limited palette…* Rockarna hängde på själva ytterdörren och dörren bröts av vid skarven.

## Tuschhallen med mindre matta, och hallen i minnet

Ägaren valde tuschillustrationen och ville ha en mindre matta (Jonas
2026-11-20). Hallen i minnet togs fram före resten av rummen, för att se om
känslan håller (Jonas 2026-11-20).

- **Redigering i stället för ny bild.** Båda bilderna togs fram genom att
  skicka tuschbilden med i anropet och be Gemini ändra den. Då ligger dörrar,
  piano och bord kvar på samma ställen, så de tryckbara ytorna kan bli
  desamma i nuet och i minnet. Bilden skickas i ett steg av typen
  `user_input` med en text och en bild. API-versionen v1 tar inte en bild
  direkt i `input`.
- **Mindre matta.** Första försöket lade mattan framför betraktaren, och då
  syntes plankorna rakt nedåt igen. Det fungerade när prompten sa att mattan
  ligger under betraktarens fötter och fyller hela bildens nederkant, med en
  remsa plankor mellan mattans kant och väggarna.
- **Minnet.** Samma hall en lördagskväll i oktober 1962: hel tapet, tänd
  lampa, mörker utanför. Kvinnan i röd sjal står vid ytterdörren, kvinnan med
  pärlhalsband sitter vid pianot med noterna uppslagna, gästboken ligger
  uppslagen och väggklockan står på kvart över nio. Bilden är i färg. Spelet
  gör den sepiatonad, kornig och flimrande.
- **Det Gemini inte klarade.** Kännetecknen hamnade fel: först syntes inte
  pärlorna, sedan bar båda kvinnorna pärlor, sedan ingen. Det krävdes fyra
  redigeringar. Klockan klarade Gemini inte alls. Siffrorna blev fel och
  visarna visade nio eller kvart i tolv. Till sist fick urtavlan streck i
  stället för siffror, och en överflödig visare målades bort för hand i
  efterhand, så att klockan visar kvart över nio. Ansiktena blir lite
  grövre för varje redigering.

## En gäst per rum, utan klockor, och hallen som foto igen

Salongen blev ett fjärde rum i minnet, med en gäst i varje rum. Kvinnan i röd
sjal spelar piano i hallen. Klockorna togs bort ur alla rum utom salongen,
eftersom Gemini inte kan rita klockor, och hallen fick en hallsoffa mellan
köksdörren och källardörren (Jonas 2026-11-20). Ägaren ville också pröva
fotot igen, med mattan som i tuschbilden (Jonas 2026-11-20).

- **Tusch.** Hallsoffan lades till genom att redigera tuschbilden. Minnet
  togs fram genom att redigera den nya tuschbilden, så att allt ligger på
  samma ställen. Det gick på första försöket.
- **Foto.** Tre försök med bara text, med samma prompt som nattbilden och
  mattan beskriven som i tuschbilden, gav fel dörrar: källardörren på bortre
  väggen, en dörr för mycket eller sovrumsdörren vid fel hörn. I stället fick
  Gemini tuschbilden och prompten att göra den till ett nattfoto av samma rum.
  Då hamnade allt rätt. Fotot av minnet är en redigering av det fotot.
- Kvinnan vid pianot ser äldre ut än en ung gäst i fotot av minnet.
- Testsidan visar bara de fyra hallbilderna och de två rutnäten (Jonas
  2026-11-20). Stilproven och källarbilderna finns kvar i git-historiken.
  `kallare-stor.webp` ligger kvar, eftersom den vilande källaruppgiften
  använder den.

## Mitt i rummet, och 1962 före i dag

Ägaren såg att betraktaren stod nära ytterdörren i stället för mitt i rummet,
och att skavanker från dagens bild syntes i bilden från 1962 (Jonas
2026-11-20). Hallen togs därför fram på nytt i omvänd ordning.

- **Mitt i rummet.** Text räckte inte. Med en prompt som angav var hörnen
  ska ligga ritade Gemini konstiga utstickande hörn. I stället ritar
  `tools/rundbildsmall.py` rummet som en låda i rätt projektion, med färgade
  ytor för dörrar, möbler och matta. Gemini får mallen och en lista över vad
  varje färg är. Ett av två försök följde mallen. Det andra struntade i den.
- **Rättningar.** Gemini tog några färger bokstavligt: ytterdörren blev blå,
  väggen vid den grön och pianopallen fick en egen röd matta. En redigering
  rättade det. En till tog bort en dörr för mycket i hörnet vid köket.
- **I dag från 1962.** Tuschbilden från i dag är en redigering av 1962-bilden:
  ingen vid pianot, pallen kvar, damm, fuktfläckar, spindelväv, dött ljus och
  månsken. Fotot från 1962 är tuschbilden från 1962 gjord till foto. Fotot
  från i dag gjordes först från fotot från 1962, men då fick sovrumsdörren
  och salongsdörren glasrutor. Det gjordes i stället från tuschbilden från i
  dag, och då blev dörrarna rätt.
- Skarven syns inte i någon av de fyra bilderna, och plankorna är raka när
  man tittar nedåt.

## Fyra hörn med en skuggad mall, och bara foto

Ägaren såg att alla fyra bilderna ovan har ett falskt hörn mitt på
sidoväggarna, så att rummet ser ut att ha sex hörn (Jonas 2026-11-20).
Gissningen är att Gemini läser väggarnas bågar i rundbilden som hörn, eftersom
en sådan knyck nästan alltid är ett hörn i vanliga foton.

- **Vägg för vägg valdes bort.** Varje vägg målad som en rak bild och
  ihopsatt till en rundbild gav raka väggar, men ägaren vill att Gemini gör
  hela bilden (Jonas 2026-11-20).
- **Skuggad mall.** `tools/rundbildsmall.py` ritar nu rummet som en grå låda
  med ljus från taklampan: väggarna är ljusast mitt för lampan och mörkast i
  hörnen, och hörnen är skarpa linjer. Prompten säger att bågarna är raka
  väggkanter och att rummet har exakt fyra hörn. Mallen ritas direkt i 16:9.
  Fyra försök av fyra, två i tusch och två foton, fick exakt fyra hörn.
- **Två lägen.** En bild mitt i rummet och en en bit in från ytterdörren
  (`CZ=-1.3`). Ägaren väljer på testsidan.
- **Bara foto.** Tuschbilderna är borttagna, utom den första tuschbilden med den mindre mattan, som har rätt planlösning och ligger först på testsidan (Jonas 2026-11-20). Ytterdörren är
  en pardörr och källardörren en vanlig dörr med hänglås (Jonas 2026-11-20).
- **Rättningar.** Källardörren blev en tung mörk dörr och gjordes om med en
  redigering. Bilden från ingången fick en extra spegel, som togs bort. När
  mattan skulle flyttas in under betraktaren i bilden från mitten blev den
  tre ihopsydda mattor, så den redigeringen kastades. Där ligger mattan
  framför betraktaren, och plankorna under är ändå raka.
- **Mitt i rummet valdes** (Jonas 2026-11-20). Bilden från ingången är
  borttagen. Bilden från i dag är en redigering av fotot från 1962: ingen vid
  pianot, pallen kvar, locket stängt, damm, fuktfläckar, avflagnade tapeter,
  löv innanför pardörren, lampan släckt och månsken genom dörrens rutor. Ett
  försök räckte, och hörnen, dörrarna och skarven blev rätt.
- **Modernare tecknat.** Ägaren gillar tuschbilden och bad om ett förslag
  som är modernare tecknat (Jonas 2026-11-20). Fotot från i dag gjordes om
  till två tecknade stilar, med tuschbilden som förebild bara för
  stämningen: rena konturer med platta färgytor och skarpa skuggor, och en
  målad variant med penseldrag över tuschlinjer och kallt månsken. Båda
  behöll rummet. I den målade blev källardörren åter en tung dörr med
  järnbeslag.

## Målad stil, kvadratisk matta

Ägaren valde den målade tecknade stilen och pausade fotona (Jonas
2026-11-20). Mattan blev kvadratisk mitt i rummet, med sidan lika lång som
den gamla mattans längd, ungefär tre meter. Två tavlor hänger över soffan,
och 1962 står det fem par skor vid ytterdörren.

- **1962.** Att redigera fotot till målning med en större matta gick inte:
  Gemini lät mattan ligga kvar. I stället gjordes bilden från mallen, med
  fotot som förebild för hur saker ser ut och den målade bilden som förebild
  för stilen. Då hamnade mattan mitt under betraktaren. Två försök gjordes,
  och det ena följde mallen. En redigering minskade skorna till fem par och
  gjorde källardörren till en vanlig dörr med hänglås igen.
- **I dag.** Med den gamla målade bilden som förebild för förfallet tog Gemini
  även dess lilla matta och tunga källardörr. Utan förebild, bara med
  beskrivningen av förfallet, behölls rummet.
- Rena konturer är borttagen från testsidan, liksom det första målade
  förslaget.
- **Justeringar** (Jonas 2026-11-20). Spegeln 1962 visade en lampa som inte
  finns på väggen mittemot och visar nu bara tapeten. I dag är gästernas
  kläder och skor borta, eftersom de tog dem när de flydde. Kvar hänger en
  sliten gammal rock och ett trasigt paraply. Rödbruna fläckar på ytterdörren
  togs bort.
- **Minnet borta från testsidan** (Jonas 2026-11-20). Bilderna från 1962
  togs bort från testsidan, och filerna också, så att de inte avslöjar något
  för den som provar testsidan. De finns kvar i git-historiken
  (`hallen-malad-1962.webp` och `hallen-foto-1962.webp`) och läggs tillbaka
  när minnet får bilder i spelet.

## Salongen

Ägaren bad om salongen efter hallen (Jonas 2026-11-20). `tools/rundbildsmall.py`
har nu ett rum per funktion och ritar salongen med `salongen` som andra
argument och `CZ=-1.0`, eftersom bordet med ouijabrädet står mitt i rummet.

- **1962** gjordes från mallen med den målade hallen som förebild för stilen.
  Två försök gjordes. Det andra fick en extra dörr på väggen mot hallen. Det
  första följde mallen.
- **Golvuret.** Gemini ritade först fem, sedan nio. Med en tom urtavla utan
  siffror och en beskrivning av varje visare blev det ungefär kvart över nio,
  men timvisaren står lite för högt. Pärlorna gjordes vita i samma omgång.
- **I dag** är en redigering av 1962-bilden. Golvuret står på tolv, så att
  den som har läst urklippet ser att något inte stämmer.
- Bara bilden från i dag ligger på testsidan, så att minnet inte avslöjas.
- **Tiden blev kvart över tio** (Jonas 2026-11-20). Ägaren läste golvuret i
  salongen 1962 som kvart över tio, så tiden i spelet flyttades en timme i
  stället för att göra om bilden.

## Köket och sovrummet

Ägaren bad om de två sista rummen utom källaren (Jonas 2026-11-20). Mallen
har funktionerna `koket` och `sovrummet`, med betraktaren mitt i rummet.

- **1962** gjordes från mallen med den målade hallen från 1962 som förebild
  för stilen, ett försök per rum. Båda följde mallen. I köket hamnade
  proppskåpet på högra väggen vid spisen i stället för på väggen bakom.
- **I dag** är redigeringar av 1962-bilderna. I köket blev en rostrand i
  diskhon blodröd och togs bort med en redigering till.
- **Salongen.** En extra dörr på högra väggen, nära hörnet mot hallen, togs
  bort i båda bilderna.
- **Rättningar 1962** (Jonas 2026-11-20). Mannen i köket häller nu kaffe i en
  kopp, och den extra kannan på spisen är borta. Mannen i sovrummet röker
  pipa och ser sig om i rummet, eftersom det inte syntes att han stoppade
  den. Minnestexten ändrades på samma sätt.
- **Kaffestrålen och låset** (Jonas 2026-11-20). Strålen såg ut att rinna
  utanför koppen, så den togs bort och pipen hålls nu över koppen. Dörren i
  sovrummet hade lås och fick ett vanligt dörrhandtag, i båda bilderna.

## Minnet i spelet

Rundbilderna från 1962 visas nu i Rummen minns (Jonas 2026-11-23) och ligger i
`public/uppdrag/den-femte-gasten/minnet/`. Hallen kommer ur git-historiken,
köket och sovrummet ur projektfilerna i 4K. Salongen 1962 finns bara i
1376×768 och är uppskalad till 2752×1376, så den är mjukare än de andra.
- **Skarp salong och pärlhalsband** (Jonas 2026-11-23). Salongen 1962 togs
  fram på nytt i 4K från den uppskalade bilden, med ett anrop. Ett anrop till
  bytte kvinnans korta halsband mot ett långt pärlhalsband över tröjan.
  Originalen ligger i projektfilerna under `granskning/salongen-1962-skarp/`.
- **Mouche** (Jonas 2026-11-23). Kvinnan med röd sjal har en mouche på högra
  kinden, i hallen 1962 och på tavlan i köket, så att man ser att det är samma
  flicka. Den är målad med vanlig bildbehandling, utan Gemini.
