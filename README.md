# AI MAY DAY

> 1 maj 2026. EU AI Act har trätt i kraft. Klarna anställer 200 till. Lovable-grundaren tweetar något ostligt. Och du står med en megafon på Sergels torg.

**[ai-may-day.vercel.app](https://ai-may-day.vercel.app)**

En svensk satirisk webbleksak om vibe-codande aktivister, EU-formulär 7B, AI-läkare i Norrbotten och VC-partnern som vill ge dig 200 miljoner pre-seed mitt i kaoset. *Reigns möter Almedalen möter en mörk söndagskväll i april*. 90 sekunder per spel.

## Vad är detta egentligen

Du tämjer ett AI-tåg av startup-folk i Stockholm. Du har fyra knappar:

- **ENGAGE** — tända en gnista
- **CHANT** — våg från bakre led
- **DISPERSE** — lugna ner massan
- **POLICE** — extern panikkälla

Mellan klicken poppar arketyper upp och kräver beslut: VC-partnern, EU-byråkraten med pärm, fackpampen som vill prata om inferens-arbetarnas pension, professorn med ett papper från 2019, polischefen som undrar om ni har anmält fika-pausen, och en boråsare på väg till ICA som undrar vad fan AI är.

**Vinster:** REVOLUTIONEN ÄR HÄR · EQT KÖPTE TÅGET · BLÅ-GUL REVOLUTION · DEMONSTRATIONEN ÅKER TILL BALI

**Förluster:** POLISEN BJÖD PÅ BULLE · ALLA LYSSNADE PÅ ACQUIRED · CELLUCOR-LAGRET TOG SLUT · TÅGET FLÖG TILL SF

Varje slut är ett delningsbart kort med X / Bluesky / LinkedIn-knappar. För att vi ska kunna skratta åt oss själva offentligt.

## Tekniskt

Vanilla HTML/JS/CSS. Inga ramverk. Inga cookies. Inga tracking-pixlar. Inget bygge. Inget npm install. Bara öppna `index.html`.

```bash
python3 -m http.server 8765
```

Öppna `http://127.0.0.1:8765`. Klar.

### Filer
- `index.html` · `style.css` · `app.js` — själva spelet
- `events.js` · `events.css` — Reigns-stil dialog-events
- `sprites.json` — all data: paroller, news, repliker, scen-config
- `juridik.html` — fiktionsdeklaration + integritetspolicy
- `dev.html` — dev-kontrollpanel (trigga events / utfall manuellt)
- `sprites/` — crowd-bilder, karaktärsporträtt med states, key-art

### Tangenter
`A` engage · `S` chant · `D` disperse · `F` police · `1/2/3` event-val · `Esc` skip event

### URL-flaggor
- `?event=<id>` tvångstrigga ett event
- `?finale=<key>` tvångstrigga ett slut (med fake-stats)
- `?state=<name>:<pct>` sätt initialt mood
- `?debug=1` visa hotspots och debug-info
- `?noevents=1` stäng av events helt

## Arketyper

| | | |
|---|---|---|
| **VC-PARTNERN** | "Vi tänker att det här är en *fantastic opportunity*." | sana.png |
| **AI-GRUNDAREN** | "Jag har redan bokat Bali. Vad ska jag göra?" | sana.png |
| **FACKPAMPEN** | "Solidaritet med inferens-arbetarna!" | facket.png |
| **AKTIVISTEN** | "Compute-utsläppen!" | facket.png |
| **EU-BYRÅKRATEN** | "Artikel 6, model cards, GDPR, kaffe." | byrakrat.png |
| **JOURNALISTEN** | "Vad är ert *huvudbudskap* idag?" | journalist.png |
| **POLISCHEFEN** | "Är ni anmälda? Jag har en lapp." | polis.png |
| **PROFESSORN** | "Får jag presentera mitt papper från 2019?" | byrakrat.png |
| **KOMMUNALRÅDET** | "Får jag stå med på bilden?" | facket.png |
| **INFLUENCERN** | "Get-ready-with-me from the protest?" | journalist.png |
| **BORÅSAREN** | "Vad fan är AI?" | polis.png |
| **PENSIONÄREN** | "Jag stod här 1971." | facket.png |

Varje karaktär har 3 portrait-states (`default` / `reacting` / `intense`) som byts automatiskt baserat på vilken effekt ditt val har.

## Allt är fiktion

Se `/juridik` för full ansvarsfriskrivning. Inga personnamn används i spelet (vi pratar om "Lovable-grundaren", "Spotify-grundaren", "Hovet" etc). Bolagsnamn används enbart i tydligt skämtsam kontext. Alla porträtt är AI-genererade fiktiva karaktärer.

## Krediter

Skapad i [**OPENSVERIGE**](https://opensverige.se) · av Baltsar

PR och issues välkomna. Lägg gärna till en arketyp.
