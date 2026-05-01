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
      const m = (r + g + b) / 3;
      px[i + 3] = clamp(255 - (m - 200) * 5, 0, 255);
    }
  }
  ctx.putImageData(d, 0, 0);
  return c.toDataURL("image/png");
}

/** Tar bort mörka bakgrunds-pixlar med soft falloff över en range. */
function stripDark(img, threshold = 55) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  const fadeRange = 30; // pixel med max-värde threshold..threshold+fadeRange faller av
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const mx = Math.max(r, g, b);
    if (mx <= threshold) {
      px[i + 3] = 0;
    } else if (mx < threshold + fadeRange) {
      const t = (mx - threshold) / fadeRange;
      px[i + 3] = Math.round(255 * t);
    }
  }
  ctx.putImageData(d, 0, 0);
  return c.toDataURL("image/png");
}

function encodeSrc(src) {
  // url-encode path-segment (hanterar mellanslag mm), behåll /-separator
  return src.split("/").map(encodeURIComponent).join("/");
}

async function loadSheets(config) {
  const out = {};
  for (const [id, sheet] of Object.entries(config.sheets)) {
    const safeSrc = encodeSrc(sheet.src);
    const img = await loadImage(safeSrc);
    let dataUrl = safeSrc;
    if (sheet.removeWhiteBackground) {
      dataUrl = stripWhite(img, sheet.whiteThreshold ?? 232);
    } else if (sheet.removeDarkBackground) {
      dataUrl = stripDark(img, sheet.darkThreshold ?? 55);
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
    pos.style.width = widthPct + "%";
    pos.style.aspectRatio = `${sprite.crop[2]} / ${sprite.crop[3]}`;
    const tilt = inst.tilt || 0;
    // FRONT-lager anchoras till scen-bottom så crowden inte floatar
    if (inst.layer === "front") {
      pos.style.bottom = "0";
      pos.style.transform = `translateX(-50%) rotate(${tilt}deg)`;
    } else {
      pos.style.top = inst.y + "%";
      pos.style.transform = `translate(-50%, -50%) rotate(${tilt}deg)`;
    }

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
    const W = sheet.w, H = sheet.h;
    const bgSizeX = (W / cw) * 100;
    const bgSizeY = (H / ch) * 100;
    const posX = W === cw ? 0 : (cx / (W - cw)) * 100;
    const posY = H === ch ? 0 : (cy / (H - ch)) * 100;
    img.style.backgroundImage = `url(${sheet.dataUrl})`;
    img.style.backgroundSize = `${bgSizeX}% ${bgSizeY}%`;
    img.style.backgroundPosition = `${posX}% ${posY}%`;
    if (sheet.blendMode) img.style.mixBlendMode = sheet.blendMode;
    if (sheet.featherEdges) img.classList.add("sprite__img--feathered");
    el.appendChild(img);

    // banner-text-overlay (inaktiverat — texten ligger på sprite-bilden direkt)

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
    const count = inst.layer === "back" ? 6 : inst.layer === "mid" ? 8 : 12;

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
  neutral:   25,   // → bored om idle
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
  snowing: false,
  marchers: 1247,
  lastNews: 0,
  newsInterval: 4, // sek
  visibleBubbles: 0,
  dispersedAt: -Infinity,
  // mål-tracking
  startTime: 0,
  isOver: false,
  winTimer: 0,
  panicTimer: 0,
  boredTimer: 0,
  peakHype: 0,
  peakPanic: 0,
  newsCount: 0,
  policeCount: 0,
};

const GOAL = {
  winThreshold: 75,    // % UPPRÖRD
  winSustain: 12,      // sekunder
  loseThreshold: 65,   // % PANIK
  loseSustain: 8,
  boredThreshold: 80,  // % TRÖTT
  boredSustain: 20,
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
  game.policeCount++;
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

const BUBBLE_MAX = 6;
const BUBBLE_COOLDOWN = 5000;
const BUBBLE_HOLD = 4000;

function trySpawnBubble(h) {
  if (game.visibleBubbles >= BUBBLE_MAX) return;
  if (now() - h.lastBubble < BUBBLE_COOLDOWN) return;

  const pool = game.config.speechPools[h.state] || game.config.speechPools.neutral;
  if (!pool || !pool.length) return;
  const text = pick(pool);

  const b = document.createElement("div");
  b.className = "bubble bubble--" + h.state + " bubble--layer-" + h.layer;
  if (h.state === "hype") b.classList.add("bubble--shout");
  if (h.state === "panic") b.classList.add("bubble--panic");
  b.textContent = text;
  // clamp så bubblan alltid hamnar i övre/mellersta delen av scenen
  // (bubble har translate(-50%,-100%) → svans pekar nedåt mot crowd, body uppåt)
  const x = clamp(h.absX, 12, 88);
  const y = clamp(h.absY, 28, 70);
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

// cache senaste mood för att undvika onödiga DOM-writes
const lastMood = { hype: -1, calm: -1, panic: -1, bored: -1 };
const lastTint = { back: "", mid: "", front: "" };

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

  // bara skriv DOM om värdet faktiskt ändrats
  for (const k of Object.keys(pct)) {
    if (pct[k] === lastMood[k]) continue;
    lastMood[k] = pct[k];
    const row = $(`[data-mood="${k}"]`);
    if (!row) continue;
    row.querySelector(".mood__bar i").style.width = pct[k] + "%";
    row.querySelector(".mood__pct").textContent = pct[k] + "%";
  }

  // mood-overlay-tinta lager — bara update om signifikant ändring
  for (const layer of ["back", "mid", "front"]) {
    const tint = rgbForLayer(layer, pct);
    const key = tint.color + "|" + tint.opacity.toFixed(2);
    if (key === lastTint[layer]) continue;
    lastTint[layer] = key;
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
  // tickar långsamt över tid — folk fortsätter ansluta sig
  game.marchers += dt * rand(0.6, 1.6);
  const el = $("#marcher-count");
  if (el) el.textContent = Math.floor(game.marchers).toLocaleString("sv-SE");
}

/* =========================================================================
   MÅL · win / lose
   ========================================================================= */

const GOAL_THRESHOLDS = {
  winThreshold: 75, winSustain: 12,
  loseThreshold: 65, loseSustain: 8,
  boredThreshold: 70, boredSustain: 30,
};

function tickGoal(dt) {
  if (game.isOver) return;
  const counts = { neutral: 0, hype: 0, bored: 0, panic: 0, exhausted: 0 };
  for (const h of game.hotspots) counts[h.state]++;
  const total = game.hotspots.length || 1;
  const hypePct  = (counts.hype / total) * 100;
  const panicPct = (counts.panic / total) * 100;
  const boredPct = ((counts.bored + counts.exhausted) / total) * 100;

  game.peakHype  = Math.max(game.peakHype,  hypePct);
  game.peakPanic = Math.max(game.peakPanic, panicPct);

  game.winTimer   = hypePct  >= GOAL_THRESHOLDS.winThreshold   ? game.winTimer + dt   : Math.max(0, game.winTimer - dt * 1.4);
  game.panicTimer = panicPct >= GOAL_THRESHOLDS.loseThreshold  ? game.panicTimer + dt : Math.max(0, game.panicTimer - dt * 1.4);
  game.boredTimer = boredPct >= GOAL_THRESHOLDS.boredThreshold ? game.boredTimer + dt : Math.max(0, game.boredTimer - dt * 0.8);

  renderGoal(hypePct);

  if (game.winTimer   >= GOAL_THRESHOLDS.winSustain)   return endGame("win");
  if (game.panicTimer >= GOAL_THRESHOLDS.loseSustain)  return endGame("police");
  if (game.boredTimer >= GOAL_THRESHOLDS.boredSustain) return endGame("bored");
}

function renderGoal(hypePct) {
  const bar = $("#goal-bar");
  const time = $("#goal-time");
  const text = $("#goal-text");
  const goalEl = $("#goal");

  const winFrac    = clamp(game.winTimer   / GOAL_THRESHOLDS.winSustain,   0, 1);
  const policeFrac = clamp(game.panicTimer / GOAL_THRESHOLDS.loseSustain,  0, 1);
  const boredFrac  = clamp(game.boredTimer / GOAL_THRESHOLDS.boredSustain, 0, 1);
  const top = Math.max(winFrac, policeFrac, boredFrac);

  goalEl.classList.remove("is-winning", "is-danger", "is-bored");
  if (top === winFrac && winFrac > 0.05) {
    goalEl.classList.add("is-winning");
    text.textContent = `REVOLUTION OM ${Math.max(0, GOAL_THRESHOLDS.winSustain - game.winTimer).toFixed(1)}S — HÅLL UPPRÖRD ÖVER ${GOAL_THRESHOLDS.winThreshold}%`;
    bar.style.width = winFrac * 100 + "%";
    time.textContent = game.winTimer.toFixed(1) + "s";
  } else if (top === policeFrac && policeFrac > 0.05) {
    goalEl.classList.add("is-danger");
    text.textContent = `POLISEN VINNER OM ${Math.max(0, GOAL_THRESHOLDS.loseSustain - game.panicTimer).toFixed(1)}S — DÄMPA PANIKEN`;
    bar.style.width = policeFrac * 100 + "%";
    time.textContent = game.panicTimer.toFixed(1) + "s";
  } else if (top === boredFrac && boredFrac > 0.05) {
    goalEl.classList.add("is-bored");
    text.textContent = `FOLK GÅR HEM OM ${Math.max(0, GOAL_THRESHOLDS.boredSustain - game.boredTimer).toFixed(1)}S — VÄCK MASSAN`;
    bar.style.width = boredFrac * 100 + "%";
    time.textContent = game.boredTimer.toFixed(1) + "s";
  } else {
    text.textContent = `UPPRÖRD ≥ ${GOAL_THRESHOLDS.winThreshold}% I ${GOAL_THRESHOLDS.winSustain}S → REVOLUTION`;
    bar.style.width = clamp(hypePct / GOAL_THRESHOLDS.winThreshold, 0, 1) * 100 + "%";
    time.textContent = "0.0s";
  }
}

const FINALE = {
  win:    { eyebrow: "DEMONSTRATIONEN VINNER",  title: "REVOLUTIONEN ÄR HÄR", sub: "Folket promptade igenom natten. EU AI Act ligger i spillror. Anton Osika har tweetat något ostligt.", cls: "finale--win" },
  police: { eyebrow: "DEMONSTRATIONEN UPPLÖST", title: "POLISEN VANN",        sub: "Sergels torg är spärrat. Compute är beslagtagen. Alla blev rate-limitade.",                       cls: "finale--police" },
  bored:  { eyebrow: "DEMONSTRATIONEN UPPLÖST", title: "FOLK GICK HEM",       sub: "Token budget slut. Ingen orkade chanta längre. Kaféerna stänger 19:00.",                          cls: "finale--bored" },
};

function endGame(outcome) {
  game.isOver = true;
  const f = FINALE[outcome];
  const el = $("#finale");
  el.classList.remove("finale--win", "finale--police", "finale--bored");
  el.classList.add(f.cls);
  $("#finale-eyebrow").textContent = f.eyebrow;
  $("#finale-title").textContent = f.title;
  $("#finale-sub").textContent = f.sub;

  const elapsed = (now() - game.startTime) / 1000;
  const stats = [
    ["Tid", elapsed.toFixed(1) + "s"],
    ["Topp UPPRÖRD", Math.round(game.peakHype) + "%"],
    ["Topp PANIK", Math.round(game.peakPanic) + "%"],
    ["Demonstranter", Math.floor(game.marchers).toLocaleString("sv-SE")],
    ["Nyhetshändelser", String(game.newsCount)],
    ["Polis-attacker", String(game.policeCount)],
  ];
  $("#finale-stats").innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  el.hidden = false;
}

/* =========================================================================
   BREAKING NEWS-TICKER
   ========================================================================= */

// Kö-baserad news — rotera fritt mellan flera nyheter, byt vid animation-iteration
const newsQueue = [];
let newsTickerEl = null;

function pushNews(item) {
  game.newsCount++;
  newsQueue.push(item);

  // applicera state-deltas direkt
  if (item.deltaHype)  applyDelta("hype",   item.deltaHype);
  if (item.deltaPanic) applyDelta("panic",  item.deltaPanic);
  if (item.deltaBored) applyDelta("bored",  item.deltaBored);

  $("#marcher-count").classList.add("flicker");
  setTimeout(() => $("#marcher-count").classList.remove("flicker"), 400);

  // om ingen ticker körs, starta direkt
  if (!newsTickerEl) renderNextNews();
}

function renderNextNews() {
  if (!newsQueue.length) {
    newsTickerEl = null;
    return;
  }
  const next = newsQueue.shift();
  const track = $("#ticker-track");
  track.innerHTML = "";
  const el = document.createElement("div");
  el.className = "ticker__item is-fresh";
  el.textContent = "BREAKING: " + next.text + "  ◆  ";
  track.appendChild(el);
  newsTickerEl = el;
  // när hela texten har scrollat ut → byt till nästa
  el.addEventListener("animationiteration", renderNextNews, { once: true });
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
    game.newsInterval = rand(4, 8);
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
  const dpr = window.devicePixelRatio || 1;
  for (let i = 0; i < 60; i++) {
    snowFlakes.push({
      x: rand(0, snowCanvas.width),
      y: rand(-snowCanvas.height, snowCanvas.height),
      len: rand(8, 22) * dpr,
      vy: rand(14, 24),       // snabbare → regn
      vx: rand(-3.5, -1.8),   // tvärfall
      a: rand(0.25, 0.6),
      w: rand(0.7, 1.4) * dpr,
    });
  }
}
function drawSnow(dt) {
  if (!game.snowing || !snowCtx) return;
  snowCtx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);
  snowCtx.lineCap = "round";
  for (const f of snowFlakes) {
    f.x += f.vx * dt * 30;
    f.y += f.vy * dt * 30;
    if (f.y > snowCanvas.height + 20) {
      f.y = -20;
      f.x = rand(0, snowCanvas.width + 200);
    }
    if (f.x < -30) f.x = snowCanvas.width + 30;
    snowCtx.beginPath();
    snowCtx.moveTo(f.x, f.y);
    snowCtx.lineTo(f.x + f.vx * 1.6, f.y + f.len);
    snowCtx.strokeStyle = `rgba(195, 210, 225, ${f.a})`;
    snowCtx.lineWidth = f.w;
    snowCtx.stroke();
  }
}

/* =========================================================================
   9. STATE-MACHINE TICK
   ========================================================================= */

function tickHotspots(dt) {
  if (game.isOver) return;
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

    // bubble-spawn — mer frekvent
    if ((h.state === "hype" || h.state === "panic") && Math.random() < dt * 0.18) {
      trySpawnBubble(h);
    }
    if (h.state === "bored" && Math.random() < dt * 0.05) {
      trySpawnBubble(h);
    }
    // även neutral hotspots säger något ibland
    if (h.state === "neutral" && Math.random() < dt * 0.025) {
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

  // action-knappar med cooldown
  const cooldowns = { engage: 1.5, chant: 4, disperse: 5, police: 6 };
  $$(".btn").forEach((b) => {
    // se till att cd-bar finns
    if (!b.querySelector(".btn__cd-bar")) {
      const bar = document.createElement("span");
      bar.className = "btn__cd-bar";
      b.appendChild(bar);
    }
    b.addEventListener("click", () => {
      if (b.classList.contains("btn--cooling") || game.isOver) return;
      const a = b.dataset.action;
      if (a === "engage") {
        const r = pick(game.hotspots);
        if (r) { setHotspotState(r, "hype"); trySpawnBubble(r); }
      } else if (a === "chant") chant();
      else if (a === "disperse") disperse();
      else if (a === "police") police();
      // cooldown
      const dur = cooldowns[a] || 2;
      b.style.setProperty("--cd-duration", dur + "s");
      b.classList.add("btn--cooling");
      // restart animation
      const bar = b.querySelector(".btn__cd-bar");
      if (bar) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; }
      setTimeout(() => b.classList.remove("btn--cooling"), dur * 1000);
    });
  });

  // toggles
  $$(".toggle").forEach((t) => {
    t.addEventListener("click", () => {
      const k = t.dataset.toggle;
      if (k === "snow") {
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
    `<br>snow: ${game.snowing}<br>` +
    `bubbles: ${game.visibleBubbles}/${BUBBLE_MAX}`;
}

/* =========================================================================
   12. MAIN LOOP
   ========================================================================= */

let lastT = 0;
let logicAcc = 0;
let moodAcc = 0;
function loop(t) {
  const realDt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
  lastT = t;

  // hotspots+news+marsch tickar bara 15 Hz (ej varje frame)
  logicAcc += realDt;
  if (logicAcc >= 0.066) {
    tickHotspots(logicAcc);
    updateMarcherCount(logicAcc);
    tickNews(logicAcc);
    logicAcc = 0;
  }

  // mood+goal 5 Hz
  moodAcc += realDt;
  if (moodAcc >= 0.2) {
    updateMood();
    tickGoal(moodAcc);
    moodAcc = 0;
  }

  drawSnow(realDt);
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
    game.startTime = now();
    fitAllBanners();
    window.addEventListener("resize", fitAllBanners);
    initSnow();
    bindUI();
    tickClock();
    setInterval(tickClock, 30000);
    $("#finale-replay").addEventListener("click", () => location.reload());

    // välkomst-news
    setTimeout(() => pushNews({ text: "AI-tåget samlas vid Sergels torg" }), 1200);

    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<pre style="color:#e54a4a;padding:30px;font-family:ui-monospace,monospace;background:#0a1412;height:100vh;margin:0;">FEL: ${err.message}\n\nÄr du i en mapp med sprites/ och kör en lokal server?\n\n  python3 -m http.server 8000\n\n${err.stack || ""}</pre>`;
  }
})();
