import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const c = window.SUPABASE_CONFIG;
const sb = createClient(c.url, c.publishableKey);
const $ = id => document.getElementById(id);
const TZ = "Asia/Phnom_Penh";
const setStatus = (m, cls = "") => { $("status").textContent = m; $("status").className = "status " + cls; $("status").hidden = !m; };
let rows = [];

function pp(iso) {
  const p = {}; new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    .formatToParts(new Date(iso)).forEach(x => p[x.type] = x.value);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}` };
}
const shown = () => { const d = $("date").value; return d ? rows.filter(r => pp(r.created_at).date === d) : rows; };

function render() {
  const list = shown(), tb = $("rows"); tb.innerHTML = "";
  list.forEach(r => {
    const t = pp(r.created_at), tr = document.createElement("tr");
    [t.date, t.time, r.employee_name, r.employee_id || "", r.type, Math.round(r.distance_m ?? 0), Math.round(r.accuracy_m ?? 0)]
      .forEach((v, i) => { const td = document.createElement("td"); if (i === 4) { const b = document.createElement("span"); b.className = "badge " + v; b.textContent = v; td.appendChild(b); } else td.textContent = v; if (i >= 5) td.className = "num"; tr.appendChild(td); });
    const td = document.createElement("td");
    if (r.lat != null) { const a = document.createElement("a"); a.href = `https://www.google.com/maps?q=${r.lat},${r.lng}`; a.target = "_blank"; a.textContent = "map"; td.appendChild(a); }
    tr.appendChild(td); tb.appendChild(tr);
  });
  $("sIn").textContent = list.filter(r => r.type === "IN").length;
  $("sOut").textContent = list.filter(r => r.type === "OUT").length;
  $("sEmp").textContent = new Set(list.map(r => (r.employee_id || r.employee_name || "").trim().toLowerCase())).size;
  $("count").textContent = `${list.length} record(s)${$("date").value ? " on " + $("date").value : " (all dates)"}. Newest first.`;
}

async function loadData() {
  setStatus("Loading check-ins…");
  const { data, error } = await sb.from("checkins").select("*").order("created_at", { ascending: false }).limit(5000);
  if (error) { setStatus("Could not load check-ins: " + error.message, "err"); return; }
  rows = data; render(); loadTg();
  setStatus(rows.length ? "" : "No check-ins visible. (Only the admin account can see records.)");
}

function csv() {
  const cols = ["date", "time", "employee_name", "employee_id", "type", "lat", "lng", "distance_m", "accuracy_m", "device_time", "created_at_utc"];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = shown().map(r => { const t = pp(r.created_at); return cols.map(k => esc(k === "date" ? t.date : k === "time" ? t.time : k === "created_at_utc" ? r.created_at : r[k])).join(","); });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + [cols.join(","), ...lines].join("\n")], { type: "text/csv" }));
  a.download = `checkins-${$("date").value || "all"}.csv`; a.click();
}

async function show(session) {
  if (session) {
    $("loginBox").hidden = true; $("dataBox").hidden = false;
    $("who").textContent = "Signed in as " + session.user.email;
    await loadData();
  } else {
    $("loginBox").hidden = false; $("dataBox").hidden = true; $("resetBox").hidden = true; setStatus("");
  }
}

const adminUrl = location.origin + location.pathname; // current admin page (preview or production)
let recovering = false;
const doLogin = async () => {
  const email = $("email").value.trim(), password = $("password").value;
  if (!email || !password) { setStatus("Please enter your email and password.", "err"); return; }
  $("btnLogin").disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  $("btnLogin").disabled = false;
  if (error) setStatus("Could not sign in: " + error.message, "err");
};
$("btnLogin").onclick = doLogin;
$("password").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
$("btnForgot").onclick = async () => {
  const email = $("email").value.trim();
  if (!email) { setStatus("Type your email first, then tap Forgot password.", "err"); $("email").focus(); return; }
  $("btnForgot").disabled = true;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: adminUrl });
  $("btnForgot").disabled = false;
  setStatus(error ? "Could not send reset email: " + error.message : "📧 Check your email for a link to set a new password.", error ? "err" : "ok");
};
function showReset() { recovering = true; $("loginBox").hidden = true; $("dataBox").hidden = true; $("resetBox").hidden = false; setStatus("Choose a new password (at least 8 characters)."); }
$("btnSetPw").onclick = async () => {
  const a = $("newPw").value, b = $("newPw2").value;
  if (a.length < 8) { setStatus("Password must be at least 8 characters.", "err"); return; }
  if (a !== b) { setStatus("The two passwords don't match.", "err"); return; }
  $("btnSetPw").disabled = true;
  const { data, error } = await sb.auth.updateUser({ password: a });
  $("btnSetPw").disabled = false;
  if (error) { setStatus("Could not save password: " + error.message, "err"); return; }
  recovering = false; $("resetBox").hidden = true; history.replaceState(null, "", adminUrl);
  setStatus("✅ Password saved.", "ok"); current = data.user?.id ?? null; show((await sb.auth.getSession()).data.session);
};
$("btnOut").onclick = async () => { await sb.auth.signOut(); rows = []; show(null); };
$("date").value = pp(new Date()).date;
$("date").onchange = render;
$("btnAll").onclick = () => { $("date").value = ""; render(); };
$("btnCsv").onclick = csv;

let current = null;
sb.auth.onAuthStateChange((e, s) => {
  if (e === "PASSWORD_RECOVERY") { current = s?.user?.id ?? null; showReset(); return; }
  if (recovering) return;
  if ((s?.user?.id) !== current) { current = s?.user?.id ?? null; show(s); }
});
const { data: { session } } = await sb.auth.getSession();
if (!session) show(null);

// ---- Telegram staff approval + reminder switch ----
async function loadTg() {
  const tb = $("tgRows"); if (!tb) return;
  const [{ data: staff, error }, { data: set }] = await Promise.all([
    sb.from("tg_staff").select("*").order("created_at", { ascending: false }),
    sb.from("tg_settings").select("reminders_enabled").eq("id", 1).maybeSingle()]);
  if (error) { tb.innerHTML = `<tr><td colspan="5">Telegram not set up yet (${error.message})</td></tr>`; return; }
  $("remToggle").checked = !!set?.reminders_enabled;
  tb.innerHTML = staff.length ? "" : '<tr><td colspan="5" class="muted">No Telegram users yet.</td></tr>';
  staff.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td></td><td><input class="n"></td><td><input class="e"></td><td></td><td></td>`;
    tr.cells[0].textContent = s.tg_username ? "@" + s.tg_username : String(s.telegram_user_id);
    tr.querySelector(".n").value = s.display_name; tr.querySelector(".e").value = s.employee_id || "";
    tr.cells[3].textContent = s.status;
    const mk = (label, status) => { const b = document.createElement("button"); b.className = "small" + (status === "rejected" ? " ghost" : ""); b.textContent = label;
      b.onclick = async () => {
        const upd = { display_name: tr.querySelector(".n").value.trim() || s.display_name, employee_id: tr.querySelector(".e").value.trim() || null, status };
        if (status === "approved") { upd.approved_at = new Date().toISOString(); upd.approved_by = (await sb.auth.getUser()).data.user?.email; }
        const { error } = await sb.from("tg_staff").update(upd).eq("telegram_user_id", s.telegram_user_id);
        setStatus(error ? "Update failed: " + error.message : "Saved.", error ? "err" : "ok"); loadTg();
      }; tr.cells[4].appendChild(b); };
    mk(s.status === "approved" ? "Save" : "Approve", "approved"); if (s.status !== "rejected") mk("Reject", "rejected");
    tb.appendChild(tr);
  });
}
$("remToggle").onchange = async e => {
  const { error } = await sb.from("tg_settings").update({ reminders_enabled: e.target.checked }).eq("id", 1);
  setStatus(error ? "Could not change reminder: " + error.message : "Reminder " + (e.target.checked ? "ON" : "OFF") + ".", error ? "err" : "ok");
};
