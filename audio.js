/* =========================================================================
   AI MAY DAY · audio.js
   Web Audio synthese — ambient crowd-bed + crowd-reaction SFX.
   Inga filer, inga deps, ingen API-nyckel.

   Designprincip:
   - Bed = pink noise + babble-formants (ständigt mumlande crowd)
   - SFX = stackade voices (3–8) med micro-delay → folkmassa, inte solo
   - All pitch i C-pentaton så det aldrig låter musikaliskt fel
   ========================================================================= */

const AIMDAudio = (() => {
  let ctx = null;
  let masterGain = null;
  let bedGain = null;
  let sfxGain = null;
  let bedStarted = false;
  let babbleTimer = null;

  let enabled = (() => {
    try { return localStorage.getItem("aimd_audio_off") !== "1"; }
    catch { return true; }
  })();

  // C-pentaton (Hz) — 2 oktaver
  const PENTA = [
    261.63, 293.66, 329.63, 392.00, 440.00,
    523.25, 587.33, 659.25, 783.99, 880.00,
  ];

  function pickPenta(jitter = 0.025) {
    const base = PENTA[Math.floor(Math.random() * PENTA.length)];
    return base * (1 + (Math.random() - 0.5) * jitter);
  }

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    masterGain = ctx.createGain();
    masterGain.gain.value = enabled ? 1.0 : 0.0;
    masterGain.connect(ctx.destination);

    bedGain = ctx.createGain();
    bedGain.gain.value = 0;
    bedGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.35;
    sfxGain.connect(masterGain);

    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  /* ── Ambient crowd-bed ─────────────────────────────────
     Pink noise (rumble/wind) + babble-formants slumpvis spawned
     ───────────────────────────────────────────────────── */

  function startBed() {
    if (!ctx || bedStarted) return;
    bedStarted = true;

    // pink-noise rumble
    const bufLen = 2 * ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const out = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    lp.Q.value = 0.7;

    const noiseG = ctx.createGain();
    noiseG.gain.value = 0.55;

    // slow LFO på noise-volym för att andas
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.15;
    lfo.connect(lfoG);
    lfoG.connect(noiseG.gain);
    lfo.start();

    noise.connect(lp);
    lp.connect(noiseG);
    noiseG.connect(bedGain);
    noise.start();

    // fade in over 2s
    const t = ctx.currentTime;
    bedGain.gain.setValueAtTime(0, t);
    bedGain.gain.linearRampToValueAtTime(0.18, t + 2);

    // babble-loop
    const tickBabble = () => {
      if (!ctx || !bedStarted) return;
      spawnBabble();
      const wait = 80 + Math.random() * 220;
      babbleTimer = setTimeout(tickBabble, wait);
    };
    tickBabble();
  }

  /** En kort vokalpuls = brus genom två bandpass-filter (formanter F1+F2). */
  function spawnBabble() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const dur = 0.10 + Math.random() * 0.16;

    // [F1, F2] för olika vokaler
    const FORMANTS = [
      [610, 1700], // ah
      [430, 1900], // eh
      [310, 2400], // ee
      [430, 850],  // oh
      [320, 800],  // oo
    ];
    const [f1, f2] = FORMANTS[Math.floor(Math.random() * FORMANTS.length)];

    // kort brus-buffer
    const len = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp1 = ctx.createBiquadFilter();
    bp1.type = "bandpass";
    bp1.frequency.value = f1 * (0.85 + Math.random() * 0.3);
    bp1.Q.value = 9;

    const bp2 = ctx.createBiquadFilter();
    bp2.type = "bandpass";
    bp2.frequency.value = f2 * (0.85 + Math.random() * 0.3);
    bp2.Q.value = 9;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);

    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 1.4;

    src.connect(bp1);
    bp1.connect(bp2);
    bp2.connect(g);
    g.connect(pan);
    pan.connect(bedGain);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  /* ── ENGAGE: liten grupp reagerar (3–5 stackade triangelvoices) ── */
  function engage() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const voiceCount = 3 + Math.floor(Math.random() * 3);
    const baseFreq = pickPenta();

    for (let i = 0; i < voiceCount; i++) {
      // micro-delay 5–25ms = "flera personer reagerar nästan samtidigt"
      const delay = i * (0.005 + Math.random() * 0.02);
      // någon enstaka voice spelar 5:a eller 8va för chord-känsla
      const interval = i === 0 ? 1 : (Math.random() < 0.35 ? 1.5 : (Math.random() < 0.2 ? 2 : 1));
      const freq = baseFreq * interval * (1 + (Math.random() - 0.5) * 0.018);
      const dur = 0.18 + Math.random() * 0.10;

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2400;
      lp.Q.value = 0.9;

      const g = ctx.createGain();
      const startT = t + delay;
      const peak = 0.18 / Math.max(2, voiceCount);
      g.gain.setValueAtTime(0, startT);
      g.gain.linearRampToValueAtTime(peak, startT + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0006, startT + dur);

      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 0.6;

      osc.connect(lp);
      lp.connect(g);
      g.connect(pan);
      pan.connect(sfxGain);
      osc.start(startT);
      osc.stop(startT + dur + 0.05);
    }
  }

  /* ── CHANT: ackord av 8 stämmor som bygger 1 sekund ──── */
  function chant() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const root = 130.81; // C3
    const ratios = [1, 1.5, 2, 2.5, 3]; // root, 5:a, 8va, 8va+5:a, dubbelokt
    const voiceCount = 8;

    for (let i = 0; i < voiceCount; i++) {
      const ratio = ratios[i % ratios.length];
      const freq = root * ratio * (1 + (Math.random() - 0.5) * 0.05);
      const startDelay = (i / voiceCount) * 0.18 + Math.random() * 0.06;
      const dur = 0.95 + Math.random() * 0.25;

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      const startT = t + startDelay;
      filter.frequency.setValueAtTime(700, startT);
      filter.frequency.linearRampToValueAtTime(1900, startT + 0.45);
      filter.frequency.linearRampToValueAtTime(950, startT + dur);
      filter.Q.value = 3.5;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, startT);
      g.gain.linearRampToValueAtTime(0.04, startT + 0.18);
      g.gain.linearRampToValueAtTime(0.058, startT + 0.55);
      g.gain.linearRampToValueAtTime(0.0005, startT + dur);

      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 0.85;

      osc.connect(filter);
      filter.connect(g);
      g.connect(pan);
      pan.connect(sfxGain);
      osc.start(startT);
      osc.stop(startT + dur + 0.1);
    }
  }

  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem("aimd_audio_off", enabled ? "" : "1"); } catch (e) {}
    if (masterGain) masterGain.gain.setTargetAtTime(enabled ? 1.0 : 0.0, ctx.currentTime, 0.05);
  }
  function isEnabled() { return enabled; }

  return { init, startBed, engage, chant, setEnabled, isEnabled };
})();

window.AIMDAudio = AIMDAudio;
