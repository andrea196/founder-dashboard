// WAR ROOM — Dropdown range selector
const $ = (id) => document.getElementById(id);

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
        <div class="tierRate">Conversion Rate: <span class="mono">${rate(paid, linkSent)}</span></div>
      </div>
      <div class="rows">
        <div class="row"><div class="rLabel">Link sent</div><div class="rVal mono">${n(t.link_sent_range)}</div></div>
        <div class="row"><div class="rLabel">Reminder 1 sent</div><div class="rVal mono">${n(t.reminder1_sent_range)}</div></div>
        <div class="row"><div class="rLabel">Reminder 2 sent</div><div class="rVal mono">${n(t.reminder2_sent_range)}</div></div>
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

function getRangeFromUrl() {
  const u = new URL(window.location.href);
  const r = u.searchParams.get("range");
  if (r === "1d" || r === "7d" || r === "14d" || r === "30d") return r;
  return null;
}
function setRangeInUrl(range) {
  const u = new URL(window.location.href);
  u.searchParams.set("range", range);
  history.replaceState(null, "", u.toString());
}

async function load(range) {
  $("statusMsg").textContent = "loading…";
  $("metaRange").textContent = range;

  try {
    const res = await fetch(`/api/metrics?range=${encodeURIComponent(range)}`, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("Risposta non-JSON da /api/metrics: " + text.slice(0, 120)); }

    if (!res.ok) throw new Error(`HTTP ${res.status} — ${data?.error || "error"}`);

    $("metaRange").textContent = data.range ?? range;
    $("metaFrom").textContent = data.period?.from ?? "—";
    $("metaTo").textContent = data.period?.to ?? "—";
    $("metaGen").textContent = data.generated_at ?? "—";

    const kpi = data.kpi || {};
    $("revRange").textContent = euroFromCents(kpi.revenue_range_cents);
    $("paidRange").textContent = n(kpi.total_paid_range);
    $("arppu").textContent = euroFromCents(kpi.arppu_range_cents);

    const active24h = data.ops?.active_users_24h;
    $("active24h").textContent = n(active24h);
    $("newUsersRange").textContent = n(data.ops?.new_users_range);

    $("remindersTotal").textContent = n(data.levers?.reminder_sent_total);
    $("reentryTotal").textContent = n(data.levers?.reentry_used_total);
    $("locksTotal").textContent = n(data.levers?.locks_set_total);
    $("t2t3Upgrade").textContent = n(kpi.t2_to_t3_upgrade_range);

    if (typeof active24h === "number" && active24h > 0 && typeof kpi.revenue_range_cents === "number") {
      $("revPerActive").textContent = euroFromCents(Math.round(kpi.revenue_range_cents / active24h));
    } else {
      $("revPerActive").textContent = "—";
    }

    $("targetEOD").textContent = "—";
    $("actualRevenue").textContent = euroFromCents(kpi.revenue_range_cents);
    $("updatedAt").textContent = data.generated_at ?? "—";

    buildTierCards(data.tiers);
    buildUpgrades(data.upgrades);

    $("statusMsg").textContent = "OK";
  } catch (err) {
    $("statusMsg").textContent = "ERROR: " + (err?.message || String(err));
    console.error(err);
  }
}

const select = $("rangeSelect");
const refreshBtn = $("refreshBtn");

const initial = getRangeFromUrl() || select.value || "7d";
select.value = initial;
setRangeInUrl(initial);

select.addEventListener("change", () => {
  const r = select.value;
  setRangeInUrl(r);
  load(r);
});
refreshBtn.addEventListener("click", () => load(select.value));

load(initial);
