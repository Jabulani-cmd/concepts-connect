// AI-powered exam timetable generation.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// AI text never shows em dashes: the model is told not to use them, and any that slip through are replaced.
const NO_EM_DASH = " Never use em dash characters; use commas, colons or full stops instead.";
const noEmDash = (s: string) => s.replace(/ \u2014 /g, ", ").replace(/\u2014/g, "-");

const SYSTEM_PROMPT = `You generate exam timetables. Return ONLY via the build_exam_timetable tool.
Rules:
- Avoid student clashes: no two exams for the same grade in the same session.
- Distribute heavy subjects (Math/English/Science) with at least 1 day gap between them.
- Balance invigilator load evenly.
- Respect venue capacities (don't exceed them).
- session is "morning" or "afternoon".
- date is YYYY-MM-DD.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  try {
    const body = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(noEmDash(JSON.stringify({ error: "LOVABLE_API_KEY missing" })),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + NO_EM_DASH },
          { role: "user", content: `Build exam timetable:\n${JSON.stringify(body, null, 2)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "build_exam_timetable",
            parameters: {
              type: "object",
              properties: {
                slots: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string" },
                      session: { type: "string", enum: ["morning", "afternoon"] },
                      start_time: { type: "string" },
                      end_time: { type: "string" },
                      subject: { type: "string" },
                      grade: { type: "string" },
                      venue: { type: "string" },
                      invigilator: { type: "string" },
                    },
                    required: ["date", "session", "subject", "grade"],
                  },
                },
                warnings: { type: "array", items: { type: "string" } },
                summary: { type: "string" },
                score: { type: "integer" },
              },
              required: ["slots", "warnings", "summary", "score"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "build_exam_timetable" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(noEmDash(JSON.stringify({ error: "AI gateway error", detail: txt })),
        { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ai = await aiRes.json();
    const call = ai?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(noEmDash(JSON.stringify({ error: "No structured output" })),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const result = JSON.parse(call.function.arguments);
    return new Response(noEmDash(JSON.stringify({ ...result, generation_time_ms: Date.now() - startedAt })),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(noEmDash(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" })),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
