# Rundbilder med Gemini: prov

Anteckningar från provet av rundbilder, som konceptet tar upp under Rundbilder.
Bilderna ligger i `web/testsida/rundbilder/` och visas i kortet Rundbild på
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
`web/view/lookDirection.js`). Fingret och knapparna vrider då rummet i
förhållande till mobilen, och fingret är reserven när sensorn saknas eller
nekas. Visaren räknar med att mobilen hålls stående. Liggande mobil är inte
hanterad.
