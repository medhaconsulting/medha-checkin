// Loads supabase-js and exposes window.saveCheckin(row) for app.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const c = window.SUPABASE_CONFIG;
const sb = createClient(c.url, c.publishableKey, { auth: { persistSession: false } });
window.saveCheckin = async row => {
  // No .select() here: employees are not allowed to read rows back.
  const { error } = await sb.from("checkins").insert(row);
  if (error) throw error;
};
