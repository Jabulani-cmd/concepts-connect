import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GradeRow { subject: string; mark?: number | null; grade?: string | null; comment?: string | null; }
interface Body {
  studentName: string;
  formLevel?: string;
  term?: string;
  grades?: GradeRow[];
  attendancePercent?: number | null;
  teacherNotes?: string;
  tone?: "encouraging" | "neutral" | "needs_improvement";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return j({ error: "LOVABLE_API_KEY not configured" }, 500);

    const body = (await req.json()) as Body;
    if (!body.studentName) return j({ error: "studentName is required" }, 400);

    const tone = body.tone || "neutral";
    const toneGuide = {
      encouraging: "Warm, uplifting and celebratory. Highlight wins; frame growth areas as exciting next steps.",
      neutral: "Professional, balanced and factual. Acknowledge both strengths and areas to improve evenly.",
      needs_improvement: "Honest and direct but kind. Clearly name the concerns and the specific actions required, without being harsh.",
    }[tone];

    const gradesSummary = (body.grades || []).map(g =>
      `- ${g.subject}: ${g.mark ?? "n/a"}${g.grade ? ` (${g.grade})` : ""}${g.comment ? ` — ${g.comment}` : ""}`
    ).join("\n") || "(no marks supplied)";

    const systemPrompt = `You are an experienced Zimbabwean secondary school teacher writing report card comments.
You write 3-4 sentences, professional, in British English, age-appropriate for secondary students.
Refer to the student by first name. Never invent marks. Do not exceed 4 sentences. Do not use markdown.`;

    const userPrompt = `Write a report card comment.

Student: ${body.studentName}
Form: ${body.formLevel || "N/A"}
Term: ${body.term || "Current term"}
Attendance: ${body.attendancePercent != null ? body.attendancePercent + "%" : "N/A"}

Subject results:
${gradesSummary}

Teacher notes: ${body.teacherNotes || "(none)"}

Tone: ${tone} — ${toneGuide}`;

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
            name: "submit_comment",
            description: "Return the report card comment.",
            parameters: {
              type: "object",
              properties: {
                comment: { type: "string", description: "3-4 sentence narrative comment." },
              },
              required: ["comment"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_comment" } },
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
    if (!args) return j({ error: "No comment returned" }, 500);
    const parsed = JSON.parse(args);
    return j({ comment: parsed.comment, tone });
  } catch (e) {
    console.error("ai-report-comment error", e);
    return j({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
