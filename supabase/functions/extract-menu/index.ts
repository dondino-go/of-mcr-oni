import "@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

const SYSTEM_PROMPT = `You are a menu parser. Given an image of a bar or restaurant menu, extract any Negroni or Old Fashioned cocktails you can find.

Return a JSON object with this exact shape:
{
  "cocktails": [
    { "type": "NEGRONI" | "OLD_FASHIONED", "price_gbp": number | null }
  ]
}

Rules:
- Only include NEGRONI and OLD_FASHIONED
- If you see a Negroni variant (e.g. "Negroni Sbagliato"), include it as NEGRONI
- price_gbp should be a number (e.g. 12.5), or null if not visible
- If neither cocktail is found, return { "cocktails": [] }
- Return only valid JSON, no explanation`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { image_base64, mime_type = 'image/jpeg' } = await req.json();

    if (!image_base64) {
      return Response.json({ error: 'Missing image_base64' }, { status: 400 });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYSTEM_PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:${mime_type};base64,${image_base64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', response.status, err);
      return Response.json({ error: `OpenAI error: ${err}` }, { status: 500 });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content ?? '{}';

    // Strip markdown code fences if present
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return Response.json(parsed, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e: any) {
    console.error('Unhandled error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});
