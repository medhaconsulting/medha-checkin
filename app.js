// ===== CONFIG — edit these to change the company / location =====
const CONFIG = {
  companyName: "Medha Consulting (Cambodia) Co., Ltd.",
  locationName: "Medha office",
  officeLat: 11.5262264,
  officeLng: 104.8682496,
  radiusMeters: 500,
  timeZone: "Asia/Phnom_Penh",
};
// ================================================================

const STORE_KEY = "medha_checkin_records";
const PROFILE_KEY = "medha_checkin_profile";

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function isWithinRadius(lat, lng) {
  return haversineMeters(lat, lng, CONFIG.officeLat, CONFIG.officeLng) <= CONFIG.radiusMeters;
}
function fmtTime(d) {
  const p = {}; new Intl.DateTimeFormat("en-CA",{timeZone:CONFIG.timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})
    .formatToParts(d).forEach(x => p[x.type] = x.value);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}` };
}

if (typeof module !== "undefined") module.exports = { haversineMeters, isWithinRadius, CONFIG };

if (typeof document !== "undefined") {
  const $ = id => document.getElementById(id);
  const load = () => JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  const save = r => localStorage.setItem(STORE_KEY, JSON.stringify(r));
  const fmtDist = m => m >= 1000 ? (m / 1000).toFixed(1) + " km" : m + " m";
  const setStatus = (msg, cls = "") => { const s = $("status"); s.textContent = msg; s.className = "alert " + cls; s.hidden = !msg; };
  const icon = id => `<svg class="i"><use href="#${id}"/></svg>`;
  const tz = { timeZone: CONFIG.timeZone };

  // Theme: Telegram dark scheme (or system dark when outside Telegram)
  const tgw = window.Telegram?.WebApp;
  const dark = tgw?.initData ? tgw.colorScheme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", dark);

  // ---- Header: date, live clock, greeting ----
  function tick() {
    const now = new Date();
    $("sDate").textContent = now.toLocaleDateString("en-GB", { ...tz, weekday: "long", day: "numeric", month: "long" });
    $("sClock").textContent = fmtTime(now).time.slice(0, 5);
  }
  tick(); setInterval(tick, 15000);
  function greet() {
    const h = Number(fmtTime(new Date()).time.slice(0, 2));
    const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    const name = $("name").value.trim();
    $("sHello").textContent = name ? `${part}, ${name.split(/\s+/)[0]}` : part;
    $("avatar").textContent = name ? name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?";
  }
  const refreshRadiusLabels = () => {
    $("limLabel").textContent = fmtDist(CONFIG.radiusMeters) + " limit";
    $("maxLabel").textContent = fmtDist(CONFIG.radiusMeters * 2) + "+";
  };
  $("locName").textContent = CONFIG.locationName; refreshRadiusLabels();

  // ---- Profile (browser mode) ----
  const prof = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  $("name").value = prof.name || ""; $("empId").value = prof.empId || "";
  const saveProfile = () => { localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: $("name").value.trim(), empId: $("empId").value.trim() })); greet(); };
  $("name").addEventListener("input", greet);
  $("name").addEventListener("change", saveProfile); $("empId").addEventListener("change", saveProfile);
  greet();
  if (prof.name) { $("profileCard").hidden = true; $("changeName").hidden = false; }
  $("changeName").onclick = () => { $("profileCard").hidden = false; $("changeName").hidden = true; $("name").focus(); };

  // ---- Today's state from this phone ----
  const todays = () => { const d = fmtTime(new Date()).date; return load().filter(r => r.date === d); };
  let savingNow = false, lastDist = null, lastAcc = null, busy = false, geoError = null, locked = false;

  function nextType() { const t = todays(); return t.length && t[t.length - 1].type === "IN" ? "OUT" : "IN"; }

  function renderActions() {
    const t = todays(), ins = t.filter(r => r.type === "IN"), outs = t.filter(r => r.type === "OUT");
    $("tIn").textContent = ins.length ? ins[0].time.slice(0, 5) : "--:--";
    $("tOut").textContent = outs.length ? outs[outs.length - 1].time.slice(0, 5) : "--:--";
    const type = nextType(), b = $("btnMain"), other = type === "IN" ? "OUT" : "IN";
    const far = lastDist != null && lastDist > CONFIG.radiusMeters;
    b.className = "big " + type;
    $("btnOther").textContent = other === "IN" ? "Check in again" : "Check out";
    $("btnOther").hidden = locked || lastDist == null || far || (other === "OUT" && !ins.length);
    if (locked) { b.disabled = true; b.innerHTML = icon("i-lock") + "<span>Not available yet</span>"; $("hint").textContent = ""; return; }
    if (busy) { b.disabled = true; b.innerHTML = `<span class="spin"></span><span>${savingNow ? "Saving…" : "Checking location…"}</span>`; return; }
    if (lastDist == null) { b.disabled = true; b.innerHTML = icon("i-lock") + `<span>${type === "IN" ? "Check in" : "Check out"}</span>`; $("hint").textContent = "The button turns on when we find you."; return; }
    if (far) { b.disabled = true; b.innerHTML = icon("i-lock") + `<span>Too far to check ${type === "IN" ? "in" : "out"}</span>`; $("hint").innerHTML = '<button class="btn ghost sm" id="btnAgain">Check my location again</button>'; $("btnAgain").onclick = refreshLocation; return; }
    b.disabled = false; b.innerHTML = icon(type === "IN" ? "i-in" : "i-out") + `<span>${type === "IN" ? "Check in" : "Check out"}</span>`;
    $("hint").textContent = type === "IN" ? "You can check out after you check in." : `You checked in at ${ins.length ? ins[0].time.slice(0, 5) : "--:--"}.`;
  }

  function renderDistance() {
    if (lastDist == null) { $("dLoading").hidden = false; $("dReady").hidden = true; $("farBox").hidden = true; return; }
    $("dLoading").hidden = true; $("dReady").hidden = false;
    const far = lastDist > CONFIG.radiusMeters;
    $("dVal").textContent = fmtDist(lastDist);
    $("dBadge").className = "badge " + (far ? "err" : "ok");
    $("dBadge").innerHTML = (far ? icon("i-x") + "Too far" : icon("i-check") + "Inside area").replace(/class="i"/, 'class="i" style="width:14px;height:14px"');
    const pct = Math.min(100, lastDist / (CONFIG.radiusMeters * 2) * 100);
    $("mFill").style.width = pct + "%"; $("mDot").style.left = pct + "%"; $("meter").className = "meter" + (far ? " far" : "");
    $("dAcc").textContent = `GPS accuracy ±${lastAcc} m · Updated just now`;
    $("farBox").hidden = !far;
    $("farText").textContent = ` You must be within ${fmtDist(CONFIG.radiusMeters)} to check in. You are ${fmtDist(lastDist - CONFIG.radiusMeters)} too far.`;
  }
  const renderAll = () => { renderDistance(); renderActions(); renderHistory(); };

  function onPos(pos) {
    geoError = null;
    lastDist = Math.round(haversineMeters(pos.coords.latitude, pos.coords.longitude, CONFIG.officeLat, CONFIG.officeLng));
    lastAcc = Math.round(pos.coords.accuracy);
    $("noLoc").hidden = true; renderAll();
  }
  function onErr(err) {
    geoError = err;
    if (err && err.code === 1) { $("noLocErr").textContent = err.message || ""; $("noLoc").hidden = false; }
    renderActions();
  }
  function refreshLocation() {
    if (!navigator.geolocation) return onErr({ code: 1, message: "This browser does not support location." });
    lastDist = null; renderAll();
    navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }
  if (tgw?.initData) $("allowStep").textContent = "Allow Telegram to use your location.";
  if (navigator.geolocation) navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  else onErr({ code: 1, message: "This browser does not support location." });
  $("btnRefresh").onclick = refreshLocation;
  $("btnRetry").onclick = () => { $("noLoc").hidden = true; refreshLocation(); };

  function showSuccess(type, t, dist) {
    $("okRing").className = "okring " + type;
    $("sTitle").textContent = type === "IN" ? "You are checked in" : "You are checked out";
    const first = $("name").value.trim().split(/\s+/)[0];
    $("sBye").textContent = (type === "IN" ? "Have a good day" : "See you next time") + (first ? `, ${first}.` : ".");
    $("sTime").textContent = t.time.slice(0, 5) + " · " + new Date().toLocaleDateString("en-GB", { ...tz, weekday: "short", day: "numeric", month: "short" });
    $("sPlace").textContent = `${fmtDist(dist)} from office`;
    $("sTg").hidden = !document.body.classList.contains("in-telegram");
    $("success").hidden = false;
  }
  $("sClose").onclick = () => { $("success").hidden = true; };

  function renderHistory() {
    const list = todays().reverse();
    $("history").innerHTML = list.length ? "" : '<li class="empty">No records today yet.</li>';
    list.forEach(r => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="badge ${r.type}">${r.type === "IN" ? "Check in" : "Check out"}</span><span class="h-main"><span class="h-name"></span><span class="h-sub"></span></span><b>${r.time.slice(0,5)}</b>`;
      li.querySelector(".h-name").textContent = r.name + (r.empId ? " · " + r.empId : "");
      li.querySelector(".h-sub").textContent = `${r.distance} m from office` + (r.synced === false ? " · not sent" : " · sent");
      if (r.synced === false) li.classList.add("unsent");
      $("history").appendChild(li);
    });
  }

  function record(type) {
    const name = $("name").value.trim();
    if (!name) { setStatus("Please type your name first.", "err"); $("name").focus(); return; }
    saveProfile();
    if (!navigator.geolocation) { setStatus("This browser does not support location.", "err"); return; }
    setStatus(""); $("success").hidden = true; busy = true; renderActions();
    navigator.geolocation.getCurrentPosition(pos => {
      busy = false;
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const dist = Math.round(haversineMeters(lat, lng, CONFIG.officeLat, CONFIG.officeLng));
      lastDist = dist; lastAcc = Math.round(accuracy); renderAll();
      if (dist > CONFIG.radiusMeters) {
        setStatus(`Not recorded. You are ${fmtDist(dist)} from the office. You must be within ${fmtDist(CONFIG.radiusMeters)}.`, "err"); return;
      }
      const t = fmtTime(new Date());
      const recs = load();
      recs.push({ name, empId: $("empId").value.trim(), type, date: t.date, time: t.time, timeZone: CONFIG.timeZone,
        lat: lat.toFixed(6), lng: lng.toFixed(6), distance: dist, accuracy: Math.round(accuracy) });
      const rec = recs[recs.length - 1];
      rec.synced = false; save(recs); busy = true; savingNow = true; renderAll();
      const row = { employee_name: name, employee_id: rec.empId || null, type, lat, lng,
        distance_m: dist, accuracy_m: Math.round(accuracy), device_time: `${t.date} ${t.time} ${CONFIG.timeZone}` };
      (window.saveCheckin ? window.saveCheckin(row) : Promise.reject(new Error("online service not loaded")))
        .then(() => { rec.synced = true; save(recs); busy = false; savingNow = false; renderAll(); showSuccess(type, t, dist); })
        .catch(e => { busy = false; savingNow = false; renderAll(); setStatus(`Saved on this phone at ${t.time.slice(0,5)}, but NOT sent to the company log (${e.message || e}). Please try again or tell your manager.`, "err"); });
    }, err => {
      busy = false; renderActions();
      if (err.code === 1) onErr(err); else setStatus("Could not get your location: " + err.message + ". Please try again.", "err");
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }

  function downloadCsv() {
    const recs = load();
    const cols = ["name","empId","type","date","time","timeZone","lat","lng","distance","accuracy"];
    const esc = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
    const csv = [cols.join(","), ...recs.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = `checkins-${fmtTime(new Date()).date}.csv`; a.click();
  }

  $("btnMain").onclick = () => record(nextType());
  $("btnOther").onclick = () => record(nextType() === "IN" ? "OUT" : "IN");
  $("btnCsv").onclick = downloadCsv;

  // Hooks for tg.js (Telegram Mini App mode)
  window.MC = {
    lock(on) { locked = on; renderActions(); },
    setRadius(m) { CONFIG.radiusMeters = m; refreshRadiusLabels(); renderAll(); },
    setUser(name, empId) { $("name").value = name; $("name").readOnly = true; $("empId").value = empId || ""; $("empId").readOnly = true; $("profileCard").hidden = true; $("changeName").hidden = true; greet(); },
    showWaiting(name, status) {
      $("wName").textContent = name || "";
      if (status === "rejected") { $("wTitle").textContent = "Not approved"; $("wText").textContent = "Your Telegram account was not approved. Please contact your admin."; }
      $("waitScreen").hidden = false;
    },
    banner(msg, cls) { const b = $("tgBanner"); b.textContent = msg; b.className = "alert " + cls; b.hidden = !msg; },
  };
  renderAll();
}
