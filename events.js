/* =========================================================================
   AI MAY DAY · events.js
   Pausat dialog-event-system. Helt fristående lager. Hookar in via
   window.AIMayDay.{pauseGame,resumeGame,getCrowdState,applyDelta,addBannerSlogan}
   ========================================================================= */

const PARAMS = new URLSearchParams(location.search);
const NO_EVENTS = PARAMS.has("noevents");
const FORCE_EVENT_ID = PARAMS.get("event");

/* -------------------------- ARKETYPER + porträtt-states ----------------------
   Varje karaktär har separata bilder per state i sprites/character/states/.
   Filnamn: <state>-<characterId>.png  där state ∈ {default, reacting, intense}.
   Saknas en state → fallback till default. Saknas hela characterId →
   text-platshållare. -------------------------- */

const STATES_DIR = "./sprites/character/states/";

function chr(id) {
  return {
    sprite: STATES_DIR + "default-" + id + ".png", // legacy-fält (default-bild)
    portraits: {
      default:  STATES_DIR + "default-"  + id + ".png",
      reacting: STATES_DIR + "reacting-" + id + ".png",
      intense:  STATES_DIR + "intense-"  + id + ".png",
    },
  };
}

const ARCHETYPES = {
  "vc-partner":   { name: "VC-PARTNERN",   ...chr("sana")       },
  "ai-grundare":  { name: "AI-GRUNDAREN",  ...chr("protest")    }, // generisk demonstrant
  "fackpamp":     { name: "FACKPAMPEN",    ...chr("facket")     },
  "aktivist":     { name: "AKTIVISTEN",    ...chr("protest")    }, // generisk demonstrant
  "eu-byrakrat":  { name: "EU-BYRÅKRATEN", ...chr("byrakrat")   },
  "journalist":   { name: "JOURNALISTEN",  ...chr("journalist") },
  "polischef":    { name: "POLISCHEFEN",   ...chr("polis")      },
  "professor":    { name: "PROFESSORN",    ...chr("byrakrat")   },
  "kommunalrad":  { name: "KOMMUNALRÅDET", ...chr("kommun")     }, // egen, reacting/intense fallar tillbaka till default
  "influencer":   { name: "INFLUENCERN",   ...chr("journalist") },
  "borasare":     { name: "BORÅSAREN",     ...chr("pensionar")  }, // tant-pensionär-vibe
  "pensionar":    { name: "PENSIONÄREN",   ...chr("pensionar")  },
  "statsminister": { name: "STATSMINISTERN", ...chr("statsminister") },
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
      { label: "Ja, vi tar pengarna", effect: { hype: +30, panic: -20 }, unlock: "EQT BACKAR ALLT", news: "Demonstrationen blir portfolio-tillgång — VC injicerar 200 mdr mitt i tåget", result: "Tåget dirigeras om mot Stureplan. Ingen vet varför.", portraitState: "intense" },
      { label: "Nej, vi är ideellt", effect: { bored: +20, hype: -10 }, news: "VC-partner avvisad — fonden mumlar 'mindset' och drar", result: "VC-partnern går missnöjt. Mumlar nåt om 'mindset'.", portraitState: "reacting" },
      { label: "Bara om Creandum är med", effect: { hype: +15, panic: +5 }, news: "Pre-seed-rundan halterar — hela tåget pausar i förhandling", result: "Förhandlingen startar. Tåget pausar i 45 sekunder.", portraitState: "default" },
    ],
  },
  {
    id: "polis-fika",
    archetype: "polischef",
    trigger: "panic > 70",
    weight: 2,
    text: "Ursäkta. Är ni anmälda? Jag har en lapp här som säger fika-paus. Stämmer det?",
    choices: [
      { label: "Ja, fikapaus", effect: { panic: -30, bored: +15 }, news: "Demonstration omklassad — polischefen tar en bulle och ler", result: "Polischefen ler lättat. Tar en bulle.", portraitState: "default" },
      { label: "Visa tillstånd", effect: { panic: -10 }, news: "Tillstånd från 2019 godkänns på torget — alla andas ut", result: "Tillståndet är från 2019 men polischefen orkar inte kolla.", portraitState: "reacting" },
      { label: "Starta CHANT", effect: { hype: +20, panic: +10 }, news: "Polischef ringer förstärkning — tåget skruvar upp volymen", result: "Polischefen suckar djupt. Ringer förstärkning.", portraitState: "intense" },
    ],
  },
  {
    id: "eu-byrakrat",
    archetype: "eu-byrakrat",
    trigger: "panic > 70",
    weight: 2,
    text: "I enlighet med artikel 6 i AI Act behöver jag se era model cards. Och era weights. Och en GDPR-utvärdering. Och en kaffe.",
    choices: [
      { label: "Här är allt", effect: { panic: -20, bored: +25 }, unlock: "COMPLIANCE FÖRST", news: "EU-revision på Sergels torg — model cards utlämnade i 40 minuter", result: "Byråkraten skriver i 40 minuter. Stämningen dör." },
      { label: "Vi är open source", effect: { hype: +15 }, news: "Tåget åberopar open-source-undantag — byråkraten konsulterar artikel 7", result: "Byråkraten blir förvirrad. Måste konsultera artikel 7." },
      { label: "Bjud på kaffe", effect: { panic: -10, bored: +5 }, news: "Demonstrant löser EU-tillsyn med en kopp svart kaffe", result: "Det funkar förvånansvärt bra." },
    ],
  },
  {
    id: "grundare-bali",
    archetype: "ai-grundare",
    trigger: "exhausted > 80",
    weight: 3,
    text: "Jag orkar inte längre. Jag tänker quitta och flytta till Bali. Jag har redan bokat. Vad ska jag göra?",
    choices: [
      { label: "Peptalk", effect: { hype: +20, exhausted: -15 }, news: "Bali-flykt avstyrd — grundaren pitchar redan ny idé på torget", result: "Grundaren får ny energi. Pitchar omedelbart en ny idé." },
      { label: "Hjälp packa", effect: { bored: +15, exhausted: -10 }, news: "Hela demonstrationen åker till Arlanda för att packa ihop", result: "Vi följer alla med. Tåget åker till Arlanda." },
      { label: "Jag tar över bolaget", effect: { hype: +10, panic: +10 }, news: "Styrelsekupp på Sergels torg — demonstranten utses till CEO", result: "En oväntad styrelsekupp. Jag är nu CEO." },
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
      { label: "Ja, kamrat!", effect: { hype: +25 }, unlock: "INFERENS ÄR ARBETE", news: "Inferens-arbetarna får sin paroll — en aktivist filmar gråtande fackpamp", result: "Fackpampen gråter. En aktivist börjar filma." },
      { label: "Vad är inferens?", effect: { bored: +20 }, news: "Förvirring på torget — fackpamp förklarar inferens med 'rörmokar'-metafor", result: "Fackpampen försöker förklara med metaforen 'rörmokare'. Det funkar inte." },
      { label: "Vi behöver fler raster", effect: { hype: +10, exhausted: -10 }, news: "Tåget pausar 20 minuter — alla går och tar fika på Pressbyrån", result: "Alla går och tar fika. Tåget pausar 20 minuter." },
    ],
  },
  {
    id: "journalist-quote",
    archetype: "journalist",
    trigger: "ambient",
    weight: 4,
    text: "Hej! Jag skriver för en stor publikation. Vad är ert *huvudbudskap* idag? Något kontroversiellt?",
    choices: [
      { label: "Bombastisk quote", effect: { hype: +20 }, news: "Demonstranter går viralt med okollat citat — story bryter över hela X", result: "Journalisten skriver utan att kolla fakta. Story går viralt." },
      { label: "No comment", effect: { bored: +10 }, news: "'En källa nära tåget' citeras — exakt vad är oklart", result: "Journalisten skriver ändå. Citerar 'en källa nära tåget'." },
      { label: "Vänd frågan", effect: { hype: +5, panic: +5 }, news: "Journalist konfronteras om sin lön — pressmöte avbryts spontant", result: "Du frågar om hens lön. Hen blir generad." },
    ],
  },
  {
    id: "aktivist-podium",
    archetype: "aktivist",
    trigger: "ambient",
    weight: 3,
    text: "Vi måste prata om compute-utsläppen! Varje prompt motsvarar ett halvt flygresa till Thailand!",
    choices: [
      { label: "Ge mikrofonen", effect: { hype: +15, panic: +5 }, unlock: "COMPUTE ÄR KLIMAT", news: "Klimat-monolog 23 minuter på torget — aktivisten åker hem i Tesla", result: "Aktivisten håller 23 minuter. Postar sen från sin Tesla." },
      { label: "Skyll på Bitcoin", effect: { hype: +10, bored: +10 }, news: "Tåget enas — det är alltid Bitcoins fel, ingen protesterar", result: "Aktivisten håller med. Det är alltid Bitcoin." },
      { label: "Artigt avbryt", effect: { bored: +15 }, news: "'Det är därför ingenting förändras' — aktivisten lämnar talet", result: "Aktivisten suckar. 'Det är därför ingenting förändras.'" },
    ],
  },
  {
    id: "professor-paper",
    archetype: "professor",
    trigger: "ambient",
    weight: 3,
    text: "Ursäkta, jag märker att ni demonstrerar utan korrekt referenser. Får jag presentera mitt papper från 2019?",
    choices: [
      { label: "Lyssna artigt", effect: { bored: +30, exhausted: +15 }, news: "40-minuters-papper från 2019 läses upp — energin sjunker drastiskt", result: "40 minuter senare har ingen någon energi kvar." },
      { label: "Be om citation", effect: { hype: +5 }, news: "Akademisk citation lovar peer-review — professor lämnar PDF", result: "Professorn blir lycklig. Ger dig en papper-PDF." },
      { label: "Vi har deadline", effect: { bored: +10 }, news: "Tåget hänvisar till deadline — 'industri-folk' mumlar professorn", result: "Professorn mumlar 'industri-folk' och går." },
    ],
  },
  {
    id: "kommunalrad-foto",
    archetype: "kommunalrad",
    trigger: "ambient",
    weight: 2,
    text: "Hej hej! Jag är från [region]. Får jag stå med er på bilden? För medborgarnas bästa förstås.",
    choices: [
      { label: "Ja, men håll en paroll", effect: { hype: +10 }, news: "Kommunpolitiker håller paroll bakvänd — bilden går viralt på X", result: "Kommunalrådet håller en paroll bakvänd. Bilden går viralt." },
      { label: "Nej tack", effect: { bored: +5 }, news: "Kommunalråd nekas bildtillträde — tar selfie i bakgrunden ändå", result: "Kommunalrådet ser sårad ut. Tar selfie ändå." },
      { label: "Be om bidrag", effect: { hype: +15, panic: +5 }, news: "Demonstrant kräver bidrag — kommunalråd försvinner från torget", result: "Kommunalrådet blir blek. Försvinner." },
    ],
  },
  {
    id: "influencer-stream",
    archetype: "influencer",
    trigger: "ambient",
    weight: 4,
    text: "Guys, this is so insane right now. Like, history is being made. Should I do a get-ready-with-me from the protest?",
    choices: [
      { label: "Posera", effect: { hype: +15 }, news: "Tåget blir content-fabrik — 80%% poserar för influencer-livestreamen", result: "Tåget blir innehållsfabrik. 80% poserar." },
      { label: "Täck kameran", effect: { panic: +15 }, news: "Kameran täcks — influencer ringer sin advokat live på torget", result: "Influencern ringer sin advokat." },
      { label: "Starta dans", effect: { hype: +25 }, unlock: "1 MAJ DANCE CHALLENGE", news: "Hela tåget gör TikTok-koreografi — '1 maj dance challenge' trendar", result: "Hela tåget gör en TikTok-koreografi." },
    ],
  },
  {
    id: "borasare-vad",
    archetype: "borasare",
    trigger: "ambient",
    weight: 3,
    text: "Ursäkta. Vad fan är AI? Och varför demonstrerar ni? Jag bara passerade på vägen till ICA.",
    choices: [
      { label: "Förklara med liknelse", effect: { hype: +10 }, news: "AI förklaras som mikrovågsugn — flera demonstranter blir mer förvirrade", result: "Du jämför AI med en mikrovågsugn. Det blir oklarare." },
      { label: "Rekrytera", effect: { hype: +20, panic: +5 }, news: "Förbipasserande får banderoll — vet fortfarande inte varför", result: "Boråsaren har nu en banderoll. Vet fortfarande inte varför." },
      { label: "Ignorera", effect: { bored: +10 }, news: "Förbipasserande väljer falukorv på ICA framför demonstration", result: "Boråsaren går till ICA. Köper falukorv." },
    ],
  },
  {
    id: "pensionar-1971",
    archetype: "pensionar",
    trigger: "ambient",
    weight: 2,
    text: "Jag stod här 1971. Då handlade det om gruvarbetarna. Ni vet, det är samma sak fast nu pratar ni om… vad var det? Servrar?",
    choices: [
      { label: "Lyssna respektfullt", effect: { hype: +10, exhausted: -10 }, news: "Historisk parallell på torget — tystnad sänker sig över demonstrationen", result: "En oväntat klok parallell. Alla nickar tyst." },
      { label: "Fråga om ChatGPT", effect: { bored: +20 }, news: "Pensionär har välartikulerad åsikt om ChatGPT — alla lyssnar artigt", result: "Pensionären har faktiskt en åsikt. Den är välartikulerad." },
      { label: "Ok boomer", effect: { panic: +15 }, news: "Demonstrant feltolkar ålder — pensionären är från 1939, tåget skäms", result: "Pensionären är inte boomer. Hen är 1939. Tåget skäms." },
    ],
  },
  {
    id: "eu-byrakrat-7b",
    archetype: "eu-byrakrat",
    trigger: "ambient",
    weight: 1,
    text: "Jag glömde detta — formulär 7B om transparens. Behöver bara 47 underskrifter. Ni har tid?",
    choices: [
      { label: "Vi skriver under", effect: { bored: +35 }, news: "Formulär 7B signeras live på torget — solen hinner gå ner före rad 47", result: "Tre timmar senare. Solen går ner. Vi är fortfarande på rad 12." },
      { label: "Vi är upptagna", effect: { panic: +10 }, news: "Demonstration vägrar formulär 7B — byråkraten antecknar 'konsekvenser'", result: "Byråkraten antecknar. Det blir konsekvenser." },
      { label: "Du först", effect: { hype: +5, bored: +10 }, news: "Demonstrant kräver att byråkraten signar först — protokoll-brott på torget", result: "Byråkraten blir förvirrad. Det är inte protokoll." },
    ],
  },
  {
    id: "journalist-igen",
    archetype: "journalist",
    trigger: "ambient",
    weight: 2,
    text: "Hej igen! Nu skriver jag för en *helt annan* tidning. Min vinkel idag är att ni är aggressiva. Stämmer det?",
    choices: [
      { label: "Nej, vi är fredliga", effect: { panic: +10 }, news: "'Protestens våldsamma stämning' — vinkeln skrivs trots fredlig respons", result: "Journalisten skriver 'protestens våldsamma stämning'. Av vana." },
      { label: "Ja, vi är arga", effect: { hype: +20 }, news: "Demonstration tar förstasidan — 'tåget bekräftar ilska' i stora bokstäver", result: "Story går till första sidan. Ni blir kända." },
      { label: "Vad gav du oss förra gången?", effect: { bored: +5 }, news: "Journalist konfronteras med tidigare artikel — minnet tycks luckras", result: "Journalisten låtsas inte minnas. Det är samma frågor." },
    ],
  },
  {
    id: "aktivist-mark",
    archetype: "aktivist",
    trigger: "ambient",
    weight: 2,
    text: "Ni är medvetna om att linjen för tåget passerar gammal urbefolkningsmark, va? Vi behöver erkänna det.",
    choices: [
      { label: "Erkänn allt", effect: { hype: +10, exhausted: +10 }, news: "20-minuters markerkännande på torget — genomtänkt och uttömmande", result: "Erkännandet tar 20 minuter. Det är genomtänkt." },
      { label: "Vi är på Sergels torg", effect: { bored: +15 }, news: "Aktivist informerar tåget — 'allt är urbefolkningsmark, även Sergels torg'", result: "Aktivisten förklarar att allt är urbefolkningsmark." },
      { label: "Fråga om Tesla", effect: { hype: +5, panic: +5 }, news: "Aktivist blir tyst när Tesla nämns — kollar plötsligt mobilen", result: "Aktivisten blir tyst. Kollar sin telefon." },
    ],
  },
  {
    id: "grundare-afterski",
    archetype: "ai-grundare",
    trigger: "ambient",
    weight: 3,
    text: "Hörni! Klart med tåget? Vi kör afterski på Söder. Open bar. Bara om ni signar ett NDA.",
    choices: [
      { label: "Vi kommer", effect: { hype: +25, exhausted: +10 }, news: "300 demonstranter signar NDA för open bar — ingen läser papperet", result: "300 demonstranter signar NDA. Ingen läser det." },
      { label: "Vi har riktiga jobb", effect: { bored: +10 }, news: "Grundare publicerar story om 'gatekeeping' — får 47 reaktioner", result: "Grundaren ser sårad ut. Lägger upp story om 'gatekeeping'." },
      { label: "Bara om vi får bolagsandelar", effect: { hype: +10, panic: +5 }, news: "Demonstration kräver options för afterski — grundare blir blek", result: "Grundaren tappar käken. Föreslår options istället." },
    ],
  },
  {
    id: "polischef-vanlig",
    archetype: "polischef",
    trigger: "ambient",
    weight: 2,
    text: "Hej. Ursäkta tidigare. Min chef sa att jag måste fråga: är ni egentligen oroliga, eller bara… *tänker*?",
    choices: [
      { label: "Vi är oroliga", effect: { panic: +20 }, news: "'Samhällsoro' antecknat — förstärkning kallas till torget", result: "Polischefen antecknar 'samhällsoro'. Förstärkning kommer." },
      { label: "Vi tänker bara", effect: { bored: +20 }, news: "Demonstrationen omklassad till 'tankeyttring' — förstärkning ringd av", result: "Polischefen är lättad. Ringer av förstärkningen." },
      { label: "Vad bryr du dig?", effect: { panic: +15, hype: +5 }, news: "Polischef avslöjar nattskift — lämnar torget i tyst protest", result: "Polischefen mumlar 'jag jobbade nattskift'. Går." },
    ],
  },
  {
    id: "professor-peer-review",
    archetype: "professor",
    trigger: "ambient",
    weight: 2,
    text: "Jag har tänkt vidare på saken. Era paroller behöver mer empirisk grund. Får jag föreslå en peer-review-process?",
    choices: [
      { label: "Ja, peer-review allt", effect: { bored: +25, exhausted: +15 }, news: "Demonstration startar peer-review — första parollen lär ta år", result: "1 maj 2027 har vi fortfarande inte fått igenom första parollen." },
      { label: "Tack, vi klarar oss", effect: { hype: +5 }, news: "Anti-intellektualism-artikel förbereds — professorn upprörd vid skrivblock", result: "Professorn skriver en arg artikel om anti-intellektualism." },
      { label: "Du står på vår banderoll", effect: { bored: +10 }, news: "Professor flyttar sig sakta från banderoll-position — 'oväntat' mumlas", result: "Professorn rör sig långsamt åt sidan. Mumlar 'oväntat'." },
    ],
  },

  // ──────────── BOSS · alltid 55s in i körningen ────────────
  {
    id: "statsminister-anlander",
    archetype: "statsminister",
    trigger: "boss",   // markerar att den triggas explicit, inte ambient
    weight: 0,         // 0 = picka aldrig random
    text: "Hej. Jag är statsministern. Jag har sett *bilden* med flaggan. Vi behöver prata. Riksdagen lyssnar live. Tre alternativ — välj ett.",
    choices: [
      { label: "Kräv att EU AI Act rivs", effect: { hype: +28, panic: +12 }, unlock: "RIV LAGEN", route: "boss-riv",       news: "Statsministern lovar att lyfta saken i Riksdagen — tåget skanderar viralt", result: "Hen ler stelt. Säger 'vi tar med oss det'. Tweetar något ostligt direkt efteråt.", portraitState: "intense" },
      { label: "Acceptera tillsättning av utredning", effect: { bored: +25, panic: -15 }, route: "boss-utredning",         news: "Demonstrationen omklassad — 18-månaders utredning utlovas, ingen orkar vänta", result: "En utredning tillsätts. Slutdatum: efter nästa val. Ingen är glad.", portraitState: "default" },
      { label: "Bjud upp till valsen", effect: { hype: +18, bored: +5 }, unlock: "1 MAJ DANCE CHALLENGE", route: "boss-dans", news: "Statsministern dansar med demonstranter — bilden går omedelbart viralt", result: "Hen tvekar, sen accepterar. Hela torget får sin TikTok-moment.", portraitState: "reacting" },
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
    this.cooldownMs = 12000;       // var 30000
    this.checkIntervalMs = 3000;
    this.ambientMin = 15000;       // var 60000
    this.ambientMax = 30000;       // var 120000
    this.nextAmbientAt = performance.now() + this._randAmbient();
    this.activeModal = null;
    this.shown = new Set(); // för att inte loopa samma event direkt efter varandra
    this._pendingTickerPayload = null; // pushas till BREAKING när modalen stängs
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
    let candidates = this.events.filter((e) => e.trigger === "ambient" && !this.shown.has(e.id));
    if (!candidates.length) {
      this.shown.clear();
      candidates = this.events.filter((e) => e.trigger === "ambient");
    }
    // Reigns-style "card bag" — boosta vikter baserat på crowd-state
    const state = this.api.getCrowdState();
    const boosted = candidates.map((e) => {
      let w = e.weight || 1;
      if (state.hype  > 50 && e.archetype === "vc-partner")    w *= 3;   // pengar luktar hype
      if (state.hype  > 50 && e.archetype === "influencer")    w *= 2;
      if (state.panic > 40 && e.archetype === "polischef")     w *= 3;   // ordningsmakten dyker upp i kaos
      if (state.panic > 40 && e.archetype === "journalist")    w *= 2;
      if (state.bored > 50 && e.archetype === "professor")     w *= 4;   // tråkig akademiker passar trött crowd
      if (state.bored > 50 && e.archetype === "eu-byrakrat")   w *= 3;
      if (state.exhausted > 50 && e.archetype === "ai-grundare") w *= 3;
      if (state.exhausted > 50 && e.archetype === "pensionar")   w *= 2;
      if (state.neutral > 60 && e.archetype === "borasare")    w *= 2;   // nån random kommer förbi
      if (state.neutral > 60 && e.archetype === "kommunalrad") w *= 2;
      return { ...e, weight: w };
    });
    return this._weighted(boosted);
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
    const arch = this.archetypes[event.archetype] || { name: event.archetype.toUpperCase() };
    this._currentArch = arch;
    this._currentEvent = event;

    const overlay = document.createElement("div");
    overlay.className = "event-overlay";
    overlay.innerHTML = `
      <div class="event-pause-banner" aria-hidden="true">
        <span><span class="event-pause-banner__pip"></span>PAUSAT &middot; HÄNDELSE PÅ TORGET</span>
      </div>
      <button class="event-skip" type="button" title="Hoppa över (Esc)" aria-label="Hoppa över">×</button>
      <div class="event-card">
        <div class="event-card__inner">
          <div class="event-portrait-box">
            <div class="event-portrait-frame">
              <img class="event-portrait-img" alt="${arch.name}" />
              <div class="event-portrait-name">${arch.name}</div>
            </div>
          </div>
          <div class="event-dialog">
            <div class="event-name">${arch.name}</div>
            <div class="event-text">${this._escape(event.text)}</div>
            <div class="event-choices"></div>
            <div class="event-result" hidden></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.activeModal = overlay;

    // sätt initial porträtt (default)
    this._setPortraitState("default");

    // skip-knapp
    const skipBtn = overlay.querySelector(".event-skip");
    skipBtn.addEventListener("click", () => this._skip());

    // Kör fade-in på nästa frame så transition triggas
    requestAnimationFrame(() => overlay.classList.add("event-overlay--visible"));

    // Knappar in efter dialog-slide
    const choicesEl = overlay.querySelector(".event-choices");
    setTimeout(() => {
      event.choices.forEach((choice, i) => {
        const btn = document.createElement("button");
        btn.className = "event-choice";
        btn.type = "button";
        // Effekt visas EFTER klick i resultatet — innan klick gäller bara val.
        btn.innerHTML = `
          <span class="event-choice__num">${i + 1}</span>
          <span class="event-choice__body">
            <span class="event-choice__label">${this._escape(choice.label)}</span>
          </span>
        `;
        btn.addEventListener("click", () => this._choose(event, choice));
        choicesEl.appendChild(btn);
      });
      requestAnimationFrame(() => choicesEl.classList.add("event-choices--visible"));
    }, 550);

    // Tangentbordsstöd: 1/2/3 = val, Esc = skip (= första val om inget valt än, annars stäng)
    this._keyHandler = (e) => {
      if (!this.activeModal) return;
      if (e.key === "Escape") { e.preventDefault(); this._skip(); return; }
      if (overlay.dataset.choosing === "1") return; // redan valt
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= event.choices.length) {
        e.preventDefault();
        this._choose(event, event.choices[num - 1]);
      }
    };
    window.addEventListener("keydown", this._keyHandler);
  }

  _skip() {
    if (!this.activeModal || !this._currentEvent) return;
    if (this.activeModal.dataset.choosing === "1") {
      // redan valt → cancel result-timer och stäng direkt
      if (this._closeTimeout) clearTimeout(this._closeTimeout);
      this._close();
    } else if (this._currentEvent.trigger === "boss") {
      // Boss-skip = ingen route, ingen effekt. Threshold-fallback styr utfallet.
      this.activeModal.dataset.choosing = "1";
      const choicesEl = this.activeModal.querySelector(".event-choices");
      const resultEl  = this.activeModal.querySelector(".event-result");
      if (choicesEl) choicesEl.classList.add("event-choices--hidden");
      if (resultEl) {
        resultEl.hidden = false;
        resultEl.innerHTML = `<div class="event-result__text">Statsministern lämnar utan svar. Tåget ser konfunderat ut.</div>`;
        requestAnimationFrame(() => resultEl.classList.add("event-result--visible"));
      }
      this._closeTimeout = setTimeout(() => this._close(), 2000);
    } else {
      // Vanliga ambient-events: defaulta till val 1
      this._choose(this._currentEvent, this._currentEvent.choices[0]);
    }
  }

  _choose(event, choice) {
    if (!this.activeModal) return;
    if (this.activeModal.dataset.choosing === "1") return;
    this.activeModal.dataset.choosing = "1";

    const arch = this.archetypes[event.archetype] || { name: String(event.archetype).toUpperCase() };
    this._pendingTickerPayload = { choice, archetypeName: arch.name };

    // applicera state-deltas
    if (choice.effect) {
      for (const [state, delta] of Object.entries(choice.effect)) {
        try { this.api.applyDelta(state, delta); } catch (e) {}
      }
    }
    if (choice.unlock) {
      try { this.api.addBannerSlogan(choice.unlock); } catch (e) {}
    }
    // routing-tag (t.ex. boss-val styr finale-utfall)
    if (choice.route) {
      try { this.api.setRoute && this.api.setRoute(choice.route); } catch (e) {}
    }

    // härled porträtt-state från effekt om inte explicit
    const portraitState = choice.portraitState || this._deriveState(choice.effect);
    this._setPortraitState(portraitState);

    // visa resultat — effekt-pillsen avslöjas HÄR, efter att valet är gjort
    const choicesEl = this.activeModal.querySelector(".event-choices");
    const resultEl = this.activeModal.querySelector(".event-result");
    choicesEl.classList.add("event-choices--hidden");
    resultEl.hidden = false;
    const effect = this._formatEffect(choice.effect);
    resultEl.innerHTML = `
      ${choice.unlock ? `<div class="event-unlock">+ NY PAROLL: ${this._escape(choice.unlock)}</div>` : ""}
      <div class="event-result__text">${this._escape(choice.result)}</div>
      ${effect ? `<div class="event-result__effect">${effect}</div>` : ""}
    `;
    requestAnimationFrame(() => resultEl.classList.add("event-result--visible"));

    // visa skip-knapp under resultat-fasen så man kan hoppa förbi om man läst klart
    const skipBtn = this.activeModal.querySelector(".event-skip");
    if (skipBtn) skipBtn.classList.add("event-skip--visible");

    // delay 3.5s så man hinner läsa svaret
    this._closeTimeout = setTimeout(() => this._close(), 3500);
  }

  _formatEffect(eff) {
    if (!eff) return "";
    const labels = { hype: "HYPE", panic: "PANIK", bored: "TRÖTT", exhausted: "UTBR", neutral: "LUGN" };
    // Sortera så största absolut-värdet kommer först
    const entries = Object.entries(eff).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    return entries
      .map(([k, v]) => {
        const lbl = labels[k] || k.toUpperCase();
        const sign = v > 0 ? "+" : "";
        const cls = v > 0 ? "pos" : "neg";
        return `<span class="effect-pill effect-pill--${k} effect-pill--${cls}">${sign}${v} ${lbl}</span>`;
      })
      .join("");
  }

  _deriveState(effect) {
    if (!effect) return "default";
    let max = 0, isHype = false, isPanic = false;
    for (const [k, v] of Object.entries(effect)) {
      const abs = Math.abs(v);
      if (abs > max) {
        max = abs;
        isHype = (k === "hype");
        isPanic = (k === "panic");
      }
    }
    // stor delta + hype/panic → intense; medel → reacting; liten → default
    if (max >= 20 && (isHype || isPanic)) return "intense";
    if (max >= 12) return "reacting";
    return "default";
  }

  _setPortraitState(state) {
    const frame = this.activeModal?.querySelector(".event-portrait-frame");
    const img = this.activeModal?.querySelector(".event-portrait-img");
    if (!frame || !img) return;
    const arch = this._currentArch;
    if (!arch || !arch.portraits) {
      frame.classList.add("event-portrait-frame--placeholder");
      img.style.display = "none";
      return;
    }
    const wantedSrc = arch.portraits[state] || arch.portraits.default;
    const fallbackSrc = arch.portraits.default;
    if (!wantedSrc) return;

    // animera reaktion
    frame.classList.remove("event-portrait-frame--changing");
    void frame.offsetWidth;
    frame.classList.add("event-portrait-frame--changing");

    // försök ladda önskad state, fallback till default vid 404
    img.style.display = "";
    img.onerror = () => {
      // 404 → fallback till default
      if (img.src.indexOf(fallbackSrc) === -1 && fallbackSrc) {
        img.onerror = () => {
          // även default saknas → text-platshållare
          frame.classList.add("event-portrait-frame--placeholder");
          img.style.display = "none";
        };
        img.src = fallbackSrc;
      } else {
        frame.classList.add("event-portrait-frame--placeholder");
        img.style.display = "none";
      }
    };
    frame.classList.remove("event-portrait-frame--placeholder");
    img.src = wantedSrc;
  }

  _close() {
    const overlay = this.activeModal;
    if (!overlay) return;
    window.removeEventListener("keydown", this._keyHandler);

    const tickerPayload = this._pendingTickerPayload;
    this._pendingTickerPayload = null;

    overlay.classList.remove("event-overlay--visible");
    overlay.classList.add("event-overlay--closing");
    setTimeout(() => {
      overlay.remove();
      this.activeModal = null;
      try { this.api.resumeGame(); } catch (e) {}
      /* BREAKING direkt efter stängning — kort paus så ögat hinner med */
      if (tickerPayload) {
        setTimeout(() => {
          try {
            if (typeof this.api.pushEventNews === "function") {
              this.api.pushEventNews(tickerPayload);
            }
          } catch (e) { /* ticker kan saknas i test */ }
        }, 1500);
      }
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
