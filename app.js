// Dashboard App v13
// FIX 1: WORKER_URL aggiornato al custom domain (era hardcoded sul vecchio subdomain)
// FIX 2: messages -> ops.messages_total_range (campo corretto dal worker V182)
// FIX 3: groqCalls -> ops.groq_calls_range
// FIX 4: objections + regression visibili nella sezione Ops
// FIX 5: range default "1d" per vedere dati test immediatamente

const WORKER_URL = "https://gabriafterdark.obsidianmedia.space";
const DASH_TOKEN = "123";
const DAILY_TARGET_CENTS = null;

function authHeaders() {
  return { "X-DASH-TOKEN": DASH_TOKEN, "X-API-Key": DASH_TOKEN };
}

let currentRange = "1d";
let cache = {};
let loading = false;

async function fetchMetrics(range) {
  try {
    const res = await fetch(`${WORKER_URL}/metrics?range=${range}`, { headers: authHeaders() });
    if (!res.ok) { console.warn(`metrics ${range} -> ${res.status}`); return null; }
    return await res.json();
  } catch(e) { console.warn(`metrics ${range} error:`, e.message); return null; }
}

async function init() {
  loading = true;
  setStatus("loading...");
  setLivePill(false);

  try {
    const [d1, d7, d14, d30] = await Promise.all([
      fetchMetrics("1d"), fetchMetrics("7d"), fetchMetrics("14d"), fetchMetrics("30d"),
    ]);
    cache = { "1d": d1, "7d": d7, "14d": d14, "30d": d30 };

    if (!d1 && !d7 && !d14 && !d30) {
      setStatus("[ERRORE] Nessun dato -- worker non raggiungibile o token errato");
      setLivePill(false);
    } else {
      setLivePill(true);
      render();
    }
  } catch(e) {
    setStatus("[ERRORE] Errore fetch: " + e.message);
  } finally {
    loading = false;
  }
}

async function resetDashboard() {
  const btn = document.getElementById("resetDashBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Resetting..."; }
  setStatus("Resetting...");

  try {
    const res = await fetch(`${WORKER_URL}/metrics/reset`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.text();
      setStatus(`[ERRORE] Reset fallito (${res.status}): ${err}`);
      return;
    }
    const data = await res.json();
    setStatus(`[OK] Reset OK -- ${data.cleared} chiavi. Ricarico tra 1.5s...`);
  } catch(e) {
    setStatus(`[ERRORE] Reset errore: ${e.message}`);
    return;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Reset Dash"; }
  }

  await new Promise(r => setTimeout(r, 1500));
  cache = {};
  await init();
}

function render() {
  const d   = cache[currentRange];
  const d7  = cache["7d"];
  const d30 = cache["30d"];
  if (!d) { setStatus("[WARN] Dati non disponibili per questo range"); return; }

  const p = d.period || {};
  setStatus("OK");
  setText("metaRange",  d.range || currentRange);
  setText("metaFrom",   p.from || "--");
  setText("metaTo",     p.to   || "--");
  setText("metaGen",    d.generated_at ? new Date(d.generated_at).toLocaleTimeString("it-IT") : "--");

  const k      = d.kpi    || {};
  const ops    = d.ops    || {};
  const levers = d.levers || {};
  const obj    = d.objections || {};

  // KPI
  setText("revRange",      eur(k.revenue_range_cents));
  setText("rev7d",         eur(d7?.kpi?.revenue_range_cents));
  setText("rev30d",        eur(d30?.kpi?.revenue_range_cents));
  setText("arppu",         eur(k.arppu_range_cents));
  setText("actualRevenue", eur(k.revenue_range_cents));
  setText("updatedAt",     d.generated_at ? new Date(d.generated_at).toLocaleTimeString("it-IT") : "--");
  setText("targetEOD",     DAILY_TARGET_CENTS != null ? eur(DAILY_TARGET_CENTS) : "--");

  // Ops & System Signals
  setText("active24h",      num(ops.active_users_24h));
  setText("newUsersRange",  num(ops.new_users_range));
  setText("paidRange",      num(k.total_paid_range));
  setText("messagesRange",  num(ops.messages_total_range));   // FIX: era mancante
  setText("groqRange",      num(ops.groq_calls_range));       // FIX: era mancante
  setText("remindersTotal", num(levers.reminder_sent_total));
  setText("locksTotal",     num(levers.locks_set_total));
  setText("reentryUsed",    num(levers.reentry_used_total));
  setText("objTotal",       num(obj.total_range));
  setText("regressionCount",num(obj.regression_count_range));

  const revPerActive = (ops.active_users_24h > 0 && k.revenue_range_cents > 0)
    ? eur(Math.round(k.revenue_range_cents / ops.active_users_24h)) : "--";
  setText("revPerActive", revPerActive);

  renderTiers(d.tiers || {});
  renderObjByType(obj.by_type || {});
  renderReentry(d.reentry);
  renderUpgrades(d.upgrades || {});
  renderTip(d.tip || {});
}

function renderTiers(tiers) {
  const grid = document.getElementById("tierGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const TIERS = [
    { key:"t1",    label:"T1 — The Key" },
    { key:"t2",    label:"T2 — Behind Closed Doors" },
    { key:"t3",    label:"T3 — No Secrets" },
    { key:"feet1", label:"Feet1 — Bare" },
    { key:"feet2", label:"Feet2 — Closer" },
  ];
  for (const { key, label } of TIERS) {
    const t = tiers[key] || {};
    const cr = (t.link_sent_range > 0)
      ? pct(Math.min(1, t.paid_range / t.link_sent_range)) : "--";
    const card = document.createElement("div");
    card.className = "tierCard";
    card.innerHTML = `
      <div class="tierHead">
        <span class="tierName">${label}</span>
        <span class="tierRate">CR ${cr}</span>
      </div>
      <div class="rows">
        <span class="rLabel">Link sent</span><span class="rVal">${num(t.link_sent_range)}</span>
        <span class="rLabel">Paid</span><span class="rVal">${num(t.paid_range)}</span>
        <span class="rLabel">Reminder 1</span><span class="rVal">${num(t.reminder1_sent_range)}</span>
        <span class="rLabel">Reminder 2</span><span class="rVal">${num(t.reminder2_sent_range)}</span>
        <span class="rLabel">Reentry used</span><span class="rVal">${num(t.reentry_used_range)}</span>
        <span class="rLabel">Locks set</span><span class="rVal">${num(t.lock_set_range)}</span>
      </div>`;
    grid.appendChild(card);
  }
}

function renderObjByType(bt) {
  const grid = document.getElementById("objByTypeGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const types = ["MONEY","TRUST","TIME","FREE","CONTENT","VALUE","BOT","NO"];
  const labels = {
    MONEY:"💸 Prezzo", TRUST:"🔒 Fiducia", TIME:"⏰ Tempo", FREE:"🎁 Gratis",
    CONTENT:"😐 Contenuto", VALUE:"⚖️ Valore", BOT:"🤖 Bot", NO:"🚫 No secco"
  };
  for (const t of types) {
    const box = document.createElement("div");
    box.className = "objBox";
    box.innerHTML = `
      <div class="objLabel">${labels[t] || t}</div>
      <div class="objVal">${num(bt[t])}</div>`;
    grid.appendChild(box);
  }
}

function renderReentry(re) {
  if (!re) return;
  setText("reentryLinkSent", num(re.link_sent?.total));
  setText("reentryPaid",     num(re.paid?.total));
  setText("reentryRevenue",  eur(re.revenue_cents?.total));
  setText("reentryCVR", re.cvr?.total != null ? pct(re.cvr.total) : "--");

  const grid = document.getElementById("reentryBreakdown");
  if (!grid) return;
  grid.innerHTML = "";
  const kinds = [
    { key:"tier1_reentry", label:"T1" }, { key:"tier2_reentry", label:"T2" },
    { key:"tier3_reentry", label:"T3" }, { key:"feet1_reentry", label:"FEET1" },
    { key:"feet2_reentry", label:"FEET2" },
  ];
  for (const { key, label } of kinds) {
    const sent = re.link_sent?.[key]      ?? 0;
    const paid = re.paid?.[key]           ?? 0;
    const rev  = re.revenue_cents?.[key]  ?? 0;
    const cvr  = re.cvr?.[key]            ?? null;
    const box = document.createElement("div");
    box.className = "reentryBox";
    box.innerHTML = `
      <div class="reentryBoxName">${label}</div>
      <div class="reentryRows">
        <div class="reentryRow"><span class="reentryRowLabel">Sent</span><span class="reentryRowVal">${num(sent)}</span></div>
        <div class="reentryRow"><span class="reentryRowLabel">Paid</span><span class="reentryRowVal">${num(paid)}</span></div>
        <div class="reentryRow"><span class="reentryRowLabel">Rev</span><span class="reentryRowVal">${eur(rev)}</span></div>
        <div class="reentryRow"><span class="reentryRowLabel">CVR</span><span class="reentryRowVal">${cvr != null ? pct(cvr) : "--"}</span></div>
      </div>`;
    grid.appendChild(box);
  }
}

function renderUpgrades(u) {
  const grid = document.getElementById("upgradesGrid");
  if (!grid) return;
  grid.innerHTML = [
    { label:"T1 → T2",  val: u.t1_to_t2 },
    { label:"T2 → T3",  val: u.t2_to_t3 },
    { label:"→ FEET1",  val: u.to_feet1  },
    { label:"→ FEET2",  val: u.to_feet2  },
  ].map(({ label, val }) => `
    <div class="upBox">
      <div class="upKey">${label}</div>
      <div class="upVal">${num(val)}</div>
    </div>`).join("");
}

function renderTip(tip) {
  setText("tipCount",   num(tip.count_range));
  setText("tipRevenue", eur(tip.revenue_cents_range));
  setText("tipAvg",     eur(tip.avg_tip_cents));
  setText("tipPct",     tip.revenue_pct != null ? tip.revenue_pct + "%" : "--");
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = (v === null || v === undefined) ? "--" : v;
}
function setStatus(msg) { setText("statusMsg", msg); }
function setLivePill(live) {
  const pill = document.getElementById("livePill");
  if (!pill) return;
  pill.textContent = live ? "LIVE" : "OFFLINE";
  pill.style.setProperty("--pill-color", live ? "var(--good)" : "#ff5f57");
  pill.style.setProperty("--pill-glow",  live ? "rgba(61,220,151,.14)" : "rgba(255,95,87,.14)");
}
function eur(n) { return (n == null) ? "--" : "€" + (n / 100).toFixed(2); }
function num(n) { return (n == null) ? "--" : Number(n).toLocaleString("it-IT"); }
function pct(n) { return (n == null) ? "--" : (n * 100).toFixed(1) + "%"; }

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("rangeSelect");
  if (sel) {
    sel.value = currentRange;
    sel.addEventListener("change", () => {
      currentRange = sel.value;
      if (cache[currentRange]) render();
      else init();
    });
  }

  const btn = document.getElementById("refreshBtn");
  if (btn) btn.addEventListener("click", () => { cache = {}; init(); });

  const resetBtn = document.getElementById("resetDashBtn");
  if (resetBtn) resetBtn.addEventListener("click", resetDashboard);

  const debugBtn = document.getElementById("debugBtn");
  if (debugBtn) debugBtn.addEventListener("click", debugMetrics);

  const migrateBtn = document.getElementById("migrateBtn");
  if (migrateBtn) migrateBtn.addEventListener("click", migrateMetrics);

  init();
});

async function debugMetrics() {
  const btn = document.getElementById("debugBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Loading..."; }
  try {
    const res = await fetch(`${WORKER_URL}/metrics/debug`, { headers: authHeaders() });
    const data = await res.json();
    const out = document.getElementById("debugOutput");
    if (out) { out.style.display = "block"; out.textContent = JSON.stringify(data, null, 2); }
  } catch(e) {
    alert("Debug error: " + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Debug KV"; }
  }
}

async function migrateMetrics() {
  const btn = document.getElementById("migrateBtn");
  if (!btn) return;
  if (!confirm("Migrare le bare keys KV alla data odierna (Rome TZ)?")) return;
  btn.disabled = true; btn.textContent = "Migrating...";
  setStatus("Migrazione bare keys in corso...");
  try {
    const res = await fetch(`${WORKER_URL}/metrics/migrate`, {
      method: "POST", headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) { setStatus(`[ERRORE] Migrate fallito (${res.status}): ${JSON.stringify(data)}`); return; }
    setStatus(`[OK] Migrate OK -- ${data.migrated_count} chiavi migrate su ${data.target_date}. Ricarico...`);
    const out = document.getElementById("debugOutput");
    if (out) { out.style.display = "block"; out.textContent = JSON.stringify(data, null, 2); }
    await new Promise(r => setTimeout(r, 1500));
    cache = {};
    await init();
  } catch(e) {
    setStatus(`[ERRORE] Migrate errore: ${e.message}`);
  } finally {
    btn.disabled = false; btn.textContent = "Migrate KV";
  }
}
