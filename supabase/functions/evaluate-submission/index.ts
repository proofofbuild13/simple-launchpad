// Evaluates a submission with AI and stores the result.
// Triggered by a Supabase Database Webhook on submissions INSERT/UPDATE,
// or invoked directly with { submission_id } for re-runs.
import { createClient } from "npm:@supabase/supabase-js@2";

const PROMPT_VERSION = 2;
const MODEL = "google/gemini-3-flash-preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const WEBHOOK_SECRET = Deno.env.get("EVALUATE_SUBMISSION_WEBHOOK_SECRET")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth: accept either webhook secret header or service role bearer.
  const provided = req.headers.get("x-webhook-secret") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const okSecret = WEBHOOK_SECRET && provided === WEBHOOK_SECRET;
  const okBearer = auth === `Bearer ${SERVICE_ROLE}`;
  if (!okSecret && !okBearer) {
    return json({ error: "unauthorized" }, 401);
  }

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  // Supabase DB webhook shape: { type, table, record, old_record }
  // Direct invoke shape:        { submission_id }
  const record = payload?.record ?? payload;
  const submissionId: string | undefined = record?.submission_id ?? record?.id;
  if (!submissionId) return json({ error: "missing submission_id" }, 400);

  // For webhook events, only evaluate fresh submitted/under_review rows.
  if (payload?.type && payload?.table === "submissions") {
    const status = record?.status;
    if (status && !["submitted", "under_review"].includes(status)) {
      return json({ skipped: "status not evaluable", status });
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Skip if already evaluated at the current prompt version.
  const { data: existing } = await supabase
    .from("ai_submission_evaluations")
    .select("id, prompt_version")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (existing && existing.prompt_version === PROMPT_VERSION) {
    return json({ skipped: "already evaluated", id: existing.id });
  }

  const { data: sub, error: sErr } = await supabase
    .from("submissions")
    .select("id, project_id, title, description, notes, tech_stack, demo_url, live_url, github_url, video_url")
    .eq("id", submissionId)
    .maybeSingle();
  if (sErr || !sub) return json({ error: "submission not found", details: sErr?.message }, 404);

  const { data: project } = await supabase
    .from("projects")
    .select("title, category, short_description, description, requirements, deliverables, tags, difficulty")
    .eq("id", sub.project_id)
    .maybeSingle();

  const system = `You are a pre-seed startup analyst grading a builder's submission as a STARTUP / BUSINESS, not as a code review.
Read the submission and the parent project as if reviewing an early-stage pitch. Score 0-20 on each of the 5 dimensions below.
Map each score field to its business meaning:
- score_problem_fit  -> MARKET & DEMAND: TAM/SAM signal, urgency of pain, clarity of target customer, "why now".
- score_execution    -> BUSINESS MODEL & MONETIZATION: revenue model, pricing logic, unit economics, willingness-to-pay.
- score_ux           -> MOAT & DIFFERENTIATION: defensibility vs incumbents/copycats, originality of approach, data/network/brand edge.
- score_feasibility  -> GTM & TRACTION POTENTIAL: distribution plan, first-100-users feasibility, channel-fit, partnerships.
- score_innovation   -> INVESTABILITY: founder/builder execution signal, pre-seed/seed readiness, overall startup grade.

Then provide:
- summary_verdict: 1-2 sentence investor-style verdict.
- strengths: 2-4 business EDGES (market, moat, GTM, monetisation).
- gaps: 2-4 business RISKS (not engineering bugs).
- recommendation: one of "fundable" (>=80 or standout business case), "iterate" (50-79 or mixed/early), "pass" (<50 or no real business).
- startup_grade: letter grade from total score: A (>=85), B (70-84), C (55-69), D (40-54), F (<40).

Be candid; do not inflate. Respond ONLY with valid JSON matching the schema. No prose.`;

  const user = JSON.stringify({
    project: project ?? null,
    submission: sub,
  });

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      score_problem_fit: { type: "integer", minimum: 0, maximum: 20 },
      score_execution: { type: "integer", minimum: 0, maximum: 20 },
      score_ux: { type: "integer", minimum: 0, maximum: 20 },
      score_feasibility: { type: "integer", minimum: 0, maximum: 20 },
      score_innovation: { type: "integer", minimum: 0, maximum: 20 },
      summary_verdict: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      recommendation: { type: "string", enum: ["fundable", "iterate", "pass"] },
      startup_grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
    },
    required: [
      "score_problem_fit","score_execution","score_ux","score_feasibility","score_innovation",
      "summary_verdict","strengths","gaps","recommendation","startup_grade",
    ],
  };

  let aiResult: any = null;
  let aiError: string | null = null;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "evaluation", strict: true, schema },
        },
      }),
    });

    if (resp.status === 429) throw new Error("rate_limited");
    if (resp.status === 402) throw new Error("credits_exhausted");
    if (!resp.ok) throw new Error(`gateway ${resp.status}: ${await resp.text()}`);

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    aiResult = typeof content === "string" ? JSON.parse(content) : content;
  } catch (e: any) {
    aiError = e?.message ?? String(e);
  }

  const row = {
    submission_id: sub.id,
    project_id: sub.project_id,
    score_problem_fit: aiResult?.score_problem_fit ?? null,
    score_execution: aiResult?.score_execution ?? null,
    score_ux: aiResult?.score_ux ?? null,
    score_feasibility: aiResult?.score_feasibility ?? null,
    score_innovation: aiResult?.score_innovation ?? null,
    summary_verdict: aiResult?.summary_verdict ?? null,
    strengths: aiResult?.strengths ?? [],
    gaps: aiResult?.gaps ?? [],
    recommendation: aiResult?.recommendation ?? null,
    startup_grade: aiResult?.startup_grade ?? null,
    error: aiError,
    model_used: MODEL,
    prompt_version: PROMPT_VERSION,
    evaluated_at: new Date().toISOString(),
  };

  const { error: upErr } = await supabase
    .from("ai_submission_evaluations")
    .upsert(row, { onConflict: "submission_id" });
  if (upErr) return json({ error: "db upsert failed", details: upErr.message }, 500);

  if (aiResult) {
    const total =
      (aiResult.score_problem_fit ?? 0) + (aiResult.score_execution ?? 0) +
      (aiResult.score_ux ?? 0) + (aiResult.score_feasibility ?? 0) +
      (aiResult.score_innovation ?? 0);
    await supabase
      .from("submissions")
      .update({ ai_score: total, ai_recommendation: aiResult.recommendation })
      .eq("id", sub.id);
  }

  return json({ ok: true, error: aiError, result: aiResult });
});
