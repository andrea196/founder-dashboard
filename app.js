const ENDPOINT = (range)=>/api/metrics?range=${range};

function fmtEuro(c){ const n=(c||0)/100; return
n.toLocaleString(“it-IT”,{style:“currency”,currency:“EUR”}); }

async function load(){ try{ const [d1,d7,d30]=await Promise.all([
fetch(ENDPOINT(“1d”)).then(r=>r.json()),
fetch(ENDPOINT(“7d”)).then(r=>r.json()),
fetch(ENDPOINT(“30d”)).then(r=>r.json()) ]);

    document.getElementById("updatedAt").textContent=new Date().toLocaleString("it-IT");

    document.getElementById("link1d").textContent=d1.total_link_range||0;
    document.getElementById("rem1d").textContent=d1.reminder_sent_total||0;
    document.getElementById("paid1d").textContent=d1.total_paid_range||0;
    document.getElementById("rev1d").textContent=fmtEuro(d1.revenue_range_cents||0);

    document.getElementById("rev7d").textContent=fmtEuro(d7.revenue_range_cents||0);
    document.getElementById("rev30d").textContent=fmtEuro(d30.revenue_range_cents||0);

    const valuation=(d30.revenue_range_cents||0)*10;
    document.getElementById("valuation").textContent=fmtEuro(valuation);

}catch(e){ console.error(e); } }

document.addEventListener(“DOMContentLoaded”,load);
