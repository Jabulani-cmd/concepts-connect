// Teacher AI suite — lesson plans, worksheets, rubrics, feedback, parent messages,
// at-risk explanations and class insights. ZIMSEC-aligned.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3.8-flash";

const LANGUAGES: Record<string, string> = {
  en: "English",
  sn: "chiShona",
  nd: "isiNdebele",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildPrompt(kind: string, p: Record<string, any>): { system: string; user: string } {
  const zimsec =
    "You support secondary school teachers in Zimbabwe. Everything must align with the ZIMSEC curriculum, use Zimbabwean context and examples, and use Forms 1-6 / Grade terminology as given. Reply with valid JSON only — no markdown fences, no commentary.";

  switch (kind) {
    case "lesson_plan":
      return {
        system: `${zimsec} JSON shape: {"title":string,"objectives":string[],"outline":[{"stage":string,"minutes":number,"activity":string}],"materials":string[],"assessment":string,"homework":string}`,
        user: `Subject: ${p.subject}\nLevel: ${p.level}\nTopic: ${p.topic}\nDuration: ${p.duration} minutes`,
      };
    case "worksheet":
      return {
        system: `${zimsec} Produce ${p.count} ${p.format} questions at ${p.difficulty} difficulty with a full answer key. JSON shape: {"title":string,"instructions":string,"questions":[{"number":number,"question":string,"options":string[],"answer":string,"marks":number}]}. For non multiple-choice formats use an empty options array.`,
        user: `Topic: ${p.topic}\nSubject: ${p.subject}\nLevel: ${p.level}\nFormat: ${p.format}\nDifficulty: ${p.difficulty}\nNumber of questions: ${p.count}`,
      };
    case "rubric":
      return {
        system: `${zimsec} JSON shape: {"title":string,"total_marks":number,"criteria":[{"criterion":string,"weight":number,"bands":[{"band":string,"range":string,"descriptor":string}]}]}. Use ZIMSEC grade bands A*, A, B, C, D, E, U.`,
        user: `Assignment: ${p.assignment}\nSubject: ${p.subject}\nLevel: ${p.level}`,
      };
    case "feedback":
      return {
        system: `${zimsec} Write a warm, specific 3-4 sentence feedback comment for one learner. JSON shape: {"comment":string}`,
        user: `Student: ${p.student}\nAssignment: ${p.assignment}\nSubject: ${p.subject}\nScore: ${p.score} out of ${p.outOf}\nTeacher notes: ${p.notes || "none"}`,
      };
    case "parent_message": {
      const lang = LANGUAGES[p.language] || "English";
      return {
        system: `${zimsec} Draft a short, respectful message from a teacher to a parent, written entirely in ${lang}. Keep it under 120 words. JSON shape: {"message":string}`,
        user: `Student: ${p.student}\nReason: ${p.reason}\nExtra context from teacher: ${p.notes || "none"}`,
      };
    }
    case "risk_reason":
      return {
        system: `${zimsec} You explain why a learner has been flagged as at risk. Be concrete and quote the numbers given. JSON shape: {"reason":string,"suggested_actions":string[]}. Give 1-2 practical next steps. Never be punitive.`,
        user: `Student: ${p.student}\nSignals: ${JSON.stringify(p.signals)}\nRule-based risk level: ${p.risk_score}`,
      };
    case "insights":
      return {
        system: `${zimsec} You give a teacher supportive, non-punitive nudges about their class. JSON shape: {"summary":string,"weak_topics":[{"topic":string,"average":number,"note":string}],"suggestions":string[]}`,
        user: `Class data: ${JSON.stringify(p.data)}`,
      };
    default:
      return { system: zimsec, user: JSON.stringify(p) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const kind = String(body?.kind || "");
    if (!kind) return jsonResponse({ error: "kind is required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "AI is not configured" }, 500);

    const { system, user } = buildPrompt(kind, body.payload ?? {});

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return jsonResponse({ error: "AI is busy right now. Please try again in a moment." }, 429);
      if (res.status === 402) return jsonResponse({ error: "AI credits exhausted. Please contact your administrator." }, 402);
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      return jsonResponse({ error: "AI service error" }, 500);
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();

    let result: unknown;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return jsonResponse({ error: "AI returned an unreadable response. Please try again." }, 502);
    }

    return jsonResponse({ result });
  } catch (e) {
    console.error("teacher-ai-suite error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
