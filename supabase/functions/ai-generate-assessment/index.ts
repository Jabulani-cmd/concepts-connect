import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// AI text never shows em dashes: the model is told not to use them, and any that slip through are replaced.
const NO_EM_DASH = " Never use em dash characters; use commas, colons or full stops instead.";
const noEmDash = (s: string) => s.replace(/ \u2014 /g, ", ").replace(/\u2014/g, "-");

interface Body {
  subject?: string;
  grade?: string;
  topic?: string;
  count?: number;
  difficulty?: string;
  totalMarks?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'LOVABLE_API_KEY missing' }, 500);

    const body: Body = await req.json();
    const count = Math.min(Math.max(body.count ?? 10, 1), 30);
    const totalMarks = body.totalMarks ?? count;
    const marksPerQ = +(totalMarks / count).toFixed(2);

    const sys = `You generate high-quality multiple-choice questions for the Zimbabwean ZIMSEC secondary curriculum (O-Level and A-Level). Respond ONLY with valid JSON matching the given tool schema.`;
    const user = `Create ${count} multiple-choice questions.
Subject: ${body.subject || 'General'}
Form: ${body.grade || 'Form 1'}
Topic(s): ${body.topic || 'General'}
Difficulty: ${body.difficulty || 'medium'}
Each question must have exactly 4 options, one correct, and a brief explanation.`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: sys + NO_EM_DASH },
          { role: 'user', content: user },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_questions',
            description: 'Return generated MCQ questions',
            parameters: {
              type: 'object',
              additionalProperties: false,
              properties: {
                questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      question: { type: 'string' },
                      options: { type: 'array', items: { type: 'string' } },
                      correct_index: { type: 'integer' },
                      explanation: { type: 'string' },
                    },
                    required: ['question', 'options', 'correct_index', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_questions' } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: `AI gateway ${resp.status}: ${t}` }, resp.status);
    }
    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json({ error: 'No tool call in response' }, 500);
    const parsed = JSON.parse(call.function.arguments);
    type AiQuestion = { question: string; options: string[]; correct_index: number; explanation: string };
    const questions = ((parsed.questions || []) as AiQuestion[]).map((q, i) => ({
      id: `q${i + 1}`,
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      marks: marksPerQ,
    }));

    return json({ questions });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(v: unknown, status = 200) {
  return new Response(noEmDash(JSON.stringify(v)), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
