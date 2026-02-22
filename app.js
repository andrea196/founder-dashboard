// Dashboard App v7 — fix definitivo loading + WORKER_URL esplicito

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// URL del worker Cloudflare — DEVE essere l'URL completo se dashboard è su Pages
const WORKER_URL = "https://cold-sun-7c50luna.andreagalletti.workers.dev";

function getAuthHeaders() {
  const tok = (typeof window !== "undefined" && window.DASH_TOKEN) || "123";
  return { "X-DASH-TOKEN": tok, "X-API-Key": tok };
}

let currentRange = "1d";
let cachedData = {};
let isLoading = false;

// ─── FETCH ────────────────────────────────────────────────────────────────────

async function fetchMetrics(range) {
  try {
    const res = await fetch(`${WORKER_URL}/metrics?range=${range}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      console.warn(`[Dashboard] /metrics?range=${range} → HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch(e) {
    console.warn(`[Dashboard] fetchMetrics(${range}) error:`, e.message);
    return null;
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  if (isLoading) return;
  isLoading = true;
  setSpinner(true);
  setBanner(null);

  try {
    const [d1, d7, d30] = await Promise.all([
      fetchMetrics("1d"),
      fetchMetrics("7d"),
      fetchMetrics("30d")
    ]);

    cachedData = { "1d": d1, "7d": d7, "30d": d30 };

    if (!d1 && !d7 && !d30) {
      setBanner("❌ Nessun dato disponibile — controlla che il worker sia raggiungibile e DASH_TOKEN sia corretto.");
    } else {
      renderAll();
    }
  } catch(e) {
    setBanner("❌ Errore: " + e.message);
  } finally {
    isLoading = false;
    setSpinner(false);
  }
}

// ─── RANGE SELECTOR ───────────────────────────────────────────────────────────

function setupUI() {
  document.querySelectorAll(".range-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".range-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRange = btn.dataset.range;
      renderAll();
    });
  });

  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) refreshBtn.addEventListener("click", () => { isLoading = false; init(); });

  init();
}

// Chiama setupUI sia su DOMContentLoaded che subito (per script caricati in fondo)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupUI);
} else {
  setupUI();
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderAll() {
  const d1     = cachedData["1d"];
  const d7     = cachedData["7d"];
  const d30    = cachedData["30d"];
  const active = cachedData[currentRange];

  renderRevenueBar(d1, d7, d30);
  if (active) {
    renderKPIs(active);
    renderTierGrid(active);
    renderUpgrades(active);
    renderLevers(active);
    renderOps(active);
    renderReentry(active);
    renderMeta(active);
  }
}

function fmt(n, type) {
  if (n === null || n === undefined) return "—";
  if (type === "eur") return "€" + (n / 100).toFixed(2);
  if (type === "pct") return (n * 100).toFixed(1) + "%";
  return Number(n).toLocaleString("it-IT");
}

function renderRevenueBar(d1, d7, d30) {
  setEl("rev-1d",  fmt(d1?.kpi?.revenue_range_cents, "eur"));
  setEl("rev-7d",  fmt(d7?.kpi?.revenue_range_cents, "eur"));
  setEl("rev-30d", fmt(d30?.kpi?.revenue_range_cents, "eur"));
}

function renderKPIs(data) {
  const k = data?.kpi || {};
  setEl("kpi-revenue", fmt(k.revenue_range_cents, "eur"));
  setEl("kpi-paid",    fmt(k.total_paid_range));
  setEl("kpi-t1conv",  fmt(k.t1_conversion_range, "pct"));
  setEl("kpi-t2t3upg", fmt(k.t2_to_t3_upgrade_range, "pct"));
  setEl("kpi-arppu",   fmt(k.arppu_range_cents, "eur"));
}

function renderTierGrid(data) {
  const tiers  = data?.tiers || {};
  const keys   = ["t1","t2","t3","feet1","feet2"];
  const labels = { t1:"T1", t2:"T2", t3:"T3", feet1:"FEET1", feet2:"FEET2" };
  const grid   = document.getElementById("tier-grid");
  if (!grid) return;
  grid.innerHTML = "";

  for (const t of keys) {
    const d = tiers[t] || {};
    const card = document.createElement("div");
    card.className = "tier-card";
    card.innerHTML = `
      <h3>${labels[t]}</h3>
      <div class="tier-stat"><span>Link sent</span><strong>${fmt(d.link_sent_range)}</strong></div>
      <div class="tier-stat"><span>Paid</span><strong>${fmt(d.paid_range)}</strong></div>
      <div class="tier-stat"><span>CR</span><strong>${d.conversion_range ? fmt(d.conversion_range,"pct") : "—"}</strong></div>
      <div class="tier-stat secondary"><span>Reminder 1</span><strong>${fmt(d.reminder1_sent_range)}</strong></div>
      <div class="tier-stat secondary"><span>Reminder 2</span><strong>${fmt(d.reminder2_sent_range)}</strong></div>
      <div class="tier-stat secondary"><span>Reentry used</span><strong>${fmt(d.reentry_used_range)}</strong></div>
      <div class="tier-stat secondary"><span>Locks set</span><strong>${fmt(d.lock_set_range)}</strong></div>
    `;
    grid.appendChild(card);
  }
}

function renderUpgrades(data) {
  const u = data?.upgrades || {};
  setEl("upg-t1t2",  fmt(u.t1_to_t2));
  setEl("upg-t2t3",  fmt(u.t2_to_t3));
  setEl("upg-feet1", fmt(u.to_feet1));
  setEl("upg-feet2", fmt(u.to_feet2));
}

function renderLevers(data) {
  const l = data?.levers || {};
  setEl("lev-reminder", fmt(l.reminder_sent_total));
  setEl("lev-reentry",  fmt(l.reentry_used_total));
  setEl("lev-locks",    fmt(l.locks_set_total));
}

function renderOps(data) {
  const o = data?.ops || {};
  setEl("ops-active", fmt(o.active_users_24h));
  setEl("ops-new",    fmt(o.new_users_range));
}

function renderMeta(data) {
  const el = document.getElementById("meta-generated");
  if (el && data?.generated_at)
    el.textContent = "Aggiornato: " + new Date(data.generated_at).toLocaleString("it-IT");
}

function renderReentry(data) {
  const re  = data?.reentry;
  const sec = document.getElementById("reentry-section");
  if (!re) {
    if (sec) sec.innerHTML = "<p style='color:#888;padding:16px'>Nessun dato reentry.</p>";
    return;
  }

  setEl("re-total-sent", fmt(re.link_sent?.total));
  setEl("re-total-paid", fmt(re.paid?.total));
  setEl("re-total-rev",  fmt(re.revenue_cents?.total, "eur"));
  setEl("re-total-cvr",  re.cvr?.total != null ? fmt(re.cvr.total,"pct") : "—");

  const grid = document.getElementById("reentry-breakdown");
  if (!grid) return;
  grid.innerHTML = "";

  const kinds  = ["tier1_reentry","tier2_reentry","tier3_reentry","feet1_reentry","feet2_reentry"];
  const labels = {
    tier1_reentry:"T1 Reentry", tier2_reentry:"T2 Reentry", tier3_reentry:"T3 Reentry",
    feet1_reentry:"FEET1 Reentry", feet2_reentry:"FEET2 Reentry"
  };

  for (const k of kinds) {
    const sent = re.link_sent?.[k]     ?? 0;
    const paid = re.paid?.[k]          ?? 0;
    const rev  = re.revenue_cents?.[k] ?? 0;
    const cvr  = re.cvr?.[k]           ?? null;
    const card = document.createElement("div");
    card.className = "reentry-card";
    card.innerHTML = `
      <h4>${labels[k]}</h4>
      <div class="tier-stat"><span>Link sent</span><strong>${fmt(sent)}</strong></div>
      <div class="tier-stat"><span>Paid</span><strong>${fmt(paid)}</strong></div>
      <div class="tier-stat"><span>Revenue</span><strong>${fmt(rev,"eur")}</strong></div>
      <div class="tier-stat"><span>CVR</span><strong>${cvr != null ? fmt(cvr,"pct") : "—"}</strong></div>
    `;
    grid.appendChild(card);
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? "—";
}

function setSpinner(on) {
  const s = document.getElementById("spinner");
  if (s) s.style.display = on ? "block" : "none";
}

function setBanner(msg) {
  const el = document.getElementById("error-banner");
  if (!el) {
    if (msg) console.error("[Dashboard]", msg);
    return;
  }
  if (msg) { el.textContent = msg; el.style.display = "block"; }
  else { el.style.display = "none"; }
}
