import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Purpose = "progress_update" | "concern" | "meeting_invite" | "fee_reminder" | "general";
type Recipient = "parent" | "student";

interface Body {
  recipient: Recipient;
  purpose: Purpose;
  studentName: string;
  formLevel?: string;
  teacherName?: string;
  context?: string; // free text from teacher: details, marks, dates, etc.
  schoolName?: string;
  variation?: number; // bump to encourage a different draft on regenerate
}

const PURPOSE_LABEL: Record<Purpose, string> = {
  progress_update: "share a progress update",
  concern: "raise a concern that needs attention",
  meeting_invite: "invite to a meeting",
  fee_reminder: "send a polite school fees reminder",
  general: "send a general school communication",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return j({ error: "LOVABLE_API_KEY not configured" }, 500);

    const body = (await req.json()) as Body;
    if (!body.studentName || !body.purpose || !body.recipient) {
      return j({ error: "recipient, purpose and studentName are required" }, 400);
    }

    const school = body.schoolName || "MavingTech Business Solutions";

    const systemPrompt = `You draft warm, professional school communication messages for Zimbabwean secondary schools.
Always:
- Use British English.
- Open with a courteous greeting (e.g. "Dear Parent/Guardian," or the student's first name).
- Keep to 90-160 words.
- Sign off with the teacher's name and the school name.
- Do not invent figures, marks, or dates that are not provided.
- Do not use markdown.`;

    const userPrompt = `Draft a ${body.recipient === "parent" ? "message to the parent/guardian" : "message to the student"} to ${PURPOSE_LABEL[body.purpose]}.

Student: ${body.studentName}${body.formLevel ? " (" + body.formLevel + ")" : ""}
From: ${body.teacherName || "Class Teacher"}
School: ${school}
Additional context from teacher: ${body.context || "(none provided)"}

Variation hint: ${body.variation ?? 1} — produce a fresh phrasing if this number is greater than 1.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_message",
            description: "Return the drafted message.",
            parameters: {
              type: "object",
              properties: {
                subject: { type: "string", description: "Short subject line." },
                message: { type: "string", description: "Full drafted message body." },
              },
              required: ["subject", "message"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_message" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return j({ error: "Rate limit exceeded. Please try again shortly." }, 429);
      if (resp.status === 402) return j({ error: "AI credits exhausted. Add credits in Workspace settings." }, 402);
      console.error("AI gateway error", resp.status, await resp.text());
      return j({ error: "AI gateway error" }, 500);
    }
    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return j({ error: "No message returned" }, 500);
    const parsed = JSON.parse(args);
    return j({ subject: parsed.subject, message: parsed.message });
  } catch (e) {
    console.error("ai-parent-message error", e);
    return j({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
