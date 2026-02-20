export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const range = url.searchParams.get("range") || "7d";
  const allowed = new Set(["1d", "7d", "30d"]);
  if (!allowed.has(range)) {
    return new Response(JSON.stringify({ error: "Invalid range" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const upstream = `${env.WORKER_BASE_URL.replace(/\/$/, "")}/metrics?range=${range}`;
  const res = await fetch(upstream, {
    headers: { "X-DASH-TOKEN": env.DASH_TOKEN }
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
