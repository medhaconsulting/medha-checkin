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
      .forEach(v => { const td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
    const td = document.createElement("td");
    if (r.lat != null) { const a = document.createElement("a"); a.href = `https://www.google.com/maps?q=${r.lat},${r.lng}`; a.target = "_blank"; a.textContent = "map"; td.appendChild(a); }
    tr.appendChild(td); tb.appendChild(tr);
  });
  $("count").textContent = `${list.length} record(s)${$("date").value ? " on " + $("date").value : " (all dates)"}. Newest first.`;
}

async function loadData() {
  setStatus("Loading check-ins…");
  const { data, error } = await sb.from("checkins").select("*").order("created_at", { ascending: false }).limit(5000);
  if (error) { setStatus("Could not load check-ins: " + error.message, "err"); return; }
  rows = data; render();
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
    $("loginBox").hidden = false; $("dataBox").hidden = true; setStatus("");
  }
}

$("btnLogin").onclick = async () => {
  const email = $("email").value.trim();
  if (!email) { setStatus("Please enter your email.", "err"); return; }
  $("btnLogin").disabled = true;
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: c.adminRedirectUrl, shouldCreateUser: true } });
  $("btnLogin").disabled = false;
  setStatus(error ? "Could not send link: " + error.message : "📧 Check your email and tap the sign-in link.", error ? "err" : "ok");
};
$("btnOut").onclick = async () => { await sb.auth.signOut(); rows = []; show(null); };
$("date").value = pp(new Date()).date;
$("date").onchange = render;
$("btnAll").onclick = () => { $("date").value = ""; render(); };
$("btnCsv").onclick = csv;

let current = null;
sb.auth.onAuthStateChange((_e, s) => { if ((s?.user?.id) !== current) { current = s?.user?.id ?? null; show(s); } });
const { data: { session } } = await sb.auth.getSession();
if (!session) show(null);
