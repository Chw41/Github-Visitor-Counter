export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith("/admin/")) {
        if (req.method !== "POST" && req.method !== "GET")
          return new Response("Method Not Allowed", { status: 405 });

        const auth = req.headers.get("Authorization") || "";
        if (auth !== `Bearer ${env.ADMIN_TOKEN}`)
          return new Response("Unauthorized", { status: 401 });

        const id = url.searchParams.get("id") || "{User ID}"; // UserID
        const key = `count:${id}`;

        let valueStr = url.searchParams.get("value");
        if (!valueStr && req.method === "POST") {
          const ct = (req.headers.get("content-type") || "").toLowerCase();
          const body = await req.text();
          if (ct.includes("application/x-www-form-urlencoded")) {
            valueStr = new URLSearchParams(body).get("value");
          } else if (ct.includes("application/json")) {
            try { valueStr = JSON.parse(body).value; } catch {}
          } else {
            valueStr = body.trim();
          }
        }
 
        if (url.pathname.endsWith("/set")) {
          const v = parseInt(valueStr ?? "NaN", 10);
          if (!Number.isFinite(v) || v < 0) return new Response("Bad value", { status: 400 });
          await env.COUNTER.put(key, String(v), { expirationTtl: 60 * 60 * 24 * 365 * 10 });
          return new Response(`OK set to ${v}\n`, { headers: { "content-type": "text/plain" }});
        }

        if (url.pathname.endsWith("/add")) {
          const delta = parseInt(valueStr ?? "NaN", 10);
          if (!Number.isFinite(delta) || delta < 0) return new Response("Bad value", { status: 400 });
          const cur = parseInt((await env.COUNTER.get(key)) || "0", 10);
          const v = cur + delta;
          await env.COUNTER.put(key, String(v), { expirationTtl: 60 * 60 * 24 * 365 * 10 });
          return new Response(`OK now ${v}\n`, { headers: { "content-type": "text/plain" }});
        }

        return new Response("Not Found", { status: 404 });
      }

      const id      = url.searchParams.get("id") || "Chw41";
      const min     = parseInt(url.searchParams.get("min") || "6", 10);
      const color   = "#" + (url.searchParams.get("color") || "39ff14");
      const bg      = "#" + (url.searchParams.get("bg") || "000000");
      const size    = parseInt(url.searchParams.get("size") || "42", 10);
      const gap     = parseInt(url.searchParams.get("gap") || "6", 10);
      const radius  = parseInt(url.searchParams.get("radius") || "6", 10);
      const preview = url.searchParams.has("preview");

      const key = `count:${id}`;
      let n = parseInt((await env.COUNTER.get(key)) || "0", 10);
      if (!preview) {
        n += 1;
        await env.COUNTER.put(key, String(n), { expirationTtl: 60 * 60 * 24 * 365 * 10 });
      }

      const digits = Math.max(min, String(n).length);
      const text = String(n).padStart(digits, "0");
      const width = digits * size + (digits - 1) * gap, height = size;

      let rects = "", texts = "";
      for (let i = 0; i < digits; i++) {
        const x = i * (size + gap), cx = x + size/2, cy = height/2 + 1;
        rects += `<rect x="${x}" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${bg}"/>`;
        texts += `<text x="${cx}" y="${cy}" font-size="${Math.floor(size*0.68)}" text-anchor="middle" dominant-baseline="central" fill="${color}" font-family="Menlo,Consolas,Monaco,'Courier New',monospace">${text[i]}</text>`;
      }

      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<title>Visitor Count</title>${rects}${texts}</svg>`,
        { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store" } }
      );
    } catch (e) {
      return new Response("ERR: " + (e && e.message ? e.message : String(e)), { status: 500 });
    }
  }
};
