import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { subject, className, topic, formLevel, duration_minutes } = await req.json();

    if (!topic) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert lesson plan creator for secondary school teachers in Zimbabwe. Create detailed, structured lesson plans that follow best teaching practices. Always respond with a valid JSON object (no markdown, no code fences) with exactly these keys:
- title (string)
- objectives (string, 3-5 bullet points separated by newlines)
- materials_needed (string, comma-separated list)
- introduction (string, 2-3 paragraphs for warm-up/engagement)
- main_activity (string, 3-4 paragraphs describing core teaching activities)
- conclusion (string, 1-2 paragraphs for wrap-up and summary)
- assessment_strategy (string, 2-3 methods to check understanding)
- homework_notes (string, specific assignments or follow-up tasks)`;

    const userPrompt = `Create a lesson plan for:
- Subject: ${subject || "General"}
- Class: ${className || "Not specified"}
- Form Level: ${formLevel || "Not specified"}
- Topic: ${topic}
- Duration: ${duration_minutes || 40} minutes

Make it engaging, age-appropriate, and aligned with the ZIMSEC curriculum where applicable.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_lesson_plan",
              description: "Create a structured lesson plan",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  objectives: { type: "string" },
                  materials_needed: { type: "string" },
                  introduction: { type: "string" },
                  main_activity: { type: "string" },
                  conclusion: { type: "string" },
                  assessment_strategy: { type: "string" },
                  homework_notes: { type: "string" },
                },
                required: ["title", "objectives", "materials_needed", "introduction", "main_activity", "conclusion", "assessment_strategy", "homework_notes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_lesson_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact your administrator." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    let lessonPlan;
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      lessonPlan = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try parsing the content directly
      const content = data.choices?.[0]?.message?.content || "";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      lessonPlan = JSON.parse(cleaned);
    }

    return new Response(JSON.stringify({ lessonPlan }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-lesson-plan error:", error);
    return new Response(JSON.stringify({ error: (error instanceof Error && error.message) || "Failed to generate lesson plan" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
