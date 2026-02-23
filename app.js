// Dashboard App v8 — ID allineati all'index.html reale

const WORKER_URL = "https://cold-sun-7c50luna.andreagalletti.workers.dev";
const TOK = "123";
const DASH_TOKEN = "123";

function authHeaders() {
  return { "X-DASH-TOKEN": DASH_TOKEN, "X-API-Key": DASH_TOKEN };
}

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentRange = "7d"; // default = 7D (selected nell'HTML)
let cache = {};
let loading = false;

// ─── FETCH ────────────────────────────────────────────────────────────────────
async function fetchMetrics(range) {
  try {
    // Usa query param per evitare CORS preflight (no custom headers = simple request)
    const res = await fetch(`${WORKER_URL}/metrics?range=${range}&tok=${TOK}`);
    if (!res.ok) { console.warn(`metrics ${range} → ${res.status}`); return null; }
    return await res.json();
  } catch(e) { console.warn(`metrics ${range} error:`, e.message); return null; }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  if (loading) return;
  loading = true;
  setStatus("loading…");

  const [d1, d7, d30] = await Promise.all([
    fetchMetrics("1d"), fetchMetrics("7d"), fetchMetrics("30d")
  ]);

  cache = { "1d": d1, "7d": d7, "30d": d30 };
  loading = false;

  if (!d1 && !d7 && !d30) {
    setStatus("❌ Nessun dato — worker non raggiungibile o token errato");
    return;
  }

  render();
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render() {
  const d   = cache[currentRange];
  const d7  = cache["7d"];
  const d30 = cache["30d"];
  if (!d) { setStatus("⚠️ Dati non disponibili per questo range"); return; }

  // Status banner
  const p = d.period || {};
  setStatus("✅ OK");
  setText("metaRange",  d.range || currentRange);
  setText("metaFrom",   p.from || "—");
  setText("metaTo",     p.to   || "—");
  setText("metaGen",    d.generated_at ? new Date(d.generated_at).toLocaleTimeString("it-IT") : "—");

  // Money & growth
  const k = d.kpi || {};
  setText("revRange",   eur(k.revenue_range_cents));
  setText("rev7d",      eur(d7?.kpi?.revenue_range_cents));
  setText("rev30d",     eur(d30?.kpi?.revenue_range_cents));
  setText("arppu",      eur(k.arppu_range_cents));
  setText("actualRevenue", eur(k.revenue_range_cents));
  setText("updatedAt",  d.generated_at ? new Date(d.generated_at).toLocaleTimeString("it-IT") : "—");

  // OPS
  const ops = d.ops || {};
  const levers = d.levers || {};
  setText("active24h",     num(ops.active_users_24h));
  setText("newUsersRange", num(ops.new_users_range));
  setText("paidRange",     num(k.total_paid_range));
  setText("remindersTotal",num(levers.reminder_sent_total));
  setText("locksTotal",    num(levers.locks_set_total));

  const revPerActive = (ops.active_users_24h > 0 && k.revenue_range_cents > 0)
    ? eur(Math.round(k.revenue_range_cents / ops.active_users_24h))
    : "—";
  setText("revPerActive", revPerActive);

  // Tier grid
  renderTiers(d.tiers || {});

  // Reentry
  renderReentry(d.reentry);

  // Upgrades
  renderUpgrades(d.upgrades || {});
}

function renderTiers(tiers) {
  const grid = document.getElementById("tierGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const TIERS = [
    { key:"t1", label:"T1" },
    { key:"t2", label:"T2" },
    { key:"t3", label:"T3" },
    { key:"feet1", label:"FEET1" },
    { key:"feet2", label:"FEET2" },
  ];

  for (const { key, label } of TIERS) {
    const t = tiers[key] || {};
    const cr = (t.link_sent_range > 0 && t.paid_range > 0)
      ? pct(t.paid_range / t.link_sent_range) : "—";
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
      </div>
    `;
    grid.appendChild(card);
  }
}

function renderReentry(re) {
  if (!re) return;
  setText("reentryLinkSent", num(re.link_sent?.total));
  setText("reentryPaid",     num(re.paid?.total));
  setText("reentryRevenue",  eur(re.revenue_cents?.total));
  setText("reentryCVR", re.cvr?.total != null ? pct(re.cvr.total) : "—");

  const grid = document.getElementById("reentryBreakdown");
  if (!grid) return;
  grid.innerHTML = "";

  const kinds = [
    { key:"tier1_reentry", label:"T1" },
    { key:"tier2_reentry", label:"T2" },
    { key:"tier3_reentry", label:"T3" },
    { key:"feet1_reentry", label:"FEET1" },
    { key:"feet2_reentry", label:"FEET2" },
  ];

  for (const { key, label } of kinds) {
    const sent = re.link_sent?.[key] ?? 0;
    const paid = re.paid?.[key]      ?? 0;
    const rev  = re.revenue_cents?.[key] ?? 0;
    const cvr  = re.cvr?.[key] ?? null;
    const box = document.createElement("div");
    box.className = "reentryBox";
    box.innerHTML = `
      <div class="reentryBoxName">${label}</div>
      <div class="reentryRows">
        <div class="reentryRow"><span class="reentryRowLabel">Sent</span><span class="reentryRowVal">${num(sent)}</span></div>
        <div class="reentryRow"><span class="reentryRowLabel">Paid</span><span class="reentryRowVal">${num(paid)}</span></div>
        <div class="reentryRow"><span class="reentryRowLabel">Rev</span><span class="reentryRowVal">${eur(rev)}</span></div>
        <div class="reentryRow"><span class="reentryRowLabel">CVR</span><span class="reentryRowVal">${cvr != null ? pct(cvr) : "—"}</span></div>
      </div>
    `;
    grid.appendChild(box);
  }
}

function renderUpgrades(u) {
  const grid = document.getElementById("upgradesGrid");
  if (!grid) return;
  const items = [
    { label:"T1→T2", val: u.t1_to_t2 },
    { label:"T2→T3", val: u.t2_to_t3 },
    { label:"→FEET1", val: u.to_feet1 },
    { label:"→FEET2", val: u.to_feet2 },
  ];
  grid.innerHTML = items.map(({ label, val }) => `
    <div class="upBox">
      <div class="upKey">${label}</div>
      <div class="upVal">${num(val)}</div>
    </div>
  `).join("");
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = (v === null || v === undefined) ? "—" : v;
}
function setStatus(msg) { setText("statusMsg", msg); }
function eur(n) { return (n == null) ? "—" : "€" + (n / 100).toFixed(2); }
function num(n) { return (n == null) ? "—" : Number(n).toLocaleString("it-IT"); }
function pct(n) { return (n == null) ? "—" : (n * 100).toFixed(1) + "%"; }

// ─── RANGE SELECT + REFRESH ───────────────────────────────────────────────────
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
  if (btn) btn.addEventListener("click", () => { loading = false; init(); });

  init();
});
