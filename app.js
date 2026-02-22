// Dashboard App — fix: correct endpoint /metrics + auth headers + flat reentry structure

// CONFIG — Cloudflare Pages chiama il worker su dominio diverso
// Se il worker e Pages sono sullo stesso dominio lascia vuoto,
// altrimenti metti l'URL completo del worker qui:
const WORKER_URL = typeof __WORKER_URL__ !== "undefined" ? __WORKER_URL__ : "";
// __WORKER_URL__ può essere iniettato via index.html come variabile globale

// Token letto dall'header HTML (window.DASH_TOKEN settato da index.html)
function getAuthHeaders() {
  const tok = window.DASH_TOKEN || "";
  // Worker /metrics accetta X-DASH-TOKEN o X-API-Key (isAdmin)
  // Mandiamo entrambi per compatibilità massima
  return {
    "X-DASH-TOKEN": tok,
    "X-API-Key":    tok
  };
}

let currentRange = "1d";

// ─── FETCH ────────────────────────────────────────────────────────────────────

async function fetchMetrics(range) {
  // BUG FIX: endpoint è /metrics NON /api/metrics
  const url = `${WORKER_URL}/metrics?range=${range}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 100)}`);
  }
  return res.json();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  setLoading(true);
  hideError();
  try {
    const [d1, d7, d30] = await Promise.all([
      fetchMetrics("1d"),
      fetchMetrics("7d"),
      fetchMetrics("30d")
    ]);

    // Revenue bar mostra sempre tutti e 3 i range
    renderRevenueBar(d1, d7, d30);

    // Tutto il resto usa il range selezionato
    const active = currentRange === "1d" ? d1 : currentRange === "7d" ? d7 : d30;
    renderKPIs(active);
    renderTierGrid(active);
    renderUpgrades(active);
    renderLevers(active);
    renderOps(active);
    renderReentry(active);
    renderMeta(active);
  } catch (e) {
    showError(e.message);
  } finally {
    setLoading(false);
  }
}

// ─── RANGE SELECTOR ───────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".range-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".range-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRange = btn.dataset.range;
      init();
    });
  });
  document.getElementById("refresh-btn")?.addEventListener("click", init);
  init();
});

// ─── FORMAT ───────────────────────────────────────────────────────────────────

function fmt(n, type) {
  if (n === null || n === undefined) return "—";
  if (type === "eur") return "€" + (n / 100).toFixed(2);
  if (type === "pct") return (n * 100).toFixed(1) + "%";
  return Number(n).toLocaleString("it-IT");
}

// ─── RENDER SECTIONS ──────────────────────────────────────────────────────────

function renderRevenueBar(d1, d7, d30) {
  setEl("rev-1d",  fmt(d1?.kpi?.revenue_range_cents,  "eur"));
  setEl("rev-7d",  fmt(d7?.kpi?.revenue_range_cents,  "eur"));
  setEl("rev-30d", fmt(d30?.kpi?.revenue_range_cents, "eur"));
}

function renderKPIs(data) {
  const kpi = data?.kpi || {};
  setEl("kpi-revenue", fmt(kpi.revenue_range_cents, "eur"));
  setEl("kpi-paid",    fmt(kpi.total_paid_range));
  setEl("kpi-t1conv",  fmt(kpi.t1_conversion_range, "pct"));
  setEl("kpi-t2t3upg", fmt(kpi.t2_to_t3_upgrade_range, "pct"));
  setEl("kpi-arppu",   fmt(kpi.arppu_range_cents, "eur"));
}

function renderTierGrid(data) {
  const tiers  = data?.tiers || {};
  const keys   = ["t1", "t2", "t3", "feet1", "feet2"];
  const labels = { t1: "T1", t2: "T2", t3: "T3", feet1: "FEET1", feet2: "FEET2" };
  const grid   = document.getElementById("tier-grid");
  if (!grid) return;
  grid.innerHTML = "";

  for (const t of keys) {
    const d = tiers[t] || {};
    // BUG FIX: campi corretti — link_sent_range (non link_sent)
    const linkSent = d.link_sent_range        ?? 0;
    const paid     = d.paid_range             ?? 0;
    const conv     = d.conversion_range       ?? null;
    const rem1     = d.reminder1_sent_range   ?? 0;
    const rem2     = d.reminder2_sent_range   ?? 0;
    const reentry  = d.reentry_used_range     ?? 0;
    const locks    = d.lock_set_range         ?? 0;

    const card = document.createElement("div");
    card.className = "tier-card";
    card.innerHTML = `
      <h3>${labels[t]}</h3>
      <div class="tier-stat"><span>Link sent</span><strong>${fmt(linkSent)}</strong></div>
      <div class="tier-stat"><span>Paid</span><strong>${fmt(paid)}</strong></div>
      <div class="tier-stat"><span>CR</span><strong>${conv !== null ? fmt(conv, "pct") : "—"}</strong></div>
      <div class="tier-stat secondary"><span>Reminder 1</span><strong>${fmt(rem1)}</strong></div>
      <div class="tier-stat secondary"><span>Reminder 2</span><strong>${fmt(rem2)}</strong></div>
      <div class="tier-stat secondary"><span>Reentry used</span><strong>${fmt(reentry)}</strong></div>
      <div class="tier-stat secondary"><span>Locks set</span><strong>${fmt(locks)}</strong></div>
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
  if (el && data?.generated_at) {
    el.textContent = "Aggiornato: " + new Date(data.generated_at).toLocaleString("it-IT");
  }
}

// ─── REENTRY SECTION ──────────────────────────────────────────────────────────

function renderReentry(data) {
  const re   = data?.reentry;
  const sec  = document.getElementById("reentry-section");
  if (!re) {
    if (sec) sec.innerHTML = "<p style='color:#888;padding:16px'>Nessun dato reentry.</p>";
    return;
  }

  // Totali
  setEl("re-total-sent", fmt(re.link_sent?.total));
  setEl("re-total-paid", fmt(re.paid?.total));
  setEl("re-total-rev",  fmt(re.revenue_cents?.total, "eur"));
  setEl("re-total-cvr",  re.cvr?.total !== null && re.cvr?.total !== undefined
    ? fmt(re.cvr.total, "pct") : "—");

  // Breakdown per tier — struttura PIATTA (no .by_kind)
  const grid   = document.getElementById("reentry-breakdown");
  if (!grid) return;
  grid.innerHTML = "";

  const kinds  = ["tier1_reentry", "tier2_reentry", "tier3_reentry", "feet1_reentry", "feet2_reentry"];
  const labels = {
    tier1_reentry: "T1 Reentry",
    tier2_reentry: "T2 Reentry",
    tier3_reentry: "T3 Reentry",
    feet1_reentry: "FEET1 Reentry",
    feet2_reentry: "FEET2 Reentry"
  };

  for (const k of kinds) {
    // BUG FIX: legge struttura piatta re.link_sent[k], NON re.link_sent.by_kind[k]
    const sent = re.link_sent?.[k]      ?? 0;
    const paid = re.paid?.[k]           ?? 0;
    const rev  = re.revenue_cents?.[k]  ?? 0;
    const cvr  = re.cvr?.[k]            ?? null;

    const card = document.createElement("div");
    card.className = "reentry-card";
    card.innerHTML = `
      <h4>${labels[k]}</h4>
      <div class="tier-stat"><span>Link sent</span><strong>${fmt(sent)}</strong></div>
      <div class="tier-stat"><span>Paid</span><strong>${fmt(paid)}</strong></div>
      <div class="tier-stat"><span>Revenue</span><strong>${fmt(rev, "eur")}</strong></div>
      <div class="tier-stat"><span>CVR</span><strong>${cvr !== null ? fmt(cvr, "pct") : "—"}</strong></div>
    `;
    grid.appendChild(card);
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? "—";
}

function setLoading(on) {
  const s = document.getElementById("spinner");
  if (s) s.style.display = on ? "block" : "none";
}

function hideError() {
  const el = document.getElementById("error-banner");
  if (el) el.style.display = "none";
}

function showError(msg) {
  const el = document.getElementById("error-banner");
  if (el) { el.textContent = "Errore: " + msg; el.style.display = "block"; }
  console.error("[Dashboard]", msg);
}
