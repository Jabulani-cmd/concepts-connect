import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// AI text never shows em dashes: the model is told not to use them, and any that slip through are replaced.
const NO_EM_DASH = " Never use em dash characters; use commas, colons or full stops instead.";
const noEmDash = (s: string) => s.replace(/ \u2014 /g, ", ").replace(/\u2014/g, "-");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EssayRequest {
  mode: "essay";
  question: string;
  rubric?: string;
  answer: string;
  level?: string;
  maxMarks?: number;
}

interface McqRequest {
  mode: "mcq";
  answerKey: string[]; // e.g. ["A","B","C","D"]
  studentAnswers: string[];
}

type Req = EssayRequest | McqRequest;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Req;

    if (body.mode === "mcq") {
      const { answerKey, studentAnswers } = body;
      if (!Array.isArray(answerKey) || !Array.isArray(studentAnswers)) {
        return json({ error: "answerKey and studentAnswers must be arrays" }, 400);
      }
      const total = answerKey.length;
      const breakdown = answerKey.map((correct, i) => {
        const given = (studentAnswers[i] ?? "").trim().toUpperCase();
        const expected = String(correct).trim().toUpperCase();
        return { index: i + 1, expected, given, correct: given === expected };
      });
      const correctCount = breakdown.filter((b) => b.correct).length;
      const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);
      return json({
        mode: "mcq",
        score,
        correctCount,
        total,
        breakdown,
        feedback: `Scored ${correctCount} out of ${total} (${score}%).`,
      });
    }

    if (body.mode === "essay") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return json({ error: "LOVABLE_API_KEY is not configured" }, 500);
      }
      const { question, rubric, answer, level, maxMarks } = body;
      if (!answer || !question) {
        return json({ error: "question and answer are required" }, 400);
      }

      const systemPrompt = `You are an experienced Zimbabwean secondary school teacher acting as an AI shadow marker.
You assess essay-style answers against a rubric and return STRUCTURED JSON ONLY by calling the provided tool.
Be fair, encouraging, and specific. Reference ZIMSEC and Cambridge (CIE) standards where relevant.`;

      const userPrompt = `Mark the following student response.

Question:
${question}

Rubric:
${rubric || "Grammar & mechanics, relevance to question, structure & coherence, depth of argument, use of evidence."}

Level: ${level || "Secondary (Form 1\u20136)"}
Maximum marks: ${maxMarks ?? 100}

Student answer:
"""
${answer}
"""`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt + NO_EM_DASH },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "submit_grade",
                description: "Return the AI grade and feedback for the student's essay.",
                parameters: {
                  type: "object",
                  properties: {
                    grade: { type: "number", description: "Score from 0 to maxMarks." },
                    grade_percent: { type: "number", description: "Score as 0-100 percentage." },
                    overall_feedback: { type: "string", description: "2-4 sentence summary for the student." },
                    strengths: { type: "array", items: { type: "string" }, description: "Bullet strengths." },
                    improvements: { type: "array", items: { type: "string" }, description: "Bullet areas to improve." },
                    rubric_scores: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          criterion: { type: "string" },
                          score: { type: "number" },
                          max: { type: "number" },
                          comment: { type: "string" },
                        },
                        required: ["criterion", "score", "max", "comment"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["grade", "grade_percent", "overall_feedback", "strengths", "improvements", "rubric_scores"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "submit_grade" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return json({ error: "Rate limit exceeded. Please try again shortly." }, 429);
        if (response.status === 402) return json({ error: "Lovable AI credits exhausted. Add credits in Workspace settings." }, 402);
        const t = await response.text();
        console.error("AI gateway error", response.status, t);
        return json({ error: "AI gateway error" }, 500);
      }

      const data = await response.json();
      const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        return json({ error: "No structured grade returned" }, 500);
      }
      const parsed = JSON.parse(toolCall.function.arguments);
      return json({ mode: "essay", ...parsed });
    }

    return json({ error: "Unknown mode" }, 400);
  } catch (e) {
    console.error("ai-shadow-marker error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(noEmDash(JSON.stringify(body)), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
