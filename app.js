/* =========================================================================
   AI MAY DAY · app.js
   Vanilla. Inga dependencies. Allt drivs från sprites.json.
   ========================================================================= */

const DEBUG = new URLSearchParams(location.search).has("debug");

// --- mini utils ---
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const rand = (min, max) => Math.random() * (max - min) + min;
const randi = (min, max) => Math.floor(rand(min, max));
const pick = (arr) => arr[randi(0, arr.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
const now = () => performance.now();

/* =========================================================================
   1. CONFIG-LOAD + SPRITE-PIPELINE
   ========================================================================= */

async function loadConfig() {
  const res = await fetch("./sprites.json", { cache: "no-store" });
  if (!res.ok) throw new Error("sprites.json kunde inte laddas");
  return res.json();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Tar bort vita pixlar (nära-vit) → alpha 0. Returnerar ny Image som dataURL. */
function stripWhite(img, threshold = 232) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      px[i + 3] = 0;
    } else if (r > 200 && g > 200 && b > 200) {
      // mjuk fade på off-white kanter
      const m = (r + g + b) / 3;
      px[i + 3] = clamp(255 - (m - 200) * 5, 0, 255);
    }
  }
  ctx.putImageData(d, 0, 0);
  return c.toDataURL("image/png");
}

async function loadSheets(config) {
  const out = {};
  for (const [id, sheet] of Object.entries(config.sheets)) {
    const img = await loadImage(sheet.src);
    let dataUrl = sheet.src;
    if (sheet.removeWhiteBackground) {
      dataUrl = stripWhite(img, sheet.whiteThreshold ?? 232);
    }
    out[id] = { ...sheet, dataUrl, img };
  }
  return out;
}

/* =========================================================================
   2. SCEN-RENDER (sprite-instances + banner-text)
   ========================================================================= */

const SCENE_BASE_W = 1400; // referens-bredd i px för sprite-skala
const SPRITE_BASE_W = 1080; // bredd som "scale 1.0" motsvarar i scenen

function mountScene(config, sheets) {
  const sceneEl = $("#scene");
  const layers = {
    back:  $(".layer--back"),
    mid:   $(".layer--mid"),
    front: $(".layer--front"),
  };

  // mood-overlay per lager (för hype/panic-tint)
  const moodOverlays = {};
  for (const k of Object.keys(layers)) {
    const o = document.createElement("div");
    o.className = "mood-overlay";
    layers[k].appendChild(o);
    moodOverlays[k] = o;
  }

  const instances = [];

  for (const inst of config.scene) {
    const sprite = config.sprites[inst.spriteId];
    const sheet = sheets[sprite.sheet];
    const layerStyle = config.layerStyles[inst.layer];

    // wrapper för positionering — får storlek så att child-sprite kan vara 100%
    const pos = document.createElement("div");
    pos.className = "sprite-pos";
    const widthPct = (SPRITE_BASE_W * layerStyle.scale / SCENE_BASE_W) * 100;
    pos.style.left = inst.x + "%";
    pos.style.top = inst.y + "%";
    pos.style.width = widthPct + "%";
    pos.style.aspectRatio = `${sprite.crop[2]} / ${sprite.crop[3]}`;
    const tilt = inst.tilt || 0;
    pos.style.transform = `translate(-50%, -50%) rotate(${tilt}deg)`;

    const el = document.createElement("div");
    el.className = "sprite" + (inst.flip ? " sprite--flipped" : "");
    el.dataset.id = inst.id;
    el.dataset.layer = inst.layer;
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.opacity = layerStyle.opacity;
    el.style.filter = `brightness(${layerStyle.brightness}) saturate(${layerStyle.saturate ?? 1})`;
    pos.appendChild(el);

    // sprite-img med crop från sheet via background-position
    const img = document.createElement("div");
    img.className = "sprite__img";
    const [cx, cy, cw, ch] = sprite.crop;
    const sx = (cw / sheet.w) * 100;
    const sy = (ch / sheet.h) * 100;
    const px = sheet.w / cw * 100;
    const py = sheet.h / ch * 100;
    img.style.backgroundImage = `url(${sheet.dataUrl})`;
    img.style.backgroundSize = `${px}% ${py}%`;
    img.style.backgroundPosition = `-${(cx / cw) * 100}% -${(cy / ch) * 100}%`;
    el.appendChild(img);

    // banner-text-overlay
    if (sprite.banner && inst.bannerText) {
      const banner = document.createElement("div");
      banner.className = "banner-text banner-text--" + (sprite.banner.textColor || "dark");
      // korrigera x vid flip (banderollens x i bilden är spegelvänd)
      const bx = inst.flip ? (100 - sprite.banner.x - sprite.banner.w) : sprite.banner.x;
      banner.style.left = bx + "%";
      banner.style.top = sprite.banner.y + "%";
      banner.style.width = sprite.banner.w + "%";
      banner.style.height = sprite.banner.h + "%";
      banner.dataset.role = "banner";
      const inner = document.createElement("span");
      inner.className = "banner-text__inner";
      inner.textContent = inst.bannerText;
      banner.appendChild(inner);
      el.appendChild(banner);
    }

    if (DEBUG && sprite.banner) {
      const dbg = document.createElement("div");
      dbg.className = "debug-box";
      dbg.dataset.label = `banner ${sprite.banner.x},${sprite.banner.y} ${sprite.banner.w}×${sprite.banner.h}`;
      dbg.style.left = sprite.banner.x + "%";
      dbg.style.top = sprite.banner.y + "%";
      dbg.style.width = sprite.banner.w + "%";
      dbg.style.height = sprite.banner.h + "%";
      el.appendChild(dbg);
    }

    layers[inst.layer].appendChild(pos);

    const bannerEl = el.querySelector(".banner-text");
    const bannerInner = el.querySelector(".banner-text__inner");
    instances.push({ ...inst, sprite, layerStyle, el, posEl: pos, bannerEl, bannerInner });
  }

  return { sceneEl, layers, moodOverlays, instances };
}

function fitBannerText(el) {
  const inner = el.querySelector(".banner-text__inner");
  if (!inner) return;
  const targetW = el.clientWidth;
  const targetH = el.clientHeight;
  if (targetW < 12 || targetH < 6) return; // layout inte klar
  const minSize = 12;
  const maxSize = Math.max(minSize, Math.floor(targetH * 0.85));
  let size = Math.min(maxSize, Math.max(minSize, Math.floor(targetH * 0.62)));
  el.style.fontSize = size + "px";
  let guard = 80;
  while (inner.offsetWidth > targetW * 0.94 && size > minSize && guard--) {
    size -= 1;
    el.style.fontSize = size + "px";
  }
  guard = 80;
  while (inner.offsetWidth < targetW * 0.82 && size < maxSize && guard--) {
    size += 1;
    el.style.fontSize = size + "px";
    if (inner.offsetWidth > targetW * 0.94) {
      size -= 1;
      el.style.fontSize = size + "px";
      break;
    }
  }
}

function fitAllBanners() {
  document.querySelectorAll(".banner-text").forEach((b) => fitBannerText(b));
}

/* =========================================================================
   3. HOTSPOTS + STATE-MACHINE + NEIGHBOR-GRAPH
   ========================================================================= */

const STATES = ["neutral", "hype", "bored", "panic", "exhausted"];

function generateHotspots(scene) {
  const hotspots = [];
  let id = 0;

  for (const inst of scene.instances) {
    const banner = inst.sprite.banner;
    const count = inst.layer === "back" ? 14 : inst.layer === "mid" ? 18 : 22;

    // sample i nedre 60% av sprite (där huvuden faktiskt sitter), över hela bredden
    for (let i = 0; i < count; i++) {
      // grovt grid med jitter
      const cols = inst.layer === "back" ? 7 : inst.layer === "mid" ? 9 : 11;
      const rows = Math.ceil(count / cols);
      const row = Math.floor(i / cols);
      const col = i % cols;

      const xPct = ((col + 0.5) / cols) * 86 + 7 + rand(-3, 3);          // procent inom sprite
      const yPct = 38 + (row / Math.max(1, rows - 1)) * 38 + rand(-3, 3); // 38–76% av sprite

      // skippa banner-region
      if (banner) {
        const inBannerX = xPct >= banner.x - 2 && xPct <= banner.x + banner.w + 2;
        const inBannerY = yPct >= banner.y - 2 && yPct <= banner.y + banner.h + 2;
        if (inBannerX && inBannerY) continue;
      }

      hotspots.push({
        id: id++,
        instanceId: inst.id,
        layer: inst.layer,
        // procent i förhållande till sprite-instansen
        sxPct: xPct,
        syPct: yPct,
        state: "neutral",
        timer: rand(0, 6),
        cooldown: 0,
        lastBubble: -Infinity,
        neighbors: [],
        absX: 0, absY: 0, // beräknas innan neighbor-bygg
      });
    }
  }

  // beräkna abs-position i scenen för neighbor-graph
  for (const h of hotspots) {
    const inst = scene.instances.find((i) => i.id === h.instanceId);
    const rect = inst.el.getBoundingClientRect();
    const sceneRect = scene.sceneEl.getBoundingClientRect();
    h.absX = ((rect.left - sceneRect.left) + (h.sxPct / 100) * rect.width) / sceneRect.width * 100;
    h.absY = ((rect.top  - sceneRect.top)  + (h.syPct / 100) * rect.height) / sceneRect.height * 100;
  }

  // neighbor-graph: k=4 inom samma lager + k=2 till andra lager
  for (const h of hotspots) {
    const sameLayer = hotspots
      .filter((o) => o !== h && o.layer === h.layer)
      .map((o) => ({ id: o.id, d: dist2(h, { x: o.absX, y: o.absY }) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .map((x) => x.id);

    const crossLayer = hotspots
      .filter((o) => o !== h && o.layer !== h.layer)
      .map((o) => ({ id: o.id, d: dist2(h, { x: o.absX, y: o.absY }) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .map((x) => x.id);

    h.neighbors = sameLayer.concat(crossLayer);
  }

  // bygg DOM-pricks per hotspot för visuell feedback
  for (const inst of scene.instances) {
    const overlay = document.createElement("div");
    overlay.className = "hotspot-layer";
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.pointerEvents = "none";
    inst.el.appendChild(overlay);
    inst.hotspotLayer = overlay;
  }

  for (const h of hotspots) {
    const inst = scene.instances.find((i) => i.id === h.instanceId);
    const dot = document.createElement("div");
    dot.className = "hotspot" + (DEBUG ? " hotspot--debug" : "");
    dot.style.left = h.sxPct + "%";
    dot.style.top  = h.syPct + "%";
    inst.hotspotLayer.appendChild(dot);
    h.el = dot;
  }

  return hotspots;
}

const STATE_TIMEOUTS = {
  neutral:   15,   // → bored om idle
  hype:      10,   // → exhausted
  panic:      6,   // → bored
  exhausted: 12,   // → bored
  bored:    Infinity,
};

function setHotspotState(h, next) {
  if (h.state === next) return;
  h.state = next;
  h.timer = 0;
  h.el.classList.remove("state-hype", "state-bored", "state-panic", "state-exhausted");
  if (next !== "neutral") h.el.classList.add("state-" + next);
}

/* =========================================================================
   4. ACTIONS · ENGAGE / CHANT / DISPERSE / POLICE
   ========================================================================= */

const game = {
  hotspots: [],
  scene: null,
  config: null,
  sheets: null,
  marching: false,
  snowing: false,
  marchers: 1247,
  lastNews: 0,
  newsInterval: 14, // sek
  visibleBubbles: 0,
  dispersedAt: -Infinity,
};

function engageAt(clientX, clientY) {
  const sceneRect = game.scene.sceneEl.getBoundingClientRect();
  const px = ((clientX - sceneRect.left) / sceneRect.width) * 100;
  const py = ((clientY - sceneRect.top)  / sceneRect.height) * 100;

  // hitta närmsta hotspot
  let best = null, bestD = Infinity;
  for (const h of game.hotspots) {
    const d = (h.absX - px) ** 2 + (h.absY - py) ** 2;
    if (d < bestD) { bestD = d; best = h; }
  }
  if (!best) return;

  setHotspotState(best, "hype");

  // 30% chans grannar tändas också
  for (const nid of best.neighbors) {
    if (Math.random() < 0.3) {
      const n = game.hotspots[nid];
      if (n && n.state === "neutral") setHotspotState(n, "hype");
    }
  }

  trySpawnBubble(best);
  pulse(best.el);
}

function chant() {
  // våg bakifrån fram, lager för lager med delay
  const layerOrder = ["back", "mid", "front"];
  layerOrder.forEach((layer, i) => {
    setTimeout(() => {
      for (const h of game.hotspots) {
        if (h.layer !== layer) continue;
        if (h.state === "panic" || h.state === "exhausted") continue;
        if (Math.random() < 0.78) {
          setHotspotState(h, "hype");
          if (Math.random() < 0.08) trySpawnBubble(h);
        }
      }
    }, i * 380);
  });
}

function disperse() {
  game.dispersedAt = now();
  const active = game.hotspots.filter((h) => h.state === "hype" || h.state === "panic");
  // shuffle och ta 50%
  for (let i = active.length - 1; i > 0; i--) {
    const j = randi(0, i + 1);
    [active[i], active[j]] = [active[j], active[i]];
  }
  active.slice(0, Math.ceil(active.length * 0.5)).forEach((h) => {
    setHotspotState(h, "neutral");
  });
}

function police() {
  // visuell blob in från höger
  const blob = document.createElement("div");
  blob.className = "police-blob";
  $("#police").appendChild(blob);
  setTimeout(() => blob.remove(), 3500);

  const flash = document.createElement("div");
  flash.className = "police-flash";
  $("#police").appendChild(flash);
  setTimeout(() => flash.remove(), 750);

  // panik sprider sig från höger inåt
  const sorted = [...game.hotspots].sort((a, b) => b.absX - a.absX);
  sorted.forEach((h, i) => {
    setTimeout(() => {
      if (h.state === "exhausted") return;
      if (Math.random() < 0.85 - i * 0.012) setHotspotState(h, "panic");
      if (Math.random() < 0.05) trySpawnBubble(h);
    }, i * 22);
  });

  // screen-shake
  game.scene.sceneEl.classList.remove("is-shaking");
  void game.scene.sceneEl.offsetWidth; // restart
  game.scene.sceneEl.classList.add("is-shaking");
  setTimeout(() => game.scene.sceneEl.classList.remove("is-shaking"), 600);
}

function pulse(el) {
  el.animate(
    [
      { transform: el.style.transform + " scale(1.0)" },
      { transform: el.style.transform + " scale(1.6)" },
      { transform: el.style.transform + " scale(1.0)" },
    ],
    { duration: 380, easing: "ease-out" }
  );
}

/* =========================================================================
   5. PRATBUBBLOR
   ========================================================================= */

const BUBBLE_MAX = 4;
const BUBBLE_COOLDOWN = 14000;
const BUBBLE_HOLD = 4500;

function trySpawnBubble(h) {
  if (game.visibleBubbles >= BUBBLE_MAX) return;
  if (now() - h.lastBubble < BUBBLE_COOLDOWN) return;

  const pool = game.config.speechPools[h.state] || game.config.speechPools.neutral;
  if (!pool || !pool.length) return;
  const text = pick(pool);

  const b = document.createElement("div");
  b.className = "bubble bubble--" + h.state;
  if (h.state === "hype") b.classList.add("bubble--shout");
  if (h.state === "panic") b.classList.add("bubble--panic");
  b.textContent = text;
  // clamp så bubblan inte clippas vid skärmkanter
  const x = clamp(h.absX, 8, 92);
  const y = clamp(h.absY, 8, 96);
  b.style.left = x + "%";
  b.style.top  = y + "%";
  $("#bubbles").appendChild(b);

  game.visibleBubbles++;
  h.lastBubble = now();

  requestAnimationFrame(() => b.classList.add("bubble--visible"));

  setTimeout(() => {
    b.classList.remove("bubble--visible");
    setTimeout(() => {
      b.remove();
      game.visibleBubbles = Math.max(0, game.visibleBubbles - 1);
    }, 500);
  }, BUBBLE_HOLD);
}

/* =========================================================================
   6. STÄMNINGSMÄTARE + DEMONSTRANT-RÄKNARE
   ========================================================================= */

function updateMood() {
  const counts = { neutral: 0, hype: 0, bored: 0, panic: 0, exhausted: 0 };
  for (const h of game.hotspots) counts[h.state]++;
  const total = game.hotspots.length || 1;

  const pct = {
    hype:  Math.round((counts.hype / total) * 100),
    calm:  Math.round((counts.neutral / total) * 100),
    panic: Math.round((counts.panic / total) * 100),
    bored: Math.round(((counts.bored + counts.exhausted) / total) * 100),
  };

  for (const k of Object.keys(pct)) {
    const row = $(`[data-mood="${k}"]`);
    if (!row) continue;
    row.querySelector(".mood__bar i").style.width = pct[k] + "%";
    row.querySelector(".mood__pct").textContent = pct[k] + "%";
  }

  // mood-overlay-tinta lager beroende på dominant state
  const tints = {
    back:  rgbForLayer("back",  pct),
    mid:   rgbForLayer("mid",   pct),
    front: rgbForLayer("front", pct),
  };
  for (const [layer, tint] of Object.entries(tints)) {
    const o = game.scene.moodOverlays[layer];
    o.style.background = tint.color;
    o.style.opacity = tint.opacity;
  }
}

function rgbForLayer(layer, pct) {
  // dominant state per lager via lokal counting
  const local = { hype: 0, panic: 0, bored: 0, exhausted: 0 };
  for (const h of game.hotspots) if (h.layer === layer && local.hasOwnProperty(h.state)) local[h.state]++;
  const sum = local.hype + local.panic + local.bored + local.exhausted;
  if (!sum) return { color: "rgba(0,0,0,0)", opacity: 0 };

  const max = Math.max(local.hype, local.panic, local.bored, local.exhausted);
  const intensity = clamp(max / Math.max(1, sum) * 0.55, 0, 0.55);
  if (max === local.hype)   return { color: "rgba(176, 30, 30, 1)",  opacity: intensity };
  if (max === local.panic)  return { color: "rgba(40, 70, 110, 1)",  opacity: intensity * 1.1 };
  if (max === local.bored)  return { color: "rgba(80, 75, 55, 1)",   opacity: intensity * 0.6 };
  return { color: "rgba(50, 60, 55, 1)", opacity: intensity * 0.7 };
}

function updateMarcherCount(dt) {
  if (game.marching) {
    game.marchers += dt * rand(2.5, 8);
    const el = $("#marcher-count");
    el.textContent = Math.floor(game.marchers).toLocaleString("sv-SE").replace(/ /g, " ");
  }
}

/* =========================================================================
   7. BREAKING NEWS-TICKER
   ========================================================================= */

function pushNews(item) {
  const track = $("#ticker-track");
  const el = document.createElement("div");
  el.className = "ticker__item is-fresh";
  el.textContent = "BREAKING: " + item.text + "  ◆  ";
  // ersätt nuvarande
  track.innerHTML = "";
  track.appendChild(el);

  // applicera state-deltas på hotspots
  if (item.deltaHype)  applyDelta("hype",   item.deltaHype);
  if (item.deltaPanic) applyDelta("panic",  item.deltaPanic);
  if (item.deltaBored) applyDelta("bored",  item.deltaBored);

  $("#marcher-count").classList.add("flicker");
  setTimeout(() => $("#marcher-count").classList.remove("flicker"), 400);
}

function applyDelta(state, percent) {
  // percent = ungefärligt antal hotspots att flippa
  const target = Math.abs(Math.round((percent / 100) * game.hotspots.length));
  const candidates = [...game.hotspots]
    .filter((h) => h.state !== state && h.state !== "exhausted")
    .sort(() => Math.random() - 0.5)
    .slice(0, target);

  if (percent > 0) {
    candidates.forEach((h) => setHotspotState(h, state));
  } else {
    // negativt delta = lugna ner
    [...game.hotspots]
      .filter((h) => h.state === state)
      .sort(() => Math.random() - 0.5)
      .slice(0, target)
      .forEach((h) => setHotspotState(h, "neutral"));
  }
}

function tickNews(dt) {
  game.lastNews += dt;
  if (game.lastNews >= game.newsInterval) {
    game.lastNews = 0;
    game.newsInterval = rand(12, 25);
    const item = pick(game.config.news);
    pushNews(item);
  }
}

/* =========================================================================
   8. SNÖ-CANVAS
   ========================================================================= */

let snowFlakes = [];
let snowCanvas, snowCtx;
function initSnow() {
  snowCanvas = $("#snow");
  snowCtx = snowCanvas.getContext("2d");
  resizeSnow();
  window.addEventListener("resize", resizeSnow);
}
function resizeSnow() {
  if (!snowCanvas) return;
  snowCanvas.width = snowCanvas.clientWidth * (window.devicePixelRatio || 1);
  snowCanvas.height = snowCanvas.clientHeight * (window.devicePixelRatio || 1);
}
function spawnFlakes() {
  if (snowFlakes.length > 0) return;
  for (let i = 0; i < 110; i++) {
    snowFlakes.push({
      x: rand(0, snowCanvas.width),
      y: rand(0, snowCanvas.height),
      r: rand(0.6, 2.6),
      vy: rand(0.2, 1.4),
      vx: rand(-0.4, 0.4),
      a: rand(0.5, 0.95),
    });
  }
}
function drawSnow(dt) {
  if (!game.snowing || !snowCtx) return;
  snowCtx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
  const dpr = window.devicePixelRatio || 1;
  for (const f of snowFlakes) {
    f.x += f.vx * dt * 30;
    f.y += f.vy * dt * 30;
    if (f.y > snowCanvas.height) { f.y = -5; f.x = rand(0, snowCanvas.width); }
    if (f.x < -10) f.x = snowCanvas.width + 10;
    if (f.x > snowCanvas.width + 10) f.x = -10;
    snowCtx.beginPath();
    snowCtx.arc(f.x, f.y, f.r * dpr, 0, Math.PI * 2);
    snowCtx.fillStyle = `rgba(240, 245, 255, ${f.a})`;
    snowCtx.fill();
  }
}

/* =========================================================================
   9. STATE-MACHINE TICK
   ========================================================================= */

function tickHotspots(dt) {
  const dispersed = (now() - game.dispersedAt) < 3000;

  for (const h of game.hotspots) {
    h.timer += dt;

    // state-transitions efter timeout
    const limit = STATE_TIMEOUTS[h.state];
    if (Number.isFinite(limit) && h.timer > limit) {
      if (h.state === "hype")     setHotspotState(h, "exhausted");
      else if (h.state === "panic")    setHotspotState(h, "bored");
      else if (h.state === "exhausted") setHotspotState(h, "bored");
      else if (h.state === "neutral")  setHotspotState(h, "bored");
    }

    // spread från grannar (sänkt under disperse-cooldown)
    if (!dispersed && h.state === "neutral" && Math.random() < 0.012) {
      const hypedNeighbors = h.neighbors.filter((nid) => game.hotspots[nid]?.state === "hype").length;
      const panicNeighbors = h.neighbors.filter((nid) => game.hotspots[nid]?.state === "panic").length;

      // panic-hotspot stoppar hype-spread inom radie
      const nearbyPanic = game.hotspots.some((o) => o.state === "panic" && dist2({ x: h.absX, y: h.absY }, { x: o.absX, y: o.absY }) < 64);

      if (panicNeighbors >= 1 && Math.random() < 0.6) {
        setHotspotState(h, "panic");
      } else if (!nearbyPanic && hypedNeighbors >= 2 && Math.random() < 0.5) {
        setHotspotState(h, "hype");
      } else if (hypedNeighbors >= 1 && Math.random() < 0.18) {
        setHotspotState(h, "hype");
      }
    }

    // sporadiska bubblor från aktiva hotspots — saktare så man hinner läsa
    if ((h.state === "hype" || h.state === "panic") && Math.random() < dt * 0.06) {
      trySpawnBubble(h);
    }
    if (h.state === "bored" && Math.random() < dt * 0.012) {
      trySpawnBubble(h);
    }
  }
}

/* =========================================================================
   10. INPUT + TOGGLES
   ========================================================================= */

function bindUI() {
  // klick på scen → engage
  $("#scene").addEventListener("click", (e) => {
    if (e.target.closest(".btn") || e.target.closest(".toggle")) return;
    engageAt(e.clientX, e.clientY);
  });
  $("#scene").addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    engageAt(t.clientX, t.clientY);
  }, { passive: true });

  // action-knappar
  $$(".btn").forEach((b) => {
    b.addEventListener("click", () => {
      const a = b.dataset.action;
      if (a === "engage") {
        // tända slumpmässig hotspot för demo
        const r = pick(game.hotspots);
        if (r) { setHotspotState(r, "hype"); trySpawnBubble(r); }
      } else if (a === "chant") chant();
      else if (a === "disperse") disperse();
      else if (a === "police") police();
    });
  });

  // toggles
  $$(".toggle").forEach((t) => {
    t.addEventListener("click", () => {
      const k = t.dataset.toggle;
      if (k === "march") {
        game.marching = !game.marching;
        t.classList.toggle("is-on", game.marching);
        game.scene.sceneEl.classList.toggle("is-marching", game.marching);
      } else if (k === "snow") {
        game.snowing = !game.snowing;
        t.classList.toggle("is-on", game.snowing);
        if (game.snowing) {
          resizeSnow();
          snowFlakes = [];
          spawnFlakes();
        } else {
          snowCtx?.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
        }
      } else if (k === "reslogan") {
        const pool = game.config.bannerSlogans;
        for (const inst of game.scene.instances) {
          if (inst.bannerInner) inst.bannerInner.textContent = pick(pool);
        }
        fitAllBanners();
      }
    });
  });

  // tangenter
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "a") $$(".btn--engage")[0]?.click();
    else if (k === "s") chant();
    else if (k === "d") disperse();
    else if (k === "f") police();
    else if (k === "m") $$(".toggle")[0]?.click();
    else if (k === "n") $$(".toggle")[1]?.click();
    else if (k === "r") $$(".toggle")[2]?.click();
  });
}

/* =========================================================================
   11. KLOCKA + DEBUG
   ========================================================================= */

function tickClock() {
  const d = new Date();
  $("#clock").textContent =
    String(d.getHours()).padStart(2, "0") + ":" +
    String(d.getMinutes()).padStart(2, "0");
}

function debugInfo() {
  if (!DEBUG) return;
  const el = $("#debug-info");
  el.hidden = false;
  const counts = { neutral: 0, hype: 0, bored: 0, panic: 0, exhausted: 0 };
  for (const h of game.hotspots) counts[h.state]++;
  el.innerHTML =
    `<strong>DEBUG ?debug=1</strong><br>` +
    `hotspots: ${game.hotspots.length}<br>` +
    `instances: ${game.scene.instances.length}<br>` +
    Object.entries(counts).map(([k, v]) => `${k.padEnd(10)} ${v}`).join("<br>") +
    `<br>marching: ${game.marching} · snow: ${game.snowing}<br>` +
    `bubbles: ${game.visibleBubbles}/${BUBBLE_MAX}`;
}

/* =========================================================================
   12. MAIN LOOP
   ========================================================================= */

let lastT = 0;
function loop(t) {
  const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
  lastT = t;
  tickHotspots(dt);
  updateMood();
  updateMarcherCount(dt);
  tickNews(dt);
  drawSnow(dt);
  debugInfo();
  requestAnimationFrame(loop);
}

/* =========================================================================
   13. BOOT
   ========================================================================= */

(async function boot() {
  try {
    const config = await loadConfig();
    const sheets = await loadSheets(config);

    game.config = config;
    game.sheets = sheets;
    game.scene = mountScene(config, sheets);

    // vänta två frames så DOM-mätningar funkar (layout + paint)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    game.hotspots = generateHotspots(game.scene);
    fitAllBanners();
    window.addEventListener("resize", fitAllBanners);
    initSnow();
    bindUI();
    tickClock();
    setInterval(tickClock, 30000);

    // välkomst-news
    setTimeout(() => pushNews({ text: "AI-tåget samlas vid Sergels torg" }), 1200);

    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<pre style="color:#e54a4a;padding:30px;font-family:ui-monospace,monospace;background:#0a1412;height:100vh;margin:0;">FEL: ${err.message}\n\nÄr du i en mapp med sprites/ och kör en lokal server?\n\n  python3 -m http.server 8000\n\n${err.stack || ""}</pre>`;
  }
})();
