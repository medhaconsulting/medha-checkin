import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const c = window.SUPABASE_CONFIG;
const sb = createClient(c.url, c.publishableKey);
const $ = id => document.getElementById(id);
const $$ = s => [...document.querySelectorAll(s)];
const TZ = "Asia/Phnom_Penh";
const START = "08:00"; // official work start (Phnom Penh): on time = check-in at or before this
const adminUrl = location.origin + location.pathname;
const setStatus = (m, cls = "") => { const s = $("status"); s.textContent = m; s.className = "alert " + cls; s.hidden = !m; };
const setAuth = (m, cls = "") => { const s = $("authStatus"); s.textContent = m; s.className = "alert " + cls; s.hidden = !m; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
let rows = [], staff = [], typeFilter = "", current = null, recovering = false;

function pp(iso) {
  const p = {}; new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    .formatToParts(new Date(iso)).forEach(x => p[x.type] = x.value);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}` };
}
const today = () => pp(new Date()).date;
const personKey = r => (r.employee_id || r.employee_name || "").trim().toLowerCase();

// ---------- Navigation ----------
function go(view) {
  $$("[data-sec]").forEach(s => s.hidden = s.dataset.sec !== view);
  $$(".nav[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === view));
}
$$(".nav[data-view]").forEach(b => b.onclick = () => go(b.dataset.view));
$$("[data-goto]").forEach(b => b.onclick = () => go(b.dataset.goto));
$$(".startT").forEach(s => s.textContent = START);

// ---------- Today ----------
function renderToday() {
  $("todayLabel").textContent = new Date().toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " · Start time " + START;
  const d = today(), first = new Map();
  rows.filter(r => r.type === "IN" && pp(r.created_at).date === d).forEach(r => {
    const k = personKey(r), t = pp(r.created_at).time;
    if (!first.has(k) || t < first.get(k).t) first.set(k, { t, r });
  });
  const all = [...first.values()].sort((a, b) => a.t.localeCompare(b.t));
  const onTime = all.filter(x => x.t.slice(0, 5) <= START), late = all.filter(x => x.t.slice(0, 5) > START);
  const approved = staff.filter(s => s.status === "approved");
  const inTg = new Set(rows.filter(r => r.type === "IN" && r.telegram_user_id && pp(r.created_at).date === d).map(r => String(r.telegram_user_id)));
  const miss = approved.filter(s => !inTg.has(String(s.telegram_user_id)));
  const mins = t => { const [h, m] = t.split(":").map(Number), [sh, sm] = START.split(":").map(Number); return h * 60 + m - sh * 60 - sm; };
  $("kIn").textContent = onTime.length;
  $("kLate").textContent = late.length; $("kMiss").textContent = miss.length;
  const li = (a, b, cls = "") => `<li><span>${esc(a)}</span><span class="${cls}">${esc(b)}</span></li>`;
  $("lIn").innerHTML = onTime.map(x => li(x.r.employee_name, x.t.slice(0, 5))).join("") || '<li class="none">Nobody yet</li>';
  $("lLate").innerHTML = late.map(x => li(x.r.employee_name, `${x.t.slice(0, 5)} · ${mins(x.t)} min`, "w")).join("") || '<li class="none">Nobody</li>';
  $("lMiss").innerHTML = miss.map(s => `<li><span>${esc(s.display_name)}</span>${s.tg_username ? `<a href="https://t.me/${encodeURIComponent(s.tg_username)}" target="_blank" rel="noopener">Open chat</a>` : ""}</li>`).join("") || '<li class="none">Everyone is in</li>';
  const pend = staff.filter(s => s.status === "pending").length;
  $("pendingNote").hidden = !pend; $("pendingText").textContent = `${pend} ${pend === 1 ? "person is" : "people are"} waiting for approval. `;
  $$("[data-pending]").forEach(b => { b.textContent = pend; b.hidden = !pend; });
}

// ---------- Log ----------
const shown = () => {
  const d = $("date").value, p = $("person").value;
  return rows.filter(r => (!d || pp(r.created_at).date === d) && (!p || personKey(r) === p) && (!typeFilter || r.type === typeFilter));
};
function renderLog() {
  const keep = $("person").value, people = new Map();
  rows.forEach(r => people.set(personKey(r), r.employee_name));
  $("person").innerHTML = '<option value="">All staff</option>' + [...people].sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join("");
  $("person").value = keep;
  const list = shown(), tb = $("rows");
  tb.innerHTML = list.length ? "" : `<tr><td colspan="9" class="muted">No records for these filters.</td></tr>`;
  list.forEach(r => {
    const t = pp(r.created_at), tr = document.createElement("tr");
    tr.innerHTML = `<td>${t.date}</td><td>${t.time.slice(0, 5)}</td><td>${esc(r.employee_name)}</td><td>${esc(r.employee_id || "")}</td>
      <td><span class="badge ${r.type}">${r.type === "IN" ? "Check in" : "Check out"}</span></td>
      <td class="num">${Math.round(r.distance_m ?? 0)} m</td><td class="num">±${Math.round(r.accuracy_m ?? 0)} m</td>
      <td>${r.source === "telegram" ? "Telegram" : "Browser"}</td>
      <td>${r.lat != null ? `<a href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank" rel="noopener">map</a>` : ""}</td>`;
    tb.appendChild(tr);
  });
  $("count").textContent = `${list.length} record(s)${$("date").value ? " on " + $("date").value : " (all dates)"} · newest first`;
}
const renderAll = () => { renderToday(); renderLog(); renderStaff(); };

async function loadData() {
  setStatus(""); $("logErr").hidden = true;
  const { data, error } = await sb.from("checkins").select("*").order("created_at", { ascending: false }).limit(5000);
  if (error) { $("logErr").hidden = false; $("logErrText").textContent = "Check your internet connection, then try again. (" + error.message + ")"; return; }
  rows = data;
  await loadTg();
  renderAll();
  if (!rows.length) setStatus("No check-ins visible. (Only the admin account can see records.)", "info");
}

function csv(list, name) {
  const cols = ["date", "time", "employee_name", "employee_id", "type", "lat", "lng", "distance_m", "accuracy_m", "device_time", "source", "created_at_utc"];
  const e = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = list.map(r => { const t = pp(r.created_at); return cols.map(k => e(k === "date" ? t.date : k === "time" ? t.time : k === "created_at_utc" ? r.created_at : r[k])).join(","); });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + [cols.join(","), ...lines].join("\n")], { type: "text/csv" }));
  a.download = `checkins-${name}.csv`; a.click();
}

// ---------- Telegram staff ----------
async function loadTg() {
  const [{ data, error }, { data: set }] = await Promise.all([
    sb.from("tg_staff").select("*").order("created_at", { ascending: false }),
    sb.from("tg_settings").select("reminders_enabled").eq("id", 1).maybeSingle()]);
  if (error) { staff = []; $("tgRows").innerHTML = `<tr><td colspan="5">Telegram not set up yet (${esc(error.message)})</td></tr>`; return; }
  staff = data;
  $("remToggle").checked = !!set?.reminders_enabled; remText();
}
async function updateStaff(s, upd) {
  if (upd.status === "approved" && s.status !== "approved") { upd.approved_at = new Date().toISOString(); upd.approved_by = (await sb.auth.getUser()).data.user?.email; }
  const { error } = await sb.from("tg_staff").update(upd).eq("telegram_user_id", s.telegram_user_id);
  setStatus(error ? "Update failed: " + error.message : "Saved.", error ? "err" : "ok");
  await loadTg(); renderAll();
}
function renderStaff() {
  const pend = staff.filter(s => s.status === "pending"), rest = staff.filter(s => s.status !== "pending");
  $("staffSummary").textContent = `${staff.filter(s => s.status === "approved").length} approved · ${pend.length} waiting`;
  const wl = $("waitList"); wl.innerHTML = pend.length ? "" : '<p class="small muted">Nobody is waiting.</p>';
  pend.forEach(s => {
    const d = document.createElement("div"); d.className = "card wcard";
    const ini = (s.display_name || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
    d.innerHTML = `<div class="top"><div class="avatar">${esc(ini)}</div><div><b></b><p class="small muted"></p></div></div>
      <label class="f" style="margin:0">Name in log <input class="n"></label><label class="f" style="margin:0">Employee ID <input class="e" placeholder="e.g. MC-001"></label>
      <div class="row"><button class="btn ghost sm r">Reject</button><button class="btn sage sm a">Approve</button></div>`;
    d.querySelector("b").textContent = s.display_name;
    d.querySelector("p").textContent = (s.tg_username ? "@" + s.tg_username : "ID " + s.telegram_user_id) + " · asked " + pp(s.created_at).date + " " + pp(s.created_at).time.slice(0, 5);
    d.querySelector(".n").value = s.display_name; d.querySelector(".e").value = s.employee_id || "";
    const vals = () => ({ display_name: d.querySelector(".n").value.trim() || s.display_name, employee_id: d.querySelector(".e").value.trim() || null });
    d.querySelector(".a").onclick = () => updateStaff(s, { ...vals(), status: "approved" });
    d.querySelector(".r").onclick = () => updateStaff(s, { ...vals(), status: "rejected" });
    wl.appendChild(d);
  });
  const tb = $("tgRows"); tb.innerHTML = rest.length ? "" : '<tr><td colspan="5" class="muted">No approved staff yet.</td></tr>';
  rest.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input class="n"></td><td><input class="e"></td><td></td><td><span class="badge ${s.status === "approved" ? "ok" : "err"}">${s.status === "approved" ? "Approved" : "Rejected"}</span></td><td></td>`;
    tr.cells[2].textContent = s.tg_username ? "@" + s.tg_username : String(s.telegram_user_id);
    tr.querySelector(".n").value = s.display_name; tr.querySelector(".e").value = s.employee_id || "";
    const vals = () => ({ display_name: tr.querySelector(".n").value.trim() || s.display_name, employee_id: tr.querySelector(".e").value.trim() || null });
    const mk = (label, cls, upd) => { const b = document.createElement("button"); b.className = "btn sm " + cls; b.textContent = label; b.style.marginLeft = "6px"; b.onclick = () => updateStaff(s, { ...vals(), ...upd }); tr.cells[4].appendChild(b); };
    if (s.status === "approved") { mk("Save", "ghost", {}); mk("Reject", "ghost", { status: "rejected" }); } else mk("Approve", "sage", { status: "approved" });
    tb.appendChild(tr);
  });
}
function remText() { $("remState").textContent = $("remToggle").checked ? "On · sends Monday to Saturday at 08:30 (Phnom Penh)." : "Off · no reminders are sent."; }
$("remToggle").onchange = async e => {
  const { error } = await sb.from("tg_settings").update({ reminders_enabled: e.target.checked }).eq("id", 1);
  if (error) { e.target.checked = !e.target.checked; setStatus("Could not change reminder: " + error.message, "err"); } else setStatus("Reminder " + (e.target.checked ? "ON" : "OFF") + ".", "ok");
  remText();
};

// ---------- Auth: email + password, forgot, set new ----------
function authView(v) { $("authBox").hidden = false; $("dataBox").hidden = true; ["loginBox", "forgotBox", "resetBox"].forEach(id => $(id).hidden = id !== v); setAuth(""); }
async function show(session) {
  if (recovering) return;
  if (session) {
    $("authBox").hidden = true; $("dataBox").hidden = false;
    $("who").textContent = $("who2").textContent = session.user.email;
    go("today"); await loadData();
  } else authView("loginBox");
}
const doLogin = async () => {
  const email = $("email").value.trim(), password = $("password").value;
  $("loginErr").hidden = true; $("email").classList.remove("bad"); $("password").classList.remove("bad");
  if (!email || !password) { setAuth("Please enter your email and password.", "err"); return; }
  $("btnLogin").disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  $("btnLogin").disabled = false;
  if (error) {
    if (/invalid login/i.test(error.message)) { $("loginErr").hidden = false; $("password").classList.add("bad"); setAuth(""); }
    else setAuth("Could not sign in: " + error.message, "err");
  }
};
$("btnLogin").onclick = doLogin;
$("password").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
$("btnForgot").onclick = () => { authView("forgotBox"); $("fEmail").value = $("email").value.trim(); $("fSent").hidden = true; };
$("btnBack").onclick = () => authView("loginBox");
$("btnSendReset").onclick = async () => {
  const email = $("fEmail").value.trim();
  if (!email) { setAuth("Type your email first.", "err"); $("fEmail").focus(); return; }
  $("btnSendReset").disabled = true;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: adminUrl });
  $("btnSendReset").disabled = false;
  if (error) { setAuth("Could not send reset email: " + error.message, "err"); return; }
  setAuth(""); $("fSent").hidden = false; $("fSentText").textContent = `We sent a link to ${email}. Open it on this device.`;
};
const pwChecks = () => {
  const a = $("newPw").value, b = $("newPw2").value;
  $("ck8").classList.toggle("ok", a.length >= 8); $("ckNum").classList.toggle("ok", /\d/.test(a));
  const mm = b.length > 0 && a !== b; $("pwMismatch").hidden = !mm; $("newPw2").classList.toggle("bad", mm);
  return a.length >= 8 && /\d/.test(a) && a === b;
};
$("newPw").oninput = $("newPw2").oninput = pwChecks;
$("btnSetPw").onclick = async () => {
  if (!pwChecks()) { setAuth("Please fix the password first: at least 8 characters, a number, and type it twice.", "err"); return; }
  $("btnSetPw").disabled = true;
  const { data, error } = await sb.auth.updateUser({ password: $("newPw").value });
  $("btnSetPw").disabled = false;
  if (error) { setAuth("Could not save password: " + error.message, "err"); return; }
  recovering = false; history.replaceState(null, "", adminUrl);
  current = data.user?.id ?? null; await show((await sb.auth.getSession()).data.session);
  setStatus("✅ Password saved.", "ok");
};
$$("[data-signout]").forEach(b => b.onclick = async () => { await sb.auth.signOut(); rows = []; staff = []; show(null); });

// ---------- Filters ----------
$("date").value = today();
$("date").onchange = $("person").onchange = renderLog;
$("btnAll").onclick = () => { $("date").value = ""; renderLog(); };
$$("#typeSeg button").forEach(b => b.onclick = () => { typeFilter = b.dataset.t; $$("#typeSeg button").forEach(x => x.classList.toggle("on", x === b)); renderLog(); });
$("btnCsv").onclick = () => csv(shown(), $("date").value || "all");
$("btnCsvToday").onclick = () => csv(rows.filter(r => pp(r.created_at).date === today()), today());
$("btnRetry").onclick = loadData;

sb.auth.onAuthStateChange((e, s) => {
  if (e === "PASSWORD_RECOVERY") { recovering = true; current = s?.user?.id ?? null; authView("resetBox"); setAuth("Choose a new password.", "info"); return; }
  if (recovering) return;
  if ((s?.user?.id) !== current) { current = s?.user?.id ?? null; show(s); }
});
const { data: { session } } = await sb.auth.getSession();
if (!session && !recovering) show(null);
