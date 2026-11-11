(function () {
  var JK = "dijla-jobs";
  function $(i) { return document.getElementById(i); }
  function getJobs() { try { return JSON.parse(localStorage.getItem(JK) || "[]") || []; } catch (e) { return []; } }
  function stamp() { var d = new Date(); return d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2); }

  try { var m = sessionStorage.getItem("dijla-imp"); if (m && $("xstat")) { $("xstat").textContent = m; sessionStorage.removeItem("dijla-imp"); var sd = $("sd"); if (sd) sd.open = true; } } catch (e) {}

  if ($("xexp")) $("xexp").onclick = function () {
    var jobs = getJobs();
    if (!jobs.length) { $("xstat").textContent = "لا يوجد زبائن محفوظون لتصديرهم."; return; }
    var name = "dijla-customers-" + stamp() + ".json";
    var blob = new Blob([JSON.stringify({ app: "dijla", v: 1, jobs: jobs })], { type: "application/json" });
    var f = null; try { f = new File([blob], name, { type: "application/json" }); } catch (e) {}
    function fallback() {
      var u = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
      $("xstat").textContent = "تم تنزيل الملف: " + name;
    }
    if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
      navigator.share({ files: [f], title: "زبائن دجلة" }).then(function () { $("xstat").textContent = "تم التصدير."; })
        .catch(function (e) { if (!e || e.name !== "AbortError") fallback(); });
    } else fallback();
  };

  if ($("ximf")) $("ximf").onchange = function () {
    var inp = this, fl = inp.files && inp.files[0]; if (!fl) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var o = JSON.parse(rd.result), list = o && o.jobs; if (!Array.isArray(list)) throw 0;
        var jobs = getJobs(), add = 0, upd = 0;
        list.forEach(function (r) {
          if (!r || !r.id || !r.d || !r.name) return;
          var i = jobs.findIndex(function (j) { return j.id === r.id; });
          if (i < 0) { jobs.push(r); add++; } else if ((r.at || 0) > (jobs[i].at || 0)) { jobs[i] = r; upd++; }
        });
        jobs.sort(function (a, b) { return b.at - a.at; });
        localStorage.setItem(JK, JSON.stringify(jobs));
        var msg = "تم الدمج: " + add + " زبون جديد، " + upd + " محدّث.";
        $("xstat").textContent = msg;
        try { sessionStorage.setItem("dijla-imp", msg); } catch (e) {}
        setTimeout(function () { location.reload(); }, 900);
      } catch (e) { $("xstat").textContent = "الملف غير صالح، اختر ملف زبائن دجلة (.json)."; }
      inp.value = "";
    };
    rd.readAsText(fl);
  };

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
