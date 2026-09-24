// AI substitute suggestion: pick the best available teacher.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// AI text never shows em dashes: the model is told not to use them, and any that slip through are replaced.
const NO_EM_DASH = " Never use em dash characters; use commas, colons or full stops instead.";
const noEmDash = (s: string) => s.replace(/ \u2014 /g, ", ").replace(/\u2014/g, "-");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { absentTeacher, subject, day, period, candidates } = await req.json();
    // candidates: [{ name, subjects: string[], periodsThisWeek: number, busyAt: [{day,period}] }]
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(noEmDash(JSON.stringify({ error: "LOVABLE_API_KEY missing" })),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You suggest the best substitute teacher. Prioritize: (1) subject match, (2) lower current workload, (3) availability. Return via tool only." + NO_EM_DASH },
          { role: "user", content: `Absent: ${absentTeacher} for ${subject} on day ${day} period ${period}. Candidates:\n${JSON.stringify(candidates, null, 2)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_substitute",
            parameters: {
              type: "object",
              properties: {
                ranked: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      score: { type: "integer" },
                      reason: { type: "string" },
                    },
                    required: ["name", "score", "reason"],
                  },
                },
              },
              required: ["ranked"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_substitute" } },
      }),
    });
    if (!aiRes.ok) {
      return new Response(noEmDash(JSON.stringify({ error: "AI gateway error" })),
        { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ai = await aiRes.json();
    const args = ai?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const out = args ? JSON.parse(args) : { ranked: [] };
    return new Response(noEmDash(JSON.stringify(out)),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(noEmDash(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" })),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
