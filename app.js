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
    pos.style.top = inst.y + "%";
    pos.style.transform = `translate(-50%, -50%) rotate(${tilt}deg)`;

    const el = document.createElement("div");
    el.className = "sprite" + (inst.flip ? " sprite--flipped" : "");
    el.dataset.id = inst.id;
    el.dataset.layer = inst.layer;
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.opacity = layerStyle.opacity;
    el.style.filter = `brightness(${layerStyle.brightness}) saturate(${layerStyle.saturate ?? 1})`;
    if (typeof inst.bobDelay === "number") el.style.animationDelay = inst.bobDelay + "s";
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
  neutral:   42,   // → bored om idle
  hype:      18,   // → exhausted (åter åtstramat efter "för enkelt"-feedback)
  panic:      6,   // → bored
  exhausted: 12,   // → bored
  bored:    Infinity,
};

function setHotspotState(h, next) {
  // SAMMA state → återställ timern (CHANT på redan-hype håller dem hype)
  if (h.state === next) { h.timer = 0; return; }
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
  // combo / power-state
  combo: 0,
  comboReady: false,
  comboLastAt: 0,
  // ambient polis-trigger
  panicHighSince: 0,
  policeLastAuto: 0,
  // dramaturgi
  finalSpurt: false,
  bossTriggered: false,
  midbeatTriggered: false,
  countdownLastShown: -1,
  elapsedSec: 0,    // ackumulerad aktiv speltid (ej wall-clock — paus pausar)
  route: null,      // val-tag från boss-event (boss-riv / boss-utredning / boss-dans)
  // OPENCLAW — auto-engage agent
  openclaw: {
    streak: 0,
    lastHotspot: null,
    lastAt: 0,
    active: false,
    activeUntil: 0,
    intervalId: null,
  },
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

  // sortera på avstånd, ta upp till 6 närmsta inom rimlig radie
  const sorted = [...game.hotspots]
    .map((h) => ({ h, d: (h.absX - px) ** 2 + (h.absY - py) ** 2 }))
    .sort((a, b) => a.d - b.d);

  const cluster = sorted.slice(0, 5).filter((x) => x.d < 320);
  if (!cluster.length) return;

  let hyped = 0;
  let revived = 0;

  cluster.forEach(({ h }, i) => {
    setTimeout(() => {
      // bored/exhausted → lyft till neutral; resten → hype
      if (h.state === "bored" || h.state === "exhausted") {
        setHotspotState(h, "neutral");
        revived++;
      } else if (h.state !== "panic") {
        setHotspotState(h, "hype");
        hyped++;
        if (i === 0) trySpawnBubble(h);
      }
      pulse(h.el);
    }, i * 35);
  });

  window.AIMDAudio?.engage();

  // floater-feedback efter att klustret hunnit landa
  setTimeout(() => {
    const lines = [];
    if (hyped > 0)   lines.push(`+${hyped} HYPE`);
    if (revived > 0) lines.push(`+${revived} VAKEN`);
    if (lines.length) spawnFloater(clientX, clientY, lines.join(" · "), "hype");
  }, cluster.length * 35 + 30);

  trackComboHit();
  trackOpenclawStreak();
}

// audio-anrop togs bort — prototypen var inte i kvalitet ännu

/* ── OPENCLAW · auto-engage agent ──────────────────────── */

function trackOpenclawStreak() {
  if (game.openclaw.active) return; // ingen streak-tracking medan agent kör
  const t = now();
  // 7s-fönster mellan engages — räknas oavsett knapp eller scen-klick
  const within = (t - game.openclaw.lastAt) < 7000;
  game.openclaw.streak = within ? game.openclaw.streak + 1 : 1;
  game.openclaw.lastAt = t;

  if (game.openclaw.streak >= 5) {
    activateOpenclaw();
  }
}

function activateOpenclaw() {
  const DURATION = 6500;
  game.openclaw.active = true;
  game.openclaw.streak = 0;
  game.openclaw.activeUntil = now() + DURATION;

  const flap = $("#openclaw-flap");
  if (flap) {
    flap.classList.remove("is-active");
    void flap.offsetWidth; // restart bar-animation
    flap.style.setProperty("--openclaw-duration", (DURATION / 1000) + "s");
    flap.classList.add("is-active");
  }
  $(".btn--engage")?.classList.add("has-openclaw");

  spawnFloaterCenter("OPENCLAW DEPLOYED", "openclaw");
  pushNews({ text: "OpenClaw släpper agent på torget — auto-engage aktiverat" });

  game.openclaw.intervalId = setInterval(() => {
    if (game.isOver || !game.openclaw.active || now() > game.openclaw.activeUntil) {
      deactivateOpenclaw();
      return;
    }
    autoEngage();
  }, 700);
}

function deactivateOpenclaw() {
  game.openclaw.active = false;
  if (game.openclaw.intervalId) {
    clearInterval(game.openclaw.intervalId);
    game.openclaw.intervalId = null;
  }
  // Refresha combo-fönstret så manuella engages efter OpenClaw fortsätter samma kombo
  game.comboLastAt = now();
  $("#openclaw-flap")?.classList.remove("is-active");
  $(".btn--engage")?.classList.remove("has-openclaw");
}

/** Lättare än manuell engage — 1 hotspot, ingen cluster, ingen combo. */
function autoEngage() {
  const targets = game.hotspots.filter(
    (h) => h.state === "neutral" || h.state === "bored" || h.state === "exhausted"
  );
  if (!targets.length) return;
  const h = pick(targets);
  if (h.state === "bored" || h.state === "exhausted") {
    setHotspotState(h, "neutral"); // bara väck
  } else {
    setHotspotState(h, "hype");
  }
  pulse(h.el);
}

function chant() {
  // våg bakifrån fram — lyfter exhausted/bored med lägre chans (de ÄR slutkörda)
  const layerOrder = ["back", "mid", "front"];
  let totalHyped = 0;
  layerOrder.forEach((layer, i) => {
    setTimeout(() => {
      for (const h of game.hotspots) {
        if (h.layer !== layer) continue;
        if (h.state === "panic") continue;
        // tröttare folk = svårare att tända
        const p = (h.state === "exhausted" || h.state === "bored") ? 0.42 : 0.62;
        if (Math.random() < p) {
          setHotspotState(h, "hype");
          totalHyped++;
          if (Math.random() < 0.08) trySpawnBubble(h);
        }
      }
    }, i * 380);
  });
  setTimeout(() => {
    const pct = Math.round((totalHyped / Math.max(1, game.hotspots.length)) * 100);
    spawnFloaterCenter(`CHANT! +${pct}% HYPE`, "chant");
  }, 1200);
}

function disperse() {
  // BARA panic — defensiv lugn-knapp
  game.dispersedAt = now();
  const panicked = game.hotspots.filter((h) => h.state === "panic");
  panicked.forEach((h, i) => {
    setTimeout(() => {
      setHotspotState(h, "neutral");
      pulse(h.el);
    }, i * 30);
  });
  if (panicked.length > 0) {
    spawnFloaterCenter(`LUGNT! −${panicked.length} PANIK`, "calm");
  } else {
    spawnFloaterCenter("INGEN PANIK ATT LUGNA", "muted");
  }
}

/** MEGAFON — power-move. Stort hype-spike, screen-flash, shake.
 *  Combo-ready → fri och dubbelt så stark. */
function megafon() {
  const ready = consumeCombo();
  const cut = ready ? 0.60 : 0.42;

  const candidates = game.hotspots.filter((h) => h.state !== "hype" && h.state !== "panic");
  const target = Math.ceil(candidates.length * cut);
  const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, target);

  shuffled.forEach((h, i) => {
    setTimeout(() => {
      setHotspotState(h, "hype");
      if (Math.random() < 0.15) trySpawnBubble(h);
      pulse(h.el);
    }, i * 10);
  });

  // EA-touch: fullskärms-flash + shake + scen-puls
  const flash = document.createElement("div");
  flash.className = "megafon-flash" + (ready ? " megafon-flash--combo" : "");
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 850);

  game.scene.sceneEl.classList.remove("is-shaking");
  void game.scene.sceneEl.offsetWidth;
  game.scene.sceneEl.classList.add("is-shaking");
  setTimeout(() => game.scene.sceneEl.classList.remove("is-shaking"), 600);

  const pct = Math.round((shuffled.length / Math.max(1, game.hotspots.length)) * 100);
  spawnFloaterCenter(ready ? `COMBO! MEGAFON +${pct}%` : `MEGAFON! +${pct}% HYPE`, "megafon");
}

/* ── COMBO / FLOATERS — feel-juice ─────────────────────── */

function trackComboHit() {
  const t = now();
  // OpenClaw aktiv → frys combo-fönstret (annars resettas combo p.g.a. 6.5s tystnad)
  const window_ms = 3000;
  if (!game.openclaw.active && (t - game.comboLastAt > window_ms)) {
    game.combo = 0;
  }
  game.comboLastAt = t;
  game.combo++;

  if (game.combo >= 7 && !game.comboReady) {
    game.comboReady = true;
    const mb = $(".btn--megafon");
    mb?.classList.add("btn--ready");
    spawnFloaterCenter("COMBO! MEGAFON FRI", "combo");
  }
  updateComboUI();
}

function consumeCombo() {
  if (!game.comboReady) return false;
  game.comboReady = false;
  game.combo = 0;
  $(".btn--megafon")?.classList.remove("btn--ready");
  updateComboUI();
  return true;
}

function updateComboUI() {
  const pips = $("#megafon-pips");
  const sub  = $("#megafon-sub");
  if (pips) {
    const lit = clamp(game.combo, 0, 7);
    [...pips.children].forEach((el, i) => el.classList.toggle("is-on", i < lit));
  }
  if (sub) {
    sub.textContent = game.comboReady
      ? "KOMBO FRI · DUBBEL EFFEKT"
      : (game.combo > 0 ? `KOMBO ${game.combo}/7 · power-move` : "power-move · 14s");
  }
}

function spawnFloater(clientX, clientY, text, type = "hype") {
  const f = document.createElement("div");
  f.className = "floater floater--" + type;
  f.textContent = text;
  // mikro-jitter så staplade pop-ups inte överlappar
  const jx = (Math.random() - 0.5) * 24;
  f.style.left = (clientX + jx) + "px";
  f.style.top  = clientY + "px";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}

function spawnFloaterCenter(text, type = "hype") {
  if (!game.scene?.sceneEl) return;
  const r = game.scene.sceneEl.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 3;
  spawnFloater(x, y, text, type);
}

/* ── SLUTSPURT-banner — visuellt klimax på 70s ─────────── */
function showSpurtBanner() {
  const banner = document.createElement("div");
  banner.className = "spurt-banner";
  banner.innerHTML = `
    <span class="spurt-banner__eyebrow">SISTA 20 SEKUNDERNA</span>
    <span class="spurt-banner__title">SLUTSPURT</span>
    <span class="spurt-banner__sub">Win-timer räknas snabbare · varje sekund avgör</span>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add("is-visible"));
  setTimeout(() => {
    banner.classList.remove("is-visible");
    setTimeout(() => banner.remove(), 500);
  }, 2600);
  pushNews({ text: "SISTA 20 SEKUNDERNA — torget håller andan" });
}

/* ── ENDING TRACKER + best-time ───────────────────────── */
const REACHABLE_ENDINGS = [
  "win-eqt", "win-flag", "win-bali",
  "police-eu", "police-fika",
  "bored-acquired", "bored-cellucor", "bored-arland",
];

function trackEnding(key) {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem("aimd_endings_seen") || "[]"); } catch (e) {}
  const isNew = !seen.includes(key);
  if (isNew) {
    seen.push(key);
    try { localStorage.setItem("aimd_endings_seen", JSON.stringify(seen)); } catch (e) {}
  }
  return { isNew, count: seen.filter((k) => REACHABLE_ENDINGS.includes(k)).length, total: REACHABLE_ENDINGS.length };
}

function renderLeaderboard(currentKey) {
  let seen = [], times = {};
  try { seen  = JSON.parse(localStorage.getItem("aimd_endings_seen") || "[]"); } catch (e) {}
  try { times = JSON.parse(localStorage.getItem("aimd_best_times")   || "{}"); } catch (e) {}

  const ROWS = [
    { key: "win-eqt",        short: "EQT",       full: "EQT KÖPTE TÅGET",        type: "win"   },
    { key: "win-flag",       short: "BLÅ-GUL",   full: "BLÅ-GUL REVOLUTION",     type: "win"   },
    { key: "win-bali",       short: "BALI",      full: "FORTSATTE PÅ ZOOM",      type: "win"   },
    { key: "police-eu",      short: "EU",        full: "EU-KOMMISSIONÄREN VANN", type: "police"},
    { key: "police-fika",    short: "FIKA",      full: "POLISEN BJÖD PÅ BULLE",  type: "police"},
    { key: "bored-acquired", short: "ACQUIRED",  full: "ALLA LYSSNADE PÅ ACQUIRED", type: "bored" },
    { key: "bored-cellucor", short: "CELLUCOR",  full: "CELLUCOR-LAGRET TOG SLUT",  type: "bored" },
    { key: "bored-arland",   short: "ARLANDA",   full: "TÅGET FLÖG TILL SF",     type: "bored" },
  ];

  let host = $("#finale-leaderboard");
  if (host) host.remove(); // rensa gammal node för att undvika dubbletter
  host = document.createElement("div");
  host.id = "finale-leaderboard";
  host.className = "finale__leaderboard";
  const stats = $("#finale-stats");
  stats?.parentNode?.insertBefore(host, stats.nextSibling);

  const cells = ROWS.map((r) => {
    const unlocked = seen.includes(r.key);
    const isCurrent = r.key === currentKey;
    const t = times[r.key];
    const time = unlocked && t ? `${t.toFixed(1)}s` : (unlocked ? "—" : "");
    const cls = [
      "lb__cell",
      `lb__cell--${r.type}`,
      unlocked ? "is-unlocked" : "is-locked",
      isCurrent ? "is-current" : "",
    ].join(" ");
    return `<div class="${cls}" title="${r.full}">
      <span class="lb__short">${unlocked ? r.short : "???"}</span>
      <span class="lb__time">${time}</span>
    </div>`;
  }).join("");

  host.innerHTML = `
    <div class="lb__head">UTFALLS-TAVLA · ${seen.filter(k => ROWS.some(r => r.key === k)).length}/${ROWS.length}</div>
    <div class="lb__grid">${cells}</div>
  `;
}

function trackBestTime(key, elapsed) {
  if (!key.startsWith("win")) return null;
  let store = {};
  try { store = JSON.parse(localStorage.getItem("aimd_best_times") || "{}"); } catch (e) {}
  const prev = store[key];
  const isNew = !prev || elapsed < prev;
  if (isNew) {
    store[key] = elapsed;
    try { localStorage.setItem("aimd_best_times", JSON.stringify(store)); } catch (e) {}
  }
  return { isNew, time: store[key], previous: prev };
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
      if (Math.random() < 0.60 - i * 0.012) setHotspotState(h, "panic");
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

function findFreeBubbleSlot(targetX, targetY) {
  // försök hitta en plats där bubblan inte överlappar befintliga
  const existing = Array.from(document.querySelectorAll(".bubble"));
  if (!existing.length) return [targetX, targetY];
  const sceneRect = game.scene.sceneEl.getBoundingClientRect();
  const offsets = [
    [0, 0], [0, -7], [10, -3], [-10, -3], [16, -8], [-16, -8],
    [6, 5], [-6, 5], [20, 0], [-20, 0], [0, -14], [12, -12], [-12, -12],
  ];
  for (const [dx, dy] of offsets) {
    const x = clamp(targetX + dx, 12, 88);
    const y = clamp(targetY + dy, 28, 70);
    let collide = false;
    for (const b of existing) {
      if (!b.classList.contains("bubble--visible")) continue;
      const r = b.getBoundingClientRect();
      const bx = ((r.left + r.width / 2 - sceneRect.left) / sceneRect.width) * 100;
      const by = ((r.bottom - sceneRect.top) / sceneRect.height) * 100;
      // bubble har approximativ bredd 16% / höjd 6% av scen
      if (Math.abs(bx - x) < 16 && Math.abs(by - y) < 7) { collide = true; break; }
    }
    if (!collide) return [x, y];
  }
  return [clamp(targetX, 12, 88), clamp(targetY, 28, 70)];
}

function formatBubbleText(text) {
  // *...* → italic action-text
  const escaped = text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return escaped.replace(/\*([^*]+)\*/g, '<em class="bubble__action">$1</em>');
}

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
  b.innerHTML = formatBubbleText(text);
  // hitta non-overlapping plats för bubblan
  const [x, y] = findFreeBubbleSlot(h.absX, h.absY);
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
  winThreshold: 70, winSustain: 11,
  loseThreshold: 70, loseSustain: 10,
  boredThreshold: 75, boredSustain: 32,
};

// Match-tid + dramaturgi
const MATCH_DURATION  = 90;  // sek total speltid
const FINAL_SPURT_AT  = 70;  // sek då slutspurt triggas (20s kvar)
const BOSS_EVENT_AT   = 28;  // sek då boss-eventet triggas (tidigt så de flesta hinner se det)
const SPURT_WIN_BOOST = 1.35; // win-timer multiplier under spurt (mildare comeback)

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

  // ── DRAMATURGI: match-tid, boss-event, slutspurt, hard time-out ──
  game.elapsedSec += dt;
  const elapsedSec = game.elapsedSec;

  // Boss-event — alltid (om event-system finns och inget redan kör)
  if (elapsedSec >= BOSS_EVENT_AT && !game.bossTriggered && !game.paused) {
    const evMgr = window.AIMayDayEvents;
    if (evMgr && !evMgr.activeModal && typeof evMgr.triggerById === "function") {
      game.bossTriggered = true;
      evMgr.triggerById("statsminister-anlander");
    }
    // om event-system inte redo eller annan modal kör → vänta nästa tick
  }

  // Mid-beat: 50s in — fyller döda zonen mellan boss och spurt
  if (elapsedSec >= 50 && !game.midbeatTriggered && !game.paused) {
    game.midbeatTriggered = true;
    const beats = [
      "Lovable släpper agent-SDK på torget — demonstranter laddar ner live",
      "DN-fotograf täcker tåget — ledarsidan har redan vinkeln klar",
      "Spotify pushar reklam till alla i området — 'Lyssna på AI MAY DAY-podden'",
      "EU-byråkraten anländer med 40 sidor formulär — torget pausar i panik",
      "Kommunen bjuder kaffe från Pressbyrån — alla pausar 4 minuter",
    ];
    pushNews({ text: pick(beats) });
  }

  // Slutspurt: 70s in (men inte mitt i en event-modal — vänta tills den stängs)
  if (elapsedSec >= FINAL_SPURT_AT && !game.finalSpurt && !game.paused) {
    game.finalSpurt = true;
    document.body.classList.add("is-final-spurt");
    showSpurtBanner();
  }

  // Sista 5 sekunderna: stor countdown 5,4,3,2,1
  if (game.finalSpurt) {
    const remaining = Math.max(0, MATCH_DURATION - elapsedSec);
    const sec = Math.ceil(remaining);
    if (sec <= 5 && sec >= 1 && sec !== game.countdownLastShown) {
      game.countdownLastShown = sec;
      spawnFloaterCenter(String(sec), "countdown");
    }
  }

  // 90s nådd utan win/lose → defaulta utfallet på dominant state
  if (elapsedSec >= MATCH_DURATION) {
    if (hypePct >= 50)        return endGame("win");
    if (panicPct >= boredPct) return endGame("police");
    return endGame("bored");
  }

  const winMul = game.finalSpurt ? SPURT_WIN_BOOST : 1;
  game.winTimer   = hypePct  >= GOAL_THRESHOLDS.winThreshold   ? game.winTimer + dt * winMul : Math.max(0, game.winTimer - dt * 1.4);
  game.panicTimer = panicPct >= GOAL_THRESHOLDS.loseThreshold  ? game.panicTimer + dt        : Math.max(0, game.panicTimer - dt * 1.4);
  game.boredTimer = boredPct >= GOAL_THRESHOLDS.boredThreshold ? game.boredTimer + dt        : Math.max(0, game.boredTimer - dt * 0.8);

  // Ambient polis-trigger: när panic ligger högt en stund anländer polisen själv
  if (panicPct >= 50) {
    if (game.panicHighSince === 0) game.panicHighSince = now();
    const sustained = (now() - game.panicHighSince) / 1000;
    if (sustained > 4 && now() - game.policeLastAuto > 9000) {
      game.policeLastAuto = now();
      police();
      pushNews({ text: "Polisen anländer från Klarabergsgatan — paniken har triggat insats" });
    }
  } else {
    game.panicHighSince = 0;
  }

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
  // huvud-utfall
  win:    { eyebrow: "DEMONSTRATIONEN VINNER",  title: "REVOLUTIONEN ÄR HÄR", sub: "Folket promptade igenom natten. EU AI Act ligger i spillror. Lovable-grundaren har tweetat något ostligt.", cls: "finale--win" },
  police: { eyebrow: "DEMONSTRATIONEN UPPLÖST", title: "POLISEN VANN",        sub: "Sergels torg är spärrat. Compute är beslagtagen. Alla blev rate-limitade.",                       cls: "finale--police", keyArt: "./sprites/vinst/POLIS.png" },
  bored:  { eyebrow: "DEMONSTRATIONEN UPPLÖST", title: "FOLK GICK HEM",       sub: "Token budget slut. Ingen orkade chanta längre. Kaféerna stänger 19:00.",                          cls: "finale--bored" },

  // namngivna varianter (Reigns-style)
  "win-eqt":         { eyebrow: "DEMONSTRATIONEN ÖVERTAGEN", title: "EQT KÖPTE TÅGET",          sub: "Demonstrationen är nu en portfolio-tillgång. Värderingen sattes till 4,2 mdr.",       cls: "finale--win", keyArt: "./sprites/vinst/EQT.png" },
  "win-flag":        { eyebrow: "RIKSDAGEN VÄNDER",          title: "BLÅ-GUL REVOLUTION",       sub: "EU AI Act rivs upp på lunchen. Lovable-grundaren blir ny näringsminister.",            cls: "finale--win" },
  "win-bali":        { eyebrow: "TÅGET FORTSÄTTER PÅ ZOOM",  title: "DEMONSTRATIONEN ÅKER TILL BALI", sub: "Hela 1 maj fortsätter på distans. WiFi:t är förvånansvärt bra.",                cls: "finale--win", keyArt: "./sprites/vinst/BALI.png" },
  "police-eu":       { eyebrow: "DEMONSTRATIONEN BYRÅKRATISERAD", title: "EU-KOMMISSIONÄREN VANN", sub: "Alla skrev under formulär 7B. Solen gick ner. Vi är fortfarande på rad 12.",       cls: "finale--police" },
  "police-fika":     { eyebrow: "DEMONSTRATIONEN FIKABRYTNINGEN", title: "POLISEN BJÖD PÅ BULLE",  sub: "Tåget upplöstes vid kaffeautomaten. Polischefen tog en kanelbulle.",              cls: "finale--police" },
  "bored-acquired":  { eyebrow: "DEMONSTRATIONEN POD-AVBRUTEN",  title: "ALLA LYSSNADE PÅ ACQUIRED", sub: "Det blev ett 4-timmars-avsnitt om TSMC. Ingen kom tillbaka.",                    cls: "finale--bored" },
  "bored-cellucor":  { eyebrow: "DEMONSTRATIONEN SLUT PÅ ENERGI", title: "CELLUCOR-LAGRET TOG SLUT", sub: "Pressbyrån tog slut. Ingen orkade gå längre. Det var ändå överskattat.",        cls: "finale--bored" },
  "bored-arland":    { eyebrow: "DEMONSTRATIONEN UTVANDRAD",     title: "TÅGET FLÖG TILL SF",        sub: "Sista 80% bokade Lufthansa-tickets. Stockholm är åter en provinshåla.",         cls: "finale--bored" },
};

function endGame(outcome) {
  game.isOver = true;
  // om outcome redan är en specifik key (t.ex. 'win-eqt') — använd den direkt
  let key = outcome;
  if (outcome === "win") {
    // Boss-val styr utfall i första hand — varje körning får ett tydligt val
    if (game.route === "boss-riv")            key = "win-eqt";   // aggressiv route
    else if (game.route === "boss-dans")      key = "win-bali";  // viralt/escapism
    else if (game.route === "boss-utredning") key = "win-flag";  // lugn route
    else {
      // ingen boss träffad (t.ex. snabbvinst före 28s) → tröskel-fallback
      if (game.peakPanic > 25)        key = "win-eqt";
      else if (game.policeCount > 0)  key = "win-bali";
      else if (game.newsCount > 6)    key = "win-bali";
      else                            key = "win-flag";
    }
  } else if (outcome === "police") {
    if (game.newsCount > 6) key = "police-eu";
    else key = "police-fika";
  } else if (outcome === "bored") {
    if (game.newsCount > 5) key = "bored-acquired";
    else if (game.peakHype < 30) key = "bored-arland";
    else key = "bored-cellucor";
  }
  // (om outcome är en exakt FINALE-key används den as-is)
  const f = FINALE[key] || FINALE[outcome];
  const el = $("#finale");
  el.classList.remove("finale--win", "finale--police", "finale--bored");
  el.classList.add(f.cls);

  // VERDICT-banner: VINST / FÖRLUST tydligt visuellt
  const isWin = f.cls === "finale--win";
  const verdictLabel = isWin ? "VINST" : "FÖRLUST";
  const verdictIcon = isWin ? "★" : (f.cls === "finale--police" ? "⌧" : "·");
  const verdictEl = $("#finale-verdict");
  if (verdictEl) {
    verdictEl.classList.remove("finale__verdict--win", "finale__verdict--loss");
    verdictEl.classList.add(isWin ? "finale__verdict--win" : "finale__verdict--loss");
  }
  const labEl = $("#finale-verdict-label");
  const iconEl = $("#finale-verdict-icon");
  if (labEl) labEl.textContent = verdictLabel;
  if (iconEl) iconEl.textContent = verdictIcon;

  $("#finale-eyebrow").textContent = f.eyebrow;
  $("#finale-title").textContent = f.title;
  $("#finale-sub").textContent = f.sub;

  // KEY-ART (om finns för utfallet)
  const card = $(".finale__card");
  let keyArtEl = $("#finale-keyart");
  if (f.keyArt) {
    if (!keyArtEl) {
      keyArtEl = document.createElement("div");
      keyArtEl.id = "finale-keyart";
      keyArtEl.className = "finale__keyart";
      keyArtEl.innerHTML = `<img alt="${f.title}" />`;
      card.insertBefore(keyArtEl, card.firstChild);
    }
    const img = keyArtEl.querySelector("img");
    img.onerror = () => keyArtEl.remove();
    img.src = f.keyArt;
    keyArtEl.style.display = "";
  } else if (keyArtEl) {
    keyArtEl.style.display = "none";
  }

  const elapsed = game.elapsedSec || ((now() - game.startTime) / 1000);

  // Ending-tracker + best-time
  const endingInfo = trackEnding(key);
  const bestInfo   = trackBestTime(key, elapsed);

  // Kompakt stat-grid — varje fält kort så de får plats i 2-kolumns layout
  const tidStr = elapsed.toFixed(1) + "s";
  let rekordStr;
  if (bestInfo) {
    if (bestInfo.isNew && bestInfo.previous) {
      rekordStr = `★ NY ${elapsed.toFixed(1)}s`;
    } else if (bestInfo.isNew) {
      rekordStr = `★ FÖRSTA`;
    } else {
      rekordStr = bestInfo.time.toFixed(1) + "s";
    }
  } else {
    rekordStr = "—";
  }

  const stats = [
    ["Tid", tidStr],
    ["Rekord", rekordStr],
    ["Utfall", `${endingInfo.count}/${endingInfo.total}` + (endingInfo.isNew ? " ★" : "")],
    ["Topp UPPRÖRD", Math.round(game.peakHype) + "%"],
    ["Topp PANIK", Math.round(game.peakPanic) + "%"],
    ["Polis", String(game.policeCount)],
  ];
  $("#finale-stats").innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

  // LEADERBOARD: alla 8 utfall i en grid med best-time per win
  renderLeaderboard(key);

  // Visa "NYTT UTFALL HITTAT"-celebration om första gången på detta key
  if (endingInfo.isNew) {
    el.classList.add("finale--new-ending");
  } else {
    el.classList.remove("finale--new-ending");
  }

  // SHARE-knappar: bygg share-text + render knappar
  buildShareButtons(f, { elapsed, key });

  el.hidden = false;
}

function buildShareButtons(finale, ctx) {
  const url = "https://ai-may-day.vercel.app";
  const isWin = finale.cls === "finale--win";
  const verb = isWin ? "vann" : "förlorade";
  const text =
    `Jag ${verb} AI MAY DAY 1 maj 2026: ${finale.title} 🇸🇪\n` +
    `${finale.sub}\n\n` +
    `Topp UPPRÖRD ${Math.round(game.peakHype)}% · ${Math.floor(game.marchers).toLocaleString("sv-SE")} demonstranter · ${game.newsCount} nyheter\n\n` +
    `Spela: ${url}`;

  const targets = [
    { id: "x",        label: "𝕏",       title: "Dela på X",        url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` },
    { id: "bsky",     label: "BSKY",    title: "Dela på Bluesky",  url: `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}` },
    { id: "linkedin", label: "IN",      title: "Dela på LinkedIn", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { id: "copy",     label: "KOPIERA", title: "Kopiera text",     url: null },
  ];

  let host = $("#finale-share");
  if (!host) {
    host = document.createElement("div");
    host.id = "finale-share";
    host.className = "finale__share";
    const card = $(".finale__card");
    const btn = $("#finale-replay");
    if (card && btn) card.insertBefore(host, btn);
  }
  host.innerHTML =
    `<div class="finale__share-label">DELA UTFALLET</div>
     <div class="finale__share-buttons"></div>`;
  const btnHost = host.querySelector(".finale__share-buttons");
  for (const t of targets) {
    const b = document.createElement("button");
    b.className = "finale__share-btn finale__share-btn--" + t.id;
    b.type = "button";
    b.title = t.title;
    b.innerHTML = `<span class="finale__share-btn__icon">${t.label}</span>`;
    b.addEventListener("click", (e) => {
      if (t.id === "copy") {
        navigator.clipboard.writeText(text).then(() => {
          b.classList.add("finale__share-btn--copied");
          b.querySelector(".finale__share-btn__icon").textContent = "KOPIERAT!";
          setTimeout(() => {
            b.classList.remove("finale__share-btn--copied");
            b.querySelector(".finale__share-btn__icon").textContent = t.label;
          }, 1800);
        }).catch(() => {});
      } else {
        window.open(t.url, "_blank", "noopener,noreferrer,width=560,height=620");
      }
    });
    btnHost.appendChild(b);
  }
}

/* =========================================================================
   BREAKING NEWS-TICKER
   ========================================================================= */

// Kö-baserad news — rotera fritt mellan flera nyheter, byt vid animation-iteration
const newsQueue = [];
let newsTickerEl = null;
let tickerReactTimer = null;

function pushNews(item) {
  if (!item.skipNewsBump) {
    game.newsCount++;
    $("#marcher-count").classList.add("flicker");
    setTimeout(() => $("#marcher-count").classList.remove("flicker"), 400);
  }

  newsQueue.push(item);

  // applicera state-deltas direkt
  if (item.deltaHype)  applyDelta("hype",   item.deltaHype);
  if (item.deltaPanic) applyDelta("panic",  item.deltaPanic);
  if (item.deltaBored) applyDelta("bored",  item.deltaBored);

  // om ingen ticker körs, starta direkt
  if (!newsTickerEl) renderNextNews();
}

function pulseTickerFromPlayerChoice() {
  const bar = document.querySelector(".ticker.ticker--top");
  if (!bar) return;
  bar.classList.remove("ticker--react");
  void bar.offsetWidth;
  bar.classList.add("ticker--react");
  if (tickerReactTimer) clearTimeout(tickerReactTimer);
  tickerReactTimer = setTimeout(() => bar.classList.remove("ticker--react"), 2400);
}

/** Rubrik efter dialog-event — föredra explicit choice.news (rapport-stil),
 *  annars auto-generera journalistisk one-liner från archetype + effekt.
 *  Påverkar inte newsCount. */
function pushEventNews({ choice, archetypeName }) {
  if (!choice) return;

  let text;
  if (choice.news) {
    // Spel-skribenten har skrivit en explicit nyhetsrubrik
    text = choice.news;
  } else {
    // Auto-generator: bygg en reporter-stil headline från archetype + delta
    const eff = choice.effect || {};
    const entries = Object.entries(eff);
    let domState = null, domDelta = 0;
    for (const [k, v] of entries) {
      if (Math.abs(v) > Math.abs(domDelta)) { domState = k; domDelta = v; }
    }
    const verb = (domState === "hype"  && domDelta > 0)  ? "exalterar tåget"
              : (domState === "hype"  && domDelta < 0)  ? "dämpar parollerna"
              : (domState === "panic" && domDelta > 0)  ? "skapar oro på torget"
              : (domState === "panic" && domDelta < 0)  ? "lugnar paniken"
              : (domState === "bored" && domDelta > 0)  ? "tråkar ut massan"
              : (domState === "exhausted" && domDelta > 0) ? "utmattar leden"
              : "möter tåget";
    text = `${archetypeName} ${verb}`;
  }
  if (choice.unlock) text = `Ny paroll: '${choice.unlock}' · ${text}`;
  pushNews({ text, fromEvent: true, skipNewsBump: true });
}

function renderNextNews() {
  // när kö tom → dra färsk från pool så ticker aldrig stannar
  const next = newsQueue.length
    ? newsQueue.shift()
    : (game.config?.news?.length ? pick(game.config.news) : null);
  if (!next) { newsTickerEl = null; return; }

  const track = $("#ticker-track");
  track.innerHTML = "";
  const el = document.createElement("div");
  el.className = "ticker__item is-fresh" + (next.fromEvent ? " is-from-player" : "");
  el.textContent =
    (next.fromEvent ? "BREAKING · DITT VAL: " : "BREAKING: ") + next.text + "  ◆  ";
  track.appendChild(el);
  newsTickerEl = el;
  if (next.fromEvent) pulseTickerFromPlayerChoice();
  // animationend = item har scrollat ut helt → kör nästa direkt
  el.addEventListener("animationend", renderNextNews, { once: true });
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

  // OVERHEAT — när hype-pct är hög leakar enstaka hyped → panic
  // (en överhettad massa kantrar lätt; gör trivial mass-hype-strategi orealistisk)
  let hypeCount = 0;
  for (const h of game.hotspots) if (h.state === "hype") hypeCount++;
  const hypePct = (hypeCount / Math.max(1, game.hotspots.length)) * 100;
  let overheatChance = 0;
  if (hypePct > 80) overheatChance = (hypePct - 80) / 140; // mildare leak, först över 80%

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

    // overheat-spillover: hyped i het massa kan kantra till panik
    if (h.state === "hype" && overheatChance > 0 && Math.random() < dt * overheatChance) {
      setHotspotState(h, "panic");
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

/* =========================================================================
   ONBOARDING — visas första gången, max 2 screens
   ========================================================================= */

const ONBOARD_STORAGE_KEY = "aimd_onboarded_v1";

function initOnboarding() {
  const el = $("#onboard");
  if (!el) return;
  const params = new URLSearchParams(location.search);

  // Hoppa helt om: dev-flagga, redan setts, eller spelet startar med tvång
  if (params.has("event") || params.has("finale") || params.get("intro") === "skip") return;
  let alreadySeen = false;
  try { alreadySeen = !!localStorage.getItem(ONBOARD_STORAGE_KEY); } catch (e) {}
  if (alreadySeen && params.get("intro") !== "1") return;

  // Pause spelet medan onboardingen är uppe
  let onboardPausedGame = false;
  if (!game.paused) {
    onboardPausedGame = true;
    game.paused = true;
    document.body.classList.add("is-paused");
  }

  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("is-visible"));

  function goToScreen2() {
    el.classList.add("is-screen-2");
    $("#onboard-scene")?.setAttribute("hidden", "");
    $("#onboard-how")?.removeAttribute("hidden");
    activeScreen = 2;
  }
  function close() {
    el.classList.remove("is-visible");
    el.classList.add("is-closing");
    setTimeout(() => {
      el.hidden = true;
      el.classList.remove("is-closing", "is-screen-2");
    }, 360);
    try { localStorage.setItem(ONBOARD_STORAGE_KEY, String(Date.now())); } catch (e) {}
    if (onboardPausedGame) {
      onboardPausedGame = false;
      game.paused = false;
      document.body.classList.remove("is-paused");
    }
    window.removeEventListener("keydown", keyHandler);
  }

  let activeScreen = 1;

  $("#onboard-next")?.addEventListener("click", goToScreen2);
  $("#onboard-start")?.addEventListener("click", close);
  $("#onboard-skip")?.addEventListener("click", close);

  function keyHandler(e) {
    if (el.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      if (activeScreen === 1) goToScreen2();
      else close();
    }
  }
  window.addEventListener("keydown", keyHandler);
}

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

  // ONBOARDING: visas första gången, sparas i localStorage
  initOnboarding();

  // howto-modal: klick på MÅL-baren öppnar speltips
  const howtoEl = $("#howto");
  const goalBtn = $("#goal");
  let howtoPausedGame = false;
  function openHowto() {
    if (!howtoEl) return;
    howtoEl.hidden = false;
    requestAnimationFrame(() => howtoEl.classList.add("is-visible"));
    if (!game.paused) { howtoPausedGame = true; game.paused = true; document.body.classList.add("is-paused"); }
  }
  function closeHowto() {
    if (!howtoEl) return;
    howtoEl.classList.remove("is-visible");
    setTimeout(() => { howtoEl.hidden = true; }, 240);
    if (howtoPausedGame) { howtoPausedGame = false; game.paused = false; document.body.classList.remove("is-paused"); }
  }
  if (goalBtn) goalBtn.addEventListener("click", openHowto);
  $("#howto-close")?.addEventListener("click", closeHowto);
  $("#howto-ok")?.addEventListener("click", closeHowto);
  howtoEl?.addEventListener("click", (e) => { if (e.target === howtoEl) closeHowto(); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && howtoEl && !howtoEl.hidden) {
      e.preventDefault();
      closeHowto();
    }
  });

  // action-knappar med cooldown
  const cooldowns = { engage: 1.0, chant: 5, disperse: 4, megafon: 12 };
  $$(".btn").forEach((b) => {
    // se till att cd-bar finns
    if (!b.querySelector(".btn__cd-bar")) {
      const bar = document.createElement("span");
      bar.className = "btn__cd-bar";
      b.appendChild(bar);
    }
    b.addEventListener("click", () => {
      const a = b.dataset.action;
      const isFreeMegafon = (a === "megafon" && game.comboReady);
      if (!isFreeMegafon && b.classList.contains("btn--cooling")) return;
      if (game.isOver) return;

      // klicka anywhere på ENGAGE-knappen → skjut floater från knapp-mitten
      if (a === "engage") {
        // pick-and-engage på en slumpmässig hotspot från knapptryck (utan koord)
        const r = pick(game.hotspots);
        if (r) {
          const sceneR = game.scene.sceneEl.getBoundingClientRect();
          const cx = sceneR.left + (r.absX / 100) * sceneR.width;
          const cy = sceneR.top  + (r.absY / 100) * sceneR.height;
          engageAt(cx, cy);
        }
      } else if (a === "chant") chant();
      else if (a === "disperse") disperse();
      else if (a === "megafon") megafon();

      // cooldown — hoppa över för fri combo-megafon
      if (isFreeMegafon) return;
      const dur = cooldowns[a] || 2;
      b.style.setProperty("--cd-duration", dur + "s");
      b.classList.add("btn--cooling");
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
    else if (k === "s") $$(".btn--chant")[0]?.click();
    else if (k === "d") $$(".btn--disperse")[0]?.click();
    else if (k === "f") $$(".btn--megafon")[0]?.click();
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
game.paused = false;
function loop(t) {
  const realDtRaw = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
  lastT = t;
  // pause: ingen state-tick under event-modaler
  const realDt = game.paused ? 0 : realDtRaw;

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
    updateComboUI();
    tickClock();
    setInterval(tickClock, 30000);
    $("#finale-replay").addEventListener("click", () => location.reload());

    // välkomst-news
    setTimeout(() => pushNews({ text: "AI-tåget samlas vid Sergels torg" }), 1200);

    // exponera tunn API för event-systemet (events.js) + dev-hooks
    window.AIMayDay = {
      pauseGame() { game.paused = true; document.body.classList.add("is-paused"); },
      resumeGame() { game.paused = false; document.body.classList.remove("is-paused"); },
      getCrowdState() {
        const counts = { neutral: 0, hype: 0, bored: 0, panic: 0, exhausted: 0 };
        for (const h of game.hotspots) counts[h.state]++;
        const total = game.hotspots.length || 1;
        return {
          hype:      Math.round((counts.hype      / total) * 100),
          panic:     Math.round((counts.panic     / total) * 100),
          bored:     Math.round((counts.bored     / total) * 100),
          exhausted: Math.round((counts.exhausted / total) * 100),
          neutral:   Math.round((counts.neutral   / total) * 100),
        };
      },
      applyDelta,
      addBannerSlogan(text) {
        if (game.config?.bannerSlogans && !game.config.bannerSlogans.includes(text)) {
          game.config.bannerSlogans.push(text);
        }
      },
      pushNews,
      pushEventNews,
      isOver: () => game.isOver,
      setRoute(tag) { game.route = tag; },

      // === DEV-HOOKS ===
      forceFinale(key, fakeStats = true) {
        if (fakeStats) {
          // sätt plausibla stats för att share-text och stats-rader ser vettiga ut
          game.peakHype  = key.startsWith("win") ? rand(70, 95) : rand(20, 60);
          game.peakPanic = key.startsWith("police") ? rand(70, 90) : rand(10, 50);
          game.newsCount = randi(3, 12);
          game.policeCount = key.startsWith("police") ? randi(1, 4) : randi(0, 2);
          game.marchers += randi(50, 400);
          game.startTime -= randi(40, 110) * 1000;
        }
        endGame(key);
      },
      forceState(state, pct) {
        applyDelta(state, pct);
      },
      resetGame() { location.reload(); },
    };
    document.dispatchEvent(new CustomEvent("aimayday:ready"));

    // Dev: ?finale=<key>  ?state=<name>:<pct>
    const params = new URLSearchParams(location.search);
    if (params.has("finale")) {
      setTimeout(() => window.AIMayDay.forceFinale(params.get("finale")), 600);
    }
    if (params.has("state")) {
      const [name, pctStr] = params.get("state").split(":");
      if (name) window.AIMayDay.forceState(name, parseInt(pctStr || "50", 10));
    }

    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<pre style="color:#e54a4a;padding:30px;font-family:ui-monospace,monospace;background:#0a1412;height:100vh;margin:0;">FEL: ${err.message}\n\nÄr du i en mapp med sprites/ och kör en lokal server?\n\n  python3 -m http.server 8000\n\n${err.stack || ""}</pre>`;
  }
})();
