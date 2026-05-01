# AI May Day — Crowd Simulator

Interaktiv satirisk webbleksak där du crowd-controllar ett svenskt 1 maj-tåg av AI-agenter. Vanilla HTML/JS/CSS, inga dependencies, ingen build.

## Köra lokalt

```bash
python3 -m http.server 8765
# eller
npx serve
```

Öppna `http://127.0.0.1:8765/`.

## Filer

- `index.html` · markup (HUD, scen, actions, ticker)
- `style.css` · stil (mörk teal + guld + revolution-röd, kornig grain)
- `app.js` · logik (sprite-loader, hotspot state-machine, alla actions)
- `sprites.json` · all data (lager, sceninstanser, paroller, news, speech-pools)
- `sprites/` · bildkällor

## Lägg till en ny sprite

1. Lägg en transparent PNG i `sprites/`.
2. Addera en entry i `sprites.json` under `sprites` med `sheet`, `crop` och valfri `banner`-region (procent av sprite).
3. Lägg en sceninstans under `scene` med `layer`, `x`, `y` och valfri `bannerText`.

Kör med `?debug=1` för att se banner-rektanglar och hotspot-prickar visuellt.

## Tangentbord

| Tangent | Action |
|---------|--------|
| `A` | ENGAGE — tända en slumpmässig hotspot |
| `S` | CHANT — våg från bakre led |
| `D` | DISPERSE — lugna ner massan |
| `F` | POLICE — extern panikkälla + screen-shake |
| `M` | Marschera-toggle |
| `N` | Snö-toggle |
| `R` | Nya paroller |

Klick/tap på scenen tänder närmsta hotspot.
