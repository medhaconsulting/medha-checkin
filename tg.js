// Telegram Mini App mode. Does nothing when opened in a normal browser.
const tg = window.Telegram?.WebApp;
const $ = id => document.getElementById(id);
if (tg && tg.initData) {
  tg.ready(); tg.expand();
  document.body.classList.add("in-telegram");
  const c = window.SUPABASE_CONFIG;
  const call = async payload => {
    const r = await fetch(c.tgFunctionUrl, { method: "POST", headers: { "Content-Type": "application/json", apikey: c.publishableKey },
      body: JSON.stringify({ initData: tg.initData, ...payload }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
    return j;
  };
  const lock = on => { $("btnIn").hidden = $("btnOut").hidden = !on; };
  const banner = (msg, cls) => { const b = $("tgBanner"); b.textContent = msg; b.className = "status " + cls; b.hidden = false; };
  call({ action: "me" }).then(me => {
    if (me.status !== "approved") {
      lock(false);
      banner(me.status === "rejected" ? "Your Telegram account was not approved. Please contact your admin."
        : "👋 Thanks! Your Telegram account is waiting for admin approval. You can check in once approved.", "err");
      return;
    }
    $("name").value = me.name; $("name").readOnly = true;
    $("empId").value = me.employee_id || ""; $("empId").readOnly = true;
    banner("Signed in with Telegram as " + me.name, "ok");
    window.saveCheckin = row => call({ action: "checkin", type: row.type, lat: row.lat, lng: row.lng, accuracy: row.accuracy_m, device_time: row.device_time });
  }).catch(e => { lock(false); banner("Could not verify your Telegram account: " + e.message, "err"); });
}
