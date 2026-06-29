// Founder AI Agent — conversational project posting.
// Handles: parse brief, draft project, post, match builders, send invites,
// fetch shortlist. Persists chat to agent_threads / agent_messages.
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

type ThreadStats = {
  matched?: number;
  invited?: number;
  submissions?: number;
  shortlisted?: number;
  project_draft?: any;
  matched_builders?: any[];
  awaiting?: "post_project" | "send_invites" | null;
};

async function callAI(systemPrompt: string, userPrompt: string, jsonSchema?: any): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const body: any = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "out", strict: true, schema: jsonSchema },
    };
  }
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify(body),
  });
  if (resp.status === 429) throw new Error("rate_limited");
  if (resp.status === 402) throw new Error("credits_exhausted");
  if (!resp.ok) throw new Error(`gateway_${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (jsonSchema) return typeof content === "string" ? JSON.parse(content) : content;
  return content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const intent = String(body?.intent ?? "chat");
  let threadId: string | undefined = body?.thread_id;

  // Resolve or create active thread
  if (!threadId) {
    const { data: existing } = await admin
      .from("agent_threads")
      .select("id")
      .eq("founder_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) threadId = existing.id;
    else {
      const { data: created, error: cErr } = await admin
        .from("agent_threads")
        .insert({ founder_id: user.id, status: "active", current_stage: 0, stats: {} })
        .select("id")
        .single();
      if (cErr) return json({ error: "thread_create_failed", details: cErr.message }, 500);
      threadId = created.id;
    }
  }

  const { data: thread, error: tErr } = await admin
    .from("agent_threads").select("*").eq("id", threadId).eq("founder_id", user.id).maybeSingle();
  if (tErr || !thread) return json({ error: "thread not found" }, 404);

  const stats: ThreadStats = (thread.stats as ThreadStats) || {};

  async function appendMessage(role: string, content: string, parts: any[] = []) {
    await admin.from("agent_messages").insert({
      thread_id: threadId, role, content, parts,
    });
  }
  async function updateThread(patch: any) {
    await admin.from("agent_threads").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", threadId);
  }

  try {
    // ============ INTENT: chat ============
    if (intent === "chat") {
      const userMsg = String(body?.message ?? "").trim();
      if (!userMsg) return json({ error: "message required" }, 400);
      await appendMessage("user", userMsg);

      // First-ever brief OR no project_draft yet → parse + draft
      if (!stats.project_draft && !thread.project_id) {
        // Stage 1: parse
        await updateThread({ current_stage: 1 });

        const parseSchema = {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            category: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            duration: { type: "string" },
            difficulty: { type: "string", enum: ["junior", "mid", "senior"] },
            short_description: { type: "string" },
            clarification_needed: { type: "boolean" },
            clarification_question: { type: "string" },
          },
          required: ["title", "category", "skills", "duration", "difficulty", "short_description", "clarification_needed", "clarification_question"],
        };
        const parsed = await callAI(
          `You are ProofBuild's project intake agent. Extract structured fields from the founder's brief. If the brief is too vague (no clear deliverable, no tech stack hint, no domain), set clarification_needed=true with a short clarification_question. Otherwise set clarification_needed=false and clarification_question="". Infer reasonable defaults for missing fields.`,
          userMsg,
          parseSchema,
        );

        if (parsed.clarification_needed) {
          await appendMessage("assistant", parsed.clarification_question, [{ type: "text", text: parsed.clarification_question }]);
          await updateThread({ current_stage: 1, stats });
          return json({ ok: true, thread_id: threadId });
        }

        // Stage 2: draft
        await updateThread({ current_stage: 2 });
        const draftSchema = {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            category: { type: "string" },
            short_description: { type: "string" },
            description: { type: "string" },
            requirements: { type: "string" },
            deliverables: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            difficulty: { type: "string" },
            duration: { type: "string" },
          },
          required: ["title", "category", "short_description", "description", "requirements", "deliverables", "skills", "difficulty", "duration"],
        };
        const draft = await callAI(
          `You write builder-ready project briefs for a build-to-hire platform. Output JSON only.
- description: 3-5 sentences explaining the problem and why it matters. Third person, never "I".
- requirements: 4-7 newline-separated bullet lines (no markdown bullets, just newlines).
- deliverables: 3-5 newline-separated bullet lines.
Keep it realistic. No invented budgets or company names.`,
          `Parsed brief: ${JSON.stringify(parsed)}\n\nOriginal founder message: ${userMsg}`,
          draftSchema,
        );

        stats.project_draft = draft;
        stats.awaiting = "post_project";
        await updateThread({ current_stage: 2, stats });

        const reply = `Here's the draft for **${draft.title}**. Review it, then I can post it and start matching builders.`;
        await appendMessage("assistant", reply, [
          { type: "text", text: reply },
          { type: "project_preview", project: draft, awaiting_approval: true },
        ]);
        return json({ ok: true, thread_id: threadId });
      }

      // Subsequent chat with an existing draft → refine the draft
      if (stats.project_draft && !thread.project_id) {
        const refineSchema = {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            category: { type: "string" },
            short_description: { type: "string" },
            description: { type: "string" },
            requirements: { type: "string" },
            deliverables: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            difficulty: { type: "string" },
            duration: { type: "string" },
            changes_summary: { type: "string" },
          },
          required: ["title", "category", "short_description", "description", "requirements", "deliverables", "skills", "difficulty", "duration", "changes_summary"],
        };
        const refined = await callAI(
          `You refine an existing project brief based on the founder's edit request. Apply only the requested changes; keep everything else. Output JSON with the full updated brief and a 1-sentence changes_summary.`,
          `Current draft: ${JSON.stringify(stats.project_draft)}\n\nFounder's edit request: ${userMsg}`,
          refineSchema,
        );
        const { changes_summary, ...newDraft } = refined as any;
        stats.project_draft = newDraft;
        stats.awaiting = "post_project";
        await updateThread({ stats });

        const reply = `Updated. ${changes_summary} Ready to post when you are.`;
        await appendMessage("assistant", reply, [
          { type: "text", text: reply },
          { type: "project_preview", project: newDraft, awaiting_approval: true },
        ]);
        return json({ ok: true, thread_id: threadId });
      }

      // Project already posted → general chat
      const reply = await callAI(
        `You are ProofBuild's founder agent. The project is already posted (id ${thread.project_id}). Help the founder navigate next steps: matching, invites, evaluations, shortlist. Keep replies under 3 sentences.`,
        userMsg,
      );
      await appendMessage("assistant", reply, [{ type: "text", text: reply }]);
      return json({ ok: true, thread_id: threadId });
    }

    // ============ INTENT: approve_post ============
    if (intent === "approve_post") {
      const draft = stats.project_draft;
      if (!draft) return json({ error: "no draft to post" }, 400);
      await appendMessage("user", "Post the project.");
      await updateThread({ current_stage: 3 });

      const { data: proj, error: pErr } = await admin
        .from("projects")
        .insert({
          founder_id: user.id,
          title: draft.title,
          category: draft.category ?? null,
          short_description: draft.short_description,
          description: draft.description,
          requirements: draft.requirements,
          deliverables: draft.deliverables,
          difficulty: draft.difficulty ?? "mid",
          timeline: draft.duration ?? null,
          tags: Array.isArray(draft.skills) ? draft.skills : [],
          engagement_type: "project_hire",
          visibility: "public",
          status: "open_for_submissions",
        })
        .select("id, title")
        .single();
      if (pErr) {
        const msg = `Couldn't post the project: ${pErr.message}`;
        await appendMessage("assistant", msg, [{ type: "text", text: msg }]);
        return json({ error: pErr.message }, 500);
      }

      // Match builders by skills overlap
      const skills: string[] = Array.isArray(draft.skills) ? draft.skills : [];
      const { data: builders } = await admin
        .from("builder_profiles")
        .select("id, full_name, username, title, skills, experience_level, location, avatar_url, rating, total_projects, available")
        .eq("available", true)
        .overlaps("skills", skills.length ? skills : ["x"])
        .limit(20);

      const scored = (builders ?? [])
        .map((b: any) => {
          const overlap = (b.skills ?? []).filter((s: string) =>
            skills.some((q) => q.toLowerCase() === String(s).toLowerCase()),
          ).length;
          const expBoost = b.experience_level === "senior" ? 8 : b.experience_level === "mid" ? 4 : 0;
          const ratingBoost = Math.round(Number(b.rating ?? 0) * 2);
          const max = Math.max(skills.length, 1);
          const match_score = Math.min(98, Math.round((overlap / max) * 70 + expBoost + ratingBoost + 15));
          return { ...b, overlap, match_score };
        })
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, 10);

      stats.project_draft = null as any;
      stats.matched_builders = scored;
      stats.matched = scored.length;
      stats.awaiting = scored.length ? "send_invites" : null;
      await updateThread({ current_stage: scored.length ? 3 : 4, project_id: proj.id, stats });

      const reply = scored.length
        ? `Project posted. I scanned the database and found **${scored.length} matched builders** based on your skill stack. Review the top picks below, then I can send invitations.`
        : `Project posted. No strong matches in the database for those exact skills — want me to broaden the criteria?`;
      await appendMessage("assistant", reply, [
        { type: "text", text: reply },
        { type: "project_posted", project_id: proj.id, title: proj.title },
        ...(scored.length ? [{ type: "builders", builders: scored, awaiting_approval: true }] : []),
      ]);
      return json({ ok: true, thread_id: threadId, project_id: proj.id });
    }

    // ============ INTENT: send_invites ============
    if (intent === "send_invites") {
      const limit = Number(body?.limit ?? 0) || (stats.matched_builders?.length ?? 0);
      const builders = (stats.matched_builders ?? []).slice(0, limit);
      if (!builders.length || !thread.project_id) {
        return json({ error: "no builders or project to invite" }, 400);
      }
      await appendMessage("user", `Send invitations to ${limit} builders.`);
      await updateThread({ current_stage: 4 });

      const rows = builders.map((b: any) => ({
        project_id: thread.project_id,
        founder_id: user.id,
        builder_id: b.id,
        message: `You're a strong match for "${stats.project_draft?.title ?? "this project"}". Take a look and submit your work.`,
        status: "sent",
      }));
      const { error: invErr } = await admin.from("project_invitations").insert(rows);
      if (invErr) {
        const msg = `Couldn't send invitations: ${invErr.message}`;
        await appendMessage("assistant", msg, [{ type: "text", text: msg }]);
        return json({ error: invErr.message }, 500);
      }

      // Send notifications
      const notifRows = builders.map((b: any) => ({
        user_id: b.id,
        type: "project_invitation",
        title: "New project invitation",
        body: `A founder invited you to submit on "${stats.project_draft?.title ?? "a project"}".`,
        link: `/projects/${thread.project_id}`,
      }));
      await admin.from("notifications").insert(notifRows);

      stats.invited = builders.length;
      stats.awaiting = null;
      await updateThread({ current_stage: 5, stats });

      const reply = `Invitations sent to **${builders.length} builders**. I'll watch for submissions and auto-evaluate each one as it comes in. Check back here — I'll surface the ranked shortlist below as evaluations land.`;
      await appendMessage("assistant", reply, [
        { type: "text", text: reply },
        { type: "invites_sent", count: builders.length },
      ]);
      return json({ ok: true, thread_id: threadId, invited: builders.length });
    }

    // ============ INTENT: fetch_shortlist ============
    if (intent === "fetch_shortlist") {
      if (!thread.project_id) return json({ error: "no project on thread" }, 400);
      const { data: evals } = await admin
        .from("ai_submission_evaluations")
        .select(`
          submission_id, total_score, summary_verdict, recommendation, startup_grade,
          strengths, gaps,
          submissions!inner(id, title, builder_id, status,
            builder_profiles!inner(full_name, username, avatar_url, experience_level))
        `)
        .eq("project_id", thread.project_id)
        .order("total_score", { ascending: false, nullsFirst: false })
        .limit(10);

      const list = evals ?? [];
      const shortlist = list.filter((e: any) => e.recommendation === "fundable" || e.recommendation === "iterate").slice(0, 5);

      stats.submissions = list.length;
      stats.shortlisted = shortlist.length;
      await updateThread({ current_stage: list.length ? 6 : (thread.current_stage ?? 5), stats });

      const reply = list.length
        ? `**${list.length} submission(s)** evaluated so far. Top ${shortlist.length} ranked below.`
        : `No evaluated submissions yet. As builders submit and the AI evaluator runs, I'll surface them here.`;
      await appendMessage("assistant", reply, [
        { type: "text", text: reply },
        ...(shortlist.length ? [{ type: "shortlist", shortlist }] : []),
      ]);
      return json({ ok: true, thread_id: threadId, evaluations: list, shortlist });
    }

    // ============ INTENT: reset ============
    if (intent === "reset") {
      await admin.from("agent_threads").update({ status: "archived" }).eq("id", threadId);
      const { data: created } = await admin
        .from("agent_threads")
        .insert({ founder_id: user.id, status: "active", current_stage: 0, stats: {} })
        .select("id")
        .single();
      return json({ ok: true, thread_id: created?.id });
    }

    return json({ error: "unknown intent" }, 400);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg === "rate_limited") return json({ error: "rate_limited", message: "AI is busy. Try again shortly." }, 429);
    if (msg === "credits_exhausted") return json({ error: "credits_exhausted", message: "AI credits exhausted." }, 402);
    console.error("founder-agent error", msg);
    return json({ error: "internal_error", message: msg }, 500);
  }
});
