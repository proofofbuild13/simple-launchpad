// Generates a structured project brief (description, requirements, deliverables)
// from a founder's short idea. Invoked client-side by authenticated founders.
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "google/gemini-3-flash-preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "missing LOVABLE_API_KEY" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const title = String(body?.title ?? "").trim();
  const short_description = String(body?.short_description ?? "").trim();
  if (!title || title.length > 200) return json({ error: "title required (1-200 chars)" }, 400);
  if (!short_description || short_description.length > 1000) {
    return json({ error: "short_description required (1-1000 chars)" }, 400);
  }
  const category = String(body?.category ?? "").trim().slice(0, 100);
  const engagement_type = body?.engagement_type === "hire_to_build" ? "hire_to_build" : "project_hire";
  const job_title = String(body?.job_title ?? "").trim().slice(0, 200);
  const timeline = String(body?.timeline ?? "").trim().slice(0, 100);
  const difficulty = String(body?.difficulty ?? "").trim().slice(0, 50);

  const isH2B = engagement_type === "hire_to_build";

  const system = `You are helping a startup founder write a clear, builder-ready project brief for a build-to-hire platform. Builders submit working prototypes against this brief, so it must be specific enough to act on but concise enough to read.

Generate three sections:
1. description: 3-5 sentences. The detailed problem statement. Explain WHY it matters to the business, not just what to build. Write in second/third person — never first person ("I want...").
2. requirements: 4-7 bullet lines (single string, newline-separated) covering functional requirements, implied tech constraints, and what "done" looks like.
3. deliverables: 3-5 bullet lines (single string, newline-separated) listing concrete artifacts — e.g. demo URL, source repo, video walkthrough, written design notes.

Keep it realistic for a ${isH2B ? "hiring challenge" : "fixed-scope project"}. Do NOT invent budget figures, deadlines, company names, or details not implied by the founder's input. Respond ONLY with JSON matching the schema.`;

  const userMsg = JSON.stringify({
    title,
    category: category || null,
    engagement_type,
    job_title: job_title || null,
    timeline: timeline || null,
    difficulty: difficulty || null,
    founder_idea: short_description,
  });

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      description: { type: "string" },
      requirements: { type: "string" },
      deliverables: { type: "string" },
    },
    required: ["description", "requirements", "deliverables"],
  };

  let resp: Response;
  try {
    resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "project_brief", strict: true, schema },
        },
      }),
    });
  } catch (e: any) {
    return json({ error: "gateway unreachable", details: e?.message }, 502);
  }

  if (resp.status === 429) return json({ error: "rate_limited", message: "AI is busy. Try again shortly." }, 429);
  if (resp.status === 402) return json({ error: "credits_exhausted", message: "AI credits exhausted. Add credits in workspace settings." }, 402);
  if (!resp.ok) {
    const text = await resp.text();
    console.error("gateway error", resp.status, text);
    return json({ error: "gateway_error", status: resp.status }, 502);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  let parsed: any;
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    return json({ error: "parse_failed" }, 500);
  }
  if (!parsed?.description || !parsed?.requirements || !parsed?.deliverables) {
    return json({ error: "invalid_ai_response" }, 500);
  }

  return json({
    description: parsed.description,
    requirements: parsed.requirements,
    deliverables: parsed.deliverables,
  });
});
