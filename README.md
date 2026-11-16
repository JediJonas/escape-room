# Escape room för mobiler

Ett partyspel i escape room-stil. Tre till tio personer i samma hem löser ett
uppdrag på cirka 60 minuter, var och en med sin mobil.

Konceptet finns i `docs/koncept.md`. Provet av rundbilder beskrivs i
`docs/rundbilder-prov.md`.

## Mappar

| Mapp | Innehåll |
| --- | --- |
| `docs/` | Konceptet och andra anteckningar |
| `web/` | Webbsidan som läggs ut på GitHub Pages |
| `web/testsida/` | Den tekniska testsidan (byggordning steg 1) |
| `web/device/` | En modul per mobilfunktion: rörelse och kamera |
| `web/sound/` | Ljud: ljudmotorn, vanligt ljud som reserv och toning |
| `web/sync/` | Kanalen mellan mobilerna och vilka som håller fingret på skärmen |
| `web/view/` | Visaren för rundbilder, med bred bild som reserv |
| `web/vendor/` | Inlagda bibliotek, se `web/vendor/README.md` |
| `tests/` | Tester för de rena funktionerna |

## Den tekniska testsidan

Testsidan provar rörelse och lutning, QR-skanning, ljud, synkade tryck och
rundbilder var för sig, på iPhone Safari och Android Chrome. Den ligger på
`https://jedijonas.github.io/escape-room/testsida/` när GitHub Pages är påslaget
(Settings → Pages → Source: GitHub Actions).

- Lägg till `?debug=1` i adressen för att se felsökningsloggen.
- Testkorten med QR-koder finns på `testsida/platskort.html`.
- Synkade tryck når andra mobiler först när Supabase är inställt i
  `web/config.js`. Utan det syns bara flikar i samma webbläsare.

## Köra lokalt

```sh
npm test                               # testerna, kräver Node 22
python3 -m http.server 8000 -d web     # webbsidan på http://localhost:8000
```

Kamera och rörelsesensor kräver https, så de går inte att prova från en mobil
mot en dator i samma nät. Använd den publicerade sidan för det.
