export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "7d";

  const base = (env.WORKER_BASE_URL || "").replace(/\/$/, "");
  if (!base) {
    return new Response(JSON.stringify({ error: "Missing WORKER_BASE_URL" }), {
      status: 500,
      headers: cors({ "Content-Type": "application/json" }),
    });
  }

  const upstream = `${base}/metrics?range=${encodeURIComponent(range)}`;

  const res = await fetch(upstream, {
    headers: {
      "X-DASH-TOKEN": env.DASH_TOKEN || "",
    },
  });

  const txt = await res.text();
  return new Response(txt, {
    status: res.status,
    headers: cors({ "Content-Type": "application/json" }),
  });
}

function cors(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-DASH-TOKEN",
    ...extra,
  };
}
