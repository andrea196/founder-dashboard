/* Founder Dashboard — app.js (no build tools) */
(function () {
  const $ = (id) => document.getElementById(id);

  const fmtEUR = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
  const fmtInt = new Intl.NumberFormat("it-IT");

  function asInt(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function centsToEUR(cents) {
    const n = asInt(cents);
    return n / 100;
  }

  function setText(id, value) {
    const el = $(id);
    if (!el) return;
    el.textContent = value == null || value === "" ? "—" : String(value);
  }

  function setMoney(id, cents) {
    const el = $(id);
    if (!el) return;
    if (cents == null || cents === "") { el.textContent = "—"; return; }
    el.textContent = fmtEUR.format(centsToEUR(cents));
  }

  function setNum(id, v) {
    const el = $(id);
    if (!el) return;
    if (v == null || v === "") { el.textContent = "—"; return; }
    el.textContent = fmtInt.format(asInt(v));
  }

  function safeGet(obj, path, fallback = null) {
    try {
      return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function calcReminderEfficiency(paid, reminders) {
    const p = asInt(paid);
    const r = asInt(reminders);
    if (r <= 0) return null;
    return p / r;
  }

  function pct(v) {
    if (v == null) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return (n * 100).toFixed(0) + "%";
  }

  function buildTierRow(name, t) {
    const links = safeGet(t, "link_sent_range", 0);
    const rem1 = safeGet(t, "reminder1_sent_range", 0);
    const rem2 = safeGet(t, "reminder2_sent_range", 0);
    const paid = safeGet(t, "paid_range", 0);
    const revenue = safeGet(t, "revenue_range_cents", null);
    const conv = safeGet(t, "conversion_range", null);
    const locks = safeGet(t, "lock_set_range", 0);
    const reentry = safeGet(t, "reentry_used_range", 0);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${name}</strong></td>
      <td>${fmtInt.format(asInt(links))}</td>
      <td>${fmtInt.format(asInt(rem1))}</td>
      <td>${fmtInt.format(asInt(rem2))}</td>
      <td>${fmtInt.format(asInt(paid))}</td>
      <td>${revenue == null ? "—" : fmtEUR.format(centsToEUR(revenue))}</td>
      <td>${conv == null ? "—" : fmtInt.format(asInt(conv))}</td>
      <td>${fmtInt.format(asInt(locks))}</td>
      <td>${fmtInt.format(asInt(reentry))}</td>
    `;
    return tr;
  }

  async function load(range) {
    const status = $("statusPill");
    if (status) status.textContent = "loading…";

    try {
      const res = await fetch(`/api/metrics?range=${encodeURIComponent(range)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Period line
      const from = safeGet(data, "period.from", null);
      const to = safeGet(data, "period.to", null);
      const gen = safeGet(data, "period.generated_at", safeGet(data, "generated_at", null));
      const periodLine = [range && `range=${range}`, from && `from=${from}`, to && `to=${to}`, gen && `gen=${gen}`].filter(Boolean).join(" • ");
      setText("periodLine", periodLine || "—");

      // Target / actual / updated
      // (Se non hai ancora un target server-side, resta 0)
      const targetCents = safeGet(data, "kpi.target_eod_cents", null);
      const actualCents = safeGet(data, "kpi.actual_revenue_cents", safeGet(data, "kpi.revenue_range_cents", null));
      setMoney("targetEOD", targetCents);
      setMoney("actualRevenue", actualCents);
      setText("updatedAt", gen ? String(gen).replace("T", " ").replace("Z", " UTC") : "—");

      // Today ops (prefer total_... in kpi, fallback to totals)
      const links1d = safeGet(data, "kpi.link_sent_range", safeGet(data, "totals.links_sent_total", 0));
      const reminders1d = safeGet(data, "kpi.reminder_sent_total", safeGet(data, "totals.reminder_sent_total", 0));
      const paid1d = safeGet(data, "kpi.total_paid_range", safeGet(data, "kpi.paid_range", safeGet(data, "totals.paid_total", 0)));
      const revenue1d = safeGet(data, "kpi.revenue_range_cents", safeGet(data, "totals.revenue_total_cents", null));

      setNum("links1d", links1d);
      setNum("reminders1d", reminders1d);
      setNum("paid1d", paid1d);
      setMoney("revenue1d", revenue1d);

      setNum("active24h", safeGet(data, "ops.active_users_24h", 0));
      setNum("newUsersRange", safeGet(data, "ops.new_users_range", 0));

      // Sales & conversions
      setNum("t1Conv", safeGet(data, "kpi.t1_conversion_range", null));
      setNum("t2t3", safeGet(data, "kpi.t2_to_t3_upgrade_range", null));
      setNum("feetUp", safeGet(data, "kpi.feet1_to_feet2_upgrade_range", null));
      setMoney("arppu", safeGet(data, "kpi.arppu_range_cents", null));

      const eff = calcReminderEfficiency(paid1d, reminders1d);
      setText("remEff", eff == null ? "—" : pct(eff));

      // Tiers table
      const body = $("tiersBody");
      if (body) {
        body.innerHTML = "";
        const tiers = safeGet(data, "tier", {});
        const order = ["t1", "t2", "t3", "feet1", "feet2"];
        let any = false;
        for (const k of order) {
          if (tiers && tiers[k]) {
            body.appendChild(buildTierRow(k.toUpperCase(), tiers[k]));
            any = true;
          }
        }
        // if unknown keys exist, render them too
        if (tiers && typeof tiers === "object") {
          for (const [k, v] of Object.entries(tiers)) {
            if (order.includes(k)) continue;
            body.appendChild(buildTierRow(k, v));
            any = true;
          }
        }
        if (!any) {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td colspan="9" class="muted">Nessun dato tier disponibile</td>`;
          body.appendChild(tr);
        }
      }

      // Money & growth
      // Revenue 7D/30D prefer metrics from backend if present; else derive from kpi when range matches.
      setMoney("rev7d", safeGet(data, "kpi.revenue_7d_cents", safeGet(data, "kpi.revenue7d_cents", null)));
      setMoney("rev30d", safeGet(data, "kpi.revenue_30d_cents", safeGet(data, "kpi.revenue30d_cents", null)));
      setText("growthRate", safeGet(data, "kpi.growth_rate", "—"));
      setMoney("valuationProxy", safeGet(data, "kpi.valuation_proxy_cents", safeGet(data, "kpi.valuationProxy_cents", null)));

      if (status) status.textContent = "LIVE";
    } catch (err) {
      console.error(err);
      if ($("statusPill")) $("statusPill").textContent = "ERROR";
    }
  }

  function setActiveRangeButton(range) {
    document.querySelectorAll(".segBtn").forEach((b) => {
      b.classList.toggle("isActive", b.getAttribute("data-range") === range);
    });
  }

  let currentRange = "1d";

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.id === "refreshBtn") {
      load(currentRange);
    }
    if (t && t.classList && t.classList.contains("segBtn")) {
      currentRange = t.getAttribute("data-range") || "1d";
      setActiveRangeButton(currentRange);
      load(currentRange);
    }
  });

  // first load
  setActiveRangeButton(currentRange);
  load(currentRange);
})();
