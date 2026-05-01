# REDDIT-POST · klistra in på r/sweden eller r/programmering

## Subreddits att överväga

| Subreddit | Vinkel |
|---|---|
| **r/sweden** | satir-vinkeln, "byggde ett spel om vår AI-bubbla" |
| **r/programmering** | tekniska vinkeln, vanilla JS, Reigns-mekanik |
| **r/incremental_games** | game-design-vinkeln, krökar 90s |
| **r/webdev** | tekniska vinkeln, no-build, tiny stack |
| **r/InternetIsBeautiful** | "konstigt litet spel jag hittade" — låt nån annan posta |

---

## VARIANT A · r/sweden (svensk publik, satir-vinkel)

**Titel:**
> Byggde ett spel om Stockholms AI-bubbla på 1 maj 2026

**Body:**

> 1 maj 2026. EU AI Act har trätt i kraft. Klarna anställer 200 till. Lovable-grundaren tweetar något ostligt. Du står med en megafon på Sergels torg.
>
> Det är typ Reigns möter Almedalen. Du klickar ENGAGE / CHANT / DISPERSE / POLICE och försöker hålla UPPRÖRD över 65% utan att tappa folk till TRÖTT eller PANIK. Mellan klicken poppar VC-partnern upp och vill ge dig 200 mdr pre-seed, EU-byråkraten med formulär 7B, fackpampen som kräver solidaritet med inferens-arbetarna, professorn med ett papper från 2019, en boråsare på väg till ICA som undrar vad fan AI är.
>
> Slut: REVOLUTIONEN ÄR HÄR · EQT KÖPTE TÅGET · POLISEN BJÖD PÅ BULLE · ALLA LYSSNADE PÅ ACQUIRED · TÅGET FLÖG TILL SF · CELLUCOR-LAGRET TOG SLUT
>
> Vanilla HTML/JS, inga ramverk, inga cookies, inga personnamn. 90 sekunder ett spel. Allt är öppen källkod.
>
> 🇸🇪 https://ai-may-day.vercel.app
>
> Repo: https://github.com/opensverige/ai-may-day

---

## VARIANT B · r/programmering / r/webdev (tech-vinkel)

**Titel:**
> Byggde en Reigns-klon i vanilla JS på en helg — svensk AI-tech-satir för 1 maj

**Body:**

> Tre filer (`app.js`, `events.js`, `sprites.json`), inga ramverk, inga dependencies. ~1500 rader JS. Hostat på Vercel. Render-loopen kör i 15 Hz, mood-uppdateringar throttlade till 5 Hz.
>
> Mekaniken är hotspot-state-maskiner med neighbor-graphs (k=4 same-layer + k=2 cross-layer). Spread propageras via Math.random() per tick. Reigns-style card-bag-weighting där events får boostad vikt baserat på crowd-state ("hög panic → polischef-events väger 3×, hög hype → VC-partner-events väger 3×").
>
> Crowd renderas som 5 instanser av samma sprite-PNG på olika x/scale, transparent bg fixad via canvas-pixel-pass vid load (whitepoint < 232 → alpha 0). Karaktärsporträtt har 3 states (default/reacting/intense) som byts beroende på vilken effekt ditt val har.
>
> Spelet är klart skämtsamt så ingen ska bli sur (hoppas jag).
>
> Live: https://ai-may-day.vercel.app
> Källkod: https://github.com/opensverige/ai-may-day

---

## VARIANT C · r/incremental_games / r/InternetIsBeautiful (international)

**Titel:**
> Made a 90-second satirical Reigns-clone about Stockholm's AI scene

**Body:**

> Set on May 1st 2026 (Sweden's labour day). The AI Act has been in force for a year. Klarna keeps re-hiring. The "Lovable founder" keeps tweeting cheese. You're handed a megaphone.
>
> Four buttons: ENGAGE / CHANT / DISPERSE / POLICE. Mood-meters: HYPE / CALM / PANIC / BORED. Hold the crowd at HYPE ≥ 65% for 10s to win. Lose to: police-state spiral, mass exhaustion, or everyone leaving to listen to the Acquired podcast.
>
> Between clicks, dialog-events fire Reigns-style: VC-partner offers 200M pre-seed mid-riot, EU-bureaucrat appears with form 7B, union boss demands solidarity with the "inference workers", a guy from Borås on his way to ICA asks what the fuck AI is.
>
> Eight named outcomes. Each is a shareable card with a one-liner.
>
> Vanilla HTML/JS/CSS. No frameworks, no cookies, no tracking. Plays in any browser, mobile-friendly. Open source.
>
> https://ai-may-day.vercel.app

---

## ELEVATOR PITCH (samma överallt)

> AI MAY DAY är en svensk satirisk webbleksak. Du tämjer Stockholms AI-tåg på Sergels torg 1 maj 2026 — Reigns möter Almedalen, 90 sekunder per spel. Vanilla HTML/JS, no cookies, fri källkod.

## ONE-LINER

> Tämja Stockholms AI-tåg på 90 sekunder. Reigns möter Almedalen. 🇸🇪

## TWITTER/X-POST

> 🇸🇪 AI MAY DAY · 1 maj 2026
> Tämja Stockholms AI-tåg på 90 sekunder. EU-byråkraten har formulär 7B. VC-partnern vill ge dig 200 mdr pre-seed mitt i kaoset. Lovable-grundaren tweetar.
>
> Reigns möter Almedalen.
>
> https://ai-may-day.vercel.app

## BLUESKY-POST

> Byggde ett satirspel om Stockholms AI-bubbla på 1 maj 2026. Du tämjer tåget på 90 sekunder med fyra knappar — och då dyker EU-byråkraten upp med formulär 7B.
>
> Reigns möter Almedalen.
>
> https://ai-may-day.vercel.app
