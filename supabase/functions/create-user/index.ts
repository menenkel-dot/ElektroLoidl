import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, firstName, lastName, role, permissions, targetHoursMonthly, vacationTotal } = await req.json()

    console.log("[create-user] Versuche User anzulegen:", email);

    // 1. User in Auth anlegen
    const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName }
    })

    if (authError) {
      console.error("[create-user] Auth Error:", authError.message);
      throw authError;
    }

    const userId = authUser.user.id;
    console.log("[create-user] User angelegt mit ID:", userId);

    // 2. Profil aktualisieren (Warten, falls der Trigger noch läuft)
    // Wir nutzen upsert, um sicherzugehen
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .upsert({ 
        id: userId,
        first_name: firstName, 
        last_name: lastName, 
        role, 
        permissions,
        target_hours_monthly: targetHoursMonthly || 160,
        vacation_total: vacationTotal || 30,
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error("[create-user] Profile Update Error:", profileError.message);
      throw profileError;
    }

    return new Response(JSON.stringify({ user: authUser.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[create-user] Kritischer Fehler:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})