// WAR ROOM v4 — Dropdown range + REENTRY analytics
const $ = (id) => document.getElementById(id);

// ── CONFIGURAZIONE ──────────────────────────────────────────────
// Imposta qui il tuo target giornaliero (in euro). Metti 0 per nasconderlo.
const DAILY_TARGET_EUR = 0;
// ────────────────────────────────────────────────────────────────

function euroFromCents(cents) {
  if (typeof cents !== "number") return "—";
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
function n(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("it-IT");
  return String(v);
}
function rate(num, den) {
  if (typeof num !== "number" || typeof den !== "number" || den === 0) return "—";
  return ((num / den) * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + "%";
}
function tierLabel(key) {
  const map = { t1: "T1", t2: "T2", t3: "T3", feet1: "FEET 1", feet2: "FEET 2" };
  return map[key] || key.toUpperCase();
}

function buildTierCards(tiers) {
  const root = $("tierGrid");
  root.innerHTML = "";
  if (!tiers || typeof tiers !== "object") {
    root.innerHTML = '<div class="muted">tiers non presenti nel JSON</div>';
    return;
  }
  const order = ["t1","t2","t3","feet1","feet2"];
  for (const k of order) {
    const t = tiers[k];
    if (!t) continue;
    const linkSent = t.link_sent_range ?? 0;
    const paid = t.paid_range ?? 0;
    const card = document.createElement("div");
    card.className = "tierCard";
    card.innerHTML = `
      <div class="tierHead">
        <div class="tierName">${tierLabel(k)}</div>
        <div class="tierRate">CR: <span class="mono">${rate(paid, linkSent)}</span></div>
      </div>
      <div class="rows">
        <div class="row"><div class="rLabel">Link sent</div><div class="rVal mono">${n(t.link_sent_range)}</div></div>
        <div class="row"><div class="rLabel">Reminder 1</div><div class="rVal mono">${n(t.reminder1_sent_range)}</div></div>
        <div class="row"><div class="rLabel">Reminder 2</div><div class="rVal mono">${n(t.reminder2_sent_range)}</div></div>
        <div class="row"><div class="rLabel">Reentry used</div><div class="rVal mono">${n(t.reentry_used_range)}</div></div>
        <div class="row"><div class="rLabel">Paid</div><div class="rVal mono">${n(t.paid_range)}</div></div>
        <div class="row"><div class="rLabel">Conversion (worker)</div><div class="rVal mono">${n(t.conversion_range)}</div></div>
        <div class="row"><div class="rLabel">Locks set</div><div class="rVal mono">${n(t.lock_set_range)}</div></div>
      </div>
    `;
    root.appendChild(card);
  }
}

function buildUpgrades(upgrades) {
  const root = $("upgradesGrid");
  root.innerHTML = "";
  if (!upgrades || typeof upgrades !== "object") {
    root.innerHTML = '<div class="muted">upgrades non presenti nel JSON</div>';
    return;
  }
  const items = [
    ["t1_to_t2", "T1 → T2"],
    ["t2_to_t3", "T2 → T3"],
    ["to_feet1", "→ FEET 1"],
    ["to_feet2", "→ FEET 2"],
  ];
  for (const [k, label] of items) {
    const box = document.createElement("div");
    box.className = "upBox";
    box.innerHTML = `<div class="upKey">${label}</div><div class="upVal mono">${n(upgrades[k])}</div>`;
    root.appendChild(box);
  }
}

// ── REENTRY BREAKDOWN ───────────────────────────────────────────
function buildReentryBreakdown(reentry) {
  const root = $("reentryBreakdown");
  root.innerHTML = "";

  const kinds = ["tier1_reentry","tier2_reentry","tier3_reentry","feet1_reentry","feet2_reentry"];
  const labels = { tier1_reentry:"T1", tier2_reentry:"T2", tier3_reentry:"T3", feet1_reentry:"FEET1", feet2_reentry:"FEET2" };

  // Se non c'è il blocco reentry nel JSON, mostra placeholder
  if (!reentry || typeof reentry !== "object") {
    root.innerHTML = '<div class="muted" style="font-size:12px">Nessun dato reentry ancora. Implementa la telemetria nel worker (vedi spec).</div>';
    return;
  }

  for (const k of kinds) {
    const sent  = reentry?.link_sent?.by_kind?.[k] ?? 0;
    const paid  = reentry?.paid?.by_kind?.[k] ?? 0;
    const rev   = reentry?.revenue_cents?.by_kind?.[k] ?? 0;
    const cvr   = reentry?.cvr?.by_kind?.[k];

    const cvrStr = typeof cvr === "number"
      ? (cvr * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + "%"
      : rate(paid, sent);

    const box = document.createElement("div");
    box.className = "reentryBox";
    box.innerHTML = `
      <div class="reentryBoxName">${labels[k]}</div>
      <div class="reentryRows">
        <div class="reentryRow"><span class="reentryRowLabel">Sent</span><span class="reentryRowVal">${n(sent)}</span></div>
        <div class="reentryRow"><span class="reentryRowLabel">Paid</span><span class="reentryRowVal">${n(paid)}</span></div>
        <div class="reentryRow"><span class="reentryRowLabel">Revenue</span><span class="reentryRowVal">${euroFromCents(rev)}</span></div>
        <div class="reentryRow"><span class="reentryRowLabel">CVR</span><span class="reentryRowVal">${cvrStr}</span></div>
      </div>
    `;
    root.appendChild(box);
  }
}
// ───────────────────────────────────────────────────────────────

function getRangeFromUrl() {
  const u = new URL(window.location.href);
  const r = u.searchParams.get("range");
  if (["1d","7d","14d","30d"].includes(r)) return r;
  return null;
}
function setRangeInUrl(range) {
  const u = new URL(window.location.href);
  u.searchParams.set("range", range);
  history.replaceState(null, "", u.toString());
}

async function fetchMetrics(range) {
  const res = await fetch(`/api/metrics?range=${encodeURIComponent(range)}`, {
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error("Risposta non-JSON da /api/metrics: " + text.slice(0, 120)); }
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${data?.error || "error"}`);
  return data;
}

async function load(range) {
  $("statusMsg").textContent = "loading…";
  $("metaRange").textContent = range;

  try {
    // Fetch principale (range selezionato)
    const data = await fetchMetrics(range);

    // Fetch extra per revenue 7D e 30D sempre visibili
    let data7d = null, data30d = null;
    try { data7d  = await fetchMetrics("7d");  } catch {}
    try { data30d = await fetchMetrics("30d"); } catch {}

    // ── META ─────────────────────────────────────────────────
    $("metaRange").textContent = data.range ?? range;
    $("metaFrom").textContent  = data.period?.from ?? "—";
    $("metaTo").textContent    = data.period?.to   ?? "—";
    $("metaGen").textContent   = data.generated_at ?? "—";

    // ── KPI / MONEY ──────────────────────────────────────────
    const kpi = data.kpi || {};
    $("revRange").textContent = euroFromCents(kpi.revenue_range_cents);
    $("rev7d").textContent    = euroFromCents(data7d?.kpi?.revenue_range_cents);
    $("rev30d").textContent   = euroFromCents(data30d?.kpi?.revenue_range_cents);
    $("arppu").textContent    = euroFromCents(kpi.arppu_range_cents);
    $("paidRange").textContent = n(kpi.total_paid_range);

    // Daily target
    if (DAILY_TARGET_EUR > 0) {
      $("targetEOD").textContent = euroFromCents(DAILY_TARGET_EUR * 100);
    }
    $("actualRevenue").textContent = euroFromCents(kpi.revenue_range_cents);
    $("updatedAt").textContent = data.generated_at ?? "—";

    // ── OPS ──────────────────────────────────────────────────
    const ops = data.ops || {};
    const active24h = ops.active_users_24h;
    $("active24h").textContent    = n(active24h);
    $("newUsersRange").textContent = n(ops.new_users_range);
    $("remindersTotal").textContent = n(data.levers?.reminder_sent_total);
    $("locksTotal").textContent     = n(data.levers?.locks_set_total);

    if (typeof active24h === "number" && active24h > 0 && typeof kpi.revenue_range_cents === "number") {
      $("revPerActive").textContent = euroFromCents(Math.round(kpi.revenue_range_cents / active24h));
    } else {
      $("revPerActive").textContent = "—";
    }

    // ── REENTRY TOTALI ────────────────────────────────────────
    const re = data.reentry || null;
    $("reentryLinkSent").textContent = n(re?.link_sent?.total);
    $("reentryPaid").textContent     = n(re?.paid?.total);
    $("reentryRevenue").textContent  = euroFromCents(re?.revenue_cents?.total);

    // CVR: prende dal JSON se presente, altrimenti calcola
    let cvrTotal = re?.cvr?.total;
    if (typeof cvrTotal !== "number" && re?.paid?.total > 0 && re?.link_sent?.total > 0) {
      cvrTotal = re.paid.total / re.link_sent.total;
    }
    $("reentryCVR").textContent = typeof cvrTotal === "number"
      ? (cvrTotal * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + "%"
      : "—";

    buildReentryBreakdown(re);

    // ── TIER & UPGRADES ───────────────────────────────────────
    buildTierCards(data.tiers);
    buildUpgrades(data.upgrades);

    $("statusMsg").textContent = "OK";
  } catch (err) {
    $("statusMsg").textContent = "ERROR: " + (err?.message || String(err));
    console.error(err);
  }
}

// ── INIT ─────────────────────────────────────────────────────────
const select     = $("rangeSelect");
const refreshBtn = $("refreshBtn");

const initial = getRangeFromUrl() || select.value || "7d";
select.value = initial;
setRangeInUrl(initial);

select.addEventListener("change", () => {
  setRangeInUrl(select.value);
  load(select.value);
});
refreshBtn.addEventListener("click", () => load(select.value));

load(initial);
