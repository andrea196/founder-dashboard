
async function fetchMetrics(range){
  const res = await fetch(`/api/metrics?range=${range}`);
  return await res.json();
}

function euro(c){ return "€ " + ((c||0)/100).toFixed(2); }
function pct(x){ return x==null?"—":(x*100).toFixed(1)+"%"; }
function ratio(x){ return x==null?"—":x.toFixed(2)+"×"; }

async function load(){
  try{
    const [d1,d7,d30] = await Promise.all([
      fetchMetrics("1d"),
      fetchMetrics("7d"),
      fetchMetrics("30d")
    ]);

    const link1 = d1.kpi?.total_link_range || 0;
    const paid1 = d1.kpi?.total_paid_range || 0;
    const rev1 = d1.kpi?.revenue_range_cents || 0;

    const rev7 = d7.kpi?.revenue_range_cents || 0;
    const rev30 = d30.kpi?.revenue_range_cents || 0;

    const delta = rev7>0 ? rev1/(rev7/7) : null;
    const growth = rev30>0 ? (rev7/7)/(rev30/30) : null;

    document.getElementById("link1").textContent = link1;
    document.getElementById("paid1").textContent = paid1;
    document.getElementById("rev1").textContent = euro(rev1);
    document.getElementById("delta").textContent = ratio(delta);

    document.getElementById("rev7").textContent = euro(rev7);
    document.getElementById("rev30").textContent = euro(rev30);
    document.getElementById("growth").textContent = ratio(growth);
    document.getElementById("valuation").textContent = euro(rev30*10);

  } catch(e){
    console.error(e);
  }
}

load();
