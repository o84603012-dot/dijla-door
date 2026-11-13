(function () {
  var CK = "dijla-sync-code", JK = "dijla-jobs", KK = "dijla-sync-known", TK = "dijla-sync-tomb", LK = "dijla-sync-last";
  var DB = "https://dijla-sync-default-rtdb.europe-west1.firebasedatabase.app", MAXREC = 12000000;
  function $(i) { return document.getElementById(i); }
  function get(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function norm(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function code() { return localStorage.getItem(CK) || ""; }
  function pretty(c) { return c.replace(/(.{5})(?=.)/g, "$1-"); }
  function gen() {
    var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = new Uint8Array(10), s = "", i;
    crypto.getRandomValues(b);
    for (i = 0; i < 10; i++) s += A[b[i] % 32];
    return s;
  }

  var stEl = null, busy = false, again = false, timer = null, lastSeen = null;
  function status(t) { if (stEl) stEl.textContent = t; }
  function hhmm(ts) { var d = new Date(ts); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }

  function bad(r) { if (!r.ok) throw new Error("http " + r.status); return r; }
  function base() { return DB.replace(/\/+$/, "") + "/dijla/" + code(); }
  async function fb(method, path, body) {
    var o = { method: method };
    if (body !== undefined) o.body = JSON.stringify(body);
    var r = bad(await fetch(base() + path + ".json", o));
    return r.json();
  }
  async function api(action, body, extra) {
    if (action === "list") return { index: (await fb("GET", "/i")) || {} };
    if (action === "get") {
      var gid = decodeURIComponent((extra || "").replace("&id=", ""));
      var v = await fb("GET", "/j/" + gid);
      return { rec: v && v.s ? JSON.parse(v.s) : null };
    }
    if (action === "put") {
      var rec = body.rec;
      await fb("PUT", "/j/" + rec.id, { at: rec.at || Date.now(), name: rec.name || "", s: JSON.stringify(rec) });
      await fb("PUT", "/i/" + rec.id, { at: rec.at || Date.now(), name: rec.name || "" });
      return { ok: true };
    }
    if (action === "del") {
      await fb("DELETE", "/j/" + body.id);
      await fb("PUT", "/i/" + body.id, { at: body.at || Date.now(), del: true });
      return { ok: true };
    }
  }

  async function sync() {
    if (!code()) return;
    if (busy) { again = true; return; }
    if (!navigator.onLine) { status("لا يوجد اتصال: ستتم المزامنة تلقائياً عند عودة الإنترنت."); return; }
    busy = true; status("جارٍ المزامنة…");
    try {
      var jobs = get(JK, []), known = get(KK, []), tomb = get(TK, {});
      var pulled = 0, pushed = 0, big = 0, i;
      var byId = {}; jobs.forEach(function (j) { byId[j.id] = j; });

      known.forEach(function (id) { if (!byId[id] && !tomb[id]) tomb[id] = Date.now(); });
      jobs.forEach(function (j) { if (tomb[j.id] && (j.at || 0) > tomb[j.id]) delete tomb[j.id]; });

      var idx = (await api("list")).index || {};
      var id, r, l;

      for (id in idx) {
        r = idx[id]; l = byId[id];
        if (r.del) {
          if (l && (l.at || 0) <= r.at) { jobs = jobs.filter(function (j) { return j.id !== id; }); delete byId[id]; pulled++; }
          delete tomb[id];
          continue;
        }
        if (tomb[id] && tomb[id] >= r.at) continue;
        if (!l || (l.at || 0) < r.at) {
          var rec = (await api("get", null, "&id=" + encodeURIComponent(id))).rec;
          if (rec && rec.id) {
            if (l) jobs = jobs.filter(function (j) { return j.id !== id; });
            jobs.push(rec); byId[id] = rec; pulled++; delete tomb[id];
          }
        }
      }

      for (i = 0; i < jobs.length; i++) {
        l = jobs[i]; r = idx[l.id];
        if (!r || (l.at || 0) > r.at) {
          var s = JSON.stringify({ rec: l });
          if (s.length > MAXREC) { big++; continue; }
          await api("put", { rec: l });
          pushed++;
        }
      }

      for (id in tomb) {
        r = idx[id];
        if (!r || (!r.del && r.at < tomb[id])) { await api("del", { id: id, at: tomb[id] }); pushed++; }
        if (!r || r.del || r.at < tomb[id]) delete tomb[id];
      }

      jobs.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      set(KK, jobs.map(function (j) { return j.id; }));
      set(TK, tomb);
      if (pulled > 0) set(JK, jobs);
      lastSeen = localStorage.getItem(JK) || "";
      var now = Date.now(); localStorage.setItem(LK, String(now));
      var msg = "تمت المزامنة " + hhmm(now) + " — تنزيل " + pulled + "، رفع " + pushed + (big ? "، " + big + " زبون كبير جداً بسبب الصور لم يُرفع" : "") + ".";
      status(msg);
      if (pulled > 0) { status(msg + " جارٍ تحديث الشاشة…"); setTimeout(function () { location.reload(); }, 1200); }
    } catch (e) {
      status("تعذرت المزامنة الآن، ستعاد المحاولة تلقائياً.");
    }
    busy = false;
    if (again) { again = false; schedule(); }
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(sync, 2500); }

  function btn(txt, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = txt; b.onclick = fn;
    b.style.cssText = "font:inherit;font-weight:800;padding:10px 14px;border:2px solid var(--pen);border-radius:4px;background:var(--card);color:var(--pen);cursor:pointer";
    return b;
  }

  var box = null;
  function ui() {
    var sd = $("sd"); if (!sd) return;
    if (box) box.remove();
    box = document.createElement("div");
    box.style.cssText = "margin-top:14px;border-top:1px solid var(--line);padding-top:10px";
    var h = document.createElement("div"); h.className = "lab"; h.textContent = "المزامنة التلقائية بين الهواتف";
    box.appendChild(h);
    var row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:6px";
    if (!code()) {
      var info = document.createElement("div"); info.style.cssText = "font-size:14px;color:var(--mut)";
      info.textContent = "على الهاتف الأول اضغط «إنشاء كود». وعلى الهاتف الثاني اكتب نفس الكود لتنزيل كل البيانات.";
      box.appendChild(info);
      row.appendChild(btn("إنشاء كود", function () {
        localStorage.setItem(CK, gen()); localStorage.removeItem(KK); localStorage.removeItem(TK); ui(); sync();
      }));
      box.appendChild(row);
      var r2 = document.createElement("div"); r2.style.cssText = "display:flex;gap:8px;margin-top:8px";
      var inp = document.createElement("input"); inp.placeholder = "اكتب الكود هنا"; inp.dir = "ltr"; inp.setAttribute("aria-label", "كود المزامنة");
      inp.style.cssText = "flex:1;text-transform:uppercase";
      r2.appendChild(inp);
      r2.appendChild(btn("ربط", function () {
        var c = norm(inp.value);
        if (c.length !== 10) { if (stEl) stEl.textContent = "الكود يجب أن يكون 10 أحرف وأرقام."; return; }
        localStorage.setItem(CK, c); localStorage.removeItem(KK); localStorage.removeItem(TK); ui(); sync();
      }));
      box.appendChild(r2);
    } else {
      var cd = document.createElement("div");
      cd.style.cssText = "font-size:22px;font-weight:800;direction:ltr;text-align:center;letter-spacing:2px;margin-top:6px;user-select:all";
      cd.textContent = pretty(code());
      box.appendChild(cd);
      row.appendChild(btn("مزامنة الآن", sync));
      row.appendChild(btn("نسخ الكود", function () {
        try { navigator.clipboard.writeText(pretty(code())).then(function () { status("تم نسخ الكود."); }); } catch (e) {}
      }));
      var off = btn("إيقاف المزامنة", function () {
        if (!off.dataset.arm) { off.dataset.arm = "1"; off.textContent = "اضغط للتأكيد"; setTimeout(function () { delete off.dataset.arm; off.textContent = "إيقاف المزامنة"; }, 4000); return; }
        localStorage.removeItem(CK); localStorage.removeItem(KK); localStorage.removeItem(TK); ui(); status("تم إيقاف المزامنة على هذا الهاتف.");
      });
      off.style.borderColor = "var(--danger)"; off.style.color = "var(--danger)";
      row.appendChild(off);
      box.appendChild(row);
    }
    stEl = document.createElement("div"); stEl.style.cssText = "margin-top:8px;font-size:14px";
    var lt = parseInt(localStorage.getItem(LK) || "0", 10);
    if (code() && lt) stEl.textContent = "آخر مزامنة: " + hhmm(lt);
    box.appendChild(stEl);
    sd.appendChild(box);
  }

  ui();
  lastSeen = localStorage.getItem(JK) || "";
  if (code()) sync();
  window.addEventListener("online", function () { if (code()) schedule(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && code()) schedule(); });
  setInterval(function () {
    var s = localStorage.getItem(JK) || "";
    if (s !== lastSeen) { lastSeen = s; if (code()) schedule(); }
  }, 3000);
})();
