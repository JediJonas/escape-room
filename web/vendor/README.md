# Inlagda bibliotek

Biblioteken ligger i repot, så att spelet inte hänger på en annan webbplats under en spelkväll. De laddas först när en funktion behöver dem.

| Fil | Bibliotek | Version | Licens | Laddas när |
| --- | --- | --- | --- | --- |
| `jsQR.js` | [jsQR](https://github.com/cozmo/jsQR) | 1.4.0 | Apache-2.0 | Webbläsaren saknar egen QR-läsare (`BarcodeDetector`), till exempel iPhone Safari |
| `supabase.js` | [@supabase/supabase-js](https://github.com/supabase/supabase-js) | 2.119.0 | MIT | Testet av synkade tryck körs mot Supabase |

Filerna är oförändrade kopior ur npm-paketen (`dist/jsQR.js` och `dist/umd/supabase.js`).
