import assert from "assert";
import { verifyInitData, signInitData } from "./supabase/functions/_shared/initdata.js";
const TOKEN = "123456:FAKE-test-token", now = 1761300000;
const user = JSON.stringify({ id: 42, first_name: "Test", username: "tester" });
const good = await signInitData({ query_id: "AAH", user, auth_date: String(now) }, TOKEN);
let r = await verifyInitData(good, TOKEN, 86400, now); assert(r.ok && r.user.id === 42); console.log("PASS valid initData accepted");
r = await verifyInitData(good, "999:other", 86400, now); assert(!r.ok && r.reason === "bad hash"); console.log("PASS wrong bot token rejected");
r = await verifyInitData(good.replace("Test", "Evil"), TOKEN, 86400, now); assert(!r.ok); console.log("PASS tampered user rejected");
r = await verifyInitData(good, TOKEN, 86400, now + 90000); assert(r.reason === "expired"); console.log("PASS old initData rejected");
r = await verifyInitData("", TOKEN); assert(!r.ok); console.log("PASS empty rejected");
// Independent check with Node's crypto (Telegram's documented algorithm)
import { createHmac } from "crypto";
const p = new URLSearchParams(good); const h = p.get("hash"); p.delete("hash");
const dcs = [...p].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join("\n");
const sec = createHmac("sha256", "WebAppData").update(TOKEN).digest();
assert.equal(createHmac("sha256", sec).update(dcs).digest("hex"), h); console.log("PASS matches reference HMAC");
