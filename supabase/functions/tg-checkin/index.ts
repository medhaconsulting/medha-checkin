// Edge Function: Telegram Mini App backend for Medha Check In.
// Bot token comes from Vault (tg_bot_token RPC) or optional secret TELEGRAM_BOT_TOKEN.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically.
// Deploy with --no-verify-jwt (auth is the Telegram initData signature).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyInitData } from "./initdata.js";

const SITE = { lat: 11.5262264, lng: 104.8682496, radius: 500 };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
// Bot token: env secret if set, else Vault via service-role-only RPC tg_bot_token().
let TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
async function token() { if (!TOKEN) { const { data } = await db.rpc("tg_bot_token"); TOKEN = data ?? ""; } return TOKEN; }
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function dist(lat: number, lng: number) {
  const R = 6371000, r = (d: number) => d * Math.PI / 180;
  const a = Math.sin(r(lat - SITE.lat) / 2) ** 2 + Math.cos(r(lat)) * Math.cos(r(SITE.lat)) * Math.sin(r(lng - SITE.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
async function tgSend(chatId: number, text: string) {
  try { await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }) }); }
  catch (e) { console.warn("telegram send failed", e); }
}
const ppTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Phnom_Penh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(d);

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: any; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const v = await verifyInitData(body.initData, await token());
  if (!v.ok) return json({ error: "Telegram sign-in check failed (" + v.reason + ")" }, 401);
  const u = v.user;

  // Find or create the link record (first time => pending)
  let { data: staff } = await db.from("tg_staff").select("*").eq("telegram_user_id", u.id).maybeSingle();
  if (!staff) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").slice(0, 100) || "Telegram user";
    const ins = await db.from("tg_staff").insert({ telegram_user_id: u.id, tg_username: u.username ?? null, display_name: name, status: "pending" }).select().single();
    if (ins.error) return json({ error: ins.error.message }, 500);
    staff = ins.data;
  }

  // Radius: 500 m, unless a temporary test radius is set for this Telegram user in tg_settings.
  const { data: set } = await db.from("tg_settings").select("test_radius_m, test_user_id").eq("id", 1).maybeSingle();
  const radius = set?.test_radius_m && Number(set.test_user_id) === u.id ? set.test_radius_m : SITE.radius;

  if (body.action === "me") return json({ status: staff.status, name: staff.display_name, employee_id: staff.employee_id, radius });

  if (body.action === "checkin") {
    if (staff.status !== "approved") return json({ error: "Your Telegram account is waiting for admin approval." }, 403);
    const type = body.type === "OUT" ? "OUT" : body.type === "IN" ? "IN" : null;
    const lat = Number(body.lat), lng = Number(body.lng), acc = Number(body.accuracy) || null;
    if (!type || !isFinite(lat) || !isFinite(lng)) return json({ error: "bad input" }, 400);
    const d = Math.round(dist(lat, lng));
    if (d > radius) return json({ error: `Not recorded. You are ${d} m from the office (must be within ${radius} m).`, distance: d }, 422);
    const now = new Date();
    const ins = await db.from("checkins").insert({ employee_name: staff.display_name, employee_id: staff.employee_id, type, lat, lng,
      distance_m: d, accuracy_m: acc ? Math.round(acc) : null, device_time: String(body.device_time ?? "").slice(0, 100) || null,
      telegram_user_id: u.id, source: "telegram" });
    if (ins.error) return json({ error: ins.error.message }, 500);
    await tgSend(u.id, `${type === "IN" ? "✅ You checked IN" : "🚪 You checked OUT"}\n🕒 ${ppTime(now)} (Phnom Penh)\n📍 ${d} m from office`);
    return json({ ok: true, type, distance: d });
  }
  return json({ error: "unknown action" }, 400);
});
