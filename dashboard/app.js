// ================================================
// FOUNDER DARK COMMAND CENTER — app.js
// Legge solo /api/metrics (proxy Pages Function)
// Token mai nel client
// ================================================

let paidChart, leversChart;

// ================================================
// UTILS
// ================================================
function euro(cents) {
  return "€ " + ((cents || 0) / 100).toFixed(2);
}
function pct(r) {
  return ((r || 0) * 100).toFixed(1) + "%";
}
function clamp(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function sumTierMetric(tiers, field) {
  return Object.values(tiers).reduce((a, t) => a + clamp(t[field]), 0);
}

// ================================================
// STATUS DOT
// ================================================
function setStatus(state) {
  const dot = document.getElementById("statusDot");
  const txt = document.getElementById("statusText");
  const colors = { ok: "var(--green)", loading: "var(--yellow)", error: "var(--red)" };
  dot.style.color = colors[state] || "var(--muted)";
  txt.textContent = state;
}

// ================================================
// ALERT STRIP
// ================================================
function showAlertStrip(level, msg) {
  const strip = document.getElementById("alertStrip");
  const badge = document.getElementById("alertBadge");
  const message = document.getElementById("alertMessage");
  strip.classList.remove("hidden", "warn");
  if (level === "yellow") strip.classList.add("warn");
  badge.className = "badge " + (level === "red" ? "red" : "yellow");
  badge.textContent = level === "red" ? "⚠ CRITICAL" : "⚡ WARNING";
  message.textContent = msg;
  setText("alertTime", new Date().toLocaleTimeString());
}
function hideAlertStrip() {
  document.getElementById("alertStrip").classList.add("hidden");
}

// ================================================
// LAMP HELPER
// ================================================
function lamp(id, color) {
  const glowMap = {
    "var(--red)": "0 0 14px var(--red-glow)",
    "var(--yellow)": "0 0 14px var(--yellow-glow)",
    "var(--green)": "0 0 14px var(--green-glow)",
  };
  const el = document.getElementById(id);
  if (!el) return;
  el.style.background = color;
  el.style.boxShadow = glowMap[color] || "none";
}

// ================================================
// FETCH
// ================================================
async function fetchMetrics(range) {
  const res = await fetch(`/api/metrics?range=${range}`, { cache: "no-store" });
  if (!res.ok) throw new Error("metrics error " + res.status);
  return await res.json();
}

// ================================================
// DAILY TARGET (usa d1 + d7)
// ================================================
function renderTarget(d1, d7) {
  const link1 = sumTierMetric(d1.tiers, "link_sent_range");
  const link7 = sumTierMetric(d7.tiers, "link_sent_range");
  const paid7 = clamp(d7.kpi.total_paid_range);
  const arppu7 = clamp(d7.kpi.arppu_range_cents);

  let convExp = link7 > 0 ? paid7 / link7 : 0.1;
  convExp = Math.max(0.03, Math.min(0.25, convExp));

  const eod = Math.round(link1 * convExp * arppu7);

  const now = new Date();
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const progress = secs / 86400;
  const grace = now.getHours() < 10 ? 0.75 : 1.0;
  const expectedNow = Math.round(eod * progress * grace);
  const actual = clamp(d1.kpi.revenue_range_cents);

  setText("t_eod", euro(eod));
  setText("t_now", euro(expectedNow));
  setText("t_act", euro(actual));

  const pctVal = eod > 0 ? Math.min(100, (actual / eod) * 100) : 0;
  document.getElementById("t_bar").style.width = pctVal + "%";
  setText("t_pct", pctVal.toFixed(0) + "%");

  const lampEl = document.getElementById("lamp_target");
  const noteEl = document.getElementById("t_note");

  if (actual < expectedNow * 0.85) {
    lampEl.style.background = "var(--red)";
    lampEl.style.boxShadow = "0 0 18px var(--red-glow)";
    noteEl.textContent = "⚠ BEHIND — Spingi traffico o migliora conversion.";
    noteEl.style.color = "var(--red)";
  } else if (actual < expectedNow * 0.95) {
    lampEl.style.background = "var(--yellow)";
    lampEl.style.boxShadow = "0 0 18px var(--yellow-glow)";
    noteEl.textContent = "⚡ Leggermente indietro — Micro push consigliato.";
    noteEl.style.color = "var(--yellow)";
  } else {
    lampEl.style.background = "var(--green)";
    lampEl.style.boxShadow = "0 0 18px var(--green-glow)";
    noteEl.textContent = "✓ ON TRACK — Mantieni la pressione.";
    noteEl.style.color = "var(--green)";
  }
}

// ================================================
// TIER TABLE
// ================================================
function renderTierTable(tiers) {
  const tbody = document.querySelector("#tiersTable tbody");
  tbody.innerHTML = "";
  Object.entries(tiers).forEach(([tier, v]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:800; color:var(--cyan)">${tier}</td>
      <td>${clamp(v.paid_range)}</td>
      <td>${clamp(v.link_sent_range)}</td>
      <td>${pct(v.conversion_range)}</td>
      <td>${clamp(v.reminder1_sent_range)}</td>
      <td>${clamp(v.reminder2_sent_range)}</td>
      <td>${clamp(v.reentry_used_range)}</td>
      <td>${clamp(v.lock_set_range)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ================================================
// CHARTS
// ================================================
function renderCharts(d7) {
  const labels = Object.keys(d7.tiers);
  const paidData = labels.map(t => clamp(d7.tiers[t].paid_range));

  const chartDefaults = {
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#5a6490", font: { family: "'JetBrains Mono'", size: 11 } }, grid: { color: "rgba(255,255,255,.04)" } },
      y: { ticks: { color: "#5a6490", font: { family: "'JetBrains Mono'", size: 11 } }, grid: { color: "rgba(255,255,255,.04)" } }
    }
  };

  if (paidChart) paidChart.destroy();
  if (leversChart) leversChart.destroy();

  paidChart = new Chart(document.getElementById("paidChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Paid",
        data: paidData,
        backgroundColor: labels.map((_, i) => `hsla(${200 + i * 30}, 90%, 65%, 0.7)`),
        borderColor: labels.map((_, i) => `hsla(${200 + i * 30}, 90%, 65%, 1)`),
        borderWidth: 1,
        borderRadius: 8,
      }]
    },
    options: { ...chartDefaults, animation: { duration: 600 } }
  });

  leversChart = new Chart(document.getElementById("leversChart"), {
    type: "bar",
    data: {
      labels: ["Reminder", "Reentry", "Locks"],
      datasets: [{
        label: "Levers",
        data: [
          clamp(d7.levers.reminder_sent_total),
          clamp(d7.levers.reentry_used_total),
          clamp(d7.levers.locks_set_total)
        ],
        backgroundColor: ["rgba(60,199,255,.65)", "rgba(255,213,74,.65)", "rgba(255,59,59,.65)"],
        borderColor: ["rgba(60,199,255,1)", "rgba(255,213,74,1)", "rgba(255,59,59,1)"],
        borderWidth: 1,
        borderRadius: 8,
      }]
    },
    options: { ...chartDefaults, animation: { duration: 600 } }
  });
}

// ================================================
// PUSH LIST HELPERS
// ================================================
function clearLists() {
  ["criticalList", "warningList", "suggestList"].forEach(id => {
    document.getElementById(id).innerHTML = "";
  });
}
function pushLI(ulId, text) {
  const ul = document.getElementById(ulId);
  const li = document.createElement("li");
  li.textContent = text;
  ul.appendChild(li);
}
function placeholderIfEmpty(id, msg) {
  const ul = document.getElementById(id);
  if (!ul.children.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = msg;
    ul.appendChild(li);
  }
}

// ================================================
// EVALUATE — 15 metriche + soglie + alert
// ================================================
function evaluate({ d1, d7, d30 }) {
  clearLists();
  hideAlertStrip();

  // Base numbers
  const link1 = sumTierMetric(d1.tiers, "link_sent_range");
  const link7 = sumTierMetric(d7.tiers, "link_sent_range");
  const avgLink7 = link7 / 7;

  const rem1 = clamp(d1.levers.reminder_sent_total);
  const rem7 = clamp(d7.levers.reminder_sent_total);
  const avgRem7 = rem7 / 7;

  const paid1 = clamp(d1.kpi.total_paid_range);
  const paid7 = clamp(d7.kpi.total_paid_range);
  const avgPaid7 = paid7 / 7;

  const rev1 = clamp(d1.kpi.revenue_range_cents);
  const rev7 = clamp(d7.kpi.revenue_range_cents);
  const rev30 = clamp(d30.kpi.revenue_range_cents);
  const avgRev7 = rev7 / 7;
  const revDelta = avgRev7 > 0 ? rev1 / avgRev7 : 0;

  const reentry1 = clamp(d1.levers.reentry_used_total);
  const lock1 = clamp(d1.levers.locks_set_total);

  const arppu7 = clamp(d7.kpi.arppu_range_cents);
  const t1conv7 = clamp(d7.kpi.t1_conversion_range);
  const upg7 = clamp(d7.kpi.t2_to_t3_upgrade_range);

  const reminderEff = rem1 > 0 ? paid1 / rem1 : (paid1 > 0 ? 1 : 0);
  const reentryRate = link1 > 0 ? reentry1 / link1 : 0;
  const lockRate = link1 > 0 ? lock1 / link1 : 0;
  const growth = rev30 > 0 ? (rev7 / 7) / (rev30 / 30) : 0;
  const valuation = rev30 * 10;

  // --- Render Machine Status cards ---
  setText("v_link", String(link1));
  setText("s_link", `avg 7d/day: ${avgLink7.toFixed(1)}`);
  setText("v_rem", String(rem1));
  setText("s_rem", `avg 7d/day: ${avgRem7.toFixed(1)}`);
  setText("v_paid", String(paid1));
  setText("s_paid", `avg 7d/day: ${avgPaid7.toFixed(1)}`);
  setText("v_revdelta", (revDelta || 0).toFixed(2) + "×");
  setText("s_revdelta", `rev1d: ${euro(rev1)} | avg: ${euro(avgRev7)}`);
  setText("v_reentry", (reentryRate * 100).toFixed(1) + "%");
  setText("s_reentry", `reentry: ${reentry1} / link: ${link1}`);

  // --- Render Revenue Core ---
  setText("r_rev1", euro(rev1));
  setText("r_rev7", euro(rev7));
  setText("r_rev30", euro(rev30));
  setText("r_arppu", euro(arppu7));
  setText("r_t1conv", pct(t1conv7));
  setText("r_upg", pct(upg7));
  setText("r_val", euro(valuation));
  setText("r_growth", growth.toFixed(2) + "×");

  // ============ SEMAFORI ============

  // 1. Link sent 1d
  if (link1 === 0) {
    lamp("lamp_link", "var(--red)");
    pushLI("criticalList", "Link sent 1d = 0 → trigger rotto o routing non funziona.");
  } else if (link1 < avgLink7 / 2) {
    lamp("lamp_link", "var(--yellow)");
    pushLI("warningList", "Link sent sotto metà della media 7d → traffico o trigger in calo.");
  } else {
    lamp("lamp_link", "var(--green)");
  }

  // 2. Reminder 1d
  if (rem1 === 0 && link1 > 5) {
    lamp("lamp_rem", "var(--red)");
    pushLI("criticalList", "Reminder 1d = 0 con link presenti → CRON morto o followup non schedulati.");
  } else if (rem1 < avgRem7 * 0.7) {
    lamp("lamp_rem", "var(--yellow)");
    pushLI("warningList", "Reminder sotto media → followup troppo deboli o scheduling intermittente.");
  } else {
    lamp("lamp_rem", "var(--green)");
  }

  // 3. Paid 1d
  if (paid1 === 0) {
    lamp("lamp_paid", "var(--red)");
    pushLI("criticalList", "Paid 1d = 0 → conversion crollata o checkout bloccato.");
  } else if (paid1 < avgPaid7 * 0.6) {
    lamp("lamp_paid", "var(--yellow)");
    pushLI("warningList", "Paid sotto 60% media giornaliera 7d → giornata debole.");
  } else {
    lamp("lamp_paid", "var(--green)");
  }

  // 4. Revenue delta
  if (revDelta < 0.6) {
    lamp("lamp_revdelta", "var(--red)");
    pushLI("criticalList", "Revenue delta < 0.6× → revenue in caduta libera.");
  } else if (revDelta < 0.8) {
    lamp("lamp_revdelta", "var(--yellow)");
    pushLI("warningList", "Revenue delta 0.6–0.8× → attenzione, monitora.");
  } else {
    lamp("lamp_revdelta", "var(--green)");
  }

  // 5. Reentry rate
  if (reentryRate > 0.40) {
    lamp("lamp_reentry", "var(--red)");
    pushLI("criticalList", "Reentry usage > 40% → frizione pricing altissima.");
  } else if (reentryRate > 0.20) {
    lamp("lamp_reentry", "var(--yellow)");
    pushLI("warningList", "Reentry usage 20–40% → frizione elevata, rivedi il pricing.");
  } else {
    lamp("lamp_reentry", "var(--green)");
  }

  // ============ BUSINESS THRESHOLDS (7d) ============
  if (t1conv7 < 0.08) {
    pushLI("criticalList", "T1 conversion < 8% (7d) → copy/teaser/qualità traffico da rifare.");
  } else if (t1conv7 < 0.12) {
    pushLI("warningList", "T1 conversion 8–12% (7d) → migliorabile con A/B test.");
  }

  if (upg7 < 0.15) {
    pushLI("criticalList", "Upgrade T2→T3 < 15% (7d) → upsell rotto o value non percepito.");
  } else if (upg7 < 0.25) {
    pushLI("warningList", "Upgrade T2→T3 15–25% (7d) → spingere value/posizionamento T3.");
  }

  if (reminderEff < 0.05 && rem1 > 3) {
    pushLI("warningList", "Reminder efficiency bassa (paid/reminder < 5%) → followup inefficaci.");
  }
  if (lockRate > 0.60) {
    pushLI("warningList", "Lock ratio > 60% → pressione troppo alta, rischio drop/attrito.");
  }

  // ============ SUGGESTIONS ============
  if (link1 === 0) pushLI("suggestList", "Verifica immediata: routing trigger / keyword / stage. Controlla log deploy.");
  if (rem1 === 0 && link1 > 5) pushLI("suggestList", "Controlla CRON schedule + timed_queue: reminder non partono.");
  if (paid1 === 0 && link1 > 10) pushLI("suggestList", "Rivedi copy link + pricing friction: A/B test call-to-action.");
  if (t1conv7 < 0.08) pushLI("suggestList", "Rifai il teaser pubblico (hook + tensione) e semplifica CTA.");
  if (upg7 < 0.15) pushLI("suggestList", "Rafforza value T2 prima dell'upsell e rendi T3 inevitabile.");
  if (reentryRate > 0.20) pushLI("suggestList", "Riduci frizione percepita: chiarisci incluso, social proof, micro-garanzia.");
  if (reminderEff < 0.05 && rem1 > 3) pushLI("suggestList", "Sposta timing followup: reminder1 più vicino, reminder2 più secco.");
  if (growth > 1.15) pushLI("suggestList", "Crescita >15%: spingi acquisizione mantenendo upgrade stabile.");
  else if (growth < 0.90 && rev30 > 0) pushLI("suggestList", "Stagnazione: aumenta teaser + ottimizza T1 conversion.");

  // Placeholder se tutto ok
  placeholderIfEmpty("criticalList", "✓ Nessun critical rilevato");
  placeholderIfEmpty("warningList", "✓ Nessun warning rilevato");
  placeholderIfEmpty("suggestList", "✓ Tutto nella norma");

  // ============ ALERT STRIP ============
  const critCount = document.getElementById("criticalList").querySelectorAll("li:not(.muted)").length;
  const warnCount = document.getElementById("warningList").querySelectorAll("li:not(.muted)").length;

  if (critCount > 0) {
    showAlertStrip("red", `${critCount} issue(s) critici rilevati — Controlla "Critical" immediatamente.`);
  } else if (warnCount > 0) {
    showAlertStrip("yellow", `${warnCount} warning(s) attivi — Controlla "Warnings".`);
  }

  // Charts + table (d7 come base)
  renderTierTable(d7.tiers);
  renderCharts(d7);
}

// ================================================
// MAIN LOAD
// ================================================
async function load() {
  try {
    setStatus("loading");
    const [d1, d7, d30] = await Promise.all([
      fetchMetrics("1d"),
      fetchMetrics("7d"),
      fetchMetrics("30d"),
    ]);

    evaluate({ d1, d7, d30 });
    renderTarget(d1, d7);

    setText("lastUpdated", "Updated: " + new Date().toLocaleString("it-IT"));
    setStatus("ok");
  } catch (e) {
    console.error(e);
    setStatus("error");
    showAlertStrip("red", "Impossibile leggere /api/metrics. Verifica Pages env vars e Worker online.");
  }
}

// ================================================
// EVENTS
// ================================================
document.getElementById("refreshBtn").addEventListener("click", load);

// Auto-refresh 60s solo se tab visibile
setInterval(() => {
  if (document.visibilityState === "visible") load();
}, 60000);

load();
