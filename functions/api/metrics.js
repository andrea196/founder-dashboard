
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "7d";

  const base = (env.WORKER_BASE_URL || "").replace(/\/$/,"");
  const upstream = `${base}/metrics?range=${range}`;

  const res = await fetch(upstream,{
    headers:{ "X-DASH-TOKEN": env.DASH_TOKEN || "" }
  });

  return new Response(await res.text(),{
    status:res.status,
    headers:{ "Content-Type":"application/json" }
  });
}
