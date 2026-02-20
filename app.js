async function fetchMetrics(range){
  const res = await fetch(`/api/metrics?range=${range}`, { cache:"no-store" });
  if(!res.ok) throw new Error("metrics error " + res.status);
  return await res.json();
}

function euro(cents){ return "€ " + (cents/100).toFixed(2); }

function computeDailyTarget(d1, d7){
  const link1 = Object.values(d1.tiers).reduce((a,t)=>a + (t.link_sent_range||0), 0);
  const link7 = Object.values(d7.tiers).reduce((a,t)=>a + (t.link_sent_range||0), 0);
  const paid7 = d7.kpi.total_paid_range || 0;
  const arppu7 = d7.kpi.arppu_range_cents || 0;

  let convExp = link7 > 0 ? paid7 / link7 : 0.1;
  convExp = Math.max(0.03, Math.min(0.25, convExp));

  const eod = Math.round(link1 * convExp * arppu7);

  const now = new Date();
  const secs = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
  const progress = secs / 86400;
  const grace = now.getHours() < 10 ? 0.75 : 1.0;

  const expectedNow = Math.round(eod * progress * grace);
  const actual = d1.kpi.revenue_range_cents || 0;

  return { eod, expectedNow, actual };
}

function renderTarget(d1, d7){
  const { eod, expectedNow, actual } = computeDailyTarget(d1, d7);

  document.getElementById("t_eod").textContent = euro(eod);
  document.getElementById("t_now").textContent = euro(expectedNow);
  document.getElementById("t_act").textContent = euro(actual);

  const pct = eod > 0 ? Math.min(100, (actual/eod)*100) : 0;
  document.getElementById("t_bar").style.width = pct + "%";

  const lamp = document.getElementById("lamp_target");

  let status = "ON TRACK";
  let color = "lime";

  if(actual < expectedNow * 0.85){
    status = "BEHIND";
    color = "red";
  } else if(actual < expectedNow * 0.95){
    status = "QUASI";
    color = "yellow";
  }

  lamp.style.background = color;

  const msRevenue = document.getElementById("msRevenue");
  const msDot = document.getElementById("msDot");
  const msStatus = document.getElementById("msStatus");

  if(msRevenue){
    msRevenue.textContent = "Oggi: " + euro(actual);
    msDot.style.color = color;
    msStatus.textContent = status;
  }

  document.getElementById("t_note").textContent = status;
}

async function load(){
  try{
    const [d1,d7] = await Promise.all([
      fetchMetrics("1d"),
      fetchMetrics("7d")
    ]);

    renderTarget(d1,d7);
    document.getElementById("lastUpdated").textContent = "Updated: " + new Date().toLocaleString();
  } catch(e){
    console.error(e);
  }
}

document.getElementById("refreshBtn").addEventListener("click", load);
load();
