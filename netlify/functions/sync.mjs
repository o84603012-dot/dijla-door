import { getStore } from "@netlify/blobs";

const H = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const okId = (id) => /^[A-Za-z0-9_-]{3,60}$/.test(id || "");

export default async (req) => {
  try {
    const url = new URL(req.url);
    const code = (url.searchParams.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const action = url.searchParams.get("action") || "";
    if (code.length < 10) return out({ error: "bad code" }, 400);

    const store = getStore("dijla-sync");
    const ik = code + "/index";
    const readIdx = async () => (await store.get(ik, { type: "json" })) || {};

    if (action === "list") return out({ index: await readIdx() });

    if (action === "get") {
      const id = url.searchParams.get("id");
      if (!okId(id)) return out({ error: "bad id" }, 400);
      const rec = await store.get(code + "/j_" + id, { type: "json" });
      return out({ rec: rec || null });
    }

    if (req.method !== "POST") return out({ error: "post required" }, 405);
    const body = await req.json();

    if (action === "put") {
      const rec = body && body.rec;
      if (!rec || !okId(rec.id)) return out({ error: "bad rec" }, 400);
      await store.setJSON(code + "/j_" + rec.id, rec);
      const idx = await readIdx();
      idx[rec.id] = { at: rec.at || Date.now(), name: rec.name || "" };
      await store.setJSON(ik, idx);
      return out({ ok: true });
    }

    if (action === "del") {
      const id = body && body.id;
      if (!okId(id)) return out({ error: "bad id" }, 400);
      await store.delete(code + "/j_" + id);
      const idx = await readIdx();
      idx[id] = { at: body.at || Date.now(), del: true };
      await store.setJSON(ik, idx);
      return out({ ok: true });
    }

    return out({ error: "unknown action" }, 400);
  } catch (e) {
    return out({ error: String((e && e.message) || e) }, 500);
  }
};

export const config = { path: "/api/sync" };
