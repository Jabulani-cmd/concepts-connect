import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = { id: claimsData.claims.sub as string };

    const { action, ...payload } = await req.json();

    // For "link" action, must be a parent
    if (action === "link") {
      const { data: isParent } = await supabaseAdmin.rpc("has_role", {
        _user_id: user.id,
        _role: "parent",
      });
      if (!isParent) {
        return new Response(JSON.stringify({ error: "Only parents can link children" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ==================== LINK CHILD ====================
    if (action === "link") {
      const { admission_number } = payload;

      if (!admission_number) {
        return new Response(JSON.stringify({ error: "Admission number is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find student by admission number
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("id, full_name, form, admission_number, guardian_email")
        .eq("admission_number", admission_number.trim())
        .eq("status", "active")
        .maybeSingle();

      // Only the guardian the school has on record may link themselves; otherwise anyone
      // could claim any child by guessing an admission number. The same message is used
      // either way so admission numbers can't be probed.
      const { data: caller } = await supabaseAdmin.auth.admin.getUserById(user.id);
      const callerEmail = (caller?.user?.email ?? "").trim().toLowerCase();
      const guardianEmail = (student?.guardian_email ?? "").trim().toLowerCase();
      if (!student || !callerEmail || guardianEmail !== callerEmail) {
        return new Response(JSON.stringify({
          error: "We couldn't link this child to your account. Your email must match the guardian email the school has for this student. Please contact the school office.",
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already linked
      const { data: existing } = await supabaseAdmin
        .from("parent_students")
        .select("id")
        .eq("parent_id", user.id)
        .eq("student_id", student.id)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "This child is already linked to your account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create link
      const { error: linkError } = await supabaseAdmin
        .from("parent_students")
        .insert({ parent_id: user.id, student_id: student.id });

      if (linkError) throw linkError;

      return new Response(JSON.stringify({
        message: "Child linked successfully",
        student: { id: student.id, full_name: student.full_name, form: student.form },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
