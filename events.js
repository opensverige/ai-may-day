/* =========================================================================
   AI MAY DAY · events.js
   Pausat dialog-event-system. Helt fristående lager. Hookar in via
   window.AIMayDay.{pauseGame,resumeGame,getCrowdState,applyDelta,addBannerSlogan}
   ========================================================================= */

const PARAMS = new URLSearchParams(location.search);
const NO_EVENTS = PARAMS.has("noevents");
const FORCE_EVENT_ID = PARAMS.get("event");

/* -------------------------- ARKETYPER + porträtt -------------------------- */
// Vi har bara två faktiska bilder. Övriga arketyper får fallback (lovable.png),
// och om bild misslyckas visas grå platshållare med arketyp-namn.
const FALLBACK_PORTRAIT = "./sprites/character/lovable.png";

const ARCHETYPES = {
  "vc-partner":   { name: "VC-PARTNERN",   portrait: "./sprites/character/sana.png" },
  "ai-grundare":  { name: "AI-GRUNDAREN",  portrait: "./sprites/character/lovable.png" },
  "fackpamp":     { name: "FACKPAMPEN",    portrait: "./sprites/character/facket.png" },
  "aktivist":     { name: "AKTIVISTEN",    portrait: "./sprites/character/lovable.png" },
  "eu-byrakrat":  { name: "EU-BYRÅKRATEN", portrait: "./sprites/character/sana.png" },
  "journalist":   { name: "JOURNALISTEN",  portrait: "./sprites/character/lovable.png" },
  "polischef":    { name: "POLISCHEFEN",   portrait: "./sprites/character/polis.png" },
  "professor":    { name: "PROFESSORN",    portrait: "./sprites/character/sana.png" },
  "kommunalrad":  { name: "KOMMUNALRÅDET", portrait: "./sprites/character/facket.png" },
  "influencer":   { name: "INFLUENCERN",   portrait: "./sprites/character/lovable.png" },
  "borasare":     { name: "BORÅSAREN",     portrait: "./sprites/character/lovable.png" },
  "pensionar":    { name: "PENSIONÄREN",   portrait: "./sprites/character/facket.png" },
};

/* -------------------------- EVENT-BIBLIOTEK ----------------------------- */
const EVENTS = [
  // ---- Crisis (panic > 70 / exhausted > 80) ----
  {
    id: "vc-arrives",
    archetype: "vc-partner",
    trigger: "panic > 70",
    weight: 3,
    text: "Hej hej. Jag ser att stämningen är… spicy. Vi på fonden tänker att det här är en *fantastic opportunity*. Vill ni ta in 200 miljoner pre-seed?",
    choices: [
      { label: "Ja, vi tar pengarna", effect: { hype: +30, panic: -20 }, unlock: "EQT BACKAR ALLT", result: "Tåget dirigeras om mot Stureplan. Ingen vet varför." },
      { label: "Nej, vi är ideellt", effect: { bored: +20, hype: -10 }, result: "VC-partnern går missnöjt. Mumlar nåt om 'mindset'." },
      { label: "Bara om Creandum är med", effect: { hype: +15, panic: +5 }, result: "Förhandlingen startar. Tåget pausar i 45 sekunder." },
    ],
  },
  {
    id: "polis-fika",
    archetype: "polischef",
    trigger: "panic > 70",
    weight: 2,
    text: "Ursäkta. Är ni anmälda? Jag har en lapp här som säger fika-paus. Stämmer det?",
    choices: [
      { label: "Ja, fikapaus", effect: { panic: -30, bored: +15 }, result: "Polischefen ler lättat. Tar en bulle." },
      { label: "Visa tillstånd", effect: { panic: -10 }, result: "Tillståndet är från 2019 men polischefen orkar inte kolla." },
      { label: "Starta CHANT", effect: { hype: +20, panic: +10 }, result: "Polischefen suckar djupt. Ringer förstärkning." },
    ],
  },
  {
    id: "eu-byrakrat",
    archetype: "eu-byrakrat",
    trigger: "panic > 70",
    weight: 2,
    text: "I enlighet med artikel 6 i AI Act behöver jag se era model cards. Och era weights. Och en GDPR-utvärdering. Och en kaffe.",
    choices: [
      { label: "Här är allt", effect: { panic: -20, bored: +25 }, unlock: "COMPLIANCE FÖRST", result: "Byråkraten skriver i 40 minuter. Stämningen dör." },
      { label: "Vi är open source", effect: { hype: +15 }, result: "Byråkraten blir förvirrad. Måste konsultera artikel 7." },
      { label: "Bjud på kaffe", effect: { panic: -10, bored: +5 }, result: "Det funkar förvånansvärt bra." },
    ],
  },
  {
    id: "grundare-bali",
    archetype: "ai-grundare",
    trigger: "exhausted > 80",
    weight: 3,
    text: "Jag orkar inte längre. Jag tänker quitta och flytta till Bali. Jag har redan bokat. Vad ska jag göra?",
    choices: [
      { label: "Peptalk", effect: { hype: +20, exhausted: -15 }, result: "Grundaren får ny energi. Pitchar omedelbart en ny idé." },
      { label: "Hjälp packa", effect: { bored: +15, exhausted: -10 }, result: "Vi följer alla med. Tåget åker till Arlanda." },
      { label: "Jag tar över bolaget", effect: { hype: +10, panic: +10 }, result: "En oväntad styrelsekupp. Jag är nu CEO." },
    ],
  },

  // ---- Ambient ----
  {
    id: "fackpamp-megafon",
    archetype: "fackpamp",
    trigger: "ambient",
    weight: 4,
    text: "Kamrater! Vi måste visa solidaritet med inferens-arbetarna! De som jobbar 24/7 utan paus eller pension!",
    choices: [
      { label: "Ja, kamrat!", effect: { hype: +25 }, unlock: "INFERENS ÄR ARBETE", result: "Fackpampen gråter. En aktivist börjar filma." },
      { label: "Vad är inferens?", effect: { bored: +20 }, result: "Fackpampen försöker förklara med metaforen 'rörmokare'. Det funkar inte." },
      { label: "Vi behöver fler raster", effect: { hype: +10, exhausted: -10 }, result: "Alla går och tar fika. Tåget pausar 20 minuter." },
    ],
  },
  {
    id: "journalist-quote",
    archetype: "journalist",
    trigger: "ambient",
    weight: 4,
    text: "Hej! Jag skriver för en stor publikation. Vad är ert *huvudbudskap* idag? Något kontroversiellt?",
    choices: [
      { label: "Bombastisk quote", effect: { hype: +20 }, result: "Journalisten skriver utan att kolla fakta. Story går viralt." },
      { label: "No comment", effect: { bored: +10 }, result: "Journalisten skriver ändå. Citerar 'en källa nära tåget'." },
      { label: "Vänd frågan", effect: { hype: +5, panic: +5 }, result: "Du frågar om hens lön. Hen blir generad." },
    ],
  },
  {
    id: "aktivist-podium",
    archetype: "aktivist",
    trigger: "ambient",
    weight: 3,
    text: "Vi måste prata om compute-utsläppen! Varje prompt motsvarar ett halvt flygresa till Thailand!",
    choices: [
      { label: "Ge mikrofonen", effect: { hype: +15, panic: +5 }, unlock: "COMPUTE ÄR KLIMAT", result: "Aktivisten håller 23 minuter. Postar sen från sin Tesla." },
      { label: "Skyll på Bitcoin", effect: { hype: +10, bored: +10 }, result: "Aktivisten håller med. Det är alltid Bitcoin." },
      { label: "Artigt avbryt", effect: { bored: +15 }, result: "Aktivisten suckar. 'Det är därför ingenting förändras.'" },
    ],
  },
  {
    id: "professor-paper",
    archetype: "professor",
    trigger: "ambient",
    weight: 3,
    text: "Ursäkta, jag märker att ni demonstrerar utan korrekt referenser. Får jag presentera mitt papper från 2019?",
    choices: [
      { label: "Lyssna artigt", effect: { bored: +30, exhausted: +15 }, result: "40 minuter senare har ingen någon energi kvar." },
      { label: "Be om citation", effect: { hype: +5 }, result: "Professorn blir lycklig. Ger dig en papper-PDF." },
      { label: "Vi har deadline", effect: { bored: +10 }, result: "Professorn mumlar 'industri-folk' och går." },
    ],
  },
  {
    id: "kommunalrad-foto",
    archetype: "kommunalrad",
    trigger: "ambient",
    weight: 2,
    text: "Hej hej! Jag är från [region]. Får jag stå med er på bilden? För medborgarnas bästa förstås.",
    choices: [
      { label: "Ja, men håll en paroll", effect: { hype: +10 }, result: "Kommunalrådet håller en paroll bakvänd. Bilden går viralt." },
      { label: "Nej tack", effect: { bored: +5 }, result: "Kommunalrådet ser sårad ut. Tar selfie ändå." },
      { label: "Be om bidrag", effect: { hype: +15, panic: +5 }, result: "Kommunalrådet blir blek. Försvinner." },
    ],
  },
  {
    id: "influencer-stream",
    archetype: "influencer",
    trigger: "ambient",
    weight: 4,
    text: "Guys, this is so insane right now. Like, history is being made. Should I do a get-ready-with-me from the protest?",
    choices: [
      { label: "Posera", effect: { hype: +15 }, result: "Tåget blir innehållsfabrik. 80% poserar." },
      { label: "Täck kameran", effect: { panic: +15 }, result: "Influencern ringer sin advokat." },
      { label: "Starta dans", effect: { hype: +25 }, unlock: "1 MAJ DANCE CHALLENGE", result: "Hela tåget gör en TikTok-koreografi." },
    ],
  },
  {
    id: "borasare-vad",
    archetype: "borasare",
    trigger: "ambient",
    weight: 3,
    text: "Ursäkta. Vad fan är AI? Och varför demonstrerar ni? Jag bara passerade på vägen till ICA.",
    choices: [
      { label: "Förklara med liknelse", effect: { hype: +10 }, result: "Du jämför AI med en mikrovågsugn. Det blir oklarare." },
      { label: "Rekrytera", effect: { hype: +20, panic: +5 }, result: "Boråsaren har nu en banderoll. Vet fortfarande inte varför." },
      { label: "Ignorera", effect: { bored: +10 }, result: "Boråsaren går till ICA. Köper falukorv." },
    ],
  },
  {
    id: "pensionar-1971",
    archetype: "pensionar",
    trigger: "ambient",
    weight: 2,
    text: "Jag stod här 1971. Då handlade det om gruvarbetarna. Ni vet, det är samma sak fast nu pratar ni om… vad var det? Servrar?",
    choices: [
      { label: "Lyssna respektfullt", effect: { hype: +10, exhausted: -10 }, result: "En oväntat klok parallell. Alla nickar tyst." },
      { label: "Fråga om ChatGPT", effect: { bored: +20 }, result: "Pensionären har faktiskt en åsikt. Den är välartikulerad." },
      { label: "Ok boomer", effect: { panic: +15 }, result: "Pensionären är inte boomer. Hen är 1939. Tåget skäms." },
    ],
  },
  {
    id: "eu-byrakrat-7b",
    archetype: "eu-byrakrat",
    trigger: "ambient",
    weight: 1,
    text: "Jag glömde detta — formulär 7B om transparens. Behöver bara 47 underskrifter. Ni har tid?",
    choices: [
      { label: "Vi skriver under", effect: { bored: +35 }, result: "Tre timmar senare. Solen går ner. Vi är fortfarande på rad 12." },
      { label: "Vi är upptagna", effect: { panic: +10 }, result: "Byråkraten antecknar. Det blir konsekvenser." },
      { label: "Du först", effect: { hype: +5, bored: +10 }, result: "Byråkraten blir förvirrad. Det är inte protokoll." },
    ],
  },
  {
    id: "journalist-igen",
    archetype: "journalist",
    trigger: "ambient",
    weight: 2,
    text: "Hej igen! Nu skriver jag för en *helt annan* tidning. Min vinkel idag är att ni är aggressiva. Stämmer det?",
    choices: [
      { label: "Nej, vi är fredliga", effect: { panic: +10 }, result: "Journalisten skriver 'protestens våldsamma stämning'. Av vana." },
      { label: "Ja, vi är arga", effect: { hype: +20 }, result: "Story går till första sidan. Ni blir kända." },
      { label: "Vad gav du oss förra gången?", effect: { bored: +5 }, result: "Journalisten låtsas inte minnas. Det är samma frågor." },
    ],
  },
  {
    id: "aktivist-mark",
    archetype: "aktivist",
    trigger: "ambient",
    weight: 2,
    text: "Ni är medvetna om att linjen för tåget passerar gammal urbefolkningsmark, va? Vi behöver erkänna det.",
    choices: [
      { label: "Erkänn allt", effect: { hype: +10, exhausted: +10 }, result: "Erkännandet tar 20 minuter. Det är genomtänkt." },
      { label: "Vi är på Sergels torg", effect: { bored: +15 }, result: "Aktivisten förklarar att allt är urbefolkningsmark." },
      { label: "Fråga om Tesla", effect: { hype: +5, panic: +5 }, result: "Aktivisten blir tyst. Kollar sin telefon." },
    ],
  },
  {
    id: "grundare-afterski",
    archetype: "ai-grundare",
    trigger: "ambient",
    weight: 3,
    text: "Hörni! Klart med tåget? Vi kör afterski på Söder. Open bar. Bara om ni signar ett NDA.",
    choices: [
      { label: "Vi kommer", effect: { hype: +25, exhausted: +10 }, result: "300 demonstranter signar NDA. Ingen läser det." },
      { label: "Vi har riktiga jobb", effect: { bored: +10 }, result: "Grundaren ser sårad ut. Lägger upp story om 'gatekeeping'." },
      { label: "Bara om vi får bolagsandelar", effect: { hype: +10, panic: +5 }, result: "Grundaren tappar käken. Föreslår options istället." },
    ],
  },
  {
    id: "polischef-vanlig",
    archetype: "polischef",
    trigger: "ambient",
    weight: 2,
    text: "Hej. Ursäkta tidigare. Min chef sa att jag måste fråga: är ni egentligen oroliga, eller bara… *tänker*?",
    choices: [
      { label: "Vi är oroliga", effect: { panic: +20 }, result: "Polischefen antecknar 'samhällsoro'. Förstärkning kommer." },
      { label: "Vi tänker bara", effect: { bored: +20 }, result: "Polischefen är lättad. Ringer av förstärkningen." },
      { label: "Vad bryr du dig?", effect: { panic: +15, hype: +5 }, result: "Polischefen mumlar 'jag jobbade nattskift'. Går." },
    ],
  },
  {
    id: "professor-peer-review",
    archetype: "professor",
    trigger: "ambient",
    weight: 2,
    text: "Jag har tänkt vidare på saken. Era paroller behöver mer empirisk grund. Får jag föreslå en peer-review-process?",
    choices: [
      { label: "Ja, peer-review allt", effect: { bored: +25, exhausted: +15 }, result: "1 maj 2027 har vi fortfarande inte fått igenom första parollen." },
      { label: "Tack, vi klarar oss", effect: { hype: +5 }, result: "Professorn skriver en arg artikel om anti-intellektualism." },
      { label: "Du står på vår banderoll", effect: { bored: +10 }, result: "Professorn rör sig långsamt åt sidan. Mumlar 'oväntat'." },
    ],
  },
];

/* -------------------------- EVENT-MANAGER -------------------------- */
class EventManager {
  constructor(events, archetypes, api) {
    this.events = events;
    this.archetypes = archetypes;
    this.api = api;
    this.lastEventTime = 0;
    this.cooldownMs = 30000;
    this.checkIntervalMs = 3000;
    this.ambientMin = 60000;
    this.ambientMax = 120000;
    this.nextAmbientAt = performance.now() + this._randAmbient();
    this.activeModal = null;
    this.shown = new Set(); // för att inte loopa samma event direkt efter varandra
    this._timer = setInterval(() => this._tick(), this.checkIntervalMs);
  }

  _randAmbient() {
    return this.ambientMin + Math.random() * (this.ambientMax - this.ambientMin);
  }

  _tick() {
    if (this.activeModal) return;
    if (this.api.isOver && this.api.isOver()) return;
    const t = performance.now();
    if (t - this.lastEventTime < this.cooldownMs) return;

    const state = this.api.getCrowdState();

    // tvångs-events
    const forced = this._pickForced(state);
    if (forced) return this._trigger(forced);

    // ambient enligt timer
    if (t >= this.nextAmbientAt) {
      const e = this._pickAmbient();
      if (e) this._trigger(e);
      this.nextAmbientAt = performance.now() + this._randAmbient();
    }
  }

  _pickForced(state) {
    const candidates = this.events.filter((e) => {
      if (e.trigger === "panic > 70") return state.panic > 70;
      if (e.trigger === "exhausted > 80") return state.exhausted > 80;
      return false;
    });
    return this._weighted(candidates);
  }

  _pickAmbient() {
    const candidates = this.events.filter((e) => e.trigger === "ambient" && !this.shown.has(e.id));
    if (!candidates.length) {
      this.shown.clear();
      return this._weighted(this.events.filter((e) => e.trigger === "ambient"));
    }
    return this._weighted(candidates);
  }

  _weighted(arr) {
    if (!arr.length) return null;
    const total = arr.reduce((s, e) => s + (e.weight || 1), 0);
    let r = Math.random() * total;
    for (const e of arr) {
      r -= (e.weight || 1);
      if (r <= 0) return e;
    }
    return arr[0];
  }

  triggerById(id) {
    const e = this.events.find((x) => x.id === id);
    if (e) this._trigger(e);
  }

  _trigger(event) {
    this.shown.add(event.id);
    this.lastEventTime = performance.now();
    try { this.api.pauseGame(); } catch (e) { console.warn("pauseGame failed", e); }
    this._show(event);
  }

  _show(event) {
    const arch = this.archetypes[event.archetype] || { name: event.archetype.toUpperCase(), portrait: FALLBACK_PORTRAIT };

    const overlay = document.createElement("div");
    overlay.className = "event-overlay";
    overlay.innerHTML = `
      <div class="event-portrait">
        <img src="${arch.portrait}" alt="${arch.name}" onerror="this.classList.add('event-portrait__missing'); this.replaceWith(Object.assign(document.createElement('div'), { className: 'event-portrait__placeholder', textContent: '${arch.name}' }))">
      </div>
      <div class="event-dialog">
        <div class="event-name">${arch.name}</div>
        <div class="event-text">${this._escape(event.text)}</div>
        <div class="event-choices"></div>
        <div class="event-result" hidden></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.activeModal = overlay;

    // Kör fade-in på nästa frame så transition triggas
    requestAnimationFrame(() => overlay.classList.add("event-overlay--visible"));

    // Knappar in efter dialog-slide
    const choicesEl = overlay.querySelector(".event-choices");
    setTimeout(() => {
      event.choices.forEach((choice, i) => {
        const btn = document.createElement("button");
        btn.className = "event-choice";
        btn.type = "button";
        btn.innerHTML = `<span class="event-choice__num">${i + 1}</span><span class="event-choice__label">${this._escape(choice.label)}</span>`;
        btn.addEventListener("click", () => this._choose(event, choice));
        choicesEl.appendChild(btn);
      });
      requestAnimationFrame(() => choicesEl.classList.add("event-choices--visible"));
    }, 550);

    // Tangentbordsstöd: 1/2/3, Esc = första
    this._keyHandler = (e) => {
      if (!this.activeModal) return;
      if (overlay.dataset.choosing === "1") return; // redan valt
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= event.choices.length) {
        e.preventDefault();
        this._choose(event, event.choices[num - 1]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this._choose(event, event.choices[0]);
      }
    };
    window.addEventListener("keydown", this._keyHandler);
  }

  _choose(event, choice) {
    if (!this.activeModal) return;
    if (this.activeModal.dataset.choosing === "1") return;
    this.activeModal.dataset.choosing = "1";

    // applicera state-deltas
    if (choice.effect) {
      for (const [state, delta] of Object.entries(choice.effect)) {
        try { this.api.applyDelta(state, delta); } catch (e) {}
      }
    }
    if (choice.unlock) {
      try { this.api.addBannerSlogan(choice.unlock); } catch (e) {}
    }

    // visa resultat
    const choicesEl = this.activeModal.querySelector(".event-choices");
    const resultEl = this.activeModal.querySelector(".event-result");
    choicesEl.classList.add("event-choices--hidden");
    resultEl.hidden = false;
    resultEl.innerHTML = `
      ${choice.unlock ? `<div class="event-unlock">+ NY PAROLL: ${this._escape(choice.unlock)}</div>` : ""}
      <div class="event-result__text">${this._escape(choice.result)}</div>
    `;
    requestAnimationFrame(() => resultEl.classList.add("event-result--visible"));

    setTimeout(() => this._close(), 1800);
  }

  _close() {
    const overlay = this.activeModal;
    if (!overlay) return;
    window.removeEventListener("keydown", this._keyHandler);
    overlay.classList.remove("event-overlay--visible");
    overlay.classList.add("event-overlay--closing");
    setTimeout(() => {
      overlay.remove();
      this.activeModal = null;
      try { this.api.resumeGame(); } catch (e) {}
    }, 300);
  }

  _escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
}

/* -------------------------- BOOT -------------------------- */
function bootEvents() {
  if (NO_EVENTS) {
    console.info("[events] avstängt via ?noevents=1");
    return;
  }
  if (!window.AIMayDay) {
    console.warn("[events] window.AIMayDay saknas — event-systemet hoppar över");
    return;
  }
  const mgr = new EventManager(EVENTS, ARCHETYPES, window.AIMayDay);
  window.AIMayDayEvents = mgr;

  if (FORCE_EVENT_ID) {
    setTimeout(() => mgr.triggerById(FORCE_EVENT_ID), 800);
  }
}

if (window.AIMayDay) {
  bootEvents();
} else {
  document.addEventListener("aimayday:ready", bootEvents, { once: true });
}
