
// AI text never shows em dashes: the model is told not to use them, and any that slip through are replaced.
const NO_EM_DASH = " Never use em dash characters; use commas, colons or full stops instead.";
const noEmDash = (s: string) => s.replace(/ \u2014 /g, ", ").replace(/\u2014/g, "-");
// Multi-model AI assistant for teachers (lesson planning, admin writing, etc.)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map friendly names to Lovable AI gateway model IDs.
// DeepSeek / Claude are not on the gateway - they fall back to a close equivalent.
const MODEL_MAP: Record<string, { id: string; note?: string }> = {
  "gemini-pro": { id: "google/gemini-2.5-pro" },
  "gemini-flash": { id: "google/gemini-3-flash-preview" },
  "gpt-5": { id: "openai/gpt-5" },
  "gpt-5-mini": { id: "openai/gpt-5-mini" },
  "chatgpt": { id: "openai/gpt-5" },
  "claude": { id: "openai/gpt-5", note: "Claude is not available on the integrated AI gateway. Using GPT-5 (a comparable reasoning model) instead." },
  "deepseek": { id: "google/gemini-2.5-pro", note: "DeepSeek is not available on the integrated AI gateway. Using Gemini 2.5 Pro (a comparable reasoning model) instead." },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, model = "gemini-flash", task = "general" } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(noEmDash(JSON.stringify({ error: "LOVABLE_API_KEY missing" })), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chosen = MODEL_MAP[model] || MODEL_MAP["gemini-flash"];

    const systemByTask: Record<string, string> = {
      general: "You are an AI assistant for a secondary school teacher in Zimbabwe. Be concise, practical, and friendly. Format responses with clear markdown headings and bullet points.",
      lesson: "You are an expert secondary school lesson planner. Produce structured lesson plans with objectives, materials, introduction, main activity, conclusion, assessment, and homework. Align to the ZIMSEC curriculum when relevant.",
      admin: "You help a teacher draft administrative documents: memos, reports, parent letters, leave requests, meeting minutes. Use a professional tone.",
      grading: "You help a teacher write fair, constructive grading feedback and report card comments. Be specific and encouraging.",
      email: "You help a teacher draft clear, professional emails to parents, colleagues, and administrators.",
    };

    const systemPrompt = systemByTask[task] || systemByTask.general;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chosen.id,
        messages: [
          { role: "system", content: systemPrompt + NO_EM_DASH + (chosen.note ? `\n\n(Note to relay if user asks about model: ${chosen.note})` : "") },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(noEmDash(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." })), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(noEmDash(JSON.stringify({ error: "AI credits exhausted. Please contact your administrator." })), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      return new Response(noEmDash(JSON.stringify({ error: "AI gateway error" })), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleaned = res.body!
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TransformStream<string, string>({ transform: (chunk, out) => out.enqueue(noEmDash(chunk)) }))
      .pipeThrough(new TextEncoderStream());
    return new Response(cleaned, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("teacher-ai-assistant error", e);
    return new Response(noEmDash(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" })), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
