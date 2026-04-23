import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import "https://deno.land/std@0.168.0/dotenv/load.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
)

const { data, error } = await supabase
  .from("whatsapp_instances")
  .select("phone_number")
  .eq("is_primary", true)
  .single()

if (error) {
  console.error(error)
} else {
  console.log("BOT_NUMBER:", data.phone_number)
}
