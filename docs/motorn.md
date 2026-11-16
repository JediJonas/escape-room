# Motorns grund: designförslag

Förslag till byggordningens steg 2, att godkänna innan något byggs. Det tar upp
det som är dyrt att ändra i efterhand: vem en mobil är, var spelets tillstånd
ligger, hur behörigheten fungerar, hur servern avgör samtidighet och hur en
uppdragsfil ser ut.

## Sammanfattning

- Varje mobil loggar in anonymt i Supabase. Inloggningen sparas i webbläsaren,
  så rollen ligger kvar när sidan laddas om.
- Spelets tabeller ligger i ett eget schema som Data API inte visar. En mobil
  kan alltså inte läsa en enda tabell direkt, och inga RLS-regler på tabellerna
  behöver vara rätt för att facit ska vara skyddat.
- Allt en mobil gör går genom en enda serverfunktion, `spel`, som kontrollerar
  vem som frågar, ändrar tillståndet och räknar fram vad varje spelare ska se.
- Varje spelare har en egen privat realtidskanal. Servern skickar den nya vyn
  dit. RLS på kanalerna gör att en mobil bara kan lyssna på sin egen kanal och
  sitt eget spels gemensamma kanal.
- Ett uppdrag är en JSON-fil i repot. Den läses av serverfunktionen och når
  aldrig webbsidan. Bilder och ljud ligger på GitHub Pages.

## Vem en mobil är

Supabase har anonym inloggning. Mobilen får ett eget användar-id utan e-post
eller lösenord, och id:t sparas i webbläsaren. Laddar spelaren om sidan är hon
samma spelare med samma roll.

Om en mobil försvinner helt, till exempel när batteriet tar slut, kan
spelledaren låta en annan mobil ta över spelarens plats. Rollen följer
spelarplatsen, inte mobilen.

Spelledaren är den mobil som skapade spelet. Hon får en flagga som säger om hon
spelar med eller står utanför.

## Tabeller

Alla tabeller ligger i schemat `motor`, som inte exponeras i Data API.

| Tabell | Innehåll |
| --- | --- |
| `spel` | Kod att ansluta med, uppdrag, speltid, status (väntar, pågår, pausat, slut), om platskort används, om spelledaren spelar, starttid och pausad tid, aktuell uppgift och ett versionsnummer |
| `spelare` | Spel, användar-id, namn, om hon är spelledare, plats (A–F eller ingen), varifrån platsen kom (skanning eller lista) och när mobilen senast hördes av |
| `roller` | Vilken roll varje spelare har i varje uppgift |
| `rollhistorik` | Vem som har haft en framträdande roll, så att rollerna roterar |
| `uppgiftsstatus` | Tillståndet i den pågående uppgiften, som vilka som håller fingret på skärmen, vilka ledtrådar som har getts och resultatet |
| `vyer` | Det varje spelare ska se just nu, med ett versionsnummer |
| `handelser` | En logg över allt som händer, med serverns tid. Används för felsökning och för att räkna samtidighet |

Facit finns aldrig i en tabell som en spelares vy byggs av. Det läses ur
uppdragsfilen i serverfunktionen när ett svar ska kontrolleras.

## Serverfunktionen

En Edge Function i Supabase, skriven i JavaScript, tar emot allt: skapa spel,
ansluta, välja plats, spelledarens kommandon och spelarnas handlingar i
uppgifterna. Den gör tre saker varje gång:

1. Kontrollerar vem som frågar, med mobilens inloggning.
2. Räknar fram det nya tillståndet med en ren funktion: tillstånd och handling
   in, nytt tillstånd och nya vyer ut.
3. Sparar och skickar de vyer som har ändrats, var och en till sin spelare.

Steg 2 är rena funktioner utan nät och databas, precis som `holdRoom.js` i
testsidan. Där ligger motorns och uppgiftstypernas logik, och den testas med
`npm test`. Samma filer körs i Supabase.

**Två handlingar samtidigt.** Varje spel har ett versionsnummer. En ändring
sparas bara om versionen inte har ändrats sedan den lästes. Annars läser
funktionen om och försöker igen. Två spelare som trycker samtidigt kan alltså
inte skriva över varandra.

**Samtidighet i uppgifterna.** När en spelare trycker eller släpper skickas det
till servern, som noterar sin egen tid. Det är serverns tider som avgör om alla
höll samtidigt. Mobilernas klockor används aldrig.

**Det som inte går genom servern.** Lutning och andra rörelser som ska synas i
en annan mobil i realtid, som i Lotsen, skickas direkt mellan mobilerna i spelets
kanal. Det är bara en förhandsvisning. Det som avgör uppgiften, som att den
instängda har nått rätt ställe, kontrolleras av servern.

**Nedräkningen.** Servern sparar starttiden och hur länge spelet har varit
pausat. Mobilen mäter skillnaden mellan sin klocka och serverns när den
ansluter och räknar ner själv.

## Realtid och behörighet

Supabase Realtime har privata kanaler, där RLS-regler avgör vem som får lyssna
och skicka.

| Kanal | Vem får lyssna | Vem får skicka | Används till |
| --- | --- | --- | --- |
| `spel:<id>` | Alla spelare i spelet | Alla spelare i spelet | Nedräkning, paus, förhandsvisning av rörelser |
| `spelare:<id>` | Bara den spelaren | Bara servern | Spelarens vy |
| `ledare:<id>` | Bara spelledaren | Bara servern | Administrationsvyn |

Kanalen bär bara en signal och den nya vyn. När en mobil ansluter eller laddar
om hämtar den sin vy från serverfunktionen, så inget går förlorat om ett
meddelande missas.

Publika kanaler stängs av i Supabase. Testsidans synkade tryck använder en
publik kanal och flyttas därför till en privat kanal i samma steg.

## Platser

Spelaren är på en plats när hon har skannat kortet eller valt platsen i listan.
Serverfunktionen tar emot båda på samma sätt och sparar bara varifrån platsen
kom, för felsökningens skull. När spelledaren har valt bort platskorten visar
mobilen listan direkt i stället för kameran.

## Uppdragsfilen

Ett uppdrag är en mapp i `uppdrag/`, utanför `web/`, så att det inte läggs ut
på GitHub Pages. Bilder och ljud ligger i `web/uppdrag/<uppdrag>/`.

```json
{
  "id": "den-femte-gasten",
  "titel": "Den femte gästen",
  "alder": 16,
  "speltider": [45, 60, 75],
  "platser": { "A": "Källaren", "B": "Hallen", "C": "Köket", "D": "Biblioteket", "E": "Sovrummet" },
  "uppgifter": [
    {
      "id": "seansen",
      "typ": "samtidigt",
      "akt": 1,
      "minuter": 5,
      "roller": [
        { "id": "deltagare", "antal": "alla" }
      ],
      "innehall": { "meddelande": "HJÄLP MIG" },
      "facit": {},
      "ledtradar": ["…", "…", "…"],
      "vidMisslyckande": { "kostarMinuter": 2 },
      "avslojar": "Vera finns kvar i huset och vill ha hjälp"
    }
  ],
  "slut": [ { "id": "kedjan-bryts", "text": "…" } ]
}
```

- **Fälten utanför `innehall` och `facit` är desamma för alla uppgifter.**
  Motorn läser dem.
- **`innehall` och `facit` tolkas av uppgiftstypen.** Varje typ har en
  beskrivning av sina fält, som kontrolleras med ett test när uppdraget ändras.
  Ett skrivfel i ett uppdrag syns då i testerna och inte mitt i ett spel.
- **Texterna står direkt på svenska.** Fler språk läggs till när de behövs, som
  en fil per språk med samma nycklar. Det är ett mekaniskt arbete som inte
  påverkar motorn.

## Det här säger jag till om

- **Repot är publikt, och därmed facit.** Servern skyddar facit mot den som
  tittar i mobilens webbläsare under spelet, men vem som helst kan läsa
  uppdragsfilen på GitHub. För ett partyspel tror jag att det räcker. Annars kan
  uppdragen läggas i ett privat repo senare, utan att motorn ändras.
- **Bilder på GitHub Pages går att hitta i förväg.** En bild som avslöjar
  något, som namnen på källarväggen, får ett namn som inte går att gissa. Räcker
  inte det kan de bilderna läggas i Supabase Storage och bara lämnas ut till den
  som ska se dem.
- **Serverfunktionen kan vara långsam första gången.** En Edge Function som
  inte har använts på en stund kan ta upp emot en sekund att starta. Det mäts
  först av allt. Blir det ett problem håller spelledarens mobil den vaken under
  spelet, eller så flyttas de snabbaste handlingarna till databasfunktioner.
- **Gratisnivån och rörelser i realtid.** Supabase räknar meddelanden i
  realtid, och gratisnivån har en månadskvot. En mobil som skickar sin lutning
  tio gånger i sekunden till nio andra blir många meddelanden på en timme.
  Rörelser skickas därför glest och bara när en uppgift behöver dem, och
  förbrukningen mäts vid första provspelet.

## Byggordning inom steget

1. **Supabase.** Schemat, kanalernas regler och serverfunktionen läggs i repot
   under `supabase/` och läggs ut av en GitHub Action när `main` ändras.
2. **Ansluta.** Spelledaren skapar ett spel och visar en QR-kod och en kod på
   fyra bokstäver. Spelarna ansluter med namn, och alla ser vilka som är med.
3. **Plats och roll.** Spelarna väljer plats med kort eller lista. Ett
   provuppdrag med två berättelsescener ger olika spelare olika texter, så att
   rollfördelning och privata vyer går att se med flera mobiler.
4. **Spelledarvyn.** Starta, pausa, ge ledtråd, hoppa över, visa facit på
   begäran och låta en mobil ta över en spelare.

Varje del provas på riktiga mobiler innan nästa påbörjas. Uppgiftstyperna själva
hör till steg 3.

## Det här behöver Jonas göra i Supabase

- Slå på anonym inloggning (Authentication → Sign In / Providers → Anonymous).
- Stänga av publika kanaler (Realtime → Settings).
- Skapa en åtkomsttoken och lägga den och databasens lösenord som hemligheter i
  GitHub, så att Actions kan lägga ut schemat och serverfunktionen.
