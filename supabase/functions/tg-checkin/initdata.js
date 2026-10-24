// Verify Telegram Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
// Works in Deno and Node 20 (Web Crypto). Returns { ok, user, authDate, reason }.
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
async function hmac(keyBytes, msg) {
  const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

export async function signInitData(fields, botToken) { // test helper: builds a valid initData string
  const p = new URLSearchParams(fields);
  const dcs = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  p.set("hash", hex(await hmac(new Uint8Array(secret), dcs)));
  return p.toString();
}

export async function verifyInitData(initData, botToken, maxAgeSec = 86400, nowSec = Math.floor(Date.now() / 1000)) {
  if (!initData || !botToken) return { ok: false, reason: "missing" };
  const p = new URLSearchParams(initData);
  const hash = p.get("hash"); if (!hash) return { ok: false, reason: "no hash" };
  p.delete("hash");
  const dcs = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  if (!safeEq(hex(await hmac(new Uint8Array(secret), dcs)), hash.toLowerCase())) return { ok: false, reason: "bad hash" };
  const authDate = Number(p.get("auth_date"));
  if (!authDate || nowSec - authDate > maxAgeSec) return { ok: false, reason: "expired" };
  let user; try { user = JSON.parse(p.get("user") || "null"); } catch { user = null; }
  if (!user?.id) return { ok: false, reason: "no user" };
  return { ok: true, user, authDate };
}
