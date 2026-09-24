// AI-powered timetable generation via Lovable AI Gateway (Gemini).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// AI text never shows em dashes: the model is told not to use them, and any that slip through are replaced.
const NO_EM_DASH = " Never use em dash characters; use commas, colons or full stops instead.";
const noEmDash = (s: string) => s.replace(/ \u2014 /g, ", ").replace(/\u2014/g, "-");

interface SubjectRequirement {
  name: string;
  periodsPerWeek: number;
  preferredDays?: string[];
  preferredTime?: "morning" | "afternoon" | "any";
  teacher?: string;
  room?: string;
  allowDouble?: boolean;
}

interface GenerateRequest {
  meta: {
    name: string;
    classLabel: string;
    term: string;
    academicYear: string;
    schoolDays: number[];          // 1..7
    periodMinutes: number;
    periodsPerDay: number;
    dayStartTime: string;          // "07:30"
    breaks: Array<{ afterPeriod: number; label: string; minutes: number }>;
  };
  subjects: SubjectRequirement[];
  teacherAvailability?: Record<string, { unavailable?: Array<{ day: number; period: number }> }>;
  constraints?: {
    maxConsecutive?: number;
    coreInMorning?: boolean;
    avoidSameDay?: boolean;
    distributeEvenly?: boolean;
    lunchInMiddle?: boolean;
  };
  freeText?: string;
}

const SYSTEM_PROMPT = `You are an expert school timetable generator.
You receive a JSON spec for a single class's weekly timetable.
You MUST return a single JSON object via the build_timetable tool with this exact shape:
{
  "slots": [
    { "day": 1, "period": 0, "subject": "Mathematics", "teacher": "Mr Ncube", "room": "Room 5", "reasoning": "Core subject in morning" }
  ],
  "warnings": ["string"],
  "summary": "short paragraph",
  "score": 0-100,
  "prioritized": "What you optimized for"
}
- day: 1=Monday..7=Sunday, only include days in meta.schoolDays.
- period: 0-based, MUST be < meta.periodsPerDay. Break periods are inserted by the client. Do NOT emit them.
- Honor subject.periodsPerWeek exactly.
- Honor teacher unavailability.
- Prefer constraints in this order: hard conflicts > teacher unavailability > preferred time > constraints booleans > free text.
Return ONLY through the tool. No chatter.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const body = (await req.json()) as GenerateRequest;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(noEmDash(JSON.stringify({ error: "LOVABLE_API_KEY not configured" })), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMessage = `Generate a class timetable from this spec:\n\n${JSON.stringify(body, null, 2)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + NO_EM_DASH },
          { role: "user", content: userMessage },
        ],
        tools: [{
          type: "function",
          function: {
            name: "build_timetable",
            description: "Return the complete generated timetable.",
            parameters: {
              type: "object",
              properties: {
                slots: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day: { type: "integer" },
                      period: { type: "integer" },
                      subject: { type: "string" },
                      teacher: { type: "string" },
                      room: { type: "string" },
                      reasoning: { type: "string" },
                    },
                    required: ["day", "period", "subject"],
                  },
                },
                warnings: { type: "array", items: { type: "string" } },
                summary: { type: "string" },
                score: { type: "integer" },
                prioritized: { type: "string" },
              },
              required: ["slots", "warnings", "summary", "score", "prioritized"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "build_timetable" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      const status = aiRes.status;
      const friendly = status === 429
        ? "AI rate limit hit. Try again in a minute."
        : status === 402
        ? "AI credits exhausted. Add funds in Workspace settings."
        : "AI gateway error.";
      console.error("AI error", status, txt);
      return new Response(noEmDash(JSON.stringify({ error: friendly, detail: txt })), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = await aiRes.json();
    const call = ai?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(noEmDash(JSON.stringify({ error: "AI did not return structured timetable" })), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(call.function.arguments);
    return new Response(
      JSON.stringify({ ...result, generation_time_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-timetable error", e);
    return new Response(noEmDash(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" })), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
