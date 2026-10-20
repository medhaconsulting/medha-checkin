// ===== CONFIG — edit these to change the company / location =====
const CONFIG = {
  companyName: "Medha Consulting (Cambodia) Co., Ltd.",
  locationName: "Test location",
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
  const setStatus = (msg, cls="") => { const s = $("status"); s.textContent = msg; s.className = "status " + cls; };

  $("locName").textContent = "📍 " + CONFIG.locationName + ` (within ${CONFIG.radiusMeters} m)`;
  const prof = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  $("name").value = prof.name || ""; $("empId").value = prof.empId || "";
  const saveProfile = () => localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: $("name").value.trim(), empId: $("empId").value.trim() }));
  $("name").addEventListener("change", saveProfile); $("empId").addEventListener("change", saveProfile);

  function render() {
    const today = fmtTime(new Date()).date;
    const list = load().filter(r => r.date === today).reverse();
    $("history").innerHTML = list.length ? "" : "<li>No records today.</li>";
    list.forEach(r => {
      const li = document.createElement("li");
      li.innerHTML = `<b class="${r.type}">${r.type}</b> ${r.time} — `;
      li.append(`${r.name}${r.empId ? " (" + r.empId + ")" : ""} · ${r.distance} m${r.synced === false ? " · ⚠️ not sent" : ""}`);
      $("history").appendChild(li);
    });
  }

  function record(type) {
    const name = $("name").value.trim();
    if (!name) { setStatus("Please enter your name first.", "err"); $("name").focus(); return; }
    saveProfile();
    if (!navigator.geolocation) { setStatus("This browser does not support location.", "err"); return; }
    setStatus("Getting your location…");
    $("btnIn").disabled = $("btnOut").disabled = true;
    navigator.geolocation.getCurrentPosition(pos => {
      $("btnIn").disabled = $("btnOut").disabled = false;
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const dist = Math.round(haversineMeters(lat, lng, CONFIG.officeLat, CONFIG.officeLng));
      const acc = `GPS accuracy ±${Math.round(accuracy)} m.`;
      if (dist > CONFIG.radiusMeters) {
        setStatus(`❌ Not recorded. You are ${dist} m from the office (must be within ${CONFIG.radiusMeters} m). ${acc}`, "err"); return;
      }
      const t = fmtTime(new Date());
      const recs = load();
      recs.push({ name, empId: $("empId").value.trim(), type, date: t.date, time: t.time, timeZone: CONFIG.timeZone,
        lat: lat.toFixed(6), lng: lng.toFixed(6), distance: dist, accuracy: Math.round(accuracy) });
      const rec = recs[recs.length - 1];
      const okMsg = `${type === "IN" ? "Checked in" : "Checked out"} at ${t.time} (Phnom Penh time), ${dist} m from office. ${acc}`;
      rec.synced = false; save(recs); render();
      setStatus("Saving to company log…");
      const row = { employee_name: name, employee_id: rec.empId || null, type, lat, lng,
        distance_m: dist, accuracy_m: Math.round(accuracy), device_time: `${t.date} ${t.time} ${CONFIG.timeZone}` };
      (window.saveCheckin ? window.saveCheckin(row) : Promise.reject(new Error("online service not loaded")))
        .then(() => { rec.synced = true; save(recs); render(); setStatus("✅ " + okMsg, "ok"); })
        .catch(e => setStatus(`⚠️ ${okMsg} BUT it was NOT sent to the company log (${e.message || e}). A copy is kept on this phone — please tell your manager or try again.`, "err"));
    }, err => {
      $("btnIn").disabled = $("btnOut").disabled = false;
      setStatus("Could not get location: " + err.message + ". Please allow location access and try again.", "err");
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

  $("btnIn").onclick = () => record("IN");
  $("btnOut").onclick = () => record("OUT");
  $("btnCsv").onclick = downloadCsv;
  render();
}
