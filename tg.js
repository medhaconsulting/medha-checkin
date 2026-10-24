// Telegram Mini App mode. Does nothing when opened in a normal browser.
const tg = window.Telegram?.WebApp;
if (tg && tg.initData) {
  tg.ready(); tg.expand();
  document.body.classList.add("in-telegram");
  const c = window.SUPABASE_CONFIG, MC = window.MC;
  const call = async payload => {
    const r = await fetch(c.tgFunctionUrl, { method: "POST", headers: { "Content-Type": "application/json", apikey: c.publishableKey },
      body: JSON.stringify({ initData: tg.initData, ...payload }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
    return j;
  };
  const check = () => call({ action: "me" }).then(me => {
    if (me.status !== "approved") { MC.lock(true); MC.showWaiting(me.name, me.status); return; }
    document.getElementById("waitScreen").hidden = true;
    MC.setUser(me.name, me.employee_id); MC.lock(false);
    MC.banner(me.radius && me.radius !== 500 ? `TEST radius ${me.radius} m` : "", "warn");
    if (me.radius) MC.setRadius(me.radius);
    window.saveCheckin = row => call({ action: "checkin", type: row.type, lat: row.lat, lng: row.lng, accuracy: row.accuracy_m, device_time: row.device_time });
  }).catch(e => { MC.lock(true); MC.banner("Could not verify your Telegram account: " + e.message, "err"); });
  MC.lock(true);
  document.getElementById("btnCheckAgain").onclick = check;
  check();
}
