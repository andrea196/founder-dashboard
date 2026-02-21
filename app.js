document.getElementById(“refreshBtn”).addEventListener(“click”,
loadData);

async function loadData(){ try{ const res = await
fetch(“/api/metrics?range=1d”); const data = await res.json();

    document.getElementById("targetEOD").textContent = "€ " + (data.kpi?.target_eod || 0);
    document.getElementById("actualRevenue").textContent = "€ " + (data.kpi?.revenue_range_cents || 0)/100;
    document.getElementById("updatedAt").textContent = data.generated_at || "-";

    document.getElementById("links1d").textContent = data.tier?.t1?.link_sent_range || 0;
    document.getElementById("reminders1d").textContent = data.tier?.t1?.reminder1_sent_range || 0;
    document.getElementById("paid1d").textContent = data.tier?.t1?.paid_range || 0;
    document.getElementById("rev1d").textContent = "€ " + (data.kpi?.revenue_range_cents || 0)/100;

    document.getElementById("rev7d").textContent = "€ " + (data.kpi?.revenue_range_cents || 0)/100;
    document.getElementById("rev30d").textContent = "€ 0";
    document.getElementById("growthRate").textContent = "-";
    document.getElementById("valuationProxy").textContent = "€ 0";

    document.getElementById("statusPill").textContent = "LIVE";

}catch(e){ document.getElementById(“statusPill”).textContent = “ERROR”;
} } loadData();
